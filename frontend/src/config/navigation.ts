/**
 * Shared navigation configuration used by Sidebar and CommandPalette.
 * All navigation items, groups, and their permissions are defined here.
 */
import type { PermissionKey } from '@/config/permissions.config';

export interface NavItem {
  title: string;
  path: string;
  iconName: string; // lucide icon name for lazy resolution
  permission?: PermissionKey;
  badge?: string;
  keywords?: string[]; // extra search terms for command palette
}

export interface SubHeader {
  type: 'sub-header';
  title: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export type NavItemOrDivider = NavItem | 'divider' | SubHeader;

export interface NavGroup {
  title: string;
  iconName: string;
  permission?: PermissionKey;
  items: NavItemOrDivider[];
}

export interface TopLevelItem {
  title: string;
  path: string;
  iconName: string;
  permission?: PermissionKey;
  badge?: string;
}

// Flat item for command palette search
export interface FlatNavItem {
  title: string;
  path: string;
  group: string;
  iconName: string;
  permission?: PermissionKey;
  keywords?: string[];
}

// ─── Top-Level Items (always visible) ───────────────────────────────────────

export const TOP_LEVEL_ITEMS: TopLevelItem[] = [
  { title: 'Main Dashboard', path: '/dashboard', iconName: 'LayoutDashboard', permission: 'dashboard' },
  { title: 'Production Status', path: '/production/status', iconName: 'Activity', permission: 'productionStatus' },
  { title: 'Styles', path: '/styles', iconName: 'Shirt', permission: 'styles' },
];

// ─── Navigation Groups ──────────────────────────────────────────────────────

export const NAV_GROUPS: NavGroup[] = [
  // 1. Pre-Production (new group below Styles)
  {
    title: 'Pre-Production',
    iconName: 'Ruler',
    items: [
      { title: 'CAD Planning', path: '/cad-planning', iconName: 'Ruler', permission: 'cadPlanning' },
      {
        title: 'Fabric Costing',
        path: '/fabric-costing',
        iconName: 'Calculator',
        permission: 'costSheets',
        badge: 'TEST',
      },
      { title: 'Costing Options', path: '/fabric-costing/options', iconName: 'ListChecks', permission: 'costSheets' },
      { title: 'Cost Sheets', path: '/cost-sheets', iconName: 'Calculator', permission: 'costSheets' },
    ],
  },
  // 2. Orders & Planning (Orders moved from top-level)
  {
    title: 'Orders & Planning',
    iconName: 'ClipboardList',
    items: [
      { title: 'Orders', path: '/orders', iconName: 'ClipboardList', permission: 'orders' },
      {
        title: 'Stock Production',
        path: '/stock-production-orders',
        iconName: 'Warehouse',
        permission: 'orders',
        keywords: ['spo', 'make to stock', 'mts', 'stock production'],
      },
      { title: 'Order BOM', path: '/order-bom', iconName: 'ListChecks', permission: 'orders' },
    ],
  },
  // 3. Procurement (moved above Manufacturing)
  {
    title: 'Procurement',
    iconName: 'ShoppingCart',
    items: [
      {
        title: 'Requirements',
        path: '/procurement/requirements',
        iconName: 'FileBarChart',
        permission: 'mrp',
        keywords: ['mrp', 'material', 'service', 'requirement', 'procurement'],
      },
      {
        title: 'Purchase Orders',
        path: '/procurement/purchase-orders',
        iconName: 'ShoppingCart',
        permission: 'purchaseOrders',
      },
      { title: 'GRN (Goods Receipt)', path: '/procurement/grn', iconName: 'PackageOpen', permission: 'grn' },
    ],
  },
  // 5. Manufacturing (Testing moved here from Orders & Planning)
  {
    title: 'Manufacturing',
    iconName: 'Cog',
    permission: 'manufacturing',
    items: [
      { title: 'Production Runs', path: '/production/work-orders', iconName: 'Factory', permission: 'workOrders' },
      { title: 'Sample Tracking', path: '/samples', iconName: 'TestTube', permission: 'samples' },
      'divider',
      { title: 'Printing', path: '/manufacturing/printing', iconName: 'Beaker', permission: 'printing' },
      { title: 'Dyeing', path: '/manufacturing/dyeing', iconName: 'Droplets', permission: 'dyeing' },
      { title: 'Cutting', path: '/manufacturing/cutting', iconName: 'Scissors', permission: 'cutting' },
      { title: 'Stitching', path: '/manufacturing/stitching', iconName: 'Factory', permission: 'stitching' },
      { title: 'Finishing', path: '/manufacturing/finishing', iconName: 'CheckSquare', permission: 'finishing' },
      { title: 'Challans', path: '/manufacturing/challans', iconName: 'FileText', permission: 'challans' },
      { title: 'Dispatch', path: '/manufacturing/dispatch', iconName: 'Send', permission: 'dispatch' },
      'divider',
      { title: 'Job Work Dashboard', path: '/processing/job-work', iconName: 'Shuffle', permission: 'jobWork' },
      {
        title: 'Processing Batches',
        path: '/processing/batches',
        iconName: 'ClipboardList',
        permission: 'processingBatches',
      },
      'divider',
      { title: 'Testing (FPT/GPT)', path: '/testing', iconName: 'FlaskConical', permission: 'testing' },
    ],
  },
  // 6. Inventory
  {
    title: 'Inventory',
    iconName: 'Warehouse',
    items: [
      {
        title: 'Inventory Dashboard',
        path: '/inventory/dashboard',
        iconName: 'BarChart3',
        permission: 'inventoryDashboard',
      },
      { title: 'Stock Levels', path: '/inventory/stock-levels', iconName: 'Package', permission: 'stockLevels' },
      { title: 'Stock Counts', path: '/inventory/stock-counts', iconName: 'ClipboardCheck', permission: 'stockCounts' },
      'divider',
      { title: 'Greige Stock', path: '/greige-stock', iconName: 'Package', permission: 'greigeFabricStock' },
      { title: 'Fabric Stock', path: '/fabric-stock', iconName: 'Package', permission: 'greigeFabricStock' },
      { title: 'Embroidery Stock', path: '/embroidery-stock', iconName: 'Sparkles', permission: 'embroideryStock' },
      'divider',
      {
        title: 'Stock In',
        path: '/inventory/movements/stock-in',
        iconName: 'PackagePlus',
        permission: 'stockMovements',
      },
      {
        title: 'Stock Out',
        path: '/inventory/movements/stock-out',
        iconName: 'PackageX',
        permission: 'stockMovements',
      },
      {
        title: 'Stock Transfer',
        path: '/inventory/movements/transfer',
        iconName: 'Truck',
        permission: 'stockMovements',
      },
      {
        title: 'Stock Adjustment',
        path: '/inventory/movements/adjustment',
        iconName: 'Scale',
        permission: 'stockMovements',
      },
    ],
  },
  // 7. Materials & Masters (merged)
  {
    title: 'Materials & Masters',
    iconName: 'Package',
    items: [
      // Sub-header: Fabric & Materials
      { type: 'sub-header', title: 'Fabric & Materials' } as SubHeader,
      { title: 'Material Master', path: '/material-master', iconName: 'Layers', permission: 'fabricMasters' },
      { title: 'Greige Master', path: '/greige', iconName: 'Package', permission: 'fabricMasters' },
      { title: 'Fabric Master', path: '/fabric', iconName: 'Package', permission: 'fabricMasters' },
      { title: 'Embroidery Master', path: '/embroidery', iconName: 'Sparkles', permission: 'trimMasters' },
      { title: 'Trims Dashboard', path: '/trim-masters', iconName: 'Scissors', permission: 'trimMasters' },
      { title: 'Labels', path: '/materials/label', iconName: 'Tag', permission: 'trimMasters' },
      { title: 'Packaging', path: '/materials/packaging', iconName: 'Box', permission: 'trimMasters' },
      { title: 'Machine Parts', path: '/materials/machine-part', iconName: 'Settings', permission: 'trimMasters' },
      { title: 'Other Materials', path: '/materials/other', iconName: 'PackageSearch', permission: 'trimMasters' },
      'divider',
      // Sub-header: People & Entities
      { type: 'sub-header', title: 'People & Entities' } as SubHeader,
      { title: 'Customers', path: '/customers', iconName: 'Building2', permission: 'customers' },
      { title: 'Suppliers', path: '/suppliers', iconName: 'Building2', permission: 'suppliers' },
      { title: 'Agents', path: '/agents', iconName: 'Users', permission: 'customers' },
      { title: 'Agencies', path: '/agencies', iconName: 'Building2', permission: 'customers' },
      'divider',
      // Sub-header: Configuration (collapsed by default)
      { type: 'sub-header', title: 'Configuration', collapsible: true, defaultCollapsed: true } as SubHeader,
      { title: 'All Masters', path: '/master-data', iconName: 'Package', permission: 'masterData' },
      { title: 'Colors', path: '/colors', iconName: 'Palette', permission: 'colorMaster' },
      { title: 'Seasons', path: '/seasons', iconName: 'Calendar', permission: 'seasonMaster' },
      {
        title: 'Size Categories',
        path: '/masters/size-categories',
        iconName: 'Ruler',
        permission: 'sizeCategoryMaster',
      },
      { title: 'Component Groups', path: '/component-groups', iconName: 'Layers', permission: 'componentMasters' },
      { title: 'Component Masters', path: '/component-masters', iconName: 'Layers', permission: 'componentMasters' },
      { title: 'Pattern Parts', path: '/pattern-parts', iconName: 'Puzzle', permission: 'componentMasters' },
      {
        title: 'Product Categories',
        path: '/product-categories',
        iconName: 'FolderTree',
        permission: 'productCategories',
      },
      {
        title: 'Processor Rate Cards',
        path: '/processor-rate-cards',
        iconName: 'FileSpreadsheet',
        permission: 'suppliers',
      },
      { title: 'Warehouses', path: '/inventory/warehouses', iconName: 'Warehouse', permission: 'warehouses' },
    ],
  },
  // 8. Sales & Billing (moved above Reports)
  {
    title: 'Sales & Billing',
    iconName: 'Receipt',
    items: [
      {
        title: 'Sale Orders',
        path: '/sale-orders',
        iconName: 'ShoppingBag',
        permission: 'orders',
        keywords: ['sale', 'stock sale', 'sell from stock'],
      },
      { title: 'Quotations', path: '/quotations', iconName: 'FileText', permission: 'quotations' },
      { title: 'Invoices', path: '/invoices', iconName: 'Receipt', permission: 'invoices' },
    ],
  },
  // 9. Reports & Finance
  {
    title: 'Reports & Finance',
    iconName: 'FileSpreadsheet',
    items: [
      {
        title: 'Style-Fabric Report',
        path: '/reports/style-fabric',
        iconName: 'FileSpreadsheet',
        permission: 'reports',
      },
      { title: 'Fabric Usage Report', path: '/reports/fabric-usage', iconName: 'BarChart3', permission: 'reports' },
      'divider',
      { title: 'Chart of Accounts', path: '/chart-of-accounts', iconName: 'Wallet', permission: 'chartOfAccounts' },
      'divider',
      { type: 'sub-header' as const, label: 'Tax & GST' },
      { title: 'HSN/SAC Codes', path: '/hsn-sac-masters', iconName: 'Hash' },
      { title: 'Tax Masters', path: '/tax-masters', iconName: 'Calculator' },
      { title: 'Credit Notes', path: '/credit-notes', iconName: 'FileText' },
      { title: 'Debit Notes', path: '/debit-notes', iconName: 'FileText' },
      { title: 'GST Reports', path: '/gst-reports', iconName: 'FileText' },
      { title: 'TDS Tracking', path: '/tds', iconName: 'FileText' },
      { title: 'TCS Tracking', path: '/tcs', iconName: 'FileText' },
    ],
  },
  // 10. Administration (merged Admin + Settings)
  {
    title: 'Administration',
    iconName: 'ShieldAlert',
    permission: 'admin',
    items: [
      { title: 'Users', path: '/users', iconName: 'UserCircle', permission: 'users' },
      { title: 'Pending Approvals', path: '/users/pending', iconName: 'UserCheck', permission: 'users' },
      'divider',
      { title: 'Permissions', path: '/admin/permissions', iconName: 'Lock', permission: 'permissions' },
      {
        title: 'Override History',
        path: '/admin/override-history',
        iconName: 'ShieldAlert',
        permission: 'overrideHistory',
      },
    ],
  },
  // 11. Process Guide (standalone at the end)
  {
    title: 'Process Guide',
    iconName: 'BookOpen',
    items: [{ title: 'Process Guide', path: '/process-guide', iconName: 'BookOpen', permission: 'processGuide' }],
  },
  // 12. Design (at the very end)
  {
    title: 'Design',
    iconName: 'Palette',
    items: [
      { title: 'Design Dashboard', path: '/design-dashboard', iconName: 'LayoutDashboard' },
      { title: 'Mood Boards', path: '/mood-boards', iconName: 'Layers' },
      { title: 'Catalogue Generator', path: '/catalogue-generator', iconName: 'BookImage' },
    ],
  },
];

// ─── Flattened items for Command Palette search ─────────────────────────────

function isNavItem(item: NavItemOrDivider): item is NavItem {
  return typeof item !== 'string' && !('type' in item);
}

export function getAllFlatNavItems(): FlatNavItem[] {
  const items: FlatNavItem[] = [];

  // Add top-level items
  for (const item of TOP_LEVEL_ITEMS) {
    items.push({
      title: item.title,
      path: item.path,
      group: 'Quick Access',
      iconName: item.iconName,
      permission: item.permission,
    });
  }

  // Add group items
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (isNavItem(item)) {
        items.push({
          title: item.title,
          path: item.path,
          group: group.title,
          iconName: item.iconName,
          permission: item.permission,
          keywords: item.keywords,
        });
      }
    }
  }

  // AI Assistant
  items.push({
    title: 'AI Assistant',
    path: '/ai-assistant',
    group: 'Tools',
    iconName: 'Sparkles',
    permission: 'aiAssistant',
  });

  return items;
}
