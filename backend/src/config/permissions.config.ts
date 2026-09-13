/**
 * Permission catalogue + "Reset to Defaults" values.
 *
 * WHAT DECIDES ACCESS AT RUNTIME IS THE `role_permissions` TABLE, edited on the Permissions page —
 * not this file. This file is only:
 *   1. the CATALOGUE of permission keys (what the page shows, what `requirePermission()` accepts),
 *   2. the DEFAULT grants the page's "Reset to Defaults" button converges the table to, and the
 *      fallback used if the table cannot be read.
 *
 * ADMIN always passes every check (see `requirePermission` in auth.middleware.ts) — its column
 * here and in the table is informational.
 *
 * The frontend has NO copy of the grants: it receives the signed-in user's granted keys from
 * `/auth/login` and `/auth/me`. Its `PERMISSION_KEYS` list must match the keys here —
 * `permission-catalogue-parity.test.ts` fails when they drift.
 */

import { UserRole } from '@prisma/client';

const { ADMIN, MERCHANDISER, PRODUCTION_MANAGER, SALES, INVENTORY, ACCOUNTS, QUALITY, PURCHASE, FACTORY_SUPERVISOR } =
  UserRole;

// All roles for convenience
const ALL_ROLES: UserRole[] = [
  ADMIN,
  MERCHANDISER,
  PRODUCTION_MANAGER,
  SALES,
  INVENTORY,
  ACCOUNTS,
  QUALITY,
  PURCHASE,
  FACTORY_SUPERVISOR,
];

/**
 * Default grants per permission key (the "Reset to Defaults" state).
 */
export const PERMISSIONS = {
  // Dashboard - Available to all authenticated users
  dashboard: ALL_ROLES,
  processGuide: ALL_ROLES,
  aiAssistant: ALL_ROLES,
  aiSettings: [ADMIN],
  aiInsights: [ADMIN],
  issueReports: ALL_ROLES,

  // Production Status
  productionStatus: [ADMIN, PRODUCTION_MANAGER, MERCHANDISER, FACTORY_SUPERVISOR],

  // Styles & CAD Planning
  styles: [ADMIN, MERCHANDISER, PRODUCTION_MANAGER, SALES],
  cadPlanning: [ADMIN, MERCHANDISER, PRODUCTION_MANAGER],
  costSheets: [ADMIN, MERCHANDISER, ACCOUNTS],

  // Testing/Quality
  testing: [ADMIN, QUALITY, PRODUCTION_MANAGER, MERCHANDISER],

  // Orders & Planning
  orders: [ADMIN, MERCHANDISER, SALES, PRODUCTION_MANAGER],
  workOrders: [ADMIN, MERCHANDISER, PRODUCTION_MANAGER, FACTORY_SUPERVISOR],
  bom: [ADMIN, MERCHANDISER, PRODUCTION_MANAGER],
  mrp: [ADMIN, MERCHANDISER, PRODUCTION_MANAGER, INVENTORY, PURCHASE],

  // Manufacturing
  samples: [ADMIN, MERCHANDISER, PRODUCTION_MANAGER, QUALITY],
  manufacturing: [ADMIN, PRODUCTION_MANAGER, FACTORY_SUPERVISOR],
  printing: [ADMIN, PRODUCTION_MANAGER, FACTORY_SUPERVISOR],
  dyeing: [ADMIN, PRODUCTION_MANAGER, FACTORY_SUPERVISOR],
  cutting: [ADMIN, PRODUCTION_MANAGER, FACTORY_SUPERVISOR],
  stitching: [ADMIN, PRODUCTION_MANAGER, FACTORY_SUPERVISOR],
  finishing: [ADMIN, PRODUCTION_MANAGER, FACTORY_SUPERVISOR, QUALITY],
  challans: [ADMIN, PRODUCTION_MANAGER, FACTORY_SUPERVISOR, INVENTORY],
  dispatch: [ADMIN, PRODUCTION_MANAGER, FACTORY_SUPERVISOR, INVENTORY],
  jobWork: [ADMIN, PRODUCTION_MANAGER, PURCHASE],
  processingBatches: [ADMIN, PRODUCTION_MANAGER, FACTORY_SUPERVISOR],

  // Inventory
  inventoryDashboard: [ADMIN, INVENTORY, PRODUCTION_MANAGER, PURCHASE],
  stockLevels: [ADMIN, INVENTORY, PRODUCTION_MANAGER, PURCHASE, FACTORY_SUPERVISOR],
  stockCounts: [ADMIN, INVENTORY],
  stockMovements: [ADMIN, INVENTORY, FACTORY_SUPERVISOR],
  greigeFabricStock: [ADMIN, INVENTORY, PRODUCTION_MANAGER, PURCHASE],
  embroideryStock: [ADMIN, INVENTORY, PRODUCTION_MANAGER],

  // Procurement
  purchaseOrders: [ADMIN, PURCHASE, MERCHANDISER],
  grn: [ADMIN, PURCHASE, INVENTORY],
  materialRequirements: [ADMIN, PURCHASE, MERCHANDISER, PRODUCTION_MANAGER],

  // Masters
  masterData: ALL_ROLES,
  customers: [ADMIN, MERCHANDISER, SALES, ACCOUNTS],
  suppliers: [ADMIN, PURCHASE, ACCOUNTS],
  fabricMasters: [ADMIN, MERCHANDISER, INVENTORY, PURCHASE],
  trimMasters: [ADMIN, MERCHANDISER, INVENTORY, PURCHASE],
  componentMasters: [ADMIN, MERCHANDISER],
  colorMaster: [ADMIN, MERCHANDISER, PRODUCTION_MANAGER],
  seasonMaster: [ADMIN, MERCHANDISER],
  sizeCategoryMaster: [ADMIN, MERCHANDISER],
  productCategories: [ADMIN, MERCHANDISER],
  warehouses: [ADMIN, INVENTORY],

  // Reports & Finance
  reports: [ADMIN, MERCHANDISER, PRODUCTION_MANAGER, ACCOUNTS],
  chartOfAccounts: [ADMIN, ACCOUNTS],
  invoices: [ADMIN, ACCOUNTS, SALES],
  quotations: [ADMIN, SALES, MERCHANDISER],
  financialMasters: [ADMIN, ACCOUNTS],
  creditDebitNotes: [ADMIN, ACCOUNTS],

  // Messaging (per-user WhatsApp) - available to all authenticated staff
  whatsapp: ALL_ROLES,
  messaging: ALL_ROLES,

  // Admin
  users: [ADMIN],
  admin: [ADMIN],
  permissions: [ADMIN],
  overrideHistory: [ADMIN],
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

/** Every key in the catalogue, in declaration order. */
export const PERMISSION_KEYS = Object.keys(PERMISSIONS) as PermissionKey[];

export function isPermissionKey(value: unknown): value is PermissionKey {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PERMISSIONS, value);
}

/** "costSheets" → "Cost Sheets" — the name the Permissions page shows and 403 messages use. */
export function formatPermissionName(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

/**
 * DEFAULT grant check (config only — NOT what the API enforces).
 * Use `PermissionService.hasPermission` for the live answer.
 */
export function hasDefaultPermission(role: string | undefined, permissionKey: PermissionKey): boolean {
  if (!role) return false;
  const allowedRoles = PERMISSIONS[permissionKey];
  return (allowedRoles as readonly string[]).includes(role);
}

/**
 * DEFAULT grants for a role (config only — NOT what the API enforces).
 */
export function getDefaultPermissionsForRole(role: UserRole): PermissionKey[] {
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
 * Group permissions by module for UI display. Every catalogue key must appear in exactly one
 * group — `permission-catalogue-parity.test.ts` checks this.
 */
export const PERMISSION_GROUPS: Record<keyof typeof MODULES, PermissionKey[]> = {
  DASHBOARD: [
    'dashboard',
    'processGuide',
    'productionStatus',
    'aiAssistant',
    'aiSettings',
    'aiInsights',
    'issueReports',
  ],
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
    'challans',
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
    'seasonMaster',
    'sizeCategoryMaster',
    'productCategories',
    'warehouses',
  ],
  FINANCE: ['reports', 'chartOfAccounts', 'invoices', 'quotations', 'financialMasters', 'creditDebitNotes'],
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
