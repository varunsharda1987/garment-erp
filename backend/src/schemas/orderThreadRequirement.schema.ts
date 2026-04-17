/**
 * Order Thread Requirement Validation Schemas
 *
 * Zod schemas for order thread requirement CRUD operations.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// ORDER THREAD REQUIREMENT SCHEMAS
// ============================================================================

/**
 * Create Thread Requirement
 * POST /api/orders/:orderId/thread-requirements
 */
export const createThreadRequirementSchema = z.object({
  threadId: z.string().uuid('Invalid thread ID'),
  styleId: z.string().uuid('Invalid style ID').optional(),
  quantityRequired: z.number().positive('Quantity required must be positive'),
  quantityAllocated: z.number().nonnegative().optional().default(0),
  unit: z.string().max(20).optional().default('MTR'),
  color: z.string().max(50).optional(),
  usage: z.string().max(100).optional(),
  remarks: z.string().max(500).optional(),
});

/**
 * Update Thread Requirement
 * PUT /api/orders/:orderId/thread-requirements/:id
 */
export const updateThreadRequirementSchema = z.object({
  threadId: z.string().uuid('Invalid thread ID').optional(),
  styleId: z.string().uuid('Invalid style ID').optional().nullable(),
  quantityRequired: z.number().positive().optional(),
  quantityAllocated: z.number().nonnegative().optional(),
  unit: z.string().max(20).optional(),
  color: z.string().max(50).optional().nullable(),
  usage: z.string().max(100).optional().nullable(),
  remarks: z.string().max(500).optional().nullable(),
});

/**
 * Check Shortages
 * POST /api/orders/:orderId/thread-requirements/check-shortage
 */
export const checkShortageSchema = z.object({
  threadIds: z.array(z.string().uuid()).optional(),
});

/**
 * Generate PO
 * POST /api/thread-requirements/generate-po
 */
export const generateThreadPOSchema = z.object({
  requirementIds: z.array(z.string().uuid()).min(1, 'At least one requirement ID is required'),
  supplierId: z.string().uuid('Invalid supplier ID'),
  expectedDeliveryDate: z.string().datetime().optional(),
  remarks: z.string().max(500).optional(),
});

/**
 * Get Available Suppliers
 * POST /api/thread-requirements/available-suppliers
 */
export const availableSuppliersSchema = z.object({
  threadIds: z.array(z.string().uuid()).min(1, 'At least one thread ID is required'),
});

/**
 * Query Thread Requirements
 * GET /api/thread-requirements
 */
export const threadRequirementQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  orderId: z.string().uuid().optional(),
  styleId: z.string().uuid().optional(),
  threadId: z.string().uuid().optional(),
  hasShortage: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
  search: z.string().max(100).optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateThreadRequirementInput = z.infer<typeof createThreadRequirementSchema>;
export type UpdateThreadRequirementInput = z.infer<typeof updateThreadRequirementSchema>;
export type CheckShortageInput = z.infer<typeof checkShortageSchema>;
export type GenerateThreadPOInput = z.infer<typeof generateThreadPOSchema>;
export type AvailableSuppliersInput = z.infer<typeof availableSuppliersSchema>;
export type ThreadRequirementQueryInput = z.infer<typeof threadRequirementQuerySchema>;
