import { z } from 'zod';

// Enum for supplier categories
export const SupplierCategoryEnum = z.enum([
  'FABRIC_SUPPLIER',
  'TRIMS_SUPPLIER',
  'THREAD_SUPPLIER',
  'PACKAGING_SUPPLIER',
  'LACE_SUPPLIER',
  'DYEING_PRINTING',
  'EMBROIDERY',
  'HAND_WORK',
  'SMOCKING',
  'CMT_UNIT',
  'FINISHING_CONTRACTOR',
  'STITCHING_CONTRACTOR',
  'WASHING',
  'DORI_PIPING_CONTRACTOR',
  'MACHINE_PARTS_SUPPLIER',
  'OTHER_SERVICES',
]);

// GST Number validation (2-digit state code + 10-digit PAN + 1-digit entity number + Z + 1-digit checksum)
const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

// PAN Number validation (5 letters + 4 digits + 1 letter)
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

/**
 * Schema for creating a new supplier
 * POST /api/suppliers
 * Note: validateBody middleware passes req.body directly, not wrapped in { body: ... }
 */
export const createSupplierSchema = z.object({
  code: z.string().min(2).max(50),
  name: z.string().min(2).max(200),
  supplierCategory: SupplierCategoryEnum,
  contactPerson: z.string().max(100).optional().or(z.literal('')),
  email: z.union([z.string().email(), z.literal('')]).optional(),
  phone: z.string().max(20).optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  gstNumber: z.union([z.string().regex(gstRegex, 'Invalid GST number format'), z.literal('')]).optional(),
  panNumber: z.union([z.string().regex(panRegex, 'Invalid PAN number format'), z.literal('')]).optional(),
  paymentTerms: z.string().optional().or(z.literal('')),
  creditDays: z.union([
    z.number().int().min(0).max(365),
    z.string().transform((val) => val === '' ? undefined : parseInt(val, 10))
      .pipe(z.number().int().min(0).max(365).optional()),
    z.undefined(),
  ]).optional(),
  creditLimit: z.union([
    z.number().min(0),
    z.string().transform((val) => val === '' ? undefined : parseFloat(val))
      .pipe(z.number().min(0).optional()),
    z.undefined(),
  ]).optional(),
  rating: z.union([
    z.number().int().min(0).max(5),
    z.string().transform((val) => val === '' ? undefined : parseInt(val, 10))
      .pipe(z.number().int().min(0).max(5).optional()),
    z.undefined(),
  ]).optional(),
  categoryData: z.any().optional(), // JSON field - flexible structure
  paymentTermsId: z.union([z.string().uuid(), z.literal('')]).optional(),
  currencyCode: z.string().max(3).optional().or(z.literal('')),
}).passthrough(); // Allow extra fields to pass through without error

/**
 * Schema for updating a supplier
 * PUT /api/suppliers/:id
 * Note: validateBody middleware passes req.body directly, not wrapped in { body: ... }
 * Params are validated separately via validateParams middleware
 */
export const updateSupplierSchema = z.object({
  code: z.string().min(2).max(50).optional(),
  name: z.string().min(2).max(200).optional(),
  supplierCategory: SupplierCategoryEnum.optional(),
  contactPerson: z.string().max(100).optional().or(z.literal('')),
  email: z.union([z.string().email(), z.literal('')]).optional(),
  phone: z.string().max(20).optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  gstNumber: z.union([z.string().regex(gstRegex, 'Invalid GST number format'), z.literal('')]).optional(),
  panNumber: z.union([z.string().regex(panRegex, 'Invalid PAN number format'), z.literal('')]).optional(),
  paymentTerms: z.string().optional().or(z.literal('')),
  creditDays: z.union([
    z.number().int().min(0).max(365),
    z.string().transform((val) => val === '' ? undefined : parseInt(val, 10))
      .pipe(z.number().int().min(0).max(365).optional()),
    z.undefined(),
  ]).optional(),
  creditLimit: z.union([
    z.number().min(0),
    z.string().transform((val) => val === '' ? undefined : parseFloat(val))
      .pipe(z.number().min(0).optional()),
    z.undefined(),
  ]).optional(),
  rating: z.union([
    z.number().int().min(0).max(5),
    z.string().transform((val) => val === '' ? undefined : parseInt(val, 10))
      .pipe(z.number().int().min(0).max(5).optional()),
    z.undefined(),
  ]).optional(),
  categoryData: z.any().optional(), // JSON field - flexible structure
  paymentTermsId: z.union([z.string().uuid(), z.literal('')]).optional(),
  currencyCode: z.string().max(3).optional().or(z.literal('')),
}).passthrough(); // Allow extra fields to pass through without error

/**
 * Schema for querying suppliers
 * GET /api/suppliers
 * Note: validateQuery middleware passes req.query directly, not wrapped in { query: ... }
 */
export const supplierQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)).pipe(z.number().int().min(1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 10)).pipe(z.number().int().min(1).max(1000)),
  search: z.string().optional(),
  category: SupplierCategoryEnum.optional(),
  rating: z.string().optional().transform((val) => (val ? parseInt(val, 10) : undefined)).pipe(z.number().int().min(0).max(5).optional()),
  isActive: z.string().optional().transform((val) => {
    if (val === undefined || val === '') return undefined;
    return val === 'true' || val === '1';
  }).pipe(z.boolean().optional()),
});

/**
 * Schema for supplier ID parameter validation
 * Used in GET /api/suppliers/:id, PUT /api/suppliers/:id, DELETE /api/suppliers/:id
 * Note: validateParams middleware passes req.params directly, not wrapped in { params: ... }
 */
export const supplierIdParamSchema = z.object({
  id: z.string().uuid(),
});

// Type exports for use in controllers
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type SupplierQueryInput = z.infer<typeof supplierQuerySchema>;
export type SupplierIdParam = z.infer<typeof supplierIdParamSchema>;
export type SupplierCategory = z.infer<typeof SupplierCategoryEnum>;
