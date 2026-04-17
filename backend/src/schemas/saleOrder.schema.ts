/**
 * Sale Order Validation Schemas
 *
 * Zod schemas for sale order CRUD and stock allocation.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const SaleOrderStatusEnum = z.enum([
  'DRAFT',
  'CONFIRMED',
  'PARTIALLY_DISPATCHED',
  'DISPATCHED',
  'DELIVERED',
  'CANCELLED',
]);

// ============================================================================
// SALE ORDER SCHEMAS
// ============================================================================

/**
 * Sale Order Item
 */
const saleOrderItemSchema = z.object({
  styleId: z.string().uuid('Invalid style ID'),
  variantId: z.string().uuid('Invalid variant ID').optional(),
  skuId: z.string().uuid('Invalid SKU ID').optional(),
  quantity: z.number().int().positive('Quantity must be positive'),
  rate: z.number().nonnegative('Rate cannot be negative'),
  discount: z.number().min(0).max(100).optional().default(0),
  taxRate: z.number().min(0).max(100).optional(),
  remarks: z.string().max(500).optional(),
});

/**
 * Create Sale Order
 * POST /api/sale-orders
 */
export const createSaleOrderSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
  orderDate: z.string().datetime().optional(),
  deliveryDate: z.string().datetime().optional(),
  paymentTerms: z.string().max(100).optional(),
  deliveryAddress: z.string().max(500).optional(),
  remarks: z.string().max(500).optional(),
  items: z.array(saleOrderItemSchema).min(1, 'At least one item is required'),
});

/**
 * Update Sale Order
 * PUT /api/sale-orders/:id
 */
export const updateSaleOrderSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID').optional(),
  orderDate: z.string().datetime().optional().nullable(),
  deliveryDate: z.string().datetime().optional().nullable(),
  paymentTerms: z.string().max(100).optional().nullable(),
  deliveryAddress: z.string().max(500).optional().nullable(),
  status: SaleOrderStatusEnum.optional(),
  remarks: z.string().max(500).optional().nullable(),
  items: z.array(saleOrderItemSchema).optional(),
});

/**
 * Confirm Sale Order
 * POST /api/sale-orders/:id/confirm
 */
export const confirmSaleOrderSchema = z.object({
  remarks: z.string().max(500).optional(),
});

/**
 * Allocate Stock
 * POST /api/sale-orders/allocate-stock
 */
export const allocateStockSchema = z.object({
  saleOrderItemId: z.string().uuid('Invalid sale order item ID'),
  fgStockId: z.string().uuid('Invalid FG stock ID'),
  quantity: z.number().int().positive('Quantity must be positive'),
  remarks: z.string().max(500).optional(),
});

/**
 * Sale Order Query Params
 * GET /api/sale-orders
 */
export const saleOrderQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  search: z.string().max(100).optional(),
  customerId: z.string().uuid().optional(),
  status: SaleOrderStatusEnum.optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateSaleOrderInput = z.infer<typeof createSaleOrderSchema>;
export type UpdateSaleOrderInput = z.infer<typeof updateSaleOrderSchema>;
export type ConfirmSaleOrderInput = z.infer<typeof confirmSaleOrderSchema>;
export type AllocateStockInput = z.infer<typeof allocateStockSchema>;
export type SaleOrderQueryInput = z.infer<typeof saleOrderQuerySchema>;
