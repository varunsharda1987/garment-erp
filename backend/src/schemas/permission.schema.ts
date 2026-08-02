/**
 * Permission Validation Schemas
 *
 * Zod schemas for permission management endpoints.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

// Aligned with the Prisma UserRole enum (schema.prisma). Keep in sync.
export const UserRoleEnum = z.enum([
  'ADMIN',
  'PRODUCTION_MANAGER',
  'SALES',
  'INVENTORY',
  'ACCOUNTS',
  'QUALITY',
  'PURCHASE',
  'FACTORY_SUPERVISOR',
  'MERCHANDISER',
]);

// ============================================================================
// PERMISSION SCHEMAS
// ============================================================================

/**
 * Toggle Permission
 * PATCH /api/permissions/toggle
 */
export const togglePermissionSchema = z.object({
  role: UserRoleEnum,
  permissionKey: z.string().min(1).max(100),
  allowed: z.boolean(),
});

/**
 * Bulk Update Permissions
 * POST /api/permissions/bulk-update
 */
export const bulkUpdatePermissionsSchema = z.object({
  updates: z
    .array(
      z.object({
        role: UserRoleEnum,
        permissionKey: z.string().min(1).max(100),
        allowed: z.boolean(),
      })
    )
    .min(1, 'At least one update is required'),
});

/**
 * Reset to Defaults
 * POST /api/permissions/reset-defaults
 * BUG-ADM4 fix: require explicit confirmation for dangerous reset operation
 */
export const resetDefaultsSchema = z.object({
  confirmReset: z.literal(true, { message: 'Must confirm reset by setting confirmReset to true' }),
});

/**
 * Seed Permissions
 * POST /api/permissions/seed
 * BUG-ADM4 fix: require explicit confirmation for seed operation
 */
export const seedPermissionsSchema = z.object({
  confirmSeed: z.literal(true, { message: 'Must confirm seed by setting confirmSeed to true' }),
});

// ============================================================================
// Type Exports
// ============================================================================

export type TogglePermissionInput = z.infer<typeof togglePermissionSchema>;
export type BulkUpdatePermissionsInput = z.infer<typeof bulkUpdatePermissionsSchema>;
export type ResetDefaultsInput = z.infer<typeof resetDefaultsSchema>;
export type SeedPermissionsInput = z.infer<typeof seedPermissionsSchema>;
