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

export const UserRoleEnum = z.enum([
  'ADMIN',
  'MERCHANDISER',
  'PRODUCTION_MANAGER',
  'INVENTORY',
  'ACCOUNTS',
  'QUALITY',
  'CUTTING',
  'STITCHING',
  'USER',
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
 */
export const resetDefaultsSchema = z.object({
  confirmReset: z.literal(true, { message: 'Must confirm reset by setting confirmReset to true' }),
});

// ============================================================================
// Type Exports
// ============================================================================

export type TogglePermissionInput = z.infer<typeof togglePermissionSchema>;
export type BulkUpdatePermissionsInput = z.infer<typeof bulkUpdatePermissionsSchema>;
export type ResetDefaultsInput = z.infer<typeof resetDefaultsSchema>;
