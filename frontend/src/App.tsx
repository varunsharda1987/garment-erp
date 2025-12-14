import { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
  Users,
  UserForm,
  StyleList,
  StyleFormRedesigned,
  StyleDetail,
  CADPlanningPage,
  StyleBulkImport,
  StyleStockEntry,
  StyleFabricReport,
  CustomerList,
  CustomerForm,
  CustomerDetail,
  SupplierList,
  SupplierForm,
  SupplierDetail,
  MaterialList,
  MaterialForm,
  MaterialDetail,
  OrderList,
  OrderForm,
  OrderDetail,
  BOMList,
  BOMForm,
  CostSheetList,
  CostSheetForm,
  ChartOfAccountsList,
  StockDashboard,
  WarehouseList,
  WarehouseForm,
  StockLevelList,
  StockMovementList,
  StockInForm,
  StockOutForm,
  StockTransferForm,
  StockAdjustmentForm,
  StockCountList,
  StockCountForm,
  WorkOrderList,
  WorkOrderDetail,
  WorkOrderForm,
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
  PackagingList,
  PackagingForm,
  PackagingDetail,
  ComponentMasters,
  AIAssistant,
  SelectTest,
  NotFound,
  PurchaseOrderList,
  PurchaseOrderForm,
  PurchaseOrderDetail,
  GRNList,
  GRNForm,
  GRNDetail,
  MRPDashboard,
  MaterialRequirementsList,
  JobWorkDashboard,
  ProcessingBatchList,
  ProcessingBatchDetail,
  EmbroideryList,
  EmbroideryForm,
  EmbroideryDetail,
  EmbroideryAvailableStock,
  EmbroideryStockSendOut,
  EmbroideryStockReceive,
  ColorMasterList,
  ColorMasterForm,
  TrimMastersDashboard,
  SampleList,
  SampleDetail,
  SampleForm,
  PrintingList,
  DyeingList,
  CuttingList,
  CuttingForm,
  CuttingDetail,
  StitchingList,
  StitchingForm,
  StitchingDetail,
  FinishingList,
  FinishingForm,
  FinishingDetail,
  DispatchList,
  DispatchPODForm,
  ProductionStatus,
  TestingDashboard,
  FabricPhysicalTests,
  GarmentPhysicalTests,
  TestingLabs,
  TestTemplates,
} from './routes/lazy-routes';

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
            element={
              isAuthenticated ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          {/* Public routes */}
          <Route
            path="/login"
            element={
              isAuthenticated ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <Login />
              )
            }
          />
          <Route
            path="/register"
            element={
              isAuthenticated ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <Register />
              )
            }
          />

          {/* Protected routes - wrapped with Layout */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            {/* Dashboard */}
            <Route path="/dashboard" element={<Dashboard />} />

            {/* User Management */}
            <Route path="/users" element={<Users />} />
            <Route path="/users/new" element={<UserForm mode="create" />} />
            <Route path="/users/edit/:id" element={<UserForm mode="edit" />} />

            {/* Style Master */}
            <Route path="/styles" element={<StyleList />} />
            <Route path="/styles/new" element={<StyleFormRedesigned />} />
            <Route path="/styles/:id/edit" element={<StyleFormRedesigned />} />
            <Route path="/styles/:id" element={<StyleDetail />} />
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

            {/* Supplier Management */}
            <Route path="/suppliers" element={<SupplierList />} />
            <Route path="/suppliers/new" element={<SupplierForm mode="create" />} />
            <Route path="/suppliers/:id" element={<SupplierDetail />} />
            <Route path="/suppliers/:id/edit" element={<SupplierForm mode="edit" />} />

            {/* Material Management */}
            <Route path="/materials" element={<MaterialList />} />
            <Route path="/materials/new" element={<MaterialForm mode="create" />} />
            <Route path="/materials/:id" element={<MaterialDetail />} />
            <Route path="/materials/:id/edit" element={<MaterialForm mode="edit" />} />

            {/* Trim Masters Dashboard */}
            <Route path="/trim-masters" element={<TrimMastersDashboard />} />

            {/* Material Master Management (Phase 1) */}
            {/* Lace Management */}
            <Route path="/materials/lace" element={<LaceList />} />
            <Route path="/materials/lace/new" element={<LaceForm mode="create" />} />
            <Route path="/materials/lace/:id" element={<LaceDetail />} />
            <Route path="/materials/lace/:id/edit" element={<LaceForm mode="edit" />} />

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

            {/* Packaging Management (Phase 1B) */}
            <Route path="/materials/packaging" element={<PackagingList />} />
            <Route path="/materials/packaging/new" element={<PackagingForm mode="create" />} />
            <Route path="/materials/packaging/:id" element={<PackagingDetail />} />
            <Route path="/materials/packaging/:id/edit" element={<PackagingForm mode="edit" />} />

            {/* Order Management */}
            <Route path="/orders" element={<OrderList />} />
            <Route path="/orders/new" element={<OrderForm />} />
            <Route path="/orders/:id" element={<OrderDetail />} />
            <Route path="/orders/:id/edit" element={<OrderForm />} />

            {/* BOM Management */}
            <Route path="/bom" element={<BOMList />} />
            <Route path="/bom/new" element={<BOMForm />} />
            <Route path="/bom/:id/edit" element={<BOMForm />} />

            {/* Cost Sheet Management */}
            <Route path="/cost-sheets" element={<CostSheetList />} />
            <Route path="/cost-sheets/new" element={<CostSheetForm />} />
            <Route path="/cost-sheets/:id" element={<CostSheetList />} />
            <Route path="/cost-sheets/:id/edit" element={<CostSheetForm />} />

            {/* Financial Management */}
            <Route path="/chart-of-accounts" element={<ChartOfAccountsList />} />

            {/* Component Masters */}
            <Route path="/component-masters" element={<ComponentMasters />} />

            {/* Inventory & Warehouse Management (Phase 3) */}
            <Route path="/inventory/dashboard" element={<StockDashboard />} />
            <Route path="/inventory/warehouses" element={<WarehouseList />} />
            <Route path="/inventory/warehouses/new" element={<WarehouseForm />} />
            <Route path="/inventory/warehouses/:id/edit" element={<WarehouseForm />} />
            <Route path="/inventory/movements" element={<StockMovementList />} />
            <Route path="/inventory/movements/stock-in" element={<StockInForm />} />
            <Route path="/inventory/movements/stock-out" element={<StockOutForm />} />
            <Route path="/inventory/movements/transfer" element={<StockTransferForm />} />
            <Route path="/inventory/movements/adjustment" element={<StockAdjustmentForm />} />
            <Route path="/inventory/stock-levels" element={<StockLevelList />} />
            <Route path="/inventory/stock-counts" element={<StockCountList />} />
            <Route path="/inventory/stock-counts/new" element={<StockCountForm />} />

            {/* Production Planning (Phase 5.4) */}
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

            {/* MRP (Material Requirement Planning) */}
            <Route path="/mrp" element={<MRPDashboard />} />
            <Route path="/mrp/requirements" element={<MaterialRequirementsList />} />

            {/* Job Work Processing (Multi-Stage) */}
            <Route path="/processing/job-work" element={<JobWorkDashboard />} />
            <Route path="/processing/batches" element={<ProcessingBatchList />} />
            <Route path="/processing/batches/:id" element={<ProcessingBatchDetail />} />

            {/* Sample Tracking (Manufacturing) */}
            <Route path="/samples" element={<SampleList />} />
            <Route path="/samples/new" element={<SampleForm />} />
            <Route path="/samples/:id" element={<SampleDetail />} />
            <Route path="/samples/:id/edit" element={<SampleForm />} />

            {/* Printing (Manufacturing - Fabric Processing) */}
            <Route path="/manufacturing/printing" element={<PrintingList />} />

            {/* Dyeing (Manufacturing - Fabric Processing) */}
            <Route path="/manufacturing/dyeing" element={<DyeingList />} />

            {/* Cutting (Manufacturing - Production) */}
            <Route path="/manufacturing/cutting" element={<CuttingList />} />
            <Route path="/manufacturing/cutting/new" element={<CuttingForm />} />
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

            {/* Dispatch (Manufacturing - Final Step) */}
            <Route path="/manufacturing/dispatch" element={<DispatchList />} />
            <Route path="/manufacturing/dispatch/delivery/:id/pod" element={<DispatchPODForm />} />

            {/* Color Master */}
            <Route path="/colors" element={<ColorMasterList />} />
            <Route path="/colors/new" element={<ColorMasterForm mode="create" />} />
            <Route path="/colors/:id/edit" element={<ColorMasterForm mode="edit" />} />

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

            {/* Testing Module (FPT/GPT) */}
            <Route path="/testing" element={<TestingDashboard />} />
            <Route path="/fabric-physical-tests" element={<FabricPhysicalTests />} />
            <Route path="/garment-physical-tests" element={<GarmentPhysicalTests />} />
            <Route path="/testing-labs" element={<TestingLabs />} />
            <Route path="/test-templates" element={<TestTemplates />} />

            {/* AI Assistant */}
            <Route path="/ai-assistant" element={<AIAssistant />} />

            {/* Debug/Test Pages */}
            <Route path="/test/select" element={<SelectTest />} />
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
