/**
 * Order Validation Schemas
 *
 * Zod schemas for order management endpoints.
 */

import { z } from 'zod';

// Order status enum - matches Prisma OrderStatus
export const OrderStatus = z.enum(['PENDING', 'IN_PRODUCTION', 'COMPLETED', 'DISPATCHED', 'CANCELLED']);

// Order line item schema
const orderLineItemSchema = z.object({
  styleId: z.string().uuid('Invalid style ID'),
  variantId: z.string().uuid('Invalid variant ID').optional(),
  quantity: z.number().int().positive('Quantity must be positive'),
  unitPrice: z.number().nonnegative('Unit price cannot be negative'),
  discount: z.number().min(0).max(100).optional(),
  notes: z.string().max(500).optional(),
});

// Create order schema
export const createOrderSchema = z.object({
  orderNumber: z.string().min(1, 'Order number is required').max(50),
  customerId: z.string().uuid('Invalid customer ID'),
  orderDate: z.coerce.date(),
  deliveryDate: z.coerce.date().optional(),
  status: OrderStatus.default('PENDING'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  paymentTermsId: z.string().uuid().optional(),
  currencyId: z.string().uuid().optional(),
  exchangeRate: z.number().positive().optional(),
  shippingAddress: z.string().max(500).optional(),
  billingAddress: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
  internalNotes: z.string().max(2000).optional(),
  lineItems: z.array(orderLineItemSchema).min(1, 'At least one line item is required'),
});

// Update order schema
export const updateOrderSchema = createOrderSchema.partial().extend({
  id: z.string().uuid(),
});

// Update order status schema
export const updateOrderStatusSchema = z.object({
  id: z.string().uuid(),
  status: OrderStatus,
  reason: z.string().max(500).optional(),
});

// Order query params schema
export const orderQuerySchema = z.object({
  customerId: z.string().uuid().optional(),
  status: OrderStatus.optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(1000).default(20),
  sortBy: z
    .enum(['createdAt', 'updatedAt', 'orderNumber', 'orderDate', 'deliveryDate', 'status', 'totalQuantity'])
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type OrderQueryInput = z.infer<typeof orderQuerySchema>;
