// Test Main Dashboard API Endpoints
// Verifies that style_production_tracking data is accessible via API

const API_URL = 'http://localhost:5000/api';
const credentials = {
  email: 'admin@kashayafabs.com',
  password: 'Admin@123'
};

let authToken = '';

async function login() {
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });

    if (!response.ok) {
      throw new Error(`Login failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    authToken = data.token;
    console.log('✅ Login successful\n');
    return true;
  } catch (error) {
    console.error('❌ Login error:', error.message);
    return false;
  }
}

async function testDashboardSummary() {
  console.log('📊 Testing Dashboard Summary Endpoint...');
  console.log('===========================================\n');

  try {
    const response = await fetch(`${API_URL}/dashboard/summary`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Dashboard summary failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    console.log('Dashboard Summary Response:');
    console.log('---------------------------');
    console.log(JSON.stringify(data, null, 2));
    console.log('\n✅ Dashboard summary endpoint working!\n');

    // Count non-zero stages
    const populatedStages = Object.entries(data).filter(([key, value]) => value > 0);
    console.log(`📈 Populated Stages: ${populatedStages.length}/12`);
    populatedStages.forEach(([stage, count]) => {
      console.log(`   ${stage}: ${count} styles`);
    });

    return true;
  } catch (error) {
    console.error('❌ Dashboard summary error:', error.message);
    return false;
  }
}

async function testStylesByStage() {
  console.log('\n📋 Testing Styles by Stage Endpoint...');
  console.log('===========================================\n');

  const stagesToTest = ['IN_STITCHING', 'READY_TO_SHIP', 'PENDING_COSTING'];

  for (const stage of stagesToTest) {
    try {
      const response = await fetch(`${API_URL}/dashboard/styles-by-stage/${stage}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed: ${response.status} ${response.statusText}`);
      }

      const styles = await response.json();
      console.log(`✅ ${stage}: Found ${styles.length} styles`);

      if (styles.length > 0) {
        styles.forEach(style => {
          console.log(`   - ${style.styleCode}: ${style.piecesInStage} pieces (${style.sizeName})`);
        });
      }
      console.log('');
    } catch (error) {
      console.error(`❌ ${stage} error:`, error.message);
    }
  }
}

async function runTests() {
  console.log('🧪 Main Dashboard API Test Suite');
  console.log('===========================================\n');

  const loginSuccess = await login();
  if (!loginSuccess) {
    console.error('Cannot proceed without authentication');
    process.exit(1);
  }

  await testDashboardSummary();
  await testStylesByStage();

  console.log('\n===========================================');
  console.log('🎉 Main Dashboard Tests Complete!');
  console.log('===========================================\n');
  console.log('🎯 Next: Open http://localhost:5173/dashboard');
  console.log('   and verify all 12 production stage cards show data\n');
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
