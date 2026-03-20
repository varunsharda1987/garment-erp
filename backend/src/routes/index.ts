/**
 * API Routes Index
 *
 * Consolidates all API routes into a single router for versioning.
 * Supports both /api/v1/ (versioned) and /api/ (backward compatible) prefixes.
 */

import { Router } from 'express';

// Import all route modules
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import styleRoutes from './style.routes';
import styleImportRoutes from './style-import.routes';
import cadPlanningRoutes from './cad-planning.routes';
import orderLabelRoutes, { orderItemLabelRouter, orderLabelRouter } from './order-label.routes';
import greigeStockRoutes from './greige-stock.routes';
import dashboardRoutes from './dashboard.routes';
import customerRoutes from './customer.routes';
import customerAccessoriesRoutes from './customer-accessories.routes';
import customerSizePresetsRoutes from './customer-size-presets.routes';
import supplierRoutes from './supplier.routes';
import agentRoutes from './agent.routes';
import agencyRoutes from './agency.routes';
import materialRoutes from './material.routes';
import materialMasterRoutes from './material-master.routes';
import laceRoutes from './lace.routes';
import laceLabDipRoutes from './laceLabDip.routes';
import laceCostingRoutes from './laceCosting.routes';
import laceStockRoutes from './laceStock.routes';
import laceIssueNoteRoutes from './laceIssueNote.routes';
import laceDefectRoutes from './laceDefect.routes';
import buttonRoutes from './button.routes';
import threadRoutes from './thread.routes';
import orderThreadRequirementRoutes from './order-thread-requirement.routes';
import zipperRoutes from './zipper.routes';
import elasticRoutes from './elastic.routes';
import labelRoutes from './label.routes';
import packagingRoutes from './packaging.routes';
import machinePartRoutes from './machine-part.routes';
import otherMaterialRoutes from './other-material.routes';
import sizeCategoryRoutes from './size-category.routes';
import styleMaterialBOMRoutes from './style-material-bom.routes';
import orderRoutes from './order.routes';
import orderItemsRoutes from './orderItems.routes';
import styleCostingRoutes from './styleCosting.routes';
import orderBomRoutes, { orderBomStandaloneRouter } from './order-bom.routes';
import chartOfAccountsRoutes from './chartOfAccounts.routes';
import taxMastersRoutes from './taxMasters.routes';
import hsnSacMasterRoutes from './hsnSacMaster.routes';
import paymentTermsRoutes from './paymentTerms.routes';
import currenciesRoutes from './currencies.routes';
import costCentersRoutes from './costCenters.routes';
import expenseTypesRoutes from './expenseTypes.routes';
import bankAccountsRoutes from './bankAccounts.routes';
import componentMastersRoutes from './componentMasters.routes';
import componentGroupRoutes from './componentGroup.routes';
import patternPartRoutes from './patternPart.routes';
import componentPatternPartRoutes from './componentPatternPart.routes';
import exportRoutes from './export.routes';
import importRoutes from './import.routes';
import templateRoutes from './template.routes';
import warehouseRoutes from './warehouse.routes';
import stockLevelRoutes from './stockLevel.routes';
import stockMovementRoutes from './stockMovement.routes';
import stockCountRoutes from './stockCount.routes';
import workOrderRoutes from './workOrder.routes';
import fabricGreigeRoutes from './fabric-greige.routes';
import fabricProcurementRoutes from './fabric-procurement.routes';
import fabricStockRoutes from './fabric-stock.routes';
import fabricProcessingRoutes from './fabric-processing.routes';
import processingBatchRoutes from './processingBatch.routes';
import processingStageRoutes from './processingStage.routes';
import processingMovementRoutes from './processingMovement.routes';
import processingDeliveryRoutes from './processingDelivery.routes';
import aiRoutes from './ai.routes';
import auditRoutes from './audit.routes';
import jobsRoutes from './jobs.routes';
import purchaseOrderRoutes from './purchaseOrder.routes';
import grnRoutes from './grn.routes';
import mrpRoutes from './mrp.routes';
import embroideryRoutes from './embroidery.routes';
import embroideryStockRoutes from './embroidery-stock.routes';
import colorRoutes from './color.routes';
import seasonRoutes from './season.routes';
import lookupRoutes from './lookup.routes';
import trimDashboardRoutes from './trim-dashboard.routes';
import genericTrimRoutes from './generic-trim.routes';
import masterDataDashboardRoutes from './masterDataDashboard.routes';
import sampleRoutes from './sample.routes';
import printingRoutes from './printing.routes';
import dyeingRoutes from './dyeing.routes';
import cuttingRoutes from './cutting.routes';
import stitchingRoutes from './stitching.routes';
import finishingRoutes from './finishing.routes';
import dispatchRoutes from './dispatch.routes';

import testingLabsRoutes from './testingLabs.routes';
import testTemplatesRoutes from './testTemplates.routes';

import garmentPhysicalTestsRoutes from './garmentPhysicalTests.routes';
import productionStatusRoutes from './productionStatus.routes';
import productCategoryRoutes from './productCategory.routes';
import conversationRoutes from './conversation.routes';
import aiAdminRoutes from './ai-admin.routes';
import stageValidationRoutes from './stageTransitionValidation.routes';
import invoiceRoutes from './invoice.routes';
import quotationRoutes from './quotation.routes';
import creditNoteRoutes from './creditNote.routes';
import debitNoteRoutes from './debitNote.routes';
import documentRoutes from './document.routes';
import locationRoutes from './location.routes';
import gstRoutes from './gst.routes';
import gstReportRoutes from './gstReport.routes';
import tdsRoutes from './tds.routes';
import tcsRoutes from './tcs.routes';
import permissionRoutes from './permission.routes';
import fabricCostingRoutes from './fabric-costing.routes';
import fabricCostingRunRoutes from './fabric-costing-run.routes';
import processorRateCardV2Routes from './processor-rate-card-v2.routes';
import serviceRequirementRoutes from './service-requirement.routes';
import unifiedPORoutes from './unified-po.routes';
import challanRoutes from './challan.routes';
// Design Hub routes
import styleImageRoutes from './style-image.routes';
import styleCommentRoutes from './style-comment.routes';
import styleTechSpecsRoutes from './style-tech-specs.routes';
import designerDashboardRoutes from './designer-dashboard.routes';
import moodBoardRoutes from './mood-board.routes';
// DEPRECATED: Direct Cost Sheet -> PO generation bypasses Orders
// Use Order -> Order BOM -> MRP -> PO flow instead
// import costSheetPOGenerationRoutes from './costSheetPOGeneration.routes';

/**
 * Create the versioned API router
 * All routes are registered under this router
 */
export function createApiRouter(): Router {
  const router = Router();

  // Core routes
  router.use('/auth', authRoutes);
  router.use('/users', userRoutes);
  router.use('/dashboard', dashboardRoutes);

  // Style Management
  router.use('/styles', styleRoutes);
  router.use('/styles', styleImportRoutes);
  router.use('/styles', styleMaterialBOMRoutes);
  // Design Hub - Style Gallery, Comments, Tech Specs
  router.use('/styles', styleImageRoutes);
  router.use('/styles', styleCommentRoutes);
  router.use('/styles', styleTechSpecsRoutes);

  // CAD Planning (Independent Module)
  router.use('/cad-planning', cadPlanningRoutes);
  // Customer & Supplier Management
  router.use('/customers', customerRoutes);
  router.use('/customers', customerAccessoriesRoutes);
  router.use('/', customerSizePresetsRoutes);
  router.use('/suppliers', supplierRoutes);
  router.use('/agents', agentRoutes);
  router.use('/agencies', agencyRoutes);

  // Product Category Master
  router.use('/product-categories', productCategoryRoutes);

  // Material Management
  // New unified material master API
  router.use('/material-master', materialMasterRoutes);

  // Legacy specific routes (kept for backward compatibility)
  router.use('/materials/lace', laceRoutes);
  router.use('/materials/button', buttonRoutes);

  // Thread routes (consolidated)
  router.use('/', orderThreadRequirementRoutes); // Order thread requirements: /api/orders/:orderId/thread-requirements
  router.use('/materials/thread', threadRoutes); // Thread master and conversions: /api/materials/thread/*
  router.use('/materials/zipper', zipperRoutes);
  router.use('/materials/elastic', elasticRoutes);
  router.use('/materials/label', labelRoutes);
  router.use('/materials/packaging', packagingRoutes);
  router.use('/materials/machine-part', machinePartRoutes);
  router.use('/materials/other', otherMaterialRoutes);
  router.use('/size-categories', sizeCategoryRoutes);
  router.use('/materials', materialRoutes);

  // Order & BOM
  router.use('/orders', orderRoutes);
  router.use('/orders', orderBomRoutes); // Order BOM routes under /api/orders/:orderId/bom
  router.use('/orders/:orderId', orderLabelRouter);
  router.use('/order-items', orderItemsRoutes);
  router.use('/order-items/:orderItemId', orderItemLabelRouter);
  router.use('/order-label-overrides', orderLabelRoutes);
  router.use('/order-bom', orderBomStandaloneRouter); // Standalone Order BOM routes
  router.use('/style-costing', styleCostingRoutes);

  // Financial Management
  router.use('/chart-of-accounts', chartOfAccountsRoutes);
  router.use('/tax-masters', taxMastersRoutes);
  router.use('/hsn-sac-masters', hsnSacMasterRoutes);
  router.use('/payment-terms', paymentTermsRoutes);
  router.use('/currencies', currenciesRoutes);
  router.use('/invoices', invoiceRoutes);
  router.use('/quotations', quotationRoutes);
  router.use('/credit-notes', creditNoteRoutes);
  router.use('/debit-notes', debitNoteRoutes);
  router.use('/documents', documentRoutes);
  router.use('/cost-centers', costCentersRoutes);
  router.use('/expense-types', expenseTypesRoutes);
  router.use('/bank-accounts', bankAccountsRoutes);

  // Location & GST
  router.use('/locations', locationRoutes);
  router.use('/gst', gstRoutes);
  router.use('/gst-reports', gstReportRoutes);
  router.use('/tds', tdsRoutes);
  router.use('/tcs', tcsRoutes);
  router.use('/component-masters', componentMastersRoutes);
  router.use('/component-groups', componentGroupRoutes);
  router.use('/pattern-parts', patternPartRoutes);
  router.use('/components/:componentId/pattern-parts', componentPatternPartRoutes);

  // Import/Export
  router.use('/export', exportRoutes);
  router.use('/import', importRoutes);
  router.use('/templates', templateRoutes);

  // Inventory & Warehouse
  router.use('/warehouses', warehouseRoutes);
  router.use('/stock-levels', stockLevelRoutes);
  router.use('/stock-movements', stockMovementRoutes);
  router.use('/stock-counts', stockCountRoutes);

  // Job Work Processing
  router.use('/processing-batches', processingBatchRoutes);
  router.use('/processing-stages', processingStageRoutes);
  router.use('/processing-movements', processingMovementRoutes);
  router.use('/processing-deliveries', processingDeliveryRoutes);

  // Production
  router.use('/work-orders', workOrderRoutes);

  // Production Status Dashboard
  router.use('/production-status', productionStatusRoutes);

  // Procurement (Purchase Orders & GRN)
  router.use('/purchase-orders', purchaseOrderRoutes);
  router.use('/purchase-orders', unifiedPORoutes); // Unified PO routes (extended endpoints)
  router.use('/grn', grnRoutes);

  // DEPRECATED: Direct Cost Sheet -> PO generation bypasses Orders
  // Use Order -> Order BOM -> MRP -> PO flow instead
  // router.use('/cost-sheet-po', costSheetPOGenerationRoutes);

  // MRP (Material Requirement Planning)
  router.use('/mrp', mrpRoutes);

  // Service Requirements (Work Order Service PO Management)
  router.use('/', serviceRequirementRoutes);

  // Challans (Material Movement), PO Rate Resolution, Production Run Split
  router.use('/', challanRoutes);

  // Fabric & Greige
  router.use('/greige', greigeStockRoutes);
  router.use('/fabric-management', fabricGreigeRoutes);
  router.use('/procurement', fabricProcurementRoutes);
  router.use('/stock', fabricStockRoutes);
  router.use('/processing', fabricProcessingRoutes);

  // Fabric Costing & Processor Rate Cards
  router.use('/fabric-costing', fabricCostingRoutes);
  router.use('/fabric-costing-runs', fabricCostingRunRoutes);
  router.use('/processor-rate-cards/v2', processorRateCardV2Routes);

  // Lace Costing (3 sourcing strategies: STOCK_REUSE, READY_LACE, GREIGE_PROCESSED)
  router.use('/lace-costing', laceCostingRoutes);

  // Lace Stock Management (allocation, transfer, consumption, returns)
  router.use('/lace-stock', laceStockRoutes);

  // Embroidery Master
  router.use('/embroidery', embroideryRoutes);

  // Embroidery Stock (Send-out/Receive workflow)
  router.use('/embroidery-stock', embroideryStockRoutes);

  // Lace Lab Dip (Approval workflow for greige lace processing)
  router.use('/lace-lab-dips', laceLabDipRoutes);

  // Lace Issue Notes (Issue lace to production floor)
  router.use('/lace-issue-notes', laceIssueNoteRoutes);

  // Lace Defects (Track defects, submit claims, record replacements)
  router.use('/lace-defects', laceDefectRoutes);

  // Color Master
  router.use('/colors', colorRoutes);

  // Season Master
  router.use('/seasons', seasonRoutes);

  // Lookup Values (Configurable Dropdowns)
  router.use('/lookups', lookupRoutes);

  // Trim Masters Dashboard
  router.use('/trims', trimDashboardRoutes);

  // Generic Trims (New trim types: hook_eye, snap_button, buckle, etc.)
  router.use('/generic-trims', genericTrimRoutes);

  // Master Data Dashboard (Unified view of all masters)
  router.use('/master-data', masterDataDashboardRoutes);

  // Sample Tracking (Manufacturing)
  router.use('/samples', sampleRoutes);

  // Printing (Fabric Processing)
  router.use('/printing', printingRoutes);

  // Dyeing (Fabric Processing)
  router.use('/dyeing', dyeingRoutes);

  // Cutting (Manufacturing)
  router.use('/cutting', cuttingRoutes);

  // Stitching (Manufacturing)
  router.use('/stitching', stitchingRoutes);

  // Finishing (Manufacturing)
  router.use('/finishing', finishingRoutes);

  // Dispatch (Manufacturing)
  router.use('/dispatch', dispatchRoutes);

  // Testing Module (Labs, Templates, FPT, GPT)
  router.use('/testing-labs', testingLabsRoutes);
  router.use('/test-templates', testTemplatesRoutes);

  router.use('/garment-physical-tests', garmentPhysicalTestsRoutes);

  // Production Stage Validation & Blocking
  router.use('/stage-validation', stageValidationRoutes);

  // AI
  router.use('/ai', aiRoutes);

  // AI Conversations (Persistent Memory)
  router.use('/conversations', conversationRoutes);

  // AI Admin (Indexing, RAG Management)
  router.use('/ai-admin', aiAdminRoutes);

  // Audit Logs
  router.use('/audit', auditRoutes);

  // Background Jobs
  router.use('/jobs', jobsRoutes);

  // Admin: Permissions
  router.use('/permissions', permissionRoutes);

  // Design Hub
  router.use('/designer', designerDashboardRoutes);
  router.use('/mood-boards', moodBoardRoutes);

  return router;
}

// Export individual routes for direct access if needed
export {
  authRoutes,
  userRoutes,
  styleRoutes,
  customerRoutes,
  supplierRoutes,
  materialRoutes,
  orderRoutes,
  orderBomRoutes,
};

export default createApiRouter;
