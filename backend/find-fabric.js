const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findFabric() {
  try {
    console.log('\n=== Finding FAB-LNG236-002 ===\n');

    const fabric = await prisma.fabric_master.findFirst({
      where: { fabricCode: 'FAB-LNG236-002' },
      select: {
        id: true,
        fabricCode: true,
        fabricName: true,
      },
    });

    if (fabric) {
      console.log('Found fabric:');
      console.log(`  ID: ${fabric.id}`);
      console.log(`  Code: ${fabric.fabricCode}`);
      console.log(`  Name: ${fabric.fabricName}`);

      // Check allocations
      const allocations = await prisma.style_fabrics.findMany({
        where: { fabricId: fabric.id },
        include: {
          style_components: {
            include: {
              styles: {
                select: {
                  styleCode: true,
                  styleName: true,
                },
              },
            },
          },
          stylePatternParts: {
            include: {
              patternPart: {
                select: {
                  code: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      console.log(`\n  Allocations: ${allocations.length}`);

      if (allocations.length === 0) {
        console.log('\n  ❌ This is a STOCK fabric (no style allocations)');
        console.log('  The "Stock/Generic" source is CORRECT for this fabric.');
      } else {
        console.log('\n  ✅ This fabric has style allocations:');
        allocations.forEach((a) => {
          console.log(`    - ${a.style_components?.styles?.styleCode} / ${a.style_components?.componentName}`);
        });
      }
    } else {
      console.log('Fabric not found!');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

findFabric();
