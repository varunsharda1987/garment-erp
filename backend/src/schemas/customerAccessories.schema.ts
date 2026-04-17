/**
 * Customer Accessories Validation Schemas
 *
 * Zod schemas for customer accessory presets.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// Accessory Item Schema
// ============================================================================

const AccessoryItemSchema = z.object({
  accessoryType: z.string().min(1).max(50),
  materialId: z.string().uuid('Invalid material ID').optional(),
  description: z.string().max(200).optional(),
  quantity: z.number().positive().optional(),
  unit: z.string().max(20).optional(),
  specifications: z.record(z.string(), z.unknown()).optional(),
  isRequired: z.boolean().optional().default(true),
  sortOrder: z.number().int().nonnegative().optional(),
});

// ============================================================================
// CUSTOMER ACCESSORIES SCHEMAS
// ============================================================================

/**
 * Create Accessory Preset
 * POST /api/customers/:customerId/accessory-presets
 */
export const createAccessoryPresetSchema = z.object({
  presetName: z.string().min(1, 'Preset name is required').max(100),
  description: z.string().max(500).optional(),
  accessoryItems: z.array(AccessoryItemSchema).min(1, 'At least one accessory item is required'),
  isDefault: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
});

/**
 * Update Accessory Preset
 * PUT /api/customers/:customerId/accessory-presets/:presetId
 */
export const updateAccessoryPresetSchema = z.object({
  presetName: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  accessoryItems: z.array(AccessoryItemSchema).optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

/**
 * Clone Accessory Preset
 * POST /api/customers/:customerId/accessory-presets/:presetId/clone
 */
export const cloneAccessoryPresetSchema = z.object({
  newPresetName: z.string().min(1, 'New preset name is required').max(100),
});

/**
 * Query Accessory Presets
 * GET /api/customers/:customerId/accessory-presets
 */
export const accessoryPresetQuerySchema = z.object({
  isActive: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateAccessoryPresetInput = z.infer<typeof createAccessoryPresetSchema>;
export type UpdateAccessoryPresetInput = z.infer<typeof updateAccessoryPresetSchema>;
export type CloneAccessoryPresetInput = z.infer<typeof cloneAccessoryPresetSchema>;
export type AccessoryPresetQueryInput = z.infer<typeof accessoryPresetQuerySchema>;
