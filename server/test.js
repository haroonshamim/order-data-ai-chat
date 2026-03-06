const dotenv=require('dotenv');
dotenv.config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
console.log("API KEY:"+process.env.GEMINI_API_KEY+" MODEL NAME:"+process.env.GEMINI_MODEL);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL });

async function test() {
  const result = await model.generateContent('Say hello');
  console.log(result.response.text());
}

test().catch(console.error);