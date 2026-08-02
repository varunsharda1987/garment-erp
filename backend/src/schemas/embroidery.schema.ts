/**
 * Embroidery Master Validation Schemas
 *
 * Zod schemas for embroidery design CRUD operations.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// EMBROIDERY SCHEMAS
// ============================================================================

/**
 * Create Embroidery Design
 * POST /api/embroidery
 * Field names match frontend CreateEmbroideryRequest
 */
export const createEmbroiderySchema = z
  .object({
    designName: z.string().min(1, 'Design name is required').max(200),
    description: z.string().max(500).optional().nullable(),
    designFile: z.string().max(500).optional().nullable(),
    designImage: z.string().max(500).optional().nullable(),
    // Use z.coerce.number() to handle string input from forms (controller uses parseInt/parseFloat)
    stitchCount: z.coerce.number().int().positive().optional().nullable(),
    threadColors: z.coerce.number().int().positive().optional().nullable(),
    repeatWidth: z.coerce.number().positive().optional().nullable(),
    repeatHeight: z.coerce.number().positive().optional().nullable(),
    // minFabricWidth removed: no such column on embroidery_master (bug-hunt samples-embroidery-9)
    usableWidthAfter: z.coerce.number().positive('Usable width after is required'),
    costPerMeter: z.coerce.number().nonnegative().optional(),
    supplierId: z.string().uuid('Invalid supplier ID').optional().nullable(),
    leadTimeDays: z.coerce.number().int().nonnegative().optional().nullable(),
    originalStyleId: z.string().uuid('Invalid style ID').optional().nullable(),
    cutableWidth: z.coerce.number().positive().optional().nullable(),
    isActive: z.boolean().optional().default(true),
  })
  .passthrough();

/**
 * Update Embroidery Design
 * PUT /api/embroidery/:id
 * Field names match frontend UpdateEmbroideryRequest
 */
export const updateEmbroiderySchema = z
  .object({
    designName: z.string().min(1).max(200).optional(),
    description: z.string().max(500).optional().nullable(),
    designFile: z.string().max(500).optional().nullable(),
    designImage: z.string().max(500).optional().nullable(),
    // Use z.coerce.number() to handle string input from forms (controller uses parseInt/parseFloat)
    stitchCount: z.coerce.number().int().positive().optional().nullable(),
    threadColors: z.coerce.number().int().positive().optional().nullable(),
    repeatWidth: z.coerce.number().positive().optional().nullable(),
    repeatHeight: z.coerce.number().positive().optional().nullable(),
    usableWidthAfter: z.coerce.number().positive().optional().nullable(),
    costPerMeter: z.coerce.number().nonnegative().optional().nullable(),
    supplierId: z.string().uuid('Invalid supplier ID').optional().nullable(),
    leadTimeDays: z.coerce.number().int().nonnegative().optional().nullable(),
    originalStyleId: z.string().uuid('Invalid style ID').optional().nullable(),
    cutableWidth: z.coerce.number().positive().optional().nullable(),
    isActive: z.boolean().optional(),
  })
  .passthrough();

/**
 * Embroidery Query Params
 * GET /api/embroidery
 */
export const embroideryQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  search: z.string().max(100).optional(),
  supplierId: z.string().uuid().optional(),
  isActive: z
    .string()
    .transform((val) => val.toLowerCase() === 'true')
    .optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateEmbroideryInput = z.infer<typeof createEmbroiderySchema>;
export type UpdateEmbroideryInput = z.infer<typeof updateEmbroiderySchema>;
export type EmbroideryQueryInput = z.infer<typeof embroideryQuerySchema>;
