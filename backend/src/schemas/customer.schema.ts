/**
 * Customer Validation Schemas
 * Zod schemas for validating customer-related requests
 */

import { z } from 'zod';

/**
 * GST number validation regex
 * Format: 2 digits + 10 alphanumeric + 1 digit + 1 alphanumeric + 1 digit
 * Example: 27AAPFU0939F1ZV
 */
const gstNumberRegex = /^\d{2}[A-Z0-9]{10}\d[A-Z0-9]\d$/;

/**
 * Brand category object schema
 * Used for mapping brands to their categories
 */
const brandCategorySchema = z.object({
  brandName: z.string().min(1, 'Brand name is required'),
  categories: z.array(z.string()).min(1, 'At least one category is required'),
});

/**
 * GST number object schema
 * Used for storing multiple GST numbers for different states
 */
const gstNumberSchema = z.object({
  stateName: z.string().min(1, 'State name is required'),
  stateCode: z.string().min(2, 'State code must be at least 2 characters').max(3, 'State code must be at most 3 characters'),
  gstNumber: z.string().regex(gstNumberRegex, 'Invalid GST number format'),
  billingAddress: z.string().optional(),
  isPrimary: z.boolean().optional(),
});

/**
 * Create customer request schema
 * POST /api/customers
 */
export const createCustomerSchema = z.object({
  code: z
    .string()
    .min(2, 'Customer code must be at least 2 characters')
    .max(50, 'Customer code must be less than 50 characters')
    .trim(),

  name: z
    .string()
    .min(2, 'Customer name must be at least 2 characters')
    .max(200, 'Customer name must be less than 200 characters')
    .trim(),

  type: z
    .enum(['BUYER', 'AGENT', 'DISTRIBUTOR', 'RETAILER', 'WHOLESALER'])
    .optional(),

  category: z
    .enum(['A', 'B', 'C', 'D'])
    .optional(),

  businessType: z
    .enum(['B2B', 'B2C'])
    .optional()
    .default('B2B'),

  market: z
    .enum(['INTERNATIONAL', 'DOMESTIC'])
    .optional()
    .default('DOMESTIC'),

  contactPerson: z
    .string()
    .max(100, 'Contact person name must be less than 100 characters')
    .trim()
    .optional(),

  email: z
    .string()
    .email('Invalid email format')
    .transform((val) => val.toLowerCase().trim())
    .optional()
    .or(z.literal('')),

  phone: z
    .string()
    .max(20, 'Phone number must be less than 20 characters')
    .trim()
    .optional(),

  billingAddress: z
    .string()
    .optional(),

  shippingAddress: z
    .string()
    .optional(),

  gstNumber: z
    .string()
    .regex(gstNumberRegex, 'Invalid GST number format')
    .optional()
    .or(z.literal('')),

  creditLimit: z
    .number()
    .nonnegative('Credit limit must be non-negative')
    .optional()
    .or(z.string().transform((val) => (val ? parseFloat(val) : undefined))),

  creditDays: z
    .number()
    .int('Credit days must be an integer')
    .min(0, 'Credit days must be at least 0')
    .max(365, 'Credit days must be at most 365')
    .optional()
    .or(z.string().transform((val) => (val ? parseInt(val) : undefined))),

  brandNames: z
    .array(z.string())
    .optional(),

  categories: z
    .array(z.string())
    .optional(),

  brandCategories: z
    .array(brandCategorySchema)
    .optional(),

  gstNumbers: z
    .array(gstNumberSchema)
    .optional(),
});

/**
 * Update customer request schema
 * PUT /api/customers/:id
 */
export const updateCustomerSchema = z.object({
  code: z
    .string()
    .min(2, 'Customer code must be at least 2 characters')
    .max(50, 'Customer code must be less than 50 characters')
    .trim()
    .optional(),

  name: z
    .string()
    .min(2, 'Customer name must be at least 2 characters')
    .max(200, 'Customer name must be less than 200 characters')
    .trim()
    .optional(),

  type: z
    .enum(['BUYER', 'AGENT', 'DISTRIBUTOR', 'RETAILER', 'WHOLESALER'])
    .optional(),

  category: z
    .enum(['A', 'B', 'C', 'D'])
    .optional(),

  businessType: z
    .enum(['B2B', 'B2C'])
    .optional(),

  market: z
    .enum(['INTERNATIONAL', 'DOMESTIC'])
    .optional(),

  contactPerson: z
    .string()
    .max(100, 'Contact person name must be less than 100 characters')
    .trim()
    .optional(),

  email: z
    .string()
    .email('Invalid email format')
    .transform((val) => val.toLowerCase().trim())
    .optional()
    .or(z.literal('')),

  phone: z
    .string()
    .max(20, 'Phone number must be less than 20 characters')
    .trim()
    .optional(),

  billingAddress: z
    .string()
    .optional(),

  shippingAddress: z
    .string()
    .optional(),

  gstNumber: z
    .string()
    .regex(gstNumberRegex, 'Invalid GST number format')
    .optional()
    .or(z.literal('')),

  creditLimit: z
    .number()
    .nonnegative('Credit limit must be non-negative')
    .optional()
    .or(z.string().transform((val) => (val ? parseFloat(val) : undefined))),

  creditDays: z
    .number()
    .int('Credit days must be an integer')
    .min(0, 'Credit days must be at least 0')
    .max(365, 'Credit days must be at most 365')
    .optional()
    .or(z.string().transform((val) => (val ? parseInt(val) : undefined))),

  brandNames: z
    .array(z.string())
    .optional(),

  categories: z
    .array(z.string())
    .optional(),

  brandCategories: z
    .array(brandCategorySchema)
    .optional(),

  gstNumbers: z
    .array(gstNumberSchema)
    .optional(),
});

/**
 * Customer query parameters schema
 * GET /api/customers
 */
export const customerQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),

  limit: z.coerce.number().int().min(1).max(100).optional().default(10),

  search: z
    .string()
    .optional(),

  type: z
    .enum(['BUYER', 'AGENT', 'DISTRIBUTOR', 'RETAILER', 'WHOLESALER'])
    .optional(),

  category: z
    .enum(['A', 'B', 'C', 'D'])
    .optional(),

  isActive: z
    .string()
    .transform((val) => val === 'true')
    .pipe(z.boolean())
    .optional(),
});

/**
 * Customer ID parameter schema
 * For validating :id route parameters
 */
export const customerIdParamSchema = z.object({
  id: z
    .string()
    .uuid('Invalid customer ID format'),
});

// Type exports for TypeScript
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CustomerQueryInput = z.infer<typeof customerQuerySchema>;
export type CustomerIdParam = z.infer<typeof customerIdParamSchema>;
export type BrandCategory = z.infer<typeof brandCategorySchema>;
export type GstNumber = z.infer<typeof gstNumberSchema>;
