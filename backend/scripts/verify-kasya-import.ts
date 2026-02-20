/**
 * Verify Kasya Styles Import
 */

import prisma from '../src/config/database';

async function verify() {
  // Total Kasya styles
  const total = await prisma.styles.count({
    where: { customerName: 'House Of Kasya Pvt Ltd', isActive: true }
  });

  // By gender
  const byGender = await prisma.styles.groupBy({
    by: ['gender'],
    where: { customerName: 'House Of Kasya Pvt Ltd', isActive: true },
    _count: true
  });

  // Count with images
  const withImages = await prisma.styles.count({
    where: {
      customerName: 'House Of Kasya Pvt Ltd',
      isActive: true,
      image: { not: null }
    }
  });

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  VERIFICATION RESULTS');
  console.log('═══════════════════════════════════════════════════\n');
  console.log('📊 Total Kasya styles:', total);
  console.log('🖼️  Styles with images:', withImages);
  console.log('\n👥 By Gender:');
  for (const row of byGender) {
    console.log(`  ${row.gender}: ${row._count}`);
  }

  // Sample styles
  const samples = await prisma.styles.findMany({
    where: { customerName: 'House Of Kasya Pvt Ltd', isActive: true },
    take: 5,
    select: { styleCode: true, styleName: true, gender: true, image: true }
  });

  console.log('\n📝 Sample styles:');
  for (const s of samples) {
    console.log(`  ${s.styleCode} | ${s.gender} | image: ${s.image ? '✓' : '✗'}`);
  }

  console.log('\n═══════════════════════════════════════════════════\n');
}

verify()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
