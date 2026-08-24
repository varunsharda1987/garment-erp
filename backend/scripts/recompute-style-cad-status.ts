/**
 * Recompute styles.cadStatus from CAD rows (landmine №3 backfill).
 *
 * styles.cadStatus is DERIVED via services/helpers/cad-status.helper.ts since 2026-08-24.
 * This one-time backfill applies the derivation to every style that HAS CAD rows.
 *
 * Styles with ZERO CAD rows are deliberately left untouched and only reported: their
 * stamps predate the row-level CAD system (legacy LNG/DRE/COS lines), there is nothing
 * to derive from, and flipping them would add production-dashboard blockers to old
 * styles for no data-integrity gain — the dangerous bypass (cost-sheet gate) is closed
 * in code regardless of the stamp.
 *
 *   npx ts-node scripts/recompute-style-cad-status.ts           # dry-run (default)
 *   npx ts-node scripts/recompute-style-cad-status.ts --apply   # write
 */

import 'dotenv/config';
import prisma from '../src/config/database';
import { cadRowsOfStyle, deriveCadStatus, recomputeStyleCadStatus } from '../src/services/helpers/cad-status.helper';

const APPLY = process.argv.includes('--apply');

async function main() {
  const styles = await prisma.styles.findMany({
    where: { isActive: true },
    select: { id: true, styleCode: true, cadStatus: true },
  });

  let flips = 0;
  const legacyStamps: string[] = [];

  for (const style of styles) {
    const where = cadRowsOfStyle(style.id);
    const [totalRows, approvedRows] = await Promise.all([
      prisma.fabric_width_cad.count({ where }),
      prisma.fabric_width_cad.count({ where: { ...where, approvalStatus: 'APPROVED' } }),
    ]);

    if (totalRows === 0) {
      if (style.cadStatus === 'APPROVED') legacyStamps.push(style.styleCode);
      continue; // nothing to derive from — legacy stamp preserved (see header)
    }

    const derived = deriveCadStatus(totalRows, approvedRows);
    if (derived !== style.cadStatus) {
      flips += 1;
      console.log(`  ${style.styleCode}: ${style.cadStatus} -> ${derived} (approved rows ${approvedRows}/${totalRows})`);
      if (APPLY) {
        await recomputeStyleCadStatus(prisma, style.id);
      }
    }
  }

  console.log(`\nStyles checked: ${styles.length}; flips: ${flips}`);
  console.log(
    `Legacy APPROVED stamps with zero CAD rows (preserved, backfill CAD data when next used): ${legacyStamps.length}`
  );
  if (legacyStamps.length > 0) console.log(`  ${legacyStamps.join(', ')}`);
  console.log(APPLY ? 'Applied.' : 'Dry run — pass --apply to write.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
