import * as humps from 'humps';

/**
 * Transforms database/Prisma response from snake_case to camelCase
 * Handles:
 * - Field names (already mostly camelCase from Prisma)
 * - Relation names (snake_case table names -> camelCase)
 * - Nested objects and arrays
 */
export function toCamelCase<T = any>(data: any): T {
  if (data === null || data === undefined) {
    return data;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => toCamelCase(item)) as T;
  }

  // Handle objects
  if (typeof data === 'object' && data.constructor === Object) {
    // First convert all keys to camelCase
    const camelized = humps.camelizeKeys(data);

    // Then manually handle special Prisma relation names
    const result: any = {};
    for (const [key, value] of Object.entries(camelized)) {
      // Handle Prisma's verbose relation names
      // Examples:
      //   "usersOrdersCreatedByIdTousers" -> "createdBy"
      //   "usersPurchaseOrdersApprovedByIdTousers" -> "approvedBy"
      //   "usersWorkOrdersUserIdTousers" -> "user"
      if (key.match(/^[a-z]+.*To[a-z]+$/i)) {
        // Extract the middle part (the actual field name)
        // Pattern: {tableName}_{relationName}_{fieldName}IdTo{tableName}
        // After camelization: tableName + RelationName + fieldName + IdToTableName

        // Common patterns:
        // 1. usersOrdersCreatedByIdTousers -> createdBy
        // 2. billOfMaterialsApprovedByIdTousers -> approvedBy
        // 3. usersWorkOrdersUserIdTousers -> user

        const verboseMatch = key.match(/([A-Z][a-z]+By)IdTo/);
        if (verboseMatch) {
          // Extract "CreatedBy", "ApprovedBy", etc. and convert to camelCase
          const fieldName = verboseMatch[1].charAt(0).toLowerCase() + verboseMatch[1].slice(1);
          result[fieldName] = toCamelCase(value);
          continue;
        }

        // Handle pattern like "userIdTousers" -> "user"
        const simpleMatch = key.match(/([A-Z][a-z]+)IdTo/);
        if (simpleMatch) {
          const fieldName = simpleMatch[1].charAt(0).toLowerCase() + simpleMatch[1].slice(1);
          result[fieldName] = toCamelCase(value);
          continue;
        }
      }

      // Recursively transform nested objects
      result[key] = toCamelCase(value);
    }

    return result as T;
  }

  // Return primitive values as-is
  return data;
}

/**
 * Transforms frontend request from camelCase to snake_case
 * Used for query parameters or special cases where backend expects snake_case
 */
export function toSnakeCase<T = any>(data: any): T {
  if (data === null || data === undefined) {
    return data;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => toSnakeCase(item)) as T;
  }

  // Handle objects
  if (typeof data === 'object' && data.constructor === Object) {
    return humps.decamelizeKeys(data) as T;
  }

  // Return primitive values as-is
  return data;
}

/**
 * Common relation name mappings for better clarity
 * Maps camelCase Prisma relation names to frontend-friendly names
 * NOTE: These mappings are applied AFTER toCamelCase, so use camelCase keys
 *
 * IMPORTANT: When adding new Prisma includes, add the mapping here if the
 * relation name should be simplified for the frontend.
 */
export const RELATION_MAPPINGS: Record<string, string> = {
  // Material relations
  materialCategories: 'category',
  inventoryStock: 'inventoryStock',

  // Style relations
  styleCategories: 'category',
  styleComponents: 'components',
  styleProcesses: 'processes',
  styleCosting: 'costing',
  styleProductionTracking: 'productionTracking',
  styleGarmentTrims: 'garmentTrims',
  styleValueAdditions: 'valueAdditions',
  stylePackaging: 'packaging',
  styleFabrics: 'fabrics',
  styleAccessories: 'accessories',
  colorOptions: 'colors',
  sizeOptions: 'sizes',

  // Order relations
  orderItems: 'items',
  orderItemBreakup: 'breakup',

  // Work Order relations
  workOrders: 'workOrders',
  workOrderBreakup: 'breakup',

  // Supplier relations
  supplierContacts: 'contacts',
  paymentTermsRel: 'paymentTerms', // Note: payment_terms_rel -> paymentTermsRel -> paymentTerms

  // Purchase Order relations
  purchaseOrders: 'purchaseOrders',
  purchaseOrderItems: 'items',

  // GRN (Goods Receiving Notes) relations
  goodsReceivingNotes: 'goodsReceivingNotes',
  grnItems: 'items',

  // BOM (Bill of Materials) relations
  billOfMaterials: 'billOfMaterials',
  bomItems: 'items',

  // Inventory & Stock relations
  stockLevels: 'stockLevels',
  stockMovements: 'stockMovements',
  stockReservations: 'stockReservations',
  stockTransactions: 'stockTransactions',
  stockCounts: 'stockCounts',
  stockCountItems: 'items',
  finishedGoodsStock: 'finishedGoodsStock',

  // Warehouse relations
  warehouses: 'warehouses',

  // Delivery & Invoice relations
  deliveryNotes: 'deliveryNotes',
  deliveryNoteItems: 'items',
  invoices: 'invoices',

  // Quality relations
  qualityInspections: 'qualityInspections',
  qualityDefects: 'defects',

  // Production relations
  productionTracking: 'productionTracking',
  materialRequisitions: 'materialRequisitions',
  materialRequisitionItems: 'items',

  // Financial relations
  paymentTerms: 'paymentTerms',
  bankAccounts: 'bankAccounts',
  chartOfAccounts: 'chartOfAccounts',
  costCenters: 'costCenters',
  taxMasters: 'taxMasters',
  expenseTypes: 'expenseTypes',
  currencies: 'currencies',
  exchangeRates: 'exchangeRates',
  exportTemplates: 'exportTemplates',

  // Quotation & Sample relations
  quotations: 'quotations',
  quotationItems: 'items',
  samples: 'samples',

  // User & Audit relations
  users: 'users',
  auditLogs: 'auditLogs',
  notifications: 'notifications',
  payments: 'payments',

  // Location relations
  locations: 'locations',
};

/**
 * Apply custom relation mappings to already camelized data
 */
export function applyRelationMappings<T = any>(data: any): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => applyRelationMappings(item)) as T;
  }

  if (typeof data === 'object' && data.constructor === Object) {
    const result: any = {};
    const debugEnabled = process.env.DEBUG_TRANSFORM === 'true';

    for (const [key, value] of Object.entries(data)) {
      // Check if this key has a custom mapping
      const mappedKey = RELATION_MAPPINGS[key] || key;

      if (debugEnabled && mappedKey !== key) {
        console.log(`  [Mapping] ${key} → ${mappedKey}`);
      }

      // Recursively apply mappings to nested objects
      result[mappedKey] = applyRelationMappings(value);
    }

    return result as T;
  }

  return data;
}

/**
 * Main serializer: Combines camelCase conversion and relation mapping
 */
export function serialize<T = any>(data: any): T {
  const camelized = toCamelCase(data);
  return applyRelationMappings(camelized);
}

/**
 * Deserializer: Converts camelCase to snake_case for database operations
 */
export function deserialize<T = any>(data: any): T {
  return toSnakeCase(data);
}
