/**
 * Processor Rate Card V2 Validation Schemas
 *
 * Zod schemas for matrix-based rate card management.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// SLAB SCHEMAS
// ============================================================================

const SlabDefinitionSchema = z.object({
  id: z.string().uuid().optional(),
  minQty: z.number().int().nonnegative(),
  maxQty: z.number().int().positive().nullable(),
  label: z.string().max(50).optional(),
});

/**
 * Update Slabs
 * POST /api/rate-cards/processors/:processorId/slabs
 */
export const updateSlabsSchema = z.object({
  slabs: z.array(SlabDefinitionSchema).min(1, 'At least one slab is required'),
});

// ============================================================================
// MATRIX SCHEMAS
// ============================================================================

const RateCellSchema = z.object({
  greigeId: z.string().uuid().optional(),
  laceId: z.string().uuid().optional(),
  slabId: z.string().uuid(),
  rate: z.number().nonnegative(),
});

/**
 * Save Matrix (Greige Fabric)
 * PUT /api/rate-cards/processors/:processorId/matrix
 */
export const saveMatrixSchema = z.object({
  rates: z.array(RateCellSchema).min(1, 'At least one rate is required'),
});

/**
 * Save Lace Matrix
 * PUT /api/rate-cards/processors/:processorId/lace-matrix
 */
export const saveLaceMatrixSchema = z.object({
  rates: z.array(RateCellSchema).min(1, 'At least one rate is required'),
});

// ============================================================================
// COPY RATES SCHEMA
// ============================================================================

/**
 * Copy Rates
 * POST /api/rate-cards/copy
 */
export const copyRatesSchema = z.object({
  sourceProcessorId: z.string().uuid('Invalid source processor ID'),
  targetProcessorId: z.string().uuid('Invalid target processor ID'),
  copyGreige: z.boolean().optional().default(true),
  copyLace: z.boolean().optional().default(true),
  overwrite: z.boolean().optional().default(false),
});

// ============================================================================
// LOOKUP SCHEMAS
// ============================================================================

/**
 * Lookup Rate (Greige Fabric)
 * POST /api/rate-cards/lookup
 */
export const lookupRateSchema = z.object({
  processorId: z.string().uuid('Invalid processor ID'),
  greigeId: z.string().uuid('Invalid greige ID'),
  quantity: z.number().positive('Quantity must be positive'),
});

/**
 * Lookup Lace Rate
 * POST /api/rate-cards/lookup-lace
 */
export const lookupLaceRateSchema = z.object({
  processorId: z.string().uuid('Invalid processor ID'),
  laceId: z.string().uuid('Invalid lace ID'),
  quantity: z.number().positive('Quantity must be positive'),
});

// ============================================================================
// Type Exports
// ============================================================================

export type UpdateSlabsInput = z.infer<typeof updateSlabsSchema>;
export type SaveMatrixInput = z.infer<typeof saveMatrixSchema>;
export type SaveLaceMatrixInput = z.infer<typeof saveLaceMatrixSchema>;
export type CopyRatesInput = z.infer<typeof copyRatesSchema>;
export type LookupRateInput = z.infer<typeof lookupRateSchema>;
export type LookupLaceRateInput = z.infer<typeof lookupLaceRateSchema>;
