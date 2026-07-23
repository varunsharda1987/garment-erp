/**
 * Lace Lab Dip Validation Schemas
 *
 * Zod schemas for the lace lab dip approval workflow (bug-hunt samples-embroidery-17:
 * the mutation routes previously had no validateBody, so non-numeric quantities reached
 * parseFloat → NaN → Prisma Decimal 500s).
 *
 * Field names match laceLabDip.controller.ts destructuring exactly.
 */

import { z } from 'zod';
import { LaceLabDipStatus } from '@prisma/client';

/**
 * Create Lace Lab Dip
 * POST /api/lace-lab-dips
 */
export const createLaceLabDipSchema = z
  .object({
    greigeLaceId: z.string().uuid('Invalid greige lace ID'),
    targetColor: z.string().min(1, 'Target color is required').max(200),
    processorId: z.string().uuid('Invalid processor ID'),
    sampleQuantity: z.coerce.number().positive('Sample quantity must be positive'),
    colorRecipe: z.string().max(1000).optional(),
    costSheetId: z.string().uuid('Invalid cost sheet ID').optional(),
    styleId: z.string().uuid('Invalid style ID').optional(),
    labDipCost: z.coerce.number().nonnegative().optional(),
  })
  .passthrough();

/**
 * Update Lace Lab Dip
 * PUT /api/lace-lab-dips/:id
 */
export const updateLaceLabDipSchema = z
  .object({
    targetColor: z.string().min(1).max(200).optional(),
    colorRecipe: z.string().max(1000).optional(),
    sampleQuantity: z.coerce.number().positive().optional(),
    labDipCost: z.coerce.number().nonnegative().optional(),
    buyerRemarks: z.string().max(1000).optional(),
    rejectionReason: z.string().max(1000).optional(),
    approvalReference: z.string().max(200).optional(),
  })
  .passthrough();

/**
 * Update Lab Dip Status
 * POST /api/lace-lab-dips/:id/status
 */
export const updateLaceLabDipStatusSchema = z
  .object({
    status: z.nativeEnum(LaceLabDipStatus),
    buyerRemarks: z.string().max(1000).optional(),
    rejectionReason: z.string().max(1000).optional(),
    approvalReference: z.string().max(200).optional(),
  })
  .passthrough();

// ============================================================================
// Type Exports
// ============================================================================

export type CreateLaceLabDipInput = z.infer<typeof createLaceLabDipSchema>;
export type UpdateLaceLabDipInput = z.infer<typeof updateLaceLabDipSchema>;
export type UpdateLaceLabDipStatusInput = z.infer<typeof updateLaceLabDipStatusSchema>;
