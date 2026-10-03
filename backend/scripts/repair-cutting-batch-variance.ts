/**
 * Completed cutting batches: record "short on return" and compare each fabric with its own CAD average (2026-10-03).
 *
 * Until today completion stored:
 *  - `wastageMeters` = issued − consumption, which is the RETURN, not waste — CB-WO2609-0087-002 read 0 with
 *    77.88 m that the lays left and never came back, CB-WO2609-0088-003 0 with 120.01 m;
 *  - `variancePercent` against the FIRST fabric's CAD average while the actual average adds every fabric up
 *    (wrong on any batch with two fabrics);
 *  - `fabric_stock_allocation.actualCad` = that all-fabric figure on every lot.
 * This re-reads each completed batch through the one rule (cutting.utils `completedBatchVariance`) and writes the
 * shortfall per lot (`returnShortQty`; the reason stays empty — "Reason not recorded"), the batch's wastage and
 * variance, and each allocation's actualCad. Batches with no lays recorded have no shortfall (nothing to measure).
 *
 *   npx ts-node --files scripts/repair-cutting-batch-variance.ts           (dry run — the invariant sweep: 0 batches)
 *   npx ts-node --files scripts/repair-cutting-batch-variance.ts --apply   (writes; snapshot for undo)
 */

import fs from 'fs';
import path from 'path';
import prisma from '../src/config/database';
import { completedBatchVariance, splitShortByLot } from '../src/controllers/cutting.utils';

const APPLY = process.argv.includes('--apply');
const SNAPSHOT = path.join(__dirname, `repair-cutting-batch-variance-snapshot-${Date.now()}.json`);
const differs = (a: number | null, b: number | null, tol: number) =>
  (a == null) !== (b == null) || (a != null && b != null && Math.abs(a - b) > tol);

async function main() {
  const batches = await prisma.cutting_batches.findMany({
    where: { status: 'COMPLETED' },
    select: {
      id: true,
      batchNumber: true,
      actualAverage: true,
      varianceFromCad: true,
      variancePercent: true,
      wastageMeters: true,
      wastagePercent: true,
      fabricIssued: true,
      skuOutputs: { select: { cutQty: true } },
      additionalFabrics: {
        select: {
          id: true,
          fabricStockId: true,
          cadAvgUsed: true,
          fabricIssued: true,
          fabricReturned: true,
          fabricConsumed: true,
          returnShortQty: true,
          returnShortReason: true,
          returnShortNote: true,
          fabricStock: { select: { fabricId: true, fabricMaster: { select: { fabricName: true } } } },
        },
      },
    },
    orderBy: { completedAt: 'asc' },
  });

  const snapshot: unknown[] = [];
  let changed = 0;
  for (const b of batches) {
    if (b.additionalFabrics.length === 0) continue;
    const v = completedBatchVariance(b);
    const actual = b.actualAverage != null ? Number(b.actualAverage) : null;
    const issued = Number(b.fabricIssued) || 0;
    const cad = v.perGarment.cadAverage;
    const varianceFromCad = actual != null && cad ? Math.round((actual - cad) * 10000) / 10000 : null;
    const variancePercent = varianceFromCad != null && cad ? Math.round((varianceFromCad / cad) * 10000) / 100 : null;
    const wastageMeters = issued > 0 ? v.perGarment.shortQty : null;
    const wastagePercent =
      issued > 0 && wastageMeters != null ? Math.round((wastageMeters / issued) * 10000) / 100 : null;

    const lotShort = new Map<string, number>();
    const actualByLot = new Map<string, number | null>();
    for (const f of v.fabrics) {
      const issuedByLot = new Map(
        b.additionalFabrics
          .filter((bf) => f.lotIds.includes(bf.fabricStockId))
          .map((bf) => [bf.fabricStockId, Number(bf.fabricIssued) || 0])
      );
      for (const [lotId, q] of splitShortByLot(f, issuedByLot)) lotShort.set(lotId, q);
      for (const lotId of f.lotIds) actualByLot.set(lotId, f.actualAverage);
    }
    const lotChanges = b.additionalFabrics.filter((bf) =>
      differs(
        bf.returnShortQty != null ? Number(bf.returnShortQty) : null,
        lotShort.get(bf.fabricStockId) || null,
        0.005
      )
    );
    const batchChanges =
      differs(b.varianceFromCad != null ? Number(b.varianceFromCad) : null, varianceFromCad, 0.0005) ||
      differs(b.variancePercent != null ? Number(b.variancePercent) : null, variancePercent, 0.05) ||
      differs(b.wastageMeters != null ? Number(b.wastageMeters) : null, wastageMeters, 0.005);
    if (!batchChanges && lotChanges.length === 0) continue;
    changed++;

    console.log(
      `${b.batchNumber}: variance ${b.variancePercent ?? '—'}% → ${variancePercent ?? '—'}% ` +
        `(CAD per garment ${cad ?? '—'} m), wastage ${b.wastageMeters ?? '—'} → ${wastageMeters ?? '—'} m; ` +
        v.fabrics
          .map((f) => `${f.fabricName}: short ${f.shortQty} m, actual ${f.actualAverage} vs CAD ${f.cadAverage}`)
          .join('; ')
    );
    snapshot.push({
      batchId: b.id,
      batchNumber: b.batchNumber,
      before: {
        varianceFromCad: b.varianceFromCad,
        variancePercent: b.variancePercent,
        wastageMeters: b.wastageMeters,
        wastagePercent: b.wastagePercent,
        lots: b.additionalFabrics.map((bf) => ({ id: bf.id, returnShortQty: bf.returnShortQty })),
      },
    });

    if (APPLY) {
      await prisma.$transaction(async (tx) => {
        await tx.cutting_batches.update({
          where: { id: b.id },
          data: { varianceFromCad, variancePercent, wastageMeters, wastagePercent },
        });
        for (const bf of b.additionalFabrics) {
          const short = lotShort.get(bf.fabricStockId) || 0;
          await tx.cutting_batch_fabrics.update({
            where: { id: bf.id },
            data: { returnShortQty: short >= 0.005 ? short : null },
          });
          const lotActual = actualByLot.get(bf.fabricStockId);
          if (lotActual != null) {
            await tx.fabric_stock_allocation.updateMany({
              where: { cuttingBatchId: b.id, stockId: bf.fabricStockId },
              data: { actualCad: lotActual },
            });
          }
        }
      });
    }
  }

  console.log(`\n${changed} completed batch(es) ${APPLY ? 'repaired' : 'to repair'} of ${batches.length}.`);
  if (APPLY && snapshot.length > 0) {
    fs.writeFileSync(SNAPSHOT, JSON.stringify(snapshot, null, 2));
    console.log(`Snapshot: ${SNAPSHOT}`);
  } else if (!APPLY && changed > 0) {
    console.log('Dry run — nothing written. Re-run with --apply to write.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
