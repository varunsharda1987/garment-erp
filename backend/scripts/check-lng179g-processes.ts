/**
 * READ-ONLY investigation script: Query processes and services for style LNG179G in order ORD2026030002
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function printSection(title: string, data: any) {
  console.log('\n' + '='.repeat(80));
  console.log(`  ${title}`);
  console.log('='.repeat(80));
  if (data === null || data === undefined) {
    console.log('  (no data found)');
  } else if (Array.isArray(data) && data.length === 0) {
    console.log('  (empty array - no records)');
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

async function main() {
  // 1. Find the style
  const style = await prisma.styles.findFirst({
    where: { styleCode: 'LNG179G' },
    select: {
      id: true,
      styleCode: true,
      styleName: true,
      categoryId: true,
      brandCategoryId: true,
      gender: true,
      description: true,
      status: true,
      numberOfComponents: true,
      productCategoryId: true,
      isActive: true,
    },
  });

  printSection('1. STYLE RECORD (LNG179G)', style);

  if (!style) {
    console.log('\nStyle LNG179G not found. Exiting.');
    return;
  }

  const styleId = style.id;

  // 2. Style Components
  const components = await prisma.style_components.findMany({
    where: { styleId },
    include: {
      componentMaster: { select: { id: true, name: true, description: true } },
    },
    orderBy: { sortOrder: 'asc' },
  });

  printSection('2. STYLE COMPONENTS', components);

  // 3. Style Processes
  const processes = await prisma.style_processes.findMany({
    where: { styleId },
    include: {
      supplier: { select: { id: true, code: true, name: true } },
    },
    orderBy: { sortOrder: 'asc' },
  });

  printSection('3. STYLE PROCESSES', processes);

  // 4. Style Value Additions
  const valueAdditions = await prisma.style_value_additions.findMany({
    where: { styleId },
  });

  printSection('4. STYLE VALUE ADDITIONS', valueAdditions);

  // 5. Style Costing - all records
  const costings = await prisma.style_costing.findMany({
    where: { styleId },
    include: {
      fabricItems: true,
      laceItems: true,
      threadItems: true,
    },
  });

  // Extract key process-related fields for readability
  const costingSummaries = costings.map((c: any) => ({
    id: c.id,
    version: c.version,
    purpose: c.purpose,
    approvalStatus: c.approvalStatus,
    isApproved: c.isApproved,
    orderId: c.orderId,
    orderItemId: c.orderItemId,
    // Process costs
    printingCost: c.printingCost?.toString(),
    dyeingCost: c.dyeingCost?.toString(),
    washingCost: c.washingCost?.toString(),
    embroideryWork: c.embroideryWork?.toString(),
    handWork: c.handWork?.toString(),
    cmtCost: c.cmtCost?.toString(),
    cuttingCost: c.cuttingCost?.toString(),
    stitchingCost: c.stitchingCost?.toString(),
    finishingCost: c.finishingCost?.toString(),
    checkingCost: c.checkingCost?.toString(),
    otherProcessingCost: c.otherProcessingCost?.toString(),
    totalProcessingCost: c.totalProcessingCost?.toString(),
    totalProductionCost: c.totalProductionCost?.toString(),
    totalCostPerPiece: c.totalCostPerPiece?.toString(),
    closedCost: c.closedCost?.toString(),
    // JSON detail fields
    fabricDetails: c.fabricDetails,
    trimsDetails: c.trimsDetails,
    embroideryDetails: c.embroideryDetails,
    accessoriesDetails: c.accessoriesDetails,
    // Budgets
    fabricBudget: c.fabricBudget?.toString(),
    trimsBudget: c.trimsBudget?.toString(),
    cmtBudget: c.cmtBudget?.toString(),
    embroideryBudget: c.embroideryBudget?.toString(),
    // Sub-items counts
    fabricItemsCount: c.fabricItems?.length ?? 0,
    laceItemsCount: c.laceItems?.length ?? 0,
    threadItemsCount: c.threadItems?.length ?? 0,
  }));

  printSection('5. STYLE COSTING (process-related fields)', costingSummaries);

  // Also print full fabric/lace/thread items if any exist
  for (const c of costings) {
    if ((c as any).fabricItems?.length > 0) {
      printSection(`5a. FABRIC ITEMS for costing ${c.id}`, (c as any).fabricItems);
    }
    if ((c as any).laceItems?.length > 0) {
      printSection(`5b. LACE ITEMS for costing ${c.id}`, (c as any).laceItems);
    }
    if ((c as any).threadItems?.length > 0) {
      printSection(`5c. THREAD ITEMS for costing ${c.id}`, (c as any).threadItems);
    }
  }

  // 6. Find the order
  const order = await prisma.orders.findFirst({
    where: { orderNumber: 'ORD2026030002' },
    select: {
      id: true,
      orderNumber: true,
      customerId: true,
      status: true,
      totalQuantity: true,
      totalAmount: true,
    },
  });

  printSection('6. ORDER (ORD2026030002)', order);

  if (!order) {
    console.log('\nOrder ORD2026030002 not found.');
  }

  // 7. Work Orders for this order + style
  const workOrderWhere: any = {};
  if (order) workOrderWhere.orderId = order.id;
  workOrderWhere.styleId = styleId;

  const workOrders = await prisma.work_orders.findMany({
    where: workOrderWhere,
    include: {
      work_order_breakup: true,
      locations: { select: { id: true, locationCode: true, locationName: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  printSection('7. WORK ORDERS (for this order + style)', workOrders.map((wo: any) => ({
    id: wo.id,
    workOrderNumber: wo.workOrderNumber,
    orderId: wo.orderId,
    styleId: wo.styleId,
    status: wo.status,
    totalQuantity: wo.totalQuantity,
    completedQuantity: wo.completedQuantity,
    plannedStartDate: wo.plannedStartDate,
    plannedEndDate: wo.plannedEndDate,
    priority: wo.priority,
    remarks: wo.remarks,
    parentRunId: wo.parentRunId,
    fabricLotInfo: wo.fabricLotInfo,
    splitReason: wo.splitReason,
    location: wo.locations,
    breakupCount: wo.work_order_breakup?.length ?? 0,
  })));

  // 8. Service Requirements for work orders
  if (workOrders.length > 0) {
    const woIds = workOrders.map((wo: any) => wo.id);

    const serviceReqs = await prisma.work_order_service_requirements.findMany({
      where: { workOrderId: { in: woIds } },
      include: {
        styleProcess: {
          select: { id: true, processName: true, processType: true },
        },
        preferredProcessor: { select: { id: true, code: true, name: true } },
        assignedProcessor: { select: { id: true, code: true, name: true } },
        purchaseOrder: { select: { id: true, poNumber: true, status: true } },
        serviceRequirementPoLinks: {
          include: {
            purchaseOrderItem: {
              select: { id: true, serviceDescription: true, serviceType: true, orderedQuantity: true, unitPrice: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    printSection('8. WORK ORDER SERVICE REQUIREMENTS', serviceReqs);
  } else {
    printSection('8. WORK ORDER SERVICE REQUIREMENTS', '(no work orders found, skipping)');
  }

  // 9. Order BOMs for completeness
  if (order) {
    const boms = await prisma.order_bom.findMany({
      where: { orderId: order.id, styleId },
      select: {
        id: true,
        styleId: true,
        orderId: true,
        orderItemId: true,
        status: true,
        totalMaterialCost: true,
        version: true,
        createdAt: true,
        sourceCostSheetId: true,
      },
    });

    printSection('9. ORDER BOMs (for this order + style)', boms);
  }

  console.log('\n' + '='.repeat(80));
  console.log('  INVESTIGATION COMPLETE');
  console.log('='.repeat(80));
}

main()
  .catch((err) => {
    console.error('Error running investigation:', err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
