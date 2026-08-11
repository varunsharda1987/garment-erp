/**
 * Backfill Job Work Orders for orphaned MRP-generated PROCESSING POs (BUG-JWC1).
 *
 * MRP's generatePOFromRequirements historically created PROCESSING POs with no
 * job_work_orders row, leaving the work invisible in /job-work-orders and the
 * dyeing/printing process-PO lists. The live bridge (mrp.service.ts) now creates the
 * JWO at generation time; this script covers POs generated before the bridge.
 *
 * - Only auto-fixes poSource='MRP' POs (MANUAL orphans are logged, not touched)
 * - Idempotent: skips POs that already have a JWO (purchaseOrderId is @unique anyway)
 * - Dry-run by default; pass --apply to write
 *
 * Usage:
 *   npx ts-node scripts/backfill-mrp-processing-jwos.ts           # dry run
 *   npx ts-node scripts/backfill-mrp-processing-jwos.ts --apply   # create JWOs
 */
import { PrismaClient } from '@prisma/client';
import { buildJwoDataForProcessingPO } from '../src/services/mrp.service';
import { generateJobWorkNumber } from '../src/utils/jobWorkNumber';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

async function main() {
  console.log(`=== Backfill MRP PROCESSING JWOs (${APPLY ? 'APPLY' : 'DRY RUN'}) ===\n`);

  const orphans = await prisma.purchase_orders.findMany({
    where: {
      poCategory: 'PROCESSING',
      isActive: true,
      jobWorkOrder: null,
    },
    select: {
      id: true,
      poNumber: true,
      poSource: true,
      supplierId: true,
      expectedDeliveryDate: true,
      createdById: true,
      purchase_order_items: { select: { orderedQuantity: true, unitPrice: true, printingType: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  if (orphans.length === 0) {
    console.log('No PROCESSING POs without a Job Work Order. Nothing to do.');
    return;
  }

  let created = 0;
  let skippedManual = 0;

  for (const po of orphans) {
    if (po.poSource !== 'MRP') {
      console.log(`SKIP (source=${po.poSource}): ${po.poNumber} — only MRP orphans are auto-fixed`);
      skippedManual++;
      continue;
    }

    // Resolve the linked PROCESSING requirement(s) for provenance
    const links = await prisma.requirement_po_links.findMany({
      where: { purchaseOrderId: po.id },
      include: {
        material_requirements: {
          include: {
            order_items: { select: { styleId: true, styles: { select: { styleCode: true } } } },
            orderBomItem: {
              select: {
                fabricId: true,
                rateCard: { select: { processingType: true, shrinkagePercent: true } },
              },
            },
          },
        },
      },
    });
    const reqs = links.map((l) => l.material_requirements).filter(Boolean) as any[];

    if (reqs.length === 0) {
      console.log(`SKIP (no linked requirements): ${po.poNumber} — cannot derive JWO data`);
      continue;
    }

    const primary = reqs[0];
    const rcType = primary.orderBomItem?.rateCard?.processingType;
    const processType: 'DYEING' | 'PRINTING' =
      rcType === 'DYEING' || rcType === 'PRINTING'
        ? rcType
        : primary.printingType || po.purchase_order_items.some((i) => i.printingType)
          ? 'PRINTING'
          : 'DYEING';
    const styleCode = primary.order_items?.styles?.styleCode || 'STK';
    const qtyMeters = po.purchase_order_items.reduce((sum, i) => sum + Number(i.orderedQuantity || 0), 0);
    const ratePerMeter = Number(po.purchase_order_items[0]?.unitPrice || 0);

    console.log(
      `${APPLY ? 'CREATE' : 'WOULD CREATE'}: JWO for ${po.poNumber} — ${processType}, style ${styleCode}, ` +
        `${qtyMeters}m @ ₹${ratePerMeter}/m, reqs: ${reqs.map((r) => r.requirementNumber).join(', ')}`
    );

    if (APPLY) {
      const jobWorkNumber = await generateJobWorkNumber(processType, styleCode);
      await prisma.$transaction(async (tx) => {
        await tx.job_work_orders.create({
          data: buildJwoDataForProcessingPO(
            {
              poId: po.id,
              processorId: po.supplierId,
              processType,
              styleId: primary.order_items?.styleId ?? null,
              fabricId: primary.orderBomItem?.fabricId ?? null,
              qtyMeters,
              ratePerMeter,
              expectedShrinkage:
                primary.orderBomItem?.rateCard?.shrinkagePercent != null
                  ? Number(primary.orderBomItem.rateCard.shrinkagePercent)
                  : null,
              expectedReturnDate: po.expectedDeliveryDate,
              requirementNumbers: reqs.map((r) => r.requirementNumber),
              userId: po.createdById,
            },
            jobWorkNumber
          ),
        });
      });
      console.log(`  → created ${jobWorkNumber}`);
      created++;
    }
  }

  console.log(
    `\nDone. ${APPLY ? `Created ${created} JWO(s).` : `${orphans.length - skippedManual} MRP orphan(s) found.`}` +
      (skippedManual ? ` ${skippedManual} MANUAL orphan(s) logged, not touched.` : '')
  );
  if (!APPLY) console.log('Run with --apply to create the JWOs.');
}

main()
  .catch((e) => {
    console.error('Backfill failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
