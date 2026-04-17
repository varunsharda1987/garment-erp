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
 */
export const createEmbroiderySchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  code: z.string().max(50).optional(),
  designNumber: z.string().max(50).optional(),
  description: z.string().max(500).optional(),
  supplierId: z.string().uuid('Invalid supplier ID').optional(),
  stitchCount: z.number().int().positive().optional(),
  threadColors: z.number().int().positive().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  repeatType: z.enum(['SINGLE', 'REPEAT', 'ALLOVER']).optional(),
  repeatWidth: z.number().positive().optional(),
  repeatHeight: z.number().positive().optional(),
  machineType: z.string().max(100).optional(),
  costPerPc: z.number().nonnegative().optional(),
  costPerStitch: z.number().nonnegative().optional(),
  leadTimeDays: z.number().int().nonnegative().optional(),
  imageUrl: z.string().max(500).optional(),
  isActive: z.boolean().optional().default(true),
  remarks: z.string().max(500).optional(),
});

/**
 * Update Embroidery Design
 * PUT /api/embroidery/:id
 */
export const updateEmbroiderySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  code: z.string().max(50).optional().nullable(),
  designNumber: z.string().max(50).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  supplierId: z.string().uuid('Invalid supplier ID').optional().nullable(),
  stitchCount: z.number().int().positive().optional().nullable(),
  threadColors: z.number().int().positive().optional().nullable(),
  width: z.number().positive().optional().nullable(),
  height: z.number().positive().optional().nullable(),
  repeatType: z.enum(['SINGLE', 'REPEAT', 'ALLOVER']).optional(),
  repeatWidth: z.number().positive().optional().nullable(),
  repeatHeight: z.number().positive().optional().nullable(),
  machineType: z.string().max(100).optional().nullable(),
  costPerPc: z.number().nonnegative().optional().nullable(),
  costPerStitch: z.number().nonnegative().optional().nullable(),
  leadTimeDays: z.number().int().nonnegative().optional().nullable(),
  imageUrl: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
  remarks: z.string().max(500).optional().nullable(),
});

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
    .transform((val) => val === 'true')
    .optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateEmbroideryInput = z.infer<typeof createEmbroiderySchema>;
export type UpdateEmbroideryInput = z.infer<typeof updateEmbroiderySchema>;
export type EmbroideryQueryInput = z.infer<typeof embroideryQuerySchema>;
