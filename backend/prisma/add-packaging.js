const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addPackagingCategory() {
  try {
    const existing = await prisma.material_category.findFirst({
      where: { name: 'Packaging' }
    });
    
    if (existing) {
      console.log('Packaging category already exists:', existing);
    } else {
      const packaging = await prisma.material_category.create({
        data: {
          name: 'Packaging',
          description: 'Packaging materials'
        }
      });
      console.log('Created Packaging category:', packaging);
    }
    
    const allCategories = await prisma.material_category.findMany({
      orderBy: { name: 'asc' }
    });
    
    console.log('\nAll Material Categories:');
    allCategories.forEach(cat => {
      console.log('  -', cat.name, '(ID:', cat.id + ')');
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addPackagingCategory();
