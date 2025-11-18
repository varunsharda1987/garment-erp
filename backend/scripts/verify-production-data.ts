import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
  try {
    console.log('📊 Database Verification:\n');

    const orders = await prisma.orders.count();
    const workOrders = await prisma.work_orders.count();
    const tracking = await prisma.production_tracking.count();
    const locations = await prisma.locations.count();
    const customers = await prisma.customers.count();
    const styles = await prisma.styles.count();

    console.log(`   Customers: ${customers}`);
    console.log(`   Styles: ${styles}`);
    console.log(`   Orders: ${orders}`);
    console.log(`   Work Orders: ${workOrders}`);
    console.log(`   Production Tracking: ${tracking}`);
    console.log(`   Locations: ${locations}`);

    // Get work order details
    const workOrdersWithDetails = await prisma.work_orders.findMany({
      include: {
        orders: {
          include: { customers: true }
        },
        styles: true,
        locations: true,
      }
    });

    console.log('\n📋 Work Orders Details:\n');
    workOrdersWithDetails.forEach(wo => {
      console.log(`   ${wo.workOrderNumber}:`);
      console.log(`      Customer: ${wo.orders.customers?.name}`);
      console.log(`      Style: ${wo.styles.styleCode} - ${wo.styles.styleName}`);
      console.log(`      Location: ${wo.locations.locationName}`);
      console.log(`      Status: ${wo.status}`);
      console.log(`      Quantity: ${wo.completedQuantity}/${wo.totalQuantity}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Verification failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

verify();
