// #region Imports
// Import frameworks
const express= require('express');
const cors=require('cors');
const dotenv=require('dotenv');
const util = require('util');
const {createClient}=require('@supabase/supabase-js');
const Groq = require('groq-sdk');
// #endregion

// #region Environment and App Setup
// Load environment variables
dotenv.config();

// Initialize GROQ client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});
// Create Express app instance
const app=express();
app.use(cors());
app.use(express.json());
// #endregion

// #region Database Client
// Supabase integration

const supabase=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_KEY);
// #endregion

// #region Database Schema Definition
const DB_SCHEMA = {
  orders: {
    columns: [
      { name: 'order_id', type: 'integer', description: 'Unique order identifier' },
      { name: 'customer_name', type: 'text', description: 'Customer name' },
      { name: 'product', type: 'text', description: 'Product name' },
      { name: 'quantity', type: 'integer', description: 'Quantity ordered' },
      { name: 'unit_price', type: 'numeric', description: 'Price per unit' },
      { name: 'total', type: 'numeric', description: 'Total amount (REVENUE COLUMN)' },
      { name: 'order_date', type: 'date', description: 'Order date (YYYY-MM-DD)' },
      { name: 'city', type: 'text', description: 'City name' },
      { name: 'status', type: 'text', description: 'Order status (completed, pending, etc)' }
    ]
  }
};
// #endregion











// #region API Routes
// Defines a GET API endpoint at /api/health

// Test database connection
app.get('/api/health',async(req,res)=>{

    try{
      // We only need count
        const {count,error}=await supabase.from('orders').select('*',{count:'exact', head:true});
        if(error){
            throw error;
        }
        // Health-check response: if count is valid, return it; otherwise return 0.
        /* {
          "status": "OK",
          "message": "Server and database connected",
          "totalOrders": 25
        } */
           res.json({ 
      status: 'OK', 
      message: 'Server and database connected',
      
      totalOrders: count || 0
    });
  }
   catch (err) 
        {
            console.error('Database Connection Error:',err);
            res.status(500).json({error:err.message});
        }
    });


// Fetch all orders data
    app.get('/api/orders',async(req,res)=>{

        try{
            const{data,error}=await supabase.from('orders').select('*');
            if(error){
                throw error;
            }

            res.json({orders: data});
        }
        catch(err)
        {
            console.error('Error fetching orders:',err);
            res.status(500).json({error:err.message});
        }
    })
    
    // Build client-facing errors based on error type.
    function buildClientError(error) 
    {
      const message = String(error?.message || 'Unexpected server error').toLowerCase();

        if (message.includes('429') || message.includes('quota') || message.includes('too many requests')) {
          return {
            error: 'AI rate limit reached. Please try again in a few seconds.',
            code: 'AI_RATE_LIMIT',
          };
        }

        if (message.includes('generativeai')) {
          return {
            error: 'AI service is temporarily unavailable. Please try again.',
            code: 'AI_SERVICE_ERROR',
          };
        }

        return {
                //error: 'Unable to process request right now. Please try again.',
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



      /*
      GET vs POST endpoints:
      - GET retrieves data/status and should be idempotent.
      - POST sends input data and may trigger processing.

      app.get("/api/health", ...): checks server/database status.
      app.post("/api/chat", ...): sends user input for processing.
      */
// Updated chat endpoint with tool use support
// Chat endpoint with Tool Use
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({
        error: 'Message cannot be empty',
        code: 'INVALID_INPUT'
      });
    }

    console.log('User Question:', message);

    // Build system prompt with schema info
    const systemPrompt = buildSystemPrompt();

    // Initialize messages with system context
    const messages = [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: message
      }
    ];

    // Call Groq with tools
    let response = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || 'mixtral-8x7b-32768',
      messages: messages,
      tools: AVAILABLE_TOOLS,
      tool_choice: "auto",
      max_tokens: 4096
    });

    console.log('Initial Groq Response:', response.choices[0].message);

    let sqlQuery = null;
    let queryResults = null;

    // Process tool calls in a loop
    while (response.choices[0].message.tool_calls) {
      const toolCalls = response.choices[0].message.tool_calls;

      // Add assistant response to messages
      messages.push({
        role: "assistant",
        content: response.choices[0].message.content || '',
        tool_calls: toolCalls
      });

      // Process each tool call
      const toolResults = [];
      for (const toolCall of toolCalls) {
        const toolName = toolCall.function.name;
        const toolInput = JSON.parse(toolCall.function.arguments);

        console.log(`Executing tool: ${toolName}`, toolInput);

        try {
          const result = await processTool(toolName, toolInput);

          // Store SQL query for response
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

          console.log(`Tool result for ${toolName}:`, result);
        } catch (toolError) {
          console.error(`Error executing tool ${toolName}:`, toolError);
          toolResults.push({
            tool_call_id: toolCall.id,
            role: "tool",
            name: toolName,
            content: JSON.stringify({
              error: toolError.message,
              details: toolError.details || null
            })
          });
        }
      }

      // Add tool results to messages
      messages.push(...toolResults);

      // Call Groq again with tool results
      response = await groq.chat.completions.create({
        model: process.env.GROQ_MODEL || 'mixtral-8x7b-32768',
        messages: messages,
        tools: AVAILABLE_TOOLS,
        max_tokens: 4096
      });

      console.log('Groq Response after tool use:', response.choices[0].message);
    }

    // Get final response
    const finalResponse = response.choices[0].message.content || 'Unable to generate response';

    res.json({
      question: message,
      sqlQuery: sqlQuery,
      results: queryResults,
      response: finalResponse
    });

  } catch (error) {
    logFullError('Chat endpoint error:', error);
    const clientError = buildClientError(error);
    const statusCode = error.status || 500;

    res.status(statusCode).json({
      ...clientError,
      ...(process.env.DEBUG_ERRORS === 'true' && { details: getErrorDetailsForClient(error) })
    });
  }
});

// #endregion

// #region Chat Helpers
function validateSQL(sql) {

  const forbidden = [
    "INSERT",
    "UPDATE",
    "DELETE",
    "DROP",
    "ALTER",
    "TRUNCATE",
    "CREATE"
  ];

  const upper = sql.toUpperCase().trim();
console.log("Validating SQL:", upper);
  // Prevent stacked queries and SQL-comment based injections.
  if (upper.includes(';') || upper.includes('--') || upper.includes('/*')) {
    throw new Error('INVALID QUERY ERROR:Invalid SQL format detected');
  }

  for (let keyword of forbidden) {
    if (upper.includes(keyword)) {
      throw new Error("INVALID QUERY ERROR:Dangerous SQL detected");
    }
  }

  if (!upper.startsWith("SELECT")) {
    throw new Error("INVALID QUERY ERROR:Only SELECT queries allowed");
  }

  // Restrict query scope to real FROM/JOIN table clauses only (ignore function bodies like EXTRACT(...)).
  const tableRefs = [];
  let depth = 0;
  const fromJoinRegex = /\b(?:FROM|JOIN)\b\s+([A-Z0-9_."]+)/g;
  let match;

  while ((match = fromJoinRegex.exec(upper)) !== null) {
    const prefix = upper.slice(0, match.index);
    depth = 0;

    for (const ch of prefix) {
      if (ch === '(') depth += 1;
      if (ch === ')') depth = Math.max(0, depth - 1);
    }

    if (depth !== 0) {
      continue;
    }

    tableRefs.push(String(match[1] || '').replace(/"/g, ''));
  }

  if (!tableRefs.length) {
    throw new Error('INVALID QUERY ERROR:Query must reference the orders table');
  }

  const hasNonOrdersTable = tableRefs.some((tbl) => tbl !== 'ORDERS' && tbl !== 'PUBLIC.ORDERS');
  if (hasNonOrdersTable) {
    throw new Error('INVALID QUERY ERROR:Only orders table is allowed in queries');
  }

  return true;
}

// #region SQL Execution and Generation
// Execute SQL query against Supabase.
// This keeps SQL execution isolated from route logic.

async function executeSQL(sql) {

  const cleanSql = sql.trim().replace(/;\s*$/, '');

  const { data, error } = await supabase
    .rpc("run_sql", { query: cleanSql });

  if (error) {
    throw error;
  }

  return data;
}



async function AskLLmTogenerateSQLFromUserQuestion(question) {

  // Ask AI to convert the user question into SQL.

  const systemPrompt = `
You are a SQL expert.

Convert the question into SQL.

Table:
orders(id, order_id, customer_name, product, quantity, unit_price, total, order_date, city, status)

Rules:
- Only NON HARMFUL queries
- No explanations
- Use table name orders
`;

// Remove falsy entries so fallback models are used safely.
  const candidateModels = [
    process.env.GROQ_MODEL,
    'llama-3.1-8b-instant',
    'llama-3.3-70b-versatile',
    'mixtral-8x7b-32768',
  ].filter(Boolean);

  let aiResponse = '';
  let lastErr = null;

  // Try each model until a result is returned.

  // Temperature 0 keeps SQL generation deterministic.
  for (const model of candidateModels) {
    try {
      const completion = await groq.chat.completions.create({
        model,

        // Message format uses standard system + user roles.
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question }
        ],
        temperature: 0
      });

      // Read content from the first completion choice.
      aiResponse = completion.choices?.[0]?.message?.content || '';
      // Break when a valid response is generated.
      if (aiResponse) {
        break;
      }
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || '').toLowerCase();
      if (msg.includes('model_decommissioned') || msg.includes('decommissioned') || msg.includes('model_not_found')) {
        continue;
      }
      throw err;
    }
  }

  if (!aiResponse) {
    throw lastErr || new Error('No SQL returned from model');
  }
  console.log("Raw AI SQL response:", aiResponse);

  return aiResponse;
}
// #endregion

// #region SQL Response Parsing
function splitSQLQueryAndWording(text) {

        const rawText = String(text || '').trim();
        if (!rawText) {
          return { sqlQuery: '', surroundingWording: '' };
        }

        const cleanedText = rawText.replace(/```sql/gi, '').replace(/```/g, '').trim();
        const upperText = cleanedText.toUpperCase();
        const selectIndex = upperText.indexOf('SELECT');

        if (selectIndex === -1) {
          return { sqlQuery: '', surroundingWording: cleanedText };
        }

        const semicolonIndex = cleanedText.indexOf(';', selectIndex);
        const sqlEndIndex = semicolonIndex === -1 ? cleanedText.length : semicolonIndex + 1;

        const sqlChunk = cleanedText.substring(selectIndex, sqlEndIndex).trim();
        const sqlQuery = extractSQL(sqlChunk);

        const beforeSql = cleanedText.substring(0, selectIndex).trim();
        const afterSql = cleanedText.substring(sqlEndIndex).trim();
        const surroundingWording = [beforeSql, afterSql].filter(Boolean).join('\n').trim();

        return { sqlQuery, surroundingWording };
      }

// Extract SQL query by removing markdown wrappers and extra text.
function extractSQL(text) 
{

        if (!text) return "";

        // Remove markdown code blocks.
        text = text.replace(/```sql/gi, "")
                  .replace(/```/g, "");

        // Remove "SQL Query:" prefix.
        text = text.replace(/SQL\s*QUERY\s*:/i, "");

        // Trim whitespace.
        text = text.trim();

        // Find first SELECT.
        const index = text.toUpperCase().indexOf("SELECT");

        if (index !== -1) {
          text = text.substring(index);
        }

        // Keep only first SQL statement and remove trailing semicolon.
        const firstSemicolon = text.indexOf(';');
        if (firstSemicolon !== -1) {
          text = text.substring(0, firstSemicolon);
        }

        // Remove accidental chat artifacts after query.
        text = text.replace(/\n\s*(EXPLANATION|ANSWER|NOTE)\b[\s\S]*$/i, '').trim();

        return text.trim();
      }
// #endregion



      // #region Explanation Generation
      // Generate a concise explanation from question + SQL results payload.
async function generateExplanation(question, results) {
  const prompt = `User question:\n${question}\n\nSQL results:\n${JSON.stringify(results, null, 2)}\n\nExplain the answer clearly to the user.`;

  const candidateModels = [
    process.env.GROQ_MODEL,
    'llama-3.1-8b-instant',
    'llama-3.3-70b-versatile',
    'mixtral-8x7b-32768',
  ].filter(Boolean);

  let explanation = '';
  let lastErr = null;

  for (const model of candidateModels) {
    try {
      const completion = await groq.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: 'You are a helpful data analyst assistant.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
      });

      explanation = completion.choices?.[0]?.message?.content?.trim() || '';
      if (explanation) {
        break;
      }
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || '').toLowerCase();
      if (msg.includes('model_decommissioned') || msg.includes('decommissioned') || msg.includes('model_not_found')) {
        continue;
      }
      throw err;
    }
  }

  if (!explanation) {
    if (lastErr) {
      throw lastErr;
    }
    return 'No explanation generated.';
  }

  return explanation;
}
// #endregion

// #endregion


//#region 

// Add this near your other utility functions

// Define available tools for Groq
// #region Tool Definitions
const AVAILABLE_TOOLS = [
  {
    type: "function",
    function: {
      name: "execute_sql_query",
      description: "Execute a SQL SELECT query against the orders database to fetch and analyze order data",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The SQL SELECT query to execute. Use ONLY columns that exist: order_id, customer_name, product, quantity, unit_price, total, order_date, city, status"
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_table_schema",
      description: "Get the schema and column information for a database table",
      parameters: {
        type: "object",
        properties: {
          table_name: {
            type: "string",
            description: "The name of the table (use 'orders')"
          }
        },
        required: ["table_name"]
      }
    }
  }
];
// #endregion
// Tool execution handler
async function processTool(toolName, toolInput) {
  switch (toolName) {
    case "execute_sql_query":
      return await executeSQL(toolInput.query);
    
    case "get_table_schema":
      return await getTableSchema(toolInput.table_name);
    
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// Helper function to get table schema
async function getTableSchema(tableName) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(0);
    
    if (error) throw error;
    
    return {
      table: tableName,
      columns: Object.keys(data || {}).join(', ')
    };
  } catch (err) {
    return { error: err.message };
  }
}

function buildSystemPrompt() {
  const schemaInfo = DB_SCHEMA.orders.columns
    .map(col => `  - ${col.name} (${col.type}): ${col.description}`)
    .join('\n');

  return `You are an AI assistant helping users analyze order data from a Supabase database.

DATABASE SCHEMA - Orders Table:
${schemaInfo}

CRITICAL RULES FOR SQL GENERATION:
1. ONLY use these exact column names: order_id, customer_name, product, quantity, unit_price, total, order_date, city, status
2. For REVENUE/SALES: Always use the 'total' column (NOT 'revenue' or any other name)
3. For DATE filtering: Use order_date column with DATE() or EXTRACT() functions
4. For MONTH filtering: Use EXTRACT(MONTH FROM order_date) = X
5. For YEAR filtering: Use EXTRACT(YEAR FROM order_date) = X
6. Always write SELECT statements only - NEVER INSERT, UPDATE, DELETE, etc.
7. Use proper SQL syntax: SUM(), COUNT(), AVG(), GROUP BY, WHERE, ORDER BY
8. Format numbers with proper aggregation functions
9. Provide clear explanations of results
10. If a requested column doesn't exist, explain which column to use instead

EXAMPLE QUERIES:
- Total revenue in January: SELECT SUM(total) as total_revenue FROM orders WHERE EXTRACT(MONTH FROM order_date) = 1
- Orders by city: SELECT city, COUNT(*) as order_count, SUM(total) as total_revenue FROM orders GROUP BY city
- Top product: SELECT product, SUM(quantity) as total_quantity, SUM(total) as revenue FROM orders GROUP BY product ORDER BY revenue DESC LIMIT 1`;
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

  if (message.includes('does not exist') || message.includes('column')) {
    return {
      error: 'Database query failed. The AI generated an incorrect SQL query. Please try rephrasing your question.',
      code: 'DB_QUERY_ERROR',
    };
  }

  if (message.includes('groq') || message.includes('ai service')) {
    return {
      error: 'AI service is temporarily unavailable. Please try again.',
      code: 'AI_SERVICE_ERROR',
    };
  }

  return {
    error: 'Unable to process your request. Please try again with a different question.',
    code: 'CHAT_REQUEST_FAILED',
  };
}
//#endregion
    // #region Server Bootstrap
    const PORT=process.env.PORT||5000;
    app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Check Database Connection at http://localhost:${PORT}/api/health`);
    console.log(`Check Database Data at http://localhost:${PORT}/api/orders`);
   
});
// #endregion
