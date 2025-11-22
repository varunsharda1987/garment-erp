// Chart of Accounts Controller
import { Request, Response } from 'express';
import prisma from '../config/database';
import { AccountType, AccountGroup } from '@prisma/client';
import { logInfo, logError, logWarn, logDebug } from '../utils/logger';

/**
 * Create new account
 * POST /api/chart-of-accounts
 */
export const createAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      accountCode,
      accountName,
      accountType,
      accountGroup,
      parentAccountId,
      description,
    } = req.body;

    const userId = (req as any).user?.userId;

    if (!userId) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
      return;
    }

    // Check if account code already exists
    const existingAccount = await prisma.chart_of_accounts.findUnique({
      where: { accountCode },
    });

    if (existingAccount) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Account code already exists',
      });
      return;
    }

    // If parentAccountId provided, verify it exists
    if (parentAccountId) {
      const parentAccount = await prisma.chart_of_accounts.findUnique({
        where: { id: parentAccountId },
      });

      if (!parentAccount) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Parent account not found',
        });
        return;
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
        createdById: userId,
      } as any,
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
  } catch (error) {
    logError('Create account error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create account',
    });
  }
};

/**
 * Get all accounts with pagination, search, and filters
 * GET /api/chart-of-accounts
 */
export const getAllAccounts = async (req: Request, res: Response): Promise<void> => {
  try {
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
    const where: any = { isActive: true };

    if (search) {
      where.OR = [
        { accountCode: { contains: search as string, mode: 'insensitive' } },
        { accountName: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    if (accountType) {
      where.accountType = accountType as string;
    }

    if (accountGroup) {
      where.accountGroup = accountGroup as string;
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
  } catch (error) {
    logError('Get accounts error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch accounts',
    });
  }
};

/**
 * Get account hierarchy (tree structure)
 * GET /api/chart-of-accounts/hierarchy
 */
export const getAccountHierarchy = async (req: Request, res: Response): Promise<void> => {
  try {
    const { accountType } = req.query;

    const where: any = { isActive: true, parentAccountId: null };

    if (accountType) {
      where.accountType = accountType as string;
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
  } catch (error) {
    logError('Get account hierarchy error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch account hierarchy',
    });
  }
};

/**
 * Get account by ID
 * GET /api/chart-of-accounts/:id
 */
export const getAccountById = async (req: Request, res: Response): Promise<void> => {
  try {
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
      res.status(404).json({
        error: 'Not Found',
        message: 'Account not found',
      });
      return;
    }

    res.json({ data: account });
  } catch (error) {
    logError('Get account error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch account',
    });
  }
};

/**
 * Update account
 * PUT /api/chart-of-accounts/:id
 */
export const updateAccount = async (req: Request, res: Response): Promise<void> => {
  try {
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
      res.status(404).json({
        error: 'Not Found',
        message: 'Account not found',
      });
      return;
    }

    // Check if trying to update system account
    if (existingAccount.isSystem) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'System accounts cannot be modified',
      });
      return;
    }

    // Check if new account code already exists
    if (accountCode !== existingAccount.accountCode) {
      const codeExists = await prisma.chart_of_accounts.findUnique({
        where: { accountCode },
      });

      if (codeExists) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Account code already exists',
        });
        return;
      }
    }

    // Validate parent account (cannot be itself or its own child)
    if (parentAccountId && parentAccountId === id) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Account cannot be its own parent',
      });
      return;
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
  } catch (error) {
    logError('Update account error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update account',
    });
  }
};

/**
 * Delete account (soft delete)
 * DELETE /api/chart-of-accounts/:id
 */
export const deleteAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const account = await prisma.chart_of_accounts.findUnique({
      where: { id },
      include: {
        childAccounts: { where: { isActive: true } },
      },
    });

    if (!account) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Account not found',
      });
      return;
    }

    // Check if system account
    if (account.isSystem) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'System accounts cannot be deleted',
      });
      return;
    }

    // Check if has active child accounts
    if (account.childAccounts.length > 0) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Cannot delete account with active child accounts',
      });
      return;
    }

    await prisma.chart_of_accounts.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({
      message: 'Account deleted successfully',
    });
  } catch (error) {
    logError('Delete account error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete account',
    });
  }
};
