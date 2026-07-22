/**
 * Verify fold length calculation for greige stock
 */
import prisma from '../src/config/database';
import greigeStockService from '../src/services/greige-stock.service';

async function verify() {
  console.log('=== FOLD LENGTH VERIFICATION TEST ===\n');

  // Find a greige to test with
  const greige = await prisma.greige_master.findFirst({
    where: { isActive: true },
    select: { id: true, greigeCode: true, greigeName: true }
  });

  if (!greige) {
    console.log('ERROR: No greige found');
    return;
  }

  console.log('Testing with greige:', greige.greigeCode);

  // Find a supplier
  const supplier = await prisma.suppliers.findFirst({
    where: { isActive: true },
    select: { id: true, name: true }
  });

  // Find a user
  const user = await prisma.users.findFirst({
    select: { id: true }
  });

  if (!user) {
    console.log('ERROR: No user found');
    return;
  }

  // Test data: 1000 MTR nominal, L=97, rate 50
  const testData = {
    greigeId: greige.id,
    quantity: 1000,  // NOMINAL
    width: 44,
    purchaseCost: 50,
    supplierId: supplier?.id,
    foldLengthCm: 97,  // L=97
    thanCount: 10,
    sourceType: 'MANUAL' as const
  };

  console.log('\n--- INPUT ---');
  console.log('  Nominal Qty:', testData.quantity, 'MTR');
  console.log('  Fold Length:', testData.foldLengthCm, 'cm');
  console.log('  Rate: ₹', testData.purchaseCost, '/MTR');

  const expectedActual = testData.quantity * testData.foldLengthCm / 100;
  const expectedCost = expectedActual * testData.purchaseCost;

  console.log('\n--- EXPECTED ---');
  console.log('  Actual Qty:', expectedActual, 'MTR (1000 × 97/100)');
  console.log('  Total Cost: ₹', expectedCost, '(970 × 50)');

  // Create stock entry
  const result = await greigeStockService.createGreigeStock(testData, user.id);

  // Fetch the created record to verify
  const stock = await prisma.greige_stock.findUnique({
    where: { id: result.id },
    select: {
      quantityAvailable: true,
      nominalQuantity: true,
      foldLengthCm: true,
      calculatedActualMeters: true,
      purchaseCost: true,
      procurementId: true
    }
  });

  if (!stock || !stock.procurementId) {
    console.log('ERROR: Stock not created properly');
    return;
  }

  const procurement = await prisma.fabric_procurement.findUnique({
    where: { id: stock.procurementId },
    select: {
      quantityPurchased: true,
      totalCost: true,
      ratePerUnit: true
    }
  });

  console.log('\n--- RESULT (greige_stock) ---');
  console.log('  quantityAvailable:', Number(stock.quantityAvailable));
  console.log('  nominalQuantity:', Number(stock.nominalQuantity));
  console.log('  foldLengthCm:', Number(stock.foldLengthCm));
  console.log('  calculatedActualMeters:', Number(stock.calculatedActualMeters));

  console.log('\n--- RESULT (fabric_procurement) ---');
  console.log('  quantityPurchased:', Number(procurement?.quantityPurchased));
  console.log('  totalCost: ₹', Number(procurement?.totalCost));
  console.log('  ratePerUnit: ₹', Number(procurement?.ratePerUnit));

  // Verify calculations
  const qtyCorrect = Number(stock.quantityAvailable) === expectedActual;
  const nominalCorrect = Number(stock.nominalQuantity) === testData.quantity;
  const costCorrect = Number(procurement?.totalCost) === expectedCost;

  console.log('\n=== VERIFICATION ===');
  console.log('Actual Qty (970):', qtyCorrect ? '✅ PASS' : '❌ FAIL - got ' + Number(stock.quantityAvailable));
  console.log('Nominal Qty (1000):', nominalCorrect ? '✅ PASS' : '❌ FAIL - got ' + Number(stock.nominalQuantity));
  console.log('Total Cost (48500):', costCorrect ? '✅ PASS' : '❌ FAIL - got ' + Number(procurement?.totalCost));

  // Cleanup - delete test record
  await prisma.greige_stock.delete({ where: { id: result.id } });
  await prisma.fabric_procurement.delete({ where: { id: stock.procurementId } });
  console.log('\nTest record cleaned up.');

  console.log('\n' + (qtyCorrect && nominalCorrect && costCorrect ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'));
}

verify()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
