const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

// #region Imports
const { createApp } = require('./config/appSetup');
// #endregion

// #region Environment and App Setup
const app = createApp();
// #endregion

// Configure CORS properly
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:3000',
  'http://localhost:5000',
  // Railway auto-generated URLs - allow all Railway preview deployments
  /.*\.railway\.app$/,
];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    // Check if origin matches allowed origins
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return origin === allowed;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Routes - Specific routes FIRST
app.use('/api/health', require('./routes/health'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/test', require('./routes/testroute'));

// Serve frontend build in production
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, '../client/build');
  app.use(express.static(buildPath));
  
  // Wildcard catch-all route MUST use RegExp in Express 4.x/5.x
  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});