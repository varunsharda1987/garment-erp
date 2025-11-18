import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth.store';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import UserForm from './pages/UserForm';
import StyleList from './pages/StyleList';
import StyleForm from './pages/StyleForm';
import StyleDetail from './pages/StyleDetail';
import CustomerList from './pages/CustomerList';
import CustomerForm from './pages/CustomerForm';
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

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <BrowserRouter>
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

          {/* Customer Management */}
          <Route path="/customers" element={<CustomerList />} />
          <Route path="/customers/new" element={<CustomerForm mode="create" />} />
          <Route path="/customers/:id/edit" element={<CustomerForm mode="edit" />} />

          {/* Supplier Management */}
          <Route path="/suppliers" element={<SupplierList />} />
          <Route path="/suppliers/new" element={<SupplierForm mode="create" />} />
          <Route path="/suppliers/:id/edit" element={<SupplierForm mode="edit" />} />

          {/* Material Management */}
          <Route path="/materials" element={<MaterialList />} />
          <Route path="/materials/new" element={<MaterialForm mode="create" />} />
          <Route path="/materials/:id/edit" element={<MaterialForm mode="edit" />} />

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
        </Route>

        {/* 404 - Redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
