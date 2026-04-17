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
 * Generate Fabric PO
 * POST /api/cost-sheet-po/generate/fabric
 */
export const generateFabricPOSchema = z.object({
  costSheetId: z.string().uuid('Invalid cost sheet ID'),
  supplierId: z.string().uuid('Invalid supplier ID').optional(),
  itemIds: z.array(z.string().uuid()).optional(),
  expectedDeliveryDate: z.string().datetime().optional(),
  remarks: z.string().max(500).optional(),
});

/**
 * Generate Greige PO
 * POST /api/cost-sheet-po/generate/greige
 */
export const generateGreigePOSchema = z.object({
  costSheetId: z.string().uuid('Invalid cost sheet ID'),
  supplierId: z.string().uuid('Invalid supplier ID').optional(),
  itemIds: z.array(z.string().uuid()).optional(),
  expectedDeliveryDate: z.string().datetime().optional(),
  remarks: z.string().max(500).optional(),
});

/**
 * Generate Processing PO
 * POST /api/cost-sheet-po/generate/processing
 */
export const generateProcessingPOSchema = z.object({
  costSheetId: z.string().uuid('Invalid cost sheet ID'),
  processorId: z.string().uuid('Invalid processor ID').optional(),
  itemIds: z.array(z.string().uuid()).optional(),
  expectedDeliveryDate: z.string().datetime().optional(),
  remarks: z.string().max(500).optional(),
});

/**
 * Generate Trims PO
 * POST /api/cost-sheet-po/generate/trims
 */
export const generateTrimsPOSchema = z.object({
  costSheetId: z.string().uuid('Invalid cost sheet ID'),
  supplierId: z.string().uuid('Invalid supplier ID').optional(),
  itemIds: z.array(z.string().uuid()).optional(),
  expectedDeliveryDate: z.string().datetime().optional(),
  remarks: z.string().max(500).optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type GenerateFabricPOInput = z.infer<typeof generateFabricPOSchema>;
export type GenerateGreigePOInput = z.infer<typeof generateGreigePOSchema>;
export type GenerateProcessingPOInput = z.infer<typeof generateProcessingPOSchema>;
export type GenerateTrimsPOInput = z.infer<typeof generateTrimsPOSchema>;
