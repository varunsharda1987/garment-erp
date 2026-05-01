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
  slabOrder: z.number().int().nonnegative(),
  minQuantity: z.number().int().nonnegative(),
  maxQuantity: z.number().int().positive().nullable(),
  slabLabel: z.string().max(50).optional(),
});

/**
 * Update Slabs
 * POST /api/rate-cards/processors/:processorId/slabs
 */
export const updateSlabsSchema = z
  .object({
    processingType: z.string().max(50).optional(),
    slabs: z.array(SlabDefinitionSchema).min(1, 'At least one slab is required'),
  })
  .passthrough();

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
export const saveMatrixSchema = z
  .object({
    processingType: z.string().max(50).optional(),
    printingType: z.string().max(50).optional(),
    rates: z.array(RateCellSchema).min(1, 'At least one rate is required'),
    slabs: z.array(SlabDefinitionSchema).optional(),
    shrinkages: z.record(z.string(), z.number()).optional(),
    deletedGreigeIds: z.array(z.string().uuid()).optional(),
  })
  .passthrough();

/**
 * Save Lace Matrix
 * PUT /api/rate-cards/processors/:processorId/lace-matrix
 */
export const saveLaceMatrixSchema = z
  .object({
    rates: z.array(RateCellSchema).min(1, 'At least one rate is required'),
  })
  .passthrough();

// ============================================================================
// COPY RATES SCHEMA
// ============================================================================

/**
 * Copy Rates
 * POST /api/rate-cards/copy
 */
export const copyRatesSchema = z
  .object({
    sourceProcessorId: z.string().uuid('Invalid source processor ID'),
    targetProcessorId: z.string().uuid('Invalid target processor ID'),
    processingType: z.string().max(50).optional(),
    printingType: z.string().max(50).optional(),
    copySlabs: z.boolean().optional().default(true),
    copyRates: z.boolean().optional().default(true),
    overwrite: z.boolean().optional().default(false),
  })
  .passthrough();

// ============================================================================
// LOOKUP SCHEMAS
// ============================================================================

/**
 * Lookup Rate (Greige Fabric)
 * POST /api/rate-cards/lookup
 */
export const lookupRateSchema = z
  .object({
    processorId: z.string().uuid('Invalid processor ID').optional(),
    greigeId: z.string().uuid('Invalid greige ID'),
    quantityMeters: z.number().positive('Quantity must be positive'),
    processingType: z.string().max(50).optional(),
    printingType: z.string().max(50).optional(),
  })
  .passthrough();

/**
 * Lookup Lace Rate
 * POST /api/rate-cards/lookup-lace
 */
export const lookupLaceRateSchema = z
  .object({
    processorId: z.string().uuid('Invalid processor ID').optional(),
    laceId: z.string().uuid('Invalid lace ID'),
    quantityMeters: z.number().positive('Quantity must be positive'),
    processingType: z.string().max(50).optional(),
    printingType: z.string().max(50).optional(),
  })
  .passthrough();

// ============================================================================
// Param Validation Schemas
// ============================================================================

export const processorIdParamSchema = z.object({
  processorId: z.string().uuid('Invalid processor ID'),
});

export const processorGreigeParamSchema = z.object({
  processorId: z.string().uuid('Invalid processor ID'),
  greigeId: z.string().uuid('Invalid greige ID'),
});

export const processorLaceParamSchema = z.object({
  processorId: z.string().uuid('Invalid processor ID'),
  laceId: z.string().uuid('Invalid lace ID'),
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
