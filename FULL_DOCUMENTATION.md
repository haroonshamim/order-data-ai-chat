# Order Data AI Chat - Full Documentation

This document reflects the current implementation in:
- `client/src/components/ChatInterface.jsx`
- `server/server.js`
- `server/routes/health.js`
- `server/routes/orders.js`
- `server/routes/chat.js`
- `server/config/clients.js`

## 1. Project Overview

The app is a chat-based analytics assistant for order data.

- Frontend sends user questions to backend.
- Backend uses Groq tool-calling to decide when SQL should run.
- Backend validates SQL for safety.
- Backend executes SQL through Supabase RPC (`run_sql`).
- Backend sends tool results back to Groq to produce the final explanation.
- Frontend displays answer + SQL query details.

## 2. Frontend (`ChatInterface.jsx`)

## 2.1 Responsibilities

- Capture user input and send `POST /api/chat`.
- Show user and bot messages.
- Show loading state while request is in progress.
- Auto-scroll to latest message.
- Show SQL query in expandable details when available.

## 2.2 API Usage

- API URL comes from `REACT_APP_API_URL`.
- Request body:

```json
{ "message": "<user question>" }
```

- Expected success response fields:
  - `question`
  - `sqlQuery`
  - `results`
  - `response`

## 2.3 Frontend Error Handling

On API failure, frontend:
- Logs Axios error (`console.error('Chat error:', error)`).
- Logs status + backend response payload (`console.error('Chat error details:', { status, data })`).
- Appends a readable error message in the chat.

## 3. Backend

Backend structure:

- `server/server.js` initializes Express and mounts route modules.
- `server/config/clients.js` initializes shared Supabase and Groq clients.
- `server/routes/health.js` contains the health-check endpoint.
- `server/routes/orders.js` contains the orders endpoint.
- `server/routes/chat.js` contains the chat endpoint and its helper functions.

## 3.1 Core Dependencies

- `express`, `cors`, `dotenv`
- `@supabase/supabase-js`
- `groq-sdk`

## 3.2 Initialization

- Loads env variables with `dotenv.config()`.
- Creates the Express app in `server/server.js`.
- Creates the shared Supabase client in `server/config/clients.js` using service key credentials.
- Creates the shared Groq client in `server/config/clients.js` using `GROQ_API_KEY`.
- Mounts routes under `/api/health`, `/api/orders`, and `/api/chat`.

## 3.3 Utility Functions

- `validateSQL(sql)`:
  - Blocks dangerous keywords (`INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`).

- `executeSQL(sql)`:
  - Validates SQL before execution.
  - Cleans trailing semicolon.
  - Executes SQL via `supabase.rpc('run_sql', { query })`.

- `processTool(toolName, toolInput)`:
  - Executes model-requested tools.
  - Currently supports `execute_sql_query`.

- `buildSystemPrompt()`:
  - Defines the `orders` schema and query rules for the model.

- Error helpers:
  - `buildClientError(error)` returns sanitized API errors.
  - `logFullError(prefix, error)` logs detailed server-side diagnostics.
  - `getErrorDetailsForClient(error)` adds debug details when `DEBUG_ERRORS=true`.

## 3.4 API Endpoints

### `GET /api/health`

- Tests DB connectivity against `orders` table.
- Returns server/database health metadata.

### `GET /api/orders`

- Returns all rows from `orders`.

### `POST /api/chat`

Flow:
1. Validate `message` input.
2. Build a system prompt describing the `orders` table and SQL rules.
3. Send the user message to Groq with the available tool definition.
4. If Groq requests a tool call, execute `execute_sql_query` through `processTool()`.
5. Validate and run the SQL through Supabase RPC using `executeSQL()`.
6. Send tool results back to Groq until it returns a final answer.
7. Return `{ question, sqlQuery, results, response }`.

Error response:
- Returns sanitized `error` + `code`.
- When `DEBUG_ERRORS=true`, includes `details` with message/stack/full dump.

## 4. End-to-End Lifecycle

1. User asks question in chat UI.
2. Frontend posts to backend chat endpoint.
3. Groq decides whether to call the SQL execution tool.
4. Backend validates and executes the SQL.
5. Supabase `run_sql` RPC returns query results.
6. Groq uses the tool results to produce a user-friendly explanation.
7. Frontend renders response and SQL details.

## 5. Environment Variables

Backend (`server/.env`):
- `GROQ_API_KEY` (required)
- `GROQ_MODEL` (recommended)
- `SUPABASE_URL` (required)
- `SUPABASE_SERVICE_KEY` (required)
- `PORT` (optional)
- `NODE_ENV` (optional)
- `DEBUG_ERRORS` (optional, `true` to expose detailed errors in API response)

Frontend (`client/.env.development`):
- `REACT_APP_API_URL` (required)

## 6. Important Notes

- `run_sql` RPC must exist in Supabase for query execution.
- The backend is now split into route files for easier maintenance.
- Shared external clients are centralized in `server/config/clients.js`.
- If model names are deprecated on Groq, update `GROQ_MODEL`.



## Front End Flow

  In a React project, the application starts by loading the index.html file in the public folder. This file is the entry point for the web browser, but it only contains a root div where the React app will be rendered.

  The actual React code execution begins in src/index.js. This file renders the App component (from App.js) into the root div in index.html using ReactDOM. So, the browser loads index.html, and then index.js mounts App.js into it.

  Summary:

  index.html is loaded first by the browser.
  src/index.js is the JavaScript entry point.
  App.js is the main React component rendered by index.js.