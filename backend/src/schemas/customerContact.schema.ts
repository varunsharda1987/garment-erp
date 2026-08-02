/**
 * Customer Contact Validation Schemas
 * Zod schemas for validating customer contact (buyer) requests
 */

import { z } from 'zod';

/**
 * Create customer contact request schema
 * POST /api/customer-contacts
 */
export const createCustomerContactSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID format'),

  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters').trim(),

  designation: z.string().max(100, 'Designation must be less than 100 characters').trim().optional().nullable(),

  phone: z.string().max(20, 'Phone must be less than 20 characters').trim().optional().nullable(),

  alternatePhone: z.string().max(20, 'Alternate phone must be less than 20 characters').trim().optional().nullable(),

  email: z
    .string()
    .email('Invalid email format')
    .max(100, 'Email must be less than 100 characters')
    .trim()
    .optional()
    .nullable(),

  whatsapp: z.string().max(20, 'WhatsApp must be less than 20 characters').trim().optional().nullable(),

  isPrimary: z.boolean().optional().default(false),

  isActive: z.boolean().optional().default(true),

  notes: z.string().max(500, 'Notes must be less than 500 characters').trim().optional().nullable(),
});

/**
 * Update customer contact request schema
 * PUT /api/customer-contacts/:id
 */
export const updateCustomerContactSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters').trim().optional(),

  designation: z.string().max(100, 'Designation must be less than 100 characters').trim().optional().nullable(),

  phone: z.string().max(20, 'Phone must be less than 20 characters').trim().optional().nullable(),

  alternatePhone: z.string().max(20, 'Alternate phone must be less than 20 characters').trim().optional().nullable(),

  email: z
    .string()
    .email('Invalid email format')
    .max(100, 'Email must be less than 100 characters')
    .trim()
    .optional()
    .nullable(),

  whatsapp: z.string().max(20, 'WhatsApp must be less than 20 characters').trim().optional().nullable(),

  isPrimary: z.boolean().optional(),

  isActive: z.boolean().optional(),

  notes: z.string().max(500, 'Notes must be less than 500 characters').trim().optional().nullable(),
});

/**
 * Query params schema for listing customer contacts
 */
export const customerContactQuerySchema = z.object({
  customerId: z.string().uuid('Invalid customer ID format').optional(),
  isActive: z
    .string()
    .transform((val) => val.toLowerCase() === 'true')
    .optional(),
});

export type CreateCustomerContactInput = z.infer<typeof createCustomerContactSchema>;
export type UpdateCustomerContactInput = z.infer<typeof updateCustomerContactSchema>;
export type CustomerContactQuery = z.infer<typeof customerContactQuerySchema>;
