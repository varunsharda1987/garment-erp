/**
 * Test live API transformation with authentication
 * This script logs in and tests actual endpoints with debug logging enabled
 */

const API_BASE = 'http://localhost:5000';

// Test credentials (from seed files)
const TEST_CREDENTIALS = {
  email: 'admin@kashaya.com',
  password: 'Admin@123'
};

async function login() {
  console.log('🔐 Logging in...');

  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(TEST_CREDENTIALS),
  });

  if (!response.ok) {
    console.log('❌ Login failed, trying alternative credentials...');

    // Try alternative email
    const altResponse = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@kashayafabs.com',
        password: 'Admin@123'
      }),
    });

    if (!altResponse.ok) {
      throw new Error('Login failed with both credential sets');
    }

    const altData = await altResponse.json();
    console.log('✅ Logged in successfully (alternative credentials)');
    return altData.token;
  }

  const data = await response.json();
  console.log('✅ Logged in successfully');
  return data.token;
}

async function testEndpoint(endpoint, token, description) {
  console.log('\n' + '='.repeat(60));
  console.log(`📋 Testing: ${description}`);
  console.log(`🔗 Endpoint: GET ${endpoint}`);
  console.log('='.repeat(60));

  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    console.log(`❌ Failed: ${response.status} ${response.statusText}`);
    const errorData = await response.json();
    console.log('Error:', JSON.stringify(errorData, null, 2));
    return;
  }

  const data = await response.json();
  console.log('✅ Success!');

  // Analyze the response structure
  console.log('\n📊 Response Analysis:');
  console.log('  - Top-level keys:', Object.keys(data).join(', '));

  if (data.data) {
    const items = Array.isArray(data.data) ? data.data : [data.data];
    const firstItem = items[0];

    if (firstItem) {
      console.log('  - Item keys:', Object.keys(firstItem).join(', '));

      // Check for successful transformations
      const checks = {
        'category': '✅ Has "category" (from materialCategories)',
        'components': '✅ Has "components" (from styleComponents)',
        'items': '✅ Has "items" (from orderItems/etc)',
        'createdBy': '✅ Has "createdBy" (from verbose Prisma relation)',
        'approvedBy': '✅ Has "approvedBy" (from verbose Prisma relation)',
        'colors': '✅ Has "colors" (from colorOptions)',
        'sizes': '✅ Has "sizes" (from sizeOptions)',
        'processes': '✅ Has "processes" (from styleProcesses)',
        'costing': '✅ Has "costing" (from styleCosting)',
      };

      console.log('\n🔍 Transformation Checks:');
      let foundTransformations = false;
      for (const [key, message] of Object.entries(checks)) {
        if (firstItem.hasOwnProperty(key)) {
          console.log('  ', message);
          foundTransformations = true;
        }
      }

      if (!foundTransformations) {
        console.log('   ℹ️  No special transformations detected (or data is simple)');
      }

      // Check for bad (non-transformed) keys
      const badKeys = [
        'material_categories', 'style_components', 'order_items',
        'users_orders_createdByIdTousers', 'color_options', 'size_options'
      ];

      const foundBadKeys = badKeys.filter(key => firstItem.hasOwnProperty(key));
      if (foundBadKeys.length > 0) {
        console.log('\n⚠️  WARNING: Found non-transformed keys:');
        foundBadKeys.forEach(key => console.log('   ❌', key));
      }

      // Show sample data
      console.log('\n📄 Sample Data (first 300 chars):');
      console.log(JSON.stringify(firstItem, null, 2).substring(0, 300) + '...');
    } else {
      console.log('   ℹ️  No items in response');
    }
  }

  if (data.pagination) {
    console.log('\n📄 Pagination:', JSON.stringify(data.pagination));
  }
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 LIVE API TRANSFORMATION TEST');
  console.log('='.repeat(60));
  console.log('⚙️  DEBUG_TRANSFORM is enabled in .env');
  console.log('📝 Check the backend console for transformation logs!');
  console.log('='.repeat(60));

  try {
    // Login
    const token = await login();

    // Test various endpoints
    await testEndpoint('/api/materials?limit=1', token, 'Materials List');
    await testEndpoint('/api/styles?limit=1', token, 'Styles List');
    await testEndpoint('/api/orders?limit=1', token, 'Orders List');
    await testEndpoint('/api/suppliers?limit=1', token, 'Suppliers List');
    await testEndpoint('/api/customers?limit=1', token, 'Customers List');

    console.log('\n' + '='.repeat(60));
    console.log('✅ TEST COMPLETE!');
    console.log('='.repeat(60));
    console.log('\n💡 Tips:');
    console.log('  - Check the backend console for detailed transformation logs');
    console.log('  - Look for "=== TRANSFORMATION DEBUG START ===" messages');
    console.log('  - Look for "[Mapping] materialCategories → category" messages');
    console.log('  - All relation names should be simplified (category, not materialCategories)');
    console.log('\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
  }
}

main();
