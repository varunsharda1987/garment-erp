import { z } from 'zod';

/**
 * RateType Enum - matches Prisma RateType
 */
export const RateTypeEnum = z.enum(['BUYING', 'SELLING', 'AVERAGE']);

/**
 * Create Currency Schema
 * POST /api/currencies
 */
export const createCurrencySchema = z.object({
  currencyCode: z
    .string()
    .length(3, 'Currency code must be exactly 3 characters')
    .trim()
    .toUpperCase(),
  currencyName: z
    .string()
    .min(1, 'Currency name is required')
    .max(100, 'Currency name must not exceed 100 characters')
    .trim(),
  currencySymbol: z
    .string()
    .min(1, 'Currency symbol is required')
    .max(10, 'Currency symbol must not exceed 10 characters')
    .trim(),
  isBaseCurrency: z.boolean().optional().default(false),
  decimalPlaces: z
    .number()
    .int()
    .min(0, 'Decimal places must be non-negative')
    .max(6, 'Decimal places must not exceed 6')
    .optional()
    .default(2),
  isActive: z.boolean().optional().default(true),
});

/**
 * Update Currency Schema
 * PUT /api/currencies/:code
 */
export const updateCurrencySchema = z.object({
  currencyName: z
    .string()
    .min(1, 'Currency name is required')
    .max(100, 'Currency name must not exceed 100 characters')
    .trim()
    .optional(),
  currencySymbol: z
    .string()
    .min(1, 'Currency symbol is required')
    .max(10, 'Currency symbol must not exceed 10 characters')
    .trim()
    .optional(),
  isBaseCurrency: z.boolean().optional(),
  decimalPlaces: z
    .number()
    .int()
    .min(0, 'Decimal places must be non-negative')
    .max(6, 'Decimal places must not exceed 6')
    .optional(),
  isActive: z.boolean().optional(),
});

/**
 * Create Exchange Rate Schema
 * POST /api/currencies/:code/exchange-rates
 */
export const createExchangeRateSchema = z.object({
  currencyCode: z
    .string()
    .length(3, 'Currency code must be exactly 3 characters')
    .trim()
    .toUpperCase()
    .optional(), // Optional since it can come from URL param
  effectiveDate: z
    .string()
    .min(1, 'Effective date is required')
    .refine((val) => !isNaN(Date.parse(val)), 'Invalid date format'),
  rateType: RateTypeEnum,
  exchangeRate: z
    .number()
    .positive('Exchange rate must be positive'),
});

/**
 * Currency Query Schema
 * GET /api/currencies
 */
export const currencyQuerySchema = z.object({
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
  isActive: z
    .string()
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      return val === 'true';
    })
    .pipe(z.boolean().optional()),
  sortBy: z
    .enum(['currencyCode', 'currencyName', 'createdAt'])
    .optional()
    .default('currencyCode'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

// Type exports
export type CreateCurrencyInput = z.infer<typeof createCurrencySchema>;
export type UpdateCurrencyInput = z.infer<typeof updateCurrencySchema>;
export type CreateExchangeRateInput = z.infer<typeof createExchangeRateSchema>;
export type CurrencyQueryInput = z.infer<typeof currencyQuerySchema>;
export type RateType = z.infer<typeof RateTypeEnum>;
