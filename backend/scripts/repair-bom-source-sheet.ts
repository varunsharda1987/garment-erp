/**
 * One-off backfill: record the source cost sheet on live order BOMs that never stored it
 * (2026-09-24).
 *
 * The revoke/edit/delete guards on a cost sheet find the orders using it through
 * order_bom.sourceCostSheetId. Eight live BOMs built 25-29 Aug 2026 carry NULL there, so the
 * guard saw no order and ESSKY085LS's and ESSKY086LS's approved sheets were revoked on 24-Sep
 * under approved BOMs. This links each such BOM to its style's ONE current (not superseded) cost
 * sheet; a style with none or several is reported and left alone.
 *
 * It records lineage only — no price, quantity or status changes.
 *
 *   npx ts-node scripts/repair-bom-source-sheet.ts            (dry-run)
 *   npx ts-node scripts/repair-bom-source-sheet.ts --apply
 */

import fs from 'fs';
import path from 'path';
import prisma from '../src/config/database';

const APPLY = process.argv.includes('--apply');
const SNAPSHOT = path.join(__dirname, 'repair-bom-source-sheet-snapshot.json');

async function main() {
  const boms = await prisma.order_bom.findMany({
    where: { isActive: true, sourceCostSheetId: null },
    select: {
      id: true,
      status: true,
      createdAt: true,
      styleId: true,
      order: { select: { orderNumber: true } },
      style: { select: { styleCode: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const plan: Array<{ orderBomId: string; orderNumber: string; styleCode: string; sheetId: string | null; note: string }> =
    [];
  for (const b of boms) {
    const current = await prisma.style_costing.findMany({
      where: { styleId: b.styleId, supersededById: null },
      select: { id: true, approvalStatus: true, createdAt: true },
    });
    const earlier = current.filter((s) => s.createdAt <= b.createdAt);
    const pick = earlier.length === 1 ? earlier[0] : null;
    plan.push({
      orderBomId: b.id,
      orderNumber: b.order.orderNumber,
      styleCode: b.style.styleCode,
      sheetId: pick?.id ?? null,
      note: pick
        ? `sheet now ${String(pick.approvalStatus)}`
        : `SKIP — ${earlier.length} current sheet(s) predate the BOM`,
    });
  }

  for (const p of plan) {
    console.log(`  ${p.orderNumber.padEnd(14)} ${p.styleCode.padEnd(11)} → ${p.sheetId ?? '—'}  (${p.note})`);
  }
  const toLink = plan.filter((p) => p.sheetId);
  console.log(`\n${toLink.length} of ${plan.length} BOM(s) to link.`);
  if (!APPLY) {
    console.log('Dry run. Re-run with --apply to write.');
    return;
  }
  if (toLink.length === 0) return;

  fs.writeFileSync(SNAPSHOT, JSON.stringify({ takenAt: new Date().toISOString(), plan }, null, 2));
  await prisma.$transaction(
    toLink.map((p) =>
      prisma.order_bom.update({ where: { id: p.orderBomId }, data: { sourceCostSheetId: p.sheetId } })
    )
  );
  console.log(`Linked ${toLink.length}. Snapshot: ${SNAPSHOT}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
