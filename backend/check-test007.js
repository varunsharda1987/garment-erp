const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTest007() {
  try {
    console.log('\n=== Checking TEST007 Style ===\n');

    const style = await prisma.styles.findFirst({
      where: { styleCode: 'TEST007' },
      include: {
        style_components: true
      }
    });

    if (!style) {
      console.log('❌ No style found with code TEST007');
    } else {
      console.log('✅ Style Found:');
      console.log('Style Code:', style.styleCode);
      console.log('Brand Name:', style.brandName);
      console.log('Brand Category ID:', style.brandCategoryId);
      console.log('Customer Name:', style.customerName);
      console.log('\n--- Component Records ---');
      console.log('Actual style_components records:', style.style_components.length);

      if (style.style_components.length > 0) {
        style.style_components.forEach((comp, idx) => {
          console.log(`\nComponent ${idx + 1}:`);
          console.log('  Name:', comp.componentName);
          console.log('  Type:', comp.componentType);
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

checkTest007();
