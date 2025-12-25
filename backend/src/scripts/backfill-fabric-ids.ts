/**
 * Backfill Script: Populate fabricId for style_fabrics
 *
 * This script:
 * 1. Finds all style_fabrics with NULL fabricId
 * 2. Uses fabric matcher to find matching fabric_master records
 * 3. Creates placeholder fabrics for unmatched records
 * 4. Updates style_fabrics with the matched or created fabricId
 * 5. Sets migrationStatus based on confidence level
 *
 * Usage: ts-node src/scripts/backfill-fabric-ids.ts
 */

import { PrismaClient } from '@prisma/client';
import {
  matchAllStyleFabrics,
  getMatchStatistics,
  createPlaceholderFabrics,
  FabricMatchResult,
} from '../services/fabric-matcher.service';

const prisma = new PrismaClient();

async function main() {
  console.log('===================================');
  console.log('Fabric ID Backfill Script');
  console.log('===================================\n');

  // Get admin user for creating placeholder fabrics
  const adminUser = await prisma.users.findFirst({
    where: { role: 'ADMIN' },
  });

  if (!adminUser) {
    throw new Error('No admin user found. Please create an admin user first.');
  }

  console.log(`Using admin user: ${adminUser.email} (${adminUser.id})\n`);

  // Step 1: Match all style_fabrics
  console.log('Step 1: Matching style_fabrics to fabric_master...');
  const matchResults = await matchAllStyleFabrics();

  // Step 2: Show statistics
  console.log('\nMatch Statistics:');
  const stats = getMatchStatistics(matchResults);
  console.log(`  Total: ${stats.total}`);
  console.log(`  High Confidence: ${stats.high}`);
  console.log(`  Medium Confidence: ${stats.medium}`);
  console.log(`  Low Confidence: ${stats.low}`);
  console.log(`  No Match: ${stats.none}`);
  console.log(`  Success Rate: ${stats.successRate.toFixed(2)}%\n`);

  // Step 3: Create placeholder fabrics for unmatched
  console.log('Step 2: Creating placeholder fabrics for unmatched records...');
  const unmatchedResults = matchResults.filter((r) => r.confidence === 'NONE');
  const createdFabrics = await createPlaceholderFabrics(unmatchedResults, adminUser.id);
  console.log(`Created ${createdFabrics.length} placeholder fabrics\n`);

  // Step 4: Update style_fabrics with fabricId and migrationStatus
  console.log('Step 3: Updating style_fabrics with fabricId...');
  let updatedCount = 0;

  // Update matched fabrics
  for (const result of matchResults) {
    let fabricId: string | null = result.matchedFabricId;
    let migrationStatus = 'LINKED';

    // If NONE confidence, check if we created a placeholder
    if (result.confidence === 'NONE') {
      const createdFabric = createdFabrics.find((f) => f.styleFabricId === result.styleFabricId);
      if (createdFabric) {
        fabricId = createdFabric.fabricId;
        migrationStatus = 'TEXT_ONLY';
      }
    } else if (result.confidence === 'LOW' || result.confidence === 'MEDIUM') {
      migrationStatus = 'PENDING'; // Requires manual review
    }

    if (fabricId) {
      await prisma.style_fabrics.update({
        where: { id: result.styleFabricId },
        data: {
          fabricId,
          migrationStatus,
        },
      });
      updatedCount++;
    }
  }

  console.log(`Updated ${updatedCount} style_fabrics records\n`);

  // Step 5: Verification
  console.log('Step 4: Verification...');
  const remainingNull = await prisma.style_fabrics.count({
    where: { fabricId: null },
  });

  console.log(`Remaining style_fabrics with NULL fabricId: ${remainingNull}`);

  if (remainingNull === 0) {
    console.log('✅ SUCCESS: All style_fabrics now have fabricId populated!');
  } else {
    console.log('⚠️  WARNING: Some style_fabrics still have NULL fabricId');
  }

  // Step 6: Summary by migration status
  console.log('\nMigration Status Summary:');
  const statusCounts = await prisma.style_fabrics.groupBy({
    by: ['migrationStatus'],
    _count: true,
  });

  statusCounts.forEach((status) => {
    console.log(`  ${status.migrationStatus}: ${status._count}`);
  });

  console.log('\n===================================');
  console.log('Backfill Complete!');
  console.log('===================================\n');

  // Log detailed results for manual review
  console.log('Detailed Match Results (for manual review):');
  console.log('-------------------------------------------');
  matchResults.forEach((result) => {
    if (result.confidence === 'LOW' || result.confidence === 'MEDIUM') {
      console.log(`Style Fabric ID: ${result.styleFabricId}`);
      console.log(`  Confidence: ${result.confidence}`);
      console.log(`  Reason: ${result.matchReason}`);
      console.log(`  Matched Fabric ID: ${result.matchedFabricId}`);
      console.log('');
    }
  });

  await prisma.$disconnect();
}

main()
  .catch((error) => {
    console.error('Error during backfill:', error);
    prisma.$disconnect();
    process.exit(1);
  });
