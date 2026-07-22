// Test the full Stock IN flow to find the database error
import prisma from '../src/config/database';
import stockMovementService from '../src/services/stockMovement.service';
import { Decimal } from '@prisma/client/runtime/library';

async function testStockInFlow() {
  console.log('=== Testing Full Stock IN Flow ===\n');

  // Get GRG-0034 material record
  const material = await prisma.materials.findFirst({
    where: { greigeId: { not: null }, greige_master: { greigeCode: 'GRG-0034' } },
    select: { id: true, code: true, name: true, greigeId: true }
  });

  console.log('Material:', material);

  if (!material) {
    console.log('Material record not found for GRG-0034!');
    return;
  }

  // Get warehouse and user
  const warehouse = await prisma.warehouses.findFirst({
    where: { warehouseCode: 'WH-RM-0001' },
    select: { id: true, warehouseCode: true }
  });
  console.log('Warehouse:', warehouse);

  // Get the supplier from the screenshot
  const supplier = await prisma.suppliers.findFirst({
    where: { code: 'SUP90574166' },
    select: { id: true, code: true, name: true }
  });
  console.log('Supplier:', supplier);

  const user = await prisma.users.findFirst({
    select: { id: true }
  });
  console.log('User:', user?.id);

  // Simulate the exact Stock IN call
  try {
    console.log('\nAttempting createStockIn...');
    const result = await stockMovementService.createStockIn({
      movementType: 'STOCK_IN',
      materialId: material.id,
      warehouseId: warehouse?.id || '',
      supplierId: supplier?.id,  // <-- This might be the issue
      quantity: new Decimal(100),
      unit: 'METER',
      rate: new Decimal(50),
      referenceType: 'STOCK_IN',
      referenceNumber: '203',  // From screenshot
      remarks: 'Test from script',
      performedById: user?.id || 'system',
    });

    console.log('SUCCESS! Movement:', result.id);
  } catch (error: any) {
    console.error('\nERROR in createStockIn:');
    console.error('  Message:', error.message);
    if (error.code) console.error('  Code:', error.code);
    if (error.meta) console.error('  Meta:', JSON.stringify(error.meta));
    console.error('\n  Full error:', error);
  }

  await prisma.$disconnect();
}

testStockInFlow().catch(console.error);
