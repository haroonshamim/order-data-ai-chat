const express = require('express');
const router = express.Router();
const util = require('util');
const { supabase, groq } = require('../config/clients');

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

// Execute SQL query against Supabase.
// This keeps SQL execution isolated from route logic.
async function executeSQL(sql) {
  try {
    validateSQL(sql);
    const cleanedSQL = sql.replace(/;+$/, '').trim();

    console.log('Executing SQL:', cleanedSQL);

    const { data, error } = await supabase.rpc('run_sql', { query: cleanedSQL });

    if (error) throw error;

    return data || [];
  } catch (err) {
    console.error('SQL Execution Error:', err);
    throw err;
  }
}

// Tool execution handler
async function processTool(toolName, toolInput) {
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
3. Use EXTRACT(MONTH FROM order_date) = 1 for January
4. Only use SELECT queries
5. Format your response clearly with the results`;
}

// Build client-facing errors based on error type.
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

  return {
    error: 'Invalid Request or server error. Please check your question and try again.',
    code: 'CHAT_REQUEST_FAILED',
  };
}

// Log full server-side error details for debugging.
function logFullError(prefix, error) {
  console.error(prefix);
  console.error('Message:', error?.message);
  if (error?.stack) {
    console.error('Stack:', error.stack);
  }
  console.error('Details:', util.inspect(error, { depth: null, colors: false }));
}

// Return full error details when debugging is enabled.
function getErrorDetailsForClient(error) {
  return {
    message: error?.message || 'Unknown error',
    stack: error?.stack || null,
    full: util.inspect(error, { depth: null, colors: false }),
  };
}

// #endregion

// #region Chat Route

/*
GET vs POST endpoints:
- GET retrieves data/status and should be idempotent.
- POST sends input data and may trigger processing.

app.post("/api/chat", ...): sends user input for processing.
*/
router.post('/', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ error: 'Message required' });
    }

    console.log('User Question:', message);

    const systemPrompt = buildSystemPrompt();

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: message }
    ];

    // Call Groq with tools
    let response = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || 'mixtral-8x7b-32768',
      messages: messages,
      tools: AVAILABLE_TOOLS,
      tool_choice: "auto",
      max_tokens: 2048
    });

    let sqlQuery = null;
    let queryResults = null;

    // Handle tool calls
    while (response.choices[0].message.tool_calls) {
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

          console.log(`Executing: ${toolName}`, toolInput);

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

          console.log('Tool result:', result);
        } catch (toolError) {
          console.error(`Tool error:`, toolError);
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
      response = await groq.chat.completions.create({
        model: process.env.GROQ_MODEL || 'mixtral-8x7b-32768',
        messages: messages,
        tools: AVAILABLE_TOOLS,
        max_tokens: 2048
      });
    }

    // Only use the FINAL response (after while loop ends)
    const finalResponse = response.choices[0].message.content || '';

    res.json({
      question: message,
      sqlQuery: sqlQuery,
      results: queryResults,
      response: finalResponse
    });

  } catch (error) {
    logFullError('Chat error:', error);
    const clientError = buildClientError(error);

    res.status(400).json({
      ...clientError,
      ...(process.env.DEBUG_ERRORS === 'true' && { details: getErrorDetailsForClient(error) })
    });
  }
});

// #endregion

module.exports = router;
