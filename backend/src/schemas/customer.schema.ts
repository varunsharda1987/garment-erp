/**
 * Customer Validation Schemas
 * Zod schemas for validating customer-related requests
 */

import { z } from 'zod';

/**
 * GST number validation regex
 * Format: 2 digits + 10 alphanumeric + 1 digit + 1 alphanumeric + 1 alphanumeric
 * Example: 27AAPFU0939F1ZV, 08AAGCH8378B1ZE
 */
const gstNumberRegex = /^\d{2}[A-Z0-9]{10}\d[A-Z0-9][A-Z0-9]$/;

/**
 * Brand category object schema
 * Used for mapping brands to their categories
 */
const brandCategorySchema = z.object({
  brandName: z.string().min(1, 'Brand name is required'),
  categories: z.array(z.string()).min(1, 'At least one category is required'),
  productCategoryIds: z.array(z.string().uuid('Invalid product category ID')).optional(),
  styleCodePrefixes: z.array(z.string().max(5)).optional(), // Prefixes for style code auto-generation (e.g., "EBW")
});

/**
 * GST number object schema
 * Used for storing multiple GST numbers for different states
 */
const gstNumberSchema = z.object({
  stateId: z.string().uuid('Invalid state ID format').optional(),
  stateName: z.string().min(1, 'State name is required'),
  stateCode: z
    .string()
    .min(2, 'State code must be at least 2 characters')
    .max(3, 'State code must be at most 3 characters'),
  gstNumber: z.string().regex(gstNumberRegex, 'Invalid GST number format'),
  billingAddress: z.string().optional(),
  billingCityId: z.string().uuid('Invalid city ID format').optional(),
  billingPincode: z.string().optional(),
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

  billingName: z
    .string()
    .min(2, 'Billing name must be at least 2 characters')
    .max(200, 'Billing name must be less than 200 characters')
    .trim()
    .optional()
    .or(z.literal('')),

  // BUG-CU3 fix: type/category must match DTO and Prisma requirements
  type: z
    .enum(['BUYER']) // Matches Prisma CustomerType
    .optional()
    .default('BUYER'), // BUG-CU3: Prisma requires, Zod default ensures always present in output

  category: z.enum(['DOMESTIC', 'EXPORT', 'WHOLESALER', 'RETAILER']), // BUG-CU3: Required - matches Prisma/DTO (no optional, no default)

  businessType: z.enum(['B2B', 'B2C']).optional().default('B2B'),

  market: z.enum(['INTERNATIONAL', 'DOMESTIC']).optional().default('DOMESTIC'),

  contactPerson: z.string().max(100, 'Contact person name must be less than 100 characters').trim().optional(),

  email: z
    .string()
    .email('Invalid email format')
    .transform((val) => val.toLowerCase().trim())
    .optional()
    .or(z.literal('')),

  phone: z.string().max(20, 'Phone number must be less than 20 characters').trim().optional(),

  billingAddress: z.string().optional(),

  shippingAddress: z.string().optional(),

  gstNumber: z.string().regex(gstNumberRegex, 'Invalid GST number format').optional().or(z.literal('')),

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

  // BUG-CU13: Dual brand format maintained for backward compatibility
  // - brandCategories: structured array with productCategoryIds (new format)
  // - brandNames/categories: flat strings (legacy format for reports/exports)
  // Both are accepted until legacy consumers are migrated
  brandNames: z.union([z.string(), z.array(z.string())]).optional(),

  categories: z.union([z.string(), z.array(z.string())]).optional(),

  brandCategories: z.array(brandCategorySchema).optional(),

  gstNumbers: z.array(gstNumberSchema).optional(),

  // Location IDs (frontend sends these for address lookups)
  billingStateId: z.string().uuid('Invalid billing state ID').optional().nullable(),
  billingCityId: z.string().uuid('Invalid billing city ID').optional().nullable(),
  billingPincode: z.string().max(20).optional().nullable(),
  shippingStateId: z.string().uuid('Invalid shipping state ID').optional().nullable(),
  shippingCityId: z.string().uuid('Invalid shipping city ID').optional().nullable(),
  shippingPincode: z.string().max(20).optional().nullable(),

  // Agency/Agent (frontend sends for customer-agent relationship)
  agencyId: z.string().uuid('Invalid agency ID').optional().nullable(),
  agentId: z.string().uuid('Invalid agent ID').optional().nullable(),
  agentCommissionPercent: z.number().min(0).max(100).optional().nullable(),

  // Testing Requirements (FPT/GPT)
  requiresFPT: z.boolean().optional().default(false),

  requiresGPT: z.boolean().optional().default(false),

  fptBlocksProduction: z.boolean().optional().default(false),

  gptBlocksShipment: z.boolean().optional().default(true),

  fptTemplateId: z.string().uuid('Invalid FPT template ID format').optional().nullable(),

  gptTemplateId: z.string().uuid('Invalid GPT template ID format').optional().nullable(),

  buyerApprovesFPT: z.boolean().optional().default(false),

  buyerApprovesGPT: z.boolean().optional().default(false),

  defaultTestingLabId: z.string().uuid('Invalid testing lab ID format').optional().nullable(),

  // Style code generation prefix (e.g., EBW, KF, HOK)
  styleCodePrefix: z.string().max(10, 'Style code prefix must be at most 10 characters').optional().nullable(),
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

  billingName: z
    .string()
    .min(2, 'Billing name must be at least 2 characters')
    .max(200, 'Billing name must be less than 200 characters')
    .trim()
    .optional()
    .or(z.literal('')),

  type: z
    .enum(['BUYER']) // Matches Prisma CustomerType
    .optional(),

  category: z
    .enum(['DOMESTIC', 'EXPORT', 'WHOLESALER', 'RETAILER']) // Matches Prisma CustomerCategory
    .optional(),

  businessType: z.enum(['B2B', 'B2C']).optional(),

  market: z.enum(['INTERNATIONAL', 'DOMESTIC']).optional(),

  contactPerson: z.string().max(100, 'Contact person name must be less than 100 characters').trim().optional(),

  email: z
    .string()
    .email('Invalid email format')
    .transform((val) => val.toLowerCase().trim())
    .optional()
    .or(z.literal('')),

  phone: z.string().max(20, 'Phone number must be less than 20 characters').trim().optional(),

  billingAddress: z.string().optional(),

  shippingAddress: z.string().optional(),

  gstNumber: z.string().regex(gstNumberRegex, 'Invalid GST number format').optional().or(z.literal('')),

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

  brandNames: z.union([z.string(), z.array(z.string())]).optional(),

  categories: z.union([z.string(), z.array(z.string())]).optional(),

  brandCategories: z.array(brandCategorySchema).optional(),

  gstNumbers: z.array(gstNumberSchema).optional(),

  // Location IDs (frontend sends these for address lookups)
  billingStateId: z.string().uuid('Invalid billing state ID').optional().nullable(),
  billingCityId: z.string().uuid('Invalid billing city ID').optional().nullable(),
  billingPincode: z.string().max(20).optional().nullable(),
  shippingStateId: z.string().uuid('Invalid shipping state ID').optional().nullable(),
  shippingCityId: z.string().uuid('Invalid shipping city ID').optional().nullable(),
  shippingPincode: z.string().max(20).optional().nullable(),

  // Agency/Agent (frontend sends for customer-agent relationship)
  agencyId: z.string().uuid('Invalid agency ID').optional().nullable(),
  agentId: z.string().uuid('Invalid agent ID').optional().nullable(),
  agentCommissionPercent: z.number().min(0).max(100).optional().nullable(),

  // Testing Requirements (FPT/GPT)
  requiresFPT: z.boolean().optional(),

  requiresGPT: z.boolean().optional(),

  fptBlocksProduction: z.boolean().optional(),

  gptBlocksShipment: z.boolean().optional(),

  fptTemplateId: z.string().uuid('Invalid FPT template ID format').optional().nullable(),

  gptTemplateId: z.string().uuid('Invalid GPT template ID format').optional().nullable(),

  buyerApprovesFPT: z.boolean().optional(),

  buyerApprovesGPT: z.boolean().optional(),

  defaultTestingLabId: z.string().uuid('Invalid testing lab ID format').optional().nullable(),

  // Style code generation prefix (e.g., EBW, KF, HOK)
  styleCodePrefix: z.string().max(10, 'Style code prefix must be at most 10 characters').optional().nullable(),
});

/**
 * Customer query parameters schema
 * GET /api/customers
 */
export const customerQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),

  limit: z.coerce.number().int().min(1).max(1000).optional().default(10),

  search: z.string().optional(),

  type: z
    .enum(['BUYER']) // Matches Prisma CustomerType
    .optional(),

  category: z
    .enum(['DOMESTIC', 'EXPORT', 'WHOLESALER', 'RETAILER']) // Matches Prisma CustomerCategory
    .optional(),

  isActive: z
    .string()
    .transform((val) => val.toLowerCase() === 'true')
    .pipe(z.boolean())
    .optional(),
});

/**
 * Customer ID parameter schema
 * For validating :id route parameters
 */
export const customerIdParamSchema = z.object({
  id: z.string().uuid('Invalid customer ID format'),
});

// Type exports for TypeScript
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CustomerQueryInput = z.infer<typeof customerQuerySchema>;
export type CustomerIdParam = z.infer<typeof customerIdParamSchema>;
export type BrandCategory = z.infer<typeof brandCategorySchema>;
export type GstNumber = z.infer<typeof gstNumberSchema>;
