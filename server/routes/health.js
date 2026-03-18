const express = require('express');
const router = express.Router();
const { turso } = require('../config/clients');

// Test database connection
//that route is not active by itself yet. It becomes active only when the router is mounted into the main app, like in server.js:

//That means the '/' becomes /api/health.

router.get('/', async (req, res) => {
  try {
    // We only need count
    const result = await turso.execute('SELECT COUNT(*) AS count FROM orders');
    const count = result.rows[0]?.count ?? 0;

    // Health-check response: if count is valid, return it; otherwise return 0.
    /* {
      "status": "OK",
      "message": "Server and database connected",
      "totalOrders": 25
    } */
    res.json({
      status: 'OK',
      message: 'Server and database connected',
      totalOrders: count
    });
  } catch (err) {
    console.error('Database Connection Error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
