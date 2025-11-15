const API_URL = 'http://localhost:5000/api';
const credentials = { email: 'admin@kashayafabs.com', password: 'Admin@123' };

async function trackProduction() {
  try {
    // Login
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    const { token } = await loginRes.json();

    // Get the work order we created
    const woRes = await fetch(`${API_URL}/work-orders`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const woData = await woRes.json();
    const workOrder = woData.data[0];

    console.log(`🔨 Tracking production for ${workOrder.workOrderNumber}`);
    console.log(`   Total Quantity: ${workOrder.totalQuantity} pieces\n`);

    // Production stages to track
    const stages = [
      { stage: 'IN_CUTTING', quantity: 75, remarks: 'Fabric cutting completed for all 75 pieces' },
      { stage: 'IN_STITCHING', quantity: 70, remarks: 'First 70 pieces stitched' },
      { stage: 'CHECKING', quantity: 65, remarks: '65 pieces passed quality inspection' },
      { stage: 'IN_FINISHING', quantity: 60, remarks: '60 pieces in finishing stage' },
      { stage: 'READY_TO_SHIP', quantity: 55, remarks: '55 pieces packed and ready to ship' },
    ];

    for (const update of stages) {
      console.log(`📊 ${update.stage}: ${update.quantity} pieces...`);

      const trackingData = {
        productionStage: update.stage,
        quantityCompleted: update.quantity,
        remarks: update.remarks
      };

      const trackingRes = await fetch(`${API_URL}/work-orders/${workOrder.id}/tracking`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(trackingData)
      });

      if (trackingRes.ok) {
        console.log(`   ✅ Updated\n`);
      } else {
        const error = await trackingRes.text();
        console.error(`   ❌ Failed: ${error}\n`);
      }

      // Small delay between updates
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Get final work order status
    const finalWoRes = await fetch(`${API_URL}/work-orders/${workOrder.id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const finalWo = await finalWoRes.json();

    console.log('🎉 Production tracking complete!');
    console.log(`   Work Order: ${finalWo.data.workOrderNumber}`);
    console.log(`   Status: ${finalWo.data.status}`);
    console.log(`   Completed: ${finalWo.data.completedQuantity}/${finalWo.data.totalQuantity} pieces`);
    console.log(`\n✅ Workflow complete: Order → Work Order → Production Tracking`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

trackProduction();
