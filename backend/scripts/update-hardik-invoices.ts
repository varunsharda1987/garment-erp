/**
 * One-time script to update Hardik International entries with invoice numbers
 *
 * Run: npx ts-node --transpile-only scripts/update-hardik-invoices.ts
 */

import prisma from '../src/config/database';

async function main() {
  console.log('Updating Hardik International entries with invoice numbers...\n');

  // Find Hardik International supplier
  const supplier = await prisma.suppliers.findFirst({
    where: { name: { contains: 'Hardik', mode: 'insensitive' } }
  });

  if (!supplier) {
    console.log('ERROR: Hardik International supplier not found');
    return;
  }

  console.log(`Found supplier: ${supplier.code} - ${supplier.name}`);
  console.log(`Supplier ID: ${supplier.id}\n`);

  // Update the stock_movement entry (12596 MTR from 4/16/2026 with referenceNumber "7")
  const stockMovementUpdate = await prisma.stock_movements.updateMany({
    where: {
      supplierId: supplier.id,
      referenceNumber: '7',
    },
    data: {
      invoiceNumber: '7',
    }
  });
  console.log(`Updated ${stockMovementUpdate.count} stock_movement(s) with invoice #7`);

  // List all greige_stock entries from Hardik (user will need to provide invoice numbers)
  const greigeStocks = await prisma.greige_stock.findMany({
    where: { supplierId: supplier.id },
    include: {
      greige: { select: { greigeCode: true, greigeName: true } }
    },
    orderBy: { receivedDate: 'desc' }
  });

  console.log(`\nFound ${greigeStocks.length} greige_stock entries from Hardik:`);
  greigeStocks.forEach((g, i) => {
    const totalQty = Number(g.quantityAvailable) + Number(g.quantityConsumed) + Number(g.quantityReserved);
    console.log(`  ${i + 1}. ${g.greige?.greigeCode} - ${totalQty} MTR - Received: ${g.receivedDate.toLocaleDateString()} - Invoice: ${g.invoiceNumber || 'NONE'}`);
  });

  console.log('\nDone! The 12596 MTR stock movement now has invoice #7.');
  console.log('If you need to update greige_stock entries with specific invoice numbers, provide them and I can update.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
