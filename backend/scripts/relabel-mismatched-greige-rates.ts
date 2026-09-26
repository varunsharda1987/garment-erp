/**
 * One-off repair (owner decision 2026-09-26): relabel saved greige rates whose label names a purchase
 * that does not carry them. Rates, approvals and cost sheets are NOT touched — only the label.
 *
 * Until 2026-09-26 CAD Planning stamped "PROCUREMENT · <purchase date>" when it seeded a row, and the
 * Fabric Costing save then wrote whatever rate the user typed WITHOUT touching that label. So a typed
 * ₹65 read as "the 25-Jan purchase" (₹58.5). check-order-system-integrity D19 found 28 such rows.
 * These rates were typed by hand; they become MANUAL_OVERRIDE with a reason recording what the label
 * used to claim. Who typed them is unknown, so greigeRateSetById stays null.
 *
 * IP00138 / IT00254's three rows are skipped: they are moved to GRG-0072 and re-costed at the PO rate.
 *
 *   npx ts-node scripts/relabel-mismatched-greige-rates.ts            (dry-run: prints the list)
 *   npx ts-node scripts/relabel-mismatched-greige-rates.ts --apply    (snapshot + one transaction)
 */

import fs from 'fs';
import path from 'path';
import prisma from '../src/config/database';
import { formatDate } from '../src/utils/date';

const APPLY = process.argv.includes('--apply');
const SNAPSHOT = path.join(__dirname, 'relabel-mismatched-greige-rates-snapshot.json');
const RELABELLED_ON = '26-Sep-2026';

// Re-costed on GRG-0072 instead (IP00138 d53ad051; IT00254 20c3dd0f, 4a5d0131)
const SKIP = new Set([
  'd53ad051-afc8-4728-a7d9-022007c14f51',
  '20c3dd0f-9de7-428f-9c25-79a933b5af62',
  '4a5d0131-e03d-4e65-b127-b11ccfbd2790',
]);

async function main() {
  // Exactly the D19 rule (PROCUREMENT side — no row carries PURCHASE_ORDER yet)
  const rows = await prisma.fabric_width_cad.findMany({
    where: { greigeRateSource: 'PROCUREMENT', greigeCostPerMeter: { not: null } },
    select: {
      id: true,
      purpose: true,
      greigeId: true,
      greigeCostPerMeter: true,
      greigeRateSource: true,
      greigeRateSourceDate: true,
      greigeRateSourceRef: true,
      greigeRateManualOverride: true,
      greigeRateOverrideReason: true,
      greigeRateSetById: true,
      costingApprovalStatus: true,
      costingStyleId: true,
      styleFabric: { select: { style_components: { select: { styles: { select: { styleCode: true } } } } } },
    },
  });
  const greigeIds = [...new Set(rows.map((r) => r.greigeId).filter((g): g is string => !!g))];
  const purchases = await prisma.fabric_procurement.findMany({
    where: { greigeId: { in: greigeIds } },
    select: { greigeId: true, ratePerUnit: true, purchaseDate: true },
  });
  const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

  const mislabelled = rows
    .filter((r) => !SKIP.has(r.id))
    .map((r) => {
      const cited = purchases.filter(
        (p) => p.greigeId === r.greigeId && day(p.purchaseDate) === day(r.greigeRateSourceDate)
      );
      const matches = cited.some((p) => Math.abs(Number(p.ratePerUnit) - Number(r.greigeCostPerMeter)) < 0.005);
      return { row: r, cited, matches };
    })
    .filter((x) => !x.matches);

  console.log(`\n${APPLY ? 'APPLY' : 'DRY RUN'} — ${mislabelled.length} greige rate label(s) to correct\n`);
  for (const { row, cited } of mislabelled) {
    const style = row.styleFabric?.style_components?.styles?.styleCode ?? `costing style ${row.costingStyleId}`;
    const claimed = cited.map((p) => `₹${Number(p.ratePerUnit)}`).join(' / ') || 'no purchase that day';
    console.log(
      `  ${style.padEnd(12)} ${String(row.purpose).padEnd(24)} saved ₹${Number(row.greigeCostPerMeter)}  ` +
        `label said ${formatDate(row.greigeRateSourceDate)} purchase at ${claimed}  price ${row.costingApprovalStatus ?? '-'}  (${row.id})`
    );
  }
  if (!APPLY || mislabelled.length === 0) {
    if (!APPLY) console.log('\nDry run. Re-run with --apply to relabel them (rates and approvals untouched).');
    return;
  }

  fs.writeFileSync(
    SNAPSHOT,
    JSON.stringify({ takenAt: new Date().toISOString(), rows: mislabelled.map((m) => m.row) }, null, 2)
  );
  console.log(`\nSnapshot written: ${SNAPSHOT}`);

  await prisma.$transaction(
    mislabelled.map(({ row, cited }) =>
      prisma.fabric_width_cad.update({
        where: { id: row.id },
        data: {
          greigeRateSource: 'MANUAL_OVERRIDE',
          greigeRateManualOverride: row.greigeCostPerMeter,
          greigeRateSourceDate: null,
          greigeRateSourceRef: null,
          greigeRateOverrideReason:
            `Relabelled ${RELABELLED_ON}: saved ₹${Number(row.greigeCostPerMeter)} while labelled as the ` +
            `${formatDate(row.greigeRateSourceDate)} purchase at ` +
            `${cited.map((p) => `₹${Number(p.ratePerUnit)}`).join(' / ') || '(none that day)'}`,
        },
      })
    )
  );
  console.log(`Relabelled ${mislabelled.length} row(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
