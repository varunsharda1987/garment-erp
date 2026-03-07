/**
 * Centralized permission configuration for role-based access control
 * Maps features/modules to the roles that can access them
 */

import { UserRole } from '@/types/user.types';

// All roles for convenience
const ALL_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.MERCHANDISER,
  UserRole.PRODUCTION_MANAGER,
  UserRole.SALES,
  UserRole.INVENTORY,
  UserRole.ACCOUNTS,
  UserRole.QUALITY,
  UserRole.PURCHASE,
  UserRole.FACTORY_SUPERVISOR,
];

/**
 * Permission configuration - maps feature keys to allowed roles
 */
export const PERMISSIONS = {
  // Dashboard - Available to all authenticated users
  dashboard: ALL_ROLES,
  processGuide: ALL_ROLES,
  aiAssistant: ALL_ROLES,

  // Production Status
  productionStatus: [
    UserRole.ADMIN,
    UserRole.PRODUCTION_MANAGER,
    UserRole.MERCHANDISER,
    UserRole.FACTORY_SUPERVISOR,
  ],

  // Styles & CAD Planning
  styles: [
    UserRole.ADMIN,
    UserRole.MERCHANDISER,
    UserRole.PRODUCTION_MANAGER,
    UserRole.SALES,
  ],
  cadPlanning: [
    UserRole.ADMIN,
    UserRole.MERCHANDISER,
    UserRole.PRODUCTION_MANAGER,
  ],
  costSheets: [
    UserRole.ADMIN,
    UserRole.MERCHANDISER,
    UserRole.ACCOUNTS,
  ],

  // Testing/Quality
  testing: [
    UserRole.ADMIN,
    UserRole.QUALITY,
    UserRole.PRODUCTION_MANAGER,
    UserRole.MERCHANDISER,
  ],

  // Orders & Planning
  orders: [
    UserRole.ADMIN,
    UserRole.MERCHANDISER,
    UserRole.SALES,
    UserRole.PRODUCTION_MANAGER,
  ],
  workOrders: [
    UserRole.ADMIN,
    UserRole.MERCHANDISER,
    UserRole.PRODUCTION_MANAGER,
    UserRole.FACTORY_SUPERVISOR,
  ],
  bom: [
    UserRole.ADMIN,
    UserRole.MERCHANDISER,
    UserRole.PRODUCTION_MANAGER,
  ],
  mrp: [
    UserRole.ADMIN,
    UserRole.MERCHANDISER,
    UserRole.PRODUCTION_MANAGER,
    UserRole.INVENTORY,
    UserRole.PURCHASE,
  ],

  // Manufacturing
  samples: [
    UserRole.ADMIN,
    UserRole.MERCHANDISER,
    UserRole.PRODUCTION_MANAGER,
    UserRole.QUALITY,
  ],
  manufacturing: [
    UserRole.ADMIN,
    UserRole.PRODUCTION_MANAGER,
    UserRole.FACTORY_SUPERVISOR,
  ],
  printing: [
    UserRole.ADMIN,
    UserRole.PRODUCTION_MANAGER,
    UserRole.FACTORY_SUPERVISOR,
  ],
  dyeing: [
    UserRole.ADMIN,
    UserRole.PRODUCTION_MANAGER,
    UserRole.FACTORY_SUPERVISOR,
  ],
  cutting: [
    UserRole.ADMIN,
    UserRole.PRODUCTION_MANAGER,
    UserRole.FACTORY_SUPERVISOR,
  ],
  stitching: [
    UserRole.ADMIN,
    UserRole.PRODUCTION_MANAGER,
    UserRole.FACTORY_SUPERVISOR,
  ],
  finishing: [
    UserRole.ADMIN,
    UserRole.PRODUCTION_MANAGER,
    UserRole.FACTORY_SUPERVISOR,
    UserRole.QUALITY,
  ],
  dispatch: [
    UserRole.ADMIN,
    UserRole.PRODUCTION_MANAGER,
    UserRole.FACTORY_SUPERVISOR,
    UserRole.INVENTORY,
  ],
  jobWork: [
    UserRole.ADMIN,
    UserRole.PRODUCTION_MANAGER,
    UserRole.PURCHASE,
  ],
  processingBatches: [
    UserRole.ADMIN,
    UserRole.PRODUCTION_MANAGER,
    UserRole.FACTORY_SUPERVISOR,
  ],
  challans: [
    UserRole.ADMIN,
    UserRole.PRODUCTION_MANAGER,
    UserRole.FACTORY_SUPERVISOR,
    UserRole.PURCHASE,
  ],

  // Inventory
  inventoryDashboard: [
    UserRole.ADMIN,
    UserRole.INVENTORY,
    UserRole.PRODUCTION_MANAGER,
    UserRole.PURCHASE,
  ],
  stockLevels: [
    UserRole.ADMIN,
    UserRole.INVENTORY,
    UserRole.PRODUCTION_MANAGER,
    UserRole.PURCHASE,
    UserRole.FACTORY_SUPERVISOR,
  ],
  stockCounts: [
    UserRole.ADMIN,
    UserRole.INVENTORY,
  ],
  stockMovements: [
    UserRole.ADMIN,
    UserRole.INVENTORY,
    UserRole.FACTORY_SUPERVISOR,
  ],
  greigeFabricStock: [
    UserRole.ADMIN,
    UserRole.INVENTORY,
    UserRole.PRODUCTION_MANAGER,
    UserRole.PURCHASE,
  ],
  embroideryStock: [
    UserRole.ADMIN,
    UserRole.INVENTORY,
    UserRole.PRODUCTION_MANAGER,
  ],

  // Procurement
  purchaseOrders: [
    UserRole.ADMIN,
    UserRole.PURCHASE,
    UserRole.MERCHANDISER,
  ],
  grn: [
    UserRole.ADMIN,
    UserRole.PURCHASE,
    UserRole.INVENTORY,
  ],
  materialRequirements: [
    UserRole.ADMIN,
    UserRole.PURCHASE,
    UserRole.MERCHANDISER,
    UserRole.PRODUCTION_MANAGER,
  ],

  // Masters
  masterData: ALL_ROLES,
  customers: [
    UserRole.ADMIN,
    UserRole.MERCHANDISER,
    UserRole.SALES,
    UserRole.ACCOUNTS,
  ],
  suppliers: [
    UserRole.ADMIN,
    UserRole.PURCHASE,
    UserRole.ACCOUNTS,
  ],
  fabricMasters: [
    UserRole.ADMIN,
    UserRole.MERCHANDISER,
    UserRole.INVENTORY,
    UserRole.PURCHASE,
  ],
  trimMasters: [
    UserRole.ADMIN,
    UserRole.MERCHANDISER,
    UserRole.INVENTORY,
    UserRole.PURCHASE,
  ],
  componentMasters: [
    UserRole.ADMIN,
    UserRole.MERCHANDISER,
  ],
  colorMaster: [
    UserRole.ADMIN,
    UserRole.MERCHANDISER,
    UserRole.PRODUCTION_MANAGER,
  ],
  seasonMaster: [
    UserRole.ADMIN,
    UserRole.MERCHANDISER,
  ],
  sizeCategoryMaster: [
    UserRole.ADMIN,
    UserRole.MERCHANDISER,
  ],
  productCategories: [
    UserRole.ADMIN,
    UserRole.MERCHANDISER,
  ],
  warehouses: [
    UserRole.ADMIN,
    UserRole.INVENTORY,
  ],

  // Reports & Finance
  reports: [
    UserRole.ADMIN,
    UserRole.MERCHANDISER,
    UserRole.PRODUCTION_MANAGER,
    UserRole.ACCOUNTS,
  ],
  chartOfAccounts: [
    UserRole.ADMIN,
    UserRole.ACCOUNTS,
  ],
  invoices: [
    UserRole.ADMIN,
    UserRole.ACCOUNTS,
    UserRole.SALES,
  ],
  quotations: [
    UserRole.ADMIN,
    UserRole.SALES,
    UserRole.MERCHANDISER,
  ],

  // Admin
  users: [UserRole.ADMIN],
  admin: [UserRole.ADMIN],
  permissions: [UserRole.ADMIN],
  overrideHistory: [UserRole.ADMIN],
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

/**
 * Route-to-permission mapping for automatic route protection
 */
export const ROUTE_PERMISSIONS: Record<string, PermissionKey> = {
  // Dashboard & General
  '/dashboard': 'dashboard',
  '/process-guide': 'processGuide',
  '/ai-assistant': 'aiAssistant',
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
  '/manufacturing/printing': 'printing',
  '/manufacturing/dyeing': 'dyeing',
  '/manufacturing/cutting': 'cutting',
  '/manufacturing/stitching': 'stitching',
  '/manufacturing/finishing': 'finishing',
  '/manufacturing/challans': 'challans',
  '/manufacturing/dispatch': 'dispatch',
  '/processing/job-work': 'jobWork',
  '/processing/batches': 'processingBatches',

  // Inventory
  '/inventory/dashboard': 'inventoryDashboard',
  '/inventory/stock-levels': 'stockLevels',
  '/inventory/stock-counts': 'stockCounts',
  '/inventory/movements': 'stockMovements',
  '/greige-stock': 'greigeFabricStock',
  '/fabric-stock': 'greigeFabricStock',
  '/embroidery-stock': 'embroideryStock',

  // Procurement
  '/procurement/purchase-orders': 'purchaseOrders',
  '/procurement/grn': 'grn',
  '/mrp/requirements': 'materialRequirements',

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

  // Admin
  '/users': 'users',
  '/admin': 'admin',
  '/admin/permissions': 'permissions',
  '/admin/override-history': 'overrideHistory',
};

/**
 * Check if a role has permission for a specific feature
 */
export function hasPermission(role: string | undefined, permissionKey: PermissionKey): boolean {
  if (!role) return false;
  const allowedRoles = PERMISSIONS[permissionKey];
  return (allowedRoles as readonly string[]).includes(role);
}

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

/**
 * Get all permissions for a given role
 */
export function getPermissionsForRole(role: UserRole): PermissionKey[] {
  return (Object.entries(PERMISSIONS) as [PermissionKey, readonly UserRole[]][])
    .filter(([, roles]) => roles.includes(role))
    .map(([key]) => key);
}

/**
 * Module definitions for permission management UI
 */
export const MODULES = {
  DASHBOARD: { name: 'Dashboard', description: 'Main dashboard and process guide' },
  STYLES: { name: 'Styles', description: 'Style management, CAD planning, costing' },
  ORDERS: { name: 'Orders', description: 'Order management and work orders' },
  MANUFACTURING: { name: 'Manufacturing', description: 'Production floor operations' },
  INVENTORY: { name: 'Inventory', description: 'Stock management and movements' },
  PROCUREMENT: { name: 'Procurement', description: 'Purchase orders and GRN' },
  MASTERS: { name: 'Masters', description: 'Master data management' },
  FINANCE: { name: 'Finance', description: 'Invoices, quotations, accounts' },
  QUALITY: { name: 'Quality', description: 'Testing and quality control' },
  ADMIN: { name: 'Admin', description: 'User and permission management' },
} as const;

/**
 * Group permissions by module for UI display
 */
export const PERMISSION_GROUPS: Record<keyof typeof MODULES, PermissionKey[]> = {
  DASHBOARD: ['dashboard', 'processGuide', 'productionStatus', 'aiAssistant'],
  STYLES: ['styles', 'cadPlanning', 'costSheets'],
  ORDERS: ['orders', 'workOrders', 'bom', 'mrp'],
  MANUFACTURING: ['samples', 'manufacturing', 'printing', 'dyeing', 'cutting', 'stitching', 'finishing', 'challans', 'dispatch', 'jobWork', 'processingBatches'],
  INVENTORY: ['inventoryDashboard', 'stockLevels', 'stockCounts', 'stockMovements', 'greigeFabricStock', 'embroideryStock'],
  PROCUREMENT: ['purchaseOrders', 'grn', 'materialRequirements'],
  MASTERS: ['masterData', 'customers', 'suppliers', 'fabricMasters', 'trimMasters', 'componentMasters', 'colorMaster', 'seasonMaster', 'sizeCategoryMaster', 'productCategories', 'warehouses'],
  FINANCE: ['reports', 'chartOfAccounts', 'invoices', 'quotations'],
  QUALITY: ['testing'],
  ADMIN: ['users', 'admin', 'permissions', 'overrideHistory'],
};
