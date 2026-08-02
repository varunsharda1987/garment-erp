/**
 * System Settings Validation Schemas
 *
 * Zod schemas for system settings CRUD operations.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const SettingCategoryEnum = z.enum([
  'DEFAULTS',
  'BUSINESS',
  'NOTIFICATION',
  'INTEGRATION',
  'DISPLAY',
  'SECURITY',
  'OTHER',
]);

export const SettingDataTypeEnum = z.enum(['STRING', 'NUMBER', 'BOOLEAN', 'JSON', 'DATE']);

// ============================================================================
// SYSTEM SETTINGS SCHEMAS
// ============================================================================

/**
 * Upsert System Setting
 * PUT /api/system-settings/:key
 */
export const upsertSystemSettingSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.unknown())]),
  // No .default() here: a client that omits category (e.g. Settings.tsx sends only {value, dataType})
  // must NOT overwrite the row's existing category. The service update branch only sets category when
  // input.category is truthy, so leaving it undefined preserves a DEFAULTS-category setting.
  category: SettingCategoryEnum.optional(),
  dataType: SettingDataTypeEnum.optional().default('STRING'),
  description: z.string().max(500).optional(),
  // isSystem marks settings that cannot be deleted (e.g. FABRIC_DEFAULT_WASTAGE_PERCENT)
  isSystem: z.boolean().optional().default(false),
});

/**
 * System Settings Query Params
 * GET /api/system-settings
 */
export const systemSettingsQuerySchema = z.object({
  category: SettingCategoryEnum.optional(),
  search: z.string().max(100).optional(),
  isSystem: z
    .string()
    .transform((val) => val.toLowerCase() === 'true')
    .optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type UpsertSystemSettingInput = z.infer<typeof upsertSystemSettingSchema>;
export type SystemSettingsQueryInput = z.infer<typeof systemSettingsQuerySchema>;
