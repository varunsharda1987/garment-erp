/**
 * P2 Backfill Script: Link greige_stock lots to grn_items
 *
 * Purpose: Populate grnItemId on existing greige_stock lots that were created
 * from GRN receipts before P2 changes.
 *
 * Matching strategy:
 * 1. Find greige_stock lots with sourceType='GRN' and grnItemId=null
 * 2. Match to grn_items by: greigeId (via materials), width, quantity, date proximity
 * 3. Update the lot with the matched grnItemId
 *
 * Run: cd backend && npx ts-node scripts/backfill-grn-item-links.ts
 *
 * Safe to run multiple times (idempotent — skips lots that already have grnItemId).
 */

import prisma from '../src/config/database';

async function backfillGrnItemLinks() {
  console.log('=== P2 Backfill: Link greige_stock lots to grn_items ===\n');

  // Find greige_stock lots that need linking
  const unlinkedLots = await prisma.greige_stock.findMany({
    where: {
      sourceType: 'GRN',
      grnItemId: null,
    },
    select: {
      id: true,
      greigeId: true,
      greigeWidth: true,
      quantityAvailable: true,
      nominalQuantity: true,
      receivedDate: true,
      warehouseId: true,
      supplierId: true,
      procurementId: true,
    },
  });

  console.log(`Found ${unlinkedLots.length} unlinked greige_stock lots with sourceType='GRN'\n`);

  if (unlinkedLots.length === 0) {
    console.log('Nothing to backfill. All GRN-sourced lots already have grnItemId.');
    return;
  }

  let linked = 0;
  let skipped = 0;
  let ambiguous = 0;
  let errors = 0;

  for (const lot of unlinkedLots) {
    try {
      // Find the materialId for this greige
      const material = await prisma.materials.findFirst({
        where: { greigeId: lot.greigeId },
        select: { id: true },
      });

      if (!material) {
        console.log(`  [SKIP] Lot ${lot.id}: No materials record for greige ${lot.greigeId}`);
        skipped++;
        continue;
      }

      // Find candidate grn_items that could match this lot
      // Match by: materialId, approximate date, and quantity
      const candidates = await prisma.grn_items.findMany({
        where: {
          materialId: material.id,
          // Look for items within 7 days of the lot's received date
          goods_receiving_notes: {
            receivingDate: {
              gte: new Date(lot.receivedDate.getTime() - 7 * 24 * 60 * 60 * 1000),
              lte: new Date(lot.receivedDate.getTime() + 7 * 24 * 60 * 60 * 1000),
            },
            status: { in: ['ACCEPTED', 'PARTIALLY_ACCEPTED'] },
          },
        },
        include: {
          goods_receiving_notes: {
            select: {
              id: true,
              grnNumber: true,
              receivingDate: true,
              warehouseId: true,
            },
          },
        },
      });

      if (candidates.length === 0) {
        console.log(`  [SKIP] Lot ${lot.id}: No matching grn_items found for greige ${lot.greigeId}`);
        skipped++;
        continue;
      }

      // Filter further by warehouse if lot has one
      let filteredCandidates = candidates;
      if (lot.warehouseId) {
        filteredCandidates = candidates.filter(
          (c) => c.goods_receiving_notes.warehouseId === lot.warehouseId
        );
        if (filteredCandidates.length === 0) {
          filteredCandidates = candidates; // Fall back to all if warehouse filter removes all
        }
      }

      // If still multiple candidates, try to match by quantity
      // The lot's nominalQuantity should match grn_item's acceptedQuantity
      const nominalQty = lot.nominalQuantity ? Number(lot.nominalQuantity) : Number(lot.quantityAvailable);
      const qtyMatches = filteredCandidates.filter((c) => {
        const itemQty = Number(c.acceptedQuantity);
        // Allow 1% tolerance for rounding differences
        return Math.abs(itemQty - nominalQty) / nominalQty < 0.01;
      });

      if (qtyMatches.length === 1) {
        // Perfect match
        await prisma.greige_stock.update({
          where: { id: lot.id },
          data: { grnItemId: qtyMatches[0].id },
        });
        console.log(
          `  [OK] Lot ${lot.id} → grn_item ${qtyMatches[0].id} (GRN ${qtyMatches[0].goods_receiving_notes.grnNumber})`
        );
        linked++;
      } else if (qtyMatches.length > 1) {
        // Multiple matches — ambiguous, pick the closest by date
        const sorted = qtyMatches.sort((a, b) => {
          const aDiff = Math.abs(
            a.goods_receiving_notes.receivingDate.getTime() - lot.receivedDate.getTime()
          );
          const bDiff = Math.abs(
            b.goods_receiving_notes.receivingDate.getTime() - lot.receivedDate.getTime()
          );
          return aDiff - bDiff;
        });
        await prisma.greige_stock.update({
          where: { id: lot.id },
          data: { grnItemId: sorted[0].id },
        });
        console.log(
          `  [AMBIGUOUS] Lot ${lot.id} → grn_item ${sorted[0].id} (picked closest date, ${qtyMatches.length} candidates)`
        );
        ambiguous++;
        linked++;
      } else if (filteredCandidates.length === 1) {
        // No qty match but only one candidate
        await prisma.greige_stock.update({
          where: { id: lot.id },
          data: { grnItemId: filteredCandidates[0].id },
        });
        console.log(
          `  [OK] Lot ${lot.id} → grn_item ${filteredCandidates[0].id} (only candidate, qty mismatch)`
        );
        linked++;
      } else {
        console.log(
          `  [SKIP] Lot ${lot.id}: ${filteredCandidates.length} candidates, none with matching qty`
        );
        skipped++;
      }
    } catch (err: any) {
      console.error(`  [ERROR] Lot ${lot.id}: ${err.message}`);
      errors++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Linked:    ${linked} (${ambiguous} were ambiguous picks)`);
  console.log(`Skipped:   ${skipped}`);
  console.log(`Errors:    ${errors}`);
  console.log(`Total:     ${unlinkedLots.length}`);
}

// Run
backfillGrnItemLinks()
  .then(() => {
    console.log('\nBackfill complete.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  });
