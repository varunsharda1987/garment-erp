const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyCurrentCategories() {
  try {
    console.log('📊 Current Material Category Structure\n');
    console.log('=' .repeat(60) + '\n');

    // Get all parent categories
    const parents = await prisma.material_categories.findMany({
      where: { level: 1 },
      orderBy: { sortOrder: 'asc' }
    });

    console.log(`📁 Parent Categories (${parents.length}):\n`);

    for (const parent of parents) {
      console.log(`${parent.sortOrder}. ${parent.name}`);
      console.log(`   Description: ${parent.description}`);

      // Get children
      const children = await prisma.material_categories.findMany({
        where: { parentCategoryId: parent.id },
        orderBy: { sortOrder: 'asc' }
      });

      if (children.length > 0) {
        console.log(`   Children (${children.length}):`);
        children.forEach(child => {
          console.log(`      ${child.sortOrder}. ${child.name}`);
        });
      }
      console.log('');
    }

    // Count total categories
    const totalCategories = await prisma.material_categories.count();
    const totalChildren = await prisma.material_categories.count({ where: { level: 2 } });

    console.log('=' .repeat(60));
    console.log(`📊 Summary:`);
    console.log(`   - Parent Categories: ${parents.length}`);
    console.log(`   - Child Categories: ${totalChildren}`);
    console.log(`   - Total Categories: ${totalCategories}`);
    console.log('=' .repeat(60) + '\n');

    // Check for any materials
    const materialCount = await prisma.materials.count();
    console.log(`📦 Total Materials: ${materialCount}\n`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyCurrentCategories();
