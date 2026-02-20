/**
 * Test Script: Verify CAD Planning API returns pattern parts for Pants component
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧪 Testing CAD Planning API for Pattern Parts\n');

  // Find style NEL00154
  const style = await prisma.styles.findFirst({
    where: { styleCode: 'NEL00154' },
    include: {
      style_components: {
        include: {
          style_fabrics: {
            include: {
              stylePatternParts: {
                include: {
                  patternPart: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!style) {
    console.log('❌ Style NEL00154 not found in database');
    return;
  }

  console.log('📋 Style Found:');
  console.log(`   ID: ${style.id}`);
  console.log(`   Code: ${style.styleCode}`);
  console.log(`   Name: ${style.styleName}`);
  console.log('');

  // Find components in the style
  console.log('📋 Style Components:');
  for (const component of style.style_components) {
    console.log(`\n   Component: ${component.componentName} (${component.componentType || 'Unknown'})`);

    // Get the component master for this component
    const componentMaster = await prisma.component_masters.findFirst({
      where: { name: component.componentName },
      include: {
        componentGroup: true,
      },
    });

    if (!componentMaster) {
      console.log('      ⚠️  No component master found');
      continue;
    }

    console.log(`      Component Master ID: ${componentMaster.id}`);
    console.log(`      Component Group: ${componentMaster.componentGroup?.name || 'NONE'}`);

    // Get pattern parts for this component
    const patternParts = await prisma.component_pattern_parts.findMany({
      where: { componentId: componentMaster.id },
      include: {
        patternPart: true,
      },
    });

    console.log(`      Pattern Parts: ${patternParts.length} part(s)`);
    if (patternParts.length > 0) {
      patternParts.forEach(pp => {
        console.log(`         - ${pp.patternPart.name} (${pp.patternPart.code})`);
      });
    } else {
      console.log('         ❌ NO PATTERN PARTS ASSIGNED');
    }
  }

  console.log('\n✅ Test complete!');
  console.log('\n💡 Next step: Test in CAD Planning UI');
  console.log(`   Navigate to: http://localhost:5173/cad-planning/${style.id}`);
  console.log('   Click "Add Row" and check if Part dropdown shows pattern parts');

  await prisma.$disconnect();
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
