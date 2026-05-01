/**
 * Fabric Procurement Validation Schemas
 *
 * Zod schemas for fabric procurement CRUD operations.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const ProcurementStatusEnum = z.enum([
  'PLANNED',
  'PO_CREATED',
  'ORDERED',
  'PARTIAL_RECEIVED',
  'RECEIVED',
  'CANCELLED',
]);

// ============================================================================
// PROCUREMENT SCHEMAS
// ============================================================================

/**
 * Procurement Item
 */
const procurementItemSchema = z.object({
  fabricId: z.string().uuid('Invalid fabric ID').optional(),
  greigeId: z.string().uuid('Invalid greige ID').optional(),
  quantity: z.number().positive('Quantity must be positive'),
  unit: z.string().max(20).optional().default('METER'),
  rate: z.number().nonnegative('Rate cannot be negative').optional(),
  requiredDate: z.string().datetime().optional(),
  orderId: z.string().uuid('Invalid order ID').optional(),
  styleId: z.string().uuid('Invalid style ID').optional(),
  remarks: z.string().max(500).optional(),
});

/**
 * Create Procurement
 * POST /api/procurement
 */
export const createProcurementSchema = z
  .object({
    supplierId: z.string().uuid('Invalid supplier ID'),
    orderId: z.string().uuid('Invalid order ID').optional(),
    expectedDeliveryDate: z.string().datetime().optional(),
    remarks: z.string().max(500).optional(),
    items: z.array(procurementItemSchema).min(1, 'At least one item is required'),
  })
  .passthrough();

/**
 * Update Procurement
 * PUT /api/procurement/:id
 */
export const updateProcurementSchema = z
  .object({
    supplierId: z.string().uuid('Invalid supplier ID').optional(),
    expectedDeliveryDate: z.string().datetime().optional().nullable(),
    status: ProcurementStatusEnum.optional(),
    remarks: z.string().max(500).optional().nullable(),
    items: z.array(procurementItemSchema).optional(),
    receivedDate: z.string().datetime().optional().nullable(),
    actualQuantityReceived: z.number().nonnegative('Quantity cannot be negative').optional(),
    notes: z.string().max(500).optional().nullable(),
    invoiceNumber: z.string().max(50).optional().nullable(),
    invoiceDate: z.string().datetime().or(z.date()).optional().nullable(),
  })
  .passthrough();

/**
 * Plan Procurement
 * POST /api/procurement/plan
 * Controller expects: orderId, styleId, cadPlanningId, fabricCadIds, processorId, purpose, notes
 */
export const planProcurementSchema = z
  .object({
    orderId: z.string().uuid('Invalid order ID').optional(),
    styleId: z.string().uuid('Invalid style ID').optional(),
    cadPlanningId: z.string().uuid('Invalid CAD planning ID').optional(),
    fabricCadIds: z.array(z.string().uuid()).optional(),
    processorId: z.string().uuid('Invalid processor ID').optional(),
    purpose: z.string().max(100).optional(),
    notes: z.string().max(500).optional(),
  })
  .passthrough();

/**
 * Procurement Query Params
 * GET /api/procurement
 */
export const procurementQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  search: z.string().max(100).optional(),
  supplierId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  status: ProcurementStatusEnum.optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateProcurementInput = z.infer<typeof createProcurementSchema>;
export type UpdateProcurementInput = z.infer<typeof updateProcurementSchema>;
export type PlanProcurementInput = z.infer<typeof planProcurementSchema>;
export type ProcurementQueryInput = z.infer<typeof procurementQuerySchema>;
