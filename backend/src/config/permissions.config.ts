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
 * NOTE: Temporarily set to ALL_ROLES for all features (full access mode)
 */
export const PERMISSIONS = {
  // Dashboard - Available to all authenticated users
  dashboard: ALL_ROLES,
  processGuide: ALL_ROLES,
  aiAssistant: ALL_ROLES,
  aiInsights: [UserRole.ADMIN],

  // Production Status
  productionStatus: ALL_ROLES,

  // Styles & CAD Planning
  styles: ALL_ROLES,
  cadPlanning: ALL_ROLES,
  costSheets: ALL_ROLES,

  // Testing/Quality
  testing: ALL_ROLES,

  // Orders & Planning
  orders: ALL_ROLES,
  workOrders: ALL_ROLES,
  bom: ALL_ROLES,
  mrp: ALL_ROLES,

  // Manufacturing
  samples: ALL_ROLES,
  manufacturing: ALL_ROLES,
  printing: ALL_ROLES,
  dyeing: ALL_ROLES,
  cutting: ALL_ROLES,
  stitching: ALL_ROLES,
  finishing: ALL_ROLES,
  dispatch: ALL_ROLES,
  jobWork: ALL_ROLES,
  processingBatches: ALL_ROLES,

  // Inventory
  inventoryDashboard: ALL_ROLES,
  stockLevels: ALL_ROLES,
  stockCounts: ALL_ROLES,
  stockMovements: ALL_ROLES,
  greigeFabricStock: ALL_ROLES,
  embroideryStock: ALL_ROLES,

  // Procurement
  purchaseOrders: ALL_ROLES,
  grn: ALL_ROLES,
  materialRequirements: ALL_ROLES,

  // Masters
  masterData: ALL_ROLES,
  customers: ALL_ROLES,
  suppliers: ALL_ROLES,
  fabricMasters: ALL_ROLES,
  trimMasters: ALL_ROLES,
  componentMasters: ALL_ROLES,
  colorMaster: ALL_ROLES,
  sizeCategoryMaster: ALL_ROLES,
  productCategories: ALL_ROLES,
  warehouses: ALL_ROLES,

  // Reports & Finance
  reports: ALL_ROLES,
  chartOfAccounts: ALL_ROLES,
  invoices: ALL_ROLES,
  quotations: ALL_ROLES,

  // Messaging (per-user WhatsApp) - available to all authenticated staff
  whatsapp: ALL_ROLES,
  messaging: ALL_ROLES,

  // Admin - now open to all
  users: ALL_ROLES,
  admin: ALL_ROLES,
  permissions: ALL_ROLES,
  overrideHistory: ALL_ROLES,
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
  MESSAGING: { name: 'Messaging', description: 'WhatsApp linking and internal staff messaging' },
  ADMIN: { name: 'Admin', description: 'User and permission management' },
} as const;

/**
 * Group permissions by module for UI display
 */
export const PERMISSION_GROUPS: Record<keyof typeof MODULES, PermissionKey[]> = {
  DASHBOARD: ['dashboard', 'processGuide', 'productionStatus', 'aiAssistant', 'aiInsights'],
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
  MESSAGING: ['whatsapp', 'messaging'],
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
