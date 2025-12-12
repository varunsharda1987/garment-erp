const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debug() {
  // Get the style from the screenshot (COS009)
  const style = await prisma.styles.findFirst({
    where: { styleCode: 'COS009' },
    include: {
      style_components: {
        include: {
          style_fabrics: {
            include: {
              embroidery: true
            }
          }
        }
      }
    }
  });

  if (!style) {
    console.log('Style COS009 not found');
    return;
  }

  console.log('Style:', style.styleCode, style.styleName);
  console.log('\nComponents and fabrics:');

  for (const comp of style.style_components) {
    console.log('\n  Component:', comp.componentName);
    for (const fabric of comp.style_fabrics) {
      console.log('    Fabric:', fabric.genericFabricName, '| finish:', fabric.fabricFinishType, '| hasEmb:', fabric.hasEmbroidery);

      // Try to find greige for this
      const greiges = await prisma.greige_master.findMany({
        where: {
          genericFabricName: {
            equals: fabric.genericFabricName,
            mode: 'insensitive',
          },
          isActive: true,
        }
      });
      console.log('      -> Found', greiges.length, 'greige(s) for', fabric.genericFabricName);
    }
  }

  await prisma.$disconnect();
}

debug().catch(e => { console.error(e); process.exit(1); });
