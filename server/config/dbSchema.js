// Database schema definitions
// This file contains the structure and metadata for all database tables

const DB_SCHEMA = {
  orders: {
    columns: [
      { name: 'order_id', type: 'integer', description: 'Unique order identifier' },
      { name: 'customer_name', type: 'text', description: 'Customer name' },
      { name: 'product', type: 'text', description: 'Product name' },
      { name: 'quantity', type: 'integer', description: 'Quantity ordered' },
      { name: 'unit_price', type: 'numeric', description: 'Price per unit' },
      { name: 'total', type: 'numeric', description: 'Total amount (REVENUE COLUMN)' },
      { name: 'order_date', type: 'date', description: 'Order date (YYYY-MM-DD)' },
      { name: 'city', type: 'text', description: 'City name' },
      { name: 'status', type: 'text', description: 'Order status (completed, pending, etc)' }
    ]
  }
};

module.exports = { DB_SCHEMA };
