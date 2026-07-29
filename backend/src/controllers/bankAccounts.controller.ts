// Bank Accounts Controller
import { Request, Response } from 'express';
import prisma from '../config/database';
import { BankAccountType, Prisma } from '@prisma/client';
import { NotFoundError, ValidationError, ConflictError } from '../errors';

export const createBankAccount = async (req: Request, res: Response): Promise<void> => {
  const {
    accountNumber,
    bankName,
    branchName,
    ifscCode,
    swiftCode,
    accountType,
    accountHolderName,
    openingBalance,
    currency,
    isPrimaryAccount,
  } = req.body;

  const existing = await prisma.bank_accounts.findFirst({ where: { accountNumber, isActive: true } });
  if (existing) {
    throw new ConflictError('Account number already exists');
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
      createdById: req.user!.userId,
    },
    include: {
      users: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  res.status(201).json({ data: bankAccount, message: 'Bank account created successfully' });
};

export const getAllBankAccounts = async (req: Request, res: Response): Promise<void> => {
  const query = (req as any).validatedQuery ?? req.query;
  const { page = '1', limit = '20', search = '', accountType, isActive } = query;
  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  const skip = (pageNum - 1) * limitNum;

  const where: Prisma.bank_accountsWhereInput = {};

  // Honor the validated isActive contract: undefined defaults to active-only (prior behavior),
  // but ?isActive=false now genuinely returns soft-deleted accounts.
  where.isActive = isActive === undefined ? true : (isActive as unknown) === true || isActive === 'true';

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
      orderBy: [{ isPrimaryAccount: 'desc' }, { bankName: 'asc' }],
    }),
    prisma.bank_accounts.count({ where }),
  ]);

  res.json({
    data: bankAccounts,
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  });
};

export const getBankAccountById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const bankAccount = await prisma.bank_accounts.findUnique({
    where: { id },
    include: {
      users: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  if (!bankAccount) {
    throw new NotFoundError('BankAccount', id);
  }

  res.json({ data: bankAccount });
};

export const updateBankAccount = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const {
    accountNumber,
    bankName,
    branchName,
    ifscCode,
    swiftCode,
    accountType,
    accountHolderName,
    currentBalance,
    currency,
    isPrimaryAccount,
  } = req.body;

  const existing = await prisma.bank_accounts.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('BankAccount', id);
  }

  if (accountNumber !== existing.accountNumber) {
    const numberExists = await prisma.bank_accounts.findFirst({ where: { accountNumber, isActive: true } });
    if (numberExists) {
      throw new ConflictError('Account number already exists');
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
};

export const deleteBankAccount = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const bankAccount = await prisma.bank_accounts.findUnique({ where: { id } });

  if (!bankAccount) {
    throw new NotFoundError('BankAccount', id);
  }

  if (bankAccount.isPrimaryAccount) {
    throw new ValidationError('Cannot delete primary bank account');
  }

  await prisma.bank_accounts.update({ where: { id }, data: { isActive: false } });
  res.json({ message: 'Bank account deleted successfully' });
};
