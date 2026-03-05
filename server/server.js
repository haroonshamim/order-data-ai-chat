// Import the frameworks
const express= require('express');
const cors=require('cors');
const dotenv=require('dotenv');
const {createClient}=require('@supabase/supabase-js');
const OpenAI=require('openai');

// Load environment variables
dotenv.config();

//Going to create instance of express server
const app=express();
app.use(cors());
app.use(express.json());

//SUPABASE INTERGRATION
console.log('Supabase URL:', process.env.SUPABASE_URL);
const supabase=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_KEY);


//OPENAI INTERGRATION
const openai=new OpenAI({
    apiKey:process.env.OPENAI_API_KEY
})

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

    const PORT=process.env.PORT||5000;

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Check Database Connection at http://localhost:${PORT}/api/health`);
    
});
