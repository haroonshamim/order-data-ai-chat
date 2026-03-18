const express = require('express');
const router = express.Router();
const { turso } = require('../config/clients');

// Fetch all orders data
router.get('/', async (req, res) => {
  try {
    const result = await turso.execute('SELECT * FROM orders');

    res.json({ orders: result.rows });
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
