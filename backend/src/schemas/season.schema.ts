/**
 * Season Master Validation Schemas
 *
 * Zod schemas for season master CRUD operations.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const SeasonTypeEnum = z.enum(['SS', 'AW']);

// ============================================================================
// SEASON SCHEMAS
// ============================================================================

/**
 * Create Season
 * POST /api/seasons
 */
export const createSeasonSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  code: z.string().max(20).optional(),
  type: SeasonTypeEnum,
  year: z.number().int().min(2000).max(2100),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional().default(true),
});

/**
 * Update Season
 * PUT /api/seasons/:id
 */
export const updateSeasonSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  code: z.string().max(20).optional().nullable(),
  type: SeasonTypeEnum.optional(),
  year: z.number().int().min(2000).max(2100).optional(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
});

/**
 * Generate Seasons
 * POST /api/seasons/generate
 */
export const generateSeasonsSchema = z
  .object({
    startYear: z.number().int().min(2000).max(2100),
    endYear: z.number().int().min(2000).max(2100),
  })
  .refine((data) => data.endYear >= data.startYear, {
    message: 'End year must be >= start year',
    path: ['endYear'],
  });

/**
 * Season Query Params
 * GET /api/seasons
 */
export const seasonQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  search: z.string().max(100).optional(),
  type: SeasonTypeEnum.optional(),
  year: z.string().transform(Number).pipe(z.number().int()).optional(),
  isActive: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateSeasonInput = z.infer<typeof createSeasonSchema>;
export type UpdateSeasonInput = z.infer<typeof updateSeasonSchema>;
export type GenerateSeasonsInput = z.infer<typeof generateSeasonsSchema>;
export type SeasonQueryInput = z.infer<typeof seasonQuerySchema>;
