/**
 * E2E Test Configuration
 * Centralized configuration for timeouts, URLs, and test settings
 */

export const TestConfig = {
  // Base URLs
  baseURL: process.env.TEST_BASE_URL || 'http://localhost:5173',
  apiURL: process.env.TEST_API_URL || 'http://localhost:5000/api',

  // Timeouts (in milliseconds)
  timeouts: {
    navigation: 10000,
    pageLoad: 15000,
    apiResponse: 10000,
    animation: 500,
    debounce: 300,
    toast: 5000,
    dialog: 3000,
    formSubmit: 10000,
    fileUpload: 30000,
  },

  // Default test credentials
  defaultUser: {
    email: 'admin@kashayafabs.com',
    password: 'Test@123',
    name: 'Admin User',
  },

  // Retry settings
  retries: {
    createOperation: 2,
    apiCall: 3,
  },

  // Screenshot settings
  screenshots: {
    enabled: true,
    path: 'test-results/screenshots',
    fullPage: true,
  },

  // Video settings
  video: {
    enabled: process.env.CI ? true : false,
    path: 'test-results/videos',
  },

  // Parallel execution
  parallel: {
    enabled: !process.env.CI,
    workers: 4,
  },
};

/**
 * Page Routes Configuration
 * Maps all pages to their routes and dependencies
 */
export const PageRoutes = {
  // Authentication
  login: '/login',
  register: '/register',

  // Dashboard
  dashboard: '/dashboard',
  productionDashboard: '/production-dashboard',
  stockDashboard: '/stock-dashboard',

  // User Management
  users: '/users',
  userCreate: '/users/new',
  userEdit: (id: string) => `/users/${id}/edit`,

  // Customer Management
  customers: '/customers',
  customerCreate: '/customers/new',
  customerDetail: (id: string) => `/customers/${id}`,
  customerEdit: (id: string) => `/customers/${id}/edit`,

  // Supplier Management
  suppliers: '/suppliers',
  supplierCreate: '/suppliers/new',
  supplierEdit: (id: string) => `/suppliers/${id}/edit`,

  // Material Management
  materials: '/materials',
  materialCreate: '/materials/new',
  materialEdit: (id: string) => `/materials/${id}/edit`,

  // Specialized Materials
  fabrics: '/fabrics',
  fabricCreate: '/fabrics/new',
  fabricDetail: (id: string) => `/fabrics/${id}`,
  greige: '/greige',
  greigeCreate: '/greige/new',
  lace: '/lace',
  laceCreate: '/lace/new',
  buttons: '/buttons',
  buttonCreate: '/buttons/new',
  threads: '/threads',
  threadCreate: '/threads/new',
  zippers: '/zippers',
  zipperCreate: '/zippers/new',
  elastics: '/elastics',
  elasticCreate: '/elastics/new',
  labels: '/labels',
  labelCreate: '/labels/new',
  packaging: '/packaging',
  packagingCreate: '/packaging/new',

  // Style Management
  styles: '/styles',
  styleCreate: '/styles/new',
  styleDetail: (id: string) => `/styles/${id}`,
  styleEdit: (id: string) => `/styles/${id}/edit`,
  styleBulkImport: '/styles/import',

  // Order Management
  orders: '/orders',
  orderCreate: '/orders/new',
  orderDetail: (id: string) => `/orders/${id}`,
  orderEdit: (id: string) => `/orders/${id}/edit`,

  // BOM & Costing
  bom: '/bom',
  bomCreate: '/bom/new',
  costSheets: '/cost-sheets',
  costSheetCreate: '/cost-sheets/new',

  // Procurement
  purchaseOrders: '/purchase-orders',
  purchaseOrderCreate: '/purchase-orders/new',
  purchaseOrderDetail: (id: string) => `/purchase-orders/${id}`,
  grn: '/grn',
  grnCreate: '/grn/new',
  grnDetail: (id: string) => `/grn/${id}`,

  // Warehouse & Inventory
  warehouses: '/warehouses',
  warehouseCreate: '/warehouses/new',
  stockLevels: '/stock-levels',
  stockMovements: '/stock-movements',
  stockIn: '/stock/in',
  stockOut: '/stock/out',
  stockTransfer: '/stock/transfer',
  stockAdjustment: '/stock/adjustment',
  stockCount: '/stock-count',

  // Production
  workOrders: '/work-orders',
  workOrderCreate: '/work-orders/new',

  // Reports & Tools
  componentMasters: '/component-masters',
  templates: '/templates',
  aiAssistant: '/ai-assistant',
};

/**
 * Entity Dependency Map
 * Defines what must exist before an entity can be created
 */
export const EntityDependencies = {
  // Level 0 - No dependencies
  user: [],
  warehouse: [],
  materialCategory: [],
  componentMaster: [],
  currency: [],
  taxMaster: [],
  paymentTerm: [],

  // Level 1 - Basic dependencies
  customer: [],
  supplier: [],
  material: ['materialCategory'],
  location: ['warehouse'],

  // Level 2 - Intermediate dependencies
  style: ['customer', 'componentMaster'],
  fabric: ['material', 'supplier'],
  greige: ['material', 'supplier'],
  purchaseOrder: ['supplier', 'material'],

  // Level 3 - Complex dependencies
  bom: ['style', 'material'],
  order: ['customer', 'style'],
  grn: ['purchaseOrder'],
  costSheet: ['style', 'bom'],

  // Level 4 - Highest level dependencies
  workOrder: ['order', 'location'],
  stockMovement: ['material', 'warehouse'],
  invoice: ['order'],
};

/**
 * Form Field Types
 * Standard field types found in forms
 */
export enum FieldType {
  TEXT = 'text',
  EMAIL = 'email',
  PASSWORD = 'password',
  NUMBER = 'number',
  DECIMAL = 'decimal',
  PHONE = 'phone',
  TEXTAREA = 'textarea',
  SELECT = 'select',
  MULTI_SELECT = 'multi-select',
  CHECKBOX = 'checkbox',
  RADIO = 'radio',
  DATE = 'date',
  DATETIME = 'datetime',
  FILE = 'file',
  IMAGE = 'image',
  GST = 'gst',
  CURRENCY = 'currency',
}

/**
 * Validation Rules
 * Common validation rules for fields
 */
export const ValidationRules = {
  required: 'required',
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^\d{10}$/,
  gst: /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/,
  decimal: /^\d+(\.\d{1,2})?$/,
  alphanumeric: /^[a-zA-Z0-9]+$/,
  code: /^[A-Z0-9-]+$/,
};

export default TestConfig;
