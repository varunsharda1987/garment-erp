/**
 * Permission keys + route → key mapping.
 *
 * The frontend holds NO copy of which roles have which permission. The Permissions page
 * (role_permissions table) is the only source of truth; the signed-in user's granted keys arrive
 * on `/auth/login` and `/auth/me` as `user.permissions`, and `usePermissions().can()` reads them.
 * ADMIN is granted everything server-side.
 *
 * PERMISSION_KEYS must match the backend catalogue in `backend/src/config/permissions.config.ts` —
 * `permission-catalogue-parity.test.ts` (backend) fails when they drift.
 */

export const PERMISSION_KEYS = [
  // Dashboard
  'dashboard',
  'processGuide',
  'aiAssistant',
  'aiSettings',
  'aiInsights',
  'issueReports',
  'productionStatus',
  // Styles
  'styles',
  'cadPlanning',
  'costSheets',
  // Quality
  'testing',
  // Orders & Planning
  'orders',
  'workOrders',
  'bom',
  'mrp',
  // Manufacturing
  'samples',
  'manufacturing',
  'printing',
  'dyeing',
  'cutting',
  'stitching',
  'finishing',
  'challans',
  'dispatch',
  'jobWork',
  'processingBatches',
  // Inventory
  'inventoryDashboard',
  'stockLevels',
  'stockCounts',
  'stockMovements',
  'greigeFabricStock',
  'embroideryStock',
  // Procurement
  'purchaseOrders',
  'grn',
  'materialRequirements',
  // Masters
  'masterData',
  'customers',
  'suppliers',
  'fabricMasters',
  'trimMasters',
  'componentMasters',
  'colorMaster',
  'seasonMaster',
  'sizeCategoryMaster',
  'productCategories',
  'warehouses',
  // Reports & Finance
  'reports',
  'chartOfAccounts',
  'invoices',
  'quotations',
  'financialMasters',
  'creditDebitNotes',
  // Messaging
  'whatsapp',
  'messaging',
  // Admin
  'users',
  'admin',
  'permissions',
  'overrideHistory',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

/**
 * Route-to-permission mapping for automatic route protection
 */
export const ROUTE_PERMISSIONS: Record<string, PermissionKey> = {
  // Dashboard & General
  '/dashboard': 'dashboard',
  '/process-guide': 'processGuide',
  '/ai-assistant': 'aiAssistant',
  '/ai-settings': 'aiSettings',
  '/ai-insights': 'aiInsights',
  '/issue-reports': 'issueReports',
  '/production/status': 'productionStatus',

  // Styles
  '/styles': 'styles',
  '/styles/new': 'styles',
  '/styles/edit': 'styles',
  '/cad-planning': 'cadPlanning',
  '/cost-sheets': 'costSheets',

  // Testing
  '/testing': 'testing',

  // Orders & Planning
  '/orders': 'orders',
  '/production/work-orders': 'workOrders',
  '/bom': 'bom',
  '/mrp': 'mrp',

  // Manufacturing
  '/samples': 'samples',
  '/manufacturing/processing': 'printing',
  '/manufacturing/printing': 'printing',
  '/manufacturing/dyeing': 'dyeing',
  '/manufacturing/cutting': 'cutting',
  '/manufacturing/stitching': 'stitching',
  '/manufacturing/finishing': 'finishing',
  '/manufacturing/challans': 'challans',
  '/manufacturing/dispatch': 'dispatch',
  '/processing/job-work': 'jobWork',
  '/processing/processor-statement': 'jobWork',
  '/processing/batches': 'processingBatches',
  '/job-work-orders': 'jobWork',
  // Sending greige out to a mill is job work, not the finished-goods '/manufacturing/dispatch'
  '/job-work-orders/dispatch': 'jobWork',

  // Tally integration (admin tools; prefix match covers all /settings/tally/* sub-pages)
  '/settings/tally': 'admin',

  // Company profile — the entities we invoice as. Editing changes the GSTIN, letterhead and
  // state code on every future document, so it is admin-only. (Prefix match covers
  // /settings/company/new and /settings/company/:id.) Note the API's READS are open to any
  // authenticated user, because the Purchase Order screens render the letterhead.
  '/settings/company': 'admin',

  // Inventory
  '/inventory/dashboard': 'inventoryDashboard',
  '/inventory/stock-levels': 'stockLevels',
  '/inventory/stock-counts': 'stockCounts',
  '/inventory/movements': 'stockMovements',
  '/inventory/material-ledger': 'stockMovements',
  '/greige-stock': 'greigeFabricStock',
  '/fabric-stock': 'greigeFabricStock',
  '/embroidery-stock': 'embroideryStock',

  // Procurement
  '/procurement/purchase-orders': 'purchaseOrders',
  '/procurement/grn': 'grn',
  // MRP-46: /mrp and /mrp/requirements are the SAME destination (both redirect to
  // /procurement/requirements), but they were guarded by two different permission keys — so
  // whether a user could reach the Requirements page depended on which legacy URL they arrived
  // by. The sidebar entry uses 'mrp'; align on that and register the live path too.
  '/mrp/requirements': 'mrp',
  '/procurement/requirements': 'mrp',

  // Masters
  '/master-data': 'masterData',
  '/customers': 'customers',
  '/suppliers': 'suppliers',
  '/greige': 'fabricMasters',
  '/fabric': 'fabricMasters',
  '/embroidery': 'trimMasters',
  '/trim-masters': 'trimMasters',
  '/materials': 'trimMasters',
  '/colors': 'colorMaster',
  '/seasons': 'seasonMaster',
  '/masters/size-categories': 'sizeCategoryMaster',
  '/component-groups': 'componentMasters',
  '/component-masters': 'componentMasters',
  '/product-categories': 'productCategories',
  '/inventory/warehouses': 'warehouses',

  // Reports & Finance
  '/reports': 'reports',
  '/chart-of-accounts': 'chartOfAccounts',
  '/invoices': 'invoices',
  '/quotations': 'quotations',
  '/tax-masters': 'financialMasters',
  '/tds': 'financialMasters',
  '/tcs': 'financialMasters',
  '/credit-notes': 'creditDebitNotes',
  '/debit-notes': 'creditDebitNotes',

  // Messaging
  '/whatsapp': 'whatsapp',
  '/messages/new': 'messaging',

  // Admin
  '/users': 'users',
  '/admin': 'admin',
  '/admin/permissions': 'permissions',
  '/admin/override-history': 'overrideHistory',
};

/**
 * Get permission key for a given route path
 * Supports both exact and prefix matching
 */
export function getRoutePermission(path: string): PermissionKey | null {
  // Exact match first
  if (ROUTE_PERMISSIONS[path]) {
    return ROUTE_PERMISSIONS[path];
  }

  // Prefix match (for nested routes like /orders/123)
  for (const [pattern, permission] of Object.entries(ROUTE_PERMISSIONS)) {
    if (path.startsWith(pattern + '/') || path === pattern) {
      return permission;
    }
  }

  return null;
}
