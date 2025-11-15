const http = require('http');

function request(method, path, body, token) {
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

    console.log(`\n🔍 Request: ${method} ${path}`);
    console.log('📋 Headers:', JSON.stringify(options.headers, null, 2));
    if (body) console.log('📦 Body:', JSON.stringify(body, null, 2));

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`📡 Response Status: ${res.statusCode}`);
        try {
          const parsed = JSON.parse(data);
          console.log('📥 Response:', JSON.stringify(parsed, null, 2));
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          console.log('📥 Response (raw):', data);
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (err) => {
      console.log('❌ Error:', err.message);
      reject(err);
    });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('🔐 Step 1: Login');
  const loginRes = await request('POST', '/api/auth/login', {
    email: 'admin@kashayafabs.com',
    password: 'Admin@123'
  });

  if (!loginRes.body.token) {
    console.log('❌ No token received');
    return;
  }

  const token = loginRes.body.token;
  console.log(`\n✅ Token acquired: ${token.substring(0, 20)}...`);

  console.log('\n\n🏢 Step 2: Generate Warehouse Code');
  await request('GET', '/api/warehouses/generate-code/RAW_MATERIAL', null, token);

  console.log('\n\n🏢 Step 3: Create Warehouse');
  await request('POST', '/api/warehouses', {
    warehouseCode: 'WH-DEBUG-001',
    warehouseName: 'Debug Test Warehouse',
    warehouseType: 'RAW_MATERIAL',
    city: 'Mumbai',
    isActive: true
  }, token);
}

main().catch(err => console.error('💥', err));
