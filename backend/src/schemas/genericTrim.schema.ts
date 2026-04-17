/**
 * Generic Trim Validation Schemas
 *
 * Zod schemas for generic trim CRUD operations.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const TrimTypeEnum = z.enum([
  'hook_eye',
  'snap_button',
  'buckle',
  'velcro',
  'drawstring',
  'ribbon',
  'sequin',
  'bead',
  'motif',
  'interlining',
  'padding',
]);

// ============================================================================
// GENERIC TRIM SCHEMAS
// ============================================================================

/**
 * Create Generic Trim
 * POST /api/generic-trims/:trimType
 */
export const createGenericTrimSchema = z.object({
  code: z.string().max(50).optional(),
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(500).optional(),
  category: z.string().max(100).optional(),
  material: z.string().max(100).optional(),
  color: z.string().max(50).optional(),
  size: z.string().max(50).optional(),
  unit: z.string().max(20).optional().default('PCS'),
  supplierId: z.string().uuid('Invalid supplier ID').optional(),
  price: z.number().nonnegative().optional(),
  minOrderQty: z.number().int().nonnegative().optional(),
  leadTimeDays: z.number().int().nonnegative().optional(),
  hsnCode: z.string().max(20).optional(),
  gstRate: z.number().min(0).max(100).optional(),
  isActive: z.boolean().optional().default(true),
  specifications: z.record(z.string(), z.unknown()).optional(),
  remarks: z.string().max(500).optional(),
});

/**
 * Update Generic Trim
 * PUT /api/generic-trims/:trimType/:id
 */
export const updateGenericTrimSchema = z.object({
  code: z.string().max(50).optional().nullable(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  material: z.string().max(100).optional().nullable(),
  color: z.string().max(50).optional().nullable(),
  size: z.string().max(50).optional().nullable(),
  unit: z.string().max(20).optional(),
  supplierId: z.string().uuid('Invalid supplier ID').optional().nullable(),
  price: z.number().nonnegative().optional().nullable(),
  minOrderQty: z.number().int().nonnegative().optional().nullable(),
  leadTimeDays: z.number().int().nonnegative().optional().nullable(),
  hsnCode: z.string().max(20).optional().nullable(),
  gstRate: z.number().min(0).max(100).optional().nullable(),
  isActive: z.boolean().optional(),
  specifications: z.record(z.string(), z.unknown()).optional().nullable(),
  remarks: z.string().max(500).optional().nullable(),
});

/**
 * Query Generic Trims
 * GET /api/generic-trims/:trimType
 */
export const genericTrimQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  search: z.string().max(100).optional(),
  category: z.string().max(100).optional(),
  supplierId: z.string().uuid().optional(),
  isActive: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateGenericTrimInput = z.infer<typeof createGenericTrimSchema>;
export type UpdateGenericTrimInput = z.infer<typeof updateGenericTrimSchema>;
export type GenericTrimQueryInput = z.infer<typeof genericTrimQuerySchema>;
