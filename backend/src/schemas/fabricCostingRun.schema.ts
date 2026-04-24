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
 */
export const createCostingRunSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(200).optional(),
    fabricCadIds: z.array(z.string().uuid()).optional(),
    processorId: z.string().uuid('Invalid processor ID').optional(),
    purpose: z.string().max(100).optional(),
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
