const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteInactiveStyles() {
  try {
    console.log('\n=== Finding inactive (soft-deleted) styles ===');

    const inactiveStyles = await prisma.styles.findMany({
      where: { isActive: false },
      select: {
        id: true,
        styleCode: true,
        styleName: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    if (inactiveStyles.length === 0) {
      console.log('No inactive styles found.');
      await prisma.$disconnect();
      return;
    }

    console.log(`\nFound ${inactiveStyles.length} inactive style(s):\n`);
    inactiveStyles.forEach((style, index) => {
      console.log(`${index + 1}. ${style.styleCode} - ${style.styleName}`);
      console.log(`   Status: ${style.status}, Created: ${style.createdAt.toISOString().split('T')[0]}`);
    });

    console.log('\n⚠️  WARNING: This will PERMANENTLY delete these styles and all related data!');
    console.log('   - Style components and fabrics');
    console.log('   - Style processes');
    console.log('   - Material BOM');
    console.log('   - Garment trims, value additions, packaging');
    console.log('   - Style variants');
    console.log('   - This action CANNOT be undone!\n');

    // Uncomment the following lines to actually perform the deletion
    // const readline = require('readline').createInterface({
    //   input: process.stdin,
    //   output: process.stdout
    // });

    // readline.question('Type "DELETE" to confirm permanent deletion: ', async (answer) => {
    //   if (answer === 'DELETE') {
    //     console.log('\nDeleting...');
    //
    //     const result = await prisma.styles.deleteMany({
    //       where: { isActive: false }
    //     });
    //
    //     console.log(`✅ Permanently deleted ${result.count} style(s)`);
    //   } else {
    //     console.log('Deletion cancelled.');
    //   }
    //
    //   readline.close();
    //   await prisma.$disconnect();
    // });

    console.log('💡 To actually delete, uncomment the deletion code in this script.');
    await prisma.$disconnect();

  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

deleteInactiveStyles();
