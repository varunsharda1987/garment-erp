import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixKurtaSets() {
  try {
    console.log('Fixing Kurta Sets max_components...\n');

    // Show current value
    const before = await prisma.product_category_master.findFirst({
      where: { code: 'EW-KRS' },
      select: { code: true, name: true, minComponents: true, maxComponents: true },
    });

    console.log('Before update:');
    console.log(JSON.stringify(before, null, 2));

    // Update to max_components = 4
    await prisma.product_category_master.updateMany({
      where: { code: 'EW-KRS' },
      data: { maxComponents: 4 },
    });

    // Get updated value
    const after = await prisma.product_category_master.findFirst({
      where: { code: 'EW-KRS' },
      select: { code: true, name: true, minComponents: true, maxComponents: true },
    });

    console.log('\nAfter update:');
    console.log(JSON.stringify(after, null, 2));

    console.log('\n✅ Kurta Sets max_components updated successfully!');
  } catch (error) {
    console.error('Error updating Kurta Sets:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixKurtaSets();
