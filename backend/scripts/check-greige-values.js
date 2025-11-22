const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkGreigeValues() {
  try {
    console.log('Checking greige records...\n');

    // Get recent greige masters
    const greige = await prisma.greige_master.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        greigeCode: true,
        greigeName: true,
        greigeWidth: true,
        averageShrinkagePercent: true,
      },
    });

    greige.forEach((g) => {
      console.log(`Code: ${g.greigeCode}`);
      console.log(`Name: ${g.greigeName}`);
      console.log(`Width: ${g.greigeWidth} (type: ${typeof g.greigeWidth})`);
      console.log(`Shrinkage: ${g.averageShrinkagePercent} (type: ${typeof g.averageShrinkagePercent})`);
      console.log(`Width is null: ${g.greigeWidth === null}`);
      console.log(`Shrinkage is null: ${g.averageShrinkagePercent === null}`);
      console.log('---');
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkGreigeValues();
