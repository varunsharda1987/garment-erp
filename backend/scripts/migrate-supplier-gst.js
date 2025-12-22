const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrateSupplierGST() {
  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║         Migrate Supplier GST Numbers to New Structure               ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  try {
    // Get all suppliers with GST numbers
    const suppliers = await prisma.suppliers.findMany({
      where: {
        gstNumber: {
          not: null,
        },
      },
      select: {
        id: true,
        name: true,
        gstNumber: true,
        address: true,
      },
    });

    console.log(`📊 Found ${suppliers.length} suppliers with GST numbers\n`);

    if (suppliers.length === 0) {
      console.log('✅ No migration needed - no suppliers have GST numbers\n');
      await prisma.$disconnect();
      return;
    }

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const supplier of suppliers) {
      try {
        const gstNumber = supplier.gstNumber.toUpperCase();

        // Extract state code from GST number (first 2 digits)
        const stateCode = gstNumber.substring(0, 2);

        // Look up state
        const state = await prisma.indian_states.findUnique({
          where: { stateCode },
        });

        if (!state) {
          console.log(`⚠️  ${supplier.name}: Invalid state code ${stateCode} in GST ${gstNumber}`);
          skipped++;
          continue;
        }

        console.log(`✓ Migrating ${supplier.name}: ${gstNumber} → ${state.stateName}`);

        // Store in temporary field (will be migrated properly after schema update)
        // For now, just log what would be done
        console.log(`  → Would create GST record: State ${state.stateName} (${stateCode}), GST ${gstNumber}`);
        migrated++;

      } catch (error) {
        console.error(`❌ Error processing ${supplier.name}:`, error.message);
        errors++;
      }
    }

    console.log('\n' + '─'.repeat(70));
    console.log('\n📊 MIGRATION SUMMARY:\n');
    console.log(`  ✓ Suppliers ready to migrate: ${migrated}`);
    console.log(`  ⚠️  Skipped (invalid state): ${skipped}`);
    console.log(`  ❌ Errors: ${errors}`);
    console.log('\n' + '─'.repeat(70));

    console.log('\n✅ Pre-migration check complete!\n');
    console.log('NEXT STEPS:');
    console.log('  1. This script verified the GST data is valid');
    console.log('  2. Run: npx prisma db push --accept-data-loss');
    console.log('  3. Run: node scripts/complete-supplier-gst-migration.js');
    console.log('  4. The existing gstNumber column will be removed\n');

    await prisma.$disconnect();

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

migrateSupplierGST();
