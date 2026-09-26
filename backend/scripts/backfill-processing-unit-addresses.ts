/**
 * Give every processor's "… - Processing Unit" the processor's address (direct-to-processor plan,
 * Phase 3, 2026-09-26). A PO that ships goods straight to a dyer prints the unit as the ship-to, and none
 * of the dyeing units had an address. New and edited suppliers now sync it themselves
 * (helpers/processing-unit-address.helper.ts); this does it once for the units that exist.
 *
 * Only a unit whose WHOLE address block (address, city, state, pincode) is blank is written, with the
 * processor's shipping address, else its billing address. A unit with any address typed is left alone.
 *
 *   npx ts-node scripts/backfill-processing-unit-addresses.ts            # preview (default) — writes nothing
 *   npx ts-node scripts/backfill-processing-unit-addresses.ts --apply    # writes; saves a snapshot first
 *
 * Data change: needs the owner's OK before --apply.
 */
import { writeFileSync } from 'fs';
import { join } from 'path';
import prisma from '../src/config/database';
import {
  planProcessingUnitAddress,
  syncProcessingUnitAddress,
  unitAddressBlank,
} from '../src/services/helpers/processing-unit-address.helper';

const APPLY = process.argv.includes('--apply');

async function main() {
  const units = await prisma.warehouses.findMany({
    where: { warehouseType: 'JOB_WORK' },
    select: {
      id: true,
      warehouseName: true,
      supplierId: true,
      address: true,
      city: true,
      state: true,
      pincode: true,
      isActive: true,
    },
    orderBy: { warehouseName: 'asc' },
  });
  const blank = units.filter(unitAddressBlank);
  console.log(`${units.length} processing units; ${blank.length} with no address at all.\n`);

  const supplierIds = [...new Set(blank.map((u) => u.supplierId).filter((id): id is string => !!id))];
  const plans = (await Promise.all(supplierIds.map((id) => planProcessingUnitAddress(prisma, id)))).flat();
  const planned = new Set(plans.map((p) => p.warehouseId));

  for (const p of plans) {
    const a = p.address;
    console.log(`  WRITE  ${p.warehouseName}\n         ${[a.address, a.city, a.state, a.pincode].filter(Boolean).join(', ')}`);
  }
  for (const u of blank.filter((x) => !planned.has(x.id))) {
    console.log(`  SKIP   ${u.warehouseName} — ${u.supplierId ? 'the processor has no address on file' : 'not linked to a processor'}`);
  }
  console.log(`\n${plans.length} unit(s) would get an address; ${blank.length - plans.length} stay blank.`);

  if (!APPLY) {
    console.log('Preview only — nothing written. Re-run with --apply once the owner agrees.');
    return;
  }
  const snapshot = join(__dirname, 'backfill-processing-unit-addresses-snapshot.json');
  writeFileSync(snapshot, JSON.stringify({ takenAt: new Date().toISOString(), units: blank }, null, 2));
  console.log(`Snapshot of the blank units saved to ${snapshot}`);
  let written = 0;
  for (const id of supplierIds) written += (await syncProcessingUnitAddress(prisma, id)).length;
  console.log(`Wrote ${written} unit address(es).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
