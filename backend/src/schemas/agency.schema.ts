import { z } from 'zod';

/**
 * Create Agency Schema
 * POST /api/agencies
 */
export const createAgencySchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must not exceed 200 characters').trim(),
  phone: z.string().max(20, 'Phone must not exceed 20 characters').trim().optional().nullable(),
  email: z
    .string()
    .email('Invalid email format')
    .max(255, 'Email must not exceed 255 characters')
    .trim()
    .optional()
    .nullable(),
  address: z.string().max(500, 'Address must not exceed 500 characters').trim().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

/**
 * Update Agency Schema
 * PUT /api/agencies/:id
 */
export const updateAgencySchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must not exceed 200 characters').trim().optional(),
  phone: z.string().max(20, 'Phone must not exceed 20 characters').trim().optional().nullable(),
  email: z
    .string()
    .email('Invalid email format')
    .max(255, 'Email must not exceed 255 characters')
    .trim()
    .optional()
    .nullable(),
  address: z.string().max(500, 'Address must not exceed 500 characters').trim().optional().nullable(),
  isActive: z.boolean().optional(),
});

// Type exports for use in controllers
export type CreateAgencyInput = z.infer<typeof createAgencySchema>;
export type UpdateAgencyInput = z.infer<typeof updateAgencySchema>;
