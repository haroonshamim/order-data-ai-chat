const express = require('express');
const router = express.Router();
const { supabase } = require('../config/clients');

// Test database connection
router.get('/', async (req, res) => {
  try {
    // We only need count
    const { count, error } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;

    // Health-check response: if count is valid, return it; otherwise return 0.
    /* {
      "status": "OK",
      "message": "Server and database connected",
      "totalOrders": 25
    } */
    res.json({
      status: 'OK',
      message: 'Server and database connected',
      totalOrders: count || 0
    });
  } catch (err) {
    console.error('Database Connection Error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
