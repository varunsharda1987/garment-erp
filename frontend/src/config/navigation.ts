/**
 * Shared navigation configuration used by Sidebar and CommandPalette.
 * All navigation items, groups, and their permissions are defined here.
 *
 * Structure (consolidated 2026-08): 3 top-level items + 8 groups.
 * Pages demoted from the sidebar live in SEARCH_ONLY_ITEMS so they stay
 * findable via Ctrl+K and users' pinned favorites keep resolving.
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
  // 1. Pre-Production (includes Design)
  {
    title: 'Pre-Production',
    iconName: 'Ruler',
    items: [
      { title: 'CAD Planning', path: '/cad-planning', iconName: 'Ruler', permission: 'cadPlanning' },
      { title: 'Fabric Costing', path: '/fabric-costing', iconName: 'Calculator', permission: 'costSheets' },
      { title: 'Costing Options', path: '/fabric-costing/options', iconName: 'ListChecks', permission: 'costSheets' },
      { title: 'Cost Sheets', path: '/cost-sheets', iconName: 'Calculator', permission: 'costSheets' },
      'divider',
      {
        title: 'Design Studio',
        path: '/design-dashboard',
        iconName: 'Palette',
        keywords: ['design dashboard', 'mood boards', 'catalogue', 'lookbook'],
      },
    ],
  },
  // 2. Orders & Sales (order-to-cash: orders, planning, billing)
  {
    title: 'Orders & Sales',
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
      'divider',
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
  // 3. Procurement
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
  // 4. Manufacturing
  {
    title: 'Manufacturing',
    iconName: 'Cog',
    permission: 'manufacturing',
    items: [
      {
        title: 'Control Center',
        path: '/manufacturing',
        iconName: 'LayoutDashboard',
        permission: 'manufacturing',
        keywords: ['alerts', 'inbox', 'action', 'pending', 'urgent', 'control center'],
      },
      { title: 'Production Runs', path: '/production/work-orders', iconName: 'Factory', permission: 'workOrders' },
      {
        title: 'Job Work Dashboard',
        path: '/processing/job-work',
        iconName: 'Shuffle',
        permission: 'jobWork',
        keywords: ['batches', 'processing', 'jwo', 'job work orders'],
      },
      // Kept in the sidebar: FACTORY_SUPERVISOR has processingBatches but NOT
      // jobWork, so the Job Work Dashboard hub can't be its click-path.
      {
        title: 'Processing Batches',
        path: '/processing/batches',
        iconName: 'ClipboardList',
        permission: 'processingBatches',
        keywords: ['batch', 'mill', 'job work', 'at mill'],
      },
      { title: 'Sample Tracking', path: '/samples', iconName: 'TestTube', permission: 'samples' },
      { title: 'Testing (FPT/GPT)', path: '/testing', iconName: 'FlaskConical', permission: 'testing' },
      { type: 'sub-header', title: 'Production Stages' } as SubHeader,
      {
        title: 'Dyeing & Printing',
        path: '/manufacturing/processing',
        iconName: 'Beaker',
        permission: 'printing',
        keywords: ['dyeing', 'printing', 'lab dip', 'process po', 'mill', 'processing'],
      },
      { title: 'Cutting', path: '/manufacturing/cutting', iconName: 'Scissors', permission: 'cutting' },
      {
        title: 'Embroidery',
        path: '/job-work-orders?processType=EMBROIDERY',
        iconName: 'Sparkles',
        permission: 'embroideryStock',
        keywords: ['embroidery pieces', 'embroidery stock', 'job work'],
      },
      { title: 'Smocking', path: '/manufacturing/smocking', iconName: 'Waves', permission: 'manufacturing' },
      { title: 'Stitching', path: '/manufacturing/stitching', iconName: 'Factory', permission: 'stitching' },
      { title: 'Handwork', path: '/manufacturing/handwork', iconName: 'Hand', permission: 'manufacturing' },
      { title: 'Finishing', path: '/manufacturing/finishing', iconName: 'CheckSquare', permission: 'finishing' },
      { type: 'sub-header', title: 'Documents' } as SubHeader,
      { title: 'Challans', path: '/manufacturing/challans', iconName: 'FileText', permission: 'challans' },
      { title: 'Dispatch', path: '/manufacturing/dispatch', iconName: 'Send', permission: 'dispatch' },
    ],
  },
  // 5. Inventory
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
      {
        title: 'Movement Dashboard',
        path: '/inventory/movement-dashboard',
        iconName: 'LayoutDashboard',
        permission: 'stockMovements',
        keywords: ['pending', 'inward', 'outward', 'external', 'processor', 'receive', 'send'],
      },
      { title: 'Stock Levels', path: '/inventory/stock-levels', iconName: 'Package', permission: 'stockLevels' },
      {
        title: 'FG Stock',
        path: '/inventory/fg-stock',
        iconName: 'PackageCheck',
        permission: 'stockLevels',
        keywords: ['finished goods', 'fg', 'garments', 'ready'],
      },
      { title: 'Stock Counts', path: '/inventory/stock-counts', iconName: 'ClipboardCheck', permission: 'stockCounts' },
      'divider',
      { title: 'Greige Stock', path: '/greige-stock', iconName: 'Package', permission: 'greigeFabricStock' },
      { title: 'Fabric Stock', path: '/fabric-stock', iconName: 'Package', permission: 'greigeFabricStock' },
      'divider',
      {
        title: 'Material Movements',
        path: '/inventory/movements',
        iconName: 'Shuffle',
        permission: 'stockMovements',
        keywords: ['unified', 'all movements', 'inward', 'outward', 'transfer', 'invoice', 'stock in', 'stock out'],
      },
      { title: 'Warehouses', path: '/inventory/warehouses', iconName: 'Warehouse', permission: 'warehouses' },
    ],
  },
  // 6. Materials & Masters
  {
    title: 'Materials & Masters',
    iconName: 'Package',
    items: [
      // Sub-header: Fabric & Materials
      { type: 'sub-header', title: 'Fabric & Materials' } as SubHeader,
      { title: 'Greige Master', path: '/greige', iconName: 'Package', permission: 'fabricMasters' },
      { title: 'Fabric Master', path: '/fabric', iconName: 'Package', permission: 'fabricMasters' },
      { title: 'Embroidery Master', path: '/embroidery', iconName: 'Sparkles', permission: 'trimMasters' },
      { title: 'Trims Dashboard', path: '/trim-masters', iconName: 'Scissors', permission: 'trimMasters' },
      { title: 'Lace Stock', path: '/lace-stock', iconName: 'Package', permission: 'trimMasters' },
      { title: 'Lace Lab Dips', path: '/lace-lab-dips', iconName: 'FlaskConical', permission: 'trimMasters' },
      { title: 'Lace Defects', path: '/lace-defects', iconName: 'AlertTriangle', permission: 'trimMasters' },
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
      {
        title: 'All Masters',
        path: '/master-data',
        iconName: 'Package',
        permission: 'masterData',
        keywords: [
          'labels',
          'packaging',
          'trims',
          'masters hub',
          'material masters',
          'seasons',
          'size categories',
          'components',
          'warehouses',
          'configuration',
        ],
      },
      { title: 'Colors', path: '/colors', iconName: 'Palette', permission: 'colorMaster' },
      {
        title: 'Processor Rate Cards',
        path: '/processor-rate-cards',
        iconName: 'FileSpreadsheet',
        permission: 'suppliers',
      },
    ],
  },
  // 7. Reports & Finance
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
      {
        title: 'Tax & GST',
        path: '/finance/tax-gst',
        iconName: 'Calculator',
        keywords: ['gst', 'hsn', 'sac', 'tds', 'tcs', 'tax masters', 'credit note', 'debit note', 'gst reports'],
      },
    ],
  },
  // 8. Team & Settings (Messaging + Process Guide + Administration).
  // ⚠ NO group-level permission — non-admin staff must still see the
  // messaging items; admin items are hidden by their item-level permissions.
  {
    title: 'Team & Settings',
    iconName: 'Settings',
    items: [
      { title: 'My WhatsApp', path: '/whatsapp', iconName: 'MessageCircle', permission: 'whatsapp' },
      {
        title: 'Message Staff',
        path: '/messages/new',
        iconName: 'Send',
        permission: 'messaging',
        keywords: ['whatsapp', 'department', 'colleague', 'internal message'],
      },
      { title: 'Process Guide', path: '/process-guide', iconName: 'BookOpen', permission: 'processGuide' },
      'divider',
      {
        title: 'Users',
        path: '/users',
        iconName: 'UserCircle',
        permission: 'users',
        keywords: ['pending approvals', 'staff', 'accounts'],
      },
      { title: 'Permissions', path: '/admin/permissions', iconName: 'Lock', permission: 'permissions' },
      {
        title: 'Override History',
        path: '/admin/override-history',
        iconName: 'ShieldAlert',
        permission: 'overrideHistory',
      },
      'divider',
      {
        title: 'Tally Integration',
        path: '/settings/tally',
        iconName: 'Database',
        permission: 'admin',
        keywords: ['tally', 'erp', 'accounting', 'integration', 'ledger', 'push', 'voucher', 'outstanding', 'matching'],
      },
      {
        title: 'GST e-Invoice',
        path: '/settings/einvoice',
        iconName: 'QrCode',
        permission: 'admin',
        keywords: ['einvoice', 'e-invoice', 'irn', 'gst', 'nic', 'irp', 'qr code', 'government'],
      },
    ],
  },
];

// ─── Search-only items (demoted from the sidebar, still Ctrl+K findable) ────
// Every page removed from NAV_GROUPS must be listed here so it stays in the
// command palette and users' pinned favorites keep resolving. Each entry's
// primary click-path is noted — nothing here is reachable only by search.

export const SEARCH_ONLY_ITEMS: FlatNavItem[] = [
  // Linked from Design Studio (/design-dashboard)
  {
    title: 'Mood Boards',
    path: '/mood-boards',
    group: 'Pre-Production',
    iconName: 'Layers',
    keywords: ['design', 'inspiration', 'mood board'],
  },
  {
    title: 'Catalogue Generator',
    path: '/catalogue-generator',
    group: 'Pre-Production',
    iconName: 'BookImage',
    keywords: ['catalogue', 'catalog', 'lookbook', 'design'],
  },
  // Linked from Material Movements (/inventory/movements) + Stock Dashboard quick actions
  {
    title: 'Stock In',
    path: '/inventory/movements/stock-in',
    group: 'Inventory',
    iconName: 'PackagePlus',
    permission: 'stockMovements',
    keywords: ['inward', 'receive', 'material in'],
  },
  {
    title: 'Stock Out',
    path: '/inventory/movements/stock-out',
    group: 'Inventory',
    iconName: 'PackageX',
    permission: 'stockMovements',
    keywords: ['outward', 'issue', 'material out'],
  },
  {
    title: 'Stock Transfer',
    path: '/inventory/movements/transfer',
    group: 'Inventory',
    iconName: 'Truck',
    permission: 'stockMovements',
    keywords: ['warehouse transfer', 'move stock'],
  },
  {
    title: 'Stock Adjustment',
    path: '/inventory/movements/adjustment',
    group: 'Inventory',
    iconName: 'Scale',
    permission: 'stockMovements',
    keywords: ['correction', 'adjust', 'write off', 'shrinkage'],
  },
  // Linked from All Masters (/master-data) — Packaging & Labels category
  {
    title: 'Labels',
    path: '/materials/label',
    group: 'Materials & Masters',
    iconName: 'Tag',
    permission: 'trimMasters',
    keywords: ['label master', 'care label', 'brand label', 'tags'],
  },
  {
    title: 'Packaging',
    path: '/materials/packaging',
    group: 'Materials & Masters',
    iconName: 'Box',
    permission: 'trimMasters',
    keywords: ['packing', 'polybag', 'carton', 'packaging master'],
  },
  // Linked from Users (/users)
  {
    title: 'Pending Approvals',
    path: '/users/pending',
    group: 'Team & Settings',
    iconName: 'UserCheck',
    permission: 'users',
    keywords: ['user approval', 'new users', 'registration', 'approve'],
  },
  // Linked from Job Work Dashboard (/processing/job-work)
  {
    title: 'Job Work Orders',
    path: '/job-work-orders',
    group: 'Manufacturing',
    iconName: 'Factory',
    permission: 'jobWork',
    keywords: ['jwo', 'job work', 'processor', 'dyeing', 'printing', 'section 143'],
  },
  // Linked from Embroidery stock (/embroidery-stock) + Stock Dashboard specialty row
  {
    title: 'Embroidery Pieces',
    path: '/embroidery-stock/pieces',
    group: 'Manufacturing',
    iconName: 'Sparkles',
    permission: 'embroideryStock',
    keywords: ['pieces', 'embroidery'],
  },
  // Linked from All Masters (/master-data) static sections
  {
    title: 'Machine Parts',
    path: '/materials/machine-part',
    group: 'Materials & Masters',
    iconName: 'Settings',
    permission: 'trimMasters',
    keywords: ['spare parts', 'machine', 'needles'],
  },
  {
    title: 'Other Materials',
    path: '/materials/other',
    group: 'Materials & Masters',
    iconName: 'PackageSearch',
    permission: 'trimMasters',
    keywords: ['misc materials', 'other'],
  },
  {
    title: 'Seasons',
    path: '/seasons',
    group: 'Materials & Masters',
    iconName: 'Calendar',
    permission: 'seasonMaster',
    keywords: ['season master', 'ss', 'aw', 'collection'],
  },
  {
    title: 'Size Categories',
    path: '/masters/size-categories',
    group: 'Materials & Masters',
    iconName: 'Ruler',
    permission: 'sizeCategoryMaster',
    keywords: ['sizes', 'size chart', 'size master'],
  },
  {
    title: 'Component Groups',
    path: '/component-groups',
    group: 'Materials & Masters',
    iconName: 'Layers',
    permission: 'componentMasters',
    keywords: ['component', 'groups'],
  },
  {
    title: 'Component Masters',
    path: '/component-masters',
    group: 'Materials & Masters',
    iconName: 'Layers',
    permission: 'componentMasters',
    keywords: ['component', 'garment parts'],
  },
  {
    title: 'Pattern Parts',
    path: '/pattern-parts',
    group: 'Materials & Masters',
    iconName: 'Puzzle',
    permission: 'componentMasters',
    keywords: ['pattern', 'parts', 'cutting patterns'],
  },
  {
    title: 'Product Categories',
    path: '/product-categories',
    group: 'Materials & Masters',
    iconName: 'FolderTree',
    permission: 'productCategories',
    keywords: ['product', 'category', 'classification'],
  },
  {
    title: 'Export Templates',
    path: '/settings/export-templates',
    group: 'Materials & Masters',
    iconName: 'FileSpreadsheet',
    permission: 'masterData',
    keywords: ['export', 'excel templates', 'templates'],
  },
  // Linked from the Tax & GST hub (/finance/tax-gst)
  {
    title: 'HSN/SAC Codes',
    path: '/hsn-sac-masters',
    group: 'Reports & Finance',
    iconName: 'Hash',
    keywords: ['hsn', 'sac', 'gst rate', 'tax code'],
  },
  {
    title: 'Tax Masters',
    path: '/tax-masters',
    group: 'Reports & Finance',
    iconName: 'Calculator',
    permission: 'financialMasters',
    keywords: ['tax rate', 'gst', 'igst', 'cgst', 'sgst'],
  },
  {
    title: 'Credit Notes',
    path: '/credit-notes',
    group: 'Reports & Finance',
    iconName: 'FileText',
    permission: 'creditDebitNotes',
    keywords: ['credit note', 'customer return', 'cn'],
  },
  {
    title: 'Debit Notes',
    path: '/debit-notes',
    group: 'Reports & Finance',
    iconName: 'FileText',
    permission: 'creditDebitNotes',
    keywords: ['debit note', 'supplier return', 'dn'],
  },
  {
    title: 'GST Reports',
    path: '/gst-reports',
    group: 'Reports & Finance',
    iconName: 'FileText',
    keywords: ['gstr-1', 'gstr-3b', 'gst filing', 'returns'],
  },
  {
    title: 'TDS Tracking',
    path: '/tds',
    group: 'Reports & Finance',
    iconName: 'FileText',
    permission: 'financialMasters',
    keywords: ['tds', 'tax deducted', 'section 194'],
  },
  {
    title: 'TCS Tracking',
    path: '/tcs',
    group: 'Reports & Finance',
    iconName: 'FileText',
    permission: 'financialMasters',
    keywords: ['tcs', 'tax collected', 'section 206'],
  },
  // Linked from Tally Integration (/settings/tally) Tally Tools card
  {
    title: 'Customer-Ledger Matching',
    path: '/settings/tally/customers',
    group: 'Team & Settings',
    iconName: 'Link2',
    permission: 'admin',
    keywords: ['tally', 'customer', 'ledger', 'matching', 'link'],
  },
  {
    title: 'Supplier Matching',
    path: '/settings/tally/suppliers',
    group: 'Team & Settings',
    iconName: 'Link2',
    permission: 'admin',
    keywords: ['tally', 'supplier', 'creditor', 'ledger', 'matching', 'link'],
  },
  {
    title: 'Invoice Push',
    path: '/settings/tally/invoices',
    group: 'Team & Settings',
    iconName: 'Upload',
    permission: 'admin',
    keywords: ['tally', 'invoice', 'push', 'voucher', 'sales'],
  },
  {
    title: 'Credit Note Push',
    path: '/settings/tally/credit-notes',
    group: 'Team & Settings',
    iconName: 'FileText',
    permission: 'admin',
    keywords: ['tally', 'credit', 'note', 'return', 'push', 'voucher'],
  },
  {
    title: 'Debit Note Push',
    path: '/settings/tally/debit-notes',
    group: 'Team & Settings',
    iconName: 'FileText',
    permission: 'admin',
    keywords: ['tally', 'debit', 'note', 'supplier', 'return', 'push', 'voucher'],
  },
  {
    title: 'Receipt Push',
    path: '/settings/tally/payments',
    group: 'Team & Settings',
    iconName: 'Receipt',
    permission: 'admin',
    keywords: ['tally', 'receipt', 'payment', 'customer', 'push', 'voucher'],
  },
  {
    title: 'Outstanding Sync',
    path: '/settings/tally/outstanding',
    group: 'Team & Settings',
    iconName: 'Scale',
    permission: 'admin',
    keywords: ['tally', 'outstanding', 'receivable', 'balance', 'reconcile'],
  },
  // Linked from GST e-Invoice settings (/settings/einvoice) quick links
  {
    title: 'IRN Generation',
    path: '/settings/einvoice/invoices',
    group: 'Team & Settings',
    iconName: 'QrCode',
    permission: 'admin',
    keywords: ['einvoice', 'e-invoice', 'irn', 'generate', 'qr', 'bulk', 'cancel'],
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

  // Search-only items (dedup by path so re-promoting an item never double-lists it)
  const seenPaths = new Set(items.map((item) => item.path));
  for (const item of SEARCH_ONLY_ITEMS) {
    if (!seenPaths.has(item.path)) {
      items.push(item);
      seenPaths.add(item.path);
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
