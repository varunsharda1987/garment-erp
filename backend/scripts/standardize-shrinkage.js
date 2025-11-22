const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function standardizeShrinkage() {
  try {
    console.log('Standardizing shrinkage values to percentage format...\n');

    // Get all greige masters
    const allGreige = await prisma.greige_master.findMany();

    let updated = 0;
    for (const greige of allGreige) {
      const shrinkage = Number(greige.averageShrinkagePercent);

      // If the value is less than 1, it's stored as a decimal (e.g., 0.1 = 10%)
      // Convert it to percentage format (e.g., 10)
      if (shrinkage < 1 && shrinkage > 0) {
        const newValue = shrinkage * 100;

        await prisma.greige_master.update({
          where: { id: greige.id },
          data: { averageShrinkagePercent: newValue },
        });

        console.log(`${greige.greigeCode}: ${shrinkage} -> ${newValue}%`);
        updated++;
      }
    }

    console.log(`\nCompleted! Updated ${updated} records.`);
  } catch (error) {
    console.error('Error standardizing shrinkage:', error);
  } finally {
    await prisma.$disconnect();
  }
}

standardizeShrinkage();
