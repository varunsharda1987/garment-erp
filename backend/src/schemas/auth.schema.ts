/**
 * Authentication Validation Schemas
 * Zod schemas for validating authentication requests
 */

import { z } from 'zod';

/**
 * Registration request schema
 * Validates user registration data
 */
export const registerSchema = z.object({
  email: z
    .string()
    .email('Invalid email format')
    .max(255, 'Email must be less than 255 characters')
    .transform((val) => val.toLowerCase().trim()),

  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),

  firstName: z
    .string()
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name must be less than 50 characters')
    .trim(),

  lastName: z
    .string()
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name must be less than 50 characters')
    .trim(),

  phone: z.string().optional(),

  // SECURITY: public self-registration must NOT accept a caller-supplied role — allowing it let anyone
  // register themselves as ADMIN (privilege escalation). Role is assigned only by an admin via the
  // user-management endpoints (POST /api/users, PUT /api/users/:id/role). Self-registrations get a
  // safe default (see auth.controller register) and remain pending admin approval.
});

/**
 * Login request schema
 * Validates user login data
 */
export const loginSchema = z.object({
  email: z
    .string()
    .email('Invalid email format')
    .transform((val) => val.toLowerCase().trim()),

  password: z.string().min(1, 'Password is required'),
});

/**
 * Refresh token request schema
 * Validates refresh token for access token refresh (BUG-AUTH6)
 */
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

/**
 * Logout request schema
 * Optional refresh token to revoke on logout
 */
export const logoutSchema = z.object({
  refreshToken: z.string().optional(),
});

// Type exports for TypeScript
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
