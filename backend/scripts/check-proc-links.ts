import prisma from '../src/config/database';

async function check() {
  // Find all PROC-GRG procurements
  const procs = await prisma.fabric_procurement.findMany({
    where: { id: { startsWith: 'PROC-GRG' } },
    select: { id: true, quantityPurchased: true, greigeId: true, purchaseDate: true },
    orderBy: { purchaseDate: 'desc' },
    take: 20
  });

  console.log('Recent PROC-GRG procurements:', procs.length);

  for (const p of procs) {
    const gs = await prisma.greige_stock.findFirst({
      where: { procurementId: p.id },
      select: { id: true, sourceType: true }
    });
    const dateStr = p.purchaseDate.toISOString().split('T')[0];
    console.log(`  ${dateStr} | ${p.quantityPurchased}m | sourceType: ${gs?.sourceType || 'NO-LINK'} | ${p.id.slice(0,25)}`);
  }

  await prisma.$disconnect();
}

check().catch(console.error);
