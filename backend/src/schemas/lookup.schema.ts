/**
 * Lookup Validation Schemas
 *
 * Zod schemas for lookup CRUD operations.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// LOOKUP SCHEMAS
// ============================================================================

/**
 * Create Lookup
 * POST /api/lookups
 */
export const createLookupSchema = z
  .object({
    category: z.string().min(1, 'Category is required').max(100),
    code: z.string().min(1, 'Code is required').max(50),
    value: z.string().min(1, 'Value is required').max(200),
    description: z.string().max(500).optional(),
    sortOrder: z.number().int().nonnegative().optional(),
    isDefault: z.boolean().optional().default(false),
    isActive: z.boolean().optional().default(true),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

/**
 * Update Lookup
 * PUT /api/lookups/:id
 */
export const updateLookupSchema = z
  .object({
    category: z.string().min(1).max(100).optional(),
    code: z.string().min(1).max(50).optional(),
    value: z.string().min(1).max(200).optional(),
    description: z.string().max(500).optional().nullable(),
    sortOrder: z.number().int().nonnegative().optional(),
    isDefault: z.boolean().optional(),
    isActive: z.boolean().optional(),
    metadata: z.record(z.string(), z.unknown()).optional().nullable(),
  })
  .passthrough();

/**
 * Bulk Create Lookups
 * POST /api/lookups/bulk
 * Controller expects: { lookups: [{ category, values: string[] }] }
 */
// bulkCreateLookups reads { category, values } from the body — a single category with many values —
// not a `lookups` array. Requiring `lookups` meant a correct call was rejected while the fields the
// controller actually uses were stripped.
export const bulkCreateLookupsSchema = z.object({
  category: z.string().min(1).max(100),
  values: z.array(z.string().min(1).max(200)).min(1, 'At least one value is required'),
});

/**
 * Query Lookups
 * GET /api/lookups
 */
export const lookupQuerySchema = z.object({
  category: z.string().max(100).optional(),
  isActive: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
  search: z.string().max(100).optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateLookupInput = z.infer<typeof createLookupSchema>;
export type UpdateLookupInput = z.infer<typeof updateLookupSchema>;
export type BulkCreateLookupsInput = z.infer<typeof bulkCreateLookupsSchema>;
export type LookupQueryInput = z.infer<typeof lookupQuerySchema>;
