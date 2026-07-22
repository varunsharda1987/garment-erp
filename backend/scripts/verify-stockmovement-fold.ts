/**
 * Verify fold length calculation for stock movements (StockInForm path)
 */
import prisma from '../src/config/database';
import stockMovementService from '../src/services/stockMovement.service';
import { Decimal } from '@prisma/client/runtime/library';

async function verify() {
  console.log('=== STOCK MOVEMENT FOLD LENGTH VERIFICATION ===\n');

  // Find a material to test with
  const material = await prisma.materials.findFirst({
    where: { materialType: 'GREIGE' },
    select: { id: true, code: true, name: true }
  });

  if (!material) {
    console.log('ERROR: No GREIGE material found');
    return;
  }

  console.log('Testing with material:', material.code);

  // Find a warehouse
  const warehouse = await prisma.warehouses.findFirst({
    where: { isActive: true },
    select: { id: true, warehouseCode: true }
  });

  if (!warehouse) {
    console.log('ERROR: No warehouse found');
    return;
  }

  // Find a user
  const user = await prisma.users.findFirst({
    select: { id: true }
  });

  if (!user) {
    console.log('ERROR: No user found');
    return;
  }

  // Test data: 500 MTR nominal, L=95, rate 40
  const nominalQty = 500;
  const foldLength = 95;
  const rate = 40;
  const expectedActual = nominalQty * foldLength / 100; // 475
  const expectedValue = expectedActual * rate; // 19000

  console.log('\n--- INPUT ---');
  console.log('  Nominal Qty:', nominalQty, 'MTR');
  console.log('  Fold Length:', foldLength, 'cm');
  console.log('  Rate: ₹', rate, '/MTR');

  console.log('\n--- EXPECTED ---');
  console.log('  Actual Qty:', expectedActual, 'MTR');
  console.log('  Total Value: ₹', expectedValue);

  // Create stock movement
  const result = await stockMovementService.createStockIn({
    materialId: material.id,
    warehouseId: warehouse.id,
    quantity: new Decimal(nominalQty), // NOMINAL
    unit: 'METER',
    rate: new Decimal(rate),
    foldLengthCm: new Decimal(foldLength),
    thanCount: 5,
    performedById: user.id,
    referenceType: 'TEST',
    referenceNumber: 'FOLD-TEST-001'
  });

  console.log('\n--- RESULT (stock_movements) ---');
  console.log('  quantity:', Number(result.quantity));
  console.log('  value: ₹', Number(result.value));
  console.log('  foldLengthCm:', Number(result.foldLengthCm));
  console.log('  remarks:', result.remarks);

  // Verify calculations
  const qtyCorrect = Number(result.quantity) === expectedActual;
  const valueCorrect = Number(result.value) === expectedValue;

  console.log('\n=== VERIFICATION ===');
  console.log('Actual Qty (475):', qtyCorrect ? '✅ PASS' : '❌ FAIL - got ' + Number(result.quantity));
  console.log('Total Value (19000):', valueCorrect ? '✅ PASS' : '❌ FAIL - got ' + Number(result.value));

  // Cleanup
  await prisma.stock_transactions.deleteMany({ where: { referenceNumber: 'FOLD-TEST-001' } });
  await prisma.stock_movements.delete({ where: { id: result.id } });
  console.log('\nTest record cleaned up.');

  console.log('\n' + (qtyCorrect && valueCorrect ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'));
}

verify()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
