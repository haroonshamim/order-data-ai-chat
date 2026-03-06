# Order Data AI Chat - Full Documentation

This document reflects the current implementation in:
- `client/src/components/ChatInterface.jsx`
- `server/server.js`

## 1. Project Overview

The app is a chat-based analytics assistant for order data.

- Frontend sends user questions to backend.
- Backend uses Groq to generate SQL.
- Backend validates SQL for safety.
- Backend executes SQL through Supabase RPC (`run_sql`).
- Backend uses Groq again to generate a natural-language explanation.
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

## 3. Backend (`server.js`)

## 3.1 Core Dependencies

- `express`, `cors`, `dotenv`
- `@supabase/supabase-js`
- `groq-sdk`
- `@google/generative-ai` is still imported/initialized in code, but chat flow currently uses Groq.

## 3.2 Initialization

- Loads env variables with `dotenv.config()`.
- Creates Supabase client using service key.
- Creates Groq client with `GROQ_API_KEY`.

## 3.3 Utility Functions

- `extractSQL(text)`:
  - Removes markdown fences/prefix text.
  - Keeps SQL starting from first `SELECT`.
  - Truncates at first semicolon.
  - Removes extra chat artifacts.

- `validateSQL(sql)`:
  - Allows only `SELECT`.
  - Blocks dangerous keywords (`INSERT`, `UPDATE`, `DELETE`, etc.).
  - Blocks SQL-comment/injection patterns (`--`, `/*`, `;`).

- `executeSQL(sql)`:
  - Cleans trailing semicolon.
  - Executes SQL via `supabase.rpc('run_sql', { query })`.

- Error helpers:
  - `buildClientError(error)` returns sanitized API errors.
  - `logFullError(prefix, error)` logs detailed server-side diagnostics.
  - `getErrorDetailsForClient(error)` adds debug details in non-production mode.

## 3.4 API Endpoints

### `GET /api/health`

- Tests DB connectivity against `orders` table.
- Returns server/database health metadata.

### `GET /api/orders`

- Returns all rows from `orders`.

### `POST /api/chat`

Flow:
1. Validate `message` input.
2. Generate SQL from question using Groq (`generateSQLFromQuestion`).
3. Validate SQL safety (`validateSQL`).
4. Execute SQL on Supabase RPC (`executeSQL`).
5. Generate natural-language explanation using Groq (`generateExplanation`).
6. Return `{ question, sqlQuery, results, response }`.

Error response:
- Returns sanitized `error` + `code`.
- In non-production (or `DEBUG_ERRORS=true`), includes `details` with message/stack/full dump.

## 4. End-to-End Lifecycle

1. User asks question in chat UI.
2. Frontend posts to backend chat endpoint.
3. Groq returns SQL.
4. Backend validates SQL.
5. Supabase `run_sql` RPC executes query.
6. Groq converts result JSON into user-friendly explanation.
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
- Backend still imports Gemini client but current chat flow uses Groq for SQL and explanation.
- If model names are deprecated on Groq, update `GROQ_MODEL`.

