"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteExpenseType = exports.updateExpenseType = exports.getExpenseTypeById = exports.getAllExpenseTypes = exports.createExpenseType = void 0;
const database_1 = __importDefault(require("../config/database"));
const logger_1 = require("../utils/logger");
const createExpenseType = async (req, res) => {
    try {
        const { expenseCode, expenseName, expenseCategory, accountId, isRecurring, description } = req.body;
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
            return;
        }
        const existing = await database_1.default.expense_types.findUnique({ where: { expenseCode } });
        if (existing) {
            res.status(400).json({ error: 'Validation Error', message: 'Expense code already exists' });
            return;
        }
        const expenseType = await database_1.default.expense_types.create({
            data: {
                expenseCode,
                expenseName,
                expenseCategory: expenseCategory,
                accountId: accountId || null,
                isRecurring: isRecurring || false,
                description: description || null,
                isActive: true,
                createdById: userId,
            },
            include: {
                chart_of_accounts: { select: { id: true, accountCode: true, accountName: true } },
                users: { select: { id: true, firstName: true, lastName: true } },
            },
        });
        res.status(201).json({ data: expenseType, message: 'Expense type created successfully' });
    }
    catch (error) {
        (0, logger_1.logError)('Create expense type error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create expense type' });
    }
};
exports.createExpenseType = createExpenseType;
const getAllExpenseTypes = async (req, res) => {
    try {
        const { page = '1', limit = '20', search = '', expenseCategory, accountId } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;
        const where = { isActive: true };
        if (search) {
            where.OR = [
                { expenseCode: { contains: search, mode: 'insensitive' } },
                { expenseName: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (expenseCategory)
            where.expenseCategory = expenseCategory;
        if (accountId)
            where.accountId = accountId;
        const [expenseTypes, total] = await Promise.all([
            database_1.default.expense_types.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: { expenseCode: 'asc' },
                include: {
                    chart_of_accounts: { select: { accountCode: true, accountName: true } },
                },
            }),
            database_1.default.expense_types.count({ where }),
        ]);
        res.json({ data: expenseTypes, pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) } });
    }
    catch (error) {
        (0, logger_1.logError)('Get expense types error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch expense types' });
    }
};
exports.getAllExpenseTypes = getAllExpenseTypes;
const getExpenseTypeById = async (req, res) => {
    try {
        const { id } = req.params;
        const expenseType = await database_1.default.expense_types.findUnique({
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
    }
    catch (error) {
        (0, logger_1.logError)('Get expense type error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch expense type' });
    }
};
exports.getExpenseTypeById = getExpenseTypeById;
const updateExpenseType = async (req, res) => {
    try {
        const { id } = req.params;
        const { expenseCode, expenseName, expenseCategory, accountId, isRecurring, description } = req.body;
        const existing = await database_1.default.expense_types.findUnique({ where: { id } });
        if (!existing) {
            res.status(404).json({ error: 'Not Found', message: 'Expense type not found' });
            return;
        }
        if (expenseCode !== existing.expenseCode) {
            const codeExists = await database_1.default.expense_types.findUnique({ where: { expenseCode } });
            if (codeExists) {
                res.status(400).json({ error: 'Validation Error', message: 'Expense code already exists' });
                return;
            }
        }
        const expenseType = await database_1.default.expense_types.update({
            where: { id },
            data: {
                expenseCode,
                expenseName,
                expenseCategory: expenseCategory,
                accountId: accountId || null,
                isRecurring,
                description: description || null,
            },
        });
        res.json({ data: expenseType, message: 'Expense type updated successfully' });
    }
    catch (error) {
        (0, logger_1.logError)('Update expense type error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update expense type' });
    }
};
exports.updateExpenseType = updateExpenseType;
const deleteExpenseType = async (req, res) => {
    try {
        const { id } = req.params;
        const expenseType = await database_1.default.expense_types.findUnique({ where: { id } });
        if (!expenseType) {
            res.status(404).json({ error: 'Not Found', message: 'Expense type not found' });
            return;
        }
        await database_1.default.expense_types.update({ where: { id }, data: { isActive: false } });
        res.json({ message: 'Expense type deleted successfully' });
    }
    catch (error) {
        (0, logger_1.logError)('Delete expense type error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete expense type' });
    }
};
exports.deleteExpenseType = deleteExpenseType;
