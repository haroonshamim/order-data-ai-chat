// #region Imports
const { createApp } = require('./config/appSetup');
// #endregion

// #region Environment and App Setup
const app = createApp();
// #endregion

// #region API Routes
app.use('/api/health', require('./routes/health'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/chat',   require('./routes/chat'));
app.use('/api/test',   require('./routes/testroute'));
// #endregion

// #region Server Bootstrap
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Check Database Connection at http://localhost:${PORT}/api/health`);
  console.log(`Check Database Data at http://localhost:${PORT}/api/orders`);
});
// #endregion
