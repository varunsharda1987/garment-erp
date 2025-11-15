/**
 * Test Stock Dashboard API Integration
 * Tests all 4 API calls used by the Stock Dashboard
 */

const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

// Test credentials
const TEST_USER = {
  email: 'admin@kashayafabs.com',
  password: 'admin123'
};

async function testStockDashboard() {
  try {
    console.log('🧪 Testing Stock Dashboard API Integration\n');

    // Step 1: Login to get auth token
    console.log('1️⃣  Logging in...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, TEST_USER);
    const token = loginResponse.data.token;

    if (!token) {
      throw new Error('Failed to get auth token');
    }
    console.log('✅ Login successful\n');

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // Step 2: Test Warehouses API
    console.log('2️⃣  Testing GET /api/warehouses?isActive=true');
    const warehousesResponse = await axios.get(`${API_URL}/warehouses?isActive=true`, { headers });
    const warehouses = warehousesResponse.data.data || [];
    console.log(`✅ Warehouses: ${warehouses.length} active warehouses found`);
    if (warehouses.length > 0) {
      console.log(`   Sample: ${warehouses[0].warehouseName} (${warehouses[0].warehouseCode})`);
    }
    console.log('');

    // Step 3: Test Stock Levels API
    console.log('3️⃣  Testing GET /api/stock-levels');
    const stockLevelsResponse = await axios.get(`${API_URL}/stock-levels`, { headers });
    const stockLevels = stockLevelsResponse.data.data || [];
    console.log(`✅ Stock Levels: ${stockLevels.length} materials in stock`);
    if (stockLevels.length > 0) {
      const sample = stockLevels[0];
      console.log(`   Sample: ${sample.material?.name || 'N/A'} - Qty: ${sample.quantity}`);
    }
    console.log('');

    // Step 4: Test Low Stock API
    console.log('4️⃣  Testing GET /api/stock-levels/below-reorder');
    const lowStockResponse = await axios.get(`${API_URL}/stock-levels/below-reorder`, { headers });
    const lowStockItems = lowStockResponse.data.data || [];
    console.log(`✅ Low Stock: ${lowStockItems.length} items below reorder level`);
    if (lowStockItems.length > 0) {
      const sample = lowStockItems[0];
      console.log(`   Sample: ${sample.material?.name || 'N/A'} - Qty: ${sample.quantity}/${sample.reorderLevel}`);
    }
    console.log('');

    // Step 5: Test Valuation Report API
    console.log('5️⃣  Testing GET /api/stock-levels/valuation');
    const valuationResponse = await axios.get(`${API_URL}/stock-levels/valuation`, { headers });
    const valuation = valuationResponse.data.data || {};
    console.log(`✅ Valuation: Total value = ₹${valuation.totalValue?.toFixed(2) || '0.00'}`);
    console.log(`   Total quantity: ${valuation.totalQuantity || 0} units`);
    console.log(`   Items: ${valuation.items?.length || 0} unique materials`);
    console.log('');

    // Summary
    console.log('📊 DASHBOARD METRICS SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Active Warehouses: ${warehouses.length}`);
    console.log(`   Total Materials: ${stockLevels.length}`);
    console.log(`   Low Stock Alerts: ${lowStockItems.length}`);
    console.log(`   Total Stock Value: ₹${valuation.totalValue?.toFixed(2) || '0.00'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Check if we have data
    if (warehouses.length === 0) {
      console.log('⚠️  WARNING: No warehouses found. You may need to create test data.');
    }
    if (stockLevels.length === 0) {
      console.log('⚠️  WARNING: No stock levels found. You may need to create stock movements.');
    }

    console.log('✅ All Stock Dashboard API tests passed!\n');

    return {
      success: true,
      metrics: {
        warehouses: warehouses.length,
        materials: stockLevels.length,
        lowStockAlerts: lowStockItems.length,
        totalValue: valuation.totalValue || 0
      }
    };

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    console.error('\nFull error:', error);
    return { success: false, error: error.message };
  }
}

// Run the test
testStockDashboard().then(result => {
  process.exit(result.success ? 0 : 1);
});
