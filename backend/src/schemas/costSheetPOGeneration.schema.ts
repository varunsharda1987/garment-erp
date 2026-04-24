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
  expectedDeliveryDate: z.string().datetime().optional(), // Kept for future use
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
  expectedDeliveryDate: z.string().datetime().optional(), // Kept for future use
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
  expectedDeliveryDate: z.string().datetime().optional(), // Kept for future use
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
  expectedDeliveryDate: z.string().datetime().optional(), // Kept for future use
  notes: z.string().max(500).optional(), // Renamed from remarks
});

// ============================================================================
// Type Exports
// ============================================================================

export type GenerateFabricPOInput = z.infer<typeof generateFabricPOSchema>;
export type GenerateGreigePOInput = z.infer<typeof generateGreigePOSchema>;
export type GenerateProcessingPOInput = z.infer<typeof generateProcessingPOSchema>;
export type GenerateTrimsPOInput = z.infer<typeof generateTrimsPOSchema>;
