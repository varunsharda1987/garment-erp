/**
 * One-time script to fix orphaned requirements stuck at PO_GENERATED status
 * after their linked PO was cancelled.
 *
 * Run: cd backend && npx ts-node scripts/fix-orphaned-requirements.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Fix Orphaned Requirements ===\n');

  // 1. Fix material_requirements linked to CANCELLED POs
  const mrpOrphaned = await prisma.material_requirements.findMany({
    where: {
      status: 'PO_GENERATED',
      requirement_po_links: {
        some: {
          purchase_orders: {
            status: 'CANCELLED',
          },
        },
      },
    },
    select: {
      id: true,
      requirementNumber: true,
      requirementType: true,
      requirement_po_links: {
        select: {
          purchase_orders: {
            select: { poNumber: true, status: true },
          },
        },
      },
    },
  });

  console.log(`Found ${mrpOrphaned.length} orphaned material requirements:`);
  for (const req of mrpOrphaned) {
    const poNumbers = req.requirement_po_links
      .map(l => l.purchase_orders.poNumber)
      .join(', ');
    console.log(`  - ${req.requirementNumber} (${req.requirementType}) → linked to cancelled PO(s): ${poNumbers}`);
  }

  if (mrpOrphaned.length > 0) {
    const result = await prisma.material_requirements.updateMany({
      where: {
        id: { in: mrpOrphaned.map(r => r.id) },
        status: 'PO_GENERATED',
      },
      data: { status: 'PO_REQUIRED' },
    });
    console.log(`  ✓ Reverted ${result.count} material requirements to PO_REQUIRED\n`);
  }

  // 2. Fix work_order_service_requirements linked to CANCELLED POs
  const svcOrphaned = await prisma.work_order_service_requirements.findMany({
    where: {
      status: 'PO_GENERATED',
      purchaseOrderId: { not: null },
      purchaseOrder: {
        status: 'CANCELLED',
      },
    },
    select: {
      id: true,
      serviceType: true,
      purchaseOrder: {
        select: { poNumber: true, status: true },
      },
    },
  });

  console.log(`Found ${svcOrphaned.length} orphaned service requirements:`);
  for (const req of svcOrphaned) {
    console.log(`  - ${req.serviceType} → linked to cancelled PO: ${req.purchaseOrder?.poNumber}`);
  }

  if (svcOrphaned.length > 0) {
    const result = await prisma.work_order_service_requirements.updateMany({
      where: {
        id: { in: svcOrphaned.map(r => r.id) },
        status: 'PO_GENERATED',
      },
      data: { status: 'PENDING', purchaseOrderId: null },
    });
    console.log(`  ✓ Reverted ${result.count} service requirements to PENDING\n`);
  }

  if (mrpOrphaned.length === 0 && svcOrphaned.length === 0) {
    console.log('\nNo orphaned requirements found. All clean!');
  }

  console.log('\n=== Done ===');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
