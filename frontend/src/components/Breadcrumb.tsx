import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export default function Breadcrumb() {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  // Map paths to readable names
  const pathNameMap: Record<string, string> = {
    dashboard: 'Dashboard',
    customers: 'Customers',
    suppliers: 'Suppliers',
    materials: 'Materials',
    users: 'Users',
    styles: 'Styles',
    orders: 'Orders',
    bom: 'Bill of Materials',
    'cost-sheets': 'Cost Sheets',
    inventory: 'Inventory',
    warehouses: 'Warehouses',
    'stock-levels': 'Stock Levels',
    movements: 'Stock Movements',
    'stock-counts': 'Stock Counts',
    'chart-of-accounts': 'Chart of Accounts',
    new: 'New',
    edit: 'Edit',
  };

  // Don't show breadcrumb on dashboard
  if (location.pathname === '/dashboard' || location.pathname === '/') {
    return null;
  }

  return (
    <nav className="flex items-center space-x-1 text-sm text-gray-600">
      {/* Home */}
      <Link to="/dashboard" className="flex items-center hover:text-indigo-600 transition-colors">
        <Home className="h-4 w-4" />
      </Link>

      {/* Path segments */}
      {pathnames.map((value, index) => {
        const to = `/${pathnames.slice(0, index + 1).join('/')}`;
        const isLast = index === pathnames.length - 1;
        const label = pathNameMap[value] || value.charAt(0).toUpperCase() + value.slice(1);

        return (
          <div key={to} className="flex items-center">
            <ChevronRight className="h-4 w-4 mx-1" />
            {isLast ? (
              <span className="font-medium text-gray-900">{label}</span>
            ) : (
              <Link to={to} className="hover:text-indigo-600 transition-colors">
                {label}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
