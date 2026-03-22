import { z } from 'zod';

/**
 * Color Family Enum - predefined list of color families
 */
export const ColorFamilyEnum = z.enum([
  'Reds',
  'Blues',
  'Greens',
  'Yellows',
  'Oranges',
  'Purples',
  'Pinks',
  'Browns',
  'Neutrals',
  'Prints',
  'Metallics',
]);

/**
 * Hex color code validation regex
 * Matches: #RGB, #RRGGBB (case insensitive)
 */
const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

/**
 * Create Color Schema
 * POST /api/colors
 */
export const createColorSchema = z.object({
  colorName: z
    .string()
    .min(2, 'Color name must be at least 2 characters')
    .max(100, 'Color name must not exceed 100 characters')
    .trim(),
  hexCode: z.string().regex(hexColorRegex, 'Invalid hex color code (e.g., #FF0000 or #F00)').optional().nullable(),
  colorFamily: ColorFamilyEnum.optional().nullable(),
  description: z.string().max(500, 'Description must not exceed 500 characters').trim().optional().nullable(),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().nonnegative().optional().default(0),
});

/**
 * Update Color Schema
 * PUT /api/colors/:id
 */
export const updateColorSchema = z.object({
  colorName: z
    .string()
    .min(2, 'Color name must be at least 2 characters')
    .max(100, 'Color name must not exceed 100 characters')
    .trim()
    .optional(),
  hexCode: z.string().regex(hexColorRegex, 'Invalid hex color code (e.g., #FF0000 or #F00)').optional().nullable(),
  colorFamily: ColorFamilyEnum.optional().nullable(),
  description: z.string().max(500, 'Description must not exceed 500 characters').trim().optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});

/**
 * Color Query Schema
 * GET /api/colors
 */
export const colorQuerySchema = z.object({
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
  colorFamily: ColorFamilyEnum.optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      return val === 'true';
    })
    .pipe(z.boolean().optional()),
  sortBy: z.enum(['colorName', 'colorCode', 'colorFamily', 'createdAt', 'sortOrder']).optional().default('sortOrder'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

/**
 * Color Search Query Schema
 * GET /api/colors/search
 */
export const colorSearchSchema = z.object({
  search: z.string().trim().optional(),
  colorFamily: ColorFamilyEnum.optional(),
  limit: z
    .string()
    .optional()
    .default('50')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive().max(500)),
});

/**
 * Color ID Param Schema
 * Validates color ID in route parameters
 */
export const colorIdParamSchema = z.object({
  id: z.string().min(1, 'Color ID is required'),
});

/**
 * Bulk Import Row Schema
 */
export const colorImportRowSchema = z.object({
  colorName: z
    .string()
    .min(2, 'Color name must be at least 2 characters')
    .max(100, 'Color name must not exceed 100 characters')
    .trim(),
  hexCode: z
    .string()
    .regex(hexColorRegex, 'Invalid hex color code')
    .optional()
    .nullable()
    .transform((val) => val || null),
  colorFamily: ColorFamilyEnum.optional().nullable(),
  description: z.string().max(500).trim().optional().nullable(),
});

/**
 * Bulk Import Schema
 */
export const colorBulkImportSchema = z.object({
  colors: z.array(colorImportRowSchema).min(1, 'At least one color is required'),
});

// Type exports for use in controllers
export type CreateColorInput = z.infer<typeof createColorSchema>;
export type UpdateColorInput = z.infer<typeof updateColorSchema>;
export type ColorQueryInput = z.infer<typeof colorQuerySchema>;
export type ColorSearchInput = z.infer<typeof colorSearchSchema>;
export type ColorIdParamInput = z.infer<typeof colorIdParamSchema>;
export type ColorImportRowInput = z.infer<typeof colorImportRowSchema>;
export type ColorBulkImportInput = z.infer<typeof colorBulkImportSchema>;
export type ColorFamily = z.infer<typeof ColorFamilyEnum>;
