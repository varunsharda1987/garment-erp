const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCostPerMeter() {
  try {
    const fabrics = await prisma.fabric_master.findMany({
      where: { isActive: true },
      select: {
        fabricCode: true,
        fabricName: true,
        costPerMeter: true,
        valueAdditionCost: true,
      },
      take: 10,
    });

    console.log('\n=== Fabric Cost Per Meter Analysis ===\n');
    console.log('Sample of fabrics (first 10):');
    fabrics.forEach((fabric) => {
      console.log(`${fabric.fabricCode} - ${fabric.fabricName}`);
      console.log(`  Cost/Meter: ${fabric.costPerMeter || 'NULL'}`);
      console.log(`  Value Addition Cost: ${fabric.valueAdditionCost || 'NULL'}`);
      console.log('');
    });

    const totalCount = await prisma.fabric_master.count({
      where: { isActive: true },
    });

    const withCostCount = await prisma.fabric_master.count({
      where: {
        isActive: true,
        costPerMeter: { not: null },
      },
    });

    console.log('\nStatistics:');
    console.log(`Total active fabrics: ${totalCount}`);
    console.log(`Fabrics with cost/meter: ${withCostCount}`);
    console.log(`Fabrics without cost/meter: ${totalCount - withCostCount}`);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkCostPerMeter();
