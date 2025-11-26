const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTest001() {
  try {
    console.log('\n=== Checking TEST001 Style ===\n');

    const style = await prisma.styles.findFirst({
      where: { styleCode: 'TEST001' },
      include: {
        style_components: {
          include: {
            style_fabrics: true
          }
        }
      }
    });

    if (!style) {
      console.log('❌ No style found with code TEST001');
    } else {
      console.log('✅ Style Found:');
      console.log('Style Code:', style.styleCode);
      console.log('Style Name:', style.styleName);
      console.log('Customer Name:', style.customerName);
      console.log('Brand Name:', style.brandName);
      console.log('Brand Category ID:', style.brandCategoryId);
      console.log('Category (legacy):', style.category);
      console.log('Status:', style.status);
      console.log('Is Active:', style.isActive);
      console.log('Number of Components:', style.numberOfComponents);
      console.log('\n--- Component Records ---');
      console.log('Actual style_components records:', style.style_components.length);

      if (style.style_components.length > 0) {
        style.style_components.forEach((comp, idx) => {
          console.log(`\nComponent ${idx + 1}:`);
          console.log('  ID:', comp.id);
          console.log('  Name:', comp.componentName);
          console.log('  Type:', comp.componentType);
          console.log('  Sort Order:', comp.sortOrder);
          console.log('  Fabrics:', comp.style_fabrics.length);
        });
      } else {
        console.log('⚠️  No style_components records found!');
      }
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkTest001();
