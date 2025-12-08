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
import greigeStockRoutes from './greige-stock.routes';
import dashboardRoutes from './dashboard.routes';
import customerRoutes from './customer.routes';
import customerAccessoriesRoutes from './customer-accessories.routes';
import supplierRoutes from './supplier.routes';
import materialRoutes from './material.routes';
import laceRoutes from './lace.routes';
import buttonRoutes from './button.routes';
import threadRoutes from './thread.routes';
import zipperRoutes from './zipper.routes';
import elasticRoutes from './elastic.routes';
import labelRoutes from './label.routes';
import packagingRoutes from './packaging.routes';
import styleMaterialBOMRoutes from './style-material-bom.routes';
import orderRoutes from './order.routes';
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

  // Customer & Supplier Management
  router.use('/customers', customerRoutes);
  router.use('/customers', customerAccessoriesRoutes);
  router.use('/suppliers', supplierRoutes);

  // Material Management (specific routes before general)
  router.use('/materials/lace', laceRoutes);
  router.use('/materials/button', buttonRoutes);
  router.use('/materials/thread', threadRoutes);
  router.use('/materials/zipper', zipperRoutes);
  router.use('/materials/elastic', elasticRoutes);
  router.use('/materials/label', labelRoutes);
  router.use('/materials/packaging', packagingRoutes);
  router.use('/materials', materialRoutes);

  // Order & BOM
  router.use('/orders', orderRoutes);
  router.use('/bom', bomRoutes);
  router.use('/style-costing', styleCostingRoutes);

  // Financial Management
  router.use('/chart-of-accounts', chartOfAccountsRoutes);
  router.use('/tax-masters', taxMastersRoutes);
  router.use('/payment-terms', paymentTermsRoutes);
  router.use('/currencies', currenciesRoutes);
  router.use('/cost-centers', costCentersRoutes);
  router.use('/expense-types', expenseTypesRoutes);
  router.use('/bank-accounts', bankAccountsRoutes);
  router.use('/component-masters', componentMastersRoutes);

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

  // AI
  router.use('/ai', aiRoutes);

  // Audit Logs
  router.use('/audit', auditRoutes);

  // Background Jobs
  router.use('/jobs', jobsRoutes);

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
