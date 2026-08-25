/**
 * Fix missing MRP requirements for orders with approved BOMs
 *
 * Run with: npx ts-node scripts/fix-missing-mrp.ts
 */
import prisma from '../src/config/database';
import { calculateRequirementsFromOrder } from '../src/services/mrp.service';

async function main() {
  console.log('Finding orders with approved BOMs but no MRP requirements...\n');

  // Find all approved BOMs
  const approvedBoms = await prisma.order_bom.findMany({
    where: { status: 'APPROVED', isActive: true },
    include: {
      style: { select: { id: true, styleCode: true } },
      order: { select: { id: true, orderNumber: true, expectedDeliveryDate: true } },
    },
  });

  // Filter to find those without requirements
  const missingOrders: typeof approvedBoms = [];
  for (const bom of approvedBoms) {
    const reqCount = await prisma.material_requirements.count({
      where: { order_items: { styles: { styleCode: bom.style.styleCode } } },
    });
    if (reqCount === 0) {
      missingOrders.push(bom);
    }
  }

  if (missingOrders.length === 0) {
    console.log('All orders with approved BOMs already have MRP requirements. Nothing to fix.');
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${missingOrders.length} order(s) with approved BOM but no MRP requirements:\n`);
  missingOrders.forEach((bom) => {
    console.log(`  - ${bom.style.styleCode} (Order: ${bom.order.orderNumber})`);
  });
  console.log();

  // Get admin user for userId parameter
  const adminUser = await prisma.users.findFirst({
    where: { role: 'ADMIN' },
    select: { id: true, email: true },
  });

  if (!adminUser) {
    console.error('No admin user found!');
    await prisma.$disconnect();
    return;
  }

  console.log(`Using user: ${adminUser.email}\n`);
  console.log('Calculating MRP requirements...\n');

  for (const bom of missingOrders) {
    console.log(`Processing: ${bom.style.styleCode} (Order: ${bom.order.orderNumber})`);

    try {
      const result = await calculateRequirementsFromOrder(
        {
          orderId: bom.order.id,
          requiredDate: bom.order.expectedDeliveryDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          checkStock: true,
        },
        adminUser.id
      );

      console.log(`  ✓ Created ${result.requirements?.length || 0} requirements`);
      if (result.skipped && result.skipped.length > 0) {
        console.log(`  ⚠ Skipped items: ${result.skipped.length}`);
        result.skipped.forEach((item) => {
          console.log(`    - ${item.componentName} (${item.materialType}): ${item.reason}`);
        });
      }
    } catch (error) {
      console.error(`  ✗ Error: ${error instanceof Error ? error.message : error}`);
    }
    console.log();
  }

  console.log('Done!');
  await prisma.$disconnect();
}

main().catch(console.error);
