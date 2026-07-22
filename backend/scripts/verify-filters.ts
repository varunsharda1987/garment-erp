import prisma from '../src/config/database';

async function verify() {
  console.log('=== Verifying Stock Movement Filters ===\n');

  // Check fabric_procurement isStockPurchase values
  const procStats = await prisma.fabric_procurement.groupBy({
    by: ['isStockPurchase'],
    _count: true
  });
  console.log('Fabric Procurement by isStockPurchase:');
  procStats.forEach(s => console.log(`  ${s.isStockPurchase}: ${s._count} records`));

  // Check greige_stock sourceType values
  const greigeStats = await prisma.greige_stock.groupBy({
    by: ['sourceType'],
    _count: true
  });
  console.log('\nGreige Stock by sourceType:');
  greigeStats.forEach(s => console.log(`  ${s.sourceType || 'null'}: ${s._count} records`));

  // What will show after filters
  const visibleProcs = await prisma.fabric_procurement.count({
    where: { isStockPurchase: { not: true } }
  });
  const hiddenProcs = await prisma.fabric_procurement.count({
    where: { isStockPurchase: true }
  });
  console.log(`\nFabric Procurement: ${visibleProcs} visible, ${hiddenProcs} hidden`);

  const visibleGreige = await prisma.greige_stock.count({
    where: { sourceType: { not: 'MANUAL' } }
  });
  const hiddenGreige = await prisma.greige_stock.count({
    where: { sourceType: 'MANUAL' }
  });
  console.log(`Greige Stock: ${visibleGreige} visible, ${hiddenGreige} hidden`);

  await prisma.$disconnect();
}

verify().catch(console.error);
