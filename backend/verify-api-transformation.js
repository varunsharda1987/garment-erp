/**
 * Verification script to test transformation on actual API endpoints
 * Run after starting the backend server
 */

const fetch = require('node-fetch');

const API_BASE = 'http://localhost:5000/api';

async function testEndpoint(endpoint, description) {
  console.log(`\n=== Testing: ${description} ===`);
  console.log(`Endpoint: GET ${endpoint}`);

  try {
    const response = await fetch(`${API_BASE}${endpoint}`);
    const data = await response.json();

    if (!response.ok) {
      console.log(`❌ Failed: ${response.status} ${response.statusText}`);
      console.log('Response:', JSON.stringify(data, null, 2).substring(0, 500));
      return;
    }

    console.log('✅ Success!');
    console.log('Response keys:', Object.keys(data).join(', '));

    // Check specific transformations
    if (data.data) {
      const firstItem = Array.isArray(data.data) ? data.data[0] : data.data;
      if (firstItem) {
        console.log('First item keys:', Object.keys(firstItem).join(', '));

        // Check for common relation transformations
        if (firstItem.category) {
          console.log('✅ Has "category" (transformed from materialCategories)');
        }
        if (firstItem.components) {
          console.log('✅ Has "components" (transformed from styleComponents)');
        }
        if (firstItem.items) {
          console.log('✅ Has "items" (transformed from orderItems/etc)');
        }
        if (firstItem.createdBy) {
          console.log('✅ Has "createdBy" (transformed from verbose Prisma relation)');
        }

        // Show a sample of the data
        console.log('\nSample data:', JSON.stringify(firstItem, null, 2).substring(0, 300), '...');
      }
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

async function runTests() {
  console.log('===========================================');
  console.log('API Transformation Verification');
  console.log('===========================================');
  console.log('Note: Backend server must be running!');
  console.log('Start with: npm run dev (in backend folder)');
  console.log('===========================================');

  // Test various endpoints
  await testEndpoint('/materials?limit=1', 'Materials List');
  await testEndpoint('/styles?limit=1', 'Styles List');
  await testEndpoint('/orders?limit=1', 'Orders List');
  await testEndpoint('/suppliers?limit=1', 'Suppliers List');

  console.log('\n===========================================');
  console.log('Verification Complete!');
  console.log('===========================================');
  console.log('\nCheck the backend console for detailed transformation logs');
  console.log('(Look for "=== TRANSFORMATION DEBUG START ===" messages)');
}

runTests().catch(console.error);
