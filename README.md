# Order Data AI Chat

## Required Steps to Run

1. Install dependencies from project root:

```bash
npm run install-all
```

2. Create `server/.env`:

```env
GEMINI_API_KEY=your_gemini_api_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
```

3. API URL: `client/.env.development`:

```env
REACT_APP_API_URL=http://localhost:5000/api/chat
```

4. Start backend (terminal 1):

```bash
cd server
npm run dev
```

5. Start frontend (terminal 2):

```bash
cd client
npm start
```

6. Open:

```text
http://localhost:3000
```
