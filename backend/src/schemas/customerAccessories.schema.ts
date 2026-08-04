/**
 * Customer Accessories Validation Schemas
 *
 * Zod schemas for customer accessory presets.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';
import { flexMaterialId } from './common.schema';

// ============================================================================
// Accessory Item Schema
// ============================================================================

// Mirrors the AccessoryItem interface in customer.service.ts, the
// customer_accessories_preset_items columns, and what CustomerAccessoryPresets.tsx sends.
// The previous shape (accessoryType/description/unit/specifications/isRequired) matched none of
// them, so every item was stripped.
const AccessoryItemSchema = z.object({
  materialType: z.string().min(1).max(50), // 'LABEL' | 'PACKAGING'
  // PACKAGING — materials.id is NOT always a UUID (legacy 'mat-<code>' ids); see flexMaterialId
  materialId: flexMaterialId('material ID').optional().nullable(),
  quantity: z.coerce.number().nonnegative().optional().nullable(),
  usageCategory: z.string().max(50).optional(),
  // LABEL
  labelId: flexMaterialId('label ID').optional().nullable(),
  componentName: z.string().max(200).optional().nullable(),
  extraPercentage: z.coerce.number().nonnegative().optional().nullable(),
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
  // `items`, not `accessoryItems` — the controller DTO was renamed ("Changed from accessoryItems to
  // items") and the UI sends `items`, but this schema was never updated, so the array was stripped
  // and every create/update threw "Items array is required".
  items: z.array(AccessoryItemSchema).default([]),
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
  items: z.array(AccessoryItemSchema).optional(),
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
    .transform((val) => val.toLowerCase() === 'true')
    .optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateAccessoryPresetInput = z.infer<typeof createAccessoryPresetSchema>;
export type UpdateAccessoryPresetInput = z.infer<typeof updateAccessoryPresetSchema>;
export type CloneAccessoryPresetInput = z.infer<typeof cloneAccessoryPresetSchema>;
export type AccessoryPresetQueryInput = z.infer<typeof accessoryPresetQuerySchema>;
