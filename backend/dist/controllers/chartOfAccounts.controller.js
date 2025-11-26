"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAccount = exports.updateAccount = exports.getAccountById = exports.getAccountHierarchy = exports.getAllAccounts = exports.createAccount = void 0;
const database_1 = __importDefault(require("../config/database"));
const logger_1 = require("../utils/logger");
/**
 * Create new account
 * POST /api/chart-of-accounts
 */
const createAccount = async (req, res) => {
    try {
        const { accountCode, accountName, accountType, accountGroup, parentAccountId, description, } = req.body;
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'User not authenticated',
            });
            return;
        }
        // Check if account code already exists
        const existingAccount = await database_1.default.chart_of_accounts.findUnique({
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
            const parentAccount = await database_1.default.chart_of_accounts.findUnique({
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
        const account = await database_1.default.chart_of_accounts.create({
            data: {
                accountCode,
                accountName,
                accountType: accountType,
                accountGroup: accountGroup,
                parentAccountId: parentAccountId || null,
                description: description || null,
                isActive: true,
                isSystem: false,
                createdById: userId,
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
    }
    catch (error) {
        (0, logger_1.logError)('Create account error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to create account',
        });
    }
};
exports.createAccount = createAccount;
/**
 * Get all accounts with pagination, search, and filters
 * GET /api/chart-of-accounts
 */
const getAllAccounts = async (req, res) => {
    try {
        const { page = '1', limit = '50', search = '', accountType, accountGroup, parentAccountId, } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;
        // Build where clause
        const where = { isActive: true };
        if (search) {
            where.OR = [
                { accountCode: { contains: search, mode: 'insensitive' } },
                { accountName: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (accountType) {
            where.accountType = accountType;
        }
        if (accountGroup) {
            where.accountGroup = accountGroup;
        }
        if (parentAccountId) {
            where.parentAccountId = parentAccountId === 'null' ? null : parentAccountId;
        }
        const [accounts, total] = await Promise.all([
            database_1.default.chart_of_accounts.findMany({
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
            database_1.default.chart_of_accounts.count({ where }),
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
    }
    catch (error) {
        (0, logger_1.logError)('Get accounts error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch accounts',
        });
    }
};
exports.getAllAccounts = getAllAccounts;
/**
 * Get account hierarchy (tree structure)
 * GET /api/chart-of-accounts/hierarchy
 */
const getAccountHierarchy = async (req, res) => {
    try {
        const { accountType } = req.query;
        const where = { isActive: true, parentAccountId: null };
        if (accountType) {
            where.accountType = accountType;
        }
        // Get root accounts (no parent)
        const rootAccounts = await database_1.default.chart_of_accounts.findMany({
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
    }
    catch (error) {
        (0, logger_1.logError)('Get account hierarchy error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch account hierarchy',
        });
    }
};
exports.getAccountHierarchy = getAccountHierarchy;
/**
 * Get account by ID
 * GET /api/chart-of-accounts/:id
 */
const getAccountById = async (req, res) => {
    try {
        const { id } = req.params;
        const account = await database_1.default.chart_of_accounts.findUnique({
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
    }
    catch (error) {
        (0, logger_1.logError)('Get account error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch account',
        });
    }
};
exports.getAccountById = getAccountById;
/**
 * Update account
 * PUT /api/chart-of-accounts/:id
 */
const updateAccount = async (req, res) => {
    try {
        const { id } = req.params;
        const { accountCode, accountName, accountType, accountGroup, parentAccountId, description, } = req.body;
        // Check if account exists
        const existingAccount = await database_1.default.chart_of_accounts.findUnique({
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
            const codeExists = await database_1.default.chart_of_accounts.findUnique({
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
        const account = await database_1.default.chart_of_accounts.update({
            where: { id },
            data: {
                accountCode,
                accountName,
                accountType: accountType,
                accountGroup: accountGroup,
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
    }
    catch (error) {
        (0, logger_1.logError)('Update account error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to update account',
        });
    }
};
exports.updateAccount = updateAccount;
/**
 * Delete account (soft delete)
 * DELETE /api/chart-of-accounts/:id
 */
const deleteAccount = async (req, res) => {
    try {
        const { id } = req.params;
        const account = await database_1.default.chart_of_accounts.findUnique({
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
        await database_1.default.chart_of_accounts.update({
            where: { id },
            data: { isActive: false },
        });
        res.json({
            message: 'Account deleted successfully',
        });
    }
    catch (error) {
        (0, logger_1.logError)('Delete account error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to delete account',
        });
    }
};
exports.deleteAccount = deleteAccount;
