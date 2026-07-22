import prisma from '../src/config/database';

async function check() {
  const procs = await prisma.fabric_procurement.findMany({
    select: {
      id: true,
      procurementType: true,
      isStockPurchase: true,
      purchaseOrderNumber: true,
      status: true
    },
    take: 15,
    orderBy: { createdAt: 'desc' }
  });

  console.log('Recent fabric_procurement records:');
  procs.forEach(p => {
    console.log(`  ${p.procurementType} | isStock:${p.isStockPurchase} | PO:${p.purchaseOrderNumber || 'none'} | ${p.status} | ${p.id.slice(0,25)}`);
  });

  // Count by type
  const byType = await prisma.fabric_procurement.groupBy({
    by: ['procurementType'],
    _count: true
  });
  console.log('\nBy procurementType:');
  byType.forEach(t => console.log(`  ${t.procurementType}: ${t._count}`));

  await prisma.$disconnect();
}

check().catch(console.error);
