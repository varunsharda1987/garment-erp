/**
 * Sale Order Validation Schemas
 *
 * Zod schemas for sale order CRUD and stock allocation.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';
import { PriorityEnum } from './generated/prisma-enums';

// ============================================================================
// Enums
// ============================================================================

export const SaleOrderStatusEnum = z.enum([
  'DRAFT',
  'CONFIRMED',
  // Allocation states the DB assigns and the UI filters by (were missing -> 400 on those filters).
  'PARTIALLY_ALLOCATED',
  'FULLY_ALLOCATED',
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
  colorId: z.string().uuid('Invalid color ID').nullable().optional(),
  sizeId: z.string().uuid('Invalid size ID'),
  quantity: z.number().int().positive('Quantity must be positive'),
  unitPrice: z.number().nonnegative('Unit price cannot be negative'),
  remarks: z.string().max(500).optional(),
});

/**
 * Create Sale Order
 * POST /api/sale-orders
 */
export const createSaleOrderSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
  buyerPoNumber: z.string().max(100).optional(), // Buyer's (HOK) PO number — B2B tracking key
  styleId: z.string().uuid('Invalid style ID').optional().nullable(), // Primary style for the order
  // Bare 'YYYY-MM-DD' (the frontend's <input type="date">) and full ISO must both pass —
  // the controller does new Date(expectedShipDate) either way.
  expectedShipDate: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date')
    .optional(),
  buyerDeadline: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date')
    .optional(), // Buyer's required completion date
  // z.coerce.date(): date pickers send YYYY-MM-DD, z.string().datetime() rejects it
  orderDate: z.coerce.date().optional(),
  deliveryDate: z.coerce.date().optional(),
  paymentTerms: z.string().max(100).optional(),
  deliveryAddress: z.string().max(500).optional(),
  remarks: z.string().max(500).optional(),
  // BUG-ORD2 fix: items made optional - frontend creates order first, adds items on detail page
  items: z.array(saleOrderItemSchema).optional().default([]),
});

/**
 * Update Sale Order
 * PUT /api/sale-orders/:id
 */
export const updateSaleOrderSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID').optional(),
  buyerPoNumber: z.string().max(100).optional().nullable(), // Buyer's (HOK) PO number — B2B tracking key
  styleId: z.string().uuid('Invalid style ID').optional().nullable(), // Primary style for the order
  expectedShipDate: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date')
    .optional(),
  buyerDeadline: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date')
    .optional()
    .nullable(), // Buyer's required completion date
  // z.coerce.date(): date pickers send YYYY-MM-DD, z.string().datetime() rejects it
  orderDate: z.coerce.date().optional().nullable(),
  deliveryDate: z.coerce.date().optional().nullable(),
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
 * Start Production (make-to-order: create the linked production order for the full SO quantity)
 * POST /api/sale-orders/:id/start-production
 */
export const startProductionSchema = z.object({
  // Optional override; falls back to buyerDeadline ?? expectedShipDate ?? deliveryDate server-side
  expectedDeliveryDate: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date')
    .optional(),
  priority: PriorityEnum.optional(),
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
 * Deallocate Stock
 * POST /api/sale-orders/deallocate-stock
 * P7.2: Release a specific FG stock allocation
 */
export const deallocateStockSchema = z.object({
  allocationId: z.string().uuid('Invalid allocation ID'),
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
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateSaleOrderInput = z.infer<typeof createSaleOrderSchema>;
export type UpdateSaleOrderInput = z.infer<typeof updateSaleOrderSchema>;
export type ConfirmSaleOrderInput = z.infer<typeof confirmSaleOrderSchema>;
export type StartProductionInput = z.infer<typeof startProductionSchema>;
export type AllocateStockInput = z.infer<typeof allocateStockSchema>;
export type SaleOrderQueryInput = z.infer<typeof saleOrderQuerySchema>;
