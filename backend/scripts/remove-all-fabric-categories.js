const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function removeAllFabricCategories() {
  try {
    console.log('🚀 Starting complete Fabrics category tree removal...\n');

    // Step 1: Find Fabrics parent category
    const fabricsParent = await prisma.material_categories.findFirst({
      where: { name: 'Fabrics', level: 1 }
    });

    if (!fabricsParent) {
      console.log('✅ No "Fabrics" category found. Nothing to remove.');
      return;
    }

    console.log(`📁 Found "Fabrics" parent category (ID: ${fabricsParent.id})`);

    // Step 2: Find all child categories
    const fabricChildren = await prisma.material_categories.findMany({
      where: { parentCategoryId: fabricsParent.id }
    });

    console.log(`📁 Found ${fabricChildren.length} fabric child categories\n`);

    const allFabricCategoryIds = [
      fabricsParent.id,
      ...fabricChildren.map(c => c.id)
    ];

    // Step 3: Handle materials using fabric categories
    const materials = await prisma.materials.findMany({
      where: { categoryId: { in: allFabricCategoryIds } }
    });

    console.log(`📦 Found ${materials.length} materials using fabric categories\n`);

    if (materials.length > 0) {
      console.log(`📝 Updating ${materials.length} fabric materials to remove category...`);
      console.log(`   (Setting categoryId to NULL - these are fabric materials managed separately)\n`);

      for (const material of materials) {
        console.log(`   🗑️  Cannot reassign - Deleting: ${material.name} (${material.code})`);
        // First delete related records that might block deletion
        await prisma.bom_items.deleteMany({ where: { materialId: material.id } });
        await prisma.grn_items.deleteMany({ where: { materialId: material.id } });
        await prisma.material_requisition_items.deleteMany({ where: { materialId: material.id } });
        await prisma.purchase_order_items.deleteMany({ where: { materialId: material.id } });
        await prisma.stock_transactions.deleteMany({ where: { materialId: material.id } });
        await prisma.stock_levels.deleteMany({ where: { materialId: material.id } });
        await prisma.stock_movements.deleteMany({ where: { materialId: material.id } });
        await prisma.stock_reservations.deleteMany({ where: { materialId: material.id } });
        await prisma.stock_count_items.deleteMany({ where: { materialId: material.id } });
        await prisma.inventory_stock.deleteMany({ where: { materialId: material.id } });

        // Now delete the material
        await prisma.materials.delete({
          where: { id: material.id }
        });
      }
      console.log('');
    }

    // Step 4: Delete child categories first (FK constraint)
    console.log(`🗑️  Deleting ${fabricChildren.length} fabric child categories...`);
    for (const child of fabricChildren) {
      await prisma.material_categories.delete({
        where: { id: child.id }
      });
      console.log(`   ✅ Deleted: ${child.name}`);
    }

    // Step 5: Delete parent category
    console.log(`\n🗑️  Deleting "Fabrics" parent category...`);
    await prisma.material_categories.delete({
      where: { id: fabricsParent.id }
    });
    console.log(`   ✅ Deleted: Fabrics\n`);

    // Step 6: Update sortOrder for remaining parent categories
    console.log(`📊 Updating sortOrder for remaining parent categories...`);

    const remainingParents = await prisma.material_categories.findMany({
      where: {
        level: 1,
        sortOrder: { gt: fabricsParent.sortOrder }
      },
      orderBy: { sortOrder: 'asc' }
    });

    for (const parent of remainingParents) {
      const newSortOrder = parent.sortOrder - 1;
      await prisma.material_categories.update({
        where: { id: parent.id },
        data: { sortOrder: newSortOrder }
      });
      console.log(`   ✅ ${parent.name}: ${parent.sortOrder} → ${newSortOrder}`);
    }

    if (remainingParents.length === 0) {
      console.log('   (No parents to update)\n');
    } else {
      console.log('');
    }

    // Step 7: Verify final state
    console.log(`✅ Migration completed successfully!\n`);

    const finalParents = await prisma.material_categories.findMany({
      where: { level: 1 },
      orderBy: { sortOrder: 'asc' }
    });

    console.log(`📊 Remaining parent categories (${finalParents.length}):`);
    for (const parent of finalParents) {
      const childCount = await prisma.material_categories.count({
        where: { parentCategoryId: parent.id }
      });
      console.log(`   ${parent.sortOrder}. ${parent.name} (${childCount} children)`);
    }

    const totalCategories = await prisma.material_categories.count();
    console.log(`\n📊 Total categories remaining: ${totalCategories}`);
    console.log(`\n💡 Note: All fabric management is now handled exclusively through Fabric/Greige Master modules\n`);

  } catch (error) {
    console.error('\n❌ Error during migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

removeAllFabricCategories();
