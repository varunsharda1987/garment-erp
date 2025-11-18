"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deletePaymentTerm = exports.updatePaymentTerm = exports.getPaymentTermById = exports.getAllPaymentTerms = exports.createPaymentTerm = void 0;
const database_1 = __importDefault(require("../config/database"));
/**
 * Create new payment term
 * POST /api/payment-terms
 */
const createPaymentTerm = async (req, res) => {
    try {
        const { termCode, termName, description, daysCount, paymentSchedule, discountPercent, } = req.body;
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'User not authenticated',
            });
            return;
        }
        // Check if term code already exists
        const existingTerm = await database_1.default.payment_terms.findUnique({
            where: { termCode },
        });
        if (existingTerm) {
            res.status(400).json({
                error: 'Validation Error',
                message: 'Payment term code already exists',
            });
            return;
        }
        const paymentTerm = await database_1.default.payment_terms.create({
            data: {
                termCode,
                termName,
                description: description || null,
                daysCount: daysCount ? parseInt(daysCount) : null,
                paymentSchedule: paymentSchedule || null,
                discountPercent: discountPercent ? parseFloat(discountPercent) : null,
                isActive: true,
                createdById: userId,
            },
            include: {
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
            data: paymentTerm,
            message: 'Payment term created successfully',
        });
    }
    catch (error) {
        console.error('Create payment term error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to create payment term',
        });
    }
};
exports.createPaymentTerm = createPaymentTerm;
/**
 * Get all payment terms
 * GET /api/payment-terms
 */
const getAllPaymentTerms = async (req, res) => {
    try {
        const { page = '1', limit = '20', search = '', activeOnly = 'true' } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;
        const where = {};
        if (activeOnly === 'true') {
            where.isActive = true;
        }
        if (search) {
            where.OR = [
                { termCode: { contains: search, mode: 'insensitive' } },
                { termName: { contains: search, mode: 'insensitive' } },
            ];
        }
        const [terms, total] = await Promise.all([
            database_1.default.payment_terms.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: { termCode: 'asc' },
                include: {
                    _count: {
                        select: {
                            customers: true,
                            suppliers: true,
                        },
                    },
                },
            }),
            database_1.default.payment_terms.count({ where }),
        ]);
        res.json({
            data: terms,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum),
            },
        });
    }
    catch (error) {
        console.error('Get payment terms error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch payment terms',
        });
    }
};
exports.getAllPaymentTerms = getAllPaymentTerms;
/**
 * Get payment term by ID
 * GET /api/payment-terms/:id
 */
const getPaymentTermById = async (req, res) => {
    try {
        const { id } = req.params;
        const paymentTerm = await database_1.default.payment_terms.findUnique({
            where: { id },
            include: {
                users: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
                _count: {
                    select: {
                        customers: true,
                        suppliers: true,
                    },
                },
            },
        });
        if (!paymentTerm) {
            res.status(404).json({
                error: 'Not Found',
                message: 'Payment term not found',
            });
            return;
        }
        res.json({ data: paymentTerm });
    }
    catch (error) {
        console.error('Get payment term error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch payment term',
        });
    }
};
exports.getPaymentTermById = getPaymentTermById;
/**
 * Update payment term
 * PUT /api/payment-terms/:id
 */
const updatePaymentTerm = async (req, res) => {
    try {
        const { id } = req.params;
        const { termCode, termName, description, daysCount, paymentSchedule, discountPercent, } = req.body;
        const existingTerm = await database_1.default.payment_terms.findUnique({
            where: { id },
        });
        if (!existingTerm) {
            res.status(404).json({
                error: 'Not Found',
                message: 'Payment term not found',
            });
            return;
        }
        if (termCode !== existingTerm.termCode) {
            const codeExists = await database_1.default.payment_terms.findUnique({
                where: { termCode },
            });
            if (codeExists) {
                res.status(400).json({
                    error: 'Validation Error',
                    message: 'Payment term code already exists',
                });
                return;
            }
        }
        const paymentTerm = await database_1.default.payment_terms.update({
            where: { id },
            data: {
                termCode,
                termName,
                description: description || null,
                daysCount: daysCount ? parseInt(daysCount) : null,
                paymentSchedule: paymentSchedule || null,
                discountPercent: discountPercent ? parseFloat(discountPercent) : null,
            },
        });
        res.json({
            data: paymentTerm,
            message: 'Payment term updated successfully',
        });
    }
    catch (error) {
        console.error('Update payment term error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to update payment term',
        });
    }
};
exports.updatePaymentTerm = updatePaymentTerm;
/**
 * Delete payment term (soft delete)
 * DELETE /api/payment-terms/:id
 */
const deletePaymentTerm = async (req, res) => {
    try {
        const { id } = req.params;
        const paymentTerm = await database_1.default.payment_terms.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        customers: true,
                        suppliers: true,
                    },
                },
            },
        });
        if (!paymentTerm) {
            res.status(404).json({
                error: 'Not Found',
                message: 'Payment term not found',
            });
            return;
        }
        // Check if in use
        const inUse = paymentTerm._count.customers > 0 || paymentTerm._count.suppliers > 0;
        if (inUse) {
            res.status(400).json({
                error: 'Validation Error',
                message: `Cannot delete payment term. It is used by ${paymentTerm._count.customers} customers and ${paymentTerm._count.suppliers} suppliers.`,
            });
            return;
        }
        await database_1.default.payment_terms.update({
            where: { id },
            data: { isActive: false },
        });
        res.json({
            message: 'Payment term deleted successfully',
        });
    }
    catch (error) {
        console.error('Delete payment term error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to delete payment term',
        });
    }
};
exports.deletePaymentTerm = deletePaymentTerm;
