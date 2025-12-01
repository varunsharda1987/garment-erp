// Bank Accounts Controller
import { Request, Response } from 'express';
import prisma from '../config/database';
import { BankAccountType, Prisma } from '@prisma/client';
import { logInfo, logError, logWarn, logDebug } from '../utils/logger';

export const createBankAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const { accountNumber, bankName, branchName, ifscCode, swiftCode, accountType, accountHolderName, openingBalance, currency, isPrimaryAccount } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
      return;
    }

    const existing = await prisma.bank_accounts.findUnique({ where: { accountNumber } });
    if (existing) {
      res.status(400).json({ error: 'Validation Error', message: 'Account number already exists' });
      return;
    }

    // If setting as primary, unset existing primary
    if (isPrimaryAccount) {
      await prisma.bank_accounts.updateMany({
        where: { isPrimaryAccount: true },
        data: { isPrimaryAccount: false },
      });
    }

    const balance = parseFloat(openingBalance) || 0;

    const bankAccount = await prisma.bank_accounts.create({
      data: {
        accountNumber,
        bankName,
        branchName,
        ifscCode: ifscCode || null,
        swiftCode: swiftCode || null,
        accountType: accountType as BankAccountType,
        accountHolderName,
        openingBalance: balance,
        currentBalance: balance,
        currency: currency || 'INR',
        isActive: true,
        isPrimaryAccount: isPrimaryAccount || false,
        createdById: userId,
      },
      include: {
        users: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.status(201).json({ data: bankAccount, message: 'Bank account created successfully' });
  } catch (error) {
    logError('Create bank account error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create bank account' });
  }
};

export const getAllBankAccounts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20', search = '', accountType, activeOnly = 'true' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.bank_accountsWhereInput = {};

    if (activeOnly === 'true') where.isActive = true;

    if (search) {
      where.OR = [
        { accountNumber: { contains: search as string, mode: 'insensitive' } },
        { bankName: { contains: search as string, mode: 'insensitive' } },
        { accountHolderName: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    if (accountType) where.accountType = accountType as BankAccountType;

    const [bankAccounts, total] = await Promise.all([
      prisma.bank_accounts.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: [
          { isPrimaryAccount: 'desc' },
          { bankName: 'asc' },
        ],
      }),
      prisma.bank_accounts.count({ where }),
    ]);

    res.json({ data: bankAccounts, pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) } });
  } catch (error) {
    logError('Get bank accounts error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch bank accounts' });
  }
};

export const getBankAccountById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const bankAccount = await prisma.bank_accounts.findUnique({
      where: { id },
      include: {
        users: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (!bankAccount) {
      res.status(404).json({ error: 'Not Found', message: 'Bank account not found' });
      return;
    }

    res.json({ data: bankAccount });
  } catch (error) {
    logError('Get bank account error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch bank account' });
  }
};

export const updateBankAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { accountNumber, bankName, branchName, ifscCode, swiftCode, accountType, accountHolderName, currentBalance, currency, isPrimaryAccount } = req.body;

    const existing = await prisma.bank_accounts.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Not Found', message: 'Bank account not found' });
      return;
    }

    if (accountNumber !== existing.accountNumber) {
      const numberExists = await prisma.bank_accounts.findUnique({ where: { accountNumber } });
      if (numberExists) {
        res.status(400).json({ error: 'Validation Error', message: 'Account number already exists' });
        return;
      }
    }

    // If setting as primary, unset existing primary
    if (isPrimaryAccount && !existing.isPrimaryAccount) {
      await prisma.bank_accounts.updateMany({
        where: { isPrimaryAccount: true },
        data: { isPrimaryAccount: false },
      });
    }

    const bankAccount = await prisma.bank_accounts.update({
      where: { id },
      data: {
        accountNumber,
        bankName,
        branchName,
        ifscCode: ifscCode || null,
        swiftCode: swiftCode || null,
        accountType: accountType as BankAccountType,
        accountHolderName,
        currentBalance: currentBalance ? parseFloat(currentBalance) : existing.currentBalance,
        currency: currency || 'INR',
        isPrimaryAccount,
      },
    });

    res.json({ data: bankAccount, message: 'Bank account updated successfully' });
  } catch (error) {
    logError('Update bank account error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update bank account' });
  }
};

export const deleteBankAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const bankAccount = await prisma.bank_accounts.findUnique({ where: { id } });

    if (!bankAccount) {
      res.status(404).json({ error: 'Not Found', message: 'Bank account not found' });
      return;
    }

    if (bankAccount.isPrimaryAccount) {
      res.status(400).json({ error: 'Validation Error', message: 'Cannot delete primary bank account' });
      return;
    }

    await prisma.bank_accounts.update({ where: { id }, data: { isActive: false } });
    res.json({ message: 'Bank account deleted successfully' });
  } catch (error) {
    logError('Delete bank account error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete bank account' });
  }
};
