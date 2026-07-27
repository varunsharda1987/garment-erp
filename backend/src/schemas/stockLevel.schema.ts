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
 *
 * Policy + valuation only. Quantity is DERIVED from the per-lot stock tables (T2-1) and is explicitly
 * rejected — adjusting on-hand goes through the stock adjustment flow, which moves actual lots.
 */
export const updateStockLevelSchema = z.object({
  quantity: z.undefined({
    error: 'quantity is derived from per-lot stock; use the stock adjustment flow',
  }),
  valuationRate: z.number().nonnegative('Valuation rate cannot be negative').optional(),
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
  // materialId is app-supplied (trim materials use 'mat-<code>' ids), so no UUID constraint
  materialId: z.string().min(1).max(100).optional(),
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

/**
 * Stock Level ID Param
 * GET/PUT /api/stock-levels/:id
 *
 * The list endpoints emit synthetic composite ids `${materialId}_${warehouseId}` for derived rows, so the
 * detail/update routes must accept that format. A bare UUID is also allowed so legacy stock_levels row ids
 * reach the controller and get a clear 404 instead of a confusing param-validation 400.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const stockLevelIdParamSchema = z.object({
  id: z.string().refine(
    (val) => {
      // Composite: everything before the LAST underscore is the materialId (app-supplied — trim
      // materials use non-UUID ids like 'mat-btn-0001'); the part after it must be a warehouse
      // UUID (warehouses.id is always @default(uuid())). A bare UUID (legacy row id) also passes.
      const cut = val.lastIndexOf('_');
      if (cut === -1) return UUID_RE.test(val);
      return cut > 0 && UUID_RE.test(val.slice(cut + 1));
    },
    { message: "Invalid stock level ID (expected 'materialId_warehouseId' composite or legacy UUID)" }
  ),
});

// ============================================================================
// Type Exports
// ============================================================================

export type UpdateStockLevelInput = z.infer<typeof updateStockLevelSchema>;
export type StockLevelQueryInput = z.infer<typeof stockLevelQuerySchema>;
export type StockLevelIdParam = z.infer<typeof stockLevelIdParamSchema>;
