/**
 * Backfill Script: GST State IDs
 *
 * Updates existing customer_gst_numbers records to populate the stateId field
 * based on their existing stateCode values.
 *
 * Run with: npx ts-node backend/scripts/backfill-gst-states.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface BackfillStats {
  total: number;
  updated: number;
  skipped: number;
  errors: number;
  errorDetails: Array<{ gstNumber: string; stateCode: string; error: string }>;
}

async function backfillGSTStates(): Promise<BackfillStats> {
  const stats: BackfillStats = {
    total: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    errorDetails: [],
  };

  console.log('🔄 Starting GST State ID backfill...\n');

  try {
    // Fetch all GST numbers without stateId
    const gstNumbers = await prisma.customer_gst_numbers.findMany({
      where: {
        OR: [
          { stateId: null },
          { stateId: '' },
        ],
      },
      select: {
        id: true,
        stateCode: true,
        gstNumber: true,
        stateName: true,
        customerId: true,
      },
    });

    stats.total = gstNumbers.length;

    console.log(`📊 Found ${stats.total} GST numbers without stateId\n`);

    if (stats.total === 0) {
      console.log('✅ No records to backfill. All GST numbers already have stateId.');
      return stats;
    }

    // Process each GST number
    for (const gst of gstNumbers) {
      try {
        // Look up the state by stateCode
        const state = await prisma.indian_states.findUnique({
          where: { stateCode: gst.stateCode },
          select: { id: true, stateName: true },
        });

        if (!state) {
          console.log(`⚠️  No state found for code: ${gst.stateCode} (GST: ${gst.gstNumber})`);
          stats.errors++;
          stats.errorDetails.push({
            gstNumber: gst.gstNumber,
            stateCode: gst.stateCode,
            error: 'State code not found in indian_states table',
          });
          continue;
        }

        // Update the GST number with the stateId
        await prisma.customer_gst_numbers.update({
          where: { id: gst.id },
          data: { stateId: state.id },
        });

        stats.updated++;
        console.log(
          `✓ Updated GST ${gst.gstNumber} → State: ${state.stateName} (${gst.stateCode})`
        );
      } catch (error) {
        stats.errors++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        stats.errorDetails.push({
          gstNumber: gst.gstNumber,
          stateCode: gst.stateCode,
          error: errorMessage,
        });
        console.error(`❌ Error updating GST ${gst.gstNumber}:`, errorMessage);
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📈 Backfill Summary');
    console.log('='.repeat(60));
    console.log(`Total GST numbers processed: ${stats.total}`);
    console.log(`✅ Successfully updated:     ${stats.updated}`);
    console.log(`⚠️  Skipped:                 ${stats.skipped}`);
    console.log(`❌ Errors:                   ${stats.errors}`);

    if (stats.errorDetails.length > 0) {
      console.log('\n' + '='.repeat(60));
      console.log('❌ Error Details:');
      console.log('='.repeat(60));
      stats.errorDetails.forEach((err) => {
        console.log(`\nGST Number: ${err.gstNumber}`);
        console.log(`State Code: ${err.stateCode}`);
        console.log(`Error: ${err.error}`);
      });
    }

    console.log('\n✅ Backfill completed successfully!');
    return stats;
  } catch (error) {
    console.error('\n💥 Fatal error during backfill:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the backfill function
if (require.main === module) {
  backfillGSTStates()
    .then((stats) => {
      console.log('\n🎉 Script completed!');
      process.exit(stats.errors > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

export { backfillGSTStates };
