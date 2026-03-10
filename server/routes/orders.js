const express = require('express');
const router = express.Router();
const { supabase } = require('../config/clients');

// Fetch all orders data
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase.from('orders').select('*');

    if (error) throw error;

    res.json({ orders: data });
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
