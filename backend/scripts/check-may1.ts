import prisma from '../src/config/database';

async function check() {
  const date = new Date('2026-05-01');
  const nextDay = new Date('2026-05-02');

  console.log('=== May 1st Greige Data ===\n');

  const gs = await prisma.greige_stock.findMany({
    where: { receivedDate: { gte: date, lt: nextDay } },
    include: { greige: { select: { greigeCode: true } } }
  });

  console.log('Greige Stock entries:', gs.length);
  gs.forEach(g => {
    console.log(`  ${g.greige.greigeCode}: ${g.quantityAvailable}m | source: ${g.sourceType} | proc: ${g.procurementId?.slice(0,25) || 'none'}`);
  });

  const procs = await prisma.fabric_procurement.findMany({
    where: { purchaseDate: { gte: date, lt: nextDay }, procurementType: 'GREIGE' },
    include: { greigeMaster: { select: { greigeCode: true } } }
  });

  console.log('\nFabric Procurement (GREIGE):', procs.length);
  procs.forEach(p => {
    console.log(`  ${p.greigeMaster?.greigeCode || '?'}: ${p.quantityPurchased}m | ${p.id.slice(0,25)}`);
  });

  await prisma.$disconnect();
}

check().catch(console.error);
