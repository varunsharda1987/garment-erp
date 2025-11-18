// Expense Types Controller
import { Request, Response } from 'express';
import prisma from '../config/database';
import { ExpenseCategory } from '@prisma/client';

export const createExpenseType = async (req: Request, res: Response): Promise<void> => {
  try {
    const { expenseCode, expenseName, expenseCategory, accountId, isRecurring, description } = req.body;
    const userId = (req as any).user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
      return;
    }

    const existing = await prisma.expense_types.findUnique({ where: { expenseCode } });
    if (existing) {
      res.status(400).json({ error: 'Validation Error', message: 'Expense code already exists' });
      return;
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
        createdById: userId,
      } as any,
      include: {
        chart_of_accounts: { select: { id: true, accountCode: true, accountName: true } },
        users: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.status(201).json({ data: expenseType, message: 'Expense type created successfully' });
  } catch (error) {
    console.error('Create expense type error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create expense type' });
  }
};

export const getAllExpenseTypes = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20', search = '', expenseCategory, accountId } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = { isActive: true };

    if (search) {
      where.OR = [
        { expenseCode: { contains: search as string, mode: 'insensitive' } },
        { expenseName: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    if (expenseCategory) where.expenseCategory = expenseCategory;
    if (accountId) where.accountId = accountId;

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

    res.json({ data: expenseTypes, pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) } });
  } catch (error) {
    console.error('Get expense types error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch expense types' });
  }
};

export const getExpenseTypeById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const expenseType = await prisma.expense_types.findUnique({
      where: { id },
      include: {
        chart_of_accounts: true,
        users: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (!expenseType) {
      res.status(404).json({ error: 'Not Found', message: 'Expense type not found' });
      return;
    }

    res.json({ data: expenseType });
  } catch (error) {
    console.error('Get expense type error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch expense type' });
  }
};

export const updateExpenseType = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { expenseCode, expenseName, expenseCategory, accountId, isRecurring, description } = req.body;

    const existing = await prisma.expense_types.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Not Found', message: 'Expense type not found' });
      return;
    }

    if (expenseCode !== existing.expenseCode) {
      const codeExists = await prisma.expense_types.findUnique({ where: { expenseCode } });
      if (codeExists) {
        res.status(400).json({ error: 'Validation Error', message: 'Expense code already exists' });
        return;
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
  } catch (error) {
    console.error('Update expense type error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update expense type' });
  }
};

export const deleteExpenseType = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const expenseType = await prisma.expense_types.findUnique({ where: { id } });

    if (!expenseType) {
      res.status(404).json({ error: 'Not Found', message: 'Expense type not found' });
      return;
    }

    await prisma.expense_types.update({ where: { id }, data: { isActive: false } });
    res.json({ message: 'Expense type deleted successfully' });
  } catch (error) {
    console.error('Delete expense type error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete expense type' });
  }
};
