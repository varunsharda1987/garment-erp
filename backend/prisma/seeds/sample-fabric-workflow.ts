/**
 * Sample Fabric Workflow Seed Data
 *
 * Creates a complete example workflow demonstrating:
 * 1. Greige procurement
 * 2. Processing greige to finished fabric
 * 3. Stock management with quality grading
 * 4. Cross-style allocation
 * 5. Weighted average costing
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding sample fabric workflow data...\n');

  try {
    // Get default user
    const adminUser = await prisma.users.findFirst({
      where: { role: 'ADMIN' },
    });

    if (!adminUser) {
      console.log('❌ No admin user found. Please create a user first.');
      return;
    }

    const userId = adminUser.id;

    // Get or create a supplier
    let supplier = await prisma.suppliers.findFirst({
      where: { code: 'SUP-001' },
    });

    if (!supplier) {
      supplier = await prisma.suppliers.create({
        data: {
          id: `supplier-${Date.now()}`,
          code: 'SUP-001',
          name: 'ABC Textiles Ltd',
          contactPerson: 'John Doe',
          email: 'john@abctextiles.com',
          phone: '+1-555-0100',
          address: '123 Fabric Street, Textile City',
          supplierCategory: 'FABRIC',
          isActive: true,
          createdById: userId,
          updatedAt: new Date(),
        },
      });
      console.log('✅ Created sample supplier: ABC Textiles Ltd');
    }

    // Get or create processing mill
    let processingMill = await prisma.suppliers.findFirst({
      where: { code: 'MILL-001' },
    });

    if (!processingMill) {
      processingMill = await prisma.suppliers.create({
        data: {
          id: `mill-${Date.now()}`,
          code: 'MILL-001',
          name: 'Premium Dyeing & Finishing Mill',
          contactPerson: 'Jane Smith',
          email: 'jane@premiummill.com',
          phone: '+1-555-0200',
          address: '456 Processing Lane, Mill Town',
          supplierCategory: 'SERVICE_PROVIDER',
          isActive: true,
          createdById: userId,
          updatedAt: new Date(),
        },
      });
      console.log('✅ Created sample processing mill: Premium Dyeing & Finishing Mill');
    }

    // Create sample greige master
    const greige = await prisma.greige_master.create({
      data: {
        greigeCode: 'GRG-COTTON-100-58',
        greigeName: '100% Cotton Poplin 58"',
        yarnCount: '40x40',
        construction: '133x72',
        composition: '100% Cotton',
        weaveType: 'Plain',
        greigeWidth: 58,
        expectedFinishedWidthMin: 56,
        expectedFinishedWidthMax: 57,
        averageShrinkagePercent: 8,
        supplierId: supplier.id,
        gsmRange: '120-130',
        costPerMeter: 3.50,
        moq: 1000,
        leadTimeDays: 30,
        description: 'Premium 100% cotton poplin base fabric for dyeing and printing',
        isActive: true,
        createdById: userId,
      },
    });
    console.log('✅ Created greige master:', greige.greigeName);

    // Create sample style for origin tracking
    const style = await prisma.styles.create({
      data: {
        id: `style-sample-${Date.now()}`,
        styleCode: 'STY-SHIRT-001',
        styleName: 'Classic Navy Shirt',
        gender: 'UNISEX',
        ageGroup: 'ADULT',
        description: 'Classic navy blue cotton shirt with button front',
        isActive: true,
        createdById: userId,
        updatedAt: new Date(),
      },
    });
    console.log('✅ Created sample style:', style.styleName);

    // Create sample order for origin tracking
    const customer = await prisma.customers.findFirst();
    if (!customer) {
      console.log('⚠️  No customer found. Skipping order creation.');
      return;
    }

    const order = await prisma.orders.create({
      data: {
        id: `order-sample-${Date.now()}`,
        orderNumber: `ORD-${Date.now()}`,
        customerId: customer.id,
        orderDate: new Date(),
        expectedDeliveryDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
        status: 'IN_PRODUCTION',
        priority: 'HIGH',
        totalQuantity: 500,
        totalAmount: 7500,
        createdById: userId,
        updatedAt: new Date(),
      },
    });
    console.log('✅ Created sample order:', order.orderNumber);

    // Step 1: Procurement - Buy greige for specific order
    const procurement1 = await prisma.fabric_procurement.create({
      data: {
        procurementType: 'GREIGE',
        purchaseOrderNumber: `PO-${Date.now()}-GRG`,
        supplierId: supplier.id,
        greigeId: greige.id,
        quantityPurchased: 800, // meters
        unit: 'meters',
        width: 58,
        ratePerUnit: 3.50,
        totalCost: 2800, // 800 * 3.50
        orderedForStyleId: style.id,
        orderedForOrderId: order.id,
        isStockPurchase: false,
        processingRequired: true,
        processingType: 'SOLID_DYEING',
        processingColor: 'Navy Blue',
        status: 'RECEIVED',
        purchaseDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
        receivedDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
        createdById: userId,
      },
    });
    console.log('✅ Created procurement 1: Greige for Order (800m)');

    // Step 2: Procurement - Buy extra greige for stock (MOQ excess)
    const procurement2 = await prisma.fabric_procurement.create({
      data: {
        procurementType: 'GREIGE',
        purchaseOrderNumber: `PO-${Date.now()}-GRG-STOCK`,
        supplierId: supplier.id,
        greigeId: greige.id,
        quantityPurchased: 200, // meters (MOQ excess)
        unit: 'meters',
        width: 58,
        ratePerUnit: 3.50,
        totalCost: 700, // 200 * 3.50
        isStockPurchase: true, // This is MOQ excess
        processingRequired: false,
        status: 'RECEIVED',
        purchaseDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        receivedDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        createdById: userId,
      },
    });
    console.log('✅ Created procurement 2: Greige for Stock - MOQ Excess (200m)');

    // Step 3: Processing - Send greige for dyeing
    const processing = await prisma.fabric_processing.create({
      data: {
        procurementId: procurement1.id,
        processingMillId: processingMill.id,
        processingType: 'SOLID_DYEING',
        batchNumber: `BATCH-NAVY-${Date.now()}`,
        greigeId: greige.id,
        greigeQuantitySent: 800,
        greigeWidth: 58,
        expectedFinishedWidthMin: 56,
        expectedFinishedWidthMax: 57,
        expectedShrinkagePercent: 8,
        actualFinishedWidth: 56.5,
        actualQuantityReceived: 735, // 8% shrinkage + 0.5% loss
        actualShrinkagePercent: 8.1,
        processingLossMeters: 4, // 0.5% loss
        widthVarianceInches: 0.5, // Expected 56-57, got 56.5
        shrinkageVariancePercent: 0.1, // Expected 8%, got 8.1%
        millAvgShrinkage: 8.2, // This mill's average
        varianceFromMillAvg: -0.1, // Better than mill average
        greigeCost: 2800, // From procurement
        processingCost: 1200, // $1.50 per meter * 800m
        totalFinishedCost: 4000,
        costPerMeter: 5.44, // 4000 / 735m
        processingStatus: 'COMPLETED',
        sentDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
        receivedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        createdById: userId,
      },
    });
    console.log('✅ Created processing record: Greige → Navy Blue Finished');

    // Create finished fabric master
    const finishedFabric = await prisma.fabric_master.create({
      data: {
        fabricCode: 'FAB-COTTON-NAVY-56',
        fabricName: 'Navy Blue Cotton Poplin 56"',
        greigeId: greige.id,
        colorName: 'Navy Blue',
        colorCode: 'PMS 2965C',
        finishType: 'solid',
        finishProcess: 'Reactive Dyed, Sanforized',
        actualWidth: 56.5,
        actualGSM: 125,
        actualShrinkagePercent: 8.1,
        supplierId: supplier.id,
        costPerMeter: 5.44,
        moq: 500,
        leadTimeDays: 45,
        description: 'Navy blue reactive dyed cotton poplin, sanforized finish',
        isActive: true,
        createdById: userId,
      },
    });
    console.log('✅ Created finished fabric master:', finishedFabric.fabricName);

    // Link processing to finished fabric
    await prisma.fabric_processing.update({
      where: { id: processing.id },
      data: { finishedFabricId: finishedFabric.id },
    });

    // Step 4: Quality Inspection
    const inspection = await prisma.quality_inspection.create({
      data: {
        inspectionType: 'INCOMING',
        fabricProcurementId: procurement1.id,
        fabricId: finishedFabric.id,
        width: 56.5,
        quantityInspected: 735,
        inspectorId: userId,
        inspectionDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        defectTypes: JSON.stringify([
          { type: 'Shade variation', severity: 2, points: 4 },
          { type: 'Minor slub', severity: 1, points: 2 },
        ]),
        defectPoints: 6,
        defectMeters: 15, // 15m with defects
        defectPercentage: 2.04, // 15/735 * 100
        qualityGrade: 'A', // Overall A grade
        aGradeQuantity: 720,
        bGradeQuantity: 0,
        defectQuantity: 15,
        aGradeValue: 3916.80, // 720 * 5.44
        bGradeValue: 0,
        defectValue: 52.50, // 15 * 3.50 (greige cost per business rule)
        totalLoss: 52.50,
        action: 'Accept with minor defects segregated',
        createdById: userId,
      },
    });
    console.log('✅ Created quality inspection: A-grade with 15m defects');

    // Step 5: Create Stock - A Grade (main stock)
    const stockAGrade = await prisma.fabric_stock.create({
      data: {
        fabricId: finishedFabric.id,
        width: 56.5,
        quantityAvailable: 720,
        quantityReserved: 0,
        quantityConsumed: 0,
        procurementId: procurement1.id,
        originStyleId: style.id,
        originOrderId: order.id,
        status: 'AVAILABLE',
        stockType: 'PLANNED_STOCK',
        plannedCad: 1.8, // meters per piece
        weightedAvgCost: 5.44,
        purchaseCost: 5.44,
        qualityGrade: 'A',
        receivedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        agingDays: 1,
        warehouseLocation: 'WH-A',
        rackNumber: 'R-101',
        rollNumbers: 'ROLL-001 to ROLL-015',
        createdById: userId,
      },
    });
    console.log('✅ Created stock: A-Grade Navy Fabric (720m)');

    // Step 6: Create Stock - Defect Grade (business rule: value = greige cost)
    const stockDefect = await prisma.fabric_stock.create({
      data: {
        fabricId: finishedFabric.id,
        width: 56.5,
        quantityAvailable: 15,
        quantityReserved: 0,
        quantityConsumed: 0,
        procurementId: procurement1.id,
        originStyleId: style.id,
        originOrderId: order.id,
        status: 'AVAILABLE',
        stockType: 'VARIANCE_UNUSED',
        qualityGrade: 'DEFECT',
        defectMeters: 15,
        defectValue: 52.50, // 15m * 3.50 (greige cost)
        weightedAvgCost: 3.50, // Valued at greige cost
        purchaseCost: 3.50,
        receivedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        agingDays: 1,
        warehouseLocation: 'WH-B',
        rackNumber: 'R-999',
        rollNumbers: 'DEFECT-001',
        createdById: userId,
      },
    });
    console.log('✅ Created stock: Defect Grade (15m at greige cost)');

    // Step 7: Stock Allocation - Reserve for order
    const allocation = await prisma.fabric_stock_allocation.create({
      data: {
        stockId: stockAGrade.id,
        orderId: order.id,
        styleId: style.id,
        quantityAllocated: 500, // meters for 500 pieces
        plannedCad: 1.8,
        allocationType: 'SAME_STYLE',
        allocationStatus: 'RESERVED',
        createdById: userId,
      },
    });
    console.log('✅ Created allocation: 500m reserved for order');

    // Update stock reserved quantity
    await prisma.fabric_stock.update({
      where: { id: stockAGrade.id },
      data: { quantityReserved: 500 },
    });

    // Step 8: Stock Transaction - Receipt
    await prisma.fabric_stock_transaction.create({
      data: {
        stockId: stockAGrade.id,
        transactionType: 'RECEIPT',
        quantity: 720,
        referenceType: 'PROCUREMENT',
        referenceId: procurement1.id,
        costPerUnit: 5.44,
        weightedAvgCost: 5.44,
        totalValue: 3916.80,
        balanceAfter: 720,
        valueAfter: 3916.80,
        qualityGradeFrom: null,
        qualityGradeTo: 'A',
        createdById: userId,
      },
    });

    console.log('✅ Created stock transaction: Receipt of 720m A-grade');

    // Summary
    console.log('\n📊 Sample Workflow Created:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1. ✅ Greige Procurement (800m for order + 200m MOQ excess)');
    console.log('2. ✅ Processing (Greige → Navy Blue Finished)');
    console.log('3. ✅ Quality Inspection (A-grade: 720m, Defect: 15m)');
    console.log('4. ✅ Stock Created (A-grade + Defect grade)');
    console.log('5. ✅ Allocation (500m reserved for order)');
    console.log('6. ✅ Transaction Recorded (Complete audit trail)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('🎉 Sample data seeded successfully!\n');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
