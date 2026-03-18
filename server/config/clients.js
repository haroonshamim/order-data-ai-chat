/*Clients:
  “Client” = a configured SDK object that talks to an external service for you. Instead of re-creating connections in every route, you create them once in this config file and import them where needed.
   Clients Added: 1. Turso Client: For database interactions (fetching orders, health checks). 2. Groq Client: For potential future use with Groq queries (not used in current routes but set up for expansion).*/
   

const { createClient } = require('@libsql/client');
const Groq = require('groq-sdk');
const turso = createClient({
  url: process.env.APPTURSO_DATABASE_URL,
  authToken: process.env.APPTURSO_AUTH_TOKEN,
});
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

//module.exports = "what this file shares with the rest of the app"
module.exports = { turso, groq };
