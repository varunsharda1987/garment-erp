import { z } from 'zod';

/**
 * BankAccountType Enum - matches Prisma BankAccountType
 */
export const BankAccountTypeEnum = z.enum(['CURRENT', 'SAVINGS', 'OD', 'CC']);

/**
 * Create Bank Account Schema
 * POST /api/bank-accounts
 */
export const createBankAccountSchema = z.object({
  accountNumber: z
    .string()
    .min(1, 'Account number is required')
    .max(50, 'Account number must not exceed 50 characters')
    .trim(),
  bankName: z
    .string()
    .min(1, 'Bank name is required')
    .max(200, 'Bank name must not exceed 200 characters')
    .trim(),
  branchName: z
    .string()
    .min(1, 'Branch name is required')
    .max(200, 'Branch name must not exceed 200 characters')
    .trim(),
  ifscCode: z
    .string()
    .max(20, 'IFSC code must not exceed 20 characters')
    .trim()
    .optional()
    .nullable(),
  swiftCode: z
    .string()
    .max(20, 'SWIFT code must not exceed 20 characters')
    .trim()
    .optional()
    .nullable(),
  accountType: BankAccountTypeEnum,
  accountHolderName: z
    .string()
    .min(1, 'Account holder name is required')
    .max(200, 'Account holder name must not exceed 200 characters')
    .trim(),
  openingBalance: z
    .number()
    .nonnegative('Opening balance must be non-negative')
    .optional()
    .default(0),
  currency: z
    .string()
    .max(10, 'Currency must not exceed 10 characters')
    .trim()
    .optional()
    .default('INR'),
  isPrimaryAccount: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
});

/**
 * Update Bank Account Schema
 * PUT /api/bank-accounts/:id
 */
export const updateBankAccountSchema = z.object({
  accountNumber: z
    .string()
    .min(1, 'Account number is required')
    .max(50, 'Account number must not exceed 50 characters')
    .trim()
    .optional(),
  bankName: z
    .string()
    .min(1, 'Bank name is required')
    .max(200, 'Bank name must not exceed 200 characters')
    .trim()
    .optional(),
  branchName: z
    .string()
    .min(1, 'Branch name is required')
    .max(200, 'Branch name must not exceed 200 characters')
    .trim()
    .optional(),
  ifscCode: z
    .string()
    .max(20, 'IFSC code must not exceed 20 characters')
    .trim()
    .optional()
    .nullable(),
  swiftCode: z
    .string()
    .max(20, 'SWIFT code must not exceed 20 characters')
    .trim()
    .optional()
    .nullable(),
  accountType: BankAccountTypeEnum.optional(),
  accountHolderName: z
    .string()
    .min(1, 'Account holder name is required')
    .max(200, 'Account holder name must not exceed 200 characters')
    .trim()
    .optional(),
  openingBalance: z.number().nonnegative('Opening balance must be non-negative').optional(),
  currency: z.string().max(10, 'Currency must not exceed 10 characters').trim().optional(),
  isPrimaryAccount: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

/**
 * Bank Account Query Schema
 * GET /api/bank-accounts
 */
export const bankAccountQuerySchema = z.object({
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
    .enum(['accountNumber', 'bankName', 'accountType', 'createdAt'])
    .optional()
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// Type exports
export type CreateBankAccountInput = z.infer<typeof createBankAccountSchema>;
export type UpdateBankAccountInput = z.infer<typeof updateBankAccountSchema>;
export type BankAccountQueryInput = z.infer<typeof bankAccountQuerySchema>;
export type BankAccountType = z.infer<typeof BankAccountTypeEnum>;
