import prisma from '../src/config/database';

async function main() {
  console.log('Finding Hardik International entries...');

  // Get supplier ID for Hardik
  const supplier = await prisma.suppliers.findFirst({
    where: { name: { contains: 'Hardik', mode: 'insensitive' } }
  });
  console.log('Supplier:', supplier?.id, '-', supplier?.name, '- Code:', supplier?.code);

  if (!supplier) {
    console.log('No supplier found');
    return;
  }

  // Find greige stock entries
  const greigeStocks = await prisma.greige_stock.findMany({
    where: { supplierId: supplier.id },
    include: {
      greige: { select: { greigeCode: true, greigeName: true } }
    },
    orderBy: { receivedDate: 'desc' }
  });

  console.log('\nGreige Stock entries:', greigeStocks.length);
  for (const g of greigeStocks) {
    const totalQty = Number(g.quantityAvailable) + Number(g.quantityConsumed) + Number(g.quantityReserved);
    console.log(`  ID: ${g.id}`);
    console.log(`    Greige: ${g.greige?.greigeCode} - ${g.greige?.greigeName}`);
    console.log(`    Total Qty: ${totalQty} (Avail: ${g.quantityAvailable}, Consumed: ${g.quantityConsumed})`);
    console.log(`    Received: ${g.receivedDate}`);
    console.log(`    Invoice#: ${g.invoiceNumber || 'NONE'}`);
  }

  // Find stock movements
  const movements = await prisma.stock_movements.findMany({
    where: { supplierId: supplier.id },
    include: {
      materials: { select: { code: true, name: true } }
    },
    orderBy: { movementDate: 'desc' }
  });

  console.log('\nStock Movements:', movements.length);
  for (const m of movements) {
    console.log(`  ID: ${m.id}`);
    console.log(`    Material: ${m.materials?.code} - ${m.materials?.name}`);
    console.log(`    Qty: ${m.quantity}`);
    console.log(`    Date: ${m.movementDate}`);
    console.log(`    RefNumber: ${m.referenceNumber}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
