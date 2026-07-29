/**
 * Stock Count Validation Schemas
 *
 * Zod schemas for physical inventory count endpoints.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

/**
 * Update Count Item
 * PUT /api/stock-counts/:countId/items/:itemId
 * Controller feeds physicalQuantity straight into `new Decimal(...)`, so it MUST be a
 * real non-negative number — a string like 'abc' would otherwise 500 the request.
 */
export const updateCountItemSchema = z.object({
  physicalQuantity: z.number().nonnegative('Physical quantity cannot be negative'),
  remarks: z.string().max(500).optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type UpdateCountItemInput = z.infer<typeof updateCountItemSchema>;
