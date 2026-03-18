// Database schema definitions
// This file contains the structure and metadata for all database tables

//Contains a dictionary of orders having value of array of column definitions. Each column definition includes the name, data type, and a brief description of the column's purpose. This schema serves as a reference for how data is organized in the database and can be used for validation, query construction, and documentation purposes.

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

//module.exports = “what this file shares with the rest of the app”
module.exports = { DB_SCHEMA };
