#!/usr/bin/env node

/**
 * Simple API test script for Thread Material endpoints
 */

const https = require('http');

const BASE_URL = 'http://localhost:5000';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI0ZmRlZmJkOC1iNGM2LTQ5NGItOTJhNy00NDIxYWNiZjMzMzMiLCJlbWFpbCI6ImFkbWluQGthc2hheWFmYWJzLmNvbSIsInJvbGUiOiJBRE1JTiIsImlhdCI6MTc3MDM2MDU3NCwiZXhwIjoxNzcwOTY1Mzc0fQ.2z2tSskEn7gUT9jjWmzTjBEj1LVomr6DD21MmrBGnns';

async function testEndpoint(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      method,
      hostname: 'localhost',
      port: 5000,
      path,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function main() {
  console.log('🧵 Testing Thread Material API Endpoints\n');
  console.log('=' .repeat(60));

  // Test 1: Thread Conversion
  console.log('\n📦 Test 1: Convert 2 boxes to units and meters');
  console.log('Endpoint: POST /api/materials/thread/convert');
  const test1 = await testEndpoint('POST', '/api/materials/thread/convert', {
    ply: 'THREE_PLY',
    packagingType: 'SPOOL',
    inputType: 'BOXES',
    value: 2
  });
  console.log(`Status: ${test1.status}`);
  console.log('Response:', JSON.stringify(test1.data, null, 2));

  // Test 2: Packaging Specs
  console.log('\n\n📊 Test 2: Get packaging specifications');
  console.log('Endpoint: GET /api/materials/thread/packaging-specs');
  const test2 = await testEndpoint('GET', '/api/materials/thread/packaging-specs');
  console.log(`Status: ${test2.status}`);
  console.log('Response:', JSON.stringify(test2.data, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log('✅ Tests completed');
}

main().catch(console.error);
