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
import styleCADPlanningRoutes from './style-cad-planning.routes';
import styleLabelRoutes, { styleLabelRouter } from './style-label.routes';
import orderLabelRoutes, { orderItemLabelRouter, orderLabelRouter } from './order-label.routes';
import greigeStockRoutes from './greige-stock.routes';
import dashboardRoutes from './dashboard.routes';
import customerRoutes from './customer.routes';
import customerAccessoriesRoutes from './customer-accessories.routes';
import customerSizePresetsRoutes from './customer-size-presets.routes';
import supplierRoutes from './supplier.routes';
import materialRoutes from './material.routes';
import laceRoutes from './lace.routes';
import buttonRoutes from './button.routes';
import threadRoutes from './thread.routes';
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
import bomRoutes from './bom.routes';
import styleCostingRoutes from './styleCosting.routes';
import chartOfAccountsRoutes from './chartOfAccounts.routes';
import taxMastersRoutes from './taxMasters.routes';
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
import locationRoutes from './location.routes';
import gstRoutes from './gst.routes';
import permissionRoutes from './permission.routes';

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
  router.use('/styles', styleCADPlanningRoutes);
  router.use('/styles', styleMaterialBOMRoutes);
  router.use('/styles/:styleId/labels', styleLabelRouter);
  router.use('/style-labels', styleLabelRoutes);

  // Customer & Supplier Management
  router.use('/customers', customerRoutes);
  router.use('/customers', customerAccessoriesRoutes);
  router.use('/', customerSizePresetsRoutes);
  router.use('/suppliers', supplierRoutes);

  // Product Category Master
  router.use('/product-categories', productCategoryRoutes);

  // Material Management (specific routes before general)
  router.use('/materials/lace', laceRoutes);
  router.use('/materials/button', buttonRoutes);
  router.use('/materials/thread', threadRoutes);
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
  router.use('/orders/:orderId', orderLabelRouter);
  router.use('/order-items', orderItemsRoutes);
  router.use('/order-items/:orderItemId', orderItemLabelRouter);
  router.use('/order-label-overrides', orderLabelRoutes);
  router.use('/bom', bomRoutes);
  router.use('/style-costing', styleCostingRoutes);

  // Financial Management
  router.use('/chart-of-accounts', chartOfAccountsRoutes);
  router.use('/tax-masters', taxMastersRoutes);
  router.use('/payment-terms', paymentTermsRoutes);
  router.use('/currencies', currenciesRoutes);
  router.use('/invoices', invoiceRoutes);
  router.use('/quotations', quotationRoutes);
  router.use('/cost-centers', costCentersRoutes);
  router.use('/expense-types', expenseTypesRoutes);
  router.use('/bank-accounts', bankAccountsRoutes);

  // Location & GST
  router.use('/locations', locationRoutes);
  router.use('/gst', gstRoutes);
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
  router.use('/grn', grnRoutes);

  // MRP (Material Requirement Planning)
  router.use('/mrp', mrpRoutes);

  // Fabric & Greige
  router.use('/greige', greigeStockRoutes);
  router.use('/fabric-management', fabricGreigeRoutes);
  router.use('/procurement', fabricProcurementRoutes);
  router.use('/stock', fabricStockRoutes);
  router.use('/processing', fabricProcessingRoutes);

  // Embroidery Master
  router.use('/embroidery', embroideryRoutes);

  // Embroidery Stock (Send-out/Receive workflow)
  router.use('/embroidery-stock', embroideryStockRoutes);

  // Color Master
  router.use('/colors', colorRoutes);

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
  bomRoutes,
};

export default createApiRouter;
