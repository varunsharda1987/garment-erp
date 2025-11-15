// API Testing Script for Phase 3 Inventory & Warehouse Management
const https = require('https');
const http = require('http');

const BASE_URL = 'http://localhost:5000';
let authToken = '';
let testResults = {
  passed: 0,
  failed: 0,
  errors: [],
  results: []
};

// Test data storage
let testWarehouse = null;
let testMaterial = null;
let testStockLevel = null;
let testStockMovement = null;
let testStockCount = null;

// Utility function to make HTTP requests
function makeRequest(method, path, data = null, requireAuth = true) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (requireAuth && authToken) {
      options.headers['Authorization'] = `Bearer ${authToken}`;
    }

    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const responseData = body ? JSON.parse(body) : {};
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: responseData
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: body
          });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// Test functions
async function testHealthCheck() {
  console.log('\n📡 Testing Backend Health Check...');
  try {
    const response = await makeRequest('GET', '/health', null, false);
    if (response.status === 200) {
      console.log('✅ Backend is healthy');
      testResults.passed++;
      testResults.results.push({ test: 'Health Check', status: 'PASS' });
      return true;
    } else {
      console.log('❌ Backend health check failed');
      testResults.failed++;
      testResults.errors.push('Health check returned status: ' + response.status);
      testResults.results.push({ test: 'Health Check', status: 'FAIL', error: 'Status: ' + response.status });
      return false;
    }
  } catch (error) {
    console.log('❌ Cannot connect to backend:', error.message);
    testResults.failed++;
    testResults.errors.push('Cannot connect to backend: ' + error.message);
    testResults.results.push({ test: 'Health Check', status: 'FAIL', error: error.message });
    return false;
  }
}

async function getAuthToken() {
  console.log('\n🔐 Getting Authentication Token...');
  try {
    const response = await makeRequest('POST', '/api/auth/login', {
      email: 'admin@kashayafabs.com',
      password: 'Admin@123'
    }, false);

    if (response.status === 200 && response.data.token) {
      authToken = response.data.token;
      console.log('✅ Authentication successful');
      testResults.passed++;
      testResults.results.push({ test: 'Authentication', status: 'PASS' });
      return true;
    } else {
      console.log('❌ Authentication failed:', response.data);
      testResults.failed++;
      testResults.errors.push('Authentication failed');
      testResults.results.push({ test: 'Authentication', status: 'FAIL', error: JSON.stringify(response.data) });
      return false;
    }
  } catch (error) {
    console.log('❌ Authentication error:', error.message);
    testResults.failed++;
    testResults.errors.push('Authentication error: ' + error.message);
    testResults.results.push({ test: 'Authentication', status: 'FAIL', error: error.message });
    return false;
  }
}

// Warehouse Management Tests (9 endpoints)
async function testWarehouseManagement() {
  console.log('\n\n🏢 TESTING WAREHOUSE MANAGEMENT (9 endpoints)');
  console.log('='.repeat(60));

  // 1. Generate Warehouse Code
  console.log('\n1️⃣  Testing: Generate Warehouse Code');
  try {
    const response = await makeRequest('GET', '/api/warehouses/generate-code/RAW_MATERIAL');
    if (response.status === 200 && response.data.code) {
      console.log(`✅ Generated code: ${response.data.code}`);
      testResults.passed++;
      testResults.results.push({ test: 'Generate Warehouse Code', status: 'PASS', data: response.data.code });
    } else {
      console.log('❌ Failed to generate code');
      testResults.failed++;
      testResults.results.push({ test: 'Generate Warehouse Code', status: 'FAIL' });
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
    testResults.failed++;
    testResults.results.push({ test: 'Generate Warehouse Code', status: 'FAIL', error: error.message });
  }

  // 2. Create Warehouse
  console.log('\n2️⃣  Testing: Create Warehouse');
  try {
    const warehouseData = {
      warehouseCode: 'WH-RM-TEST-001',
      warehouseName: 'Test Raw Material Warehouse',
      warehouseType: 'RAW_MATERIAL',
      address: 'Test Address 123',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      country: 'India',
      contactPerson: 'Test Contact',
      contactPhone: '+91-9876543210',
      isActive: true
    };
    const response = await makeRequest('POST', '/api/warehouses', warehouseData);
    if (response.status === 201 && response.data.data) {
      testWarehouse = response.data.data;
      console.log(`✅ Warehouse created: ${testWarehouse.id}`);
      testResults.passed++;
      testResults.results.push({ test: 'Create Warehouse', status: 'PASS', id: testWarehouse.id });
    } else {
      console.log('❌ Failed to create warehouse:', response.data);
      testResults.failed++;
      testResults.results.push({ test: 'Create Warehouse', status: 'FAIL', error: JSON.stringify(response.data) });
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
    testResults.failed++;
    testResults.results.push({ test: 'Create Warehouse', status: 'FAIL', error: error.message });
  }

  if (!testWarehouse) {
    console.log('\n⚠️  Skipping remaining warehouse tests - warehouse creation failed');
    return;
  }

  // 3. Get All Warehouses
  console.log('\n3️⃣  Testing: Get All Warehouses');
  try {
    const response = await makeRequest('GET', '/api/warehouses');
    if (response.status === 200 && response.data.data) {
      console.log(`✅ Retrieved ${response.data.count || response.data.data.length} warehouses`);
      testResults.passed++;
      testResults.results.push({ test: 'Get All Warehouses', status: 'PASS', count: response.data.count });
    } else {
      console.log('❌ Failed to get warehouses');
      testResults.failed++;
      testResults.results.push({ test: 'Get All Warehouses', status: 'FAIL' });
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
    testResults.failed++;
    testResults.results.push({ test: 'Get All Warehouses', status: 'FAIL', error: error.message });
  }

  // 4. Get Warehouse by ID
  console.log('\n4️⃣  Testing: Get Warehouse by ID');
  try {
    const response = await makeRequest('GET', `/api/warehouses/${testWarehouse.id}`);
    if (response.status === 200 && response.data.data) {
      console.log(`✅ Retrieved warehouse: ${response.data.data.warehouseName}`);
      testResults.passed++;
      testResults.results.push({ test: 'Get Warehouse by ID', status: 'PASS' });
    } else {
      console.log('❌ Failed to get warehouse by ID');
      testResults.failed++;
      testResults.results.push({ test: 'Get Warehouse by ID', status: 'FAIL' });
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
    testResults.failed++;
    testResults.results.push({ test: 'Get Warehouse by ID', status: 'FAIL', error: error.message });
  }

  // 5. Get Warehouse by Code
  console.log('\n5️⃣  Testing: Get Warehouse by Code');
  try {
    const response = await makeRequest('GET', `/api/warehouses/code/${testWarehouse.warehouseCode}`);
    if (response.status === 200 && response.data.data) {
      console.log(`✅ Retrieved warehouse by code`);
      testResults.passed++;
      testResults.results.push({ test: 'Get Warehouse by Code', status: 'PASS' });
    } else {
      console.log('❌ Failed to get warehouse by code');
      testResults.failed++;
      testResults.results.push({ test: 'Get Warehouse by Code', status: 'FAIL' });
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
    testResults.failed++;
    testResults.results.push({ test: 'Get Warehouse by Code', status: 'FAIL', error: error.message });
  }

  // 6. Get Warehouses by Type
  console.log('\n6️⃣  Testing: Get Warehouses by Type');
  try {
    const response = await makeRequest('GET', '/api/warehouses/by-type/RAW_MATERIAL');
    if (response.status === 200 && response.data.data) {
      console.log(`✅ Retrieved ${response.data.count || response.data.data.length} RAW_MATERIAL warehouses`);
      testResults.passed++;
      testResults.results.push({ test: 'Get Warehouses by Type', status: 'PASS' });
    } else {
      console.log('❌ Failed to get warehouses by type');
      testResults.failed++;
      testResults.results.push({ test: 'Get Warehouses by Type', status: 'FAIL' });
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
    testResults.failed++;
    testResults.results.push({ test: 'Get Warehouses by Type', status: 'FAIL', error: error.message });
  }

  // 7. Update Warehouse
  console.log('\n7️⃣  Testing: Update Warehouse');
  try {
    const updateData = {
      warehouseName: 'Updated Test Warehouse',
      contactPerson: 'Updated Contact'
    };
    const response = await makeRequest('PUT', `/api/warehouses/${testWarehouse.id}`, updateData);
    if (response.status === 200 && response.data.data) {
      console.log(`✅ Warehouse updated successfully`);
      testResults.passed++;
      testResults.results.push({ test: 'Update Warehouse', status: 'PASS' });
    } else {
      console.log('❌ Failed to update warehouse');
      testResults.failed++;
      testResults.results.push({ test: 'Update Warehouse', status: 'FAIL' });
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
    testResults.failed++;
    testResults.results.push({ test: 'Update Warehouse', status: 'FAIL', error: error.message });
  }

  // 8. Get Warehouse Stock Summary (will be empty initially)
  console.log('\n8️⃣  Testing: Get Warehouse Stock Summary');
  try {
    const response = await makeRequest('GET', `/api/warehouses/${testWarehouse.id}/stock-summary`);
    if (response.status === 200) {
      console.log(`✅ Stock summary retrieved (materials: ${response.data.data?.totalMaterials || 0})`);
      testResults.passed++;
      testResults.results.push({ test: 'Get Warehouse Stock Summary', status: 'PASS' });
    } else {
      console.log('❌ Failed to get stock summary');
      testResults.failed++;
      testResults.results.push({ test: 'Get Warehouse Stock Summary', status: 'FAIL' });
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
    testResults.failed++;
    testResults.results.push({ test: 'Get Warehouse Stock Summary', status: 'FAIL', error: error.message });
  }

  // Note: Delete test will be done at the end after all other tests
  console.log('\n9️⃣  Testing: Delete Warehouse (deferred to end)');
  console.log('⏭️  Will test after stock tests complete');
}

// Stock Level Management Tests (8 endpoints)
async function testStockLevelManagement() {
  console.log('\n\n📊 TESTING STOCK LEVEL MANAGEMENT (8 endpoints)');
  console.log('='.repeat(60));

  // 1. Get All Stock Levels
  console.log('\n1️⃣  Testing: Get All Stock Levels');
  try {
    const response = await makeRequest('GET', '/api/stock-levels');
    if (response.status === 200) {
      console.log(`✅ Retrieved ${response.data.count || 0} stock levels`);
      testResults.passed++;
      testResults.results.push({ test: 'Get All Stock Levels', status: 'PASS', count: response.data.count });
    } else {
      console.log('❌ Failed to get stock levels');
      testResults.failed++;
      testResults.results.push({ test: 'Get All Stock Levels', status: 'FAIL' });
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
    testResults.failed++;
    testResults.results.push({ test: 'Get All Stock Levels', status: 'FAIL', error: error.message });
  }

  // 2. Get Materials Below Reorder Level
  console.log('\n2️⃣  Testing: Get Materials Below Reorder Level');
  try {
    const response = await makeRequest('GET', '/api/stock-levels/below-reorder');
    if (response.status === 200) {
      console.log(`✅ Retrieved ${response.data.count || 0} materials below reorder level`);
      testResults.passed++;
      testResults.results.push({ test: 'Get Materials Below Reorder Level', status: 'PASS' });
    } else {
      console.log('❌ Failed to get materials below reorder level');
      testResults.failed++;
      testResults.results.push({ test: 'Get Materials Below Reorder Level', status: 'FAIL' });
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
    testResults.failed++;
    testResults.results.push({ test: 'Get Materials Below Reorder Level', status: 'FAIL', error: error.message });
  }

  // 3. Get Stock Valuation Report
  console.log('\n3️⃣  Testing: Get Stock Valuation Report');
  try {
    const response = await makeRequest('GET', '/api/stock-levels/valuation');
    if (response.status === 200) {
      console.log(`✅ Stock valuation report retrieved`);
      testResults.passed++;
      testResults.results.push({ test: 'Get Stock Valuation Report', status: 'PASS' });
    } else {
      console.log('❌ Failed to get valuation report');
      testResults.failed++;
      testResults.results.push({ test: 'Get Stock Valuation Report', status: 'FAIL' });
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
    testResults.failed++;
    testResults.results.push({ test: 'Get Stock Valuation Report', status: 'FAIL', error: error.message });
  }

  // Skip remaining tests if no warehouse
  if (!testWarehouse) {
    console.log('\n⚠️  Skipping warehouse-specific stock tests - no test warehouse');
    return;
  }

  // 4. Get Stock Aging Report
  console.log('\n4️⃣  Testing: Get Stock Aging Report');
  try {
    const response = await makeRequest('GET', `/api/stock-levels/aging/${testWarehouse.id}`);
    if (response.status === 200) {
      console.log(`✅ Stock aging report retrieved`);
      testResults.passed++;
      testResults.results.push({ test: 'Get Stock Aging Report', status: 'PASS' });
    } else {
      console.log('❌ Failed to get aging report');
      testResults.failed++;
      testResults.results.push({ test: 'Get Stock Aging Report', status: 'FAIL' });
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
    testResults.failed++;
    testResults.results.push({ test: 'Get Stock Aging Report', status: 'FAIL', error: error.message });
  }

  // 5-8: Other stock level tests will be covered after creating stock movements
  console.log('\n5️⃣  -8️⃣  Additional stock level tests (deferred until after stock movements)');
  console.log('⏭️  Will test after creating stock movements');
}

// Print summary
async function printSummary() {
  console.log('\n\n📋 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📊 Total: ${testResults.passed + testResults.failed}`);
  console.log(`📈 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);

  if (testResults.errors.length > 0) {
    console.log('\n❌ ERRORS:');
    testResults.errors.forEach((error, i) => {
      console.log(`   ${i + 1}. ${error}`);
    });
  }

  // Write results to file
  const fs = require('fs');
  fs.writeFileSync('test-results.json', JSON.stringify(testResults, null, 2));
  console.log('\n📄 Full results saved to test-results.json');
}

// Main test runner
async function runTests() {
  console.log('🚀 PHASE 3 API TESTING - Inventory & Warehouse Management');
  console.log('='.repeat(60));

  const healthOk = await testHealthCheck();
  if (!healthOk) {
    console.log('\n❌ Backend is not running. Please start the backend first.');
    console.log('   Run: cd backend && npm run dev');
    process.exit(1);
  }

  const authOk = await getAuthToken();
  if (!authOk) {
    console.log('\n❌ Authentication failed. Cannot proceed with tests.');
    process.exit(1);
  }

  await testWarehouseManagement();
  await testStockLevelManagement();
  // More tests will be added...

  await printSummary();
}

// Run tests
runTests().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
