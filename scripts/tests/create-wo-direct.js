const API_URL = 'http://localhost:5000/api';
const credentials = { email: 'admin@kashayafabs.com', password: 'Admin@123' };

// Known IDs from database
const LOCATION_ID = 'f5b7d213-73c4-4fe0-8d28-027d8c3d4f4a'; // FAC-001

async function createWorkOrder() {
  try {
    // Login
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    const { token } = await loginRes.json();

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

    console.log(`📦 Creating work order for ${order.orderNumber}...`);

    // Prepare work order
    const colorSizeBreakup = orderItem.order_item_breakup.map(b => ({
      colorId: b.colorId,
      sizeId: b.sizeId,
      quantity: b.quantity
    }));

    const workOrderData = {
      orderId: order.id,
      orderItemId: orderItem.id,
      styleId: orderItem.styleId,
      locationId: LOCATION_ID,
      plannedStartDate: new Date().toISOString(),
      plannedEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      totalQuantity: orderItem.totalQuantity,
      priority: 'MEDIUM',
      remarks: 'Test work order',
      colorSizeBreakup: colorSizeBreakup
    };

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
      console.log('✅ Work order created!');
      console.log(`   WO Number: ${workOrder.data.workOrderNumber}`);
      console.log(`   Quantity: ${workOrder.data.totalQuantity} pieces`);
      console.log(`   Status: ${workOrder.data.status}\n`);
    } else {
      const error = await workOrderRes.text();
      console.error('❌ Failed:', error);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createWorkOrder();
