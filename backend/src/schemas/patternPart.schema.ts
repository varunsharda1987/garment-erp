/**
 * Pattern Part Validation Schemas
 *
 * Zod schemas for pattern part CRUD operations.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// PATTERN PART SCHEMAS
// ============================================================================

/**
 * Create Pattern Part
 * POST /api/pattern-parts
 */
export const createPatternPartSchema = z.object({
  code: z.string().min(1, 'Code is required').max(50),
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(500).optional(),
  category: z.string().max(50).optional(),
  defaultConsumption: z.number().positive().optional(),
  unit: z.string().max(20).optional().default('PIECE'),
  sortOrder: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional().default(true),
  remarks: z.string().max(500).optional(),
});

/**
 * Update Pattern Part
 * PUT /api/pattern-parts/:id
 */
export const updatePatternPartSchema = z.object({
  code: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional().nullable(),
  category: z.string().max(50).optional().nullable(),
  defaultConsumption: z.number().positive().optional().nullable(),
  unit: z.string().max(20).optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
  remarks: z.string().max(500).optional().nullable(),
});

/**
 * Reorder Pattern Parts
 * POST /api/pattern-parts/reorder
 */
export const reorderPatternPartsSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1, 'At least one ID is required'),
});

/**
 * Pattern Part Query Params
 * GET /api/pattern-parts
 */
export const patternPartQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  search: z.string().max(100).optional(),
  category: z.string().max(50).optional(),
  isActive: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
});

// ============================================================================
// Param Validation Schemas
// ============================================================================

export const patternPartIdParamSchema = z.object({
  id: z.string().uuid('Invalid pattern part ID'),
});

export const patternPartCodeParamSchema = z.object({
  code: z.string().min(1, 'Code is required').max(50),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreatePatternPartInput = z.infer<typeof createPatternPartSchema>;
export type UpdatePatternPartInput = z.infer<typeof updatePatternPartSchema>;
export type ReorderPatternPartsInput = z.infer<typeof reorderPatternPartsSchema>;
export type PatternPartQueryInput = z.infer<typeof patternPartQuerySchema>;
