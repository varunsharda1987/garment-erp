const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkFabricSuppliers() {
  try {
    console.log('🔍 Checking Fabric Suppliers for old field names...\n');

    const fabricSuppliers = await prisma.suppliers.findMany({
      where: { supplierCategory: 'FABRIC_SUPPLIER' }
    });

    console.log(`📊 Total Fabric Suppliers: ${fabricSuppliers.length}\n`);

    if (fabricSuppliers.length > 0) {
      console.log('Supplier Details:\n');
      fabricSuppliers.forEach(supplier => {
        console.log(`📦 ${supplier.name} (${supplier.code})`);
        if (supplier.categoryData) {
          const data = supplier.categoryData;
          console.log('   Category Data:');
          console.log(`   - fabricCategories:`, data.fabricCategories);
          if (data.readyFabricTypes) {
            console.log(`   - readyFabricTypes (OLD):`, data.readyFabricTypes);
          }
          if (data.finishedFabricTypes) {
            console.log(`   - finishedFabricTypes (NEW):`, data.finishedFabricTypes);
          }
          if (data.greigeFabricTypes) {
            console.log(`   - greigeFabricTypes:`, data.greigeFabricTypes);
          }
        } else {
          console.log('   No category data');
        }
        console.log('');
      });
    } else {
      console.log('✅ No fabric suppliers found in database\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkFabricSuppliers();
