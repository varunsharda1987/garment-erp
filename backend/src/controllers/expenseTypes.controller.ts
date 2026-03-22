// Expense Types Controller
import { Request, Response } from 'express';
import prisma from '../config/database';
import { ExpenseCategory, Prisma } from '@prisma/client';
import { NotFoundError, ValidationError, ConflictError } from '../errors';

export const createExpenseType = async (req: Request, res: Response): Promise<void> => {
  const { expenseCode, expenseName, expenseCategory, accountId, isRecurring, description } = req.body;

  const existing = await prisma.expense_types.findFirst({ where: { expenseCode, isActive: true } });
  if (existing) {
    throw new ConflictError('Expense code already exists');
  }

  const expenseType = await prisma.expense_types.create({
    data: {
      expenseCode,
      expenseName,
      expenseCategory: expenseCategory as ExpenseCategory,
      accountId: accountId || null,
      isRecurring: isRecurring || false,
      description: description || null,
      isActive: true,
      createdById: req.user!.userId,
    },
    include: {
      chart_of_accounts: { select: { id: true, accountCode: true, accountName: true } },
      users: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  res.status(201).json({ data: expenseType, message: 'Expense type created successfully' });
};

export const getAllExpenseTypes = async (req: Request, res: Response): Promise<void> => {
  const { page = '1', limit = '20', search = '', expenseCategory, accountId } = req.query;
  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  const skip = (pageNum - 1) * limitNum;

  const where: Prisma.expense_typesWhereInput = { isActive: true };

  if (search) {
    where.OR = [
      { expenseCode: { contains: search as string, mode: 'insensitive' } },
      { expenseName: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  if (expenseCategory) where.expenseCategory = expenseCategory as ExpenseCategory;
  if (accountId) where.accountId = accountId as string;

  const [expenseTypes, total] = await Promise.all([
    prisma.expense_types.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { expenseCode: 'asc' },
      include: {
        chart_of_accounts: { select: { accountCode: true, accountName: true } },
      },
    }),
    prisma.expense_types.count({ where }),
  ]);

  res.json({
    data: expenseTypes,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
  });
};

export const getExpenseTypeById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const expenseType = await prisma.expense_types.findUnique({
    where: { id },
    include: {
      chart_of_accounts: true,
      users: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  if (!expenseType) {
    throw new NotFoundError('ExpenseType', id);
  }

  res.json({ data: expenseType });
};

export const updateExpenseType = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { expenseCode, expenseName, expenseCategory, accountId, isRecurring, description } = req.body;

  const existing = await prisma.expense_types.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('ExpenseType', id);
  }

  if (expenseCode !== existing.expenseCode) {
    const codeExists = await prisma.expense_types.findFirst({ where: { expenseCode, isActive: true } });
    if (codeExists) {
      throw new ConflictError('Expense code already exists');
    }
  }

  const expenseType = await prisma.expense_types.update({
    where: { id },
    data: {
      expenseCode,
      expenseName,
      expenseCategory: expenseCategory as ExpenseCategory,
      accountId: accountId || null,
      isRecurring,
      description: description || null,
    },
  });

  res.json({ data: expenseType, message: 'Expense type updated successfully' });
};

export const deleteExpenseType = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const expenseType = await prisma.expense_types.findUnique({ where: { id } });

  if (!expenseType) {
    throw new NotFoundError('ExpenseType', id);
  }

  await prisma.expense_types.update({ where: { id }, data: { isActive: false } });
  res.json({ message: 'Expense type deleted successfully' });
};
