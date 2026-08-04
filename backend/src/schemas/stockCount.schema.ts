/**
 * Stock Count Validation Schemas
 *
 * Zod schemas for physical inventory count endpoints.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';
import { flexMaterialId } from './common.schema';

/**
 * Create Stock Count
 * POST /api/stock-counts
 *
 * Mirrors exactly what the controller destructures from req.body:
 * warehouseId, countType, countDate, remarks, materialIds (countedById comes from req.user).
 * `countType` matches the Prisma `CountType` enum exactly.
 * `countDate` is z.coerce.date() (NOT .datetime()): the form sends a bare 'YYYY-MM-DD' from
 * <input type="date">, and the controller feeds the value straight into `new Date(...)`.
 * The "materialIds required for PARTIAL/SPOT_CHECK" rule is left to the controller/service,
 * which already raise a specific 400 for it.
 */
export const createStockCountSchema = z.object({
  warehouseId: z.string().uuid('Invalid warehouse ID'),
  countType: z.enum(['FULL', 'PARTIAL', 'CYCLE', 'SPOT_CHECK']),
  countDate: z.coerce.date().optional(),
  remarks: z.string().max(500).optional(),
  materialIds: z.array(flexMaterialId('material ID')).optional(),
});

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

export type CreateStockCountInput = z.infer<typeof createStockCountSchema>;
export type UpdateCountItemInput = z.infer<typeof updateCountItemSchema>;
