/**
 * Stock Production Order Validation Schemas
 *
 * Zod schemas for stock production order CRUD operations.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const SPOStatusEnum = z.enum([
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'IN_PRODUCTION',
  'COMPLETED',
  'CANCELLED',
]);

// ============================================================================
// STOCK PRODUCTION ORDER SCHEMAS
// ============================================================================

/**
 * Create Stock Production Order
 * POST /api/stock-production-orders
 */
export const createSPOSchema = z.object({
  styleId: z.string().uuid('Invalid style ID'),
  orderDate: z.string().datetime().optional(),
  expectedDeliveryDate: z.string().datetime().optional(),
  quantity: z.number().int().positive('Quantity must be positive'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().default('MEDIUM'),
  remarks: z.string().max(1000).optional(),
  sizeBreakdown: z.record(z.string(), z.number().int().nonnegative()).optional(),
  colorBreakdown: z.record(z.string(), z.number().int().nonnegative()).optional(),
});

/**
 * Update Stock Production Order
 * PUT /api/stock-production-orders/:id
 */
export const updateSPOSchema = z.object({
  styleId: z.string().uuid('Invalid style ID').optional(),
  expectedDeliveryDate: z.string().datetime().optional().nullable(),
  quantity: z.number().int().positive().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  status: SPOStatusEnum.optional(),
  remarks: z.string().max(1000).optional().nullable(),
  sizeBreakdown: z.record(z.string(), z.number().int().nonnegative()).optional().nullable(),
  colorBreakdown: z.record(z.string(), z.number().int().nonnegative()).optional().nullable(),
});

/**
 * Approve Stock Production Order
 * POST /api/stock-production-orders/:id/approve
 */
export const approveSPOSchema = z.object({
  remarks: z.string().max(500).optional(),
});

/**
 * Generate Work Orders
 * POST /api/stock-production-orders/:id/generate-work-orders
 */
export const generateWorkOrdersSchema = z.object({
  splitBySize: z.boolean().optional().default(false),
  splitByColor: z.boolean().optional().default(false),
  remarks: z.string().max(500).optional(),
});

/**
 * Query Stock Production Orders
 * GET /api/stock-production-orders
 */
export const spoQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  search: z.string().max(100).optional(),
  styleId: z.string().uuid().optional(),
  status: SPOStatusEnum.optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateSPOInput = z.infer<typeof createSPOSchema>;
export type UpdateSPOInput = z.infer<typeof updateSPOSchema>;
export type ApproveSPOInput = z.infer<typeof approveSPOSchema>;
export type GenerateWorkOrdersInput = z.infer<typeof generateWorkOrdersSchema>;
export type SPOQueryInput = z.infer<typeof spoQuerySchema>;
