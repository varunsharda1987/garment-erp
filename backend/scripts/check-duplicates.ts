import prisma from '../src/config/database';

async function checkDuplicates() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  console.log('=== Checking All Records from Today ===\n');

  // Greige stock
  const greigeStocks = await prisma.greige_stock.findMany({
    where: { createdAt: { gte: today } },
    include: { greige: { select: { greigeCode: true } } },
    orderBy: { createdAt: 'asc' }
  });
  console.log(`Greige Stock (${greigeStocks.length}):`);
  for (const g of greigeStocks) {
    console.log(`  ${g.greige.greigeCode}: ${g.quantityAvailable} meters - ${g.sourceType || 'null'} - ${g.id.slice(0,8)}`);
  }

  // Fabric procurement
  const procs = await prisma.fabric_procurement.findMany({
    where: { createdAt: { gte: today }, procurementType: 'GREIGE' },
    orderBy: { createdAt: 'asc' }
  });
  console.log(`\nFabric Procurement GREIGE (${procs.length}):`);
  for (const p of procs) {
    console.log(`  ${p.quantityPurchased} meters - ${p.status} - ${p.id.slice(0,20)}`);
  }

  // Stock movements
  const movements = await prisma.stock_movements.findMany({
    where: { createdAt: { gte: today }, movementType: 'STOCK_IN' },
    include: { materials: { select: { code: true } } },
    orderBy: { createdAt: 'asc' }
  });
  console.log(`\nStock Movements STOCK_IN (${movements.length}):`);
  for (const m of movements) {
    console.log(`  ${m.materials?.code || 'no-material'}: ${m.quantity} - ref:${m.referenceNumber || 'none'} - ${m.id.slice(0,8)}`);
  }

  await prisma.$disconnect();
}

checkDuplicates().catch(console.error);
