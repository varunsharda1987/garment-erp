"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSupplier = exports.updateSupplier = exports.getSupplierById = exports.getAllSuppliers = exports.createSupplier = void 0;
const database_1 = __importDefault(require("../config/database"));
const crypto_1 = __importDefault(require("crypto"));
/**
 * Create new supplier
 * POST /api/suppliers
 */
const createSupplier = async (req, res) => {
    try {
        const { code, name, supplierCategory, contactPerson, email, phone, address, gstNumber, paymentTerms, creditLimit, creditDays, rating, categoryData, } = req.body;
        // Check if supplier code already exists
        const existingSupplier = await database_1.default.suppliers.findUnique({
            where: { code },
        });
        if (existingSupplier) {
            res.status(400).json({
                error: 'Validation Error',
                message: 'Supplier code already exists',
            });
            return;
        }
        const supplier = await database_1.default.suppliers.create({
            data: {
                id: crypto_1.default.randomUUID(),
                code,
                name,
                supplierCategory,
                contactPerson,
                email,
                phone,
                address,
                gstNumber,
                paymentTerms,
                creditLimit: creditLimit ? parseFloat(creditLimit) : null,
                creditDays: creditDays ? parseInt(creditDays) : null,
                rating: rating ? parseInt(rating) : 0,
                categoryData: categoryData || null,
                createdById: req.user.userId,
                updatedAt: new Date(),
            },
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
        res.status(201).json({
            data: supplier,
            message: 'Supplier created successfully',
        });
    }
    catch (error) {
        console.error('Create supplier error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to create supplier',
        });
    }
};
exports.createSupplier = createSupplier;
/**
 * Get all suppliers with pagination and search
 * GET /api/suppliers
 */
const getAllSuppliers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const search = req.query.search;
        const rating = req.query.rating;
        const category = req.query.category;
        const whereClause = { isActive: true };
        // Search filter
        if (search) {
            whereClause.OR = [
                { code: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } },
                { contactPerson: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        }
        // Category filter
        if (category) {
            whereClause.supplierCategory = category;
        }
        // Rating filter
        if (rating) {
            const ratingValue = parseInt(rating);
            if (!isNaN(ratingValue)) {
                whereClause.rating = ratingValue;
            }
        }
        const totalSuppliers = await database_1.default.suppliers.count({ where: whereClause });
        const suppliers = await database_1.default.suppliers.findMany({
            where: whereClause,
            skip,
            take: limit,
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
                        materials: true,
                        purchase_orders: true,
                        goods_receiving_notes: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
        res.status(200).json({
            data: suppliers,
            pagination: {
                page,
                limit,
                total: totalSuppliers,
                totalPages: Math.ceil(totalSuppliers / limit),
            },
        });
    }
    catch (error) {
        console.error('Get suppliers error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch suppliers',
        });
    }
};
exports.getAllSuppliers = getAllSuppliers;
/**
 * Get supplier by ID
 * GET /api/suppliers/:id
 */
const getSupplierById = async (req, res) => {
    try {
        const { id } = req.params;
        const supplier = await database_1.default.suppliers.findUnique({
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
                        materials: true,
                        purchase_orders: true,
                        goods_receiving_notes: true,
                    },
                },
            },
        });
        if (!supplier) {
            res.status(404).json({
                error: 'Not Found',
                message: 'Supplier not found',
            });
            return;
        }
        res.status(200).json({ data: supplier });
    }
    catch (error) {
        console.error('Get supplier by ID error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch supplier',
        });
    }
};
exports.getSupplierById = getSupplierById;
/**
 * Update supplier
 * PUT /api/suppliers/:id
 */
const updateSupplier = async (req, res) => {
    try {
        const { id } = req.params;
        const { code, name, supplierCategory, contactPerson, email, phone, address, gstNumber, paymentTerms, creditLimit, creditDays, rating, categoryData, } = req.body;
        // Check if supplier code is being changed and if it already exists
        if (code) {
            const existingSupplier = await database_1.default.suppliers.findFirst({
                where: {
                    code,
                    NOT: { id },
                },
            });
            if (existingSupplier) {
                res.status(400).json({
                    error: 'Validation Error',
                    message: 'Supplier code already exists',
                });
                return;
            }
        }
        const supplier = await database_1.default.suppliers.update({
            where: { id },
            data: {
                code,
                name,
                supplierCategory,
                contactPerson,
                email,
                phone,
                address,
                gstNumber,
                paymentTerms,
                creditLimit: creditLimit ? parseFloat(creditLimit) : null,
                creditDays: creditDays ? parseInt(creditDays) : null,
                rating: rating !== undefined ? parseInt(rating) : undefined,
                categoryData: categoryData !== undefined ? categoryData : undefined,
            },
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
        res.status(200).json({
            data: supplier,
            message: 'Supplier updated successfully',
        });
    }
    catch (error) {
        console.error('Update supplier error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to update supplier',
        });
    }
};
exports.updateSupplier = updateSupplier;
/**
 * Delete supplier (soft delete)
 * DELETE /api/suppliers/:id
 */
const deleteSupplier = async (req, res) => {
    try {
        const { id } = req.params;
        await database_1.default.suppliers.update({
            where: { id },
            data: { isActive: false },
        });
        res.status(200).json({
            message: 'Supplier deleted successfully',
        });
    }
    catch (error) {
        console.error('Delete supplier error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to delete supplier',
        });
    }
};
exports.deleteSupplier = deleteSupplier;
