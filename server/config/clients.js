const { createClient } = require('@supabase/supabase-js');
const Groq = require('groq-sdk');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

module.exports = { supabase, groq };
