const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const style = await prisma.styles.findFirst({
    where: { styleCode: 'TEST-001' },
    include: {
      color_options: true,
      size_options: true,
    }
  });

  console.log('Style:', style.styleCode);
  console.log('Color options:', style.color_options);
  console.log('Size options:', style.size_options);

  await prisma.$disconnect();
}

test();
