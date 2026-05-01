/**
 * Fabric Costing Run Validation Schemas
 *
 * Zod schemas for fabric costing runs (grouped CAD records).
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// FABRIC COSTING RUN SCHEMAS
// ============================================================================

/**
 * Create Fabric Costing Run
 * POST /api/fabric-costing-runs/style/:styleId
 *
 * Aligned with controller (fabric-costing-run.controller.ts:154-249)
 * - purpose is REQUIRED and must be a valid CadPurpose enum value
 * - fabricCadIds is REQUIRED and must have at least one ID
 */
export const createCostingRunSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(200).optional(),
    fabricCadIds: z.array(z.string().uuid()).min(1, 'At least one fabric CAD ID is required'),
    processorId: z.string().uuid('Invalid processor ID').optional(),
    purpose: z.enum(['COSTING', 'RAW_MATERIAL_CALCULATION', 'PRODUCTION'], {
      message: 'Purpose must be COSTING, RAW_MATERIAL_CALCULATION, or PRODUCTION',
    }),
    remarks: z.string().max(500).optional(),
  })
  .passthrough();

/**
 * Recalculate Run Totals
 * PATCH /api/fabric-costing-runs/:runId/recalculate
 */
export const recalculateRunSchema = z
  .object({
    forceRecalculate: z.boolean().optional().default(false),
  })
  .passthrough();

// ============================================================================
// Type Exports
// ============================================================================

export type CreateCostingRunInput = z.infer<typeof createCostingRunSchema>;
export type RecalculateRunInput = z.infer<typeof recalculateRunSchema>;
