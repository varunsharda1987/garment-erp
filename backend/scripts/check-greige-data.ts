import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Checking Greige Stock Data ===\n');

  const total = await prisma.greige_stock.aggregate({
    where: { status: 'AVAILABLE' },
    _sum: { quantityAvailable: true },
    _count: true,
  });

  console.log('Total AVAILABLE greige_stock:');
  console.log('  Count:', total._count);
  console.log('  Total qty:', Number(total._sum.quantityAvailable || 0).toFixed(2), 'm');

  // Check the service call
  const stocks = await prisma.greige_stock.findMany({
    where: { status: 'AVAILABLE' },
    select: {
      id: true,
      greigeId: true,
      quantityAvailable: true,
      greige: {
        select: { greigeCode: true },
      },
    },
    take: 5,
  });

  console.log('\nSample entries:');
  for (const s of stocks) {
    console.log(`  ${s.greige?.greigeCode}: ${Number(s.quantityAvailable).toFixed(2)} m`);
  }

  await prisma.$disconnect();
}

main();
