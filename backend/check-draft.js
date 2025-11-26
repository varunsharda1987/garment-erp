const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDraft() {
  try {
    const drafts = await prisma.styles.findMany({
      where: { status: 'DRAFT', isActive: true },
      include: {
        style_components: {
          include: {
            style_fabrics: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: 1
    });

    if (drafts.length === 0) {
      console.log('No active drafts found');
    } else {
      console.log('\n=== Latest Draft Style ===\n');
      const draft = drafts[0];
      console.log('Style Code:', draft.styleCode);
      console.log('Style Name:', draft.styleName);
      console.log('Customer Name:', draft.customerName);
      console.log('Brand Name:', draft.brandName);
      console.log('Brand Category ID:', draft.brandCategoryId);
      console.log('Gender:', draft.gender);
      console.log('Components Count:', draft.style_components.length);

      if (draft.style_components.length > 0) {
        console.log('\nComponents:');
        draft.style_components.forEach((comp, idx) => {
          console.log(`  ${idx + 1}. ${comp.componentName} (${comp.componentType})`);
          console.log(`     Fabrics: ${comp.style_fabrics.length}`);
        });
      }
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkDraft();
