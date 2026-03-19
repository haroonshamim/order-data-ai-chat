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

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true
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
  
  // Wildcard catch-all route MUST use RegExp in Express 5.x
  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});