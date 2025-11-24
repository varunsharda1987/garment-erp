import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth.store';
import { Toaster } from './components/ui/toaster';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import UserForm from './pages/UserForm';
import StyleList from './pages/StyleList';
import StyleForm from './pages/StyleForm';
import StyleDetail from './pages/StyleDetail';
import CadAverageManagement from './pages/CadAverageManagement';
import CustomerList from './pages/CustomerList';
import CustomerForm from './pages/CustomerForm';
import CustomerDetail from './pages/CustomerDetail';
import SupplierList from './pages/SupplierList';
import SupplierForm from './pages/SupplierForm';
import MaterialList from './pages/MaterialList';
import MaterialForm from './pages/MaterialForm';
import OrderList from './pages/OrderList';
import OrderForm from './pages/OrderForm';
import OrderDetail from './pages/OrderDetail';
import BOMList from './pages/BOMList';
import BOMForm from './pages/BOMForm';
import CostSheetList from './pages/CostSheetList';
import CostSheetForm from './pages/CostSheetForm';
import ChartOfAccountsList from './pages/ChartOfAccountsList';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// Inventory & Warehouse Management (Phase 3)
import StockDashboard from './pages/StockDashboard';
import WarehouseList from './pages/WarehouseList';
import WarehouseForm from './pages/WarehouseForm';
import StockLevelList from './pages/StockLevelList';
import StockMovementList from './pages/StockMovementList';
import StockInForm from './pages/StockInForm';
import StockOutForm from './pages/StockOutForm';
import StockTransferForm from './pages/StockTransferForm';
import StockAdjustmentForm from './pages/StockAdjustmentForm';
import StockCountList from './pages/StockCountList';
import StockCountForm from './pages/StockCountForm';

// Production Planning (Phase 5.4)
import ProductionDashboard from './pages/ProductionDashboard';
import WorkOrderList from './pages/WorkOrderList';
import WorkOrderForm from './pages/WorkOrderForm';

// AI Assistant
import AIAssistant from './pages/AIAssistant';

// Fabric & Greige Management (Phase 1A)
import GreigeList from './pages/GreigeList';
import GreigeDetail from './pages/GreigeDetail';
import GreigeForm from './pages/GreigeForm';
import GreigeBulkImport from './pages/GreigeBulkImport';
import FabricList from './pages/FabricList';
import FabricDetail from './pages/FabricDetail';
import FabricForm from './pages/FabricForm';
import FabricBulkImport from './pages/FabricBulkImport';
import FabricStockEntry from './pages/FabricStockEntry';
import FabricAvailableStock from './pages/FabricAvailableStock';

// Style Import & Stock Management
import StyleBulkImport from './pages/StyleBulkImport';
import StyleStockEntry from './pages/StyleStockEntry';
import GreigeStockEntry from './pages/GreigeStockEntry';
import StyleFabricReport from './pages/StyleFabricReport';
import FabricUsageReport from './pages/FabricUsageReport';
import GreigeAvailableStock from './pages/GreigeAvailableStock';

// Material Master Management (Phase 1)
import LaceList from './pages/LaceList';
import LaceForm from './pages/LaceForm';
import ButtonList from './pages/ButtonList';
import ButtonForm from './pages/ButtonForm';
import ThreadList from './pages/ThreadList';
import ThreadForm from './pages/ThreadForm';

// Material Master Management (Phase 1B)
import ZipperList from './pages/ZipperList';
import ZipperForm from './pages/ZipperForm';
import ElasticList from './pages/ElasticList';
import ElasticForm from './pages/ElasticForm';
import LabelList from './pages/LabelList';
import LabelForm from './pages/LabelForm';
import PackagingList from './pages/PackagingList';
import PackagingForm from './pages/PackagingForm';

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Toaster />
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
          <Route path="/styles/new" element={<StyleForm />} />
          <Route path="/styles/:id/edit" element={<StyleForm mode="edit" />} />
          <Route path="/styles/:id" element={<StyleDetail />} />

          {/* Style Import & Stock Management */}
          <Route path="/styles/import" element={<StyleBulkImport />} />
          <Route path="/styles/:styleId/stock-entry" element={<StyleStockEntry />} />
          <Route path="/reports/style-fabric" element={<StyleFabricReport />} />
          <Route path="/reports/fabric-usage" element={<FabricUsageReport />} />
          <Route path="/greige-stock" element={<GreigeAvailableStock />} />
          <Route path="/greige-stock-entry" element={<GreigeStockEntry />} />

          {/* CAD Average Management */}
          <Route path="/cad-averages" element={<CadAverageManagement />} />

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
          <Route path="/suppliers/:id/edit" element={<SupplierForm mode="edit" />} />

          {/* Material Management */}
          <Route path="/materials" element={<MaterialList />} />
          <Route path="/materials/new" element={<MaterialForm mode="create" />} />
          <Route path="/materials/:id/edit" element={<MaterialForm mode="edit" />} />

          {/* Material Master Management (Phase 1) */}
          {/* Lace Management */}
          <Route path="/materials/lace" element={<LaceList />} />
          <Route path="/materials/lace/new" element={<LaceForm mode="create" />} />
          <Route path="/materials/lace/:id/edit" element={<LaceForm mode="edit" />} />

          {/* Button Management */}
          <Route path="/materials/button" element={<ButtonList />} />
          <Route path="/materials/button/new" element={<ButtonForm mode="create" />} />
          <Route path="/materials/button/:id/edit" element={<ButtonForm mode="edit" />} />

          {/* Thread Management */}
          <Route path="/materials/thread" element={<ThreadList />} />
          <Route path="/materials/thread/new" element={<ThreadForm mode="create" />} />
          <Route path="/materials/thread/:id/edit" element={<ThreadForm mode="edit" />} />

          {/* Zipper Management (Phase 1B) */}
          <Route path="/materials/zipper" element={<ZipperList />} />
          <Route path="/materials/zipper/new" element={<ZipperForm mode="create" />} />
          <Route path="/materials/zipper/:id/edit" element={<ZipperForm mode="edit" />} />

          {/* Elastic Management (Phase 1B) */}
          <Route path="/materials/elastic" element={<ElasticList />} />
          <Route path="/materials/elastic/new" element={<ElasticForm mode="create" />} />
          <Route path="/materials/elastic/:id/edit" element={<ElasticForm mode="edit" />} />

          {/* Label Management (Phase 1B) */}
          <Route path="/materials/label" element={<LabelList />} />
          <Route path="/materials/label/new" element={<LabelForm mode="create" />} />
          <Route path="/materials/label/:id/edit" element={<LabelForm mode="edit" />} />

          {/* Packaging Management (Phase 1B) */}
          <Route path="/materials/packaging" element={<PackagingList />} />
          <Route path="/materials/packaging/new" element={<PackagingForm mode="create" />} />
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
          <Route path="/production/dashboard" element={<ProductionDashboard />} />
          <Route path="/production/work-orders" element={<WorkOrderList />} />
          <Route path="/production/work-orders/new" element={<WorkOrderForm />} />
          <Route path="/production/work-orders/:id/edit" element={<WorkOrderForm />} />

          {/* AI Assistant */}
          <Route path="/ai-assistant" element={<AIAssistant />} />
        </Route>

        {/* 404 - Redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
