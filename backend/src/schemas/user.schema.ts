/**
 * User Management Validation Schemas
 *
 * Zod schemas for user management endpoints.
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
// USER SCHEMAS
// ============================================================================

/**
 * Create User
 * POST /api/users
 */
export const createUserSchema = z.object({
  email: z.string().email('Invalid email format').max(255),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100),
  name: z.string().min(1, 'Name is required').max(200),
  role: UserRoleEnum.optional().default('USER'),
  phone: z.string().max(20).optional(),
  avatar: z.string().max(500).optional(),
  isActive: z.boolean().optional().default(true),
});

/**
 * Update User
 * PUT /api/users/:id
 */
export const updateUserSchema = z.object({
  email: z.string().email('Invalid email format').max(255).optional(),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  phone: z.string().max(20).optional().nullable(),
  department: z.string().max(100).optional().nullable(),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100).optional(),
  isActive: z.boolean().optional(),
});

/**
 * Update User Role
 * PUT /api/users/:id/role
 */
export const updateUserRoleSchema = z.object({
  role: UserRoleEnum,
});

/**
 * Change Password
 * PUT /api/users/:id/change-password
 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters').max(100),
});

/**
 * Approve User
 * POST /api/users/:id/approve
 */
export const approveUserSchema = z.object({
  role: UserRoleEnum.optional(),
  remarks: z.string().max(500).optional(),
});

/**
 * Reject User
 * POST /api/users/:id/reject
 */
export const rejectUserSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required').max(500),
});

/**
 * User Query Params
 * GET /api/users
 */
export const userQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  search: z.string().max(100).optional(),
  role: UserRoleEnum.optional(),
  isActive: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ApproveUserInput = z.infer<typeof approveUserSchema>;
export type RejectUserInput = z.infer<typeof rejectUserSchema>;
export type UserQueryInput = z.infer<typeof userQuerySchema>;
