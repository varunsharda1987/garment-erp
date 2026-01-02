const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateFabricCostPerMeter() {
  try {
    console.log('\n=== Updating fabric_master.costPerMeter from stock data ===\n');

    // Get all active fabrics
    const fabrics = await prisma.fabric_master.findMany({
      where: { isActive: true },
      include: {
        fabricStock: {
          where: {
            status: { in: ['AVAILABLE', 'RESERVED'] },
            quantityAvailable: { gt: 0 },
          },
          orderBy: {
            createdAt: 'desc', // Most recent stock first
          },
          take: 1,
        },
      },
    });

    let updated = 0;
    let noStock = 0;

    for (const fabric of fabrics) {
      if (fabric.fabricStock.length > 0) {
        const latestStock = fabric.fabricStock[0];
        const costPerMeter = latestStock.weightedAvgCost || latestStock.purchaseCost;

        if (costPerMeter && Number(costPerMeter) > 0) {
          await prisma.fabric_master.update({
            where: { id: fabric.id },
            data: { costPerMeter },
          });

          console.log(`✅ Updated ${fabric.fabricCode}: ₹${costPerMeter}/meter`);
          updated++;
        } else {
          console.log(`⚠️  ${fabric.fabricCode}: Stock exists but no cost data`);
        }
      } else {
        console.log(`❌ ${fabric.fabricCode}: No stock available`);
        noStock++;
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Total fabrics: ${fabrics.length}`);
    console.log(`Updated: ${updated}`);
    console.log(`No stock: ${noStock}`);
    console.log(`Skipped (no cost): ${fabrics.length - updated - noStock}`);

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

updateFabricCostPerMeter();
