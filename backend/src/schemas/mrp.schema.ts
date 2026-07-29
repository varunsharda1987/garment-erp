/**
 * MRP (Material Requirement Planning) Validation Schemas
 *
 * Zod schemas for MRP endpoints.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// Enums (match Prisma enums)
// ============================================================================

export const MaterialRequirementStatusEnum = z.enum([
  'PENDING',
  'FULFILLED_STOCK',
  'PARTIAL_STOCK',
  'PO_REQUIRED',
  'PO_GENERATED',
  'PO_SENT',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'CANCELLED',
]);

export const RequirementSourceEnum = z.enum(['SALES_ORDER', 'WORK_ORDER', 'MANUAL']);

export const UnitEnum = z.enum([
  'PIECE',
  'METER',
  'YARD',
  'KILOGRAM',
  'GRAM',
  'CONE',
  'SPOOL',
  'ROLL',
  'BOX',
  'SET',
  'DOZEN',
  'GROSS',
  'LITER',
  'PAIR',
  'PACK',
  'TUBE',
]);

export const RequirementTypeEnum = z.enum(['MATERIAL', 'PROCESSING']);

// ============================================================================
// Calculation Schemas
// ============================================================================

/**
 * Calculate Requirements
 * POST /api/mrp/calculate
 */
export const calculateRequirementsSchema = z.object({
  orderId: z.string().uuid('Invalid order ID'),
  orderItemId: z.string().uuid('Invalid order item ID').optional(),
  requiredDate: z.string(),
  checkStock: z.boolean().optional().default(true),
});

// ============================================================================
// Manual Requirement Schemas
// ============================================================================

/**
 * Create Manual Requirement
 * POST /api/mrp/requirements
 */
export const createManualRequirementSchema = z.object({
  materialId: z.string().uuid('Invalid material ID'),
  quantity: z.number().positive('Quantity must be positive'),
  unit: UnitEnum,
  requiredDate: z.string(),
  preferredSupplierId: z.string().uuid('Invalid supplier ID').optional(),
  remarks: z.string().max(500).optional(),
});

// ============================================================================
// Stock Allocation Schemas
// ============================================================================

/**
 * Allocate Stock to Requirement
 * POST /api/mrp/requirements/:id/allocate-stock
 */
export const allocateStockSchema = z.object({
  quantity: z.number().positive('Quantity must be positive'),
  warehouseId: z.string().uuid('Invalid warehouse ID').optional(),
});

/**
 * Link Requirement to PO
 * POST /api/mrp/requirements/:id/link-po
 */
export const linkToPOSchema = z.object({
  purchaseOrderId: z.string().uuid('Invalid purchase order ID'),
  purchaseOrderItemId: z.string().uuid('Invalid purchase order item ID'),
  allocatedQuantity: z.number().positive('Quantity must be positive'),
});

/**
 * Convert to Greige Processing
 * POST /api/mrp/requirements/:id/convert-to-greige
 */
export const convertToGreigeSchema = z.object({
  processorId: z.string().uuid('Invalid processor ID'),
  greigeId: z.string().uuid('Invalid greige ID'),
  processingCost: z.number().nonnegative().optional(),
  greigeCost: z.number().nonnegative().optional(),
});

/**
 * Update Requirement Status
 * PATCH /api/mrp/requirements/:id/status
 */
export const updateRequirementStatusSchema = z.object({
  status: MaterialRequirementStatusEnum,
});

// ============================================================================
// PO Generation Schemas
// ============================================================================

/**
 * Generate Single PO from Requirements
 * POST /api/mrp/generate-po
 */
export const generatePOSchema = z.object({
  requirementIds: z.array(z.string().uuid()).min(1, 'At least one requirement is required'),
  supplierId: z.string().uuid('Invalid supplier ID'),
  expectedDeliveryDate: z.string(),
  remarks: z.string().max(1000).optional(),
  consolidate: z.boolean().optional(),
  itemPrices: z.record(z.string(), z.number().nonnegative()).optional(),
  itemQuantities: z.record(z.string(), z.number().positive()).optional(),
});

/**
 * Group Requirements by Supplier
 * POST /api/mrp/group-by-supplier
 */
export const groupBySupplierSchema = z.object({
  requirementIds: z.array(z.string().uuid()).min(1, 'At least one requirement is required'),
});

/**
 * PO Preview Group Item
 */
export const poPreviewGroupSchema = z.object({
  supplierId: z.string().uuid('Invalid supplier ID'),
  requirementIds: z.array(z.string().uuid()).min(1),
  expectedDeliveryDate: z.string(),
  remarks: z.string().max(1000).optional(),
});

/**
 * Preview POs
 * POST /api/mrp/preview-pos
 */
export const previewPOsSchema = z.object({
  groups: z.array(poPreviewGroupSchema).min(1, 'At least one group is required'),
});

/**
 * Bulk Generate POs
 * POST /api/mrp/generate-pos-bulk
 */
export const bulkGeneratePOSchema = z.object({
  groups: z.array(poPreviewGroupSchema).min(1, 'At least one group is required'),
});

/**
 * Validate Bulk PO
 * POST /api/mrp/validate-bulk-po
 */
export const validateBulkPOSchema = z.object({
  requirementIds: z.array(z.string().uuid()).min(1, 'At least one requirement is required'),
});

// ============================================================================
// Vendor Suggestion Schemas
// ============================================================================

/**
 * Suggest Vendor for Material
 * POST /api/mrp/vendor-suggestions/material
 */
export const suggestForMaterialSchema = z.object({
  materialId: z.string().uuid('Invalid material ID'),
});

/**
 * Suggest Vendors for Requirements
 * POST /api/mrp/vendor-suggestions/requirements
 */
export const suggestForRequirementsSchema = z.object({
  requirementIds: z.array(z.string().uuid()).min(1, 'At least one requirement is required'),
});

/**
 * Bulk Assignment Item
 */
export const vendorAssignmentSchema = z.object({
  requirementId: z.string().uuid('Invalid requirement ID'),
  supplierId: z.string().uuid('Invalid supplier ID'),
});

/**
 * Bulk Assign Vendors
 * POST /api/mrp/vendor-suggestions/bulk-assign
 */
export const bulkAssignVendorsSchema = z.object({
  assignments: z.array(vendorAssignmentSchema).min(1, 'At least one assignment is required'),
});

/**
 * Auto-assign Vendors
 * POST /api/mrp/vendor-suggestions/auto-assign
 */
export const autoAssignVendorsSchema = z.object({
  requirementIds: z.array(z.string().uuid()).min(1, 'At least one requirement is required'),
  minConfidence: z.enum(['high', 'medium']).optional(),
});

// ============================================================================
// Processing Assignment Schemas
// ============================================================================

/**
 * Processor Assignment Item
 */
export const processorAssignmentSchema = z.object({
  requirementId: z.string().uuid('Invalid requirement ID'),
  processorId: z.string().uuid('Invalid processor ID'),
});

/**
 * Suggest Processors
 * POST /api/mrp/processing-assignment/suggest
 */
export const suggestProcessorsSchema = z.object({
  requirementIds: z.array(z.string().uuid()).min(1, 'At least one requirement is required'),
});

/**
 * Bulk Assign Processors
 * POST /api/mrp/processing-assignment/bulk-assign
 */
export const bulkAssignProcessorsSchema = z.object({
  assignments: z.array(processorAssignmentSchema).min(1, 'At least one assignment is required'),
});

/**
 * Auto-assign Processors
 * POST /api/mrp/processing-assignment/auto-assign
 */
export const autoAssignProcessorsSchema = z.object({
  requirementIds: z.array(z.string().uuid()).min(1, 'At least one requirement is required'),
  minConfidence: z.enum(['high', 'medium']).optional(),
});

// ============================================================================
// Query Schemas
// ============================================================================

/**
 * Requirements Query Params
 * GET /api/mrp/requirements
 */
export const requirementsQuerySchema = z.object({
  orderId: z.string().uuid().optional(),
  orderItemId: z.string().uuid().optional(),
  materialId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  styleId: z.string().uuid().optional(),
  status: z.string().optional(), // Can be comma-separated
  source: RequirementSourceEnum.optional(),
  requirementType: RequirementTypeEnum.optional(),
  requiredDateFrom: z.string().optional(),
  requiredDateTo: z.string().optional(),
  hasShortfall: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  search: z.string().max(100).optional(),
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

// ============================================================================
// Type Exports (inferred from schemas)
// ============================================================================

export type CalculateRequirementsInput = z.infer<typeof calculateRequirementsSchema>;
export type CreateManualRequirementInput = z.infer<typeof createManualRequirementSchema>;
export type AllocateStockInput = z.infer<typeof allocateStockSchema>;
export type LinkToPOInput = z.infer<typeof linkToPOSchema>;
export type ConvertToGreigeInput = z.infer<typeof convertToGreigeSchema>;
export type UpdateRequirementStatusInput = z.infer<typeof updateRequirementStatusSchema>;
export type GeneratePOInput = z.infer<typeof generatePOSchema>;
export type GroupBySupplierInput = z.infer<typeof groupBySupplierSchema>;
export type PreviewPOsInput = z.infer<typeof previewPOsSchema>;
export type BulkGeneratePOInput = z.infer<typeof bulkGeneratePOSchema>;
export type ValidateBulkPOInput = z.infer<typeof validateBulkPOSchema>;
export type SuggestForMaterialInput = z.infer<typeof suggestForMaterialSchema>;
export type SuggestForRequirementsInput = z.infer<typeof suggestForRequirementsSchema>;
export type BulkAssignVendorsInput = z.infer<typeof bulkAssignVendorsSchema>;
export type AutoAssignVendorsInput = z.infer<typeof autoAssignVendorsSchema>;
export type SuggestProcessorsInput = z.infer<typeof suggestProcessorsSchema>;
export type BulkAssignProcessorsInput = z.infer<typeof bulkAssignProcessorsSchema>;
export type AutoAssignProcessorsInput = z.infer<typeof autoAssignProcessorsSchema>;
export type RequirementsQueryInput = z.infer<typeof requirementsQuerySchema>;
