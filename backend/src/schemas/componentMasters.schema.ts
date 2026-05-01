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
export const createComponentMasterSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  code: z.string().max(50).optional(),
  description: z.string().max(500).optional(),
  componentCategory: z.string().max(100).optional(),
  componentGroupId: z.string().uuid('Component group ID is required'), // Required - every component must belong to a group
  sortOrder: z.number().int().optional(),
  category: ComponentCategoryEnum.optional(),
  subcategory: z.string().max(100).optional(),
  unit: z.string().max(20).optional().default('PIECE'),
  hsnCode: z.string().max(20).optional(),
  gstRate: z.number().min(0).max(100).optional(),
  supplierId: z.string().uuid('Invalid supplier ID').optional(),
  specifications: z.record(z.string(), z.unknown()).optional(),
  minOrderQty: z.number().positive().optional(),
  leadTimeDays: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional().default(true),
  remarks: z.string().max(500).optional(),
});

/**
 * Update Component Master
 * PUT /api/component-masters/:id
 * Field names match frontend ComponentMasterFormData
 */
export const updateComponentMasterSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  code: z.string().max(50).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  componentCategory: z.string().max(100).optional().nullable(),
  componentGroupId: z.string().uuid('Invalid component group ID').optional().nullable(),
  sortOrder: z.number().int().optional().nullable(),
  category: ComponentCategoryEnum.optional(),
  subcategory: z.string().max(100).optional().nullable(),
  unit: z.string().max(20).optional(),
  hsnCode: z.string().max(20).optional().nullable(),
  gstRate: z.number().min(0).max(100).optional().nullable(),
  supplierId: z.string().uuid('Invalid supplier ID').optional().nullable(),
  specifications: z.record(z.string(), z.unknown()).optional().nullable(),
  minOrderQty: z.number().positive().optional().nullable(),
  leadTimeDays: z.number().int().nonnegative().optional().nullable(),
  isActive: z.boolean().optional(),
  remarks: z.string().max(500).optional().nullable(),
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
