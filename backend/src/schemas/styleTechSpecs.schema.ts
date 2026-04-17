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
export const saveTechSpecsSchema = z.object({
  // Garment details
  garmentType: z.string().max(100).optional(),
  silhouette: z.string().max(100).optional(),
  sleeveType: z.string().max(100).optional(),
  necklineType: z.string().max(100).optional(),
  hemType: z.string().max(100).optional(),
  fitType: z.string().max(100).optional(),

  // Construction details
  constructionMethod: z.string().max(100).optional(),
  seamType: z.string().max(100).optional(),
  finishType: z.string().max(100).optional(),

  // Measurements (JSON object for size-wise measurements)
  measurements: z.record(z.string(), z.unknown()).optional(),

  // Wash care
  washCare: z.array(z.string()).optional(),
  careInstructions: z.string().max(1000).optional(),

  // Additional specs
  packingInstructions: z.string().max(1000).optional(),
  qualityNotes: z.string().max(1000).optional(),
  specialInstructions: z.string().max(2000).optional(),

  // Custom specs (key-value pairs)
  customSpecs: z.record(z.string(), z.unknown()).optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type SaveTechSpecsInput = z.infer<typeof saveTechSpecsSchema>;
