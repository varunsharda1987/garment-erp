"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RELATION_MAPPINGS = void 0;
exports.toCamelCase = toCamelCase;
exports.toSnakeCase = toSnakeCase;
exports.applyRelationMappings = applyRelationMappings;
exports.serialize = serialize;
exports.deserialize = deserialize;
const humps = __importStar(require("humps"));
/**
 * Transforms database/Prisma response from snake_case to camelCase
 * Handles:
 * - Field names (already mostly camelCase from Prisma)
 * - Relation names (snake_case table names -> camelCase)
 * - Nested objects and arrays
 */
function toCamelCase(data) {
    if (data === null || data === undefined) {
        return data;
    }
    // Handle arrays
    if (Array.isArray(data)) {
        return data.map(item => toCamelCase(item));
    }
    // Handle objects
    if (typeof data === 'object' && data.constructor === Object) {
        // First convert all keys to camelCase
        const camelized = humps.camelizeKeys(data);
        // Then manually handle special Prisma relation names
        const result = {};
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
        return result;
    }
    // Return primitive values as-is
    return data;
}
/**
 * Transforms frontend request from camelCase to snake_case
 * Used for query parameters or special cases where backend expects snake_case
 */
function toSnakeCase(data) {
    if (data === null || data === undefined) {
        return data;
    }
    // Handle arrays
    if (Array.isArray(data)) {
        return data.map(item => toSnakeCase(item));
    }
    // Handle objects
    if (typeof data === 'object' && data.constructor === Object) {
        return humps.decamelizeKeys(data);
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
exports.RELATION_MAPPINGS = {
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
function applyRelationMappings(data) {
    if (data === null || data === undefined) {
        return data;
    }
    if (Array.isArray(data)) {
        return data.map(item => applyRelationMappings(item));
    }
    if (typeof data === 'object' && data.constructor === Object) {
        const result = {};
        const debugEnabled = process.env.DEBUG_TRANSFORM === 'true';
        for (const [key, value] of Object.entries(data)) {
            // Check if this key has a custom mapping
            const mappedKey = exports.RELATION_MAPPINGS[key] || key;
            if (debugEnabled && mappedKey !== key) {
                console.log(`  [Mapping] ${key} → ${mappedKey}`);
            }
            // Recursively apply mappings to nested objects
            result[mappedKey] = applyRelationMappings(value);
        }
        return result;
    }
    return data;
}
/**
 * Main serializer: Combines camelCase conversion and relation mapping
 */
function serialize(data) {
    const camelized = toCamelCase(data);
    return applyRelationMappings(camelized);
}
/**
 * Deserializer: Converts camelCase to snake_case for database operations
 */
function deserialize(data) {
    return toSnakeCase(data);
}
