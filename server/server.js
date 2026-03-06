// Import the frameworks
const express= require('express');
const cors=require('cors');
const dotenv=require('dotenv');
const util = require('util');
const {createClient}=require('@supabase/supabase-js');
const Groq = require('groq-sdk');
// Load environment variables
dotenv.config();

// Initialize GROQ client

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});
//Going to create instance of express server
const app=express();
app.use(cors());
app.use(express.json());

//SUPABASE INTERGRATION

const supabase=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_KEY);

//Testing Database Connection
app.get('/api/health',async(req,res)=>{

    try{
        const {count,error}=await supabase.from('orders').select('*',{count:'exact', head:true});
        if(error){
            throw error;
        }
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


//Fetch all orders data
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
    
function buildClientError(error) {
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

function logFullError(prefix, error) {
  console.error(prefix);
  console.error('Message:', error?.message);
  if (error?.stack) {
    console.error('Stack:', error.stack);
  }
  console.error('Details:', util.inspect(error, { depth: null, colors: false }));
}

function getErrorDetailsForClient(error) {
  return {
    message: error?.message || 'Unknown error',
    stack: error?.stack || null,
    full: util.inspect(error, { depth: null, colors: false }),
  };
}


function extractSQL(text) {

  if (!text) return "";

  // remove markdown code blocks
  text = text.replace(/```sql/gi, "")
             .replace(/```/g, "");

  // remove "SQL Query:" prefix
  text = text.replace(/SQL\s*QUERY\s*:/i, "");

  // trim whitespace
  text = text.trim();

  // find first SELECT
  const index = text.toUpperCase().indexOf("SELECT");

  if (index !== -1) {
    text = text.substring(index);
  }

  // Keep only the first SQL statement and remove trailing semicolon.
  const firstSemicolon = text.indexOf(';');
  if (firstSemicolon !== -1) {
    text = text.substring(0, firstSemicolon);
  }

  // Remove accidental chat artifacts after the query.
  text = text.replace(/\n\s*(EXPLANATION|ANSWER|NOTE)\b[\s\S]*$/i, '').trim();

  return text.trim();
}

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

  // Prevent stacked queries and SQL-comment based injections.
  if (upper.includes(';') || upper.includes('--') || upper.includes('/*')) {
    throw new Error('Invalid SQL format detected');
  }

  for (let keyword of forbidden) {
    if (upper.includes(keyword)) {
      throw new Error("Dangerous SQL detected");
    }
  }

  if (!upper.startsWith("SELECT")) {
    throw new Error("Only SELECT queries allowed");
  }

  // Restrict query scope to the orders table only.
  const tableRefs = [...upper.matchAll(/\b(?:FROM|JOIN)\s+([A-Z0-9_."]+)/g)].map((m) =>
    String(m[1] || '').replace(/"/g, '')
  );

  if (!tableRefs.length) {
    throw new Error('Query must reference the orders table');
  }

  const hasNonOrdersTable = tableRefs.some((tbl) => tbl !== 'ORDERS' && tbl !== 'PUBLIC.ORDERS');
  if (hasNonOrdersTable) {
    throw new Error('Only orders table is allowed in queries');
  }

  return true;
}
async function executeSQL(sql) {

  const cleanSql = sql.trim().replace(/;\s*$/, '');

  const { data, error } = await supabase
    .rpc("run_sql", { query: cleanSql });

  if (error) {
    throw error;
  }

  return data;
}



async function generateSQLFromQuestion(question) {

  const systemPrompt = `
You are a SQL expert.

Convert the question into SQL.

Table:
orders(id, order_id, customer_name, product, quantity, unit_price, total, order_date, city, status)

Rules:
- Only SELECT queries
- No explanations
- Use table name orders
`;

  const candidateModels = [
    process.env.GROQ_MODEL,
    'llama-3.1-8b-instant',
    'llama-3.3-70b-versatile',
    'mixtral-8x7b-32768',
  ].filter(Boolean);

  let sql = '';
  let lastErr = null;

  for (const model of candidateModels) {
    try {
      const completion = await groq.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question }
        ],
        temperature: 0
      });

      sql = completion.choices?.[0]?.message?.content || '';
      if (sql) {
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

  if (!sql) {
    throw lastErr || new Error('No SQL returned from model');
  }

  sql = extractSQL(sql);

  return sql;
}

// Chat endpoint using 
app.post("/api/chat", async (req, res) => {

  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message required" });
  }

  try {

    console.log("User Question:", message);

    // STEP 1: Generate SQL
    const sqlQuery = await generateSQLFromQuestion(message);

    console.log("Generated SQL:", sqlQuery);

    // STEP 2: Validate SQL
    validateSQL(sqlQuery);

    // STEP 3: Execute SQL in Supabase
    const results = await executeSQL(sqlQuery);

    console.log("Query Results:", results);

    // STEP 4: Generate natural explanation
    const explanation = await generateExplanation(message, results);

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


    const PORT=process.env.PORT||5000;
    app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Check Database Connection at http://localhost:${PORT}/api/health`);
    console.log(`Check Database Data at http://localhost:${PORT}/api/orders`);
   
});
