/**
 * Book the greige a Stock-Out parked at a processor into stock_levels at that processor's unit
 * (direct-to-processor plan, Phase 4e, 2026-09-26).
 *
 * Until 4e a Stock-Out challan to a processor took the metres off the store lot and the store's
 * stock_levels, and parked them on a TRANSFER lot at the processor's unit that was kept OFF the
 * ledger — so the goods vanished from every stock total while the processor held them. 4e puts every
 * greige lot in a warehouse on the ledger (migration 20260926163000 recreates derived_stock_view;
 * issuing a Stock-Out now credits the unit). The lots parked BEFORE 4e still have nothing booked at
 * their unit; this adds exactly that.
 *
 * Per (material, unit) holding a TRANSFER lot with metres on it:
 *   target  = every greige lot of that material in that unit (what the view now counts)
 *   booked  = stock_levels at that unit (0 when there is no row)
 *   gap     = target − booked
 * It writes only when the gap equals the TRANSFER lots' metres there (within dust) — the exact hole
 * the old rule left. Anything else is a different drift: reported, never guessed at. Idempotent: a
 * second run finds no gap.
 *
 * Live case: GRG-0006, 500 m at Manish Textiles - Processing Unit (WH-JW-0006), CH2607-0001.
 *
 *   npx ts-node scripts/backfill-transfer-lots-on-hand.ts           # dry run (default)
 *   npx ts-node scripts/backfill-transfer-lots-on-hand.ts --apply   # write (owner's OK first)
 */

import 'dotenv/config';
import { writeFileSync } from 'fs';
import { join } from 'path';
import prisma from '../src/config/database';
import { ensureMaterialRecord, syncStockLevelQuantity } from '../src/services/helpers/material-sync.helper';
import { isQtyZero } from '../src/utils/quantity';

const APPLY = process.argv.includes('--apply');

type Row = {
  greigeCode: string;
  materialId: string;
  warehouseId: string;
  warehouseName: string;
  transferQty: number;
  challans: string[];
  target: number;
  booked: number;
  gap: number;
  action: 'BOOK' | 'NONE' | 'SKIP_OTHER_DRIFT';
};

async function main() {
  console.log(`=== Stock-Out lots at processors → stock_levels (${APPLY ? 'APPLY' : 'DRY RUN'}) ===\n`);

  const transferLots = await prisma.greige_stock.findMany({
    where: { sourceType: 'TRANSFER', warehouseId: { not: null }, quantityAvailable: { gt: 0 } },
    select: {
      greigeId: true,
      warehouseId: true,
      quantityAvailable: true,
      greige: { select: { greigeCode: true } },
      warehouse: { select: { warehouseName: true } },
      sourceChallan: { select: { challanNumber: true } },
    },
  });

  const groups = new Map<string, typeof transferLots>();
  for (const lot of transferLots) {
    const key = `${lot.greigeId}|${lot.warehouseId}`;
    groups.set(key, [...(groups.get(key) ?? []), lot]);
  }

  const rows: Row[] = [];
  for (const lots of groups.values()) {
    const { greigeId, warehouseId } = lots[0];
    const materialId = await ensureMaterialRecord(greigeId, 'GREIGE');
    const transferQty = lots.reduce((sum, l) => sum + Number(l.quantityAvailable), 0);
    const all = await prisma.greige_stock.aggregate({
      where: { greigeId, warehouseId: warehouseId! },
      _sum: { quantityAvailable: true },
    });
    const target = Number(all._sum.quantityAvailable ?? 0);
    const level = await prisma.stock_levels.findFirst({ where: { materialId, warehouseId: warehouseId! } });
    const booked = Number(level?.quantity ?? 0);
    const gap = Math.round((target - booked) * 1000) / 1000;
    rows.push({
      greigeCode: lots[0].greige.greigeCode,
      materialId,
      warehouseId: warehouseId!,
      warehouseName: lots[0].warehouse?.warehouseName ?? warehouseId!,
      transferQty,
      challans: [...new Set(lots.map((l) => l.sourceChallan?.challanNumber ?? '(no challan)'))],
      target,
      booked,
      gap,
      action: isQtyZero(gap) ? 'NONE' : isQtyZero(gap - transferQty) ? 'BOOK' : 'SKIP_OTHER_DRIFT',
    });
  }

  if (rows.length === 0) console.log('No Stock-Out lot with metres on it at any processor — nothing to do.');
  for (const r of rows) {
    console.log(
      `${r.greigeCode} at ${r.warehouseName} (${r.challans.join(', ')}): Stock-Out lots ${r.transferQty} m; ` +
        `lots there ${r.target} m, stock_levels ${r.booked} m, gap ${r.gap} m → ${r.action}`
    );
  }

  const toBook = rows.filter((r) => r.action === 'BOOK');
  const skipped = rows.filter((r) => r.action === 'SKIP_OTHER_DRIFT');
  if (skipped.length) {
    console.log(`\n${skipped.length} left alone: the gap is not the Stock-Out metres — a different drift, check by hand.`);
  }

  if (APPLY && toBook.length > 0) {
    const snapshot = join(__dirname, 'backfill-transfer-lots-on-hand-snapshot.json');
    writeFileSync(snapshot, JSON.stringify({ takenAt: new Date().toISOString(), rows }, null, 2));
    console.log(`\nSnapshot (before): ${snapshot}`);
    await prisma.$transaction(async (tx) => {
      for (const r of toBook) {
        await syncStockLevelQuantity(r.materialId, r.gap, r.warehouseId, 'METER', tx);
      }
    });
    for (const r of toBook) {
      const after = await prisma.stock_levels.findFirst({ where: { materialId: r.materialId, warehouseId: r.warehouseId } });
      console.log(`Booked +${r.gap} m of ${r.greigeCode} at ${r.warehouseName} → stock_levels ${Number(after?.quantity ?? 0)} m`);
    }
  } else if (toBook.length > 0) {
    console.log(`\nDry run: ${toBook.length} row(s) would be booked. Re-run with --apply to write.`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
