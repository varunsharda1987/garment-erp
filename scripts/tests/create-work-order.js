const API_URL = 'http://localhost:5000/api';
const credentials = { email: 'admin@kashayafabs.com', password: 'Admin@123' };

async function createWorkOrder() {
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

    // 2. Get the order we created
    console.log('📦 Fetching order...');
    const ordersRes = await fetch(`${API_URL}/orders`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const ordersData = await ordersRes.json();
    const order = ordersData.data[0];
    console.log(`✅ Found order: ${order.orderNumber}\n`);

    // 3. Get order details with items
    const orderDetailRes = await fetch(`${API_URL}/orders/${order.id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const orderDetail = await orderDetailRes.json();
    const orderItem = orderDetail.data.order_items[0];

    console.log('📊 Order Item Details:');
    console.log(`   Style ID: ${orderItem.styleId}`);
    console.log(`   Item ID: ${orderItem.id}`);
    console.log(`   Quantity: ${orderItem.totalQuantity}`);
    console.log(`   Breakup entries: ${orderItem.order_item_breakup.length}\n`);

    // 4. Check if we have a warehouse/location
    console.log('🏭 Checking for warehouses...');
    const warehousesRes = await fetch(`${API_URL}/warehouses`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    let warehouse;
    if (warehousesRes.ok) {
      const warehousesData = await warehousesRes.json();
      if (warehousesData.data && warehousesData.data.length > 0) {
        warehouse = warehousesData.data[0];
        console.log(`✅ Using warehouse: ${warehouse.warehouseName || warehouse.name}\n`);
      }
    }

    // If no warehouse, create one
    if (!warehouse) {
      console.log('📝 Creating warehouse...');
      const createWarehouseRes = await fetch(`${API_URL}/warehouses`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: 'WH-MAIN',
          name: 'Main Production Unit',
          type: 'PRODUCTION',
          address: 'Production Facility, Industrial Area',
          capacity: 10000,
          isActive: true
        })
      });

      if (createWarehouseRes.ok) {
        const warehouseData = await createWarehouseRes.json();
        warehouse = warehouseData.data;
        console.log(`✅ Created warehouse: ${warehouse.name}\n`);
      } else {
        console.error('❌ Failed to create warehouse');
        return;
      }
    }

    // 5. Create work order
    console.log('🔨 Creating work order...');

    // Prepare color-size breakup
    const colorSizeBreakup = orderItem.order_item_breakup.map(b => ({
      colorId: b.colorId,
      sizeId: b.sizeId,
      quantity: b.quantity
    }));

    const workOrderData = {
      orderId: order.id,
      orderItemId: orderItem.id,
      styleId: orderItem.styleId,
      locationId: warehouse.id,
      plannedStartDate: new Date().toISOString(),
      plannedEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
      totalQuantity: orderItem.totalQuantity,
      priority: 'MEDIUM',
      remarks: 'Test work order for production tracking',
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
      console.log('✅ Work order created successfully!');
      console.log(`   Work Order Number: ${workOrder.data.workOrderNumber}`);
      console.log(`   Status: ${workOrder.data.status}`);
      console.log(`   Total Quantity: ${workOrder.data.totalQuantity} pieces`);
      console.log(`   Location: ${warehouse.warehouseName || warehouse.name}`);
      console.log(`\n🎯 Next: Track production progress`);
    } else {
      const error = await workOrderRes.text();
      console.error('❌ Failed to create work order:', error);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createWorkOrder();
