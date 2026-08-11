/**
 * Phase 4a backfill: requirement ↔ JWO links + JWO commercial totals.
 *
 * 1. For every job_work_orders row with a purchaseOrderId, mirror that PO's
 *    requirement_po_links into requirement_jwo_links (snapshot copy incl.
 *    receivedQuantity). Idempotent via the [requirementId, jobWorkOrderId]
 *    unique constraint + skipDuplicates.
 * 2. --commercial: for JWOs with NULL totalAmount, resolve processTypeId (by
 *    processType code) and run computeCommercialTotals; unresolved GST rate
 *    downgrades to subtotal-only (qty × rate), same as the live bridge.
 *
 * Usage:
 *   npx ts-node scripts/backfill-requirement-jwo-links.ts                       # dry run
 *   npx ts-node scripts/backfill-requirement-jwo-links.ts --apply              # links only
 *   npx ts-node scripts/backfill-requirement-jwo-links.ts --apply --commercial # links + money
 */
import { PrismaClient } from '@prisma/client';
import { jobWorkOrderService, JobWorkOrderError, JWO_ERROR_CODES } from '../src/services/job-work-order.service';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const COMMERCIAL = process.argv.includes('--commercial');

async function main() {
  console.log(`=== Backfill requirement_jwo_links (${APPLY ? 'APPLY' : 'DRY RUN'}${COMMERCIAL ? ' + COMMERCIAL' : ''}) ===\n`);

  const jwos = await prisma.job_work_orders.findMany({
    where: { purchaseOrderId: { not: null }, isActive: true },
    select: {
      id: true,
      jobWorkNumber: true,
      processType: true,
      processTypeId: true,
      purchaseOrderId: true,
      qtySentMeters: true,
      agreedRatePerMeter: true,
      totalAmount: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  let linksCreated = 0;
  let commercialUpdated = 0;

  for (const jwo of jwos) {
    const poLinks = await prisma.requirement_po_links.findMany({
      where: { purchaseOrderId: jwo.purchaseOrderId! },
      select: { requirementId: true, allocatedQuantity: true, receivedQuantity: true },
    });

    const existing = await prisma.requirement_jwo_links.count({ where: { jobWorkOrderId: jwo.id } });
    const missing = poLinks.length - existing;

    if (poLinks.length > 0 && missing > 0) {
      console.log(
        `${APPLY ? 'LINK' : 'WOULD LINK'}: ${jwo.jobWorkNumber} ← ${poLinks.length} requirement link(s) (${existing} already present)`
      );
      if (APPLY) {
        const result = await prisma.requirement_jwo_links.createMany({
          data: poLinks.map((l) => ({
            requirementId: l.requirementId,
            jobWorkOrderId: jwo.id,
            allocatedQuantity: l.allocatedQuantity,
            receivedQuantity: l.receivedQuantity,
          })),
          skipDuplicates: true,
        });
        linksCreated += result.count;
      }
    }

    if (COMMERCIAL && jwo.totalAmount == null) {
      console.log(`${APPLY ? 'COMPUTE' : 'WOULD COMPUTE'}: commercial totals for ${jwo.jobWorkNumber} (${jwo.processType})`);
      if (APPLY) {
        if (!jwo.processTypeId) {
          const master = await prisma.process_type_master.findFirst({
            where: { code: jwo.processType, isActive: true },
            select: { id: true },
          });
          if (master) {
            await prisma.job_work_orders.update({ where: { id: jwo.id }, data: { processTypeId: master.id } });
          }
        }
        try {
          await jobWorkOrderService.computeCommercialTotals(jwo.id);
          commercialUpdated++;
        } catch (e) {
          if (e instanceof JobWorkOrderError && e.code === JWO_ERROR_CODES.GST_RATE_UNRESOLVED) {
            const subtotal = Number(jwo.qtySentMeters) * Number(jwo.agreedRatePerMeter);
            await prisma.job_work_orders.update({
              where: { id: jwo.id },
              data: { subtotal: Math.round(subtotal * 100) / 100 },
            });
            console.log(`  → GST unresolved for ${jwo.processType}; subtotal-only (₹${subtotal.toFixed(2)})`);
            commercialUpdated++;
          } else {
            throw e;
          }
        }
      }
    }
  }

  console.log(
    `\nDone. ${jwos.length} PO-linked JWO(s) scanned.` +
      (APPLY ? ` Created ${linksCreated} link(s); updated commercials on ${commercialUpdated} JWO(s).` : ' Run with --apply to write.')
  );
}

main()
  .catch((e) => {
    console.error('Backfill failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
