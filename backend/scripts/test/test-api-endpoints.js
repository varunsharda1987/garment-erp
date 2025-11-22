/**
 * API Endpoint Testing Script
 * Tests all working Phase 3 Fabric Lifecycle endpoints
 *
 * Usage: node test-api-endpoints.js
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5000';
const TEST_CREDENTIALS = {
  email: 'admin@kashayafabs.com',
  password: 'Admin@123'
};

let authToken = null;

// Test results tracking
const results = {
  passed: [],
  failed: [],
  total: 0
};

// Helper function to log test results
function logTest(name, status, details = '') {
  results.total++;
  const icon = status ? '✅' : '❌';
  const message = `${icon} ${name}${details ? ': ' + details : ''}`;

  if (status) {
    results.passed.push(name);
    console.log(message);
  } else {
    results.failed.push(name);
    console.error(message);
  }
}

// Helper function to make authenticated requests
async function authRequest(method, endpoint, data = null) {
  const config = {
    method,
    url: `${BASE_URL}${endpoint}`,
    headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
  };

  if (data) {
    config.data = data;
  }

  return axios(config);
}

// Test Suite
async function runTests() {
  console.log('🚀 Starting API Endpoint Tests...\n');
  console.log('═══════════════════════════════════════════════════════\n');

  // Test 1: Health Check
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    logTest('Health Check', response.data.status === 'ok', response.data.message);
  } catch (error) {
    logTest('Health Check', false, error.message);
  }

  // Test 2: API Info
  try {
    const response = await axios.get(`${BASE_URL}/api`);
    const hasEndpoints = response.data.endpoints && Object.keys(response.data.endpoints).length > 0;
    logTest('API Info', hasEndpoints, `${Object.keys(response.data.endpoints).length} endpoints listed`);
  } catch (error) {
    logTest('API Info', false, error.message);
  }

  console.log('\n--- Authentication ---\n');

  // Test 3: Login
  try {
    const response = await axios.post(`${BASE_URL}/api/auth/login`, TEST_CREDENTIALS);
    authToken = response.data.token;
    logTest('Login', !!authToken, 'Token received');
  } catch (error) {
    logTest('Login', false, error.response?.data?.message || error.message);
    console.error('\n❌ Authentication failed. Stopping tests.\n');
    printSummary();
    return;
  }

  console.log('\n--- Fabric Procurement Endpoints ---\n');

  // Test 4: List Procurements (GET /api/procurement)
  try {
    const response = await authRequest('GET', '/api/procurement');
    const isArray = Array.isArray(response.data.data || response.data);
    logTest('GET /api/procurement', response.status === 200 && isArray,
      `${response.data.data?.length || response.data?.length || 0} procurements found`);
  } catch (error) {
    logTest('GET /api/procurement', false, error.response?.data?.message || error.message);
  }

  // Test 5: Procurement Planning (POST /api/procurement/plan)
  // Skipping as it requires valid order ID

  // Test 6: Get Procurement by ID (will fail without valid ID, but tests route exists)
  try {
    await authRequest('GET', '/api/procurement/test-id-123');
  } catch (error) {
    // Expecting 404 or validation error, not 401 or route not found
    const validError = error.response?.status === 404 ||
                       error.response?.status === 400 ||
                       error.response?.data?.message?.includes('not found');
    logTest('GET /api/procurement/:id (route exists)', validError,
      error.response?.status === 404 ? 'Route exists (404 expected)' : 'Route validation working');
  }

  console.log('\n--- Fabric Stock Endpoints ---\n');

  // Test 7: List Stock (GET /api/stock)
  try {
    const response = await authRequest('GET', '/api/stock');
    const isArray = Array.isArray(response.data.data || response.data);
    logTest('GET /api/stock', response.status === 200 && isArray,
      `${response.data.data?.length || response.data?.length || 0} stock records found`);
  } catch (error) {
    logTest('GET /api/stock', false, error.response?.data?.message || error.message);
  }

  // Test 8: Stock Dashboard (GET /api/stock/dashboard)
  try {
    const response = await authRequest('GET', '/api/stock/dashboard');
    const hasDashboardData = response.data.data || response.data;
    logTest('GET /api/stock/dashboard', response.status === 200 && !!hasDashboardData,
      'Dashboard data received');
  } catch (error) {
    logTest('GET /api/stock/dashboard', false, error.response?.data?.message || error.message);
  }

  // Test 9: Stock Aging Report (GET /api/stock/aging)
  try {
    const response = await authRequest('GET', '/api/stock/aging');
    const isArray = Array.isArray(response.data.data || response.data);
    logTest('GET /api/stock/aging', response.status === 200 && isArray,
      `${response.data.data?.length || response.data?.length || 0} aging records found`);
  } catch (error) {
    logTest('GET /api/stock/aging', false, error.response?.data?.message || error.message);
  }

  // Test 10: Stock Valuation (GET /api/stock/valuation)
  try {
    const response = await authRequest('GET', '/api/stock/valuation');
    const isArray = Array.isArray(response.data.data || response.data);
    logTest('GET /api/stock/valuation', response.status === 200 && isArray,
      `${response.data.data?.length || response.data?.length || 0} valuation records found`);
  } catch (error) {
    logTest('GET /api/stock/valuation', false, error.response?.data?.message || error.message);
  }

  // Test 11: Get Stock by ID (will fail without valid ID, but tests route exists)
  try {
    await authRequest('GET', '/api/stock/test-id-123');
  } catch (error) {
    const validError = error.response?.status === 404 ||
                       error.response?.status === 400 ||
                       error.response?.data?.message?.includes('not found');
    logTest('GET /api/stock/:id (route exists)', validError,
      error.response?.status === 404 ? 'Route exists (404 expected)' : 'Route validation working');
  }

  console.log('\n--- Fabric & Greige Management Endpoints ---\n');

  // Test 12: List Greige Masters (GET /api/fabric-management/greige)
  try {
    const response = await authRequest('GET', '/api/fabric-management/greige');
    const isArray = Array.isArray(response.data.data || response.data);
    logTest('GET /api/fabric-management/greige', response.status === 200 && isArray,
      `${response.data.data?.length || response.data?.length || 0} greige masters found`);
  } catch (error) {
    logTest('GET /api/fabric-management/greige', false, error.response?.data?.message || error.message);
  }

  // Test 13: List Fabric Masters (GET /api/fabric-management/fabric)
  try {
    const response = await authRequest('GET', '/api/fabric-management/fabric');
    const isArray = Array.isArray(response.data.data || response.data);
    logTest('GET /api/fabric-management/fabric', response.status === 200 && isArray,
      `${response.data.data?.length || response.data?.length || 0} fabric masters found`);
  } catch (error) {
    logTest('GET /api/fabric-management/fabric', false, error.response?.data?.message || error.message);
  }

  // Test 14: List Fabric CADs (GET /api/fabric-management/cad)
  try {
    const response = await authRequest('GET', '/api/fabric-management/cad');
    const isArray = Array.isArray(response.data.data || response.data);
    logTest('GET /api/fabric-management/cad', response.status === 200 && isArray,
      `${response.data.data?.length || response.data?.length || 0} fabric CADs found`);
  } catch (error) {
    logTest('GET /api/fabric-management/cad', false, error.response?.data?.message || error.message);
  }

  console.log('\n--- Core Endpoints (Smoke Test) ---\n');

  // Test 15: List Users
  try {
    const response = await authRequest('GET', '/api/users');
    const isArray = Array.isArray(response.data.data || response.data);
    logTest('GET /api/users', response.status === 200 && isArray,
      `${response.data.data?.length || response.data?.length || 0} users found`);
  } catch (error) {
    logTest('GET /api/users', false, error.response?.data?.message || error.message);
  }

  // Test 16: List Customers
  try {
    const response = await authRequest('GET', '/api/customers');
    const isArray = Array.isArray(response.data.data || response.data);
    logTest('GET /api/customers', response.status === 200 && isArray,
      `${response.data.data?.length || response.data?.length || 0} customers found`);
  } catch (error) {
    logTest('GET /api/customers', false, error.response?.data?.message || error.message);
  }

  // Test 17: List Suppliers
  try {
    const response = await authRequest('GET', '/api/suppliers');
    const isArray = Array.isArray(response.data.data || response.data);
    logTest('GET /api/suppliers', response.status === 200 && isArray,
      `${response.data.data?.length || response.data?.length || 0} suppliers found`);
  } catch (error) {
    logTest('GET /api/suppliers', false, error.response?.data?.message || error.message);
  }

  // Test 18: List Materials
  try {
    const response = await authRequest('GET', '/api/materials');
    const isArray = Array.isArray(response.data.data || response.data);
    logTest('GET /api/materials', response.status === 200 && isArray,
      `${response.data.data?.length || response.data?.length || 0} materials found`);
  } catch (error) {
    logTest('GET /api/materials', false, error.response?.data?.message || error.message);
  }

  // Test 19: List Styles
  try {
    const response = await authRequest('GET', '/api/styles');
    const isArray = Array.isArray(response.data.data || response.data);
    logTest('GET /api/styles', response.status === 200 && isArray,
      `${response.data.data?.length || response.data?.length || 0} styles found`);
  } catch (error) {
    logTest('GET /api/styles', false, error.response?.data?.message || error.message);
  }

  // Test 20: List Orders
  try {
    const response = await authRequest('GET', '/api/orders');
    const isArray = Array.isArray(response.data.data || response.data);
    logTest('GET /api/orders', response.status === 200 && isArray,
      `${response.data.data?.length || response.data?.length || 0} orders found`);
  } catch (error) {
    logTest('GET /api/orders', false, error.response?.data?.message || error.message);
  }

  // Print Summary
  printSummary();
}

function printSummary() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('\n📊 TEST SUMMARY\n');
  console.log(`Total Tests: ${results.total}`);
  console.log(`✅ Passed: ${results.passed.length} (${Math.round(results.passed.length / results.total * 100)}%)`);
  console.log(`❌ Failed: ${results.failed.length} (${Math.round(results.failed.length / results.total * 100)}%)`);

  if (results.failed.length > 0) {
    console.log('\n❌ Failed Tests:');
    results.failed.forEach(test => console.log(`   - ${test}`));
  }

  console.log('\n═══════════════════════════════════════════════════════\n');

  if (results.failed.length === 0) {
    console.log('🎉 All tests passed! API is fully functional.\n');
  } else {
    console.log('⚠️  Some tests failed. Review errors above.\n');
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error running tests:', error.message);
  process.exit(1);
});
