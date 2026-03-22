import { z } from 'zod';

/**
 * AccountType Enum - matches Prisma AccountType
 */
export const AccountTypeEnum = z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']);

/**
 * AccountGroup Enum - matches Prisma AccountGroup
 */
export const AccountGroupEnum = z.enum([
  'CURRENT_ASSET',
  'FIXED_ASSET',
  'CURRENT_LIABILITY',
  'LONG_TERM_LIABILITY',
  'EQUITY',
  'DIRECT_REVENUE',
  'INDIRECT_REVENUE',
  'DIRECT_EXPENSE',
  'INDIRECT_EXPENSE',
  'OVERHEAD',
]);

/**
 * Create Chart of Account Schema
 * POST /api/chart-of-accounts
 */
export const createChartOfAccountSchema = z.object({
  accountCode: z
    .string()
    .min(1, 'Account code is required')
    .max(50, 'Account code must not exceed 50 characters')
    .trim(),
  accountName: z
    .string()
    .min(1, 'Account name is required')
    .max(200, 'Account name must not exceed 200 characters')
    .trim(),
  accountType: AccountTypeEnum,
  accountGroup: AccountGroupEnum,
  parentAccountId: z.string().uuid('Invalid parent account ID format').optional().nullable(),
  description: z.string().max(500, 'Description must not exceed 500 characters').trim().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

/**
 * Update Chart of Account Schema
 * PUT /api/chart-of-accounts/:id
 * Note: accountCode is not updatable
 */
export const updateChartOfAccountSchema = z.object({
  accountName: z
    .string()
    .min(1, 'Account name is required')
    .max(200, 'Account name must not exceed 200 characters')
    .trim()
    .optional(),
  accountType: AccountTypeEnum.optional(),
  accountGroup: AccountGroupEnum.optional(),
  parentAccountId: z.string().uuid('Invalid parent account ID format').optional().nullable(),
  description: z.string().max(500, 'Description must not exceed 500 characters').trim().optional().nullable(),
  isActive: z.boolean().optional(),
});

/**
 * Chart of Account Query Schema
 * GET /api/chart-of-accounts
 */
export const chartOfAccountQuerySchema = z.object({
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
  accountType: AccountTypeEnum.optional(),
  accountGroup: AccountGroupEnum.optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      return val === 'true';
    })
    .pipe(z.boolean().optional()),
  sortBy: z
    .enum(['accountCode', 'accountName', 'accountType', 'accountGroup', 'createdAt'])
    .optional()
    .default('accountCode'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

// Type exports
export type CreateChartOfAccountInput = z.infer<typeof createChartOfAccountSchema>;
export type UpdateChartOfAccountInput = z.infer<typeof updateChartOfAccountSchema>;
export type ChartOfAccountQueryInput = z.infer<typeof chartOfAccountQuerySchema>;
export type AccountType = z.infer<typeof AccountTypeEnum>;
export type AccountGroup = z.infer<typeof AccountGroupEnum>;
