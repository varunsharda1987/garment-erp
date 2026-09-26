/**
 * Thread Stock Validation Schemas
 *
 * Zod schemas for thread-stock endpoints.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';
import { ThreadPackagingTypeEnum, ThreadPlyEnum } from './generated/prisma-enums';

/**
 * Create Thread Stock (manual entry)
 * POST /api/thread-stock
 * Mirrors the fields the route destructures and passes to threadStockService.createThreadStock.
 * `sourceType` is hard-coded to 'MANUAL' by the route and NOT accepted from the body.
 */
export const createThreadStockSchema = z.object({
  threadId: z.string().uuid('Invalid thread ID'),
  // The pack received (cones and tubes are separate stock items). Omitted = the thread master's own packing.
  packagingType: ThreadPackagingTypeEnum.optional(),
  ply: ThreadPlyEnum.optional(),
  quantity: z.number().positive('Quantity must be positive'),
  unit: z.string().max(20).optional(),
  metersPerUnit: z.number().positive().optional(),
  unitsPerBox: z.number().positive().optional(),
  purchaseCost: z.number().nonnegative('Purchase cost is required and must be non-negative'),
  supplierLotNumber: z.string().max(100).optional(),
  warehouseLocation: z.string().max(255).optional(),
  rackNumber: z.string().max(50).optional(),
  qualityGrade: z.string().max(20).optional(),
  receivedDate: z.coerce.date().optional(),
});

/**
 * Thread Stock Query Params
 * GET /api/thread-stock
 */
export const threadStockQuerySchema = z.object({
  threadId: z.string().uuid().optional(),
  status: z.enum(['AVAILABLE', 'RESERVED', 'EXHAUSTED', 'ISSUED', 'PENDING_RETURN']).optional(),
  minQuantity: z.string().transform(Number).pipe(z.number().nonnegative()).optional(),
  warehouseLocation: z.string().max(255).optional(),
  packagingType: z.string().max(50).optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateThreadStockInput = z.infer<typeof createThreadStockSchema>;
export type ThreadStockQueryInput = z.infer<typeof threadStockQuerySchema>;
