// Quick test to check if styles are available
const API_URL = 'http://localhost:5000/api';
const credentials = {
  email: 'admin@kashayafabs.com',
  password: 'Admin@123'
};

async function test() {
  try {
    // Login
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    const { token } = await loginRes.json();
    console.log('✅ Logged in\n');

    // Get styles
    const stylesRes = await fetch(`${API_URL}/styles?limit=10`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const styles = await stylesRes.json();

    console.log(`📊 Styles found: ${styles.data?.length || 0}\n`);
    if (styles.data && styles.data.length > 0) {
      styles.data.forEach(s => {
        console.log(`  ✅ ${s.styleCode}: ${s.styleName} (ID: ${s.id})`);
      });
    } else {
      console.log('❌ No styles found!');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

test();
