const API_URL = 'http://localhost:5000/api';
const credentials = { email: 'admin@kashayafabs.com', password: 'Admin@123' };

(async () => {
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials)
  });
  const { token } = await loginRes.json();

  const ordersRes = await fetch(`${API_URL}/orders`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const ordersData = await ordersRes.json();

  console.log('📦 Orders in database:', ordersData.data.length);
  console.log('');

  if (ordersData.data.length > 0) {
    const latestOrder = ordersData.data[0];
    console.log('Latest Order:');
    console.log('  Order Number:', latestOrder.orderNumber);
    console.log('  Customer:', latestOrder.customers?.name || 'N/A');
    console.log('  Total Quantity:', latestOrder.totalQuantity);
    console.log('  Total Amount: ₹', latestOrder.totalAmount);
    console.log('  Status:', latestOrder.status);
    console.log('  Created:', new Date(latestOrder.orderDate).toLocaleDateString());
    console.log('');
    console.log('  Items:', latestOrder.order_items?.length || 0);

    if (latestOrder.order_items && latestOrder.order_items.length > 0) {
      latestOrder.order_items.forEach((item, idx) => {
        console.log(`    Item ${idx + 1}:`);
        console.log(`      Style: ${item.styles?.styleCode} - ${item.styles?.styleName}`);
        console.log(`      Quantity: ${item.totalQuantity} pieces`);
        console.log(`      Unit Price: ₹${item.unitPrice}`);
        console.log(`      Total: ₹${item.totalPrice}`);
        console.log(`      Breakup entries: ${item.order_item_breakup?.length || 0}`);
      });
    }
  }
})();
