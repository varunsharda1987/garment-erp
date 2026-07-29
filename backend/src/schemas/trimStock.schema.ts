/**
 * Trim Stock Validation Schemas
 *
 * Zod schemas for the unified trim-stock endpoints (BUTTON, ZIPPER, ELASTIC,
 * LABEL, PACKAGING, MACHINE_PART, OTHER_MATERIAL).
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

/**
 * Create Trim Stock (manual entry)
 * POST /api/trim-stock/:trimType
 * Mirrors the fields the route destructures and passes to trimStockService.createTrimStock.
 * `trimType` comes from the URL param, and `sourceType` is hard-coded to 'MANUAL' by the
 * route — neither is accepted from the body.
 */
export const createTrimStockSchema = z.object({
  masterId: z.string().uuid('Invalid master ID'),
  quantity: z.number().positive('Quantity must be positive'),
  unit: z.string().max(20).optional(),
  purchaseCost: z.number().nonnegative('Purchase cost is required and must be non-negative'),
  supplierId: z.string().uuid('Invalid supplier ID').optional(),
  batchNumber: z.string().max(100).optional(),
  lotNumber: z.string().max(100).optional(),
  warehouseId: z.string().uuid('Invalid warehouse ID').optional(),
  warehouseLocation: z.string().max(255).optional(),
  rackNumber: z.string().max(50).optional(),
  qualityGrade: z.string().max(20).optional(),
  receivedDate: z.coerce.date().optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateTrimStockInput = z.infer<typeof createTrimStockSchema>;
