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
    .min(6, 'Password must be at least 6 characters')
    .max(128, 'Password must be less than 128 characters'),

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

  role: z.enum([
    'ADMIN',
    'PRODUCTION_MANAGER',
    'SALES',
    'INVENTORY',
    'ACCOUNTS',
    'QUALITY',
    'PURCHASE',
    'FACTORY_SUPERVISOR',
    'MERCHANDISER',
  ]),
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

// Type exports for TypeScript
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
