const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function setPolyBagPrice() {
  try {
    console.log('\n=== SETTING POLY BAG PRICE ===\n');

    // Update Poly Bag price
    const result = await prisma.packaging_master.updateMany({
      where: { packagingCode: 'PKG-0001' },
      data: { pricePerPiece: 2.50 } // ₹2.50 per piece
    });

    if (result.count > 0) {
      console.log(`✓ Updated Poly Bag (PKG-0001) price to ₹2.50/piece`);
      console.log(`\nAll 5 accessories now have prices set!`);
      console.log(`\nRun the diagnostic script to verify:`);
      console.log(`node scripts/test/check-master-prices.js`);
    } else {
      console.log(`⚠️  Poly Bag (PKG-0001) not found`);
    }

  } catch (e) {
    console.error('❌ ERROR:', e);
  } finally {
    await prisma.$disconnect();
  }
}

setPolyBagPrice();
