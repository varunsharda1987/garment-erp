/**
 * Give blank-coloured sale-order lines their style's only colour (2026-10-03).
 *
 * Until the line dialog preselected the style's colour (by 22-Sep), a line could be saved with no
 * colour; 12 sale orders of 14–22 Sep (67 lines) were, every one on a style with exactly ONE colour.
 * The Sale Order page shows the style's colour for them (ee810724), so nobody could see it, and
 * Start Production / Link / dispatch settle it by the colour rule (sku-colour.helper). Amend Quantities
 * did not: SO2609-0382's amendment called ORD2026090132 "re-sized by hand" and left its run on the old
 * sizes. This writes the colour those lines already mean — a style with ONE colour only; lines on a
 * style with no colour (colour is optional) or several are left alone.
 *
 * A line is skipped, and listed, when the same order already has a line of that style + colour + size
 * (the unique key would collide — that pair needs a person).
 *
 *   npx ts-node --files scripts/repair-blank-sale-order-colours.ts           (dry run — the invariant sweep: 0 lines)
 *   npx ts-node --files scripts/repair-blank-sale-order-colours.ts --apply   (writes; snapshot for undo)
 */

import fs from 'fs';
import path from 'path';
import prisma from '../src/config/database';

const APPLY = process.argv.includes('--apply');
const SNAPSHOT = path.join(__dirname, `repair-blank-sale-order-colours-snapshot-${Date.now()}.json`);

async function main() {
  const lines = await prisma.sale_order_items.findMany({
    where: { colorId: null },
    select: {
      id: true,
      saleOrderId: true,
      styleId: true,
      sizeId: true,
      saleOrder: { select: { saleOrderNumber: true } },
      style: { select: { styleCode: true, color_options: { select: { id: true, colorName: true } } } },
      size: { select: { sizeName: true } },
    },
    orderBy: [{ saleOrderId: 'asc' }, { id: 'asc' }],
  });

  const fixes: Array<{ id: string; saleOrderNumber: string; style: string; size: string; colorId: string; colour: string }> = [];
  const collisions: string[] = [];
  let noColour = 0;
  let several = 0;

  for (const l of lines) {
    const colours = l.style.color_options;
    if (colours.length === 0) {
      noColour++;
      continue;
    }
    if (colours.length > 1) {
      several++;
      continue;
    }
    const [only] = colours;
    const label = `${l.saleOrder.saleOrderNumber} ${l.style.styleCode} ${l.size?.sizeName ?? '(no size)'}`;
    const sibling = await prisma.sale_order_items.findFirst({
      where: { saleOrderId: l.saleOrderId, styleId: l.styleId, sizeId: l.sizeId, colorId: only.id },
      select: { id: true },
    });
    if (sibling) {
      collisions.push(`${label}: already has a ${only.colorName} line`);
      continue;
    }
    fixes.push({
      id: l.id,
      saleOrderNumber: l.saleOrder.saleOrderNumber,
      style: l.style.styleCode,
      size: l.size?.sizeName ?? '(no size)',
      colorId: only.id,
      colour: only.colorName,
    });
  }

  const byOrder = new Map<string, typeof fixes>();
  for (const f of fixes) byOrder.set(f.saleOrderNumber, [...(byOrder.get(f.saleOrderNumber) ?? []), f]);
  for (const [so, fs_] of byOrder) {
    console.log(`${so}: ${fs_.length} line(s) → ${[...new Set(fs_.map((f) => `${f.style} ${f.colour}`))].join(', ')}`);
  }
  console.log(
    `\n${fixes.length} line(s) on ${byOrder.size} sale order(s) take their style's only colour. ` +
      `Left blank: ${noColour} on styles with no colour, ${several} on styles with several.`
  );
  if (collisions.length > 0) console.log(`Skipped (need a person):\n  ${collisions.join('\n  ')}`);

  if (!APPLY) {
    console.log('\nDry run — nothing written. Re-run with --apply.');
    return;
  }
  if (fixes.length === 0) return;

  fs.writeFileSync(SNAPSHOT, JSON.stringify(fixes.map((f) => ({ id: f.id, colorId: null })), null, 2));
  await prisma.$transaction(async (tx) => {
    for (const f of fixes) {
      // Guarded: only a line that is still blank
      const res = await tx.sale_order_items.updateMany({ where: { id: f.id, colorId: null }, data: { colorId: f.colorId } });
      if (res.count !== 1) throw new Error(`${f.saleOrderNumber} ${f.style} ${f.size} changed meanwhile — nothing written`);
    }
  });
  console.log(`\nWritten. Undo snapshot (every line's colour before): ${SNAPSHOT}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
