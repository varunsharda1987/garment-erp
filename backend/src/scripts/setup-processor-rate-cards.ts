/**
 * Setup Script: Initial Processor Rate Cards
 *
 * Creates sample processor rate cards based on common garment industry rates
 * This can be customized based on actual processor/mill rates
 *
 * Usage: ts-node src/scripts/setup-processor-rate-cards.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface RateCardData {
  processorName: string;
  processorCategory: string;
  processingType: string;
  fabricCategory: string;
  genericFabricName?: string;
  minQuantityMeters: number;
  maxQuantityMeters: number;
  ratePerMeter: number;
  setupCharge?: number;
  minimumCharge?: number;
  turnaroundDays?: number;
  conditions?: string;
  priority: number;
}

// Sample rate card data - customize based on your actual processors
const sampleRateCards: RateCardData[] = [
  // DYEING - Cotton Fabrics
  {
    processorName: 'ABC Dyeing Mill',
    processorCategory: 'DYEING_PRINTING',
    processingType: 'DYEING',
    fabricCategory: 'COTTON',
    minQuantityMeters: 0,
    maxQuantityMeters: 500,
    ratePerMeter: 65,
    setupCharge: 2000,
    turnaroundDays: 7,
    conditions: 'Minimum order 200 meters',
    priority: 1,
  },
  {
    processorName: 'ABC Dyeing Mill',
    processorCategory: 'DYEING_PRINTING',
    processingType: 'DYEING',
    fabricCategory: 'COTTON',
    minQuantityMeters: 500,
    maxQuantityMeters: 1000,
    ratePerMeter: 60,
    setupCharge: 2000,
    turnaroundDays: 7,
    priority: 1,
  },
  {
    processorName: 'ABC Dyeing Mill',
    processorCategory: 'DYEING_PRINTING',
    processingType: 'DYEING',
    fabricCategory: 'COTTON',
    minQuantityMeters: 1000,
    maxQuantityMeters: 5000,
    ratePerMeter: 55,
    setupCharge: 2000,
    turnaroundDays: 10,
    priority: 1,
  },

  // DYEING - Polyester Fabrics
  {
    processorName: 'ABC Dyeing Mill',
    processorCategory: 'DYEING_PRINTING',
    processingType: 'DYEING',
    fabricCategory: 'POLYESTER',
    minQuantityMeters: 0,
    maxQuantityMeters: 500,
    ratePerMeter: 70,
    setupCharge: 2500,
    turnaroundDays: 7,
    priority: 1,
  },
  {
    processorName: 'ABC Dyeing Mill',
    processorCategory: 'DYEING_PRINTING',
    processingType: 'DYEING',
    fabricCategory: 'POLYESTER',
    minQuantityMeters: 500,
    maxQuantityMeters: 1000,
    ratePerMeter: 65,
    setupCharge: 2500,
    turnaroundDays: 7,
    priority: 1,
  },

  // PRINTING - Cotton Fabrics
  {
    processorName: 'XYZ Printing Works',
    processorCategory: 'DYEING_PRINTING',
    processingType: 'PRINTING',
    fabricCategory: 'COTTON',
    minQuantityMeters: 0,
    maxQuantityMeters: 300,
    ratePerMeter: 85,
    setupCharge: 5000,
    minimumCharge: 15000,
    turnaroundDays: 14,
    conditions: 'Screen charges extra for new designs',
    priority: 1,
  },
  {
    processorName: 'XYZ Printing Works',
    processorCategory: 'DYEING_PRINTING',
    processingType: 'PRINTING',
    fabricCategory: 'COTTON',
    minQuantityMeters: 300,
    maxQuantityMeters: 1000,
    ratePerMeter: 75,
    setupCharge: 5000,
    turnaroundDays: 14,
    priority: 1,
  },
  {
    processorName: 'XYZ Printing Works',
    processorCategory: 'DYEING_PRINTING',
    processingType: 'PRINTING',
    fabricCategory: 'COTTON',
    minQuantityMeters: 1000,
    maxQuantityMeters: 10000,
    ratePerMeter: 65,
    setupCharge: 5000,
    turnaroundDays: 21,
    priority: 1,
  },

  // WASHING - Denim/Cotton
  {
    processorName: 'Premium Wash House',
    processorCategory: 'DYEING_PRINTING',
    processingType: 'WASHING',
    fabricCategory: 'COTTON',
    minQuantityMeters: 0,
    maxQuantityMeters: 500,
    ratePerMeter: 45,
    setupCharge: 1000,
    turnaroundDays: 5,
    priority: 1,
  },
  {
    processorName: 'Premium Wash House',
    processorCategory: 'DYEING_PRINTING',
    processingType: 'WASHING',
    fabricCategory: 'COTTON',
    minQuantityMeters: 500,
    maxQuantityMeters: 2000,
    ratePerMeter: 40,
    setupCharge: 1000,
    turnaroundDays: 5,
    priority: 1,
  },

  // FINISHING - Various fabrics
  {
    processorName: 'Quality Finishers',
    processorCategory: 'DYEING_PRINTING',
    processingType: 'FINISHING',
    fabricCategory: 'COTTON',
    minQuantityMeters: 0,
    maxQuantityMeters: 1000,
    ratePerMeter: 25,
    turnaroundDays: 3,
    priority: 1,
  },
  {
    processorName: 'Quality Finishers',
    processorCategory: 'DYEING_PRINTING',
    processingType: 'FINISHING',
    fabricCategory: 'POLYESTER',
    minQuantityMeters: 0,
    maxQuantityMeters: 1000,
    ratePerMeter: 30,
    turnaroundDays: 3,
    priority: 1,
  },

  // EMBROIDERY
  {
    processorName: 'Elite Embroidery',
    processorCategory: 'DYEING_PRINTING',
    processingType: 'EMBROIDERY',
    fabricCategory: 'COTTON',
    minQuantityMeters: 0,
    maxQuantityMeters: 100,
    ratePerMeter: 150,
    setupCharge: 3000,
    turnaroundDays: 10,
    conditions: 'Design digitizing charges extra',
    priority: 1,
  },
  {
    processorName: 'Elite Embroidery',
    processorCategory: 'DYEING_PRINTING',
    processingType: 'EMBROIDERY',
    fabricCategory: 'COTTON',
    minQuantityMeters: 100,
    maxQuantityMeters: 500,
    ratePerMeter: 120,
    setupCharge: 3000,
    turnaroundDays: 10,
    priority: 1,
  },
];

async function main() {
  console.log('===================================');
  console.log('Processor Rate Card Setup');
  console.log('===================================\n');

  // Get admin user
  const adminUser = await prisma.users.findFirst({
    where: { role: 'ADMIN' },
  });

  if (!adminUser) {
    throw new Error('No admin user found. Please create an admin user first.');
  }

  console.log(`Using admin user: ${adminUser.email}\n`);

  // Check if processors exist, create sample ones if not
  console.log('Step 1: Ensuring processors exist...');

  const processorNames = Array.from(new Set(sampleRateCards.map((r) => r.processorName)));
  const processorsCreated: { [key: string]: string } = {};

  for (const processorName of processorNames) {
    let processor = await prisma.suppliers.findFirst({
      where: {
        name: processorName,
        isActive: true,
      },
    });

    if (!processor) {
      // Create sample processor
      const processorCategory = sampleRateCards.find((r) => r.processorName === processorName)?.processorCategory || 'DYEING_PRINTING';

      processor = await prisma.suppliers.create({
        data: {
          code: `PROC-${processorName.substring(0, 3).toUpperCase()}-${Date.now()}`,
          name: processorName,
          supplierCategories: [processorCategory as any],
          isActive: true,
          createdById: adminUser.id,
        },
      });

      console.log(`  ✓ Created processor: ${processorName}`);
    } else {
      console.log(`  ✓ Found existing processor: ${processorName}`);
    }

    processorsCreated[processorName] = processor.id;
  }

  console.log(`\nStep 2: Creating rate cards...\n`);

  let createdCount = 0;
  let skippedCount = 0;

  for (const rateCard of sampleRateCards) {
    const processorId = processorsCreated[rateCard.processorName];

    // Check if rate card already exists
    const existing = await prisma.processor_rate_card.findFirst({
      where: {
        processorId,
        processingType: rateCard.processingType,
        fabricCategory: rateCard.fabricCategory,
        minQuantityMeters: rateCard.minQuantityMeters,
        isActive: true,
      },
    });

    if (existing) {
      console.log(`  ⊝ Skipped: ${rateCard.processorName} - ${rateCard.processingType} - ${rateCard.fabricCategory} (${rateCard.minQuantityMeters}-${rateCard.maxQuantityMeters}m) - already exists`);
      skippedCount++;
      continue;
    }

    await prisma.processor_rate_card.create({
      data: {
        processorId,
        processingType: rateCard.processingType,
        fabricCategory: rateCard.fabricCategory,
        genericFabricName: rateCard.genericFabricName,
        minQuantityMeters: rateCard.minQuantityMeters,
        maxQuantityMeters: rateCard.maxQuantityMeters,
        ratePerMeter: rateCard.ratePerMeter,
        setupCharge: rateCard.setupCharge,
        minimumCharge: rateCard.minimumCharge,
        turnaroundDays: rateCard.turnaroundDays,
        conditions: rateCard.conditions,
        priority: rateCard.priority,
        isActive: true,
        createdById: adminUser.id,
      },
    });

    console.log(`  ✓ Created: ${rateCard.processorName} - ${rateCard.processingType} - ${rateCard.fabricCategory} (${rateCard.minQuantityMeters}-${rateCard.maxQuantityMeters}m) @ ₹${rateCard.ratePerMeter}/m`);
    createdCount++;
  }

  console.log(`\n===================================`);
  console.log(`Setup Complete!`);
  console.log(`  Created: ${createdCount} rate cards`);
  console.log(`  Skipped: ${skippedCount} (already exist)`);
  console.log(`===================================\n`);

  // Summary
  const totalRateCards = await prisma.processor_rate_card.count({
    where: { isActive: true },
  });

  console.log(`Total active rate cards in system: ${totalRateCards}\n`);

  await prisma.$disconnect();
}

main()
  .catch((error) => {
    console.error('Error during setup:', error);
    prisma.$disconnect();
    process.exit(1);
  });
