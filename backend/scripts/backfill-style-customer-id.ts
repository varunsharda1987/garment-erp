/**
 * Backfill script for styles.customerId
 *
 * This script matches styles.customerName to customers.name and sets customerId.
 * It outputs unmatched rows for manual review.
 *
 * Usage:
 *   cd backend && npx ts-node scripts/backfill-style-customer-id.ts [--dry-run]
 *
 * Part of WS1: Style-Customer FK Migration
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface BackfillResult {
  total: number;
  matched: number;
  unmatched: string[];
  alreadySet: number;
  errors: string[];
}

async function backfillStyleCustomerId(dryRun: boolean): Promise<BackfillResult> {
  const result: BackfillResult = {
    total: 0,
    matched: 0,
    unmatched: [],
    alreadySet: 0,
    errors: [],
  };

  // Get all customers for name matching
  const customers = await prisma.customers.findMany({
    select: { id: true, name: true },
  });

  // Build a map of normalized name -> customerId for fast lookup
  const customerMap = new Map<string, string>();
  for (const customer of customers) {
    // Normalize: lowercase, trim whitespace
    const normalizedName = customer.name.toLowerCase().trim();
    customerMap.set(normalizedName, customer.id);
  }

  console.log(`Loaded ${customers.length} customers for matching`);

  // Get all styles that have customerName but no customerId
  const styles = await prisma.styles.findMany({
    where: {
      customerName: { not: null },
    },
    select: { id: true, styleCode: true, customerName: true, customerId: true },
  });

  result.total = styles.length;
  console.log(`Found ${styles.length} styles with customerName`);

  for (const style of styles) {
    // Skip if already has customerId
    if (style.customerId) {
      result.alreadySet++;
      continue;
    }

    if (!style.customerName) {
      continue;
    }

    // Try to match
    const normalizedName = style.customerName.toLowerCase().trim();
    const matchedCustomerId = customerMap.get(normalizedName);

    if (matchedCustomerId) {
      result.matched++;
      if (!dryRun) {
        try {
          await prisma.styles.update({
            where: { id: style.id },
            data: { customerId: matchedCustomerId },
          });
        } catch (err) {
          result.errors.push(`Error updating ${style.styleCode}: ${err}`);
        }
      }
    } else {
      result.unmatched.push(`${style.styleCode}: "${style.customerName}"`);
    }
  }

  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log(`\n=== Backfill styles.customerId from customerName ===`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE'}\n`);

  try {
    const result = await backfillStyleCustomerId(dryRun);

    console.log(`\n=== Results ===`);
    console.log(`Total styles with customerName: ${result.total}`);
    console.log(`Already had customerId: ${result.alreadySet}`);
    console.log(`Matched and ${dryRun ? 'would be ' : ''}updated: ${result.matched}`);
    console.log(`Unmatched (need manual review): ${result.unmatched.length}`);

    if (result.unmatched.length > 0) {
      console.log(`\n=== Unmatched Styles (Manual Review Required) ===`);
      result.unmatched.forEach((entry) => console.log(`  - ${entry}`));
    }

    if (result.errors.length > 0) {
      console.log(`\n=== Errors ===`);
      result.errors.forEach((err) => console.log(`  - ${err}`));
    }

    if (dryRun && result.matched > 0) {
      console.log(`\nTo apply changes, run without --dry-run`);
    }
  } catch (err) {
    console.error('Backfill failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
