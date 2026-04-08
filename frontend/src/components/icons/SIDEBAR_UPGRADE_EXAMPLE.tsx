/**
 * Sidebar Upgrade Example
 *
 * This example shows how to upgrade the Sidebar component to use:
 * 1. Organized icon library
 * 2. Custom icons for better industry representation
 * 3. Consistent sizing
 *
 * Compare this with the current Sidebar.tsx to see the improvements.
 */

import { NavLink } from 'react-router-dom';
import { useState } from 'react';
import {
  ProductionIcons,
  MaterialIcons,
  InventoryIcons,
  DocumentIcons,
  FinanceIcons,
  NavigationIcons,
  UserIcons,
  ICON_SIZES,
} from '@/lib/icon-library';

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

export default function SidebarUpgraded({ isOpen }: SidebarProps) {
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['Masters', 'Production', 'Inventory', 'Reports']);

  const toggleGroup = (groupTitle: string) => {
    setExpandedGroups((prev) =>
      prev.includes(groupTitle) ? prev.filter((t) => t !== groupTitle) : [...prev, groupTitle]
    );
  };

  // Using organized icon library for clearer, more maintainable code
  const navGroups: NavGroup[] = [
    {
      title: 'Masters',
      icon: <UserIcons.Users className={ICON_SIZES.md} />,
      items: [
        {
          title: 'Customers',
          path: '/customers',
          icon: <UserIcons.Building2 className={ICON_SIZES.sm} />,
        },
        {
          title: 'Suppliers',
          path: '/suppliers',
          icon: <InventoryIcons.Package className={ICON_SIZES.sm} />,
        },
        {
          title: 'Finished Fabric',
          path: '/fabric',
          icon: <MaterialIcons.FabricRoll size={16} />, // Using custom icon!
        },
        {
          title: 'Materials',
          path: '/materials',
          icon: <InventoryIcons.Boxes className={ICON_SIZES.sm} />,
        },
        {
          title: '— Trims & Accessories —',
          path: '',
          icon: <InventoryIcons.Package className={ICON_SIZES.xs} />,
        },
        {
          title: '  Lace',
          path: '/materials/lace',
          icon: <MaterialIcons.Lace className={ICON_SIZES.sm} />,
        },
        {
          title: '  Buttons',
          path: '/materials/button',
          icon: <MaterialIcons.Button className={ICON_SIZES.sm} />,
        },
        {
          title: '  Threads',
          path: '/materials/thread',
          icon: <MaterialIcons.ThreadSpool size={16} />, // Better thread icon!
        },
        {
          title: 'Users',
          path: '/users',
          icon: <UserIcons.UserCircle className={ICON_SIZES.sm} />,
        },
      ],
    },
    {
      title: 'Production',
      icon: <ProductionIcons.Shirt className={ICON_SIZES.md} />,
      items: [
        {
          title: 'Styles',
          path: '/styles',
          icon: <ProductionIcons.Shirt className={ICON_SIZES.sm} />,
        },
        {
          title: 'Style Import',
          path: '/styles/import',
          icon: <DocumentIcons.FilePlus className={ICON_SIZES.sm} />,
        },
        {
          title: 'CAD Averages',
          path: '/cad-averages',
          icon: <ProductionIcons.MeasuringTape size={16} />, // Custom icon!
        },
        {
          title: 'Orders',
          path: '/orders',
          icon: <DocumentIcons.Order className={ICON_SIZES.sm} />,
        },
        {
          title: 'BOM',
          path: '/bom',
          icon: <DocumentIcons.BOM className={ICON_SIZES.sm} />,
        },
        {
          title: 'Cost Sheets',
          path: '/cost-sheets',
          icon: <FinanceIcons.Calculator className={ICON_SIZES.sm} />,
        },
        {
          title: 'Production Dashboard',
          path: '/production/dashboard',
          icon: <ProductionIcons.TrendingUp className={ICON_SIZES.sm} />,
        },
        {
          title: 'Work Orders',
          path: '/production/work-orders',
          icon: <ProductionIcons.Factory className={ICON_SIZES.sm} />,
        },
      ],
    },
    {
      title: 'Inventory',
      icon: <InventoryIcons.Warehouse className={ICON_SIZES.md} />,
      items: [
        {
          title: 'Stock Dashboard',
          path: '/inventory/dashboard',
          icon: <InventoryIcons.BarChart3 className={ICON_SIZES.sm} />,
        },
        {
          title: 'Warehouses',
          path: '/inventory/warehouses',
          icon: <InventoryIcons.Warehouse className={ICON_SIZES.sm} />,
        },
        {
          title: 'Stock Levels',
          path: '/inventory/stock-levels',
          icon: <InventoryIcons.Package className={ICON_SIZES.sm} />,
        },
        {
          title: 'Stock Movements',
          path: '/inventory/movements',
          icon: <InventoryIcons.ArrowRightLeft className={ICON_SIZES.sm} />,
        },
        {
          title: 'Stock Counts',
          path: '/inventory/stock-counts',
          icon: <DocumentIcons.Checklist className={ICON_SIZES.sm} />,
        },
        {
          title: '— Greige Stock —',
          path: '',
          icon: <MaterialIcons.FabricRoll size={12} />,
        },
        {
          title: '  Greige Master',
          path: '/greige',
          icon: <MaterialIcons.FabricRoll size={16} />, // Custom icon!
        },
        {
          title: '  Greige Stock Entry',
          path: '/greige-stock-entry',
          icon: <InventoryIcons.PackagePlus className={ICON_SIZES.sm} />,
        },
        {
          title: '  Greige Stock View',
          path: '/greige-stock',
          icon: <InventoryIcons.PackageCheck className={ICON_SIZES.sm} />,
        },
        {
          title: '— Finished Fabric Stock —',
          path: '',
          icon: <MaterialIcons.FabricRoll size={12} />,
        },
        {
          title: '  Fabric Stock Entry',
          path: '/fabric-stock-entry',
          icon: <InventoryIcons.PackagePlus className={ICON_SIZES.sm} />,
        },
        {
          title: '  Fabric Stock View',
          path: '/fabric-stock',
          icon: <InventoryIcons.PackageCheck className={ICON_SIZES.sm} />,
        },
      ],
    },
    {
      title: 'Reports',
      icon: <DocumentIcons.Spreadsheet className={ICON_SIZES.md} />,
      items: [
        {
          title: 'Style-Fabric Report',
          path: '/reports/style-fabric',
          icon: <DocumentIcons.Spreadsheet className={ICON_SIZES.sm} />,
        },
        {
          title: 'Fabric Usage Report',
          path: '/reports/fabric-usage',
          icon: <InventoryIcons.BarChart3 className={ICON_SIZES.sm} />,
        },
      ],
    },
    {
      title: 'Finance',
      icon: <FinanceIcons.Wallet className={ICON_SIZES.md} />,
      items: [
        {
          title: 'Chart of Accounts',
          path: '/chart-of-accounts',
          icon: <FinanceIcons.Wallet className={ICON_SIZES.sm} />,
        },
      ],
    },
  ];

  if (!isOpen) return null;

  return (
    <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-card border-r shadow-sm overflow-y-auto">
      <nav className="p-4">
        {/* Dashboard Link */}
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-md mb-2 transition-colors ${
              isActive ? 'bg-primary/5 text-primary font-medium' : 'text-foreground hover:bg-muted'
            }`
          }
        >
          <NavigationIcons.Home className={ICON_SIZES.md} />
          <span>Main Dashboard</span>
        </NavLink>

        {/* AI Assistant Link */}
        <NavLink
          to="/ai-assistant"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-md mb-4 transition-colors ${
              isActive
                ? 'bg-gradient-to-r from-info-muted to-accent/5 text-info font-medium border border-info/20'
                : 'text-foreground hover:bg-gradient-to-r hover:from-info-muted hover:to-accent/5 hover:border hover:border-info/15'
            }`
          }
        >
          <ProductionIcons.Sparkles className={ICON_SIZES.md} />
          <span>AI Assistant</span>
          <span className="ml-auto text-xs bg-info-muted text-info px-2 py-1 rounded-full">NEW</span>
        </NavLink>

        {/* Navigation Groups */}
        {navGroups.map((group) => (
          <div key={group.title} className="mb-4">
            {/* Group Header */}
            <button
              onClick={() => toggleGroup(group.title)}
              className="flex items-center justify-between w-full px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted rounded-md transition-colors"
            >
              <div className="flex items-center gap-2">
                {group.icon}
                <span>{group.title}</span>
              </div>
              {expandedGroups.includes(group.title) ? (
                <NavigationIcons.Down className={ICON_SIZES.sm} />
              ) : (
                <NavigationIcons.Right className={ICON_SIZES.sm} />
              )}
            </button>

            {/* Group Items */}
            {expandedGroups.includes(group.title) && (
              <div className="mt-1 ml-2 space-y-1">
                {group.items.map((item, index) =>
                  item.path === '' ? (
                    // Separator/Label
                    <div
                      key={`separator-${index}`}
                      className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-default"
                    >
                      <span className="flex-1 border-b border-border">{item.title}</span>
                    </div>
                  ) : (
                    // Regular NavLink
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                          isActive ? 'bg-primary/5 text-primary font-medium' : 'text-muted-foreground hover:bg-muted'
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
      </nav>
    </aside>
  );
}

/**
 * Key Improvements in this upgrade:
 *
 * 1. ORGANIZED IMPORTS
 *    - Instead of 29 separate icon imports, we use organized groups
 *    - Easier to find the right icon
 *    - Better code maintainability
 *
 * 2. CUSTOM ICONS
 *    - FabricRoll for fabric inventory (better than Package)
 *    - MeasuringTape for CAD (better than Ruler)
 *    - ThreadSpool for threads (better than Cable)
 *
 * 3. CONSISTENT SIZING
 *    - Uses ICON_SIZES constants
 *    - Ensures consistency across the app
 *    - Easy to change globally
 *
 * 4. SEMANTIC NAMING
 *    - ProductionIcons.Factory is clearer than just Factory
 *    - Shows purpose at a glance
 *    - Better IDE autocomplete
 *
 * 5. INDUSTRY-SPECIFIC
 *    - Icons that better represent garment manufacturing
 *    - More professional and relevant
 *    - Custom icons fill gaps in standard libraries
 */
