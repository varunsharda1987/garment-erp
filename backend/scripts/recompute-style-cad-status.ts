/**
 * Recompute styles.cadStatus from CAD rows (landmine №3 backfill).
 *
 * styles.cadStatus is DERIVED via services/helpers/cad-status.helper.ts since 2026-08-24.
 * This backfill applies the derivation to EVERY active style, including styles with
 * zero CAD rows (owner decision 2026-08-24: legacy row-less "APPROVED" stamps flip to
 * PENDING — honest state everywhere; those styles regain the badge the moment real CAD
 * rows are created and approved). Idempotent — safe to re-run.
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

  for (const style of styles) {
    const where = cadRowsOfStyle(style.id);
    const [totalRows, approvedRows] = await Promise.all([
      prisma.fabric_width_cad.count({ where }),
      prisma.fabric_width_cad.count({ where: { ...where, approvalStatus: 'APPROVED' } }),
    ]);

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
  console.log(APPLY ? 'Applied.' : 'Dry run — pass --apply to write.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
