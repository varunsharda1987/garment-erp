import { z } from 'zod';

/**
 * ExpenseCategory Enum - matches Prisma ExpenseCategory
 */
export const ExpenseCategoryEnum = z.enum(['DIRECT', 'INDIRECT', 'OVERHEAD', 'ADMINISTRATIVE', 'MARKETING']);

/**
 * Create Expense Type Schema
 * POST /api/expense-types
 */
export const createExpenseTypeSchema = z.object({
  expenseCode: z
    .string()
    .min(1, 'Expense code is required')
    .max(50, 'Expense code must not exceed 50 characters')
    .trim(),
  expenseName: z
    .string()
    .min(1, 'Expense name is required')
    .max(200, 'Expense name must not exceed 200 characters')
    .trim(),
  expenseCategory: ExpenseCategoryEnum,
  accountId: z.string().uuid('Invalid account ID format').optional().nullable(),
  isRecurring: z.boolean().optional().default(false),
  description: z.string().max(500, 'Description must not exceed 500 characters').trim().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

/**
 * Update Expense Type Schema
 * PUT /api/expense-types/:id
 */
export const updateExpenseTypeSchema = z.object({
  expenseCode: z
    .string()
    .min(1, 'Expense code is required')
    .max(50, 'Expense code must not exceed 50 characters')
    .trim()
    .optional(),
  expenseName: z
    .string()
    .min(1, 'Expense name is required')
    .max(200, 'Expense name must not exceed 200 characters')
    .trim()
    .optional(),
  expenseCategory: ExpenseCategoryEnum.optional(),
  accountId: z.string().uuid('Invalid account ID format').optional().nullable(),
  isRecurring: z.boolean().optional(),
  description: z.string().max(500, 'Description must not exceed 500 characters').trim().optional().nullable(),
  isActive: z.boolean().optional(),
});

/**
 * Expense Type Query Schema
 * GET /api/expense-types
 */
export const expenseTypeQuerySchema = z.object({
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
  sortBy: z.enum(['expenseCode', 'expenseName', 'expenseCategory', 'createdAt']).optional().default('expenseCode'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

// Type exports
export type CreateExpenseTypeInput = z.infer<typeof createExpenseTypeSchema>;
export type UpdateExpenseTypeInput = z.infer<typeof updateExpenseTypeSchema>;
export type ExpenseTypeQueryInput = z.infer<typeof expenseTypeQuerySchema>;
export type ExpenseCategory = z.infer<typeof ExpenseCategoryEnum>;
