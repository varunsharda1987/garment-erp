// Create test style via API (bypassing Prisma issues)
const API_URL = 'http://localhost:5000/api';
const credentials = {
  email: 'admin@kashayafabs.com',
  password: 'Admin@123'
};

async function main() {
  try {
    // Login
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    const { token } = await loginRes.json();
    console.log('✅ Logged in\n');

    // Create simple test style
    const styleData = {
      styleCode: 'TEST-001',
      styleName: 'Test Garment - Simple',
      buyerName: 'Fashion Boutique',
      brandName: 'Test Brand',
      category: 'CASUAL',
      gender: 'UNISEX',
      season: 'ALL_SEASON',
      description: 'Simple test garment for testing order creation',
      colorOptions: [
        { colorName: 'Red', colorCode: '#FF0000' },
        { colorName: 'Blue', colorCode: '#0000FF' }
      ],
      sizeOptions: [
        { sizeName: 'Small', sizeCode: 'S' },
        { sizeName: 'Medium', sizeCode: 'M' },
        { sizeName: 'Large', sizeCode: 'L' }
      ]
    };

    console.log('📊 Creating test style...');
    const styleRes = await fetch(`${API_URL}/styles`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(styleData)
    });

    if (styleRes.ok) {
      const style = await styleRes.json();
      console.log(`✅ Created style: ${style.styleCode} - ${style.styleName}`);
      console.log(`   ID: ${style.id}`);
      console.log(`   Colors: ${style.colorOptions?.length || 0}`);
      console.log(`   Sizes: ${style.sizeOptions?.length || 0}`);
    } else {
      const error = await styleRes.text();
      console.error('❌ Failed to create style:', error);
    }

    console.log('\n✅ Setup complete!');
    console.log('🎯 Now try creating an order with TEST-001 style\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main();
