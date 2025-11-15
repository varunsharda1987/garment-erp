// Complete order creation via script (bypassing UI issues)
const API_URL = 'http://localhost:5000/api';
const credentials = {
  email: 'admin@kashayafabs.com',
  password: 'Admin@123'
};

async function createOrderViaAPI() {
  try {
    // 1. Login
    console.log('🔐 Logging in...');
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    const { token } = await loginRes.json();
    console.log('✅ Logged in\n');

    // 2. Get customer
    console.log('👤 Finding customer...');
    const customersRes = await fetch(`${API_URL}/customers`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const customers = await customersRes.json();
    const customer = customers.data[0];
    console.log(`✅ Using customer: ${customer.code} - ${customer.name}\n`);

    // 3. Get style with colors and sizes
    console.log('👔 Finding TEST-001 style...');
    const stylesRes = await fetch(`${API_URL}/styles`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const styles = await stylesRes.json();
    const testStyle = styles.data.find(s => s.styleCode === 'TEST-001');

    const styleDetailRes = await fetch(`${API_URL}/styles/${testStyle.id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const styleDetailResponse = await styleDetailRes.json();
    const styleDetail = styleDetailResponse.data;

    console.log(`✅ Style: ${styleDetail.styleCode} - ${styleDetail.styleName}`);
    console.log(`   Colors: ${styleDetail.color_options?.length || 0}`);
    console.log(`   Sizes: ${styleDetail.size_options?.length || 0}\n`);

    // 4. Create order with quantity breakup
    console.log('📝 Creating order...');

    const breakup = [];
    if (styleDetail.color_options && styleDetail.size_options) {
      // Create breakup: Red-Small: 10, Red-Medium: 15, Red-Large: 20
      //                 Blue-Small: 5, Blue-Medium: 10, Blue-Large: 15
      const quantities = {
        'Red-Small': 10,
        'Red-Medium': 15,
        'Red-Large': 20,
        'Blue-Small': 5,
        'Blue-Medium': 10,
        'Blue-Large': 15
      };

      styleDetail.color_options.forEach(color => {
        styleDetail.size_options.forEach(size => {
          const key = `${color.colorName}-${size.sizeName}`;
          const qty = quantities[key] || 0;
          if (qty > 0) {
            breakup.push({
              colorId: color.id,
              sizeId: size.id,
              quantity: qty
            });
          }
        });
      });
    }

    const totalPieces = breakup.reduce((sum, b) => sum + b.quantity, 0);
    console.log(`   Total pieces: ${totalPieces}`);

    const orderData = {
      customerId: customer.id,
      expectedDeliveryDate: '2025-12-31',
      priority: 'MEDIUM',
      paymentTerms: '30 days net',
      shippingAddress: customer.billingAddress,
      remarks: 'Test order created via script',
      items: [
        {
          styleId: testStyle.id,
          itemDescription: 'Test order for TEST-001',
          unitPrice: '500.00',
          deliveryDate: '2025-12-31',
          remarks: 'Sample quantities',
          breakup: breakup
        }
      ]
    };

    const orderRes = await fetch(`${API_URL}/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderData)
    });

    if (orderRes.ok) {
      const order = await orderRes.json();
      console.log(`\n✅ Order created successfully!`);
      console.log(`   Order Number: ${order.orderNumber}`);
      console.log(`   Total Amount: ₹${(totalPieces * 500).toFixed(2)}`);
      console.log(`   Total Pieces: ${totalPieces}`);
      console.log(`\n🎯 Next: Check Orders page at http://localhost:5173/orders`);
    } else {
      const error = await orderRes.text();
      console.error('❌ Failed to create order:', error);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createOrderViaAPI();
