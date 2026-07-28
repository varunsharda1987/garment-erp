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

const PriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

// Size/color breakup item — matches the controller/service DTO (colorId optional, sizeId + quantity required)
const spoItemSchema = z.object({
  colorId: z.string().uuid('Invalid color ID').nullable().optional(),
  sizeId: z.string().uuid('Invalid size ID'),
  quantity: z.number().int().positive('Quantity must be positive'),
});

/**
 * Create Stock Production Order
 * POST /api/stock-production-orders
 *
 * Matches StockProductionOrderList.tsx (sends styleId/totalQuantity/targetDate?/priority?/remarks?/items[])
 * and the controller/service DTO. Items may be empty at creation — the breakup is added on the detail page.
 */
export const createSPOSchema = z.object({
  styleId: z.string().uuid('Invalid style ID'),
  totalQuantity: z.number().int().positive('Total quantity must be positive'),
  // z.coerce.date(): date pickers send YYYY-MM-DD, which z.string().datetime() rejects
  targetDate: z.coerce.date().optional(),
  priority: PriorityEnum.optional().default('MEDIUM'),
  remarks: z.string().max(1000).optional(),
  items: z.array(spoItemSchema).optional().default([]),
});

/**
 * Update Stock Production Order
 * PUT /api/stock-production-orders/:id
 *
 * Matches SPOUpdateInput — the detail page sends items[]/totalQuantity for Add/Remove Item.
 */
export const updateSPOSchema = z.object({
  totalQuantity: z.number().int().positive().optional(),
  targetDate: z.coerce.date().optional().nullable(),
  priority: PriorityEnum.optional(),
  remarks: z.string().max(1000).optional().nullable(),
  items: z.array(spoItemSchema).optional(),
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
