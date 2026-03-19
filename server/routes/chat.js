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
      description: "Execute a SELECT SQL query to fetch order data from the database",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The SQL SELECT query to execute"
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
  return `You are a helpful assistant that analyzes order data from a database.

DATABASE SCHEMA:
- Table: orders
- Columns: order_id, customer_name, product, quantity, unit_price, total, order_date, city, status

KEY RULES:
1. Use the execute_sql_query tool to query the database
2. The 'total' column contains revenue/sales amount
3. Use strftime('%m', order_date) = '01' for January (SQLite syntax)
4. Only use SELECT queries
5. Use SQLite-compatible SQL syntax
6. Format your response clearly with the results`;
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
      console.log('[Chat] Empty message received');
      return res.status(400).json({ error: 'Message required' });
    }

    console.log('[Chat] User question:', message);

    const systemPrompt = buildSystemPrompt();

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: message }
    ];

    // Call Groq with tools
    console.log('[Groq] Calling API...');
    let response = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || 'mixtral-8x7b-32768',
      messages: messages,
      tools: AVAILABLE_TOOLS,
      tool_choice: "auto",
      max_tokens: 2048
    });
    console.log('[Groq] Response received');

    let sqlQuery = null;
    let queryResults = null;
    let toolIterations = 0;

    // Handle tool calls
    while (response.choices[0].message.tool_calls) {
      toolIterations++;
      console.log(`[Tool] Iteration ${toolIterations}`);
      
      if (toolIterations > 5) {
        throw new Error('Too many tool iterations');
      }

      const toolCalls = response.choices[0].message.tool_calls;

      messages.push({
        role: "assistant",
        content: response.choices[0].message.content || '',
        tool_calls: toolCalls
      });

      const toolResults = [];

      for (const toolCall of toolCalls) {
        try {
          const toolName = toolCall.function.name;
          const toolInput = JSON.parse(toolCall.function.arguments);

          console.log(`[Tool] Executing: ${toolName}`);

          const result = await processTool(toolName, toolInput);

          if (toolName === "execute_sql_query") {
            sqlQuery = toolInput.query;
            queryResults = result;
          }

          toolResults.push({
            tool_call_id: toolCall.id,
            role: "tool",
            name: toolName,
            content: JSON.stringify(result)
          });

          console.log(`[Tool] ${toolName} completed`);
        } catch (toolError) {
          console.error(`[Tool] Error in ${toolCall.function.name}:`, toolError.message);
          toolResults.push({
            tool_call_id: toolCall.id,
            role: "tool",
            name: toolCall.function.name,
            content: JSON.stringify({ error: toolError.message })
          });
        }
      }

      messages.push(...toolResults);

      // Get next response from Groq
      console.log('[Groq] Calling API for next response...');
      response = await groq.chat.completions.create({
        model: process.env.GROQ_MODEL || 'mixtral-8x7b-32768',
        messages: messages,
        tools: AVAILABLE_TOOLS,
        max_tokens: 2048
      });
      console.log('[Groq] Response received');
    }

    // Final response
    const finalResponse = response.choices[0].message.content || '';

    const duration = Date.now() - startTime;
    console.log(`[Chat] Complete! Duration: ${duration}ms, Iterations: ${toolIterations}`);

    res.json({
      question: message,
      sqlQuery: sqlQuery,
      results: queryResults,
      response: finalResponse
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logFullError(`Chat error (${duration}ms):`, error);
    const clientError = buildClientError(error);

    res.status(500).json({
      ...clientError,
      ...(process.env.DEBUG_ERRORS === 'true' && { details: getErrorDetailsForClient(error) })
    });
  }
});

// #endregion

module.exports = router;