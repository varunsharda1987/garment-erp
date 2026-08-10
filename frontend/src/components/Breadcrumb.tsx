import { useMemo } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { getAllFlatNavItems } from '@/config/navigation';

// Fallback labels for path segments that don't resolve to a nav registry entry
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
  manufacturing: 'Manufacturing',
  procurement: 'Procurement',
  settings: 'Settings',
  finance: 'Finance',
  'tax-gst': 'Tax & GST',
  tally: 'Tally',
  masters: 'Masters',
  new: 'New',
  edit: 'Edit',
};

function segmentLabel(segment: string): string {
  if (pathNameMap[segment]) return pathNameMap[segment];
  // "size-categories" → "Size Categories"
  return segment
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function Breadcrumb() {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  // Exact-path labels from the nav registry (includes search-only pages), so
  // breadcrumbs track the sidebar/palette titles without a second hand-kept map.
  const registryLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of getAllFlatNavItems()) {
      map.set(item.path, item.title);
    }
    return map;
  }, []);

  // Don't show breadcrumb on dashboard
  if (location.pathname === '/dashboard' || location.pathname === '/') {
    return null;
  }

  return (
    <nav className="flex items-center space-x-1 text-sm text-muted-foreground">
      {/* Home */}
      <Link to="/dashboard" className="flex items-center hover:text-primary transition-colors">
        <Home className="h-4 w-4" />
      </Link>

      {/* Path segments */}
      {pathnames.map((value, index) => {
        const to = `/${pathnames.slice(0, index + 1).join('/')}`;
        const isLast = index === pathnames.length - 1;
        const label = registryLabels.get(to) || segmentLabel(value);
        // Only link intermediate crumbs to paths that exist in the nav
        // registry — bare prefixes like /finance or /masters have no route
        // and would land on the 404 page.
        const isLinkable = !isLast && registryLabels.has(to);

        return (
          <div key={to} className="flex items-center">
            <ChevronRight className="h-4 w-4 mx-1" />
            {isLast ? (
              <span className="font-medium text-foreground">{label}</span>
            ) : isLinkable ? (
              <Link to={to} className="hover:text-primary transition-colors">
                {label}
              </Link>
            ) : (
              <span>{label}</span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
