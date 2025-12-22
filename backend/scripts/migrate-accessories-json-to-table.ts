/**
 * Migration Script: Convert customer_accessories_presets JSON to separate table
 *
 * This script:
 * 1. Reads existing accessoryItems JSON from customer_accessories_presets
 * 2. Creates rows in customer_accessories_preset_items table
 * 3. Validates the migration
 *
 * Run: npx ts-node backend/scripts/migrate-accessories-json-to-table.ts
 */

import { PrismaClient, MaterialType } from '@prisma/client';

const prisma = new PrismaClient();

interface AccessoryItemJSON {
  materialType: string;
  materialId: string;
  quantity?: number;
  usageCategory?: string;
}

async function migrateAccessoriesJsonToTable() {
  console.log('🔄 Starting migration: customer_accessories_presets JSON → Table');
  console.log('='.repeat(70));

  try {
    // Step 1: Fetch all presets with JSON data
    const presets = await prisma.$queryRaw<any[]>`
      SELECT id, "customerId", "presetName", "accessoryItems"
      FROM customer_accessories_presets
      WHERE "accessoryItems" IS NOT NULL
    `;

    console.log(`\n📊 Found ${presets.length} presets with accessory items`);

    if (presets.length === 0) {
      console.log('✅ No data to migrate. All done!');
      return;
    }

    let totalItemsCreated = 0;
    let presetsProcessed = 0;

    // Step 2: Process each preset
    for (const preset of presets) {
      try {
        const accessoryItems: AccessoryItemJSON[] =
          typeof preset.accessoryItems === 'string'
            ? JSON.parse(preset.accessoryItems)
            : preset.accessoryItems;

        if (!Array.isArray(accessoryItems) || accessoryItems.length === 0) {
          console.log(`⏭️  Skipping preset ${preset.presetName} (empty items)`);
          continue;
        }

        console.log(`\n📦 Processing: ${preset.presetName} (${accessoryItems.length} items)`);

        // Create items for this preset
        for (let i = 0; i < accessoryItems.length; i++) {
          const item = accessoryItems[i];

          // Validate materialType
          if (!item.materialType || !Object.values(MaterialType).includes(item.materialType as MaterialType)) {
            console.log(`   ⚠️  Invalid materialType: ${item.materialType} - skipping`);
            continue;
          }

          // Create the item
          await prisma.customer_accessories_preset_items.create({
            data: {
              presetId: preset.id,
              materialType: item.materialType as MaterialType,
              materialId: item.materialId,
              quantity: item.quantity || 1,
              usageCategory: item.usageCategory || null,
              sortOrder: i,
            },
          });

          totalItemsCreated++;
        }

        presetsProcessed++;
        console.log(`   ✅ Created ${accessoryItems.length} items`);

      } catch (error) {
        console.error(`   ❌ Error processing preset ${preset.presetName}:`, error);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log(`✅ Migration Complete!`);
    console.log(`   • Presets processed: ${presetsProcessed}/${presets.length}`);
    console.log(`   • Items created: ${totalItemsCreated}`);

    // Step 3: Validation
    console.log('\n🔍 Validating migration...');
    const itemCount = await prisma.customer_accessories_preset_items.count();
    console.log(`   • Total items in new table: ${itemCount}`);

    if (itemCount === totalItemsCreated) {
      console.log('   ✅ Validation passed!');
    } else {
      console.log('   ⚠️  Warning: Item count mismatch!');
    }

    // Step 4: Show sample data
    console.log('\n📋 Sample migrated data:');
    const samplePreset = await prisma.customer_accessories_presets.findFirst({
      include: {
        items: {
          take: 3,
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (samplePreset && samplePreset.items.length > 0) {
      console.log(`   Preset: ${samplePreset.presetName}`);
      samplePreset.items.forEach((item, idx) => {
        console.log(`     ${idx + 1}. ${item.materialType} - Qty: ${item.quantity}`);
      });
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ Migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Review the migrated data');
    console.log('   2. Run: npx prisma migrate dev --name remove_accessories_json_column');
    console.log('   3. Manually create a migration to drop the accessoryItems column');
    console.log('   4. Update application code to use new table structure');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateAccessoriesJsonToTable()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
