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
import ProtectedRoute from './components/ProtectedRoute';

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

        {/* Protected routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute>
              <Users />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users/new"
          element={
            <ProtectedRoute>
              <UserForm mode="create" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users/edit/:id"
          element={
            <ProtectedRoute>
              <UserForm mode="edit" />
            </ProtectedRoute>
          }
        />

        {/* Style Master routes */}
        <Route
          path="/styles"
          element={
            <ProtectedRoute>
              <StyleList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/styles/new"
          element={
            <ProtectedRoute>
              <StyleForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="/styles/:id/edit"
          element={
            <ProtectedRoute>
              <StyleForm mode="edit" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/styles/:id"
          element={
            <ProtectedRoute>
              <StyleDetail />
            </ProtectedRoute>
          }
        />

        {/* Customer Management routes */}
        <Route
          path="/customers"
          element={
            <ProtectedRoute>
              <CustomerList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/customers/new"
          element={
            <ProtectedRoute>
              <CustomerForm mode="create" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/customers/:id/edit"
          element={
            <ProtectedRoute>
              <CustomerForm mode="edit" />
            </ProtectedRoute>
          }
        />

        {/* Supplier Management routes */}
        <Route
          path="/suppliers"
          element={
            <ProtectedRoute>
              <SupplierList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/suppliers/new"
          element={
            <ProtectedRoute>
              <SupplierForm mode="create" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/suppliers/:id/edit"
          element={
            <ProtectedRoute>
              <SupplierForm mode="edit" />
            </ProtectedRoute>
          }
        />

        {/* Material Management routes */}
        <Route
          path="/materials"
          element={
            <ProtectedRoute>
              <MaterialList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/materials/new"
          element={
            <ProtectedRoute>
              <MaterialForm mode="create" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/materials/:id/edit"
          element={
            <ProtectedRoute>
              <MaterialForm mode="edit" />
            </ProtectedRoute>
          }
        />

        {/* Order Management routes */}
        <Route
          path="/orders"
          element={
            <ProtectedRoute>
              <OrderList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders/new"
          element={
            <ProtectedRoute>
              <OrderForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders/:id/edit"
          element={
            <ProtectedRoute>
              <OrderForm />
            </ProtectedRoute>
          }
        />

        {/* 404 - Redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
