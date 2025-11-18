"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCustomer = exports.updateCustomer = exports.getCustomerById = exports.getAllCustomers = exports.createCustomer = void 0;
const database_1 = __importDefault(require("../config/database"));
const client_1 = require("@prisma/client");
/**
 * Create new customer
 * POST /api/customers
 */
const createCustomer = async (req, res) => {
    try {
        const { code, name, brandNames, categories, type, category, contactPerson, email, phone, billingAddress, shippingAddress, gstNumber, creditLimit, creditDays, } = req.body;
        // Check if customer code already exists
        const existingCustomer = await database_1.default.customers.findUnique({
            where: { code },
        });
        if (existingCustomer) {
            res.status(400).json({
                error: 'Validation Error',
                message: 'Customer code already exists',
            });
            return;
        }
        const customer = await database_1.default.customers.create({
            data: {
                code,
                name,
                brandNames,
                categories,
                type: type,
                category: category,
                contactPerson,
                email,
                phone,
                billingAddress,
                shippingAddress,
                gstNumber,
                creditLimit: creditLimit ? parseFloat(creditLimit) : null,
                creditDays: creditDays ? parseInt(creditDays) : null,
                createdById: req.user.userId,
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
            data: customer,
            message: 'Customer created successfully',
        });
    }
    catch (error) {
        console.error('Create customer error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to create customer',
        });
    }
};
exports.createCustomer = createCustomer;
/**
 * Get all customers with pagination and search
 * GET /api/customers
 */
const getAllCustomers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const search = req.query.search;
        const type = req.query.type;
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
        // Type filter
        if (type && Object.values(client_1.CustomerType).includes(type)) {
            whereClause.type = type;
        }
        // Category filter
        if (category && Object.values(client_1.CustomerCategory).includes(category)) {
            whereClause.category = category;
        }
        const totalCustomers = await database_1.default.customers.count({ where: whereClause });
        const customers = await database_1.default.customers.findMany({
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
                        orders: true,
                        quotations: true,
                        invoices: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
        res.status(200).json({
            data: customers,
            pagination: {
                page,
                limit,
                total: totalCustomers,
                totalPages: Math.ceil(totalCustomers / limit),
            },
        });
    }
    catch (error) {
        console.error('Get customers error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch customers',
        });
    }
};
exports.getAllCustomers = getAllCustomers;
/**
 * Get customer by ID
 * GET /api/customers/:id
 */
const getCustomerById = async (req, res) => {
    try {
        const { id } = req.params;
        const customer = await database_1.default.customers.findUnique({
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
                        orders: true,
                        quotations: true,
                        invoices: true,
                    },
                },
            },
        });
        if (!customer) {
            res.status(404).json({
                error: 'Not Found',
                message: 'Customer not found',
            });
            return;
        }
        res.status(200).json({ data: customer });
    }
    catch (error) {
        console.error('Get customer by ID error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch customer',
        });
    }
};
exports.getCustomerById = getCustomerById;
/**
 * Update customer
 * PUT /api/customers/:id
 */
const updateCustomer = async (req, res) => {
    try {
        const { id } = req.params;
        const { code, name, brandNames, categories, type, category, contactPerson, email, phone, billingAddress, shippingAddress, gstNumber, creditLimit, creditDays, } = req.body;
        // Check if customer code is being changed and if it already exists
        if (code) {
            const existingCustomer = await database_1.default.customers.findFirst({
                where: {
                    code,
                    NOT: { id },
                },
            });
            if (existingCustomer) {
                res.status(400).json({
                    error: 'Validation Error',
                    message: 'Customer code already exists',
                });
                return;
            }
        }
        const customer = await database_1.default.customers.update({
            where: { id },
            data: {
                code,
                name,
                brandNames,
                categories,
                type: type,
                category: category,
                contactPerson,
                email,
                phone,
                billingAddress,
                shippingAddress,
                gstNumber,
                creditLimit: creditLimit ? parseFloat(creditLimit) : null,
                creditDays: creditDays ? parseInt(creditDays) : null,
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
            data: customer,
            message: 'Customer updated successfully',
        });
    }
    catch (error) {
        console.error('Update customer error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to update customer',
        });
    }
};
exports.updateCustomer = updateCustomer;
/**
 * Delete customer (soft delete)
 * DELETE /api/customers/:id
 */
const deleteCustomer = async (req, res) => {
    try {
        const { id } = req.params;
        await database_1.default.customers.update({
            where: { id },
            data: { isActive: false },
        });
        res.status(200).json({
            message: 'Customer deleted successfully',
        });
    }
    catch (error) {
        console.error('Delete customer error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to delete customer',
        });
    }
};
exports.deleteCustomer = deleteCustomer;
