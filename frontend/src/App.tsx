import { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from './stores/auth.store';
import { Toaster } from './components/ui/toaster';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// Keep Login and Register as eager imports for fast initial load
import Login from './pages/Login';
import Register from './pages/Register';

// Lazy-loaded page components (code splitting)
import {
  PageLoader,
  Dashboard,
  DashboardRouter,
  GeneralDashboard,
  ProductionDashboard,
  SalesDashboard,
  AccountsDashboard,
  Users,
  UserForm,
  PendingUsersPage,
  Profile,
  Settings,
  TallySettings,
  TallyCustomers,
  TallyInvoices,
  TallyOutstanding,
  TallyCreditNotes,
  TallySuppliers,
  TallyDebitNotes,
  TallyPayments,
  EInvoiceSettings,
  EInvoiceInvoices,
  TemplateManager,
  WhatsAppLink,
  MessageStaff,
  StyleList,
  StyleFormRedesigned,
  StyleDetail,
  StyleBulkImport,
  StyleStockEntry,
  StyleFabricReport,
  CADPlanningList,
  CADPlanningPage,
  CustomerList,
  CustomerForm,
  CustomerDetail,
  AgentList,
  AgencyList,
  SupplierList,
  SupplierForm,
  SupplierDetail,
  MaterialList,
  MaterialForm,
  MaterialDetail,
  OrderList,
  OrderForm,
  OrderDetail,
  OrderBOMList,
  OrderBOMDetail,
  CostSheetList,
  CostSheetForm,
  CostSheetDetail,
  FabricCostingPage,
  FabricCostingOptionsPage,
  StyleFabricCostingOptionsPage,
  ProcessorRateCardPage,
  ChartOfAccountsList,
  HSNSACMasterList,
  TaxMasterList,
  InvoiceList,
  InvoiceForm,
  InvoiceDetail,
  QuotationList,
  QuotationForm,
  QuotationDetail,
  CreditNoteList,
  CreditNoteDetail,
  DebitNoteList,
  GSTReports,
  TDSList,
  TCSList,
  TaxCompliancePage,
  StockDashboard,
  WarehouseList,
  WarehouseForm,
  StockLevelList,
  StockMovementList,
  StockMovementDashboard,
  StockInForm,
  StockOutForm,
  StockTransferForm,
  StockAdjustmentForm,
  StockCountList,
  StockCountForm,
  StockCountDetail,
  FGStockList,
  WorkOrderList,
  WorkOrderDetail,
  WorkOrderForm,
  StockProductionOrderList,
  StockProductionOrderDetail,
  SaleOrderList,
  SaleOrderDetail,
  GreigeList,
  GreigeDetail,
  GreigeForm,
  GreigeBulkImport,
  GreigeStockEntry,
  GreigeAvailableStock,
  FabricList,
  FabricDetail,
  FabricForm,
  FabricBulkImport,
  FabricStockEntry,
  FabricAvailableStock,
  FabricUsageReport,
  LaceList,
  LaceForm,
  LaceDetail,
  LaceLabDipList,
  LaceLabDipForm,
  LaceStockList,
  LaceStockDetail,
  LaceStockAging,
  LaceDefectList,
  LaceDefectForm,
  ButtonList,
  ButtonForm,
  ButtonDetail,
  ThreadList,
  ThreadForm,
  ThreadDetail,
  ZipperList,
  ZipperForm,
  ZipperDetail,
  ElasticList,
  ElasticForm,
  ElasticDetail,
  LabelList,
  LabelForm,
  LabelDetail,
  SizeCategoryList,
  SizeCategoryForm,
  PackagingList,
  PackagingForm,
  PackagingDetail,
  MachinePartList,
  MachinePartForm,
  OtherMaterialList,
  OtherMaterialForm,
  ComponentMasters,
  ComponentGroupMaster,
  PatternPartMaster,
  AIAssistant,
  NotFound,
  PurchaseOrderList,
  PurchaseOrderForm,
  PurchaseOrderDetail,
  GRNList,
  GRNForm,
  GRNDetail,
  UnifiedRequirementsPage,
  JobWorkDashboard,
  ProcessingBatchList,
  ProcessingBatchDetail,
  ProcessingBatchCreateForm,
  JobWorkOrderList,
  JobWorkOrderDetail,
  EmbroideryList,
  EmbroideryForm,
  EmbroideryDetail,
  EmbroideryAvailableStock,
  EmbroideryStockSendOut,
  EmbroideryStockReceive,
  ManufacturingControlCenter,
  SmockingDashboard,
  SmockingSendOut,
  SmockingReceive,
  HandworkDashboard,
  HandworkSendOut,
  HandworkReceive,
  EmbroideryPieceDashboard,
  EmbroideryPieceSendOut,
  EmbroideryPieceReceive,
  ColorMasterList,
  ColorMasterForm,
  ColorBulkImport,
  SeasonMasterList,
  SeasonMasterForm,
  TrimMastersDashboard,
  MasterDataDashboard,
  GenericTrimList,
  GenericTrimForm,
  SampleList,
  SampleDetail,
  SampleForm,
  PrintingList,
  PrintLabDipCreate,
  PrintLabDipDetail,
  PrintProcessPOCreate,
  PrintProcessPODetail,
  DyeingList,
  DyeLabDipCreate,
  DyeLabDipDetail,
  DyeProcessPOCreate,
  DyeProcessPODetail,
  ProcessingList,
  // BUG-DASH4 fix: Add unified processing create/detail routes
  UnifiedLabDipCreate,
  UnifiedProcessPOCreate,
  UnifiedProcessPODetail,
  CuttingList,
  CuttingForm,
  CuttingChart,
  CuttingDetail,
  StitchingList,
  StitchingForm,
  StitchingDetail,
  FinishingList,
  FinishingForm,
  FinishingDetail,
  DispatchList,
  DispatchDeliveryNoteForm,
  DispatchDeliveryNoteDetail,
  DispatchPODForm,
  ASNDetail,
  ASNCreateForm,
  ProductionStatus,
  TestingDashboard,
  FabricPhysicalTests,
  FabricPhysicalTestForm,
  GarmentPhysicalTests,
  GarmentPhysicalTestForm,
  TestingLabs,
  TestTemplates,
  TestTemplateForm,
  ProductCategoryMaster,
  ProcessGuidePage,
  OverrideHistory,
  PermissionManagement,
  CatalogueGenerator,
  // Design Hub
  DesignDashboard,
  MoodBoardList,
  MoodBoardDetail,
  // Challans
  ChallanList,
  ChallanForm,
  ChallanDetail,
} from './routes/lazy-routes';

/** Redirect that preserves existing query params while merging new ones */
function RedirectWithParams({ to }: { to: string }) {
  const [searchParams] = useSearchParams();
  const url = new URL(to, window.location.origin);
  searchParams.forEach((value, key) => {
    if (!url.searchParams.has(key)) url.searchParams.set(key, value);
  });
  return <Navigate to={url.pathname + url.search} replace />;
}

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Toaster />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Redirect root to dashboard if authenticated, otherwise to login */}
            <Route
              path="/"
              element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />}
            />

            {/* Public routes */}
            <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} />
            <Route path="/register" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Register />} />

            {/* Protected routes - wrapped with Layout */}
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              {/* Dashboard - Routes to role-specific dashboard */}
              <Route path="/dashboard" element={<DashboardRouter />} />
              <Route path="/dashboard/main" element={<Dashboard />} />
              <Route path="/dashboard/admin" element={<GeneralDashboard />} />
              <Route path="/dashboard/general" element={<GeneralDashboard />} />
              <Route path="/dashboard/production" element={<ProductionDashboard />} />
              <Route path="/dashboard/sales" element={<SalesDashboard />} />
              <Route path="/dashboard/accounts" element={<AccountsDashboard />} />

              {/* Process Guide */}
              <Route path="/process-guide" element={<ProcessGuidePage />} />

              {/* Admin Pages */}
              <Route path="/admin/override-history" element={<OverrideHistory />} />
              <Route path="/admin/permissions" element={<PermissionManagement />} />

              {/* User Management */}
              <Route path="/users" element={<Users />} />
              <Route path="/users/pending" element={<PendingUsersPage />} />
              <Route path="/users/new" element={<UserForm mode="create" />} />
              <Route path="/users/edit/:id" element={<UserForm mode="edit" />} />

              {/* Profile & Settings */}
              <Route path="/profile" element={<Profile />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/settings/export-templates" element={<TemplateManager />} />
              <Route path="/settings/tally" element={<TallySettings />} />
              <Route path="/settings/tally/customers" element={<TallyCustomers />} />
              <Route path="/settings/tally/invoices" element={<TallyInvoices />} />
              <Route path="/settings/tally/outstanding" element={<TallyOutstanding />} />
              <Route path="/settings/tally/credit-notes" element={<TallyCreditNotes />} />
              <Route path="/settings/tally/suppliers" element={<TallySuppliers />} />
              <Route path="/settings/tally/debit-notes" element={<TallyDebitNotes />} />
              <Route path="/settings/tally/payments" element={<TallyPayments />} />
              <Route path="/settings/einvoice" element={<EInvoiceSettings />} />
              <Route path="/settings/einvoice/invoices" element={<EInvoiceInvoices />} />

              {/* Messaging (per-user WhatsApp) */}
              <Route path="/whatsapp" element={<WhatsAppLink />} />
              <Route path="/messages/new" element={<MessageStaff />} />

              {/* Style Master */}
              <Route path="/styles" element={<StyleList />} />
              <Route path="/styles/new" element={<StyleFormRedesigned />} />
              <Route path="/styles/:id/edit" element={<StyleFormRedesigned />} />
              <Route path="/styles/:id" element={<StyleDetail />} />

              {/* CAD Planning Module (Independent) */}
              <Route path="/cad-planning" element={<CADPlanningList />} />
              <Route path="/cad-planning/:id" element={<CADPlanningPage />} />
              {/* Backward compatibility: old route still works */}
              <Route path="/styles/:id/cad-planning" element={<CADPlanningPage />} />

              {/* Style Import & Stock Management */}
              <Route path="/styles/import" element={<StyleBulkImport />} />
              <Route path="/styles/:styleId/stock-entry" element={<StyleStockEntry />} />
              <Route path="/reports/style-fabric" element={<StyleFabricReport />} />
              <Route path="/reports/fabric-usage" element={<FabricUsageReport />} />
              <Route path="/greige-stock" element={<GreigeAvailableStock />} />
              <Route path="/greige-stock-entry" element={<GreigeStockEntry />} />

              {/* Fabric & Greige Management (Phase 1A) */}
              <Route path="/greige" element={<GreigeList />} />
              <Route path="/greige/bulk-import" element={<GreigeBulkImport />} />
              <Route path="/greige/new" element={<GreigeForm mode="create" />} />
              <Route path="/greige/:id" element={<GreigeDetail />} />
              <Route path="/greige/:id/edit" element={<GreigeForm mode="edit" />} />
              <Route path="/fabric" element={<FabricList />} />
              <Route path="/fabric/bulk-import" element={<FabricBulkImport />} />
              <Route path="/fabric/new" element={<FabricForm mode="create" />} />
              <Route path="/fabric/:id" element={<FabricDetail />} />
              <Route path="/fabric/:id/edit" element={<FabricForm mode="edit" />} />
              <Route path="/fabric-stock-entry" element={<FabricStockEntry />} />
              <Route path="/fabric-stock" element={<FabricAvailableStock />} />

              {/* Customer Management */}
              <Route path="/customers" element={<CustomerList />} />
              <Route path="/customers/new" element={<CustomerForm mode="create" />} />
              <Route path="/customers/:id" element={<CustomerDetail />} />
              <Route path="/customers/:id/edit" element={<CustomerForm mode="edit" />} />

              {/* Agent Management */}
              <Route path="/agents" element={<AgentList />} />
              <Route path="/agencies" element={<AgencyList />} />

              {/* Supplier Management */}
              <Route path="/suppliers" element={<SupplierList />} />
              <Route path="/suppliers/new" element={<SupplierForm mode="create" />} />
              <Route path="/suppliers/:id" element={<SupplierDetail />} />
              <Route path="/suppliers/:id/edit" element={<SupplierForm mode="edit" />} />

              {/* Material Management (Raw Materials) */}
              {/* Using /materials/raw/:id to avoid conflicts with trim type routes like /materials/belt */}
              <Route path="/materials" element={<MaterialList />} />
              <Route path="/materials/new" element={<MaterialForm mode="create" />} />
              <Route path="/materials/raw/:id" element={<MaterialDetail />} />
              <Route path="/materials/raw/:id/edit" element={<MaterialForm mode="edit" />} />

              {/* Trim Masters Dashboard */}
              <Route path="/trim-masters" element={<TrimMastersDashboard />} />

              {/* Master Data Dashboard (Unified view of all masters) */}
              <Route path="/master-data" element={<MasterDataDashboard />} />

              {/* Material Master Management (Phase 1) - Legacy */}
              {/* Lace Management */}
              <Route path="/materials/lace" element={<LaceList />} />
              <Route path="/materials/lace/new" element={<LaceForm mode="create" />} />
              <Route path="/materials/lace/:id" element={<LaceDetail />} />
              <Route path="/materials/lace/:id/edit" element={<LaceForm mode="edit" />} />

              {/* Lace Lab Dip Management */}
              <Route path="/lace-lab-dips" element={<LaceLabDipList />} />
              <Route path="/lace-lab-dips/new" element={<LaceLabDipForm />} />
              <Route path="/lace-lab-dips/:id" element={<LaceLabDipForm />} />
              <Route path="/lace-lab-dips/:id/workflow" element={<LaceLabDipForm />} />

              {/* Lace Stock Management */}
              <Route path="/lace-stock" element={<LaceStockList />} />
              <Route path="/lace-stock/aging" element={<LaceStockAging />} />
              <Route path="/lace-stock/:id" element={<LaceStockDetail />} />

              {/* Lace Defect Management */}
              <Route path="/lace-defects" element={<LaceDefectList />} />
              <Route path="/lace-defects/new" element={<LaceDefectForm />} />
              <Route path="/lace-defects/:id" element={<LaceDefectForm />} />

              {/* Button Management */}
              <Route path="/materials/button" element={<ButtonList />} />
              <Route path="/materials/button/new" element={<ButtonForm mode="create" />} />
              <Route path="/materials/button/:id" element={<ButtonDetail />} />
              <Route path="/materials/button/:id/edit" element={<ButtonForm mode="edit" />} />

              {/* Thread Management */}
              <Route path="/materials/thread" element={<ThreadList />} />
              <Route path="/materials/thread/new" element={<ThreadForm mode="create" />} />
              <Route path="/materials/thread/:id" element={<ThreadDetail />} />
              <Route path="/materials/thread/:id/edit" element={<ThreadForm mode="edit" />} />

              {/* Zipper Management (Phase 1B) */}
              <Route path="/materials/zipper" element={<ZipperList />} />
              <Route path="/materials/zipper/new" element={<ZipperForm mode="create" />} />
              <Route path="/materials/zipper/:id" element={<ZipperDetail />} />
              <Route path="/materials/zipper/:id/edit" element={<ZipperForm mode="edit" />} />

              {/* Elastic Management (Phase 1B) */}
              <Route path="/materials/elastic" element={<ElasticList />} />
              <Route path="/materials/elastic/new" element={<ElasticForm mode="create" />} />
              <Route path="/materials/elastic/:id" element={<ElasticDetail />} />
              <Route path="/materials/elastic/:id/edit" element={<ElasticForm mode="edit" />} />

              {/* Label Management (Phase 1B) */}
              <Route path="/materials/label" element={<LabelList />} />
              <Route path="/materials/label/new" element={<LabelForm mode="create" />} />
              <Route path="/materials/label/:id" element={<LabelDetail />} />
              <Route path="/materials/label/:id/edit" element={<LabelForm mode="edit" />} />

              {/* Size Category Management */}
              <Route path="/masters/size-categories" element={<SizeCategoryList />} />
              <Route path="/masters/size-categories/new" element={<SizeCategoryForm mode="create" />} />
              <Route path="/masters/size-categories/:id" element={<SizeCategoryList />} />
              <Route path="/masters/size-categories/:id/edit" element={<SizeCategoryForm mode="edit" />} />

              {/* Packaging Management (Phase 1B) */}
              <Route path="/materials/packaging" element={<PackagingList />} />
              <Route path="/materials/packaging/new" element={<PackagingForm mode="create" />} />
              <Route path="/materials/packaging/:id" element={<PackagingDetail />} />
              <Route path="/materials/packaging/:id/edit" element={<PackagingForm mode="edit" />} />

              {/* Machine Parts Management */}
              <Route path="/materials/machine-part" element={<MachinePartList />} />
              <Route path="/materials/machine-part/new" element={<MachinePartForm mode="create" />} />
              <Route path="/materials/machine-part/:id/edit" element={<MachinePartForm mode="edit" />} />

              {/* Other Materials Management */}
              <Route path="/materials/other" element={<OtherMaterialList />} />
              <Route path="/materials/other/new" element={<OtherMaterialForm mode="create" />} />
              <Route path="/materials/other/:id/edit" element={<OtherMaterialForm mode="edit" />} />

              {/* Generic Trim Management (New trim types: hook_eye, snap_button, buckle, belt, velcro, etc.) */}
              {/* Uses :trimType parameter so GenericTrimList/Form can get trim type from useParams */}
              <Route path="/materials/:trimType" element={<GenericTrimList />} />
              <Route path="/materials/:trimType/new" element={<GenericTrimForm />} />
              <Route path="/materials/:trimType/:id" element={<GenericTrimForm />} />
              <Route path="/materials/:trimType/:id/edit" element={<GenericTrimForm />} />

              {/* Order Management */}
              <Route path="/orders" element={<OrderList />} />
              <Route path="/orders/new" element={<OrderForm />} />
              <Route path="/orders/:id" element={<OrderDetail />} />
              <Route path="/orders/:id/edit" element={<OrderForm />} />

              {/* Order BOM */}
              <Route path="/order-bom" element={<OrderBOMList />} />
              <Route path="/order-bom/:id" element={<OrderBOMDetail />} />

              {/* Cost Sheet Management */}
              {/* Note: Order BOM is now created automatically after Cost Sheet approval */}
              <Route path="/cost-sheets" element={<CostSheetList />} />
              <Route path="/cost-sheets/new" element={<CostSheetForm />} />
              <Route path="/cost-sheets/:id" element={<CostSheetDetail />} />
              <Route path="/cost-sheets/:id/edit" element={<CostSheetForm />} />

              {/* Fabric Costing */}
              <Route path="/fabric-costing" element={<FabricCostingPage />} />
              <Route path="/fabric-costing/options" element={<FabricCostingOptionsPage />} />
              <Route path="/fabric-costing/style/:styleId" element={<StyleFabricCostingOptionsPage />} />
              <Route path="/processor-rate-cards" element={<ProcessorRateCardPage />} />

              {/* Financial Management */}
              <Route path="/chart-of-accounts" element={<ChartOfAccountsList />} />

              {/* Tax & GST Masters */}
              <Route path="/hsn-sac-masters" element={<HSNSACMasterList />} />
              <Route path="/tax-masters" element={<TaxMasterList />} />

              {/* Invoice Management */}
              <Route path="/invoices" element={<InvoiceList />} />
              <Route path="/invoices/new" element={<InvoiceForm />} />
              <Route path="/invoices/:id/edit" element={<InvoiceForm />} />
              <Route path="/invoices/:id" element={<InvoiceDetail />} />

              {/* Quotation Management */}
              <Route path="/quotations" element={<QuotationList />} />
              <Route path="/quotations/new" element={<QuotationForm />} />
              <Route path="/quotations/:id/edit" element={<QuotationForm />} />
              <Route path="/quotations/:id" element={<QuotationDetail />} />

              {/* Credit & Debit Notes */}
              <Route path="/credit-notes" element={<CreditNoteList />} />
              <Route path="/credit-notes/:id" element={<CreditNoteDetail />} />
              <Route path="/debit-notes" element={<DebitNoteList />} />

              {/* GST Reports */}
              <Route path="/finance/tax-gst" element={<TaxCompliancePage />} />
              <Route path="/gst-reports" element={<GSTReports />} />
              <Route path="/tds" element={<TDSList />} />
              <Route path="/tcs" element={<TCSList />} />

              {/* Component Masters */}
              <Route path="/component-masters" element={<ComponentMasters />} />
              <Route path="/component-groups" element={<ComponentGroupMaster />} />
              <Route path="/pattern-parts" element={<PatternPartMaster />} />

              {/* Product Category Master */}
              <Route path="/product-categories" element={<ProductCategoryMaster />} />

              {/* Inventory & Warehouse Management (Phase 3) */}
              <Route path="/inventory/dashboard" element={<StockDashboard />} />
              <Route path="/inventory/warehouses" element={<WarehouseList />} />
              <Route path="/inventory/warehouses/new" element={<WarehouseForm />} />
              <Route path="/inventory/warehouses/:id/edit" element={<WarehouseForm />} />
              <Route path="/inventory/movement-dashboard" element={<StockMovementDashboard />} />
              <Route path="/inventory/movements" element={<StockMovementList />} />
              <Route path="/inventory/movements/stock-in" element={<StockInForm />} />
              <Route path="/inventory/movements/stock-out" element={<StockOutForm />} />
              <Route path="/inventory/movements/transfer" element={<StockTransferForm />} />
              <Route path="/inventory/movements/adjustment" element={<StockAdjustmentForm />} />
              <Route path="/inventory/stock-levels" element={<StockLevelList />} />
              <Route path="/inventory/fg-stock" element={<FGStockList />} />
              {/* BUG-DASH3 fix: Stock Counts workflow routes verified 2026-08-02
                  - Routes match navigation.ts and backend /api/stock-counts
                  - Components: StockCountList, StockCountForm, StockCountDetail (all exist with default exports)
                  - Lazy imports in lazy-routes.tsx lines 174-176
                  - Backend routes in stockCount.routes.ts, registered in routes/index.ts
                  - Permission: stockCounts (ADMIN, INVENTORY roles)
                  - If 404 persists: check process age (stale server), user role, or browser cache */}
              <Route path="/inventory/stock-counts" element={<StockCountList />} />
              <Route path="/inventory/stock-counts/new" element={<StockCountForm />} />
              <Route path="/inventory/stock-counts/:id" element={<StockCountDetail />} />

              {/* Production Planning (Phase 5.4) */}
              <Route path="/stock-production-orders" element={<StockProductionOrderList />} />
              <Route path="/stock-production-orders/:id" element={<StockProductionOrderDetail />} />
              <Route path="/sale-orders" element={<SaleOrderList />} />
              <Route path="/sale-orders/:id" element={<SaleOrderDetail />} />
              <Route path="/production/work-orders" element={<WorkOrderList />} />
              <Route path="/production/work-orders/:id" element={<WorkOrderDetail />} />
              {/* Work orders are auto-created with orders - redirect to list */}
              <Route path="/production/work-orders/new" element={<Navigate to="/production/work-orders" replace />} />
              <Route path="/production/work-orders/:id/edit" element={<WorkOrderForm />} />

              {/* Production Status Dashboard */}
              <Route path="/production/status" element={<ProductionStatus />} />

              {/* Procurement (Purchase Orders & GRN) */}
              <Route path="/procurement/purchase-orders" element={<PurchaseOrderList />} />
              <Route path="/procurement/purchase-orders/new" element={<PurchaseOrderForm />} />
              <Route path="/procurement/purchase-orders/:id" element={<PurchaseOrderDetail />} />
              <Route path="/procurement/purchase-orders/:id/edit" element={<PurchaseOrderForm />} />
              <Route path="/procurement/grn" element={<GRNList />} />
              <Route path="/procurement/grn/new" element={<GRNForm />} />
              <Route path="/procurement/grn/:id" element={<GRNDetail />} />

              {/* Unified Procurement Requirements (Material + Service combined) */}
              <Route path="/procurement/requirements" element={<UnifiedRequirementsPage />} />

              {/* Backward compatibility: old MRP/Service routes redirect to unified page */}
              <Route path="/mrp" element={<RedirectWithParams to="/procurement/requirements?tab=material" />} />
              <Route
                path="/mrp/requirements"
                element={<RedirectWithParams to="/procurement/requirements?tab=material" />}
              />
              <Route
                path="/service-requirements"
                element={<RedirectWithParams to="/procurement/requirements?tab=outsourced" />}
              />
              <Route
                path="/service-requirements/list"
                element={<RedirectWithParams to="/procurement/requirements?tab=outsourced" />}
              />

              {/* Job Work Processing (Multi-Stage) */}
              <Route path="/processing/job-work" element={<JobWorkDashboard />} />
              <Route path="/processing/batches" element={<ProcessingBatchList />} />
              <Route path="/processing/batches/new" element={<ProcessingBatchCreateForm />} />
              <Route path="/processing/batches/:id" element={<ProcessingBatchDetail />} />

              {/* Job Work Orders (Unified) */}
              <Route path="/job-work-orders" element={<JobWorkOrderList />} />
              <Route path="/job-work-orders/:id" element={<JobWorkOrderDetail />} />

              {/* Sample Tracking (Manufacturing) */}
              <Route path="/samples" element={<SampleList />} />
              <Route path="/samples/new" element={<SampleForm />} />
              <Route path="/samples/:id" element={<SampleDetail />} />
              <Route path="/samples/:id/edit" element={<SampleForm />} />

              {/* Manufacturing Control Center (Alerts + Vendor Tracker) */}
              <Route path="/manufacturing" element={<ManufacturingControlCenter />} />

              {/* Printing (Manufacturing - Fabric Processing) */}
              <Route path="/manufacturing/printing" element={<PrintingList />} />
              <Route path="/manufacturing/printing/lab-dips/new" element={<PrintLabDipCreate />} />
              <Route path="/manufacturing/printing/lab-dips/:id" element={<PrintLabDipDetail />} />
              <Route path="/manufacturing/printing/process-pos/new" element={<PrintProcessPOCreate />} />
              <Route path="/manufacturing/printing/process-pos/:id" element={<PrintProcessPODetail />} />

              {/* Dyeing (Manufacturing - Fabric Processing) */}
              <Route path="/manufacturing/dyeing" element={<DyeingList />} />
              <Route path="/manufacturing/dyeing/lab-dips/new" element={<DyeLabDipCreate />} />
              <Route path="/manufacturing/dyeing/lab-dips/:id" element={<DyeLabDipDetail />} />
              <Route path="/manufacturing/dyeing/process-pos/new" element={<DyeProcessPOCreate />} />
              <Route path="/manufacturing/dyeing/process-pos/:id" element={<DyeProcessPODetail />} />

              {/* Unified Processing (Dyeing & Printing Combined) */}
              <Route path="/manufacturing/processing" element={<ProcessingList />} />
              {/* BUG-DASH4 fix: use unified wrapper with correct backPath for lab dips */}
              <Route path="/manufacturing/processing/lab-dips/new" element={<UnifiedLabDipCreate />} />
              {/* BUG-DASH4 fix: corrected route path - use unified wrapper with correct backPath */}
              <Route path="/manufacturing/processing/process-pos/new" element={<UnifiedProcessPOCreate />} />
              <Route path="/manufacturing/processing/process-pos/:id" element={<UnifiedProcessPODetail />} />

              {/* Cutting (Manufacturing - Production) */}
              <Route path="/manufacturing/cutting" element={<CuttingList />} />
              <Route path="/manufacturing/cutting/new" element={<CuttingChart />} />
              <Route path="/manufacturing/cutting/:id" element={<CuttingDetail />} />
              <Route path="/manufacturing/cutting/:id/edit" element={<CuttingForm />} />

              {/* Stitching (Manufacturing - Production) */}
              <Route path="/manufacturing/stitching" element={<StitchingList />} />
              <Route path="/manufacturing/stitching/new" element={<StitchingForm />} />
              <Route path="/manufacturing/stitching/:id" element={<StitchingDetail />} />

              {/* Finishing (Manufacturing - Production) */}
              <Route path="/manufacturing/finishing" element={<FinishingList />} />
              <Route path="/manufacturing/finishing/new" element={<FinishingForm />} />
              <Route path="/manufacturing/finishing/:id" element={<FinishingDetail />} />

              {/* Challans (Material Movement) */}
              <Route path="/manufacturing/challans" element={<ChallanList />} />
              <Route path="/manufacturing/challans/new" element={<ChallanForm />} />
              <Route path="/manufacturing/challans/:id" element={<ChallanDetail />} />

              {/* Dispatch (Manufacturing - Final Step) */}
              {/* BUG-DASH10 fix: verified all routes match navigation links in DispatchList.tsx */}
              <Route path="/manufacturing/dispatch" element={<DispatchList />} />
              <Route path="/manufacturing/dispatch/delivery/new" element={<DispatchDeliveryNoteForm />} />
              <Route path="/manufacturing/dispatch/delivery/:id/pod" element={<DispatchPODForm />} />
              <Route path="/manufacturing/dispatch/delivery/:id" element={<DispatchDeliveryNoteDetail />} />
              <Route path="/manufacturing/dispatch/asn/new" element={<ASNCreateForm />} />
              <Route path="/manufacturing/dispatch/asn/:id" element={<ASNDetail />} />

              {/* Color Master */}
              <Route path="/colors" element={<ColorMasterList />} />
              <Route path="/colors/new" element={<ColorMasterForm mode="create" />} />
              <Route path="/colors/import" element={<ColorBulkImport />} />
              <Route path="/colors/:id/edit" element={<ColorMasterForm mode="edit" />} />

              {/* Season Master */}
              <Route path="/seasons" element={<SeasonMasterList />} />
              <Route path="/seasons/new" element={<SeasonMasterForm mode="create" />} />
              <Route path="/seasons/:id/edit" element={<SeasonMasterForm mode="edit" />} />

              {/* Embroidery Master */}
              <Route path="/embroidery" element={<EmbroideryList />} />
              <Route path="/embroidery/new" element={<EmbroideryForm mode="create" />} />
              <Route path="/embroidery/:id" element={<EmbroideryDetail />} />
              <Route path="/embroidery/:id/edit" element={<EmbroideryForm mode="edit" />} />

              {/* Embroidery Stock Management */}
              <Route path="/embroidery-stock" element={<EmbroideryAvailableStock />} />
              <Route path="/embroidery-stock/send-out" element={<EmbroideryStockSendOut />} />
              <Route path="/embroidery-stock/receive" element={<EmbroideryStockReceive />} />
              <Route path="/embroidery-stock/receive/:id" element={<EmbroideryStockReceive />} />

              {/* Embroidery Piece-Level (Cut Pieces) */}
              <Route path="/embroidery-stock/pieces" element={<EmbroideryPieceDashboard />} />
              <Route path="/embroidery-stock/piece-send-out" element={<EmbroideryPieceSendOut />} />
              <Route path="/embroidery-stock/piece-receive" element={<EmbroideryPieceReceive />} />
              <Route path="/embroidery-stock/piece-receive/:id" element={<EmbroideryPieceReceive />} />

              {/* Smocking (External Process) */}
              <Route path="/manufacturing/smocking" element={<SmockingDashboard />} />
              <Route path="/manufacturing/smocking/send-out" element={<SmockingSendOut />} />
              <Route path="/manufacturing/smocking/receive" element={<SmockingReceive />} />
              <Route path="/manufacturing/smocking/receive/:id" element={<SmockingReceive />} />

              {/* Handwork (External Process) */}
              <Route path="/manufacturing/handwork" element={<HandworkDashboard />} />
              <Route path="/manufacturing/handwork/send-out" element={<HandworkSendOut />} />
              <Route path="/manufacturing/handwork/receive" element={<HandworkReceive />} />
              <Route path="/manufacturing/handwork/receive/:id" element={<HandworkReceive />} />

              {/* Testing Module (FPT/GPT) */}
              <Route path="/testing" element={<TestingDashboard />} />
              <Route path="/fabric-physical-tests" element={<FabricPhysicalTests />} />
              <Route path="/fabric-physical-tests/new" element={<FabricPhysicalTestForm />} />
              <Route path="/fabric-physical-tests/:id" element={<FabricPhysicalTestForm />} />
              <Route path="/garment-physical-tests" element={<GarmentPhysicalTests />} />
              <Route path="/garment-physical-tests/new" element={<GarmentPhysicalTestForm />} />
              <Route path="/garment-physical-tests/:id" element={<GarmentPhysicalTestForm />} />
              <Route path="/testing-labs" element={<TestingLabs />} />
              <Route path="/test-templates" element={<TestTemplates />} />
              <Route path="/test-templates/new" element={<TestTemplateForm />} />
              <Route path="/test-templates/:id" element={<TestTemplateForm />} />

              {/* AI Assistant */}
              <Route path="/ai-assistant" element={<AIAssistant />} />

              {/* Document Generation */}
              <Route path="/catalogue-generator" element={<CatalogueGenerator />} />

              {/* Design Hub */}
              <Route path="/design-dashboard" element={<DesignDashboard />} />
              <Route path="/mood-boards" element={<MoodBoardList />} />
              <Route path="/mood-boards/new" element={<MoodBoardDetail />} />
              <Route path="/mood-boards/:id" element={<MoodBoardDetail />} />
            </Route>

            {/* 404 - Show NotFound page */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
