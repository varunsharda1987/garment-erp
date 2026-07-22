/**
 * Fabric Procurement Validation Schemas
 *
 * Zod schemas for fabric procurement CRUD operations.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 *
 * NOTE: The former items-based create schema and PLANNED/PO_CREATED/PARTIAL_RECEIVED
 * status values belonged to a legacy procurement design the controller never
 * implemented. The schemas below match fabric-procurement.controller.ts and the
 * fabric_procurement table (single source — do not reintroduce a controller-local copy).
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

// Aligned with fabric_procurement.status values written by the app
// (default 'ORDERED'; services write 'RECEIVED'/'COMPLETED').
export const ProcurementStatusEnum = z.enum([
  'ORDERED',
  'CONFIRMED',
  'IN_TRANSIT',
  'RECEIVED',
  'PROCESSING',
  'COMPLETED',
  'CANCELLED',
]);

// ============================================================================
// PROCUREMENT SCHEMAS
// ============================================================================

/**
 * Create Procurement
 * POST /api/procurement
 */
export const createProcurementSchema = z.object({
  procurementType: z.enum(['GREIGE', 'FINISHED']),
  purchaseOrderNumber: z.string().optional(),
  supplierId: z.string().uuid(),
  greigeId: z.string().uuid().optional(),
  fabricId: z.string().uuid().optional(),
  quantityPurchased: z.number().positive(),
  unit: z.string().default('meters'),
  width: z.number().positive(),
  ratePerUnit: z.number().positive(),
  totalCost: z.number().positive(),

  // Origin tracking
  orderedForStyleId: z.string().uuid().optional(),
  orderedForOrderId: z.string().uuid().optional(),
  isStockPurchase: z.boolean().default(false),

  // Processing details (for greige)
  processingRequired: z.boolean().default(false),
  processingType: z.string().optional(),
  processingColor: z.string().optional(),
  processedFabricId: z.string().uuid().optional(),
  processingMoq: z.number().optional(),

  expectedDelivery: z.coerce.date().optional(),
  notes: z.string().optional(),
});

/**
 * Update Procurement
 * PUT /api/procurement/:id
 */
export const updateProcurementSchema = z.object({
  status: ProcurementStatusEnum.optional(),
  receivedDate: z.coerce.date().optional(),
  notes: z.string().optional(),
});

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
  fromDate: z.string().datetime().optional(), // allow-datetime
  toDate: z.string().datetime().optional(), // allow-datetime
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateProcurementInput = z.infer<typeof createProcurementSchema>;
export type UpdateProcurementInput = z.infer<typeof updateProcurementSchema>;
export type PlanProcurementInput = z.infer<typeof planProcurementSchema>;
export type ProcurementQueryInput = z.infer<typeof procurementQuerySchema>;
