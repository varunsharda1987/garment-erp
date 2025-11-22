// Start backend with local database
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/garment_erp';

// Load the server
require('./dist/server.js');
