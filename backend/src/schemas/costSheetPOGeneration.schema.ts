/**
 * Cost Sheet PO Generation Validation Schemas
 *
 * Zod schemas for generating Purchase Orders from approved Cost Sheets.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// COST SHEET PO GENERATION SCHEMAS
// ============================================================================

/**
 * Cost Sheet PO Item
 */
const costSheetPOItemSchema = z.object({
  styleFabricId: z.string().uuid('Invalid style fabric ID').optional(),
  greigeId: z.string().uuid('Invalid greige ID').optional(),
  quantity: z.number().positive().optional(),
  rate: z.number().nonnegative().optional(),
});

/**
 * Generate Fabric PO
 * POST /api/cost-sheet-po/generate/fabric
 */
export const generateFabricPOSchema = z.object({
  costSheetId: z.string().uuid('Invalid cost sheet ID'),
  totalOrderQty: z.number().int().positive('Total order quantity is required'), // Added - required by controller
  supplierId: z.string().uuid('Invalid supplier ID'), // Made required
  items: z.array(costSheetPOItemSchema).min(1, 'At least one item is required'), // Renamed from itemIds
  expectedDeliveryDate: z.coerce.date().optional(), // Kept for future use
  notes: z.string().max(500).optional(), // Renamed from remarks
});

/**
 * Generate Greige PO
 * POST /api/cost-sheet-po/generate/greige
 */
export const generateGreigePOSchema = z.object({
  costSheetId: z.string().uuid('Invalid cost sheet ID'),
  totalOrderQty: z.number().int().positive('Total order quantity is required'), // Added - required by controller
  supplierId: z.string().uuid('Invalid supplier ID'), // Made required
  items: z.array(costSheetPOItemSchema).min(1, 'At least one item is required'), // Renamed from itemIds
  expectedDeliveryDate: z.coerce.date().optional(), // Kept for future use
  notes: z.string().max(500).optional(), // Renamed from remarks
});

/**
 * Generate Processing PO
 * POST /api/cost-sheet-po/generate/processing
 */
export const generateProcessingPOSchema = z.object({
  costSheetId: z.string().uuid('Invalid cost sheet ID'),
  totalOrderQty: z.number().int().positive('Total order quantity is required'), // Added - required by controller
  processorId: z.string().uuid('Invalid processor ID'), // Made required
  items: z.array(costSheetPOItemSchema).min(1, 'At least one item is required'), // Renamed from itemIds
  linkedGreigePOId: z.string().uuid('Invalid greige PO ID').optional(), // Added - used by controller
  expectedDeliveryDate: z.coerce.date().optional(), // Kept for future use
  notes: z.string().max(500).optional(), // Renamed from remarks
});

/**
 * Generate Trims PO
 * POST /api/cost-sheet-po/generate/trims
 */
export const generateTrimsPOSchema = z.object({
  costSheetId: z.string().uuid('Invalid cost sheet ID'),
  totalOrderQty: z.number().int().positive('Total order quantity is required'), // Added - required by controller
  supplierId: z.string().uuid('Invalid supplier ID'), // Made required
  items: z.array(costSheetPOItemSchema).min(1, 'At least one item is required'), // Renamed from itemIds
  expectedDeliveryDate: z.coerce.date().optional(), // Kept for future use
  notes: z.string().max(500).optional(), // Renamed from remarks
});

// ============================================================================
// LACE PO SCHEMAS
// ============================================================================

/**
 * Lace PO Item schema
 */
const lacePOItemSchema = z.object({
  materialId: z.string().uuid('Invalid material ID'),
  orderQty: z.number().positive('Order quantity must be positive'),
  unit: z.string().default('METER'),
  unitPrice: z.number().positive('Unit price must be greater than 0'),
  allowancePercent: z.number().nonnegative().default(3),
  remarks: z.string().max(500).optional(),
});

/**
 * Greige Lace PO Item schema
 */
const greigeLacePOItemSchema = lacePOItemSchema.extend({
  expectedShrinkagePercent: z.number().nonnegative().optional(),
});

/**
 * Lace Processing PO Item schema
 */
const laceProcessingPOItemSchema = z.object({
  materialId: z.string().uuid('Invalid material ID (finished lace)'),
  greigeLaceId: z.string().uuid('Invalid greige lace ID'),
  processType: z.string().default('DYEING'),
  orderQty: z.number().positive('Order quantity must be positive'),
  unit: z.string().default('METER'),
  unitPrice: z.number().positive('Unit price must be greater than 0'),
  labDipId: z.string().uuid('Invalid lab dip ID').optional(),
  allowancePercent: z.number().nonnegative().default(3),
  remarks: z.string().max(500).optional(),
});

/**
 * Generate Ready Lace PO
 * POST /api/cost-sheet-po/generate/lace
 */
export const generateLacePOSchema = z.object({
  costSheetId: z.string().uuid('Invalid cost sheet ID'),
  totalOrderQty: z.number().int().positive('Total order quantity is required'),
  supplierId: z.string().uuid('Invalid supplier ID'),
  items: z.array(lacePOItemSchema).min(1, 'At least one item is required'),
  expectedDeliveryDate: z.coerce.date().optional(),
  notes: z.string().max(500).optional(),
});

/**
 * Generate Greige Lace PO
 * POST /api/cost-sheet-po/generate/greige-lace
 */
export const generateGreigeLacePOSchema = z.object({
  costSheetId: z.string().uuid('Invalid cost sheet ID'),
  totalOrderQty: z.number().int().positive('Total order quantity is required'),
  supplierId: z.string().uuid('Invalid supplier ID'),
  items: z.array(greigeLacePOItemSchema).min(1, 'At least one item is required'),
  expectedDeliveryDate: z.coerce.date().optional(),
  notes: z.string().max(500).optional(),
});

/**
 * Generate Lace Processing PO
 * POST /api/cost-sheet-po/generate/lace-processing
 */
export const generateLaceProcessingPOSchema = z.object({
  costSheetId: z.string().uuid('Invalid cost sheet ID'),
  totalOrderQty: z.number().int().positive('Total order quantity is required'),
  processorId: z.string().uuid('Invalid processor ID'),
  items: z.array(laceProcessingPOItemSchema).min(1, 'At least one item is required'),
  linkedGreigeLacePOId: z.string().uuid('Invalid greige lace PO ID').optional(),
  expectedDeliveryDate: z.coerce.date().optional(),
  notes: z.string().max(500).optional(),
});

// ============================================================================
// QUERY SCHEMAS
// ============================================================================

/**
 * Calculate Requirements Query
 * GET /api/cost-sheet-po/calculate
 */
export const calculateRequirementsQuerySchema = z.object({
  costSheetId: z.string().uuid('Invalid cost sheet ID'),
  totalOrderQty: z.string().transform(Number).pipe(z.number().int().positive('Total order quantity must be positive')),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CalculateRequirementsQuery = z.infer<typeof calculateRequirementsQuerySchema>;
export type GenerateFabricPOInput = z.infer<typeof generateFabricPOSchema>;
export type GenerateGreigePOInput = z.infer<typeof generateGreigePOSchema>;
export type GenerateProcessingPOInput = z.infer<typeof generateProcessingPOSchema>;
export type GenerateTrimsPOInput = z.infer<typeof generateTrimsPOSchema>;
export type GenerateLacePOInput = z.infer<typeof generateLacePOSchema>;
export type GenerateGreigeLacePOInput = z.infer<typeof generateGreigeLacePOSchema>;
export type GenerateLaceProcessingPOInput = z.infer<typeof generateLaceProcessingPOSchema>;
