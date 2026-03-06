// Import the frameworks
const express= require('express');
const cors=require('cors');
const dotenv=require('dotenv');
const {createClient}=require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Load environment variables
dotenv.config();

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.5-flash' });

//Going to create instance of express server
const app=express();
app.use(cors());
app.use(express.json());

//SUPABASE INTERGRATION

const supabase=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_KEY);



//Testing Database Connection
app.get('/api/health',async(req,res)=>{

    try{
        const {data,error}=await supabase.from('orders').select('count',{count:'exact'});
        if(error){
            throw error;
        }
           res.json({ 
      status: 'OK', 
      message: 'Server and database connected',
      totalOrders: data?.length|| 0
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


async function generateSQLFromQuestion(question) {
  const systemPrompt = `You are a SQL expert. Convert natural language questions into SQL queries.

Table schema: orders (id, order_id, customer_name, product, quantity, unit_price, total, order_date, city, status)

Guidelines:
- Only return the SQL query, no explanations.
- Use this exact table name: orders.
- Format dates as YYYY-MM-DD.
- For revenue/total calculations, sum the 'total' column.
- For counts, use COUNT(*).
- Wrap response in: SELECT ...;`;

  try {
    const prompt = `${systemPrompt}\n\nQuestion: "${question}"\nGenerate ONLY the SQL query to answer this question.`;
    const result = await geminiModel.generateContent(prompt);
    const sqlQuery = result.response.text().trim();

    if (!sqlQuery) throw new Error('Gemini returned empty SQL');

    return sqlQuery;
  } catch (err) {
    console.error('Error generating SQL:', err);
    throw new Error(`Failed to generate SQL: ${err.message}`);
  }
}

// Chat endpoint using Gemini
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Invalid message. Must be a non-empty string.' });
  }

  console.log('\n📝 Received question:', message);

  try {
    // Step 1: Generate SQL via Gemini
    let sqlQuery;
    try {
      const sqlSystemPrompt = `You are a SQL expert. Convert natural language questions into SQL queries.
Table schema: orders (id, order_id, customer_name, product, quantity, unit_price, total, order_date, city, status)
Guidelines:
- Only return the SQL query, no explanations
- Use this exact table name: orders
- Format dates as YYYY-MM-DD
- For revenue/total calculations, sum the 'total' column
- For counts, use COUNT(*)
- Wrap response in: SELECT ...;`;

      const sqlPrompt = `${sqlSystemPrompt}\n\nQuestion: "${message}"\nGenerate ONLY the SQL query.`;
      const sqlResult = await geminiModel.generateContent(sqlPrompt);
      sqlQuery = sqlResult.response.text().trim() || 'SELECT * FROM orders LIMIT 5;';
      console.log('📊 Generated SQL:', sqlQuery);
    } catch (sqlErr) {
      console.error('Error generating SQL:', sqlErr);
      return res.status(500).json({ error: 'Failed to generate SQL', details: sqlErr.message });
    }

    // Step 2: Fetch all orders from Supabase
    const { data: allOrders, error: dbError } = await supabase.from('orders').select('*');
    if (dbError) throw dbError;
    console.log(`✅ Fetched ${allOrders.length} orders`);

    // Step 3: Execute SQL locally
    const results = await executeQueryLocally(sqlQuery, allOrders);
    console.log('📈 Local execution results:', results);

    // Step 4: Generate natural language explanation via Gemini
    let naturalResponse;
    try {
      const responsePrompt = `You are a helpful assistant.

User asked: "${message}"
SQL results: ${JSON.stringify(results, null, 2)}
Provide a clear, conversational answer based on these results.`;

      const aiResult = await geminiModel.generateContent(responsePrompt);
      naturalResponse = aiResult.response.text().trim() || 'Gemini did not return a valid response.';
      console.log('💬 AI response:', naturalResponse);
    } catch (aiErr) {
      console.error('AI response error:', aiErr);
      naturalResponse = 'AI failed to generate a response.';
    }

    res.json({
      question: message,
      sqlQuery,
      results,
      response: naturalResponse,
    });
  } catch (err) {
    console.error('Unhandled chat error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Helper function for local query execution (unchanged)
async function executeQueryLocally(sqlQuery, allData) {
  try {
    const query = String(sqlQuery || '').toUpperCase();

    if (query.includes('SUM(') && query.includes('JANUARY')) {
      return allData
        .filter(
          (order) =>
            new Date(order.order_date).getMonth() === 0 &&
            order.status === 'completed'
        )
        .reduce((sum, order) => sum + Number(order.total || 0), 0);
    }

    if (query.includes('COUNT(*)') && query.includes('GROUP BY')) {
      const grouped = {};
      allData.forEach((order) => {
        if (!grouped[order.product]) grouped[order.product] = 0;
        grouped[order.product] += Number(order.quantity || 0);
      });
      return Object.entries(grouped).map(([product, quantity]) => ({
        product,
        total_quantity: quantity,
      }));
    }

    if (query.includes('TOP 3') || query.includes('LIMIT 3')) {
      const customerSpend = {};
      allData.forEach((order) => {
        if (!customerSpend[order.customer_name]) {
          customerSpend[order.customer_name] = 0;
        }
        customerSpend[order.customer_name] += Number(order.total || 0);
      });
      return Object.entries(customerSpend)
        .map(([customer, spend]) => ({
          customer_name: customer,
          total_spend: spend,
        }))
        .sort((a, b) => b.total_spend - a.total_spend)
        .slice(0, 3);
    }

    return allData.slice(0, 20);
  } catch (err) {
    console.error('Local query execution error:', err);
    return allData.slice(0, 20);
  }
}


    const PORT=process.env.PORT||5000;
    app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Check Database Connection at http://localhost:${PORT}/api/health`);
    console.log(`Check Database Data at http://localhost:${PORT}/api/orders`);
   
});
