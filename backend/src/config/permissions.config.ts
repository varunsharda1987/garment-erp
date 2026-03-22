/**
 * Backend Permission Configuration
 * Mirrors frontend permissions for consistency
 * Used for API-level permission validation and permission matrix endpoint
 */

import { UserRole } from '@prisma/client';

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
  productionStatus: [UserRole.ADMIN, UserRole.PRODUCTION_MANAGER, UserRole.MERCHANDISER, UserRole.FACTORY_SUPERVISOR],

  // Styles & CAD Planning
  styles: [UserRole.ADMIN, UserRole.MERCHANDISER, UserRole.PRODUCTION_MANAGER, UserRole.SALES],
  cadPlanning: [UserRole.ADMIN, UserRole.MERCHANDISER, UserRole.PRODUCTION_MANAGER],
  costSheets: [UserRole.ADMIN, UserRole.MERCHANDISER, UserRole.ACCOUNTS],

  // Testing/Quality
  testing: [UserRole.ADMIN, UserRole.QUALITY, UserRole.PRODUCTION_MANAGER, UserRole.MERCHANDISER],

  // Orders & Planning
  orders: [UserRole.ADMIN, UserRole.MERCHANDISER, UserRole.SALES, UserRole.PRODUCTION_MANAGER],
  workOrders: [UserRole.ADMIN, UserRole.MERCHANDISER, UserRole.PRODUCTION_MANAGER, UserRole.FACTORY_SUPERVISOR],
  bom: [UserRole.ADMIN, UserRole.MERCHANDISER, UserRole.PRODUCTION_MANAGER],
  mrp: [UserRole.ADMIN, UserRole.MERCHANDISER, UserRole.PRODUCTION_MANAGER, UserRole.INVENTORY, UserRole.PURCHASE],

  // Manufacturing
  samples: [UserRole.ADMIN, UserRole.MERCHANDISER, UserRole.PRODUCTION_MANAGER, UserRole.QUALITY],
  manufacturing: [UserRole.ADMIN, UserRole.PRODUCTION_MANAGER, UserRole.FACTORY_SUPERVISOR],
  printing: [UserRole.ADMIN, UserRole.PRODUCTION_MANAGER, UserRole.FACTORY_SUPERVISOR],
  dyeing: [UserRole.ADMIN, UserRole.PRODUCTION_MANAGER, UserRole.FACTORY_SUPERVISOR],
  cutting: [UserRole.ADMIN, UserRole.PRODUCTION_MANAGER, UserRole.FACTORY_SUPERVISOR],
  stitching: [UserRole.ADMIN, UserRole.PRODUCTION_MANAGER, UserRole.FACTORY_SUPERVISOR],
  finishing: [UserRole.ADMIN, UserRole.PRODUCTION_MANAGER, UserRole.FACTORY_SUPERVISOR, UserRole.QUALITY],
  dispatch: [UserRole.ADMIN, UserRole.PRODUCTION_MANAGER, UserRole.FACTORY_SUPERVISOR, UserRole.INVENTORY],
  jobWork: [UserRole.ADMIN, UserRole.PRODUCTION_MANAGER, UserRole.PURCHASE],
  processingBatches: [UserRole.ADMIN, UserRole.PRODUCTION_MANAGER, UserRole.FACTORY_SUPERVISOR],

  // Inventory
  inventoryDashboard: [UserRole.ADMIN, UserRole.INVENTORY, UserRole.PRODUCTION_MANAGER, UserRole.PURCHASE],
  stockLevels: [
    UserRole.ADMIN,
    UserRole.INVENTORY,
    UserRole.PRODUCTION_MANAGER,
    UserRole.PURCHASE,
    UserRole.FACTORY_SUPERVISOR,
  ],
  stockCounts: [UserRole.ADMIN, UserRole.INVENTORY],
  stockMovements: [UserRole.ADMIN, UserRole.INVENTORY, UserRole.FACTORY_SUPERVISOR],
  greigeFabricStock: [UserRole.ADMIN, UserRole.INVENTORY, UserRole.PRODUCTION_MANAGER, UserRole.PURCHASE],
  embroideryStock: [UserRole.ADMIN, UserRole.INVENTORY, UserRole.PRODUCTION_MANAGER],

  // Procurement
  purchaseOrders: [UserRole.ADMIN, UserRole.PURCHASE, UserRole.MERCHANDISER],
  grn: [UserRole.ADMIN, UserRole.PURCHASE, UserRole.INVENTORY],
  materialRequirements: [UserRole.ADMIN, UserRole.PURCHASE, UserRole.MERCHANDISER, UserRole.PRODUCTION_MANAGER],

  // Masters
  masterData: ALL_ROLES,
  customers: [UserRole.ADMIN, UserRole.MERCHANDISER, UserRole.SALES, UserRole.ACCOUNTS],
  suppliers: [UserRole.ADMIN, UserRole.PURCHASE, UserRole.ACCOUNTS],
  fabricMasters: [UserRole.ADMIN, UserRole.MERCHANDISER, UserRole.INVENTORY, UserRole.PURCHASE],
  trimMasters: [UserRole.ADMIN, UserRole.MERCHANDISER, UserRole.INVENTORY, UserRole.PURCHASE],
  componentMasters: [UserRole.ADMIN, UserRole.MERCHANDISER],
  colorMaster: [UserRole.ADMIN, UserRole.MERCHANDISER, UserRole.PRODUCTION_MANAGER],
  sizeCategoryMaster: [UserRole.ADMIN, UserRole.MERCHANDISER],
  productCategories: [UserRole.ADMIN, UserRole.MERCHANDISER],
  warehouses: [UserRole.ADMIN, UserRole.INVENTORY],

  // Reports & Finance
  reports: [UserRole.ADMIN, UserRole.MERCHANDISER, UserRole.PRODUCTION_MANAGER, UserRole.ACCOUNTS],
  chartOfAccounts: [UserRole.ADMIN, UserRole.ACCOUNTS],
  invoices: [UserRole.ADMIN, UserRole.ACCOUNTS, UserRole.SALES],
  quotations: [UserRole.ADMIN, UserRole.SALES, UserRole.MERCHANDISER],

  // Admin
  users: [UserRole.ADMIN],
  admin: [UserRole.ADMIN],
  permissions: [UserRole.ADMIN],
  overrideHistory: [UserRole.ADMIN],
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

/**
 * Check if a role has permission for a specific feature
 */
export function hasPermission(role: string | undefined, permissionKey: PermissionKey): boolean {
  if (!role) return false;
  const allowedRoles = PERMISSIONS[permissionKey];
  return (allowedRoles as readonly string[]).includes(role);
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
  MANUFACTURING: [
    'samples',
    'manufacturing',
    'printing',
    'dyeing',
    'cutting',
    'stitching',
    'finishing',
    'dispatch',
    'jobWork',
    'processingBatches',
  ],
  INVENTORY: [
    'inventoryDashboard',
    'stockLevels',
    'stockCounts',
    'stockMovements',
    'greigeFabricStock',
    'embroideryStock',
  ],
  PROCUREMENT: ['purchaseOrders', 'grn', 'materialRequirements'],
  MASTERS: [
    'masterData',
    'customers',
    'suppliers',
    'fabricMasters',
    'trimMasters',
    'componentMasters',
    'colorMaster',
    'sizeCategoryMaster',
    'productCategories',
    'warehouses',
  ],
  FINANCE: ['reports', 'chartOfAccounts', 'invoices', 'quotations'],
  QUALITY: ['testing'],
  ADMIN: ['users', 'admin', 'permissions', 'overrideHistory'],
};

/**
 * Role display configuration
 */
export const ROLE_CONFIG: Record<UserRole, { name: string; description: string }> = {
  [UserRole.ADMIN]: { name: 'Administrator', description: 'Full system access' },
  [UserRole.MERCHANDISER]: { name: 'Merchandiser', description: 'Styles, customers, costing' },
  [UserRole.PRODUCTION_MANAGER]: { name: 'Production Manager', description: 'Production tracking, work orders' },
  [UserRole.SALES]: { name: 'Sales', description: 'Orders, quotations, customers' },
  [UserRole.ACCOUNTS]: { name: 'Accounts', description: 'Invoices, payments, finance' },
  [UserRole.INVENTORY]: { name: 'Inventory', description: 'Stock management' },
  [UserRole.QUALITY]: { name: 'Quality', description: 'Inspections, testing' },
  [UserRole.PURCHASE]: { name: 'Purchase', description: 'POs, suppliers, procurement' },
  [UserRole.FACTORY_SUPERVISOR]: { name: 'Factory Supervisor', description: 'Shop floor operations' },
};
