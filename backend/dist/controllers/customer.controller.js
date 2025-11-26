"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAccessoryPreset = exports.updateAccessoryPreset = exports.createAccessoryPreset = exports.getCustomerAccessoryPresets = exports.deleteCustomer = exports.updateCustomer = exports.getCustomerById = exports.getAllCustomers = exports.createCustomer = void 0;
const database_1 = __importDefault(require("../config/database"));
const client_1 = require("@prisma/client");
const logger_1 = require("../utils/logger");
/**
 * Create new customer
 * POST /api/customers
 */
const createCustomer = async (req, res) => {
    try {
        const { code, name, brandNames, categories, brandCategories, // New format: array of {brandName, categories: []}
        gstNumbers, // New format: array of {stateName, stateCode, gstNumber, billingAddress?, isPrimary?}
        type, category, businessType, // B2B or B2C
        market, // INTERNATIONAL or DOMESTIC
        contactPerson, email, phone, billingAddress, shippingAddress, gstNumber, // Keep for backward compatibility
        creditLimit, creditDays, } = req.body;
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
                brandNames, // Keep for backward compatibility
                categories, // Keep for backward compatibility
                type: type,
                category: category,
                businessType: businessType || 'B2B',
                market: market || 'DOMESTIC',
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
        // Handle brand categories if provided in new format
        if (brandCategories && Array.isArray(brandCategories)) {
            const brandCategoryData = brandCategories.flatMap((bc) => bc.categories.map((cat) => ({
                customerId: customer.id,
                brandName: bc.brandName,
                category: cat,
            })));
            if (brandCategoryData.length > 0) {
                await database_1.default.brand_categories.createMany({
                    data: brandCategoryData,
                    skipDuplicates: true,
                });
            }
        }
        // Handle GST numbers if provided in new format
        if (gstNumbers && Array.isArray(gstNumbers)) {
            const gstNumberData = gstNumbers.map((gst) => ({
                customerId: customer.id,
                stateName: gst.stateName,
                stateCode: gst.stateCode,
                gstNumber: gst.gstNumber,
                billingAddress: gst.billingAddress || null,
                isPrimary: gst.isPrimary || false,
            }));
            if (gstNumberData.length > 0) {
                await database_1.default.customer_gst_numbers.createMany({
                    data: gstNumberData,
                    skipDuplicates: true,
                });
            }
        }
        // Fetch customer with brand categories and GST numbers
        const customerWithBrands = await database_1.default.customers.findUnique({
            where: { id: customer.id },
            include: {
                users: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
                brand_categories: true,
                customer_gst_numbers: true,
            },
        });
        res.status(201).json({
            data: customerWithBrands,
            message: 'Customer created successfully',
        });
    }
    catch (error) {
        (0, logger_1.logError)('Create customer error', error);
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
                brand_categories: true,
                customer_gst_numbers: true,
                _count: {
                    select: {
                        orders: true,
                        quotations: true,
                        invoices: true,
                    },
                },
            },
            orderBy: {
                name: 'asc', // Sort alphabetically by name
            },
        });
        // Debug logging
        const kasyaCustomer = customers.find(c => c.name.includes('Kasya'));
        if (kasyaCustomer) {
            console.log('🔍 BACKEND: Kasya customer brand_categories count:', kasyaCustomer.brand_categories?.length);
            console.log('🔍 BACKEND: First brand_category:', kasyaCustomer.brand_categories?.[0]);
        }
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
        (0, logger_1.logError)('Get customers error', error);
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
                brand_categories: true,
                customer_gst_numbers: true,
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
        (0, logger_1.logError)('Get customer by ID error', error);
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
        const { code, name, brandNames, categories, brandCategories, // New format: array of {brandName, categories: []}
        gstNumbers, // New format: array of {stateName, stateCode, gstNumber, billingAddress?, isPrimary?}
        type, category, businessType, // B2B or B2C
        market, // INTERNATIONAL or DOMESTIC
        contactPerson, email, phone, billingAddress, shippingAddress, gstNumber, // Keep for backward compatibility
        creditLimit, creditDays, } = req.body;
        // Debug logging
        console.log('🔧 UPDATE CUSTOMER - Received brandCategories:', JSON.stringify(brandCategories, null, 2));
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
                brandNames, // Keep for backward compatibility
                categories, // Keep for backward compatibility
                type: type,
                category: category,
                businessType: businessType,
                market: market,
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
        // Handle brand categories if provided in new format
        if (brandCategories && Array.isArray(brandCategories)) {
            console.log('🔧 Processing brandCategories:', JSON.stringify(brandCategories, null, 2));
            // Delete existing brand categories for this customer
            await database_1.default.brand_categories.deleteMany({
                where: { customerId: id },
            });
            // Create new brand categories
            const brandCategoryData = brandCategories.flatMap((bc) => {
                console.log('🔧 Processing brand:', bc.brandName, 'with categories:', bc.categories);
                return bc.categories.map((cat) => {
                    console.log('🔧 Creating record for:', bc.brandName, '/', cat);
                    return {
                        customerId: id,
                        brandName: bc.brandName,
                        category: cat,
                    };
                });
            });
            console.log('🔧 Total records to create:', brandCategoryData.length);
            console.log('🔧 Records:', JSON.stringify(brandCategoryData, null, 2));
            if (brandCategoryData.length > 0) {
                const result = await database_1.default.brand_categories.createMany({
                    data: brandCategoryData,
                    skipDuplicates: true,
                });
                console.log('🔧 Created', result.count, 'brand category records');
            }
        }
        // Handle GST numbers if provided in new format
        if (gstNumbers && Array.isArray(gstNumbers)) {
            // Delete existing GST numbers for this customer
            await database_1.default.customer_gst_numbers.deleteMany({
                where: { customerId: id },
            });
            // Create new GST numbers
            const gstNumberData = gstNumbers.map((gst) => ({
                customerId: id,
                stateName: gst.stateName,
                stateCode: gst.stateCode,
                gstNumber: gst.gstNumber,
                billingAddress: gst.billingAddress || null,
                isPrimary: gst.isPrimary || false,
            }));
            if (gstNumberData.length > 0) {
                await database_1.default.customer_gst_numbers.createMany({
                    data: gstNumberData,
                    skipDuplicates: true,
                });
            }
        }
        // Fetch customer with brand categories and GST numbers
        const customerWithBrands = await database_1.default.customers.findUnique({
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
                brand_categories: true,
                customer_gst_numbers: true,
            },
        });
        res.status(200).json({
            data: customerWithBrands,
            message: 'Customer updated successfully',
        });
    }
    catch (error) {
        (0, logger_1.logError)('Update customer error', error);
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
        (0, logger_1.logError)('Delete customer error', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to delete customer',
        });
    }
};
exports.deleteCustomer = deleteCustomer;
/**
 * Get all accessory presets for a customer
 * GET /api/customers/:id/accessory-presets
 */
const getCustomerAccessoryPresets = async (req, res) => {
    try {
        const { id } = req.params;
        const presets = await database_1.default.customer_accessories_presets.findMany({
            where: { customerId: id, isActive: true },
            orderBy: [{ isDefault: 'desc' }, { presetName: 'asc' }],
        });
        res.status(200).json({
            data: presets,
            message: 'Accessory presets retrieved successfully',
        });
    }
    catch (error) {
        (0, logger_1.logError)('Get accessory presets error', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to retrieve accessory presets',
        });
    }
};
exports.getCustomerAccessoryPresets = getCustomerAccessoryPresets;
/**
 * Create new accessory preset for a customer
 * POST /api/customers/:id/accessory-presets
 */
const createAccessoryPreset = async (req, res) => {
    try {
        const { id: customerId } = req.params;
        const { presetName, description, accessoryItems, isDefault } = req.body;
        // Validation
        if (!presetName || !accessoryItems) {
            res.status(400).json({
                error: 'Validation Error',
                message: 'presetName and accessoryItems are required',
            });
            return;
        }
        // If this preset is set as default, unset other defaults
        if (isDefault) {
            await database_1.default.customer_accessories_presets.updateMany({
                where: { customerId, isDefault: true },
                data: { isDefault: false },
            });
        }
        const preset = await database_1.default.customer_accessories_presets.create({
            data: {
                customerId,
                presetName,
                description,
                accessoryItems,
                isDefault: isDefault || false,
            },
        });
        res.status(201).json({
            data: preset,
            message: 'Accessory preset created successfully',
        });
    }
    catch (error) {
        (0, logger_1.logError)('Create accessory preset error', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to create accessory preset',
        });
    }
};
exports.createAccessoryPreset = createAccessoryPreset;
/**
 * Update accessory preset
 * PUT /api/customers/:id/accessory-presets/:presetId
 */
const updateAccessoryPreset = async (req, res) => {
    try {
        const { id: customerId, presetId } = req.params;
        const { presetName, description, accessoryItems, isDefault } = req.body;
        // If this preset is set as default, unset other defaults
        if (isDefault) {
            await database_1.default.customer_accessories_presets.updateMany({
                where: { customerId, isDefault: true, id: { not: presetId } },
                data: { isDefault: false },
            });
        }
        const preset = await database_1.default.customer_accessories_presets.update({
            where: { id: presetId },
            data: {
                presetName,
                description,
                accessoryItems,
                isDefault,
            },
        });
        res.status(200).json({
            data: preset,
            message: 'Accessory preset updated successfully',
        });
    }
    catch (error) {
        (0, logger_1.logError)('Update accessory preset error', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to update accessory preset',
        });
    }
};
exports.updateAccessoryPreset = updateAccessoryPreset;
/**
 * Delete accessory preset
 * DELETE /api/customers/:id/accessory-presets/:presetId
 */
const deleteAccessoryPreset = async (req, res) => {
    try {
        const { presetId } = req.params;
        await database_1.default.customer_accessories_presets.update({
            where: { id: presetId },
            data: { isActive: false },
        });
        res.status(200).json({
            message: 'Accessory preset deleted successfully',
        });
    }
    catch (error) {
        (0, logger_1.logError)('Delete accessory preset error', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to delete accessory preset',
        });
    }
};
exports.deleteAccessoryPreset = deleteAccessoryPreset;
