// #region Imports
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
// #endregion

// #region Environment and App Setup
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
// #endregion

// #region API Routes
app.use('/api/health', require('./routes/health'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/chat',   require('./routes/chat'));
// #endregion

// #region Server Bootstrap
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Check Database Connection at http://localhost:${PORT}/api/health`);
  console.log(`Check Database Data at http://localhost:${PORT}/api/orders`);
});
// #endregion
