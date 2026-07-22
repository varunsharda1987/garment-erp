import prisma from '../src/config/database';

async function main() {
  // Find greige_stock entries for GRG-0017
  const greige = await prisma.greige_master.findFirst({
    where: { greigeCode: 'GRG-0017' }
  });
  console.log('Greige GRG-0017:', greige?.id, '-', greige?.greigeName);

  if (greige) {
    const stocks = await prisma.greige_stock.findMany({
      where: { greigeId: greige.id },
      include: { supplier: { select: { name: true, code: true } } }
    });
    console.log('Greige stocks for GRG-0017:', stocks.length);
    stocks.forEach(s => {
      const total = Number(s.quantityAvailable) + Number(s.quantityConsumed);
      console.log(`  ID: ${s.id}`);
      console.log(`    Qty: ${total}, Supplier: ${s.supplier?.code} - ${s.supplier?.name}`);
      console.log(`    Received: ${s.receivedDate}, Invoice: ${s.invoiceNumber || 'NONE'}`);
    });
  }

  // Check if stock_movements has invoice fields
  const sm = await prisma.stock_movements.findFirst({
    where: { id: '7c080151-b34a-4cb9-885c-2826364a2235' }
  });
  console.log('\nStock Movement fields:', Object.keys(sm || {}));
}

main().catch(console.error).finally(() => prisma.$disconnect());
