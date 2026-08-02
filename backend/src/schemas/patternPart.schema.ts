/**
 * Pattern Part Validation Schemas
 *
 * Zod schemas for pattern part CRUD operations.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 *
 * NOTE: These schemas were consolidated from backend/src/types/patternPart.types.ts
 * (which previously held a diverging duplicate set). Routes apply them via
 * validateBody(); the controller consumes typed req.body — do NOT re-parse in
 * the controller.
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
  code: z.string().min(1, 'Code is required').max(50, 'Code must be at most 50 characters'),
  name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
  description: z.string().optional().nullable(),
  sortOrder: z.number().int().min(0).optional().default(0),
  isActive: z.boolean().optional().default(true),
  componentGroupIds: z.array(z.string().uuid()).optional(), // Array of component group IDs
});

/**
 * Update Pattern Part
 * PUT /api/pattern-parts/:id
 *
 * Partial update — intentionally NO .default()s so validateBody injects nothing
 * into partial payloads.
 */
export const updatePatternPartSchema = z.object({
  code: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  componentGroupIds: z.array(z.string().uuid()).optional(), // Array of component group IDs
});

/**
 * Reorder Pattern Parts
 * POST /api/pattern-parts/reorder
 */
export const reorderPatternPartsSchema = z.object({
  orders: z
    .array(
      z.object({
        id: z.string().uuid(),
        sortOrder: z.number().int().min(0),
      })
    )
    .min(1, 'At least one order entry is required'),
});

/**
 * Add Pattern Part to Component
 * POST /api/components/:componentId/pattern-parts
 */
export const addComponentPatternPartSchema = z.object({
  patternPartId: z.string().uuid('Invalid pattern part ID'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1').default(1),
  isRequired: z.boolean().optional().default(true),
  notes: z.string().optional().nullable(),
});

/**
 * Update Component-Pattern Part Association
 * PUT /api/components/:componentId/pattern-parts/:patternPartId
 *
 * Partial update — intentionally NO .default()s.
 */
export const updateComponentPatternPartSchema = z.object({
  quantity: z.number().int().min(1).optional(),
  isRequired: z.boolean().optional(),
  notes: z.string().optional().nullable(),
});

/**
 * Pattern Part Query Params
 * GET /api/pattern-parts
 * BUG-PP4 fix: category field was removed as dead code - service only uses page, limit, search, isActive
 */
export const patternPartQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  search: z.string().max(100).optional(),
  isActive: z
    .string()
    .transform((val) => val.toLowerCase() === 'true')
    .optional(),
});

// ============================================================================
// Param Validation Schemas
// ============================================================================

export const patternPartIdParamSchema = z.object({
  id: z.string().uuid('Invalid pattern part ID'),
});

// bug-hunt: param schema for routes using :patternPartId
export const patternPartIdRouteParamSchema = z.object({
  patternPartId: z.string().uuid('Invalid pattern part ID'),
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
export type AddComponentPatternPartInput = z.infer<typeof addComponentPatternPartSchema>;
export type UpdateComponentPatternPartInput = z.infer<typeof updateComponentPatternPartSchema>;
export type PatternPartQueryInput = z.infer<typeof patternPartQuerySchema>;
