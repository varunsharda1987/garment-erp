/**
 * check-code-duplicates.ts — READ-ONLY duplicate-code report.
 *
 * Run this BEFORE applying the harden_code_uniqueness migration
 * (cutting_batches.batchNumber @unique, stitching_issues.issueNumber @unique,
 * partial unique index on styles.styleCode WHERE isActive).
 * The migration will FAIL if any duplicates reported here still exist.
 *
 * Reports:
 *   1. styleCode values shared by more than one ACTIVE style
 *   2. cutting_batches.batchNumber values used by more than one batch
 *   3. stitching_issues.issueNumber values used by more than one issue
 *
 * Makes NO changes to the database.
 *
 * Usage: cd backend && npx ts-node scripts/check-code-duplicates.ts
 * Exit code: 0 = clean (safe to migrate), 1 = duplicates found (fix them first)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

let totalProblems = 0;

function sectionHeader(title: string) {
  console.log('');
  console.log('--------------------------------------------------------------');
  console.log(title);
  console.log('--------------------------------------------------------------');
}

async function checkActiveStyleCodes() {
  sectionHeader('CHECK 1: Style codes shared by more than one ACTIVE style');

  const dupes = await prisma.styles.groupBy({
    by: ['styleCode'],
    where: { isActive: true },
    _count: { styleCode: true },
    having: { styleCode: { _count: { gt: 1 } } },
    orderBy: { styleCode: 'asc' },
  });

  if (dupes.length === 0) {
    console.log('OK - every active style has its own unique style code.');
    return;
  }

  totalProblems += dupes.length;
  console.log(`PROBLEM - ${dupes.length} style code(s) are used by more than one active style:`);

  for (const dupe of dupes) {
    const rows = await prisma.styles.findMany({
      where: { styleCode: dupe.styleCode, isActive: true },
      select: { id: true, styleName: true, status: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    console.log('');
    console.log(`  Style code "${dupe.styleCode}" is used by ${rows.length} active styles:`);
    for (const row of rows) {
      console.log(
        `    - "${row.styleName}" (status: ${row.status}, created: ${row.createdAt.toISOString().slice(0, 10)}, id: ${row.id})`
      );
    }
  }
  console.log('');
  console.log('  How to fix: keep one style per code; rename or deactivate the extras.');
}

async function checkCuttingBatchNumbers() {
  sectionHeader('CHECK 2: Duplicate cutting batch numbers (cutting_batches)');

  const dupes = await prisma.cutting_batches.groupBy({
    by: ['batchNumber'],
    _count: { batchNumber: true },
    having: { batchNumber: { _count: { gt: 1 } } },
    orderBy: { batchNumber: 'asc' },
  });

  if (dupes.length === 0) {
    console.log('OK - every cutting batch has its own unique batch number.');
    return;
  }

  totalProblems += dupes.length;
  console.log(`PROBLEM - ${dupes.length} batch number(s) are used by more than one cutting batch:`);

  for (const dupe of dupes) {
    const rows = await prisma.cutting_batches.findMany({
      where: { batchNumber: dupe.batchNumber },
      select: {
        id: true,
        status: true,
        cuttingDate: true,
        isActive: true,
        workOrder: { select: { workOrderNumber: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    console.log('');
    console.log(`  Batch number "${dupe.batchNumber}" is used by ${rows.length} batches:`);
    for (const row of rows) {
      console.log(
        `    - Work order ${row.workOrder?.workOrderNumber ?? '(none)'} | status: ${row.status} | cut on: ${row.cuttingDate.toISOString().slice(0, 10)} | active: ${row.isActive ? 'yes' : 'no'} | id: ${row.id}`
      );
    }
  }
  console.log('');
  console.log('  How to fix: renumber the duplicate batches so each has its own number.');
}

async function checkStitchingIssueNumbers() {
  sectionHeader('CHECK 3: Duplicate stitching issue numbers (stitching_issues)');

  const dupes = await prisma.stitching_issues.groupBy({
    by: ['issueNumber'],
    _count: { issueNumber: true },
    having: { issueNumber: { _count: { gt: 1 } } },
    orderBy: { issueNumber: 'asc' },
  });

  if (dupes.length === 0) {
    console.log('OK - every stitching issue has its own unique issue number.');
    return;
  }

  totalProblems += dupes.length;
  console.log(`PROBLEM - ${dupes.length} issue number(s) are used by more than one stitching issue:`);

  for (const dupe of dupes) {
    const rows = await prisma.stitching_issues.findMany({
      where: { issueNumber: dupe.issueNumber },
      select: {
        id: true,
        status: true,
        issueDate: true,
        isActive: true,
        workOrder: { select: { workOrderNumber: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    console.log('');
    console.log(`  Issue number "${dupe.issueNumber}" is used by ${rows.length} stitching issues:`);
    for (const row of rows) {
      console.log(
        `    - Work order ${row.workOrder?.workOrderNumber ?? '(none)'} | status: ${row.status} | issued on: ${row.issueDate.toISOString().slice(0, 10)} | active: ${row.isActive ? 'yes' : 'no'} | id: ${row.id}`
      );
    }
  }
  console.log('');
  console.log('  How to fix: renumber the duplicate stitching issues so each has its own number.');
}

async function main() {
  console.log('==============================================================');
  console.log('DUPLICATE CODE CHECK (read-only - nothing will be changed)');
  console.log('==============================================================');

  await checkActiveStyleCodes();
  await checkCuttingBatchNumbers();
  await checkStitchingIssueNumbers();

  console.log('');
  console.log('==============================================================');
  if (totalProblems === 0) {
    console.log('RESULT: ALL CLEAR - no duplicate codes found.');
    console.log('It is safe to apply the uniqueness migration.');
  } else {
    console.log(`RESULT: ${totalProblems} duplicate code group(s) found (details above).`);
    console.log('Fix these duplicates BEFORE applying the uniqueness migration,');
    console.log('otherwise the migration will fail.');
  }
  console.log('==============================================================');

  process.exitCode = totalProblems === 0 ? 0 : 1;
}

main()
  .catch((error) => {
    console.error('');
    console.error('ERROR: the check could not finish:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
