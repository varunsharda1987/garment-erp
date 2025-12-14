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
  TrendingUp,
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
} from 'lucide-react';
import { useState } from 'react';

interface SidebarProps {
  isOpen: boolean;
}

type NavItemOrDivider = NavItem | 'divider';

interface NavGroup {
  title: string;
  icon: React.ReactNode;
  items: NavItemOrDivider[];
}

interface NavItem {
  title: string;
  path: string;
  icon: React.ReactNode;
}

export default function Sidebar({ isOpen }: SidebarProps) {
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['Orders & Planning', 'Manufacturing']);

  const toggleGroup = (groupTitle: string) => {
    setExpandedGroups(prev =>
      prev.includes(groupTitle)
        ? prev.filter(t => t !== groupTitle)
        : [...prev, groupTitle]
    );
  };

  const navGroups: NavGroup[] = [
    // Orders & Planning (CAD Planning and Cost Sheets moved to top level)
    {
      title: 'Orders & Planning',
      icon: <ClipboardList className="h-5 w-5" />,
      items: [
        { title: 'Orders', path: '/orders', icon: <ClipboardList className="h-4 w-4" /> },
        { title: 'Production Runs', path: '/production/work-orders', icon: <Factory className="h-4 w-4" /> },
        { title: 'BOM', path: '/bom', icon: <ListChecks className="h-4 w-4" /> },
        'divider',
        { title: 'MRP Dashboard', path: '/mrp', icon: <CalendarClock className="h-4 w-4" /> },
      ],
    },
    // Manufacturing - Production floor operations (in workflow order)
    {
      title: 'Manufacturing',
      icon: <Cog className="h-5 w-5" />,
      items: [
        { title: 'Sample Tracking', path: '/samples', icon: <TestTube className="h-4 w-4" /> },
        'divider',
        { title: 'Printing', path: '/manufacturing/printing', icon: <Beaker className="h-4 w-4" /> },
        { title: 'Dyeing', path: '/manufacturing/dyeing', icon: <Droplets className="h-4 w-4" /> },
        { title: 'Cutting', path: '/manufacturing/cutting', icon: <Scissors className="h-4 w-4" /> },
        { title: 'Stitching', path: '/manufacturing/stitching', icon: <Factory className="h-4 w-4" /> },
        { title: 'Finishing', path: '/manufacturing/finishing', icon: <CheckSquare className="h-4 w-4" /> },
        { title: 'Dispatch', path: '/manufacturing/dispatch', icon: <Send className="h-4 w-4" /> },
        'divider',
        { title: 'Job Work Dashboard', path: '/processing/job-work', icon: <Shuffle className="h-4 w-4" /> },
        { title: 'Processing Batches', path: '/processing/batches', icon: <ClipboardList className="h-4 w-4" /> },
      ],
    },
    // Inventory - Stock management
    {
      title: 'Inventory',
      icon: <Warehouse className="h-5 w-5" />,
      items: [
        { title: 'Inventory Dashboard', path: '/inventory/dashboard', icon: <BarChart3 className="h-4 w-4" /> },
        { title: 'Stock Levels', path: '/inventory/stock-levels', icon: <Package className="h-4 w-4" /> },
        { title: 'Stock Counts', path: '/inventory/stock-counts', icon: <ClipboardCheck className="h-4 w-4" /> },
        'divider',
        { title: 'Greige Stock', path: '/greige-stock', icon: <Package className="h-4 w-4" /> },
        { title: 'Fabric Stock', path: '/fabric-stock', icon: <Package className="h-4 w-4" /> },
        { title: 'Embroidery Stock', path: '/embroidery-stock', icon: <Sparkles className="h-4 w-4" /> },
        'divider',
        { title: 'Stock In', path: '/inventory/movements/stock-in', icon: <PackagePlus className="h-4 w-4" /> },
        { title: 'Stock Out', path: '/inventory/movements/stock-out', icon: <PackageX className="h-4 w-4" /> },
        { title: 'Stock Transfer', path: '/inventory/movements/transfer', icon: <Truck className="h-4 w-4" /> },
        { title: 'Stock Adjustment', path: '/inventory/movements/adjustment', icon: <Scale className="h-4 w-4" /> },
      ],
    },
    // Procurement
    {
      title: 'Procurement',
      icon: <ShoppingCart className="h-5 w-5" />,
      items: [
        { title: 'Purchase Orders', path: '/procurement/purchase-orders', icon: <ShoppingCart className="h-4 w-4" /> },
        { title: 'GRN (Goods Receipt)', path: '/procurement/grn', icon: <PackageOpen className="h-4 w-4" /> },
        { title: 'Material Requirements', path: '/mrp/requirements', icon: <FileBarChart className="h-4 w-4" /> },
        { title: 'Suppliers', path: '/suppliers', icon: <Building2 className="h-4 w-4" /> },
      ],
    },
    // Master Data
    {
      title: 'Masters',
      icon: <Layers className="h-5 w-5" />,
      items: [
        { title: 'Customers', path: '/customers', icon: <Building2 className="h-4 w-4" /> },
        { title: 'Colors', path: '/colors', icon: <Palette className="h-4 w-4" /> },
        { title: 'Greige Master', path: '/greige', icon: <Package className="h-4 w-4" /> },
        { title: 'Fabric Master', path: '/fabric', icon: <Package className="h-4 w-4" /> },
        { title: 'Embroidery Master', path: '/embroidery', icon: <Sparkles className="h-4 w-4" /> },
        { title: 'Trims', path: '/trim-masters', icon: <Scissors className="h-4 w-4" /> },
        { title: 'Packaging', path: '/materials/packaging', icon: <Box className="h-4 w-4" /> },
        { title: 'Component Masters', path: '/component-masters', icon: <Layers className="h-4 w-4" /> },
        { title: 'Warehouses', path: '/inventory/warehouses', icon: <Warehouse className="h-4 w-4" /> },
      ],
    },
    // Reports & Finance
    {
      title: 'Reports & Finance',
      icon: <FileSpreadsheet className="h-5 w-5" />,
      items: [
        { title: 'Style-Fabric Report', path: '/reports/style-fabric', icon: <FileSpreadsheet className="h-4 w-4" /> },
        { title: 'Fabric Usage Report', path: '/reports/fabric-usage', icon: <BarChart3 className="h-4 w-4" /> },
        'divider',
        { title: 'Chart of Accounts', path: '/chart-of-accounts', icon: <Wallet className="h-4 w-4" /> },
      ],
    },
    // Settings
    {
      title: 'Settings',
      icon: <UserCircle className="h-5 w-5" />,
      items: [
        { title: 'Users', path: '/users', icon: <UserCircle className="h-4 w-4" /> },
      ],
    },
  ];

  if (!isOpen) return null;

  return (
    <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-white border-r shadow-sm overflow-y-auto">
      <nav className="p-4">
        {/* Dashboard Link */}
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-md mb-2 transition-colors ${
              isActive
                ? 'bg-indigo-50 text-indigo-700 font-medium'
                : 'text-gray-700 hover:bg-gray-100'
            }`
          }
        >
          <LayoutDashboard className="h-5 w-5" />
          <span>Main Dashboard</span>
        </NavLink>

        {/* Production Status Link - Top Level (Executive Overview) */}
        <NavLink
          to="/production/status"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-md mb-2 transition-colors ${
              isActive
                ? 'bg-indigo-50 text-indigo-700 font-medium'
                : 'text-gray-700 hover:bg-gray-100'
            }`
          }
        >
          <Activity className="h-5 w-5" />
          <span>Production Status</span>
        </NavLink>

        {/* Styles Link - Top Level (Frequently Used) */}
        <NavLink
          to="/styles"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-md mb-2 transition-colors ${
              isActive
                ? 'bg-indigo-50 text-indigo-700 font-medium'
                : 'text-gray-700 hover:bg-gray-100'
            }`
          }
        >
          <Shirt className="h-5 w-5" />
          <span>Styles</span>
        </NavLink>

        {/* CAD Planning - Top Level (Style-related) */}
        <NavLink
          to="/styles?cadStatus=PENDING"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-md mb-2 transition-colors ${
              isActive
                ? 'bg-indigo-50 text-indigo-700 font-medium'
                : 'text-gray-700 hover:bg-gray-100'
            }`
          }
        >
          <Ruler className="h-5 w-5" />
          <span>CAD Planning</span>
        </NavLink>

        {/* Cost Sheets - Top Level (Style-related) */}
        <NavLink
          to="/cost-sheets"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-md mb-2 transition-colors ${
              isActive
                ? 'bg-indigo-50 text-indigo-700 font-medium'
                : 'text-gray-700 hover:bg-gray-100'
            }`
          }
        >
          <Calculator className="h-5 w-5" />
          <span>Cost Sheets</span>
        </NavLink>

        {/* Testing Module - Top Level (Quality Control) */}
        <NavLink
          to="/testing"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-md mb-4 transition-colors ${
              isActive
                ? 'bg-indigo-50 text-indigo-700 font-medium'
                : 'text-gray-700 hover:bg-gray-100'
            }`
          }
        >
          <FlaskConical className="h-5 w-5" />
          <span>Testing (FPT/GPT)</span>
        </NavLink>

        {/* Navigation Groups */}
        {navGroups.map((group) => (
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
      </nav>
    </aside>
  );
}
