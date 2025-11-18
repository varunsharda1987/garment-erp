"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteTax = exports.updateTax = exports.getTaxById = exports.getApplicableTaxes = exports.getAllTaxes = exports.createTax = void 0;
const database_1 = __importDefault(require("../config/database"));
/**
 * Create new tax
 * POST /api/tax-masters
 */
const createTax = async (req, res) => {
    try {
        const { taxCode, taxName, taxType, taxRate, hsnSacCode, description, applicableFrom, applicableTo, } = req.body;
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'User not authenticated',
            });
            return;
        }
        // Check if tax code already exists
        const existingTax = await database_1.default.tax_masters.findUnique({
            where: { taxCode },
        });
        if (existingTax) {
            res.status(400).json({
                error: 'Validation Error',
                message: 'Tax code already exists',
            });
            return;
        }
        const tax = await database_1.default.tax_masters.create({
            data: {
                taxCode,
                taxName,
                taxType: taxType,
                taxRate: parseFloat(taxRate),
                hsnSacCode: hsnSacCode || null,
                description: description || null,
                applicableFrom: new Date(applicableFrom),
                applicableTo: applicableTo ? new Date(applicableTo) : null,
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
            data: tax,
            message: 'Tax created successfully',
        });
    }
    catch (error) {
        console.error('Create tax error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to create tax',
        });
    }
};
exports.createTax = createTax;
/**
 * Get all taxes with pagination, search, and filters
 * GET /api/tax-masters
 */
const getAllTaxes = async (req, res) => {
    try {
        const { page = '1', limit = '20', search = '', taxType, activeOnly = 'true', } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;
        // Build where clause
        const where = {};
        if (activeOnly === 'true') {
            where.isActive = true;
        }
        if (search) {
            where.OR = [
                { taxCode: { contains: search, mode: 'insensitive' } },
                { taxName: { contains: search, mode: 'insensitive' } },
                { hsnSacCode: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (taxType) {
            where.taxType = taxType;
        }
        const [taxes, total] = await Promise.all([
            database_1.default.tax_masters.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: { taxCode: 'asc' },
                include: {
                    users: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                },
            }),
            database_1.default.tax_masters.count({ where }),
        ]);
        res.json({
            data: taxes,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum),
            },
        });
    }
    catch (error) {
        console.error('Get taxes error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch taxes',
        });
    }
};
exports.getAllTaxes = getAllTaxes;
/**
 * Get applicable taxes for a date
 * GET /api/tax-masters/applicable
 */
const getApplicableTaxes = async (req, res) => {
    try {
        const { date, taxType } = req.query;
        const checkDate = date ? new Date(date) : new Date();
        const where = {
            isActive: true,
            applicableFrom: { lte: checkDate },
            OR: [
                { applicableTo: null },
                { applicableTo: { gte: checkDate } },
            ],
        };
        if (taxType) {
            where.taxType = taxType;
        }
        const taxes = await database_1.default.tax_masters.findMany({
            where,
            orderBy: { taxCode: 'asc' },
        });
        res.json({
            data: taxes,
            message: 'Applicable taxes retrieved successfully',
        });
    }
    catch (error) {
        console.error('Get applicable taxes error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch applicable taxes',
        });
    }
};
exports.getApplicableTaxes = getApplicableTaxes;
/**
 * Get tax by ID
 * GET /api/tax-masters/:id
 */
const getTaxById = async (req, res) => {
    try {
        const { id } = req.params;
        const tax = await database_1.default.tax_masters.findUnique({
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
            },
        });
        if (!tax) {
            res.status(404).json({
                error: 'Not Found',
                message: 'Tax not found',
            });
            return;
        }
        res.json({ data: tax });
    }
    catch (error) {
        console.error('Get tax error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch tax',
        });
    }
};
exports.getTaxById = getTaxById;
/**
 * Update tax
 * PUT /api/tax-masters/:id
 */
const updateTax = async (req, res) => {
    try {
        const { id } = req.params;
        const { taxCode, taxName, taxType, taxRate, hsnSacCode, description, applicableFrom, applicableTo, } = req.body;
        // Check if tax exists
        const existingTax = await database_1.default.tax_masters.findUnique({
            where: { id },
        });
        if (!existingTax) {
            res.status(404).json({
                error: 'Not Found',
                message: 'Tax not found',
            });
            return;
        }
        // Check if new tax code already exists
        if (taxCode !== existingTax.taxCode) {
            const codeExists = await database_1.default.tax_masters.findUnique({
                where: { taxCode },
            });
            if (codeExists) {
                res.status(400).json({
                    error: 'Validation Error',
                    message: 'Tax code already exists',
                });
                return;
            }
        }
        const tax = await database_1.default.tax_masters.update({
            where: { id },
            data: {
                taxCode,
                taxName,
                taxType: taxType,
                taxRate: parseFloat(taxRate),
                hsnSacCode: hsnSacCode || null,
                description: description || null,
                applicableFrom: new Date(applicableFrom),
                applicableTo: applicableTo ? new Date(applicableTo) : null,
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
        res.json({
            data: tax,
            message: 'Tax updated successfully',
        });
    }
    catch (error) {
        console.error('Update tax error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to update tax',
        });
    }
};
exports.updateTax = updateTax;
/**
 * Delete tax (soft delete)
 * DELETE /api/tax-masters/:id
 */
const deleteTax = async (req, res) => {
    try {
        const { id } = req.params;
        const tax = await database_1.default.tax_masters.findUnique({
            where: { id },
        });
        if (!tax) {
            res.status(404).json({
                error: 'Not Found',
                message: 'Tax not found',
            });
            return;
        }
        await database_1.default.tax_masters.update({
            where: { id },
            data: { isActive: false },
        });
        res.json({
            message: 'Tax deleted successfully',
        });
    }
    catch (error) {
        console.error('Delete tax error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to delete tax',
        });
    }
};
exports.deleteTax = deleteTax;
