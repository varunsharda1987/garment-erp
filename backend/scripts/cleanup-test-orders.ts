import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanup() {
  try {
    console.log('Cleaning up test orders...');

    // Delete order item breakup first (child records)
    await prisma.$executeRaw`
      DELETE FROM order_item_breakup
      WHERE "orderItemId" IN (
        SELECT id FROM order_items
        WHERE "orderId" IN (
          SELECT id FROM orders
          WHERE "orderNumber" LIKE 'ORD-2025-%'
        )
      )
    `;
    console.log('✅ Deleted order item breakup records');

    // Delete order items
    await prisma.$executeRaw`
      DELETE FROM order_items
      WHERE "orderId" IN (
        SELECT id FROM orders
        WHERE "orderNumber" LIKE 'ORD-2025-%'
      )
    `;
    console.log('✅ Deleted order items');

    // Delete orders
    await prisma.$executeRaw`
      DELETE FROM orders
      WHERE "orderNumber" LIKE 'ORD-2025-%'
    `;
    console.log('✅ Deleted orders');

    console.log('🎉 Cleanup complete!');
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

cleanup();
