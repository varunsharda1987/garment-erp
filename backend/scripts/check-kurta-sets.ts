import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkKurtaSets() {
  try {
    const category = await prisma.product_category_master.findFirst({
      where: { code: 'EW-KRS' },
      select: {
        id: true,
        code: true,
        name: true,
        minComponents: true,
        maxComponents: true,
      },
    });

    if (category) {
      console.log('Current Kurta Sets Category Values:');
      console.log(JSON.stringify(category, null, 2));
    } else {
      console.log('Kurta Sets category not found!');
    }
  } catch (error) {
    console.error('Error querying database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkKurtaSets();
