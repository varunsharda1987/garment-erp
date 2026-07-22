// Test greige stock creation to find the database error
import prisma from '../src/config/database';
import greigeStockService from '../src/services/greige-stock.service';

async function testGreigeStockCreation() {
  console.log('=== Testing Greige Stock Creation ===\n');

  // Get GRG-0034 details
  const greige = await prisma.greige_master.findFirst({
    where: { greigeCode: 'GRG-0034' },
    select: { id: true, greigeCode: true, greigeName: true, greigeWidth: true }
  });

  if (!greige) {
    console.log('GRG-0034 not found!');
    return;
  }

  console.log('Greige:', greige);

  // Get a valid warehouse
  const warehouse = await prisma.warehouses.findFirst({
    where: { isActive: true },
    select: { id: true, warehouseCode: true, warehouseName: true }
  });

  console.log('Warehouse:', warehouse);

  // Get a system user
  const user = await prisma.users.findFirst({
    select: { id: true, email: true }
  });

  console.log('User:', user);

  // Try to create greige stock
  try {
    console.log('\nAttempting to create greige stock...');
    const result = await greigeStockService.createGreigeStock({
      greigeId: greige.id,
      quantity: 100,
      width: Number(greige.greigeWidth) || 44,
      purchaseCost: 50,
      warehouseId: warehouse?.id,
      sourceType: 'MANUAL',
    }, user?.id || 'system');

    console.log('SUCCESS! Created:', result);
  } catch (error: any) {
    console.error('ERROR creating greige stock:');
    console.error('  Message:', error.message);
    if (error.code) console.error('  Code:', error.code);
    if (error.meta) console.error('  Meta:', JSON.stringify(error.meta));
    console.error('  Stack:', error.stack);
  }

  await prisma.$disconnect();
}

testGreigeStockCreation().catch(console.error);
