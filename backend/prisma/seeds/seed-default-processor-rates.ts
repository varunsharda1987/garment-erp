/**
 * Seed Default Processor Rates for All Greige Fabrics
 *
 * This script creates default rates for DYEING and PRINTING for all greige fabrics
 * in the greige_master table. These rates are stored under the SYSTEM_DEFAULT processor.
 *
 * Run with: npx ts-node prisma/seeds/seed-default-processor-rates.ts
 */

import { PrismaClient, PrintingType } from '@prisma/client';

const prisma = new PrismaClient();

// ====================================
// CONFIGURATION - ADJUST THESE VALUES
// ====================================

// Default quantity slabs for DYEING
const DYEING_SLABS = [
  { slabOrder: 1, minQuantity: 0, maxQuantity: 500, slabLabel: '0-500m' },
  { slabOrder: 2, minQuantity: 500, maxQuantity: 1000, slabLabel: '500-1000m' },
  { slabOrder: 3, minQuantity: 1000, maxQuantity: 5000, slabLabel: '1000-5000m' },
  { slabOrder: 4, minQuantity: 5000, maxQuantity: 999999, slabLabel: '5000+ m' },
];

// Default quantity slabs for PRINTING (same ranges, usually)
const PRINTING_SLABS = [
  { slabOrder: 1, minQuantity: 0, maxQuantity: 500, slabLabel: '0-500m' },
  { slabOrder: 2, minQuantity: 500, maxQuantity: 1000, slabLabel: '500-1000m' },
  { slabOrder: 3, minQuantity: 1000, maxQuantity: 5000, slabLabel: '1000-5000m' },
  { slabOrder: 4, minQuantity: 5000, maxQuantity: 999999, slabLabel: '5000+ m' },
];

// Default DYEING rates per meter for each slab (in ₹)
// These decrease as quantity increases (bulk discount)
const DYEING_RATES = {
  slab1: 65, // 0-500m
  slab2: 60, // 500-1000m
  slab3: 55, // 1000-5000m
  slab4: 50, // 5000+m
};

// Default PRINTING rates per meter for each printing type and slab (in ₹)
// Printing is more expensive than dyeing
const PRINTING_RATES = {
  PIGMENT: {
    slab1: 85,  // 0-500m
    slab2: 80,  // 500-1000m
    slab3: 75,  // 1000-5000m
    slab4: 70,  // 5000+m
  },
  PROCIAN: {
    slab1: 90,  // More expensive due to better quality
    slab2: 85,
    slab3: 80,
    slab4: 75,
  },
  DISCHARGE: {
    slab1: 95,  // Most expensive due to complex process
    slab2: 90,
    slab3: 85,
    slab4: 80,
  },
  PIGMENT_DISCHARGE: {
    slab1: 100, // Combination process, highest cost
    slab2: 95,
    slab3: 90,
    slab4: 85,
  },
};

// Default shrinkage percentage (same for all greiges in this example)
// You can customize this per fabric type if needed
const DEFAULT_SHRINKAGE_PERCENT = 5.0; // 5% shrinkage

// Default screen costs per screen (in ₹)
const DEFAULT_SCREEN_COSTS = {
  ROTARY: 3000,
  FLATBELT: 1100,
  TABLE: 1000,
};

// ====================================
// MAIN SEED FUNCTION
// ====================================

async function seedDefaultProcessorRates() {
  console.log('=== Seeding Default Processor Rates ===\n');

  try {
    // Step 1: Ensure SYSTEM_DEFAULT processor exists
    console.log('Step 1: Checking for SYSTEM_DEFAULT processor...');
    let systemDefaultProcessor = await prisma.suppliers.findFirst({
      where: { code: 'SYSTEM_DEFAULT' },
    });

    if (!systemDefaultProcessor) {
      console.log('  SYSTEM_DEFAULT processor not found. Creating it...');

      // Get admin user
      const adminUser = await prisma.users.findFirst({
        where: {
          OR: [
            { role: 'ADMIN' },
            { email: { contains: 'admin' } },
          ],
        },
      });

      if (!adminUser) {
        throw new Error('No admin user found. Please create an admin user first.');
      }

      systemDefaultProcessor = await prisma.suppliers.create({
        data: {
          code: 'SYSTEM_DEFAULT',
          name: 'System Default Rates',
          supplierCategories: ['DYEING_PRINTING'],
          isActive: false, // Hidden from normal lists
          createdById: adminUser.id,
        },
      });

      console.log('  ✓ Created SYSTEM_DEFAULT processor');
    } else {
      console.log('  ✓ SYSTEM_DEFAULT processor found:', systemDefaultProcessor.id);
    }

    const processorId = systemDefaultProcessor.id;

    // Get admin user for createdById
    const adminUser = await prisma.users.findFirst({
      where: {
        OR: [
          { role: 'ADMIN' },
          { email: { contains: 'admin' } },
        ],
      },
    });

    if (!adminUser) {
      throw new Error('No admin user found. Please create an admin user first.');
    }

    const createdById = adminUser.id;

    // Step 2: Get all greige fabrics
    console.log('\nStep 2: Loading greige fabrics...');
    const greiges = await prisma.greige_master.findMany({
      where: { isActive: true },
      select: {
        id: true,
        greigeCode: true,
        greigeName: true,
        genericFabricName: true,
      },
      orderBy: { greigeCode: 'asc' },
    });

    console.log(`  ✓ Found ${greiges.length} active greige fabrics\n`);

    if (greiges.length === 0) {
      console.log('  ⚠️  No greige fabrics found. Please add greige fabrics first.');
      return;
    }

    // Step 3: Create DYEING slabs
    console.log('Step 3: Creating DYEING quantity slabs...');
    const dyeingSlabRecords = [];

    for (const slabDef of DYEING_SLABS) {
      // Check if slab already exists
      const existing = await prisma.processor_quantity_slabs.findFirst({
        where: {
          processorId,
          processingType: 'DYEING',
          slabOrder: slabDef.slabOrder,
        },
      });

      if (existing) {
        console.log(`  [SKIP] Slab ${slabDef.slabOrder} already exists for DYEING`);
        dyeingSlabRecords.push(existing);
      } else {
        const slab = await prisma.processor_quantity_slabs.create({
          data: {
            processorId,
            processingType: 'DYEING',
            slabOrder: slabDef.slabOrder,
            minQuantity: slabDef.minQuantity,
            maxQuantity: slabDef.maxQuantity,
            slabLabel: slabDef.slabLabel,
            isActive: true,
            createdById,
          },
        });
        console.log(`  ✓ Created slab ${slabDef.slabOrder}: ${slabDef.slabLabel}`);
        dyeingSlabRecords.push(slab);
      }
    }

    // Step 4: Create PRINTING slabs
    console.log('\nStep 4: Creating PRINTING quantity slabs...');
    const printingSlabRecords = [];

    for (const slabDef of PRINTING_SLABS) {
      // Check if slab already exists
      const existing = await prisma.processor_quantity_slabs.findFirst({
        where: {
          processorId,
          processingType: 'PRINTING',
          slabOrder: slabDef.slabOrder,
        },
      });

      if (existing) {
        console.log(`  [SKIP] Slab ${slabDef.slabOrder} already exists for PRINTING`);
        printingSlabRecords.push(existing);
      } else {
        const slab = await prisma.processor_quantity_slabs.create({
          data: {
            processorId,
            processingType: 'PRINTING',
            slabOrder: slabDef.slabOrder,
            minQuantity: slabDef.minQuantity,
            maxQuantity: slabDef.maxQuantity,
            slabLabel: slabDef.slabLabel,
            isActive: true,
            createdById,
          },
        });
        console.log(`  ✓ Created slab ${slabDef.slabOrder}: ${slabDef.slabLabel}`);
        printingSlabRecords.push(slab);
      }
    }

    // Step 5: Create DYEING rates for all greiges
    console.log('\nStep 5: Creating DYEING rates for all greiges...');
    let dyeingRatesCreated = 0;
    let dyeingRatesSkipped = 0;

    for (const greige of greiges) {
      for (let i = 0; i < dyeingSlabRecords.length; i++) {
        const slab = dyeingSlabRecords[i];
        const rateValue = Object.values(DYEING_RATES)[i];

        // Check if rate already exists
        const existing = await prisma.processor_rate_card.findFirst({
          where: {
            processorId,
            processingType: 'DYEING',
            printingType: null,
            greigeId: greige.id,
            slabId: slab.id,
          },
        });

        if (existing) {
          dyeingRatesSkipped++;
        } else {
          await prisma.processor_rate_card.create({
            data: {
              processorId,
              processingType: 'DYEING',
              printingType: null,
              greigeId: greige.id,
              slabId: slab.id,
              ratePerMeter: rateValue,
              shrinkagePercent: DEFAULT_SHRINKAGE_PERCENT,
              isActive: true,
              createdById,
            },
          });
          dyeingRatesCreated++;
        }
      }
    }

    console.log(`  ✓ Created ${dyeingRatesCreated} DYEING rates`);
    console.log(`  [SKIP] ${dyeingRatesSkipped} DYEING rates already existed`);

    // Step 6: Create PRINTING rates for all greiges (all 4 printing types)
    console.log('\nStep 6: Creating PRINTING rates for all greiges...');
    let printingRatesCreated = 0;
    let printingRatesSkipped = 0;

    const printingTypes: PrintingType[] = ['PIGMENT', 'PROCIAN', 'DISCHARGE', 'PIGMENT_DISCHARGE'];

    for (const greige of greiges) {
      for (const printingType of printingTypes) {
        // Determine screen type based on fabric (you can customize this logic)
        // For now, we'll use ROTARY as default
        const screenType = 'ROTARY';
        const screenCost = DEFAULT_SCREEN_COSTS[screenType];

        for (let i = 0; i < printingSlabRecords.length; i++) {
          const slab = printingSlabRecords[i];
          const rateValue = PRINTING_RATES[printingType][`slab${i + 1}` as keyof typeof PRINTING_RATES.PIGMENT];

          // Check if rate already exists
          const existing = await prisma.processor_rate_card.findFirst({
            where: {
              processorId,
              processingType: 'PRINTING',
              printingType,
              greigeId: greige.id,
              slabId: slab.id,
            },
          });

          if (existing) {
            printingRatesSkipped++;
          } else {
            await prisma.processor_rate_card.create({
              data: {
                processorId,
                processingType: 'PRINTING',
                printingType,
                greigeId: greige.id,
                slabId: slab.id,
                ratePerMeter: rateValue,
                shrinkagePercent: DEFAULT_SHRINKAGE_PERCENT,
                screenCostPerScreen: screenCost,
                screenType,
                isActive: true,
                createdById,
              },
            });
            printingRatesCreated++;
          }
        }
      }
    }

    console.log(`  ✓ Created ${printingRatesCreated} PRINTING rates`);
    console.log(`  [SKIP] ${printingRatesSkipped} PRINTING rates already existed`);

    // Summary
    console.log('\n=== Summary ===');
    console.log(`Processor: SYSTEM_DEFAULT (${processorId})`);
    console.log(`Greige fabrics: ${greiges.length}`);
    console.log(`DYEING slabs: ${dyeingSlabRecords.length}`);
    console.log(`PRINTING slabs: ${printingSlabRecords.length}`);
    console.log(`\nRates created:`);
    console.log(`  DYEING: ${dyeingRatesCreated} new, ${dyeingRatesSkipped} skipped`);
    console.log(`  PRINTING: ${printingRatesCreated} new, ${printingRatesSkipped} skipped`);
    console.log(`\nTotal rate cards: ${dyeingRatesCreated + printingRatesCreated} created`);
    console.log(`Expected total: ${greiges.length * dyeingSlabRecords.length + greiges.length * printingSlabRecords.length * 4}`);
    console.log('\n✓ Default processor rates seeded successfully!');
    console.log('\nYou can now:');
    console.log('1. View/edit rates at: http://localhost:5173/processor-rate-cards');
    console.log('2. Select SYSTEM_DEFAULT processor from dropdown');
    console.log('3. Adjust rates as needed for your business');

  } catch (error: unknown) {
    console.error('\n[ERROR] Seed failed:', error instanceof Error ? error.message : 'Unknown error');
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    throw error;
  }
}

// Run the seed
seedDefaultProcessorRates()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
