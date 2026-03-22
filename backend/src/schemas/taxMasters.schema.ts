import { z } from 'zod';

/**
 * TaxType Enum - matches Prisma TaxType enum
 */
export const TaxTypeEnum = z.enum([
  'GST',
  'IGST',
  'SGST',
  'CGST',
  'VAT',
  'CUSTOMS_DUTY',
  'EXCISE_DUTY',
  'SERVICE_TAX',
]);

/**
 * Create Tax Master Schema
 * POST /api/tax-masters
 */
export const createTaxMasterSchema = z.object({
  taxCode: z
    .string()
    .min(1, 'Tax code is required')
    .max(50, 'Tax code must not exceed 50 characters')
    .trim(),
  taxName: z
    .string()
    .min(1, 'Tax name is required')
    .max(100, 'Tax name must not exceed 100 characters')
    .trim(),
  taxType: TaxTypeEnum,
  taxRate: z
    .number()
    .min(0, 'Tax rate must be at least 0')
    .max(100, 'Tax rate must not exceed 100'),
  hsnSacCode: z.string().max(20).trim().optional().nullable(),
  description: z.string().max(500, 'Description must not exceed 500 characters').trim().optional().nullable(),
  applicableFrom: z.string().min(1, 'Applicable from date is required'),
  applicableTo: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

/**
 * Update Tax Master Schema
 * PUT /api/tax-masters/:id
 */
export const updateTaxMasterSchema = z.object({
  taxCode: z
    .string()
    .min(1, 'Tax code is required')
    .max(50, 'Tax code must not exceed 50 characters')
    .trim()
    .optional(),
  taxName: z
    .string()
    .min(1, 'Tax name is required')
    .max(100, 'Tax name must not exceed 100 characters')
    .trim()
    .optional(),
  taxType: TaxTypeEnum.optional(),
  taxRate: z
    .number()
    .min(0, 'Tax rate must be at least 0')
    .max(100, 'Tax rate must not exceed 100')
    .optional(),
  hsnSacCode: z.string().max(20).trim().optional().nullable(),
  description: z.string().max(500, 'Description must not exceed 500 characters').trim().optional().nullable(),
  applicableFrom: z.string().optional(),
  applicableTo: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

/**
 * Tax Master Query Schema
 * GET /api/tax-masters
 */
export const taxMasterQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .default('1')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  limit: z
    .string()
    .optional()
    .default('10')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive().max(1000, 'Limit must not exceed 1000')),
  search: z.string().trim().optional(),
  taxType: TaxTypeEnum.optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      return val === 'true';
    })
    .pipe(z.boolean().optional()),
  sortBy: z.enum(['taxCode', 'taxName', 'taxType', 'taxRate', 'createdAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// Type exports
export type CreateTaxMasterInput = z.infer<typeof createTaxMasterSchema>;
export type UpdateTaxMasterInput = z.infer<typeof updateTaxMasterSchema>;
export type TaxMasterQueryInput = z.infer<typeof taxMasterQuerySchema>;
export type TaxType = z.infer<typeof TaxTypeEnum>;
