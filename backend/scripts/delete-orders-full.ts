import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ORDER_NUMBERS = ['ORD2026020001', 'ORD2025120001'];

async function deleteOrdersFull() {
  console.log(`\n🗑️  Deleting orders: ${ORDER_NUMBERS.join(', ')}\n`);

  // Step 1: Get order IDs
  const orders = await prisma.orders.findMany({
    where: { orderNumber: { in: ORDER_NUMBERS } },
    select: { id: true, orderNumber: true },
  });

  if (orders.length === 0) {
    console.log('❌ No orders found with those numbers.');
    return;
  }

  console.log(`Found ${orders.length} orders:`);
  orders.forEach((o) => console.log(`  - ${o.orderNumber} (${o.id})`));

  const orderIds = orders.map((o) => o.id);

  // Step 2: Get work order IDs (production runs)
  const workOrders = await prisma.work_orders.findMany({
    where: { orderId: { in: orderIds } },
    select: { id: true },
  });
  const workOrderIds = workOrders.map((w) => w.id);
  console.log(`Found ${workOrderIds.length} work orders (production runs)`);

  // Step 3: Get material requirement IDs
  const matReqs = await prisma.material_requirements.findMany({
    where: { orderId: { in: orderIds } },
    select: { id: true },
  });
  const matReqIds = matReqs.map((m) => m.id);
  console.log(`Found ${matReqIds.length} material requirements`);

  // Step 4: Get PO IDs linked to these requirements
  const reqPoLinks = matReqIds.length > 0
    ? await prisma.requirement_po_links.findMany({
        where: { requirementId: { in: matReqIds } },
        select: { purchaseOrderId: true },
      })
    : [];
  const mrpPoIds = [...new Set(reqPoLinks.map((l) => l.purchaseOrderId))];
  console.log(`Found ${mrpPoIds.length} MRP-generated POs`);

  // Step 5: Get service PO IDs from work orders
  const servicePOs = workOrderIds.length > 0
    ? await prisma.purchase_orders.findMany({
        where: { serviceWorkOrderId: { in: workOrderIds } },
        select: { id: true },
      })
    : [];
  const servicePoIds = servicePOs.map((p) => p.id);
  console.log(`Found ${servicePoIds.length} service POs`);

  // Step 6: Get cost-sheet-linked POs
  const costSheets = await prisma.style_costing.findMany({
    where: { orderId: { in: orderIds } },
    select: { id: true },
  });
  const costSheetIds = costSheets.map((c) => c.id);
  let costSheetPoIds: string[] = [];
  if (costSheetIds.length > 0) {
    const csPOGens = await prisma.cost_sheet_po_generation.findMany({
      where: { costSheetId: { in: costSheetIds } },
      select: { id: true },
    });
    const csGenIds = csPOGens.map((g) => g.id);
    if (csGenIds.length > 0) {
      const csPOs = await prisma.purchase_orders.findMany({
        where: { costSheetGenerationId: { in: csGenIds } },
        select: { id: true },
      });
      costSheetPoIds = csPOs.map((p) => p.id);
    }
  }
  console.log(`Found ${costSheetPoIds.length} cost-sheet POs`);

  // Combine all PO IDs
  const allPoIds = [...new Set([...mrpPoIds, ...servicePoIds, ...costSheetPoIds])];
  console.log(`Total POs to delete: ${allPoIds.length}`);

  // Get invoice IDs
  const invoices = await prisma.invoices.findMany({
    where: { orderId: { in: orderIds } },
    select: { id: true },
  });
  const invoiceIds = invoices.map((i) => i.id);

  // Get delivery note IDs
  const deliveryNotes = await prisma.delivery_notes.findMany({
    where: { orderId: { in: orderIds } },
    select: { id: true },
  });
  const deliveryNoteIds = deliveryNotes.map((d) => d.id);

  // Get ASN IDs
  const asns = await prisma.asn_applications.findMany({
    where: { orderId: { in: orderIds } },
    select: { id: true },
  });
  const asnIds = asns.map((a) => a.id);

  console.log(`\n🔥 Starting deletion in transaction...\n`);

  await prisma.$transaction(async (tx) => {
    let deleted: number;

    // ===== TIER 1: Financial (leaf nodes) =====
    if (invoiceIds.length > 0) {
      deleted = await tx.payments.deleteMany({ where: { invoiceId: { in: invoiceIds } } }).then(r => r.count);
      if (deleted) console.log(`  ✅ Deleted ${deleted} payments`);
    }

    // ===== TIER 2: PO-related cleanup (before deleting POs) =====
    if (allPoIds.length > 0) {
      // GRN items cascade from GRNs, so delete GRNs
      deleted = await tx.goods_receiving_notes.deleteMany({ where: { poId: { in: allPoIds } } }).then(r => r.count);
      if (deleted) console.log(`  ✅ Deleted ${deleted} goods receiving notes`);

      // Challans linked to POs
      deleted = await tx.challans.deleteMany({ where: { purchaseOrderId: { in: allPoIds } } }).then(r => r.count);
      if (deleted) console.log(`  ✅ Deleted ${deleted} challans (PO-linked)`);

      // requirement_po_links (non-cascading from PO side)
      deleted = await tx.requirement_po_links.deleteMany({ where: { purchaseOrderId: { in: allPoIds } } }).then(r => r.count);
      if (deleted) console.log(`  ✅ Deleted ${deleted} requirement PO links`);

      // po_source_links cascade from PO, but let's be explicit
      deleted = await tx.po_source_links.deleteMany({ where: { purchaseOrderId: { in: allPoIds } } }).then(r => r.count);
      if (deleted) console.log(`  ✅ Deleted ${deleted} PO source links`);

      // purchase_order_items cascade from PO, but be explicit
      deleted = await tx.purchase_order_items.deleteMany({ where: { poId: { in: allPoIds } } }).then(r => r.count);
      if (deleted) console.log(`  ✅ Deleted ${deleted} purchase order items`);

      // Delete the POs themselves
      deleted = await tx.purchase_orders.deleteMany({ where: { id: { in: allPoIds } } }).then(r => r.count);
      if (deleted) console.log(`  ✅ Deleted ${deleted} purchase orders`);
    }

    // ===== TIER 3: Work order children (no cascade) =====
    if (workOrderIds.length > 0) {
      // Challans linked to production runs
      deleted = await tx.challans.deleteMany({ where: { productionRunId: { in: workOrderIds } } }).then(r => r.count);
      if (deleted) console.log(`  ✅ Deleted ${deleted} challans (production-run-linked)`);

      // po_source_links for production runs
      deleted = await tx.po_source_links.deleteMany({ where: { productionRunId: { in: workOrderIds } } }).then(r => r.count);
      if (deleted) console.log(`  ✅ Deleted ${deleted} PO source links (production-run)`);

      // Carton packings (carton_skus cascade)
      deleted = await tx.carton_packings.deleteMany({ where: { workOrderId: { in: workOrderIds } } }).then(r => r.count);
      if (deleted) console.log(`  ✅ Deleted ${deleted} carton packings`);

      // Stitching issues (components/skus/dailyOutputs cascade)
      deleted = await tx.stitching_issues.deleteMany({ where: { workOrderId: { in: workOrderIds } } }).then(r => r.count);
      if (deleted) console.log(`  ✅ Deleted ${deleted} stitching issues`);

      // Finishing issues (components/skus/dailyOutputs/polybag cascade)
      deleted = await tx.finishing_issues.deleteMany({ where: { workOrderId: { in: workOrderIds } } }).then(r => r.count);
      if (deleted) console.log(`  ✅ Deleted ${deleted} finishing issues`);

      // Stage receipts
      deleted = await tx.stage_receipts.deleteMany({ where: { workOrderId: { in: workOrderIds } } }).then(r => r.count);
      if (deleted) console.log(`  ✅ Deleted ${deleted} stage receipts`);

      // Transfer slips
      deleted = await tx.transfer_slips.deleteMany({ where: { workOrderId: { in: workOrderIds } } }).then(r => r.count);
      if (deleted) console.log(`  ✅ Deleted ${deleted} transfer slips`);

      // Cutting batches
      deleted = await tx.cutting_batches.deleteMany({ where: { workOrderId: { in: workOrderIds } } }).then(r => r.count);
      if (deleted) console.log(`  ✅ Deleted ${deleted} cutting batches`);

      // Quality inspections (manufacturing)
      try {
        deleted = await tx.quality_inspections_mfg.deleteMany({ where: { workOrderId: { in: workOrderIds } } }).then(r => r.count);
        if (deleted) console.log(`  ✅ Deleted ${deleted} quality inspections (mfg)`);
      } catch { /* table may not exist */ }

      // Quality inspections
      deleted = await tx.quality_inspections.deleteMany({ where: { workOrderId: { in: workOrderIds } } }).then(r => r.count);
      if (deleted) console.log(`  ✅ Deleted ${deleted} quality inspections`);

      // Production tracking
      deleted = await tx.production_tracking.deleteMany({ where: { workOrderId: { in: workOrderIds } } }).then(r => r.count);
      if (deleted) console.log(`  ✅ Deleted ${deleted} production tracking records`);

      // Material requisitions
      deleted = await tx.material_requisitions.deleteMany({ where: { workOrderId: { in: workOrderIds } } }).then(r => r.count);
      if (deleted) console.log(`  ✅ Deleted ${deleted} material requisitions`);

      // Garment physical tests
      deleted = await tx.garment_physical_tests.deleteMany({ where: { workOrderId: { in: workOrderIds } } }).then(r => r.count);
      if (deleted) console.log(`  ✅ Deleted ${deleted} garment physical tests`);

      // Finished goods stock
      deleted = await tx.finished_goods_stock.deleteMany({ where: { workOrderId: { in: workOrderIds } } }).then(r => r.count);
      if (deleted) console.log(`  ✅ Deleted ${deleted} finished goods stock`);

      // Stage transition overrides
      deleted = await tx.stage_transition_overrides.deleteMany({ where: { workOrderId: { in: workOrderIds } } }).then(r => r.count);
      if (deleted) console.log(`  ✅ Deleted ${deleted} stage transition overrides`);

      // Embroidery send outs (work order linked)
      deleted = await tx.embroidery_send_out.deleteMany({ where: { workOrderId: { in: workOrderIds } } }).then(r => r.count);
      if (deleted) console.log(`  ✅ Deleted ${deleted} embroidery send outs (WO)`);

      // Processing batches (stages/movements/deliveries cascade)
      deleted = await tx.processing_batch.deleteMany({ where: { workOrderId: { in: workOrderIds } } }).then(r => r.count);
      if (deleted) console.log(`  ✅ Deleted ${deleted} processing batches`);

      // Job work orders
      deleted = await tx.job_work_orders.deleteMany({ where: { workOrderId: { in: workOrderIds } } }).then(r => r.count);
      if (deleted) console.log(`  ✅ Deleted ${deleted} job work orders`);

      // Work orders themselves (work_order_breakup + work_order_service_requirements cascade)
      // Delete child runs first (parentRunId references)
      deleted = await tx.work_orders.deleteMany({ where: { parentRunId: { in: workOrderIds } } }).then(r => r.count);
      if (deleted) console.log(`  ✅ Deleted ${deleted} child work orders (splits)`);

      deleted = await tx.work_orders.deleteMany({ where: { orderId: { in: orderIds } } }).then(r => r.count);
      if (deleted) console.log(`  ✅ Deleted ${deleted} work orders`);
    }

    // ===== TIER 4: Order-level children (no cascade) =====

    // Challans linked to orders
    deleted = await tx.challans.deleteMany({ where: { orderId: { in: orderIds } } }).then(r => r.count);
    if (deleted) console.log(`  ✅ Deleted ${deleted} challans (order-linked)`);

    // Lace allocations
    deleted = await tx.lace_stock_allocation.deleteMany({ where: { orderId: { in: orderIds } } }).then(r => r.count);
    if (deleted) console.log(`  ✅ Deleted ${deleted} lace stock allocations`);

    // Lace issue notes
    deleted = await tx.lace_issue_note.deleteMany({ where: { orderId: { in: orderIds } } }).then(r => r.count);
    if (deleted) console.log(`  ✅ Deleted ${deleted} lace issue notes`);

    // Fabric stock allocations
    deleted = await tx.fabric_stock_allocation.deleteMany({ where: { orderId: { in: orderIds } } }).then(r => r.count);
    if (deleted) console.log(`  ✅ Deleted ${deleted} fabric stock allocations`);

    // Material requirements (and their links which cascade)
    if (matReqIds.length > 0) {
      deleted = await tx.requirement_po_links.deleteMany({ where: { requirementId: { in: matReqIds } } }).then(r => r.count);
      if (deleted) console.log(`  ✅ Deleted ${deleted} requirement PO links (MRP)`);
    }
    deleted = await tx.material_requirements.deleteMany({ where: { orderId: { in: orderIds } } }).then(r => r.count);
    if (deleted) console.log(`  ✅ Deleted ${deleted} material requirements`);

    // Embroidery send outs (order-level)
    deleted = await tx.embroidery_send_out.deleteMany({ where: { forOrderId: { in: orderIds } } }).then(r => r.count);
    if (deleted) console.log(`  ✅ Deleted ${deleted} embroidery send outs (order)`);

    // Invoices (payments already deleted)
    deleted = await tx.invoices.deleteMany({ where: { orderId: { in: orderIds } } }).then(r => r.count);
    if (deleted) console.log(`  ✅ Deleted ${deleted} invoices`);

    // ASN applications (asn_skus cascade)
    deleted = await tx.asn_applications.deleteMany({ where: { orderId: { in: orderIds } } }).then(r => r.count);
    if (deleted) console.log(`  ✅ Deleted ${deleted} ASN applications`);

    // Delivery notes (delivery_note_items cascade)
    deleted = await tx.delivery_notes.deleteMany({ where: { orderId: { in: orderIds } } }).then(r => r.count);
    if (deleted) console.log(`  ✅ Deleted ${deleted} delivery notes`);

    // Nullify fabric/lace stock origin references (physical goods may still exist)
    deleted = await tx.fabric_stock.updateMany({ where: { originOrderId: { in: orderIds } }, data: { originOrderId: null } }).then(r => r.count);
    if (deleted) console.log(`  ✅ Nullified ${deleted} fabric stock origin references`);

    deleted = await tx.lace_stock.updateMany({ where: { originOrderId: { in: orderIds } }, data: { originOrderId: null } }).then(r => r.count);
    if (deleted) console.log(`  ✅ Nullified ${deleted} lace stock origin references`);

    deleted = await tx.fabric_procurement.updateMany({ where: { orderedForOrderId: { in: orderIds } }, data: { orderedForOrderId: null } }).then(r => r.count);
    if (deleted) console.log(`  ✅ Nullified ${deleted} fabric procurement references`);

    // Cost sheet PO generations
    if (costSheetIds.length > 0) {
      deleted = await tx.cost_sheet_po_generation.deleteMany({ where: { costSheetId: { in: costSheetIds } } }).then(r => r.count);
      if (deleted) console.log(`  ✅ Deleted ${deleted} cost sheet PO generations`);
    }

    // Order-level cost sheets
    deleted = await tx.style_costing.deleteMany({ where: { orderId: { in: orderIds } } }).then(r => r.count);
    if (deleted) console.log(`  ✅ Deleted ${deleted} order cost sheets`);

    // Nullify copiedFromOrderId references on other order_boms
    deleted = await tx.order_bom.updateMany({ where: { copiedFromOrderId: { in: orderIds } }, data: { copiedFromOrderId: null } }).then(r => r.count);
    if (deleted) console.log(`  ✅ Nullified ${deleted} order BOM copiedFrom references`);

    // CAD entries (nullable orderId)
    deleted = await tx.fabric_width_cad.updateMany({ where: { clonedFromOrderId: { in: orderIds } }, data: { clonedFromOrderId: null } }).then(r => r.count);
    if (deleted) console.log(`  ✅ Nullified ${deleted} CAD entry references`);

    // ===== TIER 5: Delete the orders (cascades: order_items, order_bom, order_thread_requirements) =====
    deleted = await tx.orders.deleteMany({ where: { id: { in: orderIds } } }).then(r => r.count);
    console.log(`\n  🎉 Deleted ${deleted} orders!`);
  }, {
    timeout: 60000, // 60 second timeout for large transactions
  });

  console.log('\n✅ All done! Orders and all related data have been deleted.\n');
}

deleteOrdersFull()
  .catch((error) => {
    console.error('\n❌ Deletion failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
