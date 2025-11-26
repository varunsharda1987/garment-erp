import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Building2,
  Package,
  UserCircle,
  Shirt,
  ClipboardList,
  ListChecks,
  Calculator,
  Warehouse,
  BarChart3,
  ArrowRightLeft,
  ClipboardCheck,
  Wallet,
  ChevronDown,
  ChevronRight,
  Factory,
  TrendingUp,
  Sparkles,
  Ruler,
  Upload,
  FileSpreadsheet,
  PackagePlus,
  PackageCheck,
  Scissors,
  CircleDot,
  Cable,
  ToggleRight,
  Wind,
  Tag,
  Box,
  Layers
} from 'lucide-react';
import { useState } from 'react';

interface SidebarProps {
  isOpen: boolean;
}

interface NavGroup {
  title: string;
  icon: React.ReactNode;
  items: NavItem[];
}

interface NavItem {
  title: string;
  path: string;
  icon: React.ReactNode;
}

export default function Sidebar({ isOpen }: SidebarProps) {
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['Masters', 'Production', 'Inventory', 'Reports']);

  const toggleGroup = (groupTitle: string) => {
    setExpandedGroups(prev =>
      prev.includes(groupTitle)
        ? prev.filter(t => t !== groupTitle)
        : [...prev, groupTitle]
    );
  };

  const navGroups: NavGroup[] = [
    {
      title: 'Masters',
      icon: <Users className="h-5 w-5" />,
      items: [
        { title: 'Customers', path: '/customers', icon: <Building2 className="h-4 w-4" /> },
        { title: 'Suppliers', path: '/suppliers', icon: <Package className="h-4 w-4" /> },
        { title: 'Finished Fabric', path: '/fabric', icon: <Package className="h-4 w-4" /> },
        { title: 'Materials', path: '/materials', icon: <Package className="h-4 w-4" /> },
        { title: '— Trims & Accessories —', path: '', icon: <Package className="h-3 w-3" /> },
        { title: '  Lace', path: '/materials/lace', icon: <Scissors className="h-4 w-4" /> },
        { title: '  Buttons', path: '/materials/button', icon: <CircleDot className="h-4 w-4" /> },
        { title: '  Threads', path: '/materials/thread', icon: <Cable className="h-4 w-4" /> },
        { title: '  Zippers', path: '/materials/zipper', icon: <ToggleRight className="h-4 w-4" /> },
        { title: '  Elastic', path: '/materials/elastic', icon: <Wind className="h-4 w-4" /> },
        { title: '  Labels', path: '/materials/label', icon: <Tag className="h-4 w-4" /> },
        { title: '  Packaging', path: '/materials/packaging', icon: <Box className="h-4 w-4" /> },
        { title: 'Component Masters', path: '/component-masters', icon: <Layers className="h-4 w-4" /> },
        { title: 'Users', path: '/users', icon: <UserCircle className="h-4 w-4" /> },
      ],
    },
    {
      title: 'Production',
      icon: <Shirt className="h-5 w-5" />,
      items: [
        { title: 'Styles', path: '/styles', icon: <Shirt className="h-4 w-4" /> },
        { title: 'Style Import', path: '/styles/import', icon: <Upload className="h-4 w-4" /> },
        { title: 'CAD Averages', path: '/cad-averages', icon: <Ruler className="h-4 w-4" /> },
        { title: 'Orders', path: '/orders', icon: <ClipboardList className="h-4 w-4" /> },
        { title: 'BOM', path: '/bom', icon: <ListChecks className="h-4 w-4" /> },
        { title: 'Cost Sheets', path: '/cost-sheets', icon: <Calculator className="h-4 w-4" /> },
        { title: 'Production Dashboard', path: '/production/dashboard', icon: <TrendingUp className="h-4 w-4" /> },
        { title: 'Work Orders', path: '/production/work-orders', icon: <Factory className="h-4 w-4" /> },
      ],
    },
    {
      title: 'Inventory',
      icon: <Warehouse className="h-5 w-5" />,
      items: [
        { title: 'Stock Dashboard', path: '/inventory/dashboard', icon: <BarChart3 className="h-4 w-4" /> },
        { title: 'Warehouses', path: '/inventory/warehouses', icon: <Warehouse className="h-4 w-4" /> },
        { title: 'Stock Levels', path: '/inventory/stock-levels', icon: <Package className="h-4 w-4" /> },
        { title: 'Stock Movements', path: '/inventory/movements', icon: <ArrowRightLeft className="h-4 w-4" /> },
        { title: 'Stock Counts', path: '/inventory/stock-counts', icon: <ClipboardCheck className="h-4 w-4" /> },
        { title: '— Greige Stock —', path: '', icon: <Package className="h-3 w-3" /> }, // Separator
        { title: '  Greige Master', path: '/greige', icon: <Package className="h-4 w-4" /> },
        { title: '  Greige Stock Entry', path: '/greige-stock-entry', icon: <PackagePlus className="h-4 w-4" /> },
        { title: '  Greige Stock View', path: '/greige-stock', icon: <PackageCheck className="h-4 w-4" /> },
        { title: '— Finished Fabric Stock —', path: '', icon: <Package className="h-3 w-3" /> }, // Separator
        { title: '  Fabric Stock Entry', path: '/fabric-stock-entry', icon: <PackagePlus className="h-4 w-4" /> },
        { title: '  Fabric Stock View', path: '/fabric-stock', icon: <PackageCheck className="h-4 w-4" /> },
      ],
    },
    {
      title: 'Reports',
      icon: <FileSpreadsheet className="h-5 w-5" />,
      items: [
        { title: 'Style-Fabric Report', path: '/reports/style-fabric', icon: <FileSpreadsheet className="h-4 w-4" /> },
        { title: 'Fabric Usage Report', path: '/reports/fabric-usage', icon: <BarChart3 className="h-4 w-4" /> },
      ],
    },
    {
      title: 'Finance',
      icon: <Wallet className="h-5 w-5" />,
      items: [
        { title: 'Chart of Accounts', path: '/chart-of-accounts', icon: <Wallet className="h-4 w-4" /> },
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

        {/* AI Assistant Link */}
        <NavLink
          to="/ai-assistant"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-md mb-4 transition-colors ${
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

        {/* Navigation Groups */}
        {navGroups.map((group) => (
          <div key={group.title} className="mb-4">
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
                {group.items.map((item, index) => (
                  item.path === '' ? (
                    // Separator/Label
                    <div
                      key={`separator-${index}`}
                      className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide cursor-default"
                    >
                      <span className="flex-1 border-b border-gray-200">{item.title}</span>
                    </div>
                  ) : (
                    // Regular NavLink
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
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
}
