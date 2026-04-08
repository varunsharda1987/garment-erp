// Script to find and delete order and related data for a style
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const STYLE_CODE = 'ESSKA245FD';
const DRY_RUN = process.argv.includes('--dry-run');
const EXECUTE = process.argv.includes('--execute');

async function main() {
  console.log(`\n=== Finding data for style: ${STYLE_CODE} ===\n`);

  // Find the style
  const style = await prisma.styles.findFirst({
    where: { styleCode: STYLE_CODE },
    select: { id: true, styleCode: true, styleName: true }
  });

  if (!style) {
    console.log('Style not found!');
    return;
  }
  console.log('Style:', style);

  // Find work orders for this style (work_orders has styleId)
  const workOrders = await prisma.work_orders.findMany({
    where: { styleId: style.id },
    select: { id: true, workOrderNumber: true, orderId: true }
  });
  console.log('\nWork Orders:', workOrders);

  const workOrderIds = workOrders.map(wo => wo.id);

  // Get unique order IDs from work orders
  const orderIds = [...new Set(workOrders.map(wo => wo.orderId).filter(Boolean))];

  // Find orders
  const orders = await prisma.orders.findMany({
    where: { id: { in: orderIds } },
    select: { id: true, orderNumber: true }
  });
  console.log('\nOrders:', orders);

  if (workOrders.length === 0) {
    console.log('No work orders found for this style');
    return;
  }

  // Find cutting batches
  const cuttingBatches = await prisma.cutting_batches.findMany({
    where: { workOrderId: { in: workOrderIds } },
    select: { id: true, batchNumber: true, status: true, fabricStockId: true }
  });
  console.log('\nCutting Batches:', cuttingBatches);

  // Will recalculate after merging order IDs
  let orderBoms = [];
  let orderBomIds = [];
  let bomItems = [];
  let materialRequirements = [];

  // Find fabric stock entries by style
  const fabricStock = await prisma.fabric_stock.findMany({
    where: { originStyleId: style.id },
    select: { id: true, quantityAvailable: true, status: true }
  });
  console.log('\nFabric Stock entries (by style):', fabricStock.length, 'records');

  // Find order items for this style (may have additional orders)
  const orderItems = await prisma.order_items.findMany({
    where: { styleId: style.id },
    select: { id: true, orderId: true }
  });
  console.log('\nOrder Items:', orderItems.length, 'records');

  // Merge order IDs from order_items
  const allOrderIds = [...new Set([...orderIds, ...orderItems.map(oi => oi.orderId)])];
  console.log('All Order IDs to delete:', allOrderIds);

  // Now find BOMs for all orders
  if (allOrderIds.length > 0) {
    orderBoms = await prisma.order_bom.findMany({
      where: { orderId: { in: allOrderIds } },
      select: { id: true }
    });
    orderBomIds = orderBoms.map(b => b.id);

    if (orderBomIds.length > 0) {
      bomItems = await prisma.order_bom_items.findMany({
        where: { orderBomId: { in: orderBomIds } },
        select: { id: true }
      });
    }

    materialRequirements = await prisma.material_requirements.findMany({
      where: { orderId: { in: allOrderIds } },
      select: { id: true }
    });
  }
  console.log('\nOrder BOMs:', orderBoms.length, 'records');
  console.log('BOM Items:', bomItems.length, 'records');
  console.log('MRP Requirements:', materialRequirements.length, 'records');

  // Find challans by production run (work order)
  const challans = await prisma.challans.findMany({
    where: { productionRunId: { in: workOrderIds } },
    select: { id: true, challanNumber: true }
  });
  console.log('\nChallans (by production run):', challans);

  // Find fabric_width_cad entries cloned from orders
  const fabricWidthCad = await prisma.fabric_width_cad.findMany({
    where: { clonedFromOrderId: { in: allOrderIds } },
    select: { id: true }
  });
  console.log('\nFabric Width CAD (cloned from orders):', fabricWidthCad.length, 'records');

  if (!EXECUTE) {
    console.log('\n=== DRY RUN - No data deleted ===');
    console.log('Use --execute flag to actually delete the data');
    return;
  }

  console.log('\n=== EXECUTING DELETE ===\n');

  await prisma.$transaction(async (tx) => {
    // Delete in reverse dependency order

    // 1. Delete cutting batch related data (if any)
    const cuttingBatchIds = cuttingBatches.map(cb => cb.id);
    if (cuttingBatchIds.length > 0) {
      // Delete cutting_batch_skus
      const deletedBatchSkus = await tx.cutting_batch_skus.deleteMany({
        where: { batchId: { in: cuttingBatchIds } }
      });
      console.log('Deleted cutting_batch_skus:', deletedBatchSkus.count);

      // Delete cutting_batch_fabrics
      const deletedBatchFabrics = await tx.cutting_batch_fabrics.deleteMany({
        where: { batchId: { in: cuttingBatchIds } }
      });
      console.log('Deleted cutting_batch_fabrics:', deletedBatchFabrics.count);

      // Delete cutting_lays
      const deletedLays = await tx.cutting_lays.deleteMany({
        where: { batchId: { in: cuttingBatchIds } }
      });
      console.log('Deleted cutting_lays:', deletedLays.count);

      // Delete cutting batches
      const deletedBatches = await tx.cutting_batches.deleteMany({
        where: { id: { in: cuttingBatchIds } }
      });
      console.log('Deleted cutting_batches:', deletedBatches.count);
    } else {
      console.log('No cutting batches to delete');
    }

    // 2. Delete challan items and challans
    const challanIds = challans.map(c => c.id);
    const deletedChallanItems = await tx.challan_items.deleteMany({
      where: { challanId: { in: challanIds } }
    });
    console.log('Deleted challan_items:', deletedChallanItems.count);

    const deletedChallans = await tx.challans.deleteMany({
      where: { id: { in: challanIds } }
    });
    console.log('Deleted challans:', deletedChallans.count);

    // 3. Delete fabric_width_cad entries cloned from orders
    if (allOrderIds.length > 0) {
      // First delete cad_size_breakdown entries
      const fabricCadIds = fabricWidthCad.map(c => c.id);
      if (fabricCadIds.length > 0) {
        const deletedCadSizes = await tx.cad_size_breakdown.deleteMany({
          where: { cadId: { in: fabricCadIds } }
        });
        console.log('Deleted cad_size_breakdown:', deletedCadSizes.count);
      }

      const deletedFabricWidthCad = await tx.fabric_width_cad.deleteMany({
        where: { clonedFromOrderId: { in: allOrderIds } }
      });
      console.log('Deleted fabric_width_cad:', deletedFabricWidthCad.count);
    }

    // 4. Delete fabric stock by style
    const deletedFabricStock = await tx.fabric_stock.deleteMany({
      where: { originStyleId: style.id }
    });
    console.log('Deleted fabric_stock:', deletedFabricStock.count);

    // 5. Delete MRP requirements
    if (allOrderIds.length > 0) {
      const deletedMrp = await tx.material_requirements.deleteMany({
        where: { orderId: { in: allOrderIds } }
      });
      console.log('Deleted material_requirements:', deletedMrp.count);
    }

    // 6. Delete BOM items and BOMs
    if (orderBomIds.length > 0) {
      const deletedBomItems = await tx.order_bom_items.deleteMany({
        where: { orderBomId: { in: orderBomIds } }
      });
      console.log('Deleted order_bom_items:', deletedBomItems.count);

      const deletedBoms = await tx.order_bom.deleteMany({
        where: { id: { in: orderBomIds } }
      });
      console.log('Deleted order_bom:', deletedBoms.count);
    }

    // 7. Delete work orders
    if (workOrderIds.length > 0) {
      const deletedWorkOrders = await tx.work_orders.deleteMany({
        where: { id: { in: workOrderIds } }
      });
      console.log('Deleted work_orders:', deletedWorkOrders.count);
    }

    // 8. Delete order items for this style
    const deletedOrderItems = await tx.order_items.deleteMany({
      where: { styleId: style.id }
    });
    console.log('Deleted order_items:', deletedOrderItems.count);

    // 9. Delete orders (only if no other order items reference them)
    for (const orderId of allOrderIds) {
      const otherItems = await tx.order_items.count({ where: { orderId } });
      if (otherItems === 0) {
        await tx.orders.delete({ where: { id: orderId } });
        console.log('Deleted order:', orderId);
      } else {
        console.log('Skipped order (has other items):', orderId, '- remaining items:', otherItems);
      }
    }

    console.log('\n=== DELETE COMPLETE ===');
  });
}

main()
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
