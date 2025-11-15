const API_URL = 'http://localhost:5000/api';
const credentials = { email: 'admin@kashayafabs.com', password: 'Admin@123' };

(async () => {
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials)
  });
  const { token } = await loginRes.json();

  const stylesRes = await fetch(`${API_URL}/styles`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const styles = await stylesRes.json();
  const testStyle = styles.data.find(s => s.styleCode === 'TEST-001');

  if (testStyle) {
    console.log('✅ Found TEST-001, ID:', testStyle.id);

    const detailRes = await fetch(`${API_URL}/styles/${testStyle.id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const response = await detailRes.json();

    console.log('\n📊 Raw API Response:');
    console.log(JSON.stringify(response, null, 2));
  } else {
    console.log('❌ TEST-001 not found');
  }
})();
