/**
 * Unified PO Validation Schemas
 *
 * Zod schemas for unified PO endpoints.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';
import { UnitEnum } from './common.schema';

// ============================================================================
// Enums (match Prisma enums)
// ============================================================================

// Shared full Prisma-aligned Unit enum (includes PAIR/PACK/GRAM/LITER/ROLL).
export { UnitEnum };

export const POSourceEnum = z.enum(['MANUAL', 'COST_SHEET', 'MRP', 'SERVICE_REQUIREMENT', 'PRODUCTION_RUN']);

export const POCategoryEnum = z.enum([
  'GREIGE',
  'FABRIC',
  'TRIM',
  'BUTTON',
  'ZIPPER',
  'THREAD',
  'ELASTIC',
  'LACE',
  'LABEL',
  'PACKAGING',
  'PROCESSING',
  'EMBROIDERY',
  'OUTSOURCED_WORK',
  'TESTING',
  'TRANSPORT',
  'OTHER',
]);

export const ServiceTypeEnum = z.enum([
  'DYEING',
  'PRINTING',
  'EMBROIDERY',
  'WASHING',
  'FINISHING',
  'CUTTING',
  'STITCHING',
  'TESTING',
  'TRANSPORT',
  'CUSTOM',
]);

// ============================================================================
// Source Links Schema
// ============================================================================

export const sourceLinkSchema = z.object({
  sourceType: z.string().max(50),
  sourceId: z.string().uuid(),
  sourceName: z.string().max(100).optional(),
});

// ============================================================================
// Unified PO Item Schema
// ============================================================================

export const unifiedPOItemSchema = z.object({
  materialId: z.string().uuid('Invalid material ID').optional(),
  serviceType: ServiceTypeEnum.optional(),
  serviceDescription: z.string().max(500).optional(),
  orderedQuantity: z.number().positive('Quantity must be positive'),
  unit: UnitEnum,
  unitPrice: z.number().positive('Unit price must be greater than 0'),
  remarks: z.string().max(500).optional(),
});

// ============================================================================
// Create Unified PO Schema
// ============================================================================

/**
 * Create Unified PO
 * POST /api/purchase-orders/unified
 */
export const createUnifiedPOSchema = z.object({
  supplierId: z.string().uuid('Invalid supplier ID'),
  expectedDeliveryDate: z.string().or(z.date()),
  source: POSourceEnum,
  poCategory: POCategoryEnum,
  items: z.array(unifiedPOItemSchema).min(1, 'At least one item is required'),
  paymentTerms: z.string().max(100).nullish(),
  remarks: z.string().max(1000).nullish(),
  sourceLinks: z.array(sourceLinkSchema).optional(),
  linkedGreigePOId: z.string().uuid().optional(),
  skipDuplicateCheck: z.boolean().optional(),
  allowDuplicates: z.boolean().optional(),
});

/**
 * Validate PO Input (same as create, but for validation only)
 * POST /api/purchase-orders/validate
 */
export const validatePOInputSchema = createUnifiedPOSchema;

/**
 * Check Duplicates
 * POST /api/purchase-orders/check-duplicates
 */
// The controller reads { materialIds, excludePOIds } only. supplierId was REQUIRED but never read,
// so a caller sending just materialIds got a 400 for a field the endpoint does not use.
export const checkDuplicatesSchema = z.object({
  materialIds: z.array(z.string().uuid()).optional(),
  excludePOIds: z.array(z.string().uuid()).optional(),
  supplierId: z.string().uuid('Invalid supplier ID').optional(),
  serviceTypes: z.array(ServiceTypeEnum).optional(),
});

/**
 * Cancel PO
 * PATCH /api/purchase-orders/:id/cancel
 */
export const cancelUnifiedPOSchema = z.object({
  reason: z.string().min(1, 'Cancellation reason is required').max(500),
});

/**
 * Send PO (optional remarks)
 * PATCH /api/purchase-orders/:id/send
 */
export const sendUnifiedPOSchema = z
  .object({
    remarks: z.string().max(500).optional(),
  })
  .optional();

/**
 * Acknowledge PO (optional remarks)
 * PATCH /api/purchase-orders/:id/acknowledge
 */
export const acknowledgeUnifiedPOSchema = z
  .object({
    remarks: z.string().max(500).optional(),
  })
  .optional();

// ============================================================================
// Type Exports (inferred from schemas)
// ============================================================================

export type UnifiedPOItemInput = z.infer<typeof unifiedPOItemSchema>;
export type CreateUnifiedPOInput = z.infer<typeof createUnifiedPOSchema>;
export type CheckDuplicatesInput = z.infer<typeof checkDuplicatesSchema>;
export type CancelUnifiedPOInput = z.infer<typeof cancelUnifiedPOSchema>;
