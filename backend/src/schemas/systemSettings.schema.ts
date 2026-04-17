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
  category: SettingCategoryEnum.optional().default('OTHER'),
  dataType: SettingDataTypeEnum.optional().default('STRING'),
  description: z.string().max(500).optional(),
  isSystem: z.boolean().optional().default(false),
  isEncrypted: z.boolean().optional().default(false),
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
    .transform((val) => val === 'true')
    .optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type UpsertSystemSettingInput = z.infer<typeof upsertSystemSettingSchema>;
export type SystemSettingsQueryInput = z.infer<typeof systemSettingsQuerySchema>;
