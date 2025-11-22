const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkStyles() {
  try {
    const styles = await prisma.styles.findMany({
      where: { styleCode: { in: ['EMG002', 'EMG003'] }},
      include: {
        style_components: {
          include: {
            style_fabrics: true
          }
        },
        style_garment_trims: true,
        style_value_additions: true,
        style_packaging: true
      }
    });

    styles.forEach(style => {
      console.log(`\n=== ${style.styleCode} ===`);
      console.log(`Components: ${style.style_components.length}`);
      style.style_components.forEach(c => {
        console.log(`  - ${c.componentName} - Fabrics: ${c.style_fabrics.length}`);
      });
      console.log(`Garment Trims: ${style.style_garment_trims.length}`);
      console.log(`Value Additions: ${style.style_value_additions.length}`);
      console.log(`Packaging: ${style.style_packaging.length}`);
    });

    await prisma.$disconnect();
  } catch (e) {
    console.error(e);
    await prisma.$disconnect();
  }
}

checkStyles();
