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
  // NOT .uuid(): the frontend sends a `temp-N` placeholder for not-yet-persisted slabs,
  // which the service resolves via slabIdMap before writing (bug-hunt BH-0322).
  slabId: z.string(),
  // The field is `ratePerMeter` everywhere (frontend, controller, service) — it was named
  // `rate` here, which is why every matrix save 400'd (bug-hunt BH-0322).
  ratePerMeter: z.number().nonnegative(),
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
    // Frontend sends an ARRAY of { greigeId, shrinkagePercent }, not a record/map.
    // shrinkagePercent is bounded below 100: `1 - shrinkage/100` is used as a divisor in
    // shrinkage costing, so 100 would divide by zero and write Infinity (bug-hunt BH-0322/BH-0366).
    shrinkages: z
      .array(
        z.object({
          greigeId: z.string(),
          shrinkagePercent: z.number().min(0).lt(100).nullable(),
        })
      )
      .optional(),
    deletedGreigeIds: z.array(z.string().uuid()).optional(),
  })
  .passthrough();

/**
 * Save Lace Matrix
 * PUT /api/rate-cards/processors/:processorId/lace-matrix
 */
export const saveLaceMatrixSchema = z
  .object({
    // Allow empty array for deleting all lace rows (BUG-PRC10: .min(1) was blocking valid delete-all)
    rates: z.array(RateCellSchema),
    slabs: z.array(SlabDefinitionSchema).optional(),
    deletedLaceIds: z.array(z.string().uuid()).optional(),
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
    // NOTE: The service always deletes target rates before copying (implicit overwrite).
    // An explicit `overwrite` toggle is not implemented.
  })
  .passthrough();

// ============================================================================
// ADD GREIGE SCHEMA
// ============================================================================

/**
 * Add Greige Row
 * POST /api/rate-cards/processors/:processorId/greiges/:greigeId
 *
 * processorId/greigeId come from the route params (validated by processorGreigeParamSchema);
 * the body carries ONLY processingType (+ printingType for PRINTING) — exactly what the
 * controller destructures.
 *
 * printingType stays OPTIONAL here on purpose: the controller already enforces
 * "required when processingType === 'PRINTING'" with a specific 400 message, and the frontend
 * omits the field entirely for DYEING. Its values match the Prisma `PrintingType` enum.
 */
export const addGreigeSchema = z
  .object({
    processingType: z.enum(['DYEING', 'PRINTING']),
    printingType: z.enum(['PIGMENT', 'PROCIAN', 'DISCHARGE', 'PIGMENT_DISCHARGE']).optional(),
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
export type AddGreigeInput = z.infer<typeof addGreigeSchema>;
export type LookupRateInput = z.infer<typeof lookupRateSchema>;
export type LookupLaceRateInput = z.infer<typeof lookupLaceRateSchema>;
