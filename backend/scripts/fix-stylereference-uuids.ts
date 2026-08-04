/**
 * fix-stylereference-uuids.ts — repair fabric_master.styleReference values that
 * hold a raw style UUID instead of the human-readable styleCode.
 *
 * What it does:
 *   1. Finds fabric_master rows whose styleReference looks like a UUID
 *      (e.g. "3f2a8c1e-...."), which happened when the style picker saved
 *      styles.id instead of styles.styleCode.
 *   2. Looks up the matching style and rewrites styleReference to its styleCode.
 *   3. If another fabric row ALREADY uses the same genericGreigeName + styleCode,
 *      it still converts, but prints a loud "NEEDS MANUAL MERGE" warning so the
 *      two rows can be merged by hand later.
 *   4. UUIDs that do not match any style are reported and LEFT UNTOUCHED.
 *
 * Updates run in small batches. No prompts — safe to run unattended.
 *
 * Usage:
 *   cd backend && npx ts-node scripts/fix-stylereference-uuids.ts --dry-run   # preview only
 *   cd backend && npx ts-node scripts/fix-stylereference-uuids.ts             # apply changes
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BATCH_SIZE = 25;

interface PlannedUpdate {
  fabricId: string;
  fabricCode: string;
  fabricName: string;
  genericGreigeName: string | null;
  oldValue: string;
  newValue: string;
  needsManualMerge: boolean;
}

function mergeKey(genericGreigeName: string | null, styleCode: string): string {
  return `${genericGreigeName ?? '(no greige name)'}|||${styleCode}`;
}

async function main() {
  console.log('==============================================================');
  console.log('FIX: fabric styleReference UUIDs -> style codes');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (preview only, nothing will be changed)' : 'LIVE (changes will be saved)'}`);
  console.log('==============================================================');

  // Step 1: load every fabric row that has a styleReference
  const fabricsWithRef = await prisma.fabric_master.findMany({
    where: { styleReference: { not: null } },
    select: {
      id: true,
      fabricCode: true,
      fabricName: true,
      genericGreigeName: true,
      styleReference: true,
    },
    orderBy: { fabricCode: 'asc' },
  });
  console.log(`\nStep 1: found ${fabricsWithRef.length} fabric(s) with a style reference.`);

  // Step 2: keep only the ones whose styleReference looks like a UUID
  const uuidFabrics = fabricsWithRef.filter((f) => UUID_REGEX.test(f.styleReference ?? ''));
  console.log(`Step 2: ${uuidFabrics.length} of them hold a raw UUID instead of a style code.`);

  if (uuidFabrics.length === 0) {
    console.log('\nNothing to fix. All style references already look like style codes.');
    return;
  }

  // Step 3: resolve those UUIDs to styles in one query
  const uniqueUuids = [...new Set(uuidFabrics.map((f) => (f.styleReference as string).toLowerCase()))];
  const styleRows = await prisma.styles.findMany({
    where: { id: { in: uniqueUuids, mode: 'insensitive' } },
    select: { id: true, styleCode: true, styleName: true },
  });
  const styleById = new Map(styleRows.map((s) => [s.id.toLowerCase(), s]));
  console.log(`Step 3: ${styleRows.length} of ${uniqueUuids.length} UUID(s) match an existing style.`);

  // Step 4: build the merge-conflict lookup from rows that ALREADY store a code
  // (non-UUID references), then plan each update.
  const existingKeys = new Set<string>();
  for (const f of fabricsWithRef) {
    if (!UUID_REGEX.test(f.styleReference ?? '')) {
      existingKeys.add(mergeKey(f.genericGreigeName, f.styleReference as string));
    }
  }

  const planned: PlannedUpdate[] = [];
  const unresolved: typeof uuidFabrics = [];

  for (const fabric of uuidFabrics) {
    const style = styleById.get((fabric.styleReference as string).toLowerCase());
    if (!style) {
      unresolved.push(fabric);
      continue;
    }
    const key = mergeKey(fabric.genericGreigeName, style.styleCode);
    const needsManualMerge = existingKeys.has(key);
    existingKeys.add(key); // two UUID rows resolving to the same combo also collide
    planned.push({
      fabricId: fabric.id,
      fabricCode: fabric.fabricCode,
      fabricName: fabric.fabricName,
      genericGreigeName: fabric.genericGreigeName,
      oldValue: fabric.styleReference as string,
      newValue: style.styleCode,
      needsManualMerge,
    });
  }

  // Step 5: report the plan, then apply in batches
  console.log(`\nStep 4: ${planned.length} fabric(s) will be updated, ${unresolved.length} cannot be resolved.\n`);

  for (const u of unresolved) {
    console.log(`  SKIPPED (no matching style) - ${u.fabricCode} "${u.fabricName}": styleReference "${u.styleReference}" left untouched.`);
  }
  if (unresolved.length > 0) console.log('');

  let updated = 0;
  let mergeWarnings = 0;

  for (let i = 0; i < planned.length; i += BATCH_SIZE) {
    const batch = planned.slice(i, i + BATCH_SIZE);

    if (!DRY_RUN) {
      await prisma.$transaction(
        batch.map((u) =>
          prisma.fabric_master.update({
            where: { id: u.fabricId },
            data: { styleReference: u.newValue },
          })
        )
      );
    }

    for (const u of batch) {
      updated += 1;
      console.log(
        `  ${DRY_RUN ? 'WOULD UPDATE' : 'UPDATED'} - ${u.fabricCode} "${u.fabricName}": styleReference "${u.oldValue}" -> "${u.newValue}"`
      );
      if (u.needsManualMerge) {
        mergeWarnings += 1;
        console.log('  !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        console.log('  !!! NEEDS MANUAL MERGE: another fabric already exists with');
        console.log(`  !!! greige "${u.genericGreigeName ?? '(no greige name)'}" + style code "${u.newValue}".`);
        console.log(`  !!! ${u.fabricCode} was converted anyway - merge the duplicate rows by hand.`);
        console.log('  !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
      }
    }
  }

  // Step 6: summary
  console.log('\n==============================================================');
  console.log('SUMMARY');
  console.log(`  Fabrics with a style reference : ${fabricsWithRef.length}`);
  console.log(`  Holding a raw UUID             : ${uuidFabrics.length}`);
  console.log(`  ${DRY_RUN ? 'Would be converted' : 'Converted to code '}             : ${updated}`);
  console.log(`  NEEDS MANUAL MERGE warnings    : ${mergeWarnings}`);
  console.log(`  Unresolvable (left untouched)  : ${unresolved.length}`);
  if (DRY_RUN) {
    console.log('\nDry run only - run again WITHOUT --dry-run to apply these changes.');
  }
  console.log('==============================================================');
}

main()
  .catch((error) => {
    console.error('\nERROR: the fix could not finish:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
