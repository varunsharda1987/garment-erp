/**
 * Component Masters Validation Schemas
 *
 * Zod schemas for component master CRUD operations.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const ComponentCategoryEnum = z.enum([
  'BUTTON',
  'ZIPPER',
  'ELASTIC',
  'LABEL',
  'TAG',
  'THREAD',
  'INTERLINING',
  'TAPE',
  'HOOK',
  'BUCKLE',
  'RIVET',
  'SNAP',
  'VELCRO',
  'DRAWCORD',
  'OTHER',
]);

// ============================================================================
// COMPONENT MASTER SCHEMAS
// ============================================================================

/**
 * Create Component Master
 * POST /api/component-masters
 * Field names match frontend ComponentMasterFormData
 */
// BUG-CM1/CM2 fix: Removed 11 fields that don't exist in Prisma model (silent data loss)
// Removed: code, category, subcategory, unit, hsnCode, gstRate, supplierId, specifications, minOrderQty, leadTimeDays, remarks
export const createComponentMasterSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(500).optional(),
  /** @deprecated Use componentGroupId instead. Kept for backward compatibility. */
  componentCategory: z.string().max(100).optional(),
  componentGroupId: z.string().uuid('Component group ID is required'),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional().default(true),
});

/**
 * Update Component Master
 * PUT /api/component-masters/:id
 * Field names match frontend ComponentMasterFormData
 */
// BUG-CM1/CM2 fix: Removed non-existent fields from update schema too
export const updateComponentMasterSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional().nullable(),
  /** @deprecated Use componentGroupId instead. Kept for backward compatibility. */
  componentCategory: z.string().max(100).optional().nullable(),
  componentGroupId: z.string().uuid('Invalid component group ID').optional().nullable(),
  sortOrder: z.number().int().optional().nullable(),
  isActive: z.boolean().optional(),
});

/**
 * Component Master Query Params
 * GET /api/component-masters
 */
export const componentMasterQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  search: z.string().max(100).optional(),
  componentCategory: z.string().max(100).optional(),
  componentGroupId: z.string().uuid().optional(),
  activeOnly: z.string().optional(),
});

// ============================================================================
// Param Validation Schemas
// ============================================================================

export const componentMasterIdParamSchema = z.object({
  id: z.string().uuid('Invalid component master ID'),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateComponentMasterInput = z.infer<typeof createComponentMasterSchema>;
export type UpdateComponentMasterInput = z.infer<typeof updateComponentMasterSchema>;
export type ComponentMasterQueryInput = z.infer<typeof componentMasterQuerySchema>;
