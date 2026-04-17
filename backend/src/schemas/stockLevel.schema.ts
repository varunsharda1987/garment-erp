/**
 * Stock Level Validation Schemas
 *
 * Zod schemas for stock level CRUD and query operations.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// STOCK LEVEL SCHEMAS
// ============================================================================

/**
 * Update Stock Level
 * PUT /api/stock-levels/:id
 */
export const updateStockLevelSchema = z.object({
  reorderLevel: z.number().nonnegative('Reorder level cannot be negative').optional(),
  reorderQuantity: z.number().positive('Reorder quantity must be positive').optional(),
  maxLevel: z.number().positive('Max level must be positive').optional(),
  minLevel: z.number().nonnegative('Min level cannot be negative').optional(),
  safetyStock: z.number().nonnegative('Safety stock cannot be negative').optional(),
  avgConsumptionPerDay: z.number().nonnegative().optional(),
  leadTimeDays: z.number().int().nonnegative().optional(),
  remarks: z.string().max(500).optional().nullable(),
});

/**
 * Stock Level Query Params
 * GET /api/stock-levels
 */
export const stockLevelQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  search: z.string().max(100).optional(),
  materialId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  materialType: z.string().max(50).optional(),
  belowReorder: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
  belowSafety: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
  sortBy: z.string().max(50).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type UpdateStockLevelInput = z.infer<typeof updateStockLevelSchema>;
export type StockLevelQueryInput = z.infer<typeof stockLevelQuerySchema>;
