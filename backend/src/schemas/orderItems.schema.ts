/**
 * Order Items Validation Schemas
 *
 * Zod schemas for order item operations.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// ORDER ITEMS SCHEMAS
// ============================================================================

/**
 * Select CAD for Order
 * PATCH /api/order-items/:id/select-cad
 */
export const selectCadSchema = z.object({
  cadId: z.string().uuid('Invalid CAD ID'),
  widthOption: z.string().max(50).optional(),
});

/**
 * Update Inheritance Settings
 * PATCH /api/order-items/:id/inheritance
 */
export const updateInheritanceSchema = z.object({
  inheritSample: z.boolean().optional(),
  inheritInspection: z.boolean().optional(),
  inheritCosting: z.boolean().optional(),
});

/**
 * Recalculate Order Costing
 * POST /api/order-items/:id/recalculate-costing
 */
export const recalculateCostingSchema = z.object({
  forceRecalculate: z.boolean().optional().default(false),
  cadId: z.string().uuid('Invalid CAD ID').optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type SelectCadInput = z.infer<typeof selectCadSchema>;
export type UpdateInheritanceInput = z.infer<typeof updateInheritanceSchema>;
export type RecalculateCostingInput = z.infer<typeof recalculateCostingSchema>;
