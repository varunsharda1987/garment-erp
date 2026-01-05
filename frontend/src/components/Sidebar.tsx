import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Package,
  UserCircle,
  Shirt,
  ClipboardList,
  ListChecks,
  Calculator,
  Warehouse,
  BarChart3,
  ClipboardCheck,
  Wallet,
  ChevronDown,
  ChevronRight,
  Factory,
  Sparkles,
  Ruler,
  FileSpreadsheet,
  Scissors,
  Box,
  Layers,
  ShoppingCart,
  PackageOpen,
  CalendarClock,
  FileBarChart,
  Shuffle,
  PackageX,
  ShieldAlert,
  Truck,
  Palette,
  Cog,
  Beaker,
  Droplets,
  CheckSquare,
  Send,
  TestTube,
  PackagePlus,
  Scale,
  Activity,
  FlaskConical,
  FolderTree,
  Tag,
  BookOpen,
  Settings,
  PackageSearch,
  Lock,
  Puzzle,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import type { PermissionKey } from '@/config/permissions.config';

interface SidebarProps {
  isOpen: boolean;
}

interface NavItem {
  title: string;
  path: string;
  icon: React.ReactNode;
  permission?: PermissionKey;
}

type NavItemOrDivider = NavItem | 'divider';

interface NavGroup {
  title: string;
  icon: React.ReactNode;
  permission?: PermissionKey; // Group-level permission
  items: NavItemOrDivider[];
}

interface TopLevelItem {
  title: string;
  path: string;
  icon: React.ReactNode;
  permission?: PermissionKey;
  badge?: string;
  className?: string;
}

export default function Sidebar({ isOpen }: SidebarProps) {
  const { can } = usePermissions();
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['Orders & Planning', 'Manufacturing']);

  const toggleGroup = (groupTitle: string) => {
    setExpandedGroups(prev =>
      prev.includes(groupTitle)
        ? prev.filter(t => t !== groupTitle)
        : [...prev, groupTitle]
    );
  };

  // Top-level navigation items (before groups)
  const topLevelItems: TopLevelItem[] = [
    { title: 'Main Dashboard', path: '/dashboard', icon: <LayoutDashboard className="h-5 w-5" />, permission: 'dashboard' },
    { title: 'Process Guide', path: '/process-guide', icon: <BookOpen className="h-5 w-5" />, permission: 'processGuide' },
    { title: 'Production Status', path: '/production/status', icon: <Activity className="h-5 w-5" />, permission: 'productionStatus' },
    { title: 'Styles', path: '/styles', icon: <Shirt className="h-5 w-5" />, permission: 'styles' },
    { title: 'CAD Planning', path: '/cad-planning', icon: <Ruler className="h-5 w-5" />, permission: 'cadPlanning' },
    { title: 'Cost Sheets', path: '/cost-sheets', icon: <Calculator className="h-5 w-5" />, permission: 'costSheets' },
    { title: 'Fabric Costing', path: '/fabric-costing', icon: <Calculator className="h-5 w-5" />, permission: 'costSheets', badge: 'TEST' },
    { title: 'Testing (FPT/GPT)', path: '/testing', icon: <FlaskConical className="h-5 w-5" />, permission: 'testing' },
  ];

  const navGroups: NavGroup[] = [
    // Orders & Planning
    {
      title: 'Orders & Planning',
      icon: <ClipboardList className="h-5 w-5" />,
      items: [
        { title: 'Orders', path: '/orders', icon: <ClipboardList className="h-4 w-4" />, permission: 'orders' },
        { title: 'Production Runs', path: '/production/work-orders', icon: <Factory className="h-4 w-4" />, permission: 'workOrders' },
        { title: 'BOM', path: '/bom', icon: <ListChecks className="h-4 w-4" />, permission: 'bom' },
        'divider',
        { title: 'MRP Dashboard', path: '/mrp', icon: <CalendarClock className="h-4 w-4" />, permission: 'mrp' },
      ],
    },
    // Manufacturing
    {
      title: 'Manufacturing',
      icon: <Cog className="h-5 w-5" />,
      permission: 'manufacturing',
      items: [
        { title: 'Sample Tracking', path: '/samples', icon: <TestTube className="h-4 w-4" />, permission: 'samples' },
        'divider',
        { title: 'Printing', path: '/manufacturing/printing', icon: <Beaker className="h-4 w-4" />, permission: 'printing' },
        { title: 'Dyeing', path: '/manufacturing/dyeing', icon: <Droplets className="h-4 w-4" />, permission: 'dyeing' },
        { title: 'Cutting', path: '/manufacturing/cutting', icon: <Scissors className="h-4 w-4" />, permission: 'cutting' },
        { title: 'Stitching', path: '/manufacturing/stitching', icon: <Factory className="h-4 w-4" />, permission: 'stitching' },
        { title: 'Finishing', path: '/manufacturing/finishing', icon: <CheckSquare className="h-4 w-4" />, permission: 'finishing' },
        { title: 'Dispatch', path: '/manufacturing/dispatch', icon: <Send className="h-4 w-4" />, permission: 'dispatch' },
        'divider',
        { title: 'Job Work Dashboard', path: '/processing/job-work', icon: <Shuffle className="h-4 w-4" />, permission: 'jobWork' },
        { title: 'Processing Batches', path: '/processing/batches', icon: <ClipboardList className="h-4 w-4" />, permission: 'processingBatches' },
      ],
    },
    // Inventory
    {
      title: 'Inventory',
      icon: <Warehouse className="h-5 w-5" />,
      items: [
        { title: 'Inventory Dashboard', path: '/inventory/dashboard', icon: <BarChart3 className="h-4 w-4" />, permission: 'inventoryDashboard' },
        { title: 'Stock Levels', path: '/inventory/stock-levels', icon: <Package className="h-4 w-4" />, permission: 'stockLevels' },
        { title: 'Stock Counts', path: '/inventory/stock-counts', icon: <ClipboardCheck className="h-4 w-4" />, permission: 'stockCounts' },
        'divider',
        { title: 'Greige Stock', path: '/greige-stock', icon: <Package className="h-4 w-4" />, permission: 'greigeFabricStock' },
        { title: 'Fabric Stock', path: '/fabric-stock', icon: <Package className="h-4 w-4" />, permission: 'greigeFabricStock' },
        { title: 'Embroidery Stock', path: '/embroidery-stock', icon: <Sparkles className="h-4 w-4" />, permission: 'embroideryStock' },
        'divider',
        { title: 'Stock In', path: '/inventory/movements/stock-in', icon: <PackagePlus className="h-4 w-4" />, permission: 'stockMovements' },
        { title: 'Stock Out', path: '/inventory/movements/stock-out', icon: <PackageX className="h-4 w-4" />, permission: 'stockMovements' },
        { title: 'Stock Transfer', path: '/inventory/movements/transfer', icon: <Truck className="h-4 w-4" />, permission: 'stockMovements' },
        { title: 'Stock Adjustment', path: '/inventory/movements/adjustment', icon: <Scale className="h-4 w-4" />, permission: 'stockMovements' },
      ],
    },
    // Procurement
    {
      title: 'Procurement',
      icon: <ShoppingCart className="h-5 w-5" />,
      items: [
        { title: 'Purchase Orders', path: '/procurement/purchase-orders', icon: <ShoppingCart className="h-4 w-4" />, permission: 'purchaseOrders' },
        { title: 'GRN (Goods Receipt)', path: '/procurement/grn', icon: <PackageOpen className="h-4 w-4" />, permission: 'grn' },
        { title: 'Material Requirements', path: '/mrp/requirements', icon: <FileBarChart className="h-4 w-4" />, permission: 'materialRequirements' },
      ],
    },
    // Master Data
    {
      title: 'Masters',
      icon: <Layers className="h-5 w-5" />,
      items: [
        { title: 'All Masters', path: '/master-data', icon: <Package className="h-4 w-4" />, permission: 'masterData' },
        'divider',
        { title: 'Customers', path: '/customers', icon: <Building2 className="h-4 w-4" />, permission: 'customers' },
        { title: 'Suppliers', path: '/suppliers', icon: <Building2 className="h-4 w-4" />, permission: 'suppliers' },
        { title: 'Processor Rate Cards', path: '/processor-rate-cards', icon: <FileSpreadsheet className="h-4 w-4" />, permission: 'suppliers' },
        'divider',
        { title: 'Greige Master', path: '/greige', icon: <Package className="h-4 w-4" />, permission: 'fabricMasters' },
        { title: 'Fabric Master', path: '/fabric', icon: <Package className="h-4 w-4" />, permission: 'fabricMasters' },
        { title: 'Embroidery Master', path: '/embroidery', icon: <Sparkles className="h-4 w-4" />, permission: 'trimMasters' },
        { title: 'Trims', path: '/trim-masters', icon: <Scissors className="h-4 w-4" />, permission: 'trimMasters' },
        { title: 'Labels', path: '/materials/label', icon: <Tag className="h-4 w-4" />, permission: 'trimMasters' },
        { title: 'Packaging', path: '/materials/packaging', icon: <Box className="h-4 w-4" />, permission: 'trimMasters' },
        { title: 'Machine Parts', path: '/materials/machine-part', icon: <Settings className="h-4 w-4" />, permission: 'trimMasters' },
        { title: 'Other Materials', path: '/materials/other', icon: <PackageSearch className="h-4 w-4" />, permission: 'trimMasters' },
        'divider',
        { title: 'Colors', path: '/colors', icon: <Palette className="h-4 w-4" />, permission: 'colorMaster' },
        { title: 'Size Categories', path: '/masters/size-categories', icon: <Ruler className="h-4 w-4" />, permission: 'sizeCategoryMaster' },
        { title: 'Component Groups', path: '/component-groups', icon: <Layers className="h-4 w-4" />, permission: 'componentMasters' },
        { title: 'Component Masters', path: '/component-masters', icon: <Layers className="h-4 w-4" />, permission: 'componentMasters' },
        { title: 'Pattern Parts', path: '/pattern-parts', icon: <Puzzle className="h-4 w-4" />, permission: 'componentMasters' },
        { title: 'Product Categories', path: '/product-categories', icon: <FolderTree className="h-4 w-4" />, permission: 'productCategories' },
        'divider',
        { title: 'Warehouses', path: '/inventory/warehouses', icon: <Warehouse className="h-4 w-4" />, permission: 'warehouses' },
      ],
    },
    // Reports & Finance
    {
      title: 'Reports & Finance',
      icon: <FileSpreadsheet className="h-5 w-5" />,
      items: [
        { title: 'Style-Fabric Report', path: '/reports/style-fabric', icon: <FileSpreadsheet className="h-4 w-4" />, permission: 'reports' },
        { title: 'Fabric Usage Report', path: '/reports/fabric-usage', icon: <BarChart3 className="h-4 w-4" />, permission: 'reports' },
        'divider',
        { title: 'Chart of Accounts', path: '/chart-of-accounts', icon: <Wallet className="h-4 w-4" />, permission: 'chartOfAccounts' },
      ],
    },
    // Admin
    {
      title: 'Admin',
      icon: <ShieldAlert className="h-5 w-5" />,
      permission: 'admin',
      items: [
        { title: 'Override History', path: '/admin/override-history', icon: <ShieldAlert className="h-4 w-4" />, permission: 'overrideHistory' },
        { title: 'Permissions', path: '/admin/permissions', icon: <Lock className="h-4 w-4" />, permission: 'permissions' },
      ],
    },
    // Settings
    {
      title: 'Settings',
      icon: <UserCircle className="h-5 w-5" />,
      items: [
        { title: 'Users', path: '/users', icon: <UserCircle className="h-4 w-4" />, permission: 'users' },
      ],
    },
  ];

  // Filter top-level items by permission
  const filteredTopLevelItems = useMemo(() => {
    return topLevelItems.filter(item => !item.permission || can(item.permission));
  }, [can]);

  // Filter groups and their items by permission
  const filteredNavGroups = useMemo(() => {
    return navGroups
      // First filter out groups that have a group-level permission the user doesn't have
      .filter(group => !group.permission || can(group.permission))
      // Then filter items within each group
      .map(group => ({
        ...group,
        items: group.items.filter(item => {
          if (item === 'divider') return true;
          return !item.permission || can(item.permission);
        }),
      }))
      // Remove groups with no visible items (excluding dividers)
      .filter(group => group.items.some(item => item !== 'divider'))
      // Clean up orphan dividers
      .map(group => ({
        ...group,
        items: cleanDividers(group.items),
      }));
  }, [can]);

  if (!isOpen) return null;

  return (
    <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-white border-r shadow-sm overflow-y-auto">
      <nav className="p-4">
        {/* Top Level Navigation Items */}
        {filteredTopLevelItems.map((item, index) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md ${index === filteredTopLevelItems.length - 1 ? 'mb-4' : 'mb-2'} transition-colors ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-100'
              }`
            }
          >
            {item.icon}
            <span>{item.title}</span>
            {item.badge && (
              <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}

        {/* Navigation Groups */}
        {filteredNavGroups.map((group) => (
          <div key={group.title} className="mb-3">
            {/* Group Header */}
            <button
              onClick={() => toggleGroup(group.title)}
              className="flex items-center justify-between w-full px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 rounded-md transition-colors"
            >
              <div className="flex items-center gap-2">
                {group.icon}
                <span>{group.title}</span>
              </div>
              {expandedGroups.includes(group.title) ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>

            {/* Group Items */}
            {expandedGroups.includes(group.title) && (
              <div className="mt-1 ml-2 space-y-1">
                {group.items.map((item, index) =>
                  item === 'divider' ? (
                    <div key={`divider-${index}`} className="my-2 border-t border-gray-200 mx-3" />
                  ) : (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                          isActive
                            ? 'bg-indigo-50 text-indigo-700 font-medium'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`
                      }
                    >
                      {item.icon}
                      <span>{item.title}</span>
                    </NavLink>
                  )
                )}
              </div>
            )}
          </div>
        ))}

        {/* AI Assistant Link - Bottom */}
        {can('aiAssistant') && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <NavLink
              to="/ai-assistant"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-50 to-purple-50 text-blue-700 font-medium border border-blue-200'
                    : 'text-gray-700 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 hover:border hover:border-blue-100'
                }`
              }
            >
              <Sparkles className="h-5 w-5" />
              <span>AI Assistant</span>
              <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">NEW</span>
            </NavLink>
          </div>
        )}
      </nav>
    </aside>
  );
}

/**
 * Remove orphan dividers (dividers at start, end, or consecutive)
 */
function cleanDividers(items: NavItemOrDivider[]): NavItemOrDivider[] {
  return items.filter((item, index, arr) => {
    if (item !== 'divider') return true;
    // Remove if first or last
    if (index === 0 || index === arr.length - 1) return false;
    // Remove if previous is also divider
    if (arr[index - 1] === 'divider') return false;
    return true;
  });
}
