import { z } from 'zod';

/**
 * HSNSACType Enum - matches Prisma HSNSACType enum
 */
export const HSNSACTypeEnum = z.enum([
  'HSN',
  'SAC',
]);

/**
 * Create HSN/SAC Master Schema
 * POST /api/hsn-sac-masters
 */
export const createHsnSacMasterSchema = z.object({
  code: z
    .string()
    .min(1, 'Code is required')
    .max(20, 'Code must not exceed 20 characters')
    .trim(),
  type: HSNSACTypeEnum,
  description: z
    .string()
    .min(1, 'Description is required')
    .max(500, 'Description must not exceed 500 characters')
    .trim(),
  chapter: z.string().max(50).trim().optional().nullable(),
  section: z.string().max(50).trim().optional().nullable(),
  defaultGstRate: z
    .number()
    .min(0, 'Default GST rate must be at least 0')
    .max(100, 'Default GST rate must not exceed 100'),
  unit: z.string().max(50).trim().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

/**
 * Update HSN/SAC Master Schema
 * PUT /api/hsn-sac-masters/:id
 * Note: code is always required for updates (not optional)
 */
export const updateHsnSacMasterSchema = z.object({
  code: z
    .string()
    .min(1, 'Code is required')
    .max(20, 'Code must not exceed 20 characters')
    .trim(),
  type: HSNSACTypeEnum.optional(),
  description: z
    .string()
    .min(1, 'Description is required')
    .max(500, 'Description must not exceed 500 characters')
    .trim()
    .optional(),
  chapter: z.string().max(50).trim().optional().nullable(),
  section: z.string().max(50).trim().optional().nullable(),
  defaultGstRate: z
    .number()
    .min(0, 'Default GST rate must be at least 0')
    .max(100, 'Default GST rate must not exceed 100')
    .optional(),
  unit: z.string().max(50).trim().optional().nullable(),
  isActive: z.boolean().optional(),
});

/**
 * HSN/SAC Master Query Schema
 * GET /api/hsn-sac-masters
 */
export const hsnSacMasterQuerySchema = z.object({
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
  type: HSNSACTypeEnum.optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      return val === 'true';
    })
    .pipe(z.boolean().optional()),
  sortBy: z.enum(['code', 'description', 'type', 'defaultGstRate', 'createdAt']).optional().default('code'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

// Type exports
export type CreateHsnSacMasterInput = z.infer<typeof createHsnSacMasterSchema>;
export type UpdateHsnSacMasterInput = z.infer<typeof updateHsnSacMasterSchema>;
export type HsnSacMasterQueryInput = z.infer<typeof hsnSacMasterQuerySchema>;
export type HSNSACType = z.infer<typeof HSNSACTypeEnum>;
