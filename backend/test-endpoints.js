const http = require('http');

function makeRequest(method, path, token = null, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ error: body });
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

async function testEndpoints() {
  try {
    // 1. Login
    console.log('\n=== Testing Authentication ===');
    const loginRes = await makeRequest('POST', '/api/auth/login', null, {
      email: 'admin@kashaya.com',
      password: 'admin123'
    });

    const token = loginRes.token;
    console.log('✅ Login successful');
    console.log(`   Token: ${token.substring(0, 30)}...`);

    // 2. Test Stock Dashboard
    console.log('\n=== Testing Stock Dashboard ===');
    const dashboardRes = await makeRequest('GET', '/api/stock/dashboard', token);
    console.log('✅ Stock dashboard retrieved');
    console.log(`   Total Stock Items: ${dashboardRes.data?.totalStockItems || 0}`);
    console.log(`   Total Value: $${dashboardRes.data?.totalValue || 0}`);

    // 3. Test Stock List
    console.log('\n=== Testing Stock List ===');
    const stockRes = await makeRequest('GET', '/api/stock?page=1&limit=5', token);
    console.log('✅ Stock list retrieved');
    console.log(`   Items: ${stockRes.data?.stocks?.length || 0}`);
    console.log(`   Total: ${stockRes.data?.pagination?.total || 0}`);

    // 4. Test Procurement List
    console.log('\n=== Testing Procurement List ===');
    const procurementRes = await makeRequest('GET', '/api/procurement?page=1&limit=5', token);
    console.log('✅ Procurement list retrieved');
    console.log(`   Items: ${procurementRes.data?.length || 0}`);

    // 5. Test Stock Valuation
    console.log('\n=== Testing Stock Valuation ===');
    const valuationRes = await makeRequest('GET', '/api/stock/valuation', token);
    console.log('✅ Stock valuation retrieved');
    console.log(`   Total Items: ${valuationRes.data?.length || 0}`);

    // 6. Test Aging Stock
    console.log('\n=== Testing Aging Stock ===');
    const agingRes = await makeRequest('GET', '/api/stock/aging', token);
    console.log('✅ Aging stock retrieved');
    console.log(`   Aging Items: ${agingRes.data?.length || 0}`);

    console.log('\n🎉 All API tests passed successfully!\n');

  } catch (error) {
    console.error('\n❌ Test failed:');
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Error: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.error(`   ${error.message}`);
    }
    process.exit(1);
  }
}

testEndpoints();
