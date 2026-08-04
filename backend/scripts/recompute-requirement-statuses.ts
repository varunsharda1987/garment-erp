/**
 * P1.11 Backfill Script: Recompute Requirement Statuses
 *
 * Purpose: Heal requirements that are stuck in wrong statuses by recomputing
 * from the actual received quantities in requirement_po_links.
 *
 * This fixes:
 * - Requirements stuck in PO_SENT that should be PARTIALLY_RECEIVED
 * - Requirements stuck in PO_GENERATED that should be RECEIVED
 * - Any other status drift from pre-P1 bugs
 *
 * Run: cd backend && npx ts-node scripts/recompute-requirement-statuses.ts
 *
 * Safe to run multiple times (idempotent).
 */

import prisma from '../src/config/database';

const MaterialRequirementStatus = {
  PENDING: 'PENDING',
  FULFILLED_STOCK: 'FULFILLED_STOCK',
  PARTIAL_STOCK: 'PARTIAL_STOCK',
  PO_REQUIRED: 'PO_REQUIRED',
  PO_GENERATED: 'PO_GENERATED',
  PO_SENT: 'PO_SENT',
  PARTIALLY_RECEIVED: 'PARTIALLY_RECEIVED',
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED',
} as const;

async function recomputeRequirementStatuses() {
  console.log('=== P1.11 Backfill: Recompute Requirement Statuses ===\n');

  // Find all requirements that have PO links (they've been ordered)
  const requirementsWithLinks = await prisma.material_requirements.findMany({
    where: {
      status: { in: ['PO_GENERATED', 'PO_SENT', 'PARTIALLY_RECEIVED', 'RECEIVED'] },
    },
    select: {
      id: true,
      requirementNumber: true,
      status: true,
      totalRequired: true,
    },
  });

  console.log(`Found ${requirementsWithLinks.length} requirements with PO-related statuses\n`);

  let fixed = 0;
  let unchanged = 0;
  let errors = 0;

  for (const req of requirementsWithLinks) {
    try {
      // Aggregate across ALL links for this requirement
      const links = await prisma.requirement_po_links.findMany({
        where: { requirementId: req.id },
        select: {
          allocatedQuantity: true,
          receivedQuantity: true,
          purchase_orders: {
            select: { status: true },
          },
        },
      });

      if (links.length === 0) {
        // No links but has PO status — might be a bug, but leave it alone
        continue;
      }

      const totalAllocated = links.reduce((sum, l) => sum + Number(l.allocatedQuantity), 0);
      const totalReceived = links.reduce((sum, l) => sum + Number(l.receivedQuantity), 0);

      // Check if any linked PO is SENT or beyond
      const anyPOSent = links.some((l) =>
        l.purchase_orders?.status &&
        !['DRAFT', 'CANCELLED'].includes(l.purchase_orders.status)
      );

      // Determine correct status
      let correctStatus: string;
      if (totalReceived >= totalAllocated && totalAllocated > 0) {
        correctStatus = MaterialRequirementStatus.RECEIVED;
      } else if (totalReceived > 0) {
        correctStatus = MaterialRequirementStatus.PARTIALLY_RECEIVED;
      } else if (anyPOSent) {
        correctStatus = MaterialRequirementStatus.PO_SENT;
      } else {
        correctStatus = MaterialRequirementStatus.PO_GENERATED;
      }

      if (req.status === correctStatus) {
        unchanged++;
        continue;
      }

      // Fix the status
      await prisma.material_requirements.update({
        where: { id: req.id },
        data: { status: correctStatus as any },
      });

      console.log(`  [FIXED] ${req.requirementNumber}: ${req.status} → ${correctStatus} (allocated=${totalAllocated}, received=${totalReceived})`);
      fixed++;

    } catch (err: any) {
      console.error(`  [ERROR] ${req.requirementNumber}: ${err.message}`);
      errors++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Fixed:     ${fixed}`);
  console.log(`Unchanged: ${unchanged}`);
  console.log(`Errors:    ${errors}`);
  console.log(`Total:     ${requirementsWithLinks.length}`);
}

// Run
recomputeRequirementStatuses()
  .then(() => {
    console.log('\nStatus recompute complete.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Recompute failed:', err);
    process.exit(1);
  });
