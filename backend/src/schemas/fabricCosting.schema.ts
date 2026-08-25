/**
 * Fabric Costing Validation Schemas
 *
 * Zod schemas for fabric costing calculations and options.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// Helper for validating IDs that can be UUID or CUID (color_master uses CUID)
const isValidIdFormat = (val: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val) || /^c[a-z0-9]{20,}$/i.test(val);

// ============================================================================
// RATE LOOKUP SCHEMAS
// ============================================================================

/**
 * Lookup Processor Rate
 * POST /api/fabric-costing/lookup-rate
 *
 * Aligned with frontend (fabricCosting.service.ts) and controller (fabric-costing.controller.ts:519-594)
 */
export const lookupRateSchema = z.object({
  processorId: z.string().uuid('Invalid processor ID'),
  processingType: z.enum(['DYEING', 'PRINTING']),
  printingType: z.enum(['PIGMENT', 'PROCIAN', 'DISCHARGE', 'PIGMENT_DISCHARGE']).optional(),
  greigeId: z.string().uuid('Invalid greige ID'),
  quantityMeters: z.number().positive('Quantity must be greater than 0'),
});

// ============================================================================
// SAVE COSTING SCHEMAS
// ============================================================================

/**
 * Save Fabric Costing
 * POST /api/fabric-costing/save
 *
 * Aligned with frontend (FabricCostingSaveItem type) and controller (fabric-costing.controller.ts:601-670)
 */
export const saveFabricCostingSchema = z.object({
  styleId: z.string().uuid('Invalid style ID'),
  fabricCostings: z
    .array(
      z
        .object({
          // Record identification
          fabricWidthCadId: z.string().uuid().nullable().optional(),
          cloneFromCadId: z.string().uuid().optional(),
          styleFabricId: z.string().uuid().nullable().optional(),
          // Nullable: generic fabrics have no fabric_master link; save path never reads it
          fabricId: z.string().uuid('Invalid fabric ID').nullable().optional(),
          // Greige and Transport
          greigeId: z.string().uuid().nullable().optional(),
          greigeCostPerMeter: z.number().nonnegative().nullable().optional(),
          transportCostPerMeter: z.number().nonnegative().nullable().optional(),
          // Processing
          processorId: z.string().uuid().nullable().optional(),
          // MRP-48d: the rate card the row was priced against. Declared here or validateBody
          // strips it (req.body = schema.parse) and the link never reaches the DB.
          rateCardId: z.string().uuid().nullable().optional(),
          processingCostPerMeter: z.number().nonnegative().nullable().optional(),
          // Shrinkage
          shrinkagePercent: z.number().min(0).lt(100).nullable().optional(), // MRP-48h: lt(100) not max(100) — this feeds `1 - x/100` as a divisor; 100 is a divide-by-zero
          shrinkageCostPerMeter: z.number().nonnegative().nullable().optional(),
          // Screen cost (for printing)
          screenCostPerMeter: z.number().nonnegative().nullable().optional(),
          screenType: z.enum(['ROTARY', 'FLATBELT', 'TABLE']).nullable().optional(),
          numberOfColors: z.number().int().nonnegative().nullable().optional(),
          // Totals
          totalCostPerMeter: z.number().nonnegative().nullable().optional(),
          // Metadata
          costInputMode: z.enum(['LANDED_PRICE', 'BUILD_UP']).nullable().optional(),
          orderQuantityPcs: z.number().int().nonnegative().nullable().optional(),
          // Qty-rate audit 2026-08-24: the EXACT meters the slab lookup used (batch-group
          // total when batched) — the basis every downstream rate re-check compares against
          costedAtQuantityMeters: z.number().nonnegative().nullable().optional(),
          costedRateIsBatch: z.boolean().optional(),
          purpose: z.enum(['COSTING', 'RAW_MATERIAL_CALCULATION', 'PRODUCTION']).optional(),
          processingBatchGroupColorId: z
            .string()
            .refine(isValidIdFormat, { message: 'Invalid color ID' })
            .nullable()
            .optional(),
        })
        .passthrough() // Allow additional fields for flexibility
    )
    .min(1, 'At least one fabric is required'),
  runId: z.string().uuid('Invalid run ID').optional(),
  costSheetId: z.string().uuid('Invalid cost sheet ID').optional(),
});

// ============================================================================
// COSTING OPTIONS SCHEMAS
// ============================================================================

/**
 * Get Costing Options Query
 * GET /api/fabric-costing/options
 *
 * Aligned with controller (fabric-costing.controller.ts:947-1135)
 */
export const costingOptionsQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  styleId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  processorId: z.string().uuid().optional(),
  status: z.enum(['APPROVED', 'PENDING']).optional(),
  purpose: z.enum(['ALL', 'COSTING', 'RAW_MATERIAL_CALCULATION', 'PRODUCTION']).optional(),
  search: z.string().max(100).optional(),
});

/**
 * Approve Costing Option
 * POST /api/fabric-costing/option/:optionId/approve
 */
export const approveCostingOptionSchema = z.object({
  remarks: z.string().max(500).optional(),
});

/**
 * Unapprove Costing Option
 * PATCH /api/fabric-costing/option/:optionId/unapprove
 */
export const unapproveCostingOptionSchema = z.object({
  reason: z.string().max(500).optional(),
  // ESSKY091LS guard: acknowledges the 409 COSTING_OPTION_IN_USE warning — the
  // option's rate is frozen into downstream documents and they will show drift.
  confirmImpact: z.boolean().optional(),
});

/**
 * Promote Costing Option
 * POST /api/fabric-costing/option/:optionId/promote
 *
 * Aligned with controller (fabric-costing.controller.ts:1306-1374)
 */
export const promoteCostingOptionSchema = z
  .object({
    targetPurpose: z.enum(['RAW_MATERIAL_CALCULATION', 'PRODUCTION']),
  })
  .passthrough();

// ============================================================================
// STYLES COSTING STATUS SCHEMAS
// ============================================================================

/**
 * Get Styles Costing Status
 * POST /api/fabric-costing/styles/costing-status
 */
export const stylesCostingStatusSchema = z.object({
  styleIds: z.array(z.string().uuid()).min(1, 'At least one style ID is required'),
});

// ============================================================================
// CAD TO COSTING PUSH SCHEMAS
// ============================================================================

/**
 * Check CAD Costing Status
 * POST /api/fabric-costing/check-cad-status
 *
 * Aligned with controller (fabric-costing.controller.ts:1446-1497)
 */
export const checkCADCostingStatusSchema = z
  .object({
    styleId: z.string().uuid('Invalid style ID'),
    cadRowIds: z.array(z.string().uuid()).min(1, 'At least one CAD row ID is required'),
  })
  .passthrough();

/**
 * Push From CAD
 * POST /api/fabric-costing/push-from-cad
 *
 * Aligned with controller (fabric-costing.controller.ts:1504-1599)
 */
export const pushFromCADSchema = z
  .object({
    styleId: z.string().uuid('Invalid style ID'),
    cadRowIds: z.array(z.string().uuid()).min(1, 'At least one CAD row ID is required'),
  })
  .passthrough();

// ============================================================================
// CALCULATION SCHEMAS
// ============================================================================

/**
 * Calculate Single Fabric Cost
 * POST /api/fabric-costing/calculate
 *
 * Aligned with controller (fabric-costing.controller.ts:18-40)
 */
export const calculateSingleCostSchema = z
  .object({
    fabricId: z.string().uuid('Invalid fabric ID'),
    cadMeters: z.union([z.number().positive(), z.string()]),
    width: z.union([z.number().positive(), z.string()]),
    orderQuantity: z.union([z.number().int().positive(), z.string()]).optional(),
    styleId: z.string().uuid('Invalid style ID').optional(),
  })
  .passthrough();

/**
 * Calculate Batch Fabric Cost
 * POST /api/fabric-costing/batch-calculate
 *
 * Aligned with controller (fabric-costing.controller.ts:46-93)
 */
export const calculateBatchCostSchema = z
  .object({
    fabrics: z
      .array(
        z
          .object({
            fabricId: z.string().uuid('Invalid fabric ID'),
            cadMeters: z.union([z.number().positive(), z.string()]),
            width: z.union([z.number().positive(), z.string()]),
          })
          .passthrough()
      )
      .min(1, 'At least one fabric is required'),
    orderQuantity: z.union([z.number().int().positive(), z.string()]).optional(),
    styleId: z.string().uuid('Invalid style ID').optional(),
  })
  .passthrough();

// ============================================================================
// Type Exports
// ============================================================================

export type LookupRateInput = z.infer<typeof lookupRateSchema>;
export type SaveFabricCostingInput = z.infer<typeof saveFabricCostingSchema>;
export type CostingOptionsQueryInput = z.infer<typeof costingOptionsQuerySchema>;
export type ApproveCostingOptionInput = z.infer<typeof approveCostingOptionSchema>;
export type UnapproveCostingOptionInput = z.infer<typeof unapproveCostingOptionSchema>;
export type PromoteCostingOptionInput = z.infer<typeof promoteCostingOptionSchema>;
export type StylesCostingStatusInput = z.infer<typeof stylesCostingStatusSchema>;
export type CheckCADCostingStatusInput = z.infer<typeof checkCADCostingStatusSchema>;
export type PushFromCADInput = z.infer<typeof pushFromCADSchema>;
export type CalculateSingleCostInput = z.infer<typeof calculateSingleCostSchema>;
export type CalculateBatchCostInput = z.infer<typeof calculateBatchCostSchema>;
