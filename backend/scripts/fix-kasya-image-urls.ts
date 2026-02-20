/**
 * Fix Image URLs for Kasya Styles
 *
 * The import script set `image` field but not `imageUrl` which the frontend uses.
 * This script updates `imageUrl` based on the `image` field.
 */

import prisma from '../src/config/database';

async function fixImageUrls() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  FIX KASYA STYLE IMAGE URLS');
  console.log('═══════════════════════════════════════════════════\n');

  // Count styles that need fixing
  const needsFix = await prisma.styles.count({
    where: {
      customerName: 'House Of Kasya Pvt Ltd',
      image: { not: null },
      imageUrl: null,
    },
  });

  console.log(`📊 Styles needing image URL fix: ${needsFix}`);

  if (needsFix === 0) {
    console.log('✅ No styles need fixing. All done!\n');
    return;
  }

  // Update imageUrl based on image field
  const result = await prisma.$executeRaw`
    UPDATE styles
    SET "imageUrl" = '/uploads/styles/' || image
    WHERE "customerName" = 'House Of Kasya Pvt Ltd'
      AND image IS NOT NULL
      AND "imageUrl" IS NULL
  `;

  console.log(`✅ Updated ${result} styles with image URLs`);

  // Verify
  const stillMissing = await prisma.styles.count({
    where: {
      customerName: 'House Of Kasya Pvt Ltd',
      image: { not: null },
      imageUrl: null,
    },
  });

  const withImages = await prisma.styles.count({
    where: {
      customerName: 'House Of Kasya Pvt Ltd',
      imageUrl: { not: null },
    },
  });

  console.log(`\n📊 Verification:`);
  console.log(`  Styles with imageUrl: ${withImages}`);
  console.log(`  Still missing imageUrl: ${stillMissing}`);
  console.log('\n═══════════════════════════════════════════════════\n');
}

fixImageUrls()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
