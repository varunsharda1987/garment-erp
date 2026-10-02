/**
 * Save the OLD default sample rules for customers that relied on them (2026-10-02).
 *
 * Until 2026-10-02 a customer with NO sample requirements saved was treated as FIT + Size Set required
 * and blocking (resolveCustomerGates) and had FIT + PP + Size Set auto-created on every order — while
 * the customer screen showed every box un-ticked. The rule is now "no row = not required" (owner). So
 * a customer already trading under the old default does not silently lose its sample gate, this writes
 * that default as real rows — FIT, PP and Size Set Required + Blocks Production — for every ACTIVE
 * customer with no rows and at least one order or sample. The screen then shows what production does.
 *
 * Usage:
 *   cd backend && npx ts-node --files scripts/save-default-sample-requirements.ts            # dry run
 *   cd backend && npx ts-node --files scripts/save-default-sample-requirements.ts --apply    # writes
 *
 * --apply writes scripts/save-default-sample-requirements-snapshot.json first (the customers touched),
 * so the rows can be removed again by customerId.
 */
import fs from 'fs';
import path from 'path';
import type { SampleType } from '@prisma/client';
import prisma from '../src/config/database';

const APPLY = process.argv.includes('--apply');
const OLD_DEFAULT: SampleType[] = ['FIT_SAMPLE', 'PP_SAMPLE', 'SIZE_SET_SAMPLE'];

async function main() {
  const customers = await prisma.customers.findMany({
    where: { isActive: true, customer_sample_requirements: { none: {} } },
    select: { id: true, code: true, name: true, _count: { select: { orders: true, samples: true } } },
    orderBy: { name: 'asc' },
  });

  console.log(`\n${APPLY ? 'APPLY' : 'DRY RUN'} — active customers with no sample requirements saved:`);
  if (customers.length === 0) console.log('  none');
  const toSave = customers.filter((c) => c._count.orders > 0 || c._count.samples > 0);
  for (const c of customers) {
    const save = toSave.includes(c);
    console.log(
      `  ${c.code ?? ''} ${c.name}  orders ${c._count.orders}  samples ${c._count.samples}  → ` +
        (save ? 'save FIT + PP + Size Set Required + Blocks' : 'left with nothing required (no orders or samples)')
    );
  }

  if (!APPLY) {
    console.log(`\nDry run — nothing written. ${toSave.length} customer(s) would get rows. Re-run with --apply.`);
    return;
  }

  const snapshotPath = path.join(__dirname, 'save-default-sample-requirements-snapshot.json');
  fs.writeFileSync(
    snapshotPath,
    JSON.stringify({ writtenAt: new Date().toISOString(), sampleTypes: OLD_DEFAULT, customers: toSave }, null, 2)
  );

  await prisma.$transaction(
    toSave.flatMap((c) =>
      OLD_DEFAULT.map((sampleType) =>
        prisma.customer_sample_requirements.create({
          data: { customerId: c.id, sampleType, isRequired: true, blocksProduction: true },
        })
      )
    )
  );
  console.log(`\nWrote ${toSave.length * OLD_DEFAULT.length} row(s) for ${toSave.length} customer(s). Snapshot: ${snapshotPath}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
