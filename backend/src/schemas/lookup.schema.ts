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
 *
 * Note: code is optional - controller auto-generates from value if not provided
 * Note: isActive is always true on create (controller hardcodes it)
 */
export const createLookupSchema = z
  .object({
    category: z.string().min(1, 'Category is required').max(100),
    code: z.string().min(1).max(50).optional(), // Auto-generated from value if not provided
    value: z.string().min(1, 'Value is required').max(200),
    description: z.string().max(500).optional(),
    sortOrder: z.number().int().nonnegative().optional(),
  })
  .passthrough();

/**
 * Update Lookup
 * PUT /api/lookups/:id
 *
 * Note: category is not updatable (part of unique constraint)
 * Controller uses: value, code, description, sortOrder, isActive
 */
export const updateLookupSchema = z
  .object({
    value: z.string().min(1).max(200).optional(),
    code: z.string().min(1).max(50).optional(),
    description: z.string().max(500).optional().nullable(),
    sortOrder: z.number().int().nonnegative().optional(),
    isActive: z.boolean().optional(),
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
    .transform((val) => val.toLowerCase() === 'true')
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
