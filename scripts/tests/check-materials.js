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
  const loginRes = await request('POST', '/api/auth/login', {
    email: 'admin@kashayafabs.com',
    password: 'Admin@123'
  });
  const token = loginRes.body.token;

  console.log('📦 Checking for existing materials...\n');
  const materialsRes = await request('GET', '/api/materials', null, token);

  if (materialsRes.body.data && materialsRes.body.data.length > 0) {
    console.log(`✅ Found ${materialsRes.body.data.length} materials:`);
    materialsRes.body.data.slice(0, 5).forEach((m, i) => {
      console.log(`   ${i+1}. [${m.id}] ${m.materialCode} - ${m.materialName}`);
    });
  } else {
    console.log('❌ No materials found in database');
    console.log('   You need to create materials first before testing inventory features');
  }
}

main().catch(err => console.error('Error:', err));
