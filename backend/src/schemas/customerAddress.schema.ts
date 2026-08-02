/**
 * Customer Address Validation Schemas
 * Zod schemas for validating customer address requests
 */

import { z } from 'zod';

/**
 * Customer address type enum matching Prisma enum
 */
export const CustomerAddressTypeEnum = z.enum(['SHIP_TO', 'COURIER', 'OFFICE']);

/**
 * Create customer address request schema
 * POST /api/customer-addresses
 */
export const createCustomerAddressSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID format'),

  label: z.string().min(1, 'Label is required').max(100, 'Label must be less than 100 characters').trim(),

  addressType: CustomerAddressTypeEnum,

  addressLine1: z
    .string()
    .min(1, 'Address line 1 is required')
    .max(200, 'Address line 1 must be less than 200 characters')
    .trim(),

  addressLine2: z.string().max(200, 'Address line 2 must be less than 200 characters').trim().optional().nullable(),

  landmark: z.string().max(100, 'Landmark must be less than 100 characters').trim().optional().nullable(),

  stateId: z.string().uuid('Invalid state ID format').optional().nullable(),

  cityId: z.string().uuid('Invalid city ID format').optional().nullable(),

  pincode: z.string().min(1, 'Pincode is required').max(10, 'Pincode must be less than 10 characters').trim(),

  country: z.string().max(50, 'Country must be less than 50 characters').trim().optional().default('India'),

  contactPerson: z.string().max(100, 'Contact person must be less than 100 characters').trim().optional().nullable(),

  contactPhone: z.string().max(20, 'Contact phone must be less than 20 characters').trim().optional().nullable(),

  contactEmail: z
    .string()
    .email('Invalid email format')
    .max(100, 'Contact email must be less than 100 characters')
    .trim()
    .optional()
    .nullable(),

  isPrimary: z.boolean().optional().default(false),

  isActive: z.boolean().optional().default(true),
});

/**
 * Update customer address request schema
 * PUT /api/customer-addresses/:id
 */
export const updateCustomerAddressSchema = z.object({
  label: z.string().min(1, 'Label is required').max(100, 'Label must be less than 100 characters').trim().optional(),

  addressType: CustomerAddressTypeEnum.optional(),

  addressLine1: z
    .string()
    .min(1, 'Address line 1 is required')
    .max(200, 'Address line 1 must be less than 200 characters')
    .trim()
    .optional(),

  addressLine2: z.string().max(200, 'Address line 2 must be less than 200 characters').trim().optional().nullable(),

  landmark: z.string().max(100, 'Landmark must be less than 100 characters').trim().optional().nullable(),

  stateId: z.string().uuid('Invalid state ID format').optional().nullable(),

  cityId: z.string().uuid('Invalid city ID format').optional().nullable(),

  pincode: z
    .string()
    .min(1, 'Pincode is required')
    .max(10, 'Pincode must be less than 10 characters')
    .trim()
    .optional(),

  country: z.string().max(50, 'Country must be less than 50 characters').trim().optional(),

  contactPerson: z.string().max(100, 'Contact person must be less than 100 characters').trim().optional().nullable(),

  contactPhone: z.string().max(20, 'Contact phone must be less than 20 characters').trim().optional().nullable(),

  contactEmail: z
    .string()
    .email('Invalid email format')
    .max(100, 'Contact email must be less than 100 characters')
    .trim()
    .optional()
    .nullable(),

  isPrimary: z.boolean().optional(),

  isActive: z.boolean().optional(),
});

/**
 * Query params schema for listing customer addresses
 */
export const customerAddressQuerySchema = z.object({
  customerId: z.string().uuid('Invalid customer ID format').optional(),
  addressType: CustomerAddressTypeEnum.optional(),
  isActive: z
    .string()
    .transform((val) => val.toLowerCase() === 'true')
    .optional(),
});

export type CreateCustomerAddressInput = z.infer<typeof createCustomerAddressSchema>;
export type UpdateCustomerAddressInput = z.infer<typeof updateCustomerAddressSchema>;
export type CustomerAddressQuery = z.infer<typeof customerAddressQuerySchema>;
