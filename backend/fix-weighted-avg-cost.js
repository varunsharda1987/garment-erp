const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixWeightedAvgCost() {
  try {
    console.log('\n=== Fixing fabric_stock.weightedAvgCost ===\n');

    //Find stock entries where weightedAvgCost is 0 or NULL but purchaseCost exists
    const stockEntries = await prisma.fabric_stock.findMany({
      where: {
        OR: [
          { weightedAvgCost: { equals: 0 } },
          { weightedAvgCost: { equals: null } },
        ],
        purchaseCost: { not: null, gt: 0 },
      },
      include: {
        fabric: {
          select: {
            fabricCode: true,
            fabricName: true,
          },
        },
      },
    });

    console.log(`Found ${stockEntries.length} stock entries to fix\n`);

    for (const stock of stockEntries) {
      await prisma.fabric_stock.update({
        where: { id: stock.id },
        data: { weightedAvgCost: stock.purchaseCost },
      });

      console.log(`✅ ${stock.fabric.fabricCode}: Set weightedAvgCost = ₹${stock.purchaseCost}`);
    }

    console.log(`\n✅ Fixed ${stockEntries.length} stock entries`);

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

fixWeightedAvgCost();
