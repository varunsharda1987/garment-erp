"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteBankAccount = exports.updateBankAccount = exports.getBankAccountById = exports.getAllBankAccounts = exports.createBankAccount = void 0;
const database_1 = __importDefault(require("../config/database"));
const logger_1 = require("../utils/logger");
const createBankAccount = async (req, res) => {
    try {
        const { accountNumber, bankName, branchName, ifscCode, swiftCode, accountType, accountHolderName, openingBalance, currency, isPrimaryAccount } = req.body;
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
            return;
        }
        const existing = await database_1.default.bank_accounts.findUnique({ where: { accountNumber } });
        if (existing) {
            res.status(400).json({ error: 'Validation Error', message: 'Account number already exists' });
            return;
        }
        // If setting as primary, unset existing primary
        if (isPrimaryAccount) {
            await database_1.default.bank_accounts.updateMany({
                where: { isPrimaryAccount: true },
                data: { isPrimaryAccount: false },
            });
        }
        const balance = parseFloat(openingBalance) || 0;
        const bankAccount = await database_1.default.bank_accounts.create({
            data: {
                accountNumber,
                bankName,
                branchName,
                ifscCode: ifscCode || null,
                swiftCode: swiftCode || null,
                accountType: accountType,
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
    }
    catch (error) {
        (0, logger_1.logError)('Create bank account error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create bank account' });
    }
};
exports.createBankAccount = createBankAccount;
const getAllBankAccounts = async (req, res) => {
    try {
        const { page = '1', limit = '20', search = '', accountType, activeOnly = 'true' } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;
        const where = {};
        if (activeOnly === 'true')
            where.isActive = true;
        if (search) {
            where.OR = [
                { accountNumber: { contains: search, mode: 'insensitive' } },
                { bankName: { contains: search, mode: 'insensitive' } },
                { accountHolderName: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (accountType)
            where.accountType = accountType;
        const [bankAccounts, total] = await Promise.all([
            database_1.default.bank_accounts.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: [
                    { isPrimaryAccount: 'desc' },
                    { bankName: 'asc' },
                ],
            }),
            database_1.default.bank_accounts.count({ where }),
        ]);
        res.json({ data: bankAccounts, pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) } });
    }
    catch (error) {
        (0, logger_1.logError)('Get bank accounts error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch bank accounts' });
    }
};
exports.getAllBankAccounts = getAllBankAccounts;
const getBankAccountById = async (req, res) => {
    try {
        const { id } = req.params;
        const bankAccount = await database_1.default.bank_accounts.findUnique({
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
    }
    catch (error) {
        (0, logger_1.logError)('Get bank account error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch bank account' });
    }
};
exports.getBankAccountById = getBankAccountById;
const updateBankAccount = async (req, res) => {
    try {
        const { id } = req.params;
        const { accountNumber, bankName, branchName, ifscCode, swiftCode, accountType, accountHolderName, currentBalance, currency, isPrimaryAccount } = req.body;
        const existing = await database_1.default.bank_accounts.findUnique({ where: { id } });
        if (!existing) {
            res.status(404).json({ error: 'Not Found', message: 'Bank account not found' });
            return;
        }
        if (accountNumber !== existing.accountNumber) {
            const numberExists = await database_1.default.bank_accounts.findUnique({ where: { accountNumber } });
            if (numberExists) {
                res.status(400).json({ error: 'Validation Error', message: 'Account number already exists' });
                return;
            }
        }
        // If setting as primary, unset existing primary
        if (isPrimaryAccount && !existing.isPrimaryAccount) {
            await database_1.default.bank_accounts.updateMany({
                where: { isPrimaryAccount: true },
                data: { isPrimaryAccount: false },
            });
        }
        const bankAccount = await database_1.default.bank_accounts.update({
            where: { id },
            data: {
                accountNumber,
                bankName,
                branchName,
                ifscCode: ifscCode || null,
                swiftCode: swiftCode || null,
                accountType: accountType,
                accountHolderName,
                currentBalance: currentBalance ? parseFloat(currentBalance) : existing.currentBalance,
                currency: currency || 'INR',
                isPrimaryAccount,
            },
        });
        res.json({ data: bankAccount, message: 'Bank account updated successfully' });
    }
    catch (error) {
        (0, logger_1.logError)('Update bank account error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update bank account' });
    }
};
exports.updateBankAccount = updateBankAccount;
const deleteBankAccount = async (req, res) => {
    try {
        const { id } = req.params;
        const bankAccount = await database_1.default.bank_accounts.findUnique({ where: { id } });
        if (!bankAccount) {
            res.status(404).json({ error: 'Not Found', message: 'Bank account not found' });
            return;
        }
        if (bankAccount.isPrimaryAccount) {
            res.status(400).json({ error: 'Validation Error', message: 'Cannot delete primary bank account' });
            return;
        }
        await database_1.default.bank_accounts.update({ where: { id }, data: { isActive: false } });
        res.json({ message: 'Bank account deleted successfully' });
    }
    catch (error) {
        (0, logger_1.logError)('Delete bank account error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete bank account' });
    }
};
exports.deleteBankAccount = deleteBankAccount;
