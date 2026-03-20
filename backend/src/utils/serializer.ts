import * as humps from 'humps';
import { Decimal } from '@prisma/client/runtime/library';
import { logDebug } from './logger';

/**
 * Generic type for serializable data
 */
type SerializableValue = string | number | boolean | null | undefined | SerializableObject | SerializableArray;
interface SerializableObject { [key: string]: SerializableValue }
type SerializableArray = SerializableValue[];

/**
 * Check if a value is a Prisma Decimal object
 * Prisma Decimal has toNumber(), toString(), and other methods
 */
function isPrismaDecimal(value: unknown): value is Decimal {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  // Check for Decimal instance or duck-type check for toNumber method
  return value instanceof Decimal ||
         (typeof (value as Decimal).toNumber === 'function' &&
          typeof (value as Decimal).toString === 'function');
}

/**
 * Convert Prisma Decimal to number
 */
function convertDecimal(value: Decimal): number {
  // Use toNumber() if available, otherwise parse toString()
  if (typeof value.toNumber === 'function') {
    return value.toNumber();
  }
  return parseFloat(value.toString());
}

/**
 * Check if a string is a UUID (v4 format with hyphens)
 * UUIDs should not be transformed by humps.camelizeKeys
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

/**
 * Recursively convert all Prisma Decimal values to numbers and BigInt to numbers in an object tree
 * This must be done BEFORE humps.camelizeKeys to prevent Decimal/BigInt objects from being serialized
 */
function convertAllDecimals(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  // Convert BigInt to number (PostgreSQL COUNT returns bigint)
  if (typeof data === 'bigint') {
    return Number(data);
  }

  // Convert Decimal to number
  if (isPrismaDecimal(data)) {
    return convertDecimal(data);
  }

  // Keep Date objects as-is
  if (data instanceof Date) {
    return data;
  }

  // Recursively process arrays
  if (Array.isArray(data)) {
    return data.map(item => convertAllDecimals(item));
  }

  // Recursively process plain objects
  if (typeof data === 'object' && data.constructor === Object) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      result[key] = convertAllDecimals(value);
    }
    return result;
  }

  // Return primitives as-is
  return data;
}

/**
 * Transforms database/Prisma response from snake_case to camelCase
 * Handles:
 * - Field names (already mostly camelCase from Prisma)
 * - Relation names (snake_case table names -> camelCase)
 * - Nested objects and arrays
 */
export function toCamelCase<T = unknown>(data: unknown): T {
  if (data === null || data === undefined) {
    return data as T;
  }

  // Handle BigInt - convert to number (PostgreSQL COUNT returns bigint)
  if (typeof data === 'bigint') {
    return Number(data) as T;
  }

  // Handle Prisma Decimal objects - convert to number
  if (isPrismaDecimal(data)) {
    return convertDecimal(data) as T;
  }

  // Handle Date objects - keep as-is
  if (data instanceof Date) {
    return data as T;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => toCamelCase(item)) as T;
  }

  // Handle objects (but not special objects like Decimal)
  if (typeof data === 'object' && data.constructor === Object) {
    // First, RECURSIVELY convert ALL Decimal values in the entire tree BEFORE humps runs
    // This is necessary because humps.camelizeKeys processes the entire tree and
    // serializes Decimal objects to plain {s, e, d} objects
    const decimalsConverted = convertAllDecimals(data);

    // Now convert all keys to camelCase (safe because all Decimals are now numbers)
    // Use process option to preserve UUID keys (humps would otherwise remove hyphens)
    const camelizeOptions = {
      process: (key: string, convert: (key: string) => string) => {
        // Don't convert UUID keys - they should remain as-is
        return isUUID(key) ? key : convert(key);
      }
    };
    const camelized = (humps.camelizeKeys as Function)(
      decimalsConverted as Record<string, unknown>,
      camelizeOptions
    ) as Record<string, unknown>;

    // Then manually handle special Prisma relation names
    const result: Record<string, unknown> = {};
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
  return data as T;
}

/**
 * Transforms frontend request from camelCase to snake_case
 * Used for query parameters or special cases where backend expects snake_case
 */
export function toSnakeCase<T = unknown>(data: unknown): T {
  if (data === null || data === undefined) {
    return data as T;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => toSnakeCase(item)) as T;
  }

  // Handle objects
  if (typeof data === 'object' && data.constructor === Object) {
    return humps.decamelizeKeys(data as Record<string, unknown>) as T;
  }

  // Return primitive values as-is
  return data as T;
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
  styleValueAdditions: 'valueAdditions',
  stylePackaging: 'packaging',
  styleFabrics: 'fabrics',
  stylePatternParts: 'patternParts',
  styleAccessories: 'accessories',
  colorOptions: 'colors',
  sizeOptions: 'sizes',
  styleVariants: 'styleVariants',
  styleMaterialBom: 'styleMaterialBom',
  seasonMaster: 'seasonMaster', // Season master reference (styles.seasonId -> season_master)

  // Order relations
  customers: 'customer', // Singular for single relation (used in orders, invoices, quotations)
  // Note: orderItems kept as-is (not renamed to 'items') to match frontend type expectations
  orderItemBreakup: 'breakup',

  // Style relations (when referenced from other models)
  styles: 'style', // Singular for single relation (used in order_items, work_orders)

  // Work Order relations
  workOrders: 'workOrders',
  workOrderBreakup: 'breakup',

  // Supplier relations
  suppliers: 'supplier', // Singular for single relation (used in GRN, PO, materials)
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

  // Lace relations (junction table -> frontend friendly name)
  laceSuppliers: 'suppliers',
  sourceGreigeLace: 'sourceGreigeLace',
  finishedLaces: 'finishedLaces',
  laceStock: 'laceStock',
  laceLabDips: 'laceLabDips',
  greigeLace: 'greigeLace',
  laceItems: 'laceItems',
  laceCostingItems: 'laceCostingItems',
  laceAllocations: 'laceAllocations',
  laceIssueNotes: 'laceIssueNotes',
  laceStockOrigins: 'laceStockOrigins',
  laceDefectsDiscovered: 'laceDefectsDiscovered',
  styleCostingLaceItems: 'laceItems', // style_costing_lace_items -> laceItems
  lace: 'lace', // lace_master via laceId
  processor: 'processor', // suppliers via processorId
  labDip: 'labDip', // lace_lab_dip via labDipId
  rateCard: 'rateCard', // processor_rate_card via rateCardId

  // User & Audit relations
  users: 'users',
  auditLogs: 'auditLogs',
  notifications: 'notifications',
  payments: 'payments',

  // Customer relations
  brandCategories: 'brandCategories',
  customerGstNumbers: 'customerGstNumbers',
  customersBilling: 'billing',
  customersShipping: 'shipping',

  // Supplier relations
  suppliersBilling: 'billing',
  suppliersShipping: 'shipping',
  supplierGstBilling: 'gstBilling',

  // Location & Address relations
  locations: 'locations',
  billingCity: 'billingCity',
  billingState: 'billingState',
  shippingCity: 'shippingCity',
  shippingState: 'shippingState',
  invoicesPlaceOfSupply: 'placeOfSupply',
  quotationsPlaceOfSupply: 'placeOfSupply',
  customerGstBilling: 'gstBilling',

  // Material Master relations
  greigeMaster: 'greigeMaster',
  fabricMaster: 'fabricMaster',
  laceMaster: 'laceMaster',
  buttonMaster: 'buttonMaster',
  threadMaster: 'threadMaster',
  zipperMaster: 'zipperMaster',
  elasticMaster: 'elasticMaster',
  labelMaster: 'labelMaster',
  packagingMaster: 'packagingMaster',
  labelSizeVariant: 'labelSizeVariant',
  machinePartMaster: 'machinePartMaster',
  otherMaterialMaster: 'otherMaterialMaster',
  colorMaster: 'colorMaster',

  // Accessory & Preset relations
  customerAccessoryPresetItems: 'presetItems',

  // Order Costing relations
  orderItemCostings: 'costings',

  // Product Category relations
  productCategory: 'productCategory',

  // Material Requirements
  materialRequirements: 'materialRequirements',
  materialRequirementsPreferred: 'preferredSupplier',

  // Lab Dips & Job Work
  labDipsMill: 'mill',
  jobWorkOrders: 'jobWorkOrders',
  jobWorkOrder: 'jobWorkOrder',
  greigeStockLot: 'greigeStockLot',

  // Testing & Quality
  testingLabs: 'testingLabs',
  testTemplates: 'testTemplates',
  fabricPhysicalTests: 'fabricPhysicalTests',
  garmentPhysicalTests: 'garmentPhysicalTests',
  orderSamples: 'orderSamples',
  orderInspections: 'orderInspections',

  // Order BOM user relations
  usersOrderBomApprovedByIdTousers: 'approvedBy',
  usersOrderBomCreatedByIdTousers: 'createdBy',

  // User relation mappings (verbose Prisma names -> simplified)
  // These are in addition to the automatic pattern matching in toCamelCase()
  usersBillOfMaterialsApprovedByIdTousers: 'approvedBy',
  usersBillOfMaterialsCreatedByIdTousers: 'createdBy',
  usersGoodsReceivingNotesApprovedByIdTousers: 'approvedBy',
  usersGoodsReceivingNotesReceivedByIdTousers: 'receivedBy',
  usersMaterialRequisitionsIssuedByIdTousers: 'issuedBy',
  usersMaterialRequisitionsReceivedByIdTousers: 'receivedBy',
  usersOrdersApprovedByIdTousers: 'approvedBy',
  usersOrdersCreatedByIdTousers: 'createdBy',
  usersPurchaseOrdersApprovedByIdTousers: 'approvedBy',
  usersPurchaseOrdersCreatedByIdTousers: 'createdBy',
  usersPurchaseOrdersUserIdTousers: 'user',
  usersQualityInspectionsApprovedByIdTousers: 'approvedBy',
  usersQualityInspectionsInspectedByIdTousers: 'inspectedBy',
  usersQualityInspectionsUserIdTousers: 'user',
  usersQuotationsApprovedByIdTousers: 'approvedBy',
  usersQuotationsCreatedByIdTousers: 'createdBy',
  usersStyleCostingApprovedByIdTousers: 'approvedBy',
  usersStyleCostingCreatedByIdTousers: 'createdBy',
  usersWorkOrdersApprovedByIdTousers: 'approvedBy',
  usersWorkOrdersCreatedByIdTousers: 'createdBy',
  usersWorkOrdersUserIdTousers: 'user',

  // Production & Manufacturing user relations
  greigeMastersCreated: 'createdBy',
  fabricMastersCreated: 'createdBy',
  fabricWidthCadsCreated: 'createdBy',
  materialRequirementsCreated: 'createdBy',
  cuttingBatchesOperated: 'operatedBy',
  cuttingBatchesCreated: 'createdBy',
  transferSlipsPrepared: 'preparedBy',
  transferSlipsReceived: 'receivedBy',
  stitchingIssuesManaged: 'managedBy',
  stitchingIssuesCreated: 'createdBy',
  finishingIssuesManaged: 'managedBy',
  finishingIssuesCreated: 'createdBy',
  qualityInspectionsMfgInspector: 'inspector',
  qualityInspectionsMfgApprover: 'approver',
  labDipsApproved: 'approvedBy',
  labDipsCreated: 'createdBy',
  testingLabsCreated: 'createdBy',
  testTemplatesCreated: 'createdBy',
  fabricPhysicalTestsCreated: 'createdBy',
  fabricPhysicalTestsApproved: 'approvedBy',
  garmentPhysicalTestsCreated: 'createdBy',
  garmentPhysicalTestsApproved: 'approvedBy',
  orderSamplesCreated: 'createdBy',
  orderInspectionsDone: 'inspectedBy',
};

/**
 * Apply custom relation mappings to already camelized data
 */
export function applyRelationMappings<T = unknown>(data: unknown): T {
  if (data === null || data === undefined) {
    return data as T;
  }

  if (Array.isArray(data)) {
    return data.map(item => applyRelationMappings(item)) as T;
  }

  if (typeof data === 'object' && data.constructor === Object) {
    const result: Record<string, unknown> = {};
    const debugEnabled = process.env.DEBUG_TRANSFORM === 'true';

    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      // Check if this key has a custom mapping
      const mappedKey = RELATION_MAPPINGS[key] || key;

      if (debugEnabled && mappedKey !== key) {
        logDebug(`  [Mapping] ${key} → ${mappedKey}`);
      }

      // Recursively apply mappings to nested objects
      result[mappedKey] = applyRelationMappings(value);
    }

    return result as T;
  }

  return data as T;
}

/**
 * Main serializer: Combines camelCase conversion and relation mapping
 *
 * IMPORTANT: This converts ALL snake_case keys to camelCase!
 * Frontend must use camelCase when accessing nested relations.
 * Example: brand_categories -> brandCategories
 *          style_components -> styleComponents
 */
export function serialize<T = unknown>(data: unknown): T {
  const camelized = toCamelCase(data);
  return applyRelationMappings(camelized);
}

/**
 * Deserializer: Converts camelCase to snake_case for database operations
 */
export function deserialize<T = unknown>(data: unknown): T {
  return toSnakeCase(data);
}

// ============================================
// DEV-MODE SERIALIZER DIAGNOSTICS
// ============================================

/**
 * Validate RELATION_MAPPINGS for collisions at startup (dev mode only).
 * Multiple source keys mapping to the same target key causes silent data loss.
 *
 * Enable: Set environment variable SERIALIZER_VALIDATE=true
 *
 * Known safe collisions (contextually unique - never appear on the same object):
 *   - 'items' (purchaseOrderItems, grnItems, bomItems, quotationItems, etc.)
 *   - 'billing'/'shipping' (customersBilling, suppliersBilling, etc.)
 *   - 'breakup' (orderItemBreakup, workOrderBreakup)
 *   - 'createdBy'/'approvedBy' (various verbose user relations)
 */
const KNOWN_SAFE_COLLISIONS = new Set([
  'items', 'billing', 'shipping', 'breakup', 'createdBy', 'approvedBy',
  'receivedBy', 'issuedBy', 'user', 'inspectedBy', 'operatedBy',
  'managedBy', 'preparedBy', 'inspector', 'approver', 'category',
  'paymentTerms', 'placeOfSupply', 'gstBilling', 'laceItems', 'supplier',
  'suppliers',
]);

function validateRelationMappings(): void {
  const targetToSources = new Map<string, string[]>();

  for (const [source, target] of Object.entries(RELATION_MAPPINGS)) {
    const sources = targetToSources.get(target) || [];
    sources.push(source);
    targetToSources.set(target, sources);
  }

  const collisions: Array<{ target: string; sources: string[] }> = [];
  for (const [target, sources] of targetToSources.entries()) {
    if (sources.length > 1 && !KNOWN_SAFE_COLLISIONS.has(target)) {
      collisions.push({ target, sources });
    }
  }

  if (collisions.length > 0) {
    console.warn('\n[Serializer] RELATION_MAPPINGS collision warnings:');
    for (const { target, sources } of collisions) {
      console.warn(`  Target "${target}" <- [${sources.join(', ')}]`);
      console.warn(`    These keys will overwrite each other if on the same object!`);
    }
    console.warn('[Serializer] Add safe collisions to KNOWN_SAFE_COLLISIONS set if intentional.\n');
  }
}

// Run validation at startup in development
if (process.env.NODE_ENV !== 'production' && process.env.SERIALIZER_VALIDATE === 'true') {
  validateRelationMappings();
}

/**
 * Get a lookup table of all RELATION_MAPPINGS for debugging.
 * Useful for frontend developers to see what key names the API will use.
 *
 * Usage: import { getSerializerCheatSheet } from './serializer';
 *        console.table(getSerializerCheatSheet());
 */
export function getSerializerCheatSheet(): Array<{
  prismaRelation: string;
  afterCamelCase: string;
  finalFrontendKey: string;
  isRenamed: boolean;
}> {
  return Object.entries(RELATION_MAPPINGS).map(([camelKey, frontendKey]) => ({
    prismaRelation: camelKey.replace(/([A-Z])/g, '_$1').toLowerCase(),
    afterCamelCase: camelKey,
    finalFrontendKey: frontendKey,
    isRenamed: camelKey !== frontendKey,
  }));
}
