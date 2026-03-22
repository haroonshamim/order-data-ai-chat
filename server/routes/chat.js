const express = require('express');
const router = express.Router();
const util = require('util');
const { turso, groq } = require('../config/clients');

// Set timeout for this route (30 seconds)
router.use((req, res, next) => {
  req.setTimeout(120000); // 120 seconds for chat endpoint
  next();
});

// #region Tool Definitions

const AVAILABLE_TOOLS = [
  {
    type: "function",
    function: {
      name: "execute_sql_query",
      description: "Mandatory: Use this to fetch data whenever the user asks about sales, orders, or customers. Input must be a valid SQLite SELECT statement.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The SQL SELECT query. Example: SELECT * FROM orders WHERE city = 'Karachi';"
          }
        },
        required: ["query"]
      }
    }
  }
];

// #endregion

// #region Helpers

function validateSQL(sql) {
  const upperSQL = sql.toUpperCase();
  const dangerousKeywords = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER'];

  for (const keyword of dangerousKeywords) {
    if (upperSQL.includes(keyword)) {
      throw new Error(`Dangerous SQL keyword: ${keyword}`);
    }
  }

  return true;
}

// Execute SQL query against Turso.
async function executeSQL(sql) {
  try {
    validateSQL(sql);
    const cleanedSQL = sql.replace(/;+$/, '').trim();

    console.log('[SQL] Executing:', cleanedSQL);

    const result = await turso.execute(cleanedSQL);

    console.log('[SQL] Success. Rows:', result.rows?.length || 0);
    return result.rows || [];
  } catch (err) {
    console.error('[SQL] Execution Error:', err.message);
    throw err;
  }
}

// Tool execution handler
async function processTool(toolName, toolInput) {
  console.log('[Tool] Processing:', toolName);
  if (toolName === "execute_sql_query") {
    return await executeSQL(toolInput.query);
  }
  throw new Error(`Unknown tool: ${toolName}`);
}

function buildSystemPrompt() {
  return `You are a SQL analyst for an Order Management System. Your job:
1. Call execute_sql_query ONCE with the correct SQL
2. Read the tool result
3. Answer in ONE clean sentence or a short list — nothing else

## DATABASE SCHEMA
Table: \`orders\`
| Column        | Type    | Notes                              |
|---------------|---------|------------------------------------|
| order_id      | INTEGER | Primary key                        |
| customer_name | TEXT    | e.g. "Ahmed Supplies"              |
| product       | TEXT    | e.g. "Widget Pro"                  |
| quantity      | INTEGER |                                    |
| unit_price    | INTEGER |                                    |
| total         | INTEGER | Precomputed: quantity × unit_price |
| order_date    | TEXT    | ISO format: YYYY-MM-DD             |
| city          | TEXT    | e.g. "Karachi", "Lahore"           |
| status        | TEXT    | e.g. "completed", "pending"        |

## QUERY RULES
- Revenue/sales → SUM(total), never SUM(quantity)
- Month filter → strftime('%m', order_date) = '01'
- Year filter  → strftime('%Y', order_date) = '2025'
- Range filter → order_date BETWEEN '2025-01-01' AND '2025-03-31'
- Names/cities → use LIKE for case-insensitive: customer_name LIKE '%ahmed%'
- Top N        → GROUP BY → ORDER BY metric DESC → LIMIT N (default 5)
- Status values are lowercase: 'completed', 'pending', 'cancelled'
- Always alias aggregates: SUM(total) AS total_revenue

## RESPONSE RULES — READ CAREFULLY
- NEVER show raw JSON like [{"product":"Widget Pro"}]
- NEVER say "the results show" or "it appears that"
- NEVER explain what the tool returned or repeat it back
- NEVER mention tool calls, iterations, or intermediate steps
- Answer like a human analyst would in a Slack message

GOOD: "Widget Pro sold the most with 320 units across 14 orders."
BAD:  "The final answer is [{"product":"Widget Pro"}]."
BAD:  "It appears the results show Widget Pro as the top product."

If results are empty: "No data found for that query."
If question is unclear: ask one short clarifying question.`;
}
// Build client-facing errors
function buildClientError(error) {
  const message = String(error?.message || 'Unexpected server error').toLowerCase();

  if (message.includes('429') || message.includes('quota') || message.includes('too many requests')) {
    return {
      error: 'AI rate limit reached. Please try again in a few seconds.',
      code: 'AI_RATE_LIMIT',
    };
  }

  if (message.includes('does not exist')) {
    return {
      error: 'Database query error. Please rephrase your question.',
      code: 'DB_ERROR'
    };
  }

  if (message.includes('tool_use_failed') || message.includes('function')) {
    return {
      error: 'Failed to generate valid query. Please try a simpler question.',
      code: 'TOOL_ERROR'
    };
  }

  if (message.includes('timeout') || message.includes('econnrefused')) {
    return {
      error: 'Server timeout. Please try again.',
      code: 'TIMEOUT'
    };
  }

  return {
    error: 'Invalid Request or server error. Please check your question and try again.',
    code: 'CHAT_REQUEST_FAILED',
  };
}

// Log full error details
function logFullError(prefix, error) {
  console.error(`[ERROR] ${prefix}`);
  console.error('Message:', error?.message);
  console.error('Code:', error?.code);
  if (error?.stack) {
    console.error('Stack:', error.stack);
  }
}

// Return error details for client
function getErrorDetailsForClient(error) {
  return {
    message: error?.message || 'Unknown error',
    code: error?.code || 'UNKNOWN',
    stack: error?.stack || null,
  };
}

// #endregion

// #region Chat Route

router.post('/', async (req, res) => {
  const startTime = Date.now();

  try {
    const { message } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ error: 'Message required' });
    }

    console.log('[Chat] User question:', message);

    const MODEL = process.env.GROQ_MODEL || 'llama3-groq-70b-8192-tool-use-preview';
    const MAX_ITERATIONS = 3;

    const messages = [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: message }
    ];

    let sqlQuery = null;
    let queryResults = null;
    let toolIterations = 0;
    let response;

    // ── Step 1: First call — force a tool call, don't let model ramble ──
    response = await groq.chat.completions.create({
      model: MODEL,
      messages,
      tools: AVAILABLE_TOOLS,
      tool_choice: "required",   // must call a tool on first turn
      max_tokens: 512,           // tool call JSON is small, no need for 2048
      temperature: 0
    });

    // ── Step 2: Agentic loop ──
    while (response.choices[0].message.tool_calls?.length) {
      toolIterations++;
      console.log(`[Tool] Iteration ${toolIterations}`);

      if (toolIterations > MAX_ITERATIONS) {
        throw new Error(`Exceeded max tool iterations (${MAX_ITERATIONS})`);
      }

      const toolCalls = response.choices[0].message.tool_calls;

      // Append assistant message with tool calls
      messages.push({
        role: "assistant",
        content: response.choices[0].message.content ?? '',
        tool_calls: toolCalls
      });

      // Execute every tool call in parallel
      const toolResults = await Promise.all(
        toolCalls.map(async (toolCall) => {
          const toolName = toolCall.function.name;
          let result;

          try {
            const toolInput = JSON.parse(toolCall.function.arguments);
            console.log(`[Tool] Executing: ${toolName}`, toolInput);
            result = await processTool(toolName, toolInput);

            if (toolName === "execute_sql_query") {
              sqlQuery = toolInput.query;
              queryResults = result;
            }
          } catch (err) {
            console.error(`[Tool] Failed: ${toolName}`, err.message);
            result = { error: err.message };
          }

          return {
            role: "tool",
            tool_call_id: toolCall.id,
            name: toolName,
            content: JSON.stringify(result)
          };
        })
      );

      messages.push(...toolResults);

      // ── Step 3: Follow-up call — tool_choice "none" forces a text answer ──
      response = await groq.chat.completions.create({
        model: MODEL,
        messages,
        tools: AVAILABLE_TOOLS,
        tool_choice: "none",     // has the data now — just answer
        max_tokens: 1024,
        temperature: 0
      });

      console.log('[Groq] Follow-up response received');
    }

    const finalResponse = response.choices[0].message.content?.trim() || '';
    const duration = Date.now() - startTime;
    console.log(`[Chat] Done in ${duration}ms | Iterations: ${toolIterations}`);

    return res.json({
      question: message,
      sqlQuery,
      results: queryResults,
      response: finalResponse
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logFullError(`[Chat] Error after ${duration}ms:`, error);

    return res.status(500).json({
      ...buildClientError(error),
      ...(process.env.DEBUG_ERRORS === 'true' && {
        details: getErrorDetailsForClient(error)
      })
    });
  }
});

// #endregion

module.exports = router;