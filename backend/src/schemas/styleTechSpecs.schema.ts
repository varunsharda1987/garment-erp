/**
 * Style Tech Specs Validation Schemas
 *
 * Zod schemas for style technical specifications.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// STYLE TECH SPECS SCHEMAS
// ============================================================================

/**
 * Save Tech Specs
 * PUT /api/styles/:styleId/tech-specs
 */
// NOTE: these fields mirror EXACTLY what style-tech-specs.controller.ts reads from req.body
// and what the style_tech_specs Prisma model persists. They previously diverged completely, so
// Zod silently stripped 8 of 10 fields on every save (200 OK, data lost). Keep this in lockstep
// with the controller + model.
export const saveTechSpecsSchema = z.object({
  // Lengths — Decimal(10,2)? in the DB; accept a number or numeric string, allow null/absent
  overallLength: z.coerce.number().nonnegative().nullable().optional(),
  topLength: z.coerce.number().nonnegative().nullable().optional(),
  bottomLength: z.coerce.number().nonnegative().nullable().optional(),
  lengthUnit: z.string().max(20).optional(),

  // Style attributes (String? in the DB)
  sleeveType: z.string().max(100).nullable().optional(),
  collarType: z.string().max(100).nullable().optional(),
  fitType: z.string().max(100).nullable().optional(),
  closureType: z.string().max(100).nullable().optional(),

  // Notes (Text? in the DB)
  designNotes: z.string().max(2000).nullable().optional(),
  constructionNotes: z.string().max(2000).nullable().optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type SaveTechSpecsInput = z.infer<typeof saveTechSpecsSchema>;
