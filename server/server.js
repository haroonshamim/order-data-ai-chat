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
app.post("/api/chat", async (req, res) => {

      const { message } = req.body;

      if (!message) {
        return res.status(400).json({ error: "Message required" });
      }
     
      try {

        console.log("User Question:", message);

        // Step 1: Generate SQL response text from AI.
        const aiGeneratedText = await AskLLmTogenerateSQLFromUserQuestion(message);

        // Step 2: Split SQL query and surrounding wording from AI response.
        const { sqlQuery, surroundingWording } = splitSQLQueryAndWording(aiGeneratedText);

        

        // Step 3: Validate SQL and throw if forbidden patterns exist.
        validateSQL(sqlQuery);

        // Step 4: Execute SQL in Supabase.
        const queryResults = await executeSQL(sqlQuery);

        // Append non-SQL wording into results payload.
        const results = {
          queryResults,
          aiContext: surroundingWording,
        };

        console.log("Query Results:", results);

        // Step 5: Generate natural-language explanation.
        const explanation = await generateExplanation(message, results);

        // Send response
        res.json({
          question: message,
          sqlQuery,
          results,
          response: explanation
        });

      } catch (error) {
        logFullError('Chat error (full):', error);

        const clientError = buildClientError(error);
        const shouldExposeDetails =
          process.env.NODE_ENV !== 'production' || process.env.DEBUG_ERRORS === 'true';

        const responseBody = {
          error: clientError.error,
          code: clientError.code,
        };

        if (shouldExposeDetails) {
          responseBody.details = getErrorDetailsForClient(error);
        }

        res.status(500).json(responseBody);

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


    // #region Server Bootstrap
    const PORT=process.env.PORT||5000;
    app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Check Database Connection at http://localhost:${PORT}/api/health`);
    console.log(`Check Database Data at http://localhost:${PORT}/api/orders`);
   
});
// #endregion
