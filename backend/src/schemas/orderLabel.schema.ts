/**
 * Order Label Validation Schemas
 *
 * Zod schemas for order label override endpoints.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// LABEL OVERRIDE SCHEMAS
// ============================================================================

/**
 * Size Override Item
 * Nested object for size-specific label overrides
 */
export const sizeOverrideSchema = z.object({
  size: z.string().min(1, 'Size is required'),
  extraPercentage: z.number().min(0).max(100).optional(),
  fixedQuantity: z.number().int().nonnegative().optional(),
});

/**
 * Create Label Override
 * POST /api/order-items/:orderItemId/label-overrides
 */
export const createLabelOverrideSchema = z.object({
  styleMaterialBomId: z.string().uuid('Invalid style material BOM ID'),
  extraPercentage: z.number().min(0).max(100).optional(),
  notes: z.string().max(500).optional(),
  sizeOverrides: z.array(sizeOverrideSchema).optional().default([]),
});

// ============================================================================
// Param Validation Schemas
// ============================================================================

export const labelOverrideIdParamSchema = z.object({
  id: z.string().uuid('Invalid label override ID'),
});

export const orderItemIdParamSchema = z.object({
  orderItemId: z.string().uuid('Invalid order item ID'),
});

// ============================================================================
// Type Exports
// ============================================================================

export type SizeOverrideInput = z.infer<typeof sizeOverrideSchema>;
export type CreateLabelOverrideInput = z.infer<typeof createLabelOverrideSchema>;
