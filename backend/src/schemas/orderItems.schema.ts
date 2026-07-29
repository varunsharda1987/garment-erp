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
  // The UI always sends this ("Auto-recalculate costing"); it was absent here, so Zod stripped it and
  // the controller's recalculation branch never ran — the toast said "costing recalculated" while
  // nothing was recalculated. (`widthOption` was dead: nothing sent it, nothing read it.)
  recalculateCosting: z.boolean().optional(),
});

/**
 * Update Inheritance Settings
 * PATCH /api/order-items/:id/inheritance
 */
// Field names must match the controller + frontend (both use inheritStyleSamples/inheritInspections).
// The old names were stripped by Zod, so the controller saw undefined and threw
// "At least one inheritance setting is required" — the toggle 400'd every time.
// (`inheritCosting` was dead: nothing sent it, the controller never read it.)
export const updateInheritanceSchema = z.object({
  inheritStyleSamples: z.boolean().optional(),
  inheritInspections: z.boolean().optional(),
});

/**
 * Recalculate Order Costing
 * POST /api/order-items/:id/recalculate-costing
 */
export const recalculateCostingSchema = z.object({
  // The controller reads `selectedCadId`; `cadId` was stripped, so an explicitly chosen CAD was
  // silently ignored and the recalculation always used the current one. (`forceRecalculate` was
  // dead: the controller never read it.)
  selectedCadId: z.string().uuid('Invalid CAD ID').optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type SelectCadInput = z.infer<typeof selectCadSchema>;
export type UpdateInheritanceInput = z.infer<typeof updateInheritanceSchema>;
export type RecalculateCostingInput = z.infer<typeof recalculateCostingSchema>;
