/**
 * Generic Trim Validation Schemas
 *
 * Zod schemas for generic trim CRUD operations.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 *
 * BUG-GT5: INTENTIONAL DESIGN - Generic Schema with .passthrough()
 * =================================================================
 * This schema is intentionally generic and uses .passthrough() to handle all 16 trim
 * types with a single schema. The frontend defines specific interfaces (HookEyeItem,
 * SnapButtonItem, etc.) with type-specific fields for TypeScript safety.
 *
 * WHY THIS PATTERN:
 * - Single controller + schema handles 16 trim types (reduces code 16x)
 * - Common fields (code, name, prices) are strictly validated here
 * - Type-specific fields (hasAglets, fusible, finish) pass through via .passthrough()
 * - Prisma schema (hook_eye_master, snap_button_master, etc.) enforces actual columns
 * - Frontend TRIM_TYPE_CONFIGS drives which fields are shown per type
 *
 * VALIDATION FLOW:
 * 1. Request hits this Zod schema -> validates common fields
 * 2. .passthrough() allows type-specific fields to flow through
 * 3. Controller spreads into Prisma create/update
 * 4. Prisma schema validates column existence at DB level
 *
 * See also: frontend/src/types/genericTrim.types.ts for the specific interfaces
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const TrimTypeEnum = z.enum([
  'hook_eye',
  'snap_button',
  'buckle',
  'belt',
  'velcro',
  'drawstring',
  'ribbon',
  'sequin',
  'bead',
  'motif',
  'interlining',
  'padding',
  'other_fastener',
  'other_tape',
  'other_decorative',
  'other_functional',
]);

// ============================================================================
// GENERIC TRIM SCHEMAS
// ============================================================================

/**
 * Create Generic Trim
 * POST /api/generic-trims/:trimType
 *
 * BUG-GT2 FIX: Added explicit validation for price fields instead of relying on .passthrough().
 * Price fields are validated with nonnegative constraints to prevent invalid data.
 */
export const createGenericTrimSchema = z
  .object({
    code: z.string().max(50).optional(),
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(500).optional(),
    material: z.string().max(100).optional(),
    color: z.string().max(50).optional(),
    size: z.string().max(50).optional(),
    supplierId: z.string().uuid('Invalid supplier ID').optional(),
    isActive: z.boolean().optional().default(true),
    // BUG-GT2 FIX: Explicitly validate price fields based on trim type unit
    // - pricePerPair: for PAIR unit items (hook_eye, padding)
    // - pricePerMeter: for METER unit items (velcro, drawstring, ribbon, sequin, interlining, other_tape)
    // - pricePerPiece: for PIECE unit items (snap_button, buckle, belt, motif, other_fastener, other_decorative, other_functional)
    // - pricePerGross: alternative pricing for bulk items
    // - pricePerPack: for PACK unit items (bead)
    pricePerPair: z.coerce.number().nonnegative().optional().nullable(),
    pricePerMeter: z.coerce.number().nonnegative().optional().nullable(),
    pricePerPiece: z.coerce.number().nonnegative().optional().nullable(),
    pricePerGross: z.coerce.number().nonnegative().optional().nullable(),
    pricePerPack: z.coerce.number().nonnegative().optional().nullable(),
    // Additional common fields that may be passed
    width: z.coerce.number().positive().optional().nullable(),
    // BUG-GT2 FIX: Add packSize for bead_master (Int? in Prisma schema)
    packSize: z.coerce.number().int().nonnegative().optional().nullable(),
  })
  .passthrough();

/**
 * Update Generic Trim
 * PUT /api/generic-trims/:trimType/:id
 *
 * BUG-GT2 FIX: Added explicit validation for price fields instead of relying on .passthrough().
 * Price fields are validated with nonnegative constraints to prevent invalid data.
 */
export const updateGenericTrimSchema = z
  .object({
    code: z.string().max(50).optional().nullable(),
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(500).optional().nullable(),
    material: z.string().max(100).optional().nullable(),
    color: z.string().max(50).optional().nullable(),
    size: z.string().max(50).optional().nullable(),
    supplierId: z.string().uuid('Invalid supplier ID').optional().nullable(),
    isActive: z.boolean().optional(),
    // BUG-GT2 FIX: Explicitly validate price fields
    pricePerPair: z.coerce.number().nonnegative().optional().nullable(),
    pricePerMeter: z.coerce.number().nonnegative().optional().nullable(),
    pricePerPiece: z.coerce.number().nonnegative().optional().nullable(),
    pricePerGross: z.coerce.number().nonnegative().optional().nullable(),
    pricePerPack: z.coerce.number().nonnegative().optional().nullable(),
    width: z.coerce.number().positive().optional().nullable(),
    // BUG-GT2 FIX: Add packSize for bead_master (Int? in Prisma schema)
    packSize: z.coerce.number().int().nonnegative().optional().nullable(),
  })
  .passthrough();

/**
 * Query Generic Trims
 * GET /api/generic-trims/:trimType
 */
export const genericTrimQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  search: z.string().max(100).optional(),
  supplierId: z.string().uuid().optional(),
  isActive: z
    .string()
    .transform((val) => val.toLowerCase() === 'true')
    .optional(),
});

// ============================================================================
// Param Validation Schemas
// ============================================================================

export const trimTypeParamSchema = z.object({
  trimType: TrimTypeEnum,
});

export const genericTrimIdParamSchema = z.object({
  trimType: TrimTypeEnum,
  id: z.string().uuid('Invalid trim ID'),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateGenericTrimInput = z.infer<typeof createGenericTrimSchema>;
export type UpdateGenericTrimInput = z.infer<typeof updateGenericTrimSchema>;
export type GenericTrimQueryInput = z.infer<typeof genericTrimQuerySchema>;
