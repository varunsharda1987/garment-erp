const API_URL = 'http://localhost:5000/api';
const credentials = { email: 'admin@kashayafabs.com', password: 'Admin@123' };

async function createWorkOrder() {
  try {
    // Login
    console.log('🔐 Logging in...');
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    const { token } = await loginRes.json();
    console.log('✅ Logged in\n');

    // Get order
    const ordersRes = await fetch(`${API_URL}/orders`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const ordersData = await ordersRes.json();
    const order = ordersData.data[0];

    // Get order details
    const orderDetailRes = await fetch(`${API_URL}/orders/${order.id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const orderDetail = await orderDetailRes.json();
    const orderItem = orderDetail.data.order_items[0];

    console.log(`📦 Order: ${order.orderNumber}`);
    console.log(`   Style ID: ${orderItem.styleId}`);
    console.log(`   Item ID: ${orderItem.id}`);
    console.log(`   Quantity: ${orderItem.totalQuantity}\n`);

    // Get location
    const locationsRes = await fetch(`${API_URL}/locations`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const locationsData = await locationsRes.json();
    const location = locationsData.data[0];

    console.log(`🏭 Location: ${location.locationName} (${location.locationCode})\n`);

    // Prepare work order data
    const colorSizeBreakup = orderItem.order_item_breakup.map(b => ({
      colorId: b.colorId,
      sizeId: b.sizeId,
      quantity: b.quantity
    }));

    const workOrderData = {
      orderId: order.id,
      orderItemId: orderItem.id,
      styleId: orderItem.styleId,
      locationId: location.id,
      plannedStartDate: new Date().toISOString(),
      plannedEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      totalQuantity: orderItem.totalQuantity,
      priority: 'MEDIUM',
      remarks: 'Test work order for production tracking',
      colorSizeBreakup: colorSizeBreakup
    };

    console.log('🔨 Creating work order...');
    const workOrderRes = await fetch(`${API_URL}/work-orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(workOrderData)
    });

    if (workOrderRes.ok) {
      const workOrder = await workOrderRes.json();
      console.log('✅ Work order created successfully!');
      console.log(`   Work Order Number: ${workOrder.data.workOrderNumber}`);
      console.log(`   Status: ${workOrder.data.status}`);
      console.log(`   Total Quantity: ${workOrder.data.totalQuantity} pieces`);
      console.log(`   Location: ${location.locationName}`);
      console.log(`\n🎯 Next: Track production progress`);
      return workOrder.data;
    } else {
      const error = await workOrderRes.text();
      console.error('❌ Failed to create work order:', error);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createWorkOrder();
