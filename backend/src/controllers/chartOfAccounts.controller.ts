// Chart of Accounts Controller
import { Request, Response } from 'express';
import prisma from '../config/database';
import { AccountType, AccountGroup, Prisma } from '@prisma/client';
import { NotFoundError, ValidationError, ConflictError, ForbiddenError } from '../errors';

/**
 * Create new account
 * POST /api/chart-of-accounts
 */
export const createAccount = async (req: Request, res: Response): Promise<void> => {
  const {
    accountCode,
    accountName,
    accountType,
    accountGroup,
    parentAccountId,
    description,
  } = req.body;

  // Check if account code already exists
  const existingAccount = await prisma.chart_of_accounts.findFirst({
    where: { accountCode, isActive: true },
  });

  if (existingAccount) {
    throw new ConflictError('Account code already exists');
  }

  // If parentAccountId provided, verify it exists
  if (parentAccountId) {
    const parentAccount = await prisma.chart_of_accounts.findUnique({
      where: { id: parentAccountId },
    });

    if (!parentAccount) {
      throw new NotFoundError('ParentAccount', parentAccountId);
    }
  }

  const account = await prisma.chart_of_accounts.create({
    data: {
      accountCode,
      accountName,
      accountType: accountType as AccountType,
      accountGroup: accountGroup as AccountGroup,
      parentAccountId: parentAccountId || null,
      description: description || null,
      isActive: true,
      isSystem: false,
      createdById: req.user!.userId,
    },
    include: {
      parentAccount: {
        select: {
          id: true,
          accountCode: true,
          accountName: true,
        },
      },
      users: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  res.status(201).json({
    data: account,
    message: 'Account created successfully',
  });
};

/**
 * Get all accounts with pagination, search, and filters
 * GET /api/chart-of-accounts
 */
export const getAllAccounts = async (req: Request, res: Response): Promise<void> => {
  const {
    page = '1',
    limit = '50',
    search = '',
    accountType,
    accountGroup,
    parentAccountId,
  } = req.query;

  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  const skip = (pageNum - 1) * limitNum;

  // Build where clause
  const where: Prisma.chart_of_accountsWhereInput = { isActive: true };

  if (search) {
    where.OR = [
      { accountCode: { contains: search as string, mode: 'insensitive' } },
      { accountName: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  if (accountType) {
    where.accountType = accountType as AccountType;
  }

  if (accountGroup) {
    where.accountGroup = accountGroup as AccountGroup;
  }

  if (parentAccountId) {
    where.parentAccountId = parentAccountId === 'null' ? null : (parentAccountId as string);
  }

  const [accounts, total] = await Promise.all([
    prisma.chart_of_accounts.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { accountCode: 'asc' },
      include: {
        parentAccount: {
          select: {
            id: true,
            accountCode: true,
            accountName: true,
          },
        },
        _count: {
          select: { childAccounts: true },
        },
      },
    }),
    prisma.chart_of_accounts.count({ where }),
  ]);

  res.json({
    data: accounts,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
  });
};

/**
 * Get account hierarchy (tree structure)
 * GET /api/chart-of-accounts/hierarchy
 */
export const getAccountHierarchy = async (req: Request, res: Response): Promise<void> => {
  const { accountType } = req.query;

  const where: Prisma.chart_of_accountsWhereInput = { isActive: true, parentAccountId: null };

  if (accountType) {
    where.accountType = accountType as AccountType;
  }

  // Get root accounts (no parent)
  const rootAccounts = await prisma.chart_of_accounts.findMany({
    where,
    orderBy: { accountCode: 'asc' },
    include: {
      childAccounts: {
        where: { isActive: true },
        orderBy: { accountCode: 'asc' },
        include: {
          childAccounts: {
            where: { isActive: true },
            orderBy: { accountCode: 'asc' },
            include: {
              childAccounts: {
                where: { isActive: true },
                orderBy: { accountCode: 'asc' },
              },
            },
          },
        },
      },
    },
  });

  res.json({
    data: rootAccounts,
    message: 'Account hierarchy retrieved successfully',
  });
};

/**
 * Get account by ID
 * GET /api/chart-of-accounts/:id
 */
export const getAccountById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const account = await prisma.chart_of_accounts.findUnique({
    where: { id },
    include: {
      parentAccount: {
        select: {
          id: true,
          accountCode: true,
          accountName: true,
          accountType: true,
        },
      },
      childAccounts: {
        where: { isActive: true },
        select: {
          id: true,
          accountCode: true,
          accountName: true,
          accountType: true,
          accountGroup: true,
        },
      },
      users: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  if (!account) {
    throw new NotFoundError('Account', id);
  }

  res.json({ data: account });
};

/**
 * Update account
 * PUT /api/chart-of-accounts/:id
 */
export const updateAccount = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const {
    accountCode,
    accountName,
    accountType,
    accountGroup,
    parentAccountId,
    description,
  } = req.body;

  // Check if account exists
  const existingAccount = await prisma.chart_of_accounts.findUnique({
    where: { id },
  });

  if (!existingAccount) {
    throw new NotFoundError('Account', id);
  }

  // Check if trying to update system account
  if (existingAccount.isSystem) {
    throw new ForbiddenError('System accounts cannot be modified');
  }

  // Check if new account code already exists
  if (accountCode !== existingAccount.accountCode) {
    const codeExists = await prisma.chart_of_accounts.findFirst({
      where: { accountCode, isActive: true },
    });

    if (codeExists) {
      throw new ConflictError('Account code already exists');
    }
  }

  // Validate parent account (cannot be itself or its own child)
  if (parentAccountId && parentAccountId === id) {
    throw new ValidationError('Account cannot be its own parent');
  }

  const account = await prisma.chart_of_accounts.update({
    where: { id },
    data: {
      accountCode,
      accountName,
      accountType: accountType as AccountType,
      accountGroup: accountGroup as AccountGroup,
      parentAccountId: parentAccountId || null,
      description: description || null,
    },
    include: {
      parentAccount: {
        select: {
          id: true,
          accountCode: true,
          accountName: true,
        },
      },
    },
  });

  res.json({
    data: account,
    message: 'Account updated successfully',
  });
};

/**
 * Delete account (soft delete)
 * DELETE /api/chart-of-accounts/:id
 */
export const deleteAccount = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const account = await prisma.chart_of_accounts.findUnique({
    where: { id },
    include: {
      childAccounts: { where: { isActive: true } },
    },
  });

  if (!account) {
    throw new NotFoundError('Account', id);
  }

  // Check if system account
  if (account.isSystem) {
    throw new ForbiddenError('System accounts cannot be deleted');
  }

  // Check if has active child accounts
  if (account.childAccounts.length > 0) {
    throw new ValidationError('Cannot delete account with active child accounts');
  }

  await prisma.chart_of_accounts.update({
    where: { id },
    data: { isActive: false },
  });

  res.json({
    message: 'Account deleted successfully',
  });
};
