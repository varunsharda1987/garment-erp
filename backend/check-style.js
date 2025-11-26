const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkStyle() {
  try {
    const styles = await prisma.styles.findMany({
      where: { styleCode: 'COS001' },
      select: {
        id: true,
        styleCode: true,
        styleName: true,
        status: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    console.log('\n=== Styles with code COS001 ===');
    if (styles.length === 0) {
      console.log('No styles found with code COS001');
    } else {
      styles.forEach(style => {
        console.log(JSON.stringify(style, null, 2));
      });
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkStyle();
