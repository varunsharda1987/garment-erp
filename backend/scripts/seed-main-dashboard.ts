// Populate Main Dashboard - Style Production Tracking
// Distributes existing styles across 12 production stages

import { PrismaClient, ProductionStage } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🎨 Populating Main Dashboard Data...\n');
  console.log('This will distribute existing styles across 12 production stages');
  console.log('============================================================\n');

  try {
    // Get all existing styles
    const styles = await prisma.styles.findMany({
      select: { id: true, styleCode: true, styleName: true }
    });

    if (styles.length === 0) {
      console.log('⚠️  No styles found. Please run seed-production-data.ts first.');
      return;
    }

    console.log(`✅ Found ${styles.length} styles to distribute\n`);

    // Clear existing tracking data
    await prisma.style_production_tracking.deleteMany({});
    console.log('🗑️  Cleared existing production tracking data\n');

    // Define stage distribution with realistic scenarios
    const stageDistributions = [
      // Pre-Production (Pending Actions)
      {
        stage: ProductionStage.ORDER_RECEIVED,
        description: 'Orders Received - Awaiting Processing',
        styles: [
          { styleIndex: 0, pieces: 300, sizeName: 'M, L, XL' },
        ]
      },
      {
        stage: ProductionStage.PENDING_COSTING,
        description: 'Pending Costing - Needs Cost Sheet',
        styles: [
          { styleIndex: 1, pieces: 200, sizeName: 'S, M, L' },
        ]
      },
      {
        stage: ProductionStage.PENDING_GREIGE_ORDER,
        description: 'Pending Greige Order - Fabric Not Ordered',
        styles: [
          { styleIndex: 2, pieces: 400, sizeName: 'M, L, XL, XXL' },
        ]
      },
      {
        stage: ProductionStage.TRIMS_NOT_ORDERED,
        description: 'Trims Not Ordered - Buttons/Zippers Needed',
        styles: [
          { styleIndex: 0, pieces: 150, sizeName: 'S, M' },
        ]
      },

      // Processing Stages
      {
        stage: ProductionStage.IN_PRINTING,
        description: 'In Printing - At Print Vendor',
        styles: [
          { styleIndex: 1, pieces: 250, sizeName: 'M, L' },
        ]
      },
      {
        stage: ProductionStage.IN_DYING,
        description: 'In Dying - Color Processing',
        styles: [
          { styleIndex: 2, pieces: 350, sizeName: 'L, XL' },
        ]
      },
      {
        stage: ProductionStage.IN_EMBROIDERY,
        description: 'In Embroidery - Embellishment Work',
        styles: [
          { styleIndex: 0, pieces: 180, sizeName: 'M' },
        ]
      },
      {
        stage: ProductionStage.IN_HANDWORK,
        description: 'In Handwork - Manual Detailing',
        styles: [
          { styleIndex: 1, pieces: 120, sizeName: 'S, M, L' },
        ]
      },

      // Production Stages
      {
        stage: ProductionStage.IN_CUTTING,
        description: 'In Cutting - Fabric Cutting in Progress',
        styles: [
          { styleIndex: 0, pieces: 500, sizeName: 'All sizes' },
          { styleIndex: 2, pieces: 300, sizeName: 'M, L, XL' },
        ]
      },
      {
        stage: ProductionStage.IN_STITCHING,
        description: 'In Stitching - Main Production',
        styles: [
          { styleIndex: 1, pieces: 450, sizeName: 'S, M, L, XL' },
          { styleIndex: 0, pieces: 200, sizeName: 'M, L' },
        ]
      },
      {
        stage: ProductionStage.IN_FINISHING,
        description: 'In Finishing - Final Touches',
        styles: [
          { styleIndex: 2, pieces: 180, sizeName: 'M, L' },
        ]
      },
      {
        stage: ProductionStage.READY_TO_SHIP,
        description: 'Ready to Ship - Completed & Packed',
        styles: [
          { styleIndex: 0, pieces: 150, sizeName: 'Mixed' },
          { styleIndex: 1, pieces: 220, sizeName: 'All sizes' },
        ]
      },
    ];

    let totalRecords = 0;

    // Create tracking records
    for (const distribution of stageDistributions) {
      for (const styleData of distribution.styles) {
        // Check if style exists at this index
        if (styleData.styleIndex >= styles.length) {
          console.log(`⚠️  Style index ${styleData.styleIndex} not found, skipping...`);
          continue;
        }

        const style = styles[styleData.styleIndex];

        await prisma.style_production_tracking.create({
          data: {
            id: randomUUID(),
            styleId: style.id,
            currentStage: distribution.stage,
            piecesInStage: styleData.pieces,
            sizeName: styleData.sizeName,
            lastUpdatedDate: new Date(),
            updatedAt: new Date(),
          }
        });

        totalRecords++;
        console.log(`  ✅ ${distribution.stage}: ${style.styleCode} - ${styleData.pieces} pieces`);
      }
    }

    console.log(`\n✅ Created ${totalRecords} production tracking records\n`);

    // Verify distribution
    console.log('📊 Verifying Stage Distribution:\n');

    const stageSummary = await prisma.style_production_tracking.groupBy({
      by: ['currentStage'],
      _sum: { piecesInStage: true },
      _count: { id: true },
    });

    stageSummary.forEach(summary => {
      console.log(`   ${summary.currentStage}: ${summary._count.id} styles, ${summary._sum.piecesInStage} pieces`);
    });

    console.log('\n============================================================');
    console.log('🎉 Main Dashboard Data Population Complete!');
    console.log('============================================================\n');
    console.log('🎯 Next Steps:');
    console.log('   1. Open frontend: http://localhost:5173');
    console.log('   2. Navigate to Main Dashboard');
    console.log('   3. See all 12 production stage cards populated!');
    console.log('   4. Click any stage card to see styles in that stage\n');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
