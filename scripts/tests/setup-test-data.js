// Setup test data for Phase 3 API testing
const http = require('http');

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
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

async function main() {
  console.log('🔐 Logging in...');
  const loginRes = await request('POST', '/api/auth/login', {
    email: 'admin@kashayafabs.com',
    password: 'Admin@123'
  });
  const token = loginRes.body.token;
  console.log('✅ Logged in');

  console.log('\n📦 Creating test material...');
  const materialRes = await request('POST', '/api/materials', {
    materialCode: 'MAT-TEST-FABRIC-001',
    materialName: 'Test Cotton Fabric',
    materialType: 'FABRIC',
    unit: 'METER',
    hsn: '520100',
    description: 'Test material for API testing'
  }, token);

  if (materialRes.status === 201) {
    console.log('✅ Material created:', materialRes.body.data.id);
    console.log(`   Code: ${materialRes.body.data.materialCode}`);
    console.log(`   Name: ${materialRes.body.data.materialName}`);
  } else {
    console.log('ℹ️  Material response:', materialRes.status, materialRes.body);
  }

  console.log('\n✅ Test data setup complete!');
  console.log('\nYou can now run: node run-api-tests.js');
}

main().catch(err => console.error('Error:', err));
