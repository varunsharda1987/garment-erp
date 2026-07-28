/**
 * Cleanup Script - Deletes all transactional data (stock, challans, orders, MRP)
 * PRESERVES: Sale orders from B2B app (House Of Kasya Pvt Ltd)
 *
 * Run with: npx ts-node scripts/cleanup-transactional-data.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// B2B customer ID to preserve
const B2B_CUSTOMER_ID = 'c4a5436d-0ae3-40ca-be18-2cfd553f89ea';

async function cleanup() {
  console.log('=== TRANSACTIONAL DATA CLEANUP ===\n');
  console.log('⚠️  This will DELETE all transactional data except B2B sale orders.\n');

  // Count what we're about to delete
  const counts = {
    saleOrdersTotal: await prisma.sale_orders.count(),
    saleOrdersB2B: await prisma.sale_orders.count({ where: { customerId: B2B_CUSTOMER_ID } }),
    saleOrdersToDelete: 0,
    workOrders: await prisma.work_orders.count(),
    purchaseOrders: await prisma.purchase_orders.count(),
    orders: await prisma.orders.count(),
    challans: await prisma.challans.count(),
    grns: await prisma.grn_items.count(),
    deliveryNotes: await prisma.delivery_notes.count(),
    invoices: await prisma.invoices.count(),
    stockLevels: await prisma.stock_levels.count(),
    greigeStock: await prisma.greige_stock.count(),
    fabricStock: await prisma.fabric_stock.count(),
    threadStock: await prisma.thread_stock.count(),
    laceStock: await prisma.lace_stock.count(),
    materialRequirements: await prisma.material_requirements.count(),
  };

  counts.saleOrdersToDelete = counts.saleOrdersTotal - counts.saleOrdersB2B;

  console.log('📊 Records to be deleted:');
  console.log(`   Sale Orders: ${counts.saleOrdersToDelete} (preserving ${counts.saleOrdersB2B} B2B orders)`);
  console.log(`   Work Orders: ${counts.workOrders}`);
  console.log(`   Purchase Orders: ${counts.purchaseOrders}`);
  console.log(`   Orders (legacy): ${counts.orders}`);
  console.log(`   Challans: ${counts.challans}`);
  console.log(`   GRN Items: ${counts.grns}`);
  console.log(`   Delivery Notes: ${counts.deliveryNotes}`);
  console.log(`   Invoices: ${counts.invoices}`);
  console.log(`   Stock Levels: ${counts.stockLevels}`);
  console.log(`   Greige Stock: ${counts.greigeStock}`);
  console.log(`   Fabric Stock: ${counts.fabricStock}`);
  console.log(`   Thread Stock: ${counts.threadStock}`);
  console.log(`   Lace Stock: ${counts.laceStock}`);
  console.log(`   Material Requirements: ${counts.materialRequirements}`);
  console.log();

  // Transaction to ensure all-or-nothing
  await prisma.$transaction(async (tx) => {
    console.log('🔄 Starting deletion in FK-safe order...\n');

    // ==== LAYER 1: Deepest children (no FK dependents) ====

    // External process send out SKUs
    const extSkus = await tx.external_process_send_out_skus.deleteMany({});
    console.log(`   ✓ External process send out SKUs: ${extSkus.count}`);

    // External process send outs
    const extSendouts = await tx.external_process_send_outs.deleteMany({});
    console.log(`   ✓ External process send outs: ${extSendouts.count}`);

    // Finishing output SKUs
    const finOutSkus = await tx.finishing_output_skus.deleteMany({});
    console.log(`   ✓ Finishing output SKUs: ${finOutSkus.count}`);

    // Finishing daily outputs
    const finOutputs = await tx.finishing_daily_outputs.deleteMany({});
    console.log(`   ✓ Finishing daily outputs: ${finOutputs.count}`);

    // Finishing issue SKUs
    const finIssueSkus = await tx.finishing_issue_skus.deleteMany({});
    console.log(`   ✓ Finishing issue SKUs: ${finIssueSkus.count}`);

    // Finishing issue components
    const finIssueComps = await tx.finishing_issue_components.deleteMany({});
    console.log(`   ✓ Finishing issue components: ${finIssueComps.count}`);

    // Finishing issues
    const finIssues = await tx.finishing_issues.deleteMany({});
    console.log(`   ✓ Finishing issues: ${finIssues.count}`);

    // Stitching output SKUs
    const stitchOutSkus = await tx.stitching_output_skus.deleteMany({});
    console.log(`   ✓ Stitching output SKUs: ${stitchOutSkus.count}`);

    // Stitching daily outputs
    const stitchOutputs = await tx.stitching_daily_outputs.deleteMany({});
    console.log(`   ✓ Stitching daily outputs: ${stitchOutputs.count}`);

    // Stitching issue SKUs
    const stitchIssueSkus = await tx.stitching_issue_skus.deleteMany({});
    console.log(`   ✓ Stitching issue SKUs: ${stitchIssueSkus.count}`);

    // Stitching issue components
    const stitchIssueComps = await tx.stitching_issue_components.deleteMany({});
    console.log(`   ✓ Stitching issue components: ${stitchIssueComps.count}`);

    // Stitching issues
    const stitchIssues = await tx.stitching_issues.deleteMany({});
    console.log(`   ✓ Stitching issues: ${stitchIssues.count}`);

    // Cutting lay SKUs
    const cutLaySkus = await tx.cutting_lay_skus.deleteMany({});
    console.log(`   ✓ Cutting lay SKUs: ${cutLaySkus.count}`);

    // Cutting lay fabrics
    const cutLayFabrics = await tx.cutting_lay_fabrics.deleteMany({});
    console.log(`   ✓ Cutting lay fabrics: ${cutLayFabrics.count}`);

    // Cutting lays
    const cutLays = await tx.cutting_lays.deleteMany({});
    console.log(`   ✓ Cutting lays: ${cutLays.count}`);

    // Cutting batch defects
    const cutDefects = await tx.cutting_batch_defects.deleteMany({});
    console.log(`   ✓ Cutting batch defects: ${cutDefects.count}`);

    // Cutting batch SKUs
    const cutBatchSkus = await tx.cutting_batch_skus.deleteMany({});
    console.log(`   ✓ Cutting batch SKUs: ${cutBatchSkus.count}`);

    // Cutting batch fabrics
    const cutBatchFabrics = await tx.cutting_batch_fabrics.deleteMany({});
    console.log(`   ✓ Cutting batch fabrics: ${cutBatchFabrics.count}`);

    // Cutting batches
    const cutBatches = await tx.cutting_batches.deleteMany({});
    console.log(`   ✓ Cutting batches: ${cutBatches.count}`);

    // ==== LAYER 2: Stock transactions and allocations ====

    // Stock transactions
    const stockTx = await tx.stock_transactions.deleteMany({});
    console.log(`   ✓ Stock transactions: ${stockTx.count}`);

    // Stock movements
    const stockMov = await tx.stock_movements.deleteMany({});
    console.log(`   ✓ Stock movements: ${stockMov.count}`);

    // Stock reservations
    const stockRes = await tx.stock_reservations.deleteMany({});
    console.log(`   ✓ Stock reservations: ${stockRes.count}`);

    // Stock count items
    const stockCountItems = await tx.stock_count_items.deleteMany({});
    console.log(`   ✓ Stock count items: ${stockCountItems.count}`);

    // Stock counts
    const stockCounts = await tx.stock_counts.deleteMany({});
    console.log(`   ✓ Stock counts: ${stockCounts.count}`);

    // Greige stock transactions
    const greigeStockTx = await tx.greige_stock_transaction.deleteMany({});
    console.log(`   ✓ Greige stock transactions: ${greigeStockTx.count}`);

    // Fabric stock transactions
    const fabricStockTx = await tx.fabric_stock_transaction.deleteMany({});
    console.log(`   ✓ Fabric stock transactions: ${fabricStockTx.count}`);

    // Fabric stock allocations
    const fabricStockAlloc = await tx.fabric_stock_allocation.deleteMany({});
    console.log(`   ✓ Fabric stock allocations: ${fabricStockAlloc.count}`);

    // Thread stock transactions
    const threadStockTx = await tx.thread_stock_transaction.deleteMany({});
    console.log(`   ✓ Thread stock transactions: ${threadStockTx.count}`);

    // Lace stock transactions
    const laceStockTx = await tx.lace_stock_transaction.deleteMany({});
    console.log(`   ✓ Lace stock transactions: ${laceStockTx.count}`);

    // Lace stock allocations
    const laceStockAlloc = await tx.lace_stock_allocation.deleteMany({});
    console.log(`   ✓ Lace stock allocations: ${laceStockAlloc.count}`);

    // ==== LAYER 3: Stock tables ====

    // Stock levels
    const stockLevels = await tx.stock_levels.deleteMany({});
    console.log(`   ✓ Stock levels: ${stockLevels.count}`);

    // Greige stock
    const greigeStock = await tx.greige_stock.deleteMany({});
    console.log(`   ✓ Greige stock: ${greigeStock.count}`);

    // Fabric stock
    const fabricStock = await tx.fabric_stock.deleteMany({});
    console.log(`   ✓ Fabric stock: ${fabricStock.count}`);

    // Thread stock
    const threadStock = await tx.thread_stock.deleteMany({});
    console.log(`   ✓ Thread stock: ${threadStock.count}`);

    // Lace stock
    const laceStock = await tx.lace_stock.deleteMany({});
    console.log(`   ✓ Lace stock: ${laceStock.count}`);

    // Button stock
    const buttonStock = await tx.button_stock.deleteMany({});
    console.log(`   ✓ Button stock: ${buttonStock.count}`);

    // Zipper stock
    const zipperStock = await tx.zipper_stock.deleteMany({});
    console.log(`   ✓ Zipper stock: ${zipperStock.count}`);

    // Elastic stock
    const elasticStock = await tx.elastic_stock.deleteMany({});
    console.log(`   ✓ Elastic stock: ${elasticStock.count}`);

    // Label stock
    const labelStock = await tx.label_stock.deleteMany({});
    console.log(`   ✓ Label stock: ${labelStock.count}`);

    // Packaging stock
    const packagingStock = await tx.packaging_stock.deleteMany({});
    console.log(`   ✓ Packaging stock: ${packagingStock.count}`);

    // Machine part stock
    const machinePartStock = await tx.machine_part_stock.deleteMany({});
    console.log(`   ✓ Machine part stock: ${machinePartStock.count}`);

    // Other material stock
    const otherMaterialStock = await tx.other_material_stock.deleteMany({});
    console.log(`   ✓ Other material stock: ${otherMaterialStock.count}`);

    // Inventory stock
    const inventoryStock = await tx.inventory_stock.deleteMany({});
    console.log(`   ✓ Inventory stock: ${inventoryStock.count}`);

    // Finished goods stock
    const fgStock = await tx.finished_goods_stock.deleteMany({});
    console.log(`   ✓ Finished goods stock: ${fgStock.count}`);

    // ==== LAYER 3.5: Stage receipts ====

    // Stage receipt SKUs
    const stageReceiptSkus = await tx.stage_receipt_skus.deleteMany({});
    console.log(`   ✓ Stage receipt SKUs: ${stageReceiptSkus.count}`);

    // Stage receipts
    const stageReceipts = await tx.stage_receipts.deleteMany({});
    console.log(`   ✓ Stage receipts: ${stageReceipts.count}`);

    // ==== LAYER 4: Transfer slips, Polybag, Cartons, ASN, Dispatch ====

    // Dispatch cartons
    const dispatchCartons = await tx.dispatch_cartons.deleteMany({});
    console.log(`   ✓ Dispatch cartons: ${dispatchCartons.count}`);

    // ASN SKUs
    const asnSkus = await tx.asn_skus.deleteMany({});
    console.log(`   ✓ ASN SKUs: ${asnSkus.count}`);

    // ASN applications
    const asns = await tx.asn_applications.deleteMany({});
    console.log(`   ✓ ASN applications: ${asns.count}`);

    // Carton SKUs
    const cartonSkus = await tx.carton_skus.deleteMany({});
    console.log(`   ✓ Carton SKUs: ${cartonSkus.count}`);

    // Carton packings
    const cartonPackings = await tx.carton_packings.deleteMany({});
    console.log(`   ✓ Carton packings: ${cartonPackings.count}`);

    // Polybag SKUs
    const polybagSkus = await tx.polybag_skus.deleteMany({});
    console.log(`   ✓ Polybag SKUs: ${polybagSkus.count}`);

    // Polybag entries
    const polybagEntries = await tx.polybag_entries.deleteMany({});
    console.log(`   ✓ Polybag entries: ${polybagEntries.count}`);

    // Transfer slip SKUs
    const transferSlipSkus = await tx.transfer_slip_skus.deleteMany({});
    console.log(`   ✓ Transfer slip SKUs: ${transferSlipSkus.count}`);

    // Transfer slips
    const transferSlips = await tx.transfer_slips.deleteMany({});
    console.log(`   ✓ Transfer slips: ${transferSlips.count}`);

    // ==== LAYER 5: Challans ====

    // Challan items
    const challanItems = await tx.challan_items.deleteMany({});
    console.log(`   ✓ Challan items: ${challanItems.count}`);

    // Challans
    const challans = await tx.challans.deleteMany({});
    console.log(`   ✓ Challans: ${challans.count}`);

    // ==== LAYER 5: GRNs ====

    // GRN item details
    const grnItemDetails = await tx.grn_item_details.deleteMany({});
    console.log(`   ✓ GRN item details: ${grnItemDetails.count}`);

    // GRN items
    const grnItems = await tx.grn_items.deleteMany({});
    console.log(`   ✓ GRN items: ${grnItems.count}`);

    // ==== LAYER 6: Invoices and Delivery Notes (for non-B2B) ====

    // Get sale order IDs that are NOT B2B
    const nonB2BSaleOrders = await tx.sale_orders.findMany({
      where: { customerId: { not: B2B_CUSTOMER_ID } },
      select: { id: true }
    });
    const nonB2BIds = nonB2BSaleOrders.map(so => so.id);

    // Invoice items for non-B2B (cascade handles via invoiceId, but let's be explicit)
    // First get invoice IDs to delete
    const nonB2BInvoices = await tx.invoices.findMany({
      where: { saleOrderId: { in: nonB2BIds } },
      select: { id: true }
    });
    const nonB2BInvoiceIds = nonB2BInvoices.map(inv => inv.id);

    const invoiceItems = await tx.invoice_items.deleteMany({
      where: { invoiceId: { in: nonB2BInvoiceIds } }
    });
    console.log(`   ✓ Invoice items (non-B2B): ${invoiceItems.count}`);

    // Invoices for non-B2B
    const invoices = await tx.invoices.deleteMany({
      where: { saleOrderId: { in: nonB2BIds } }
    });
    console.log(`   ✓ Invoices (non-B2B): ${invoices.count}`);

    // Get delivery note IDs for non-B2B sale orders
    const nonB2BDeliveryNotes = await tx.delivery_notes.findMany({
      where: { saleOrderId: { in: nonB2BIds } },
      select: { id: true }
    });
    const nonB2BDnIds = nonB2BDeliveryNotes.map(dn => dn.id);

    // Delivery note FG allocations
    const dnFgAlloc = await tx.delivery_note_fg_allocations.deleteMany({
      where: { deliveryNoteId: { in: nonB2BDnIds } }
    });
    console.log(`   ✓ Delivery note FG allocations (non-B2B): ${dnFgAlloc.count}`);

    // Delivery note items for non-B2B
    const dnItems = await tx.delivery_note_items.deleteMany({
      where: { deliveryNoteId: { in: nonB2BDnIds } }
    });
    console.log(`   ✓ Delivery note items (non-B2B): ${dnItems.count}`);

    // Delivery notes for non-B2B
    const dns = await tx.delivery_notes.deleteMany({
      where: { saleOrderId: { in: nonB2BIds } }
    });
    console.log(`   ✓ Delivery notes (non-B2B): ${dns.count}`);

    // ==== LAYER 7: Sale Order Items and Allocations (non-B2B) ====

    // Get sale order item IDs for non-B2B sale orders
    const nonB2BSaleOrderItems = await tx.sale_order_items.findMany({
      where: { saleOrderId: { in: nonB2BIds } },
      select: { id: true }
    });
    const nonB2BSoItemIds = nonB2BSaleOrderItems.map(item => item.id);

    // FG stock allocations for non-B2B sale orders
    const fgAlloc = await tx.fg_stock_allocations.deleteMany({
      where: { saleOrderItemId: { in: nonB2BSoItemIds } }
    });
    console.log(`   ✓ FG stock allocations (non-B2B): ${fgAlloc.count}`);

    // Sale order items for non-B2B (cascade will handle this, but explicit)
    const soItems = await tx.sale_order_items.deleteMany({
      where: { saleOrderId: { in: nonB2BIds } }
    });
    console.log(`   ✓ Sale order items (non-B2B): ${soItems.count}`);

    // ==== LAYER 8: Sale Orders (non-B2B) ====

    const saleOrders = await tx.sale_orders.deleteMany({
      where: { customerId: { not: B2B_CUSTOMER_ID } }
    });
    console.log(`   ✓ Sale orders (non-B2B): ${saleOrders.count}`);

    // ==== LAYER 9: Work Orders ====

    // Stock production order items
    const stockProdItems = await tx.stock_production_order_items.deleteMany({});
    console.log(`   ✓ Stock production order items: ${stockProdItems.count}`);

    // Stock production orders
    const stockProdOrders = await tx.stock_production_orders.deleteMany({});
    console.log(`   ✓ Stock production orders: ${stockProdOrders.count}`);

    // Work order service requirements
    const woServiceReqs = await tx.work_order_service_requirements.deleteMany({});
    console.log(`   ✓ Work order service requirements: ${woServiceReqs.count}`);

    // Service requirement PO links
    const svcPoLinks = await tx.service_requirement_po_links.deleteMany({});
    console.log(`   ✓ Service requirement PO links: ${svcPoLinks.count}`);

    // Work order breakup
    const woBreakup = await tx.work_order_breakup.deleteMany({});
    console.log(`   ✓ Work order breakup: ${woBreakup.count}`);

    // Work orders
    const workOrders = await tx.work_orders.deleteMany({});
    console.log(`   ✓ Work orders: ${workOrders.count}`);

    // ==== LAYER 10: Purchase Orders ====

    // PO items
    const poItems = await tx.purchase_order_items.deleteMany({});
    console.log(`   ✓ Purchase order items: ${poItems.count}`);

    // Purchase orders
    const pos = await tx.purchase_orders.deleteMany({});
    console.log(`   ✓ Purchase orders: ${pos.count}`);

    // ==== LAYER 11: Material Requirements (MRP) ====

    const matReqs = await tx.material_requirements.deleteMany({});
    console.log(`   ✓ Material requirements: ${matReqs.count}`);

    // ==== LAYER 11.5: Payments ====

    // Payments linked to invoices will be deleted via cascade or we delete manually
    const payments = await tx.payments.deleteMany({});
    console.log(`   ✓ Payments: ${payments.count}`);

    // ==== LAYER 12: Quotations ====

    // Quotation items
    const quotationItems = await tx.quotation_items.deleteMany({});
    console.log(`   ✓ Quotation items: ${quotationItems.count}`);

    // Quotations
    const quotations = await tx.quotations.deleteMany({});
    console.log(`   ✓ Quotations: ${quotations.count}`);

    // ==== LAYER 12.5: Fabric costing runs ====

    const fabricCostingRuns = await tx.fabric_costing_run.deleteMany({});
    console.log(`   ✓ Fabric costing runs: ${fabricCostingRuns.count}`);

    // ==== LAYER 13: Order samples ====

    // Order samples
    const orderSamples = await tx.order_samples.deleteMany({});
    console.log(`   ✓ Order samples: ${orderSamples.count}`);

    // ==== LAYER 14: Legacy Orders ====

    // Order BOM items
    const bomItems = await tx.order_bom_items.deleteMany({});
    console.log(`   ✓ Order BOM items: ${bomItems.count}`);

    // Order BOM
    const boms = await tx.order_bom.deleteMany({});
    console.log(`   ✓ Order BOMs: ${boms.count}`);

    // Order item breakup
    const orderItemBreakup = await tx.order_item_breakup.deleteMany({});
    console.log(`   ✓ Order item breakup: ${orderItemBreakup.count}`);

    // Order items
    const orderItems = await tx.order_items.deleteMany({});
    console.log(`   ✓ Order items: ${orderItems.count}`);

    // Orders
    const orders = await tx.orders.deleteMany({});
    console.log(`   ✓ Orders (legacy): ${orders.count}`);

    // ==== LAYER 13: Credit Notes ====

    // Credit note items
    const cnItems = await tx.credit_note_items.deleteMany({});
    console.log(`   ✓ Credit note items: ${cnItems.count}`);

    // Credit notes
    const cns = await tx.credit_notes.deleteMany({});
    console.log(`   ✓ Credit notes: ${cns.count}`);

    console.log('\n✅ Cleanup complete!');
  }, {
    timeout: 120000 // 2 minute timeout for large datasets
  });

  // Post-cleanup counts
  console.log('\n📊 Post-cleanup verification:');
  const remaining = {
    saleOrders: await prisma.sale_orders.count(),
    workOrders: await prisma.work_orders.count(),
    purchaseOrders: await prisma.purchase_orders.count(),
    stockLevels: await prisma.stock_levels.count(),
  };
  console.log(`   Sale Orders remaining (B2B): ${remaining.saleOrders}`);
  console.log(`   Work Orders remaining: ${remaining.workOrders}`);
  console.log(`   Purchase Orders remaining: ${remaining.purchaseOrders}`);
  console.log(`   Stock Levels remaining: ${remaining.stockLevels}`);
}

cleanup()
  .catch((e) => {
    console.error('❌ Cleanup failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
