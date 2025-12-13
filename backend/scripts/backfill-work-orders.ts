/**
 * Backfill Work Orders Script
 *
 * Creates work orders (production runs) for all existing orders that don't have them.
 * This is a one-time migration script to support the new auto-creation workflow.
 *
 * Run with: npx ts-node scripts/backfill-work-orders.ts
 */

import { PrismaClient } from '@prisma/client';
import workOrderService from '../src/services/workOrder.service';

const prisma = new PrismaClient();

async function backfillWorkOrders() {
  console.log('🔄 Starting work order backfill...\n');

  try {
    // Get all orders with their items and breakup
    const orders = await prisma.orders.findMany({
      where: {
        status: {
          notIn: ['CANCELLED'],  // Skip cancelled orders
        },
      },
      include: {
        order_items: {
          include: {
            order_item_breakup: true,
            styles: {
              select: {
                id: true,
                styleCode: true,
                styleName: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    console.log(`📋 Found ${orders.length} orders to process\n`);

    let createdCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const order of orders) {
      console.log(`Processing order: ${order.orderNumber}`);

      for (const orderItem of order.order_items) {
        // Check if work order already exists for this order item
        const existingWorkOrder = await prisma.work_orders.findFirst({
          where: {
            orderItemId: orderItem.id,
          },
        });

        if (existingWorkOrder) {
          console.log(`  ⏭️  Skipping item ${orderItem.styles?.styleCode || orderItem.id} - work order already exists`);
          skippedCount++;
          continue;
        }

        // Skip items with no breakup (shouldn't happen, but safety check)
        if (!orderItem.order_item_breakup || orderItem.order_item_breakup.length === 0) {
          console.log(`  ⚠️  Skipping item ${orderItem.styles?.styleCode || orderItem.id} - no breakup data`);
          skippedCount++;
          continue;
        }

        try {
          // Create work order from order item
          await workOrderService.createFromOrderItem(
            orderItem.id,
            order.id,
            {
              plannedStartDate: order.orderDate || new Date(),
              plannedEndDate: order.expectedDeliveryDate || new Date(),
              priority: order.priority,
              createdById: order.createdById,
            }
          );

          console.log(`  ✅ Created work order for style: ${orderItem.styles?.styleCode || 'N/A'}`);
          createdCount++;
        } catch (err) {
          console.error(`  ❌ Error creating work order for item ${orderItem.id}:`, err);
          errorCount++;
        }
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 Backfill Summary:');
    console.log(`   ✅ Created: ${createdCount} work orders`);
    console.log(`   ⏭️  Skipped: ${skippedCount} (already exist or no data)`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log('='.repeat(50));

    if (errorCount === 0) {
      console.log('\n✨ Backfill completed successfully!');
    } else {
      console.log('\n⚠️  Backfill completed with some errors. Please review above.');
    }

  } catch (error) {
    console.error('Fatal error during backfill:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the backfill
backfillWorkOrders();
