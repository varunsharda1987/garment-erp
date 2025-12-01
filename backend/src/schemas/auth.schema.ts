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
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),

  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .trim(),

  role: z
    .enum(['ADMIN', 'MANAGER', 'MERCHANDISER', 'PRODUCTION', 'CUTTING', 'QUALITY', 'STORES', 'ACCOUNTS', 'VIEWER'])
    .optional(),
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

  password: z
    .string()
    .min(1, 'Password is required'),
});

// Type exports for TypeScript
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
