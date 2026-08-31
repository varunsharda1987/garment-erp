/**
 * MRP (Material Requirement Planning) Validation Schemas
 *
 * Zod schemas for MRP endpoints.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';
import { UnitEnum, flexMaterialId } from './common.schema';

// ============================================================================
// Enums (match Prisma enums)
// ============================================================================

export const MaterialRequirementStatusEnum = z.enum([
  'PENDING',
  // Size-wise label planned at full quantity while the order has no size split. Omitting it
  // here would make the status unfilterable and unsettable through the API (see CONVERTED below).
  'SIZE_PENDING',
  'FULFILLED_STOCK',
  'PARTIAL_STOCK',
  'PO_REQUIRED',
  'PO_GENERATED',
  'PO_SENT',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'CANCELLED',
  // MRP-45: present in the Prisma enum and written by convert-to-greige, but missing here — so
  // PATCH /requirements/:id/status could never set (or restore) CONVERTED without a 400.
  'CONVERTED',
]);

export const RequirementSourceEnum = z.enum(['SALES_ORDER', 'WORK_ORDER', 'MANUAL']);

// Units come from the central shared enum (common.schema.ts) so they can never drift again.
export { UnitEnum };

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
  // MRP-08: optional — when omitted the service derives it from the order's
  // expectedDeliveryDate. Callers used to invent "today + 30 days", which overwrote the real
  // delivery date on every requirement a recalculation created.
  requiredDate: z.string().optional(),
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
  materialId: flexMaterialId('material ID'),
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
  // MRP-47: BulkPOGenerationDialog has always SENT these (the prices/quantities the user edits in
  // the review step), but they were absent here — and validateBody does `req.body = schema.parse()`,
  // which strips unknown keys. So every edited price was silently discarded and the PO was created
  // at the originally-resolved rate. Same keys the single-PO schema uses; the service already
  // reads groupKey-then-materialId.
  itemPrices: z.record(z.string(), z.number().nonnegative()).optional(),
  itemQuantities: z.record(z.string(), z.number().positive()).optional(),
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
  materialId: flexMaterialId('material ID'),
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
  materialId: flexMaterialId('material ID').optional(),
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
  // MRP-45: this was `z.string()`, and the value lands directly in Prisma's `orderBy: { [sortBy]: ... }`.
  // Any non-column string was an instant 500. Whitelisted to indexed/meaningful columns.
  sortBy: z
    .enum([
      'createdAt',
      'updatedAt',
      'requiredDate',
      'calculatedAt',
      'requirementNumber',
      'status',
      'totalRequired',
      'shortfall',
      'unitPrice',
    ])
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

/**
 * Distinct requirement styles (filter dropdown)
 * GET /api/mrp/requirements/styles
 *
 * MRP-42: previously unvalidated — the controller cast `req.query.requirementType` straight to a
 * string and passed it into a Prisma `where`.
 */
export const requirementStylesQuerySchema = z.object({
  requirementType: RequirementTypeEnum.optional(),
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
