const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAllFabricMaterials() {
  try {
    console.log('🔍 Checking for materials with ANY Fabrics-related category...\n');

    // Find the Fabrics parent category
    const fabricsParent = await prisma.material_categories.findFirst({
      where: { name: 'Fabrics', level: 1 }
    });

    if (!fabricsParent) {
      console.log('✅ No "Fabrics" parent category found.');
      return;
    }

    console.log(`📁 Found "Fabrics" parent category (ID: ${fabricsParent.id})\n`);

    // Find all child categories of Fabrics
    const fabricChildren = await prisma.material_categories.findMany({
      where: { parentCategoryId: fabricsParent.id },
      orderBy: { sortOrder: 'asc' }
    });

    console.log(`📊 Fabric child categories (${fabricChildren.length}):`);
    fabricChildren.forEach(cat => {
      console.log(`   ${cat.sortOrder}. ${cat.name} (ID: ${cat.id})`);
    });

    // Get all fabric category IDs (parent + children)
    const allFabricCategoryIds = [
      fabricsParent.id,
      ...fabricChildren.map(c => c.id)
    ];

    console.log(`\n🔎 Searching for materials using any of these ${allFabricCategoryIds.length} categories...\n`);

    // Find materials using any fabric category
    const materials = await prisma.materials.findMany({
      where: {
        categoryId: { in: allFabricCategoryIds }
      },
      include: {
        material_categories: true
      }
    });

    console.log(`📦 Total materials found: ${materials.length}\n`);

    if (materials.length > 0) {
      // Group by category
      const byCategory = {};
      materials.forEach(mat => {
        const catName = mat.material_categories?.name || 'Unknown';
        if (!byCategory[catName]) byCategory[catName] = [];
        byCategory[catName].push(mat);
      });

      console.log('Materials grouped by category:\n');
      Object.entries(byCategory).forEach(([catName, mats]) => {
        console.log(`📁 ${catName} (${mats.length} materials):`);
        mats.forEach(mat => {
          console.log(`   - ${mat.name} (${mat.code})`);
          console.log(`     Material Type: ${mat.materialType}`);
          if (mat.categoryData) {
            console.log(`     Has CategoryData: Yes`);
          }
        });
        console.log('');
      });
    }

    // Check for other parent categories to see new sortOrder
    const otherParents = await prisma.material_categories.findMany({
      where: {
        level: 1,
        id: { not: fabricsParent.id }
      },
      orderBy: { sortOrder: 'asc' }
    });

    console.log(`\n📊 Other parent categories (will need sortOrder adjustment):`);
    otherParents.forEach(cat => {
      console.log(`   - ${cat.name} (current: ${cat.sortOrder}, will be: ${cat.sortOrder - 1})`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAllFabricMaterials();
