// #region Imports
// Import the frameworks
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
//Going to create instance of express server
const app=express();
app.use(cors());
app.use(express.json());
// #endregion

// #region Database Client
//SUPABASE INTERGRATION

const supabase=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_KEY);
// #endregion

// #region API Routes
//Defines a GET API endpoint at /api/health

//Testing Database Connection
app.get('/api/health',async(req,res)=>{

    try{
      //We wany only count
        const {count,error}=await supabase.from('orders').select('*',{count:'exact', head:true});
        if(error){
            throw error;
        }
        //THIS IS RESPONSE FOR HEALTH CHECK API, IF COUNT IS VALID THEN ASSIGN COUNT ELSE ASSIGN 0
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
    
    //Function to handle proper Error Messages for client based on error type
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

//To Print Full Message of error in console for debugging and loggin purposes without exposing all details to client in production
        function logFullError(prefix, error) {
          console.error(prefix);
          console.error('Message:', error?.message);
          if (error?.stack) {
            console.error('Stack:', error.stack);
          }
          console.error('Details:', util.inspect(error, { depth: null, colors: false }));
        }

      //If we want to show all error details for client
      function getErrorDetailsForClient(error) {
        return {
          message: error?.message || 'Unknown error',
          stack: error?.stack || null,
          full: util.inspect(error, { depth: null, colors: false }),
        };
      }



      /*
    Get VS POST Endpoints:
      .Get is used for retrieving data or checking status without modifying anything on the server. It should be idempotent and safe.
      .Post is used for sending data to the server that may cause changes or trigger processing. It is not necessarily idempotent.

      app.get("/api/health", …) → used for checking server/database status, no data is sent in the body.

      app.post("/api/chat", …) → used for sending user input (like a message) to the server, which is then processed.

      */
app.post("/api/chat", async (req, res) => {

      const { message } = req.body;

      if (!message) {
        return res.status(400).json({ error: "Message required" });
      }
     
      try {

        console.log("User Question:", message);

        // STEP 1: Generate SQL
        const sqlQuery = await AskLLmTogenerateSQLFromUserQuestion(message);

        

        // STEP 2: Validate SQL And throw error if any forbidden query found.
        validateSQL(sqlQuery);

        // STEP 3: Execute SQL in Supabase
        const results = await executeSQL(sqlQuery);

        console.log("Query Results:", results);

        // STEP 4: Generate natural explanation
        const explanation = await generateExplanation(message, results);

        //Sending Response
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

  // Restrict query scope to the orders table only.
  const tableRefs = [...upper.matchAll(/\b(?:FROM|JOIN)\s+([A-Z0-9_."]+)/g)].map((m) =>
    String(m[1] || '').replace(/"/g, '')
  );

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
//I have created a separate macro to execute SQL queries against the Supabase database. This function takes a SQL string as input, performs basic sanitization, and then uses the Supabase client to run the query. It also handles errors gracefully, throwing them up the stack to be caught in the main API route handler. This separation of concerns helps keep the code organized and makes it easier to maintain and test the SQL execution logic independently from the rest of the application.

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

  //NOW WE ARE GOING TO TELL AI THAT WE WANT SQL QUERY FROM GIVEN USER QUESTION AND ALSO PROVIDE TABLE STRUCTURE AND RULES TO FOLLOW FOR SQL GENERATION

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

//It Removes Falsy Values from the array, so if GROQ_MODEL is not set, it will skip it and try the next models in the list. This allows for graceful fallback to other models if the specified one is unavailable or decommissioned.
  const candidateModels = [
    process.env.GROQ_MODEL,
    'llama-3.1-8b-instant',
    'llama-3.3-70b-versatile',
    'mixtral-8x7b-32768',
  ].filter(Boolean);

  let sql = '';
  let lastErr = null;

  //Try Each Model Until a result is found

  /*
Temperature in Groq's API is a parameter (ranging from 0 to 2) that controls the randomness and creativity of AI-generated text. Lower values (e.g., 0.2) make outputs more focused, precise, and deterministic, while higher values (e.g., 0.8–1.0) introduce more diversity, creativity, and randomness.

  */
  for (const model of candidateModels) {
    try {
      const completion = await groq.chat.completions.create({
        model,

        /*

          //The Message format is as follows
        [
            { 
              "role": "system", 
              "content": "You are a SQL expert. Convert the question into SQL. ......" 
            },
            { 
              "role": "user", 
              "content": "tell me total rows of data" 
            }
        ]

        */
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question }
        ],
        temperature: 0
      });


      /*CHOICES:

              Why choices (plural)?
        The AI API can actually generate multiple different responses to the same prompt in a single request. Each response is one "choice".
        You control this with a parameter called n:
        javascriptgroq.chat.completions.create({
          model,
          messages: [...],
          n: 3  // give me 3 different responses
        })
        This would return:
        json{
          "choices": [
            { "message": { "content": "SELECT COUNT(*) FROM users;" } },
            { "message": { "content": "SELECT COUNT(*) AS total FROM users;" } },
            { "message": { "content": "SELECT COUNT(1) FROM users;" } }
          ]
        }

        In your case, you didn't pass n, so it defaults to n: 1 — meaning only one choice comes back. But the API still wraps it in an array for consistency, so you always access it the same way regardless of how many you asked for.
        That's why you do:
        javascriptchoices?.[0]  // just grab the first (and only) one

        Simple analogy:
        It's like asking a friend for restaurant suggestions:

        n: 1 → they give you 1 option, but it still comes in a list: ["Burger King"]
        n: 3 → they give you 3 options: ["Burger King", "McDonald's", "KFC"]

        The list format stays the same either way.

*/

      /*
      completion.choices?.[0]?.message?.content
      ```

      Think of it as drilling down a nested object:
      ```
      completion
        └── choices          (array of possible responses)
              └── [0]        (first response)
                    └── message
                          └── content   ← the actual text we want

      */
      sql = completion.choices?.[0]?.message?.content || '';
      //Breaks the loop if a valid SQL is generated, otherwise it will try the next model in the list. This allows for graceful degradation in case some models are unavailable or fail to generate a response.
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
  console.log("Raw SQL from AI:", sql);
  sql = extractSQL(sql);
  console.log("Extracted SQL:", sql);

  return sql;
}
// #endregion

// #region SQL Response Parsing
//Function to get clear sql query from AI response by removing any markdown formatting, explanations, or extra text that the model might have included. This helps ensure that only the actual SQL query is executed against the database, improving reliability and security.
function extractSQL(text) 
{

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
// #endregion



      // #region Explanation Generation
      //Now we have results from SQL query execution, we want to generate a clear and concise explanation for the user that connects their original question with the data we retrieved. This helps make the information more accessible and actionable, especially for users who may not be familiar with SQL or raw data formats.
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
