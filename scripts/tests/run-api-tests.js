// Comprehensive API Testing for Phase 3
const http = require('http');
const fs = require('fs');

const BASE_URL = 'localhost';
const PORT = 5000;

// Test state
let authToken = '';
let testData = {
  warehouse: null,
  material: null,
  stockLevel: null,
  movement: null,
  count: null
};

let results = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: []
};

// HTTP request helper
function request(method, path, body = null, useAuth = true) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (useAuth && authToken) {
      options.headers['Authorization'] = `Bearer ${authToken}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            body: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Test runner
async function runTest(name, testFn) {
  results.total++;
  process.stdout.write(`\n${results.total}. ${name}... `);
  try {
    await testFn();
    results.passed++;
    results.tests.push({ name, status: 'PASS' });
    console.log('✅');
  } catch (error) {
    results.failed++;
    results.tests.push({ name, status: 'FAIL', error: error.message });
    console.log(`❌ ${error.message}`);
  }
}

// Tests
async function test1_Health() {
  const res = await request('GET', '/health', null, false);
  if (res.status !== 200) throw new Error(`Status ${res.status}`);
}

async function test2_Login() {
  const res = await request('POST', '/api/auth/login', {
    email: 'admin@kashayafabs.com',
    password: 'Admin@123'
  }, false);
  if (res.status !== 200 || !res.body.token) throw new Error('Login failed');
  authToken = res.body.token;
}

async function test3_GenerateWarehouseCode() {
  const res = await request('GET', '/api/warehouses/generate-code/RAW_MATERIAL');
  if (res.status !== 200 || !res.body.code) throw new Error('Code generation failed');
}

async function test4_CreateWarehouse() {
  const res = await request('POST', '/api/warehouses', {
    warehouseCode: 'WH-TEST-' + Date.now(),
    warehouseName: 'API Test Warehouse',
    warehouseType: 'RAW_MATERIAL',
    city: 'Mumbai',
    isActive: true
  });
  if (res.status !== 201 || !res.body.data) throw new Error('Warehouse creation failed');
  testData.warehouse = res.body.data;
}

async function test5_GetAllWarehouses() {
  const res = await request('GET', '/api/warehouses');
  if (res.status !== 200) throw new Error(`Status ${res.status}`);
}

async function test6_GetWarehouseById() {
  if (!testData.warehouse) throw new Error('No test warehouse');
  const res = await request('GET', `/api/warehouses/${testData.warehouse.id}`);
  if (res.status !== 200) throw new Error(`Status ${res.status}`);
}

async function test7_GetWarehouseByCode() {
  if (!testData.warehouse) throw new Error('No test warehouse');
  const res = await request('GET', `/api/warehouses/code/${testData.warehouse.warehouseCode}`);
  if (res.status !== 200) throw new Error(`Status ${res.status}`);
}

async function test8_GetWarehousesByType() {
  const res = await request('GET', '/api/warehouses/by-type/RAW_MATERIAL');
  if (res.status !== 200) throw new Error(`Status ${res.status}`);
}

async function test9_GetWarehouseStockSummary() {
  if (!testData.warehouse) throw new Error('No test warehouse');
  const res = await request('GET', `/api/warehouses/${testData.warehouse.id}/stock-summary`);
  if (res.status !== 200) throw new Error(`Status ${res.status}`);
}

async function test10_UpdateWarehouse() {
  if (!testData.warehouse) throw new Error('No test warehouse');
  const res = await request('PUT', `/api/warehouses/${testData.warehouse.id}`, {
    warehouseName: 'Updated Test Warehouse'
  });
  if (res.status !== 200) throw new Error(`Status ${res.status}`);
}

async function test11_GetAllStockLevels() {
  const res = await request('GET', '/api/stock-levels');
  if (res.status !== 200) throw new Error(`Status ${res.status}`);
}

async function test12_GetMaterialsBelowReorder() {
  const res = await request('GET', '/api/stock-levels/below-reorder');
  if (res.status !== 200) throw new Error(`Status ${res.status}`);
}

async function test13_GetStockValuation() {
  const res = await request('GET', '/api/stock-levels/valuation');
  if (res.status !== 200) throw new Error(`Status ${res.status}`);
}

async function test14_GetStockAging() {
  if (!testData.warehouse) throw new Error('No test warehouse');
  const res = await request('GET', `/api/stock-levels/aging/${testData.warehouse.id}`);
  if (res.status !== 200) throw new Error(`Status ${res.status}`);
}

async function test15_GetAllMovements() {
  const res = await request('GET', '/api/stock-movements');
  if (res.status !== 200) throw new Error(`Status ${res.status}`);
}

async function test16_GetAllStockCounts() {
  const res = await request('GET', '/api/stock-counts');
  if (res.status !== 200) throw new Error(`Status ${res.status}`);
}

// Get a real material from database for testing
async function test17_GetMaterials() {
  const res = await request('GET', '/api/materials?limit=1');
  if (res.status !== 200 || !res.body.data || res.body.data.length === 0) {
    throw new Error('No materials found in database');
  }
  testData.material = res.body.data[0];
}

async function test18_CreateStockIn() {
  if (!testData.warehouse || !testData.material) throw new Error('Missing warehouse or material');
  const res = await request('POST', '/api/stock-movements/stock-in', {
    materialId: testData.material.id,
    warehouseId: testData.warehouse.id,
    quantity: 1000,
    unit: 'METER',
    rate: 100.00,
    referenceType: 'GRN',
    referenceNumber: 'TEST-GRN-001'
  });
  if (res.status !== 201) throw new Error(`Status ${res.status}: ${JSON.stringify(res.body)}`);
  testData.movement = res.body.data;
}

async function test19_GetStockByWarehouse() {
  if (!testData.warehouse) throw new Error('No test warehouse');
  const res = await request('GET', `/api/stock-levels/warehouse/${testData.warehouse.id}`);
  if (res.status !== 200) throw new Error(`Status ${res.status}`);
  if (!res.body.data || res.body.data.length === 0) throw new Error('No stock found after stock-in');
  testData.stockLevel = res.body.data[0];
  // Verify quantity
  if (testData.stockLevel.quantity != 1000) {
    throw new Error(`Expected quantity 1000, got ${testData.stockLevel.quantity}`);
  }
}

async function test20_VerifyWeightedAverage() {
  if (!testData.stockLevel) throw new Error('No stock level');
  const expectedRate = 100.00;
  const actualRate = parseFloat(testData.stockLevel.valuationRate);
  if (Math.abs(actualRate - expectedRate) > 0.01) {
    throw new Error(`Expected rate ${expectedRate}, got ${actualRate}`);
  }
}

async function test21_CreateStockOut() {
  if (!testData.warehouse || !testData.material) throw new Error('Missing warehouse or material');
  const res = await request('POST', '/api/stock-movements/stock-out', {
    materialId: testData.material.id,
    warehouseId: testData.warehouse.id,
    quantity: 300,
    unit: 'METER',
    referenceType: 'REQUISITION',
    referenceNumber: 'TEST-REQ-001'
  });
  if (res.status !== 201) throw new Error(`Status ${res.status}`);
}

async function test22_VerifyStockAfterOut() {
  if (!testData.warehouse) throw new Error('No test warehouse');
  const res = await request('GET', `/api/stock-levels/warehouse/${testData.warehouse.id}`);
  if (res.status !== 200) throw new Error(`Status ${res.status}`);
  const stock = res.body.data.find(s => s.materialId === testData.material.id);
  if (!stock) throw new Error('Stock not found');
  if (stock.quantity != 700) throw new Error(`Expected 700, got ${stock.quantity}`);
}

async function test23_CreateStockInWithDifferentRate() {
  if (!testData.warehouse || !testData.material) throw new Error('Missing warehouse or material');
  const res = await request('POST', '/api/stock-movements/stock-in', {
    materialId: testData.material.id,
    warehouseId: testData.warehouse.id,
    quantity: 500,
    unit: 'METER',
    rate: 120.00,
    referenceType: 'GRN',
    referenceNumber: 'TEST-GRN-002'
  });
  if (res.status !== 201) throw new Error(`Status ${res.status}`);
}

async function test24_VerifyWeightedAverageAfterSecondReceipt() {
  if (!testData.warehouse) throw new Error('No test warehouse');
  const res = await request('GET', `/api/stock-levels/warehouse/${testData.warehouse.id}`);
  if (res.status !== 200) throw new Error(`Status ${res.status}`);
  const stock = res.body.data.find(s => s.materialId === testData.material.id);
  if (!stock) throw new Error('Stock not found');
  // Expected: (700*100 + 500*120) / 1200 = 108.33
  const expectedRate = 108.33;
  const actualRate = parseFloat(stock.valuationRate);
  if (Math.abs(actualRate - expectedRate) > 0.1) {
    throw new Error(`WAC failed: Expected ~${expectedRate}, got ${actualRate}`);
  }
}

async function test25_CreateStockCount() {
  if (!testData.warehouse) throw new Error('No test warehouse');
  const res = await request('POST', '/api/stock-counts', {
    warehouseId: testData.warehouse.id,
    countType: 'FULL',
    remarks: 'API Test Count'
  });
  if (res.status !== 201) throw new Error(`Status ${res.status}`);
  testData.count = res.body.data;
}

async function test26_StartCounting() {
  if (!testData.count) throw new Error('No test count');
  const res = await request('POST', `/api/stock-counts/${testData.count.id}/start`);
  if (res.status !== 200) throw new Error(`Status ${res.status}`);
}

async function test27_GetStockCountById() {
  if (!testData.count) throw new Error('No test count');
  const res = await request('GET', `/api/stock-counts/${testData.count.id}`);
  if (res.status !== 200) throw new Error(`Status ${res.status}`);
  if (!res.body.data.items || res.body.data.items.length === 0) {
    throw new Error('No count items found');
  }
  testData.countItem = res.body.data.items[0];
}

async function test28_UpdateCountItem() {
  if (!testData.count || !testData.countItem) throw new Error('No count or count item');
  const res = await request('PUT',
    `/api/stock-counts/${testData.count.id}/items/${testData.countItem.id}`,
    { physicalQuantity: 1195 }
  );
  if (res.status !== 200) throw new Error(`Status ${res.status}`);
}

async function test29_VerifyCount() {
  if (!testData.count) throw new Error('No test count');
  const res = await request('POST', `/api/stock-counts/${testData.count.id}/verify`);
  if (res.status !== 200) throw new Error(`Status ${res.status}`);
}

async function test30_GetVarianceReport() {
  if (!testData.count) throw new Error('No test count');
  const res = await request('GET', `/api/stock-counts/${testData.count.id}/variance`);
  if (res.status !== 200) throw new Error(`Status ${res.status}`);
}

async function test31_ApproveCount() {
  if (!testData.count) throw new Error('No test count');
  const res = await request('POST', `/api/stock-counts/${testData.count.id}/approve`);
  if (res.status !== 200) throw new Error(`Status ${res.status}: ${JSON.stringify(res.body)}`);
}

async function test32_VerifyStockAfterAdjustment() {
  if (!testData.warehouse) throw new Error('No test warehouse');
  const res = await request('GET', `/api/stock-levels/warehouse/${testData.warehouse.id}`);
  if (res.status !== 200) throw new Error(`Status ${res.status}`);
  const stock = res.body.data.find(s => s.materialId === testData.material.id);
  if (!stock) throw new Error('Stock not found');
  // Should be 1195 after adjustment
  if (stock.quantity != 1195) throw new Error(`Expected 1195, got ${stock.quantity}`);
}

async function test33_GetMovementHistory() {
  if (!testData.material) throw new Error('No test material');
  const res = await request('GET', `/api/stock-movements/material/${testData.material.id}/history`);
  if (res.status !== 200) throw new Error(`Status ${res.status}`);
}

async function test34_GetStockLedger() {
  if (!testData.material || !testData.warehouse) throw new Error('Missing material or warehouse');
  const res = await request('GET',
    `/api/stock-movements/ledger/${testData.material.id}/${testData.warehouse.id}`
  );
  if (res.status !== 200) throw new Error(`Status ${res.status}`);
}

async function test35_TestInsufficientStock() {
  if (!testData.warehouse || !testData.material) throw new Error('Missing warehouse or material');
  const res = await request('POST', '/api/stock-movements/stock-out', {
    materialId: testData.material.id,
    warehouseId: testData.warehouse.id,
    quantity: 10000,  // More than available
    unit: 'METER',
    referenceType: 'REQUISITION',
    referenceNumber: 'TEST-FAIL'
  });
  // Should fail with 500 or 400
  if (res.status === 201) throw new Error('Should have failed with insufficient stock');
}

// Main runner
async function main() {
  console.log('\n🚀 PHASE 3 COMPREHENSIVE API TESTING');
  console.log('=' .repeat(70));
  console.log('\n📦 WAREHOUSE MANAGEMENT (10 tests)');

  await runTest('Health Check', test1_Health);
  await runTest('User Login', test2_Login);
  await runTest('Generate Warehouse Code', test3_GenerateWarehouseCode);
  await runTest('Create Warehouse', test4_CreateWarehouse);
  await runTest('Get All Warehouses', test5_GetAllWarehouses);
  await runTest('Get Warehouse by ID', test6_GetWarehouseById);
  await runTest('Get Warehouse by Code', test7_GetWarehouseByCode);
  await runTest('Get Warehouses by Type', test8_GetWarehousesByType);
  await runTest('Get Warehouse Stock Summary', test9_GetWarehouseStockSummary);
  await runTest('Update Warehouse', test10_UpdateWarehouse);

  console.log('\n\n📊 STOCK LEVEL MANAGEMENT (4 tests)');
  await runTest('Get All Stock Levels', test11_GetAllStockLevels);
  await runTest('Get Materials Below Reorder', test12_GetMaterialsBelowReorder);
  await runTest('Get Stock Valuation', test13_GetStockValuation);
  await runTest('Get Stock Aging Report', test14_GetStockAging);

  console.log('\n\n📦 STOCK MOVEMENTS (11 tests)');
  await runTest('Get All Movements', test15_GetAllMovements);
  await runTest('Get Materials for Testing', test17_GetMaterials);
  await runTest('Create Stock IN', test18_CreateStockIn);
  await runTest('Get Stock by Warehouse', test19_GetStockByWarehouse);
  await runTest('Verify Initial Weighted Average', test20_VerifyWeightedAverage);
  await runTest('Create Stock OUT', test21_CreateStockOut);
  await runTest('Verify Stock After OUT', test22_VerifyStockAfterOut);
  await runTest('Create Stock IN with Different Rate', test23_CreateStockInWithDifferentRate);
  await runTest('Verify Weighted Average Calculation', test24_VerifyWeightedAverageAfterSecondReceipt);
  await runTest('Get Movement History', test33_GetMovementHistory);
  await runTest('Get Stock Ledger', test34_GetStockLedger);

  console.log('\n\n🔢 STOCK COUNT WORKFLOW (9 tests)');
  await runTest('Get All Stock Counts', test16_GetAllStockCounts);
  await runTest('Create Stock Count', test25_CreateStockCount);
  await runTest('Start Counting', test26_StartCounting);
  await runTest('Get Stock Count by ID', test27_GetStockCountById);
  await runTest('Update Count Item', test28_UpdateCountItem);
  await runTest('Verify Count', test29_VerifyCount);
  await runTest('Get Variance Report', test30_GetVarianceReport);
  await runTest('Approve Count (Auto-adjust)', test31_ApproveCount);
  await runTest('Verify Stock After Adjustment', test32_VerifyStockAfterAdjustment);

  console.log('\n\n❌ ERROR SCENARIOS (1 test)');
  await runTest('Test Insufficient Stock Error', test35_TestInsufficientStock);

  // Summary
  console.log('\n\n' + '='.repeat(70));
  console.log('📋 TEST SUMMARY');
  console.log('='.repeat(70));
  console.log(`✅ Passed: ${results.passed}/${results.total}`);
  console.log(`❌ Failed: ${results.failed}/${results.total}`);
  console.log(`📈 Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);

  if (results.failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    results.tests.filter(t => t.status === 'FAIL').forEach((t, i) => {
      console.log(`   ${i+1}. ${t.name}: ${t.error}`);
    });
  }

  // Save results
  fs.writeFileSync('phase3-test-results.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      total: results.total,
      passed: results.passed,
      failed: results.failed,
      successRate: ((results.passed / results.total) * 100).toFixed(1) + '%'
    },
    tests: results.tests,
    testData: {
      warehouseId: testData.warehouse?.id,
      materialId: testData.material?.id,
      stockCountId: testData.count?.id
    }
  }, null, 2));

  console.log('\n📄 Full results saved to phase3-test-results.json\n');

  // Exit code
  process.exit(results.failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('\n💥 Fatal Error:', err.message);
  process.exit(1);
});
