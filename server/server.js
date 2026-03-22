const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
console.log('Server Starting...');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('CLIENT_URL:', process.env.CLIENT_URL);

const { createApp } = require('./config/appSetup');

let app;
try {
  app = createApp();
  console.log('✅ App created successfully');
} catch (error) {
  console.error('❌ Error creating app:', error.message);
  process.exit(1);
}

// ✅ FIXED CORS Configuration
const corsOptions = {
  origin: function (origin, callback) {
    console.log('[CORS] Request from origin:', origin);
    
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    // List of allowed origins
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5000',
      process.env.CLIENT_URL,
      // Railway production URLs
      /.*\.railway\.app$/  // Match all Railway preview URLs
    ];
    
    // Check if origin is allowed
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return origin === allowed;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log('[CORS] Origin not allowed:', origin);
      callback(null, true); // Allow anyway for now, can be changed to error
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// Timeout middleware
app.use((req, res, next) => {
  req.setTimeout(180000);
  res.setTimeout(180000);
  next();
});

// Routes
try {
  app.use('/api/health', require('./routes/health'));
  app.use('/api/orders', require('./routes/orders'));
  app.use('/api/chat', require('./routes/chat'));
  app.use('/api/test', require('./routes/testroute'));
  console.log('Routes loaded successfully');
} catch (error) {
  console.error('Error loading routes:', error.message);
  process.exit(1);
}

/*

You only need these lines when you want your backend (Express) to serve the frontend (React build) from the same server/hosting.

If your frontend is deployed separately (e.g., on Vercel, Netlify, or another static host), those services serve the React build, and your backend only handles API requests.
In that case, you do NOT need these lines in your backend code.
Summary:

Same hosting (full-stack on one server): You need these lines.
Separate hosting (frontend and backend on different servers): You do not need these lines in the backend.

*/
// Serve frontend in production

/*

The build folder is the production-ready output generated when you run:
bashnpm run build
This command creates a build directory in your client folder, containing the optimized static files (HTML, CSS, JS) for deployment.
It contains your entire React app compiled, minified, and optimized for deployment — not for development.
The lines of code in the server.js file that serve the frontend are necessary if you want your Express backend to also serve the React frontend from the same server. This is common in full-stack applications where both the frontend and backend are hosted together.
In a MERN app, your Express server typically serves the build folder in production:

*/


if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, '../client/build');
  
  const StaticFilesMiddleware=express.static(buildPath);
  //It will now server the static files from the build directory when requests are made to the root URL ("/").
  app.use(StaticFilesMiddleware);
  
  
  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
  });
  console.log('✅ Frontend static serving enabled');
}

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Environment: ${process.env.NODE_ENV}`);
});

server.setTimeout(180000);

// Handle errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});