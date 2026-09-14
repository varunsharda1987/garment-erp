/**
 * Give every style that has a Primary Color the colourway row the rest of the system reads,
 * and point existing sale-order lines at it.
 *
 * Why (2026-09-14): `styles.colorId` (the Style form's "Primary Color", also written by the House
 * of Kasya B2B app) was never mirrored into `color_options`, so that table was empty for all 1,130
 * styles — the Sale Order colour dropdown had nothing to show, finished-goods stock could not
 * exist at all, and the B2B app had to park the colour name in the line's remarks as
 * "Colour: Ivory". Going forward `services/helpers/style-colour.helper.ts` keeps the two in step;
 * this script fixes what already exists.
 *
 *   cd backend && npx ts-node scripts/backfill-style-colourways.ts            # dry run
 *   cd backend && npx ts-node scripts/backfill-style-colourways.ts --apply
 *
 * Idempotent — a second run reports zero changes. Imports only the Prisma client and the helper:
 * pulling the service layer into a one-off script kills it silently under ts-node (2026-09-13).
 */

import 'dotenv/config';
import prisma from '../src/config/database';
import { syncStyleColourway } from '../src/services/helpers/style-colour.helper';

const APPLY = process.argv.includes('--apply');
const out = (line: string) => process.stdout.write(`${line}\n`);

async function main() {
  // ---------------------------------------------------------------- styles → colourways
  const styles = await prisma.styles.findMany({
    where: { NOT: { colorId: null } },
    select: {
      id: true,
      styleCode: true,
      colorId: true,
      color: { select: { colorName: true } },
      color_options: { select: { id: true, colorMasterId: true } },
    },
    orderBy: { styleCode: 'asc' },
  });

  const needColourway = styles.filter((s) => !s.color_options.some((c) => c.colorMasterId === s.colorId));

  out(`Styles carrying a Primary Color: ${styles.length}`);
  out(`  already have the matching colourway: ${styles.length - needColourway.length}`);
  out(`  to create:                          ${needColourway.length}`);
  for (const s of needColourway) out(`     ${s.styleCode} → ${s.color?.colorName ?? '?'}`);

  if (APPLY) {
    for (const s of needColourway) {
      await syncStyleColourway(prisma, s.id, s.colorId);
    }
  }

  // ---------------------------------------------------------- sale-order lines → that colourway
  // Only lines with no colour, on a style that (after the step above) has exactly ONE colourway —
  // with several, which one the line meant is a guess, and guessing is worse than leaving it blank.
  const styleColourways = new Map<string, { id: string; colorName: string }>();
  const colourways = await prisma.color_options.findMany({
    select: { id: true, styleId: true, colorName: true },
  });
  const perStyle = new Map<string, number>();
  for (const c of colourways) perStyle.set(c.styleId, (perStyle.get(c.styleId) ?? 0) + 1);
  for (const c of colourways) {
    if (perStyle.get(c.styleId) === 1) styleColourways.set(c.styleId, { id: c.id, colorName: c.colorName });
  }
  // In dry-run the rows above do not exist yet, so predict what the apply step would produce.
  if (!APPLY) {
    for (const s of needColourway) {
      if ((perStyle.get(s.id) ?? 0) === 0 && s.color?.colorName) {
        styleColourways.set(s.id, { id: '(to be created)', colorName: s.color.colorName });
      }
    }
  }

  const lines = await prisma.sale_order_items.findMany({
    where: { colorId: null },
    select: {
      id: true,
      saleOrderId: true,
      styleId: true,
      sizeId: true,
      remarks: true,
      saleOrder: { select: { saleOrderNumber: true } },
    },
  });

  const candidates = lines.filter((l) => styleColourways.has(l.styleId));

  // sale_order_items is unique on (saleOrderId, styleId, colorId, sizeId). Postgres treats NULLs as
  // distinct, so two colour-less rows on the same order+style+size coexist today and would collide
  // the moment both are given the same colour. Skip those pairs rather than fail the run.
  const byKey = new Map<string, typeof candidates>();
  for (const l of candidates) {
    const key = `${l.saleOrderId}|${l.styleId}|${l.sizeId ?? ''}`;
    byKey.set(key, [...(byKey.get(key) ?? []), l]);
  }
  const safe = [...byKey.values()].filter((g) => g.length === 1).flat();
  const collisions = [...byKey.values()].filter((g) => g.length > 1);

  out('');
  out(`Sale-order lines with no colour: ${lines.length}`);
  out(`  on a style with exactly one colourway: ${candidates.length}`);
  out(`  safe to set:                           ${safe.length}`);
  out(`  skipped (would collide on the unique index): ${collisions.reduce((n, g) => n + g.length, 0)}`);
  for (const g of collisions) {
    out(`     ${g[0].saleOrder?.saleOrderNumber} — ${g.length} lines share style+size with no colour`);
  }

  // The B2B app writes exactly "Colour: <name>" when it cannot resolve a colorId. Once the line
  // carries the real colour that note is duplicate text; anything else the user typed stays.
  const remarkClears = safe.filter(
    (l) => l.remarks && l.remarks.trim() === `Colour: ${styleColourways.get(l.styleId)!.colorName}`
  );
  out(`  of those, redundant "Colour: …" remarks to clear: ${remarkClears.length}`);

  if (!APPLY) {
    out('\nDry run — re-run with --apply to write.');
    return;
  }

  // Re-read the colourways now that they exist, so the ids are real.
  const finalColourways = await prisma.color_options.findMany({ select: { id: true, styleId: true } });
  const finalByStyle = new Map<string, string[]>();
  for (const c of finalColourways) finalByStyle.set(c.styleId, [...(finalByStyle.get(c.styleId) ?? []), c.id]);

  let linesSet = 0;
  let remarksCleared = 0;
  for (const l of safe) {
    const ids = finalByStyle.get(l.styleId) ?? [];
    if (ids.length !== 1) continue;
    const clearRemark = remarkClears.some((r) => r.id === l.id);
    await prisma.sale_order_items.update({
      where: { id: l.id },
      data: { colorId: ids[0], ...(clearRemark ? { remarks: null } : {}) },
    });
    linesSet++;
    if (clearRemark) remarksCleared++;
  }

  out(
    `\nDone. ${needColourway.length} colourway(s) created, ${linesSet} sale-order line(s) coloured, ` +
      `${remarksCleared} redundant remark(s) cleared.`
  );
}

main()
  .catch((err) => {
    out(`FAILED: ${err instanceof Error ? err.stack : String(err)}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
