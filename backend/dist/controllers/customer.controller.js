"use strict";
/**
 * Customer Management Controller
 * Handles HTTP requests and delegates business logic to CustomerService
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAccessoryPreset = exports.updateAccessoryPreset = exports.createAccessoryPreset = exports.getCustomerAccessoryPresets = exports.deleteCustomer = exports.updateCustomer = exports.getCustomerById = exports.getAllCustomers = exports.createCustomer = void 0;
const customer_service_1 = require("../services/customer.service");
/**
 * Create new customer
 * POST /api/customers
 */
const createCustomer = async (req, res, next) => {
    try {
        const customer = await customer_service_1.customerService.createWithRelations(req.body, req.user.userId);
        res.status(201).json({
            data: customer,
            message: 'Customer created successfully',
        });
    }
    catch (error) {
        next(error);
    }
};
exports.createCustomer = createCustomer;
/**
 * Get all customers with pagination and search
 * GET /api/customers
 */
const getAllCustomers = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search;
        const type = req.query.type;
        const category = req.query.category;
        const result = await customer_service_1.customerService.findAllWithFilters({
            page,
            limit,
            search,
            type,
            category,
        });
        res.status(200).json(result);
    }
    catch (error) {
        next(error);
    }
};
exports.getAllCustomers = getAllCustomers;
/**
 * Get customer by ID
 * GET /api/customers/:id
 */
const getCustomerById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const customer = await customer_service_1.customerService.findByIdOrThrow(id);
        res.status(200).json({ data: customer });
    }
    catch (error) {
        next(error);
    }
};
exports.getCustomerById = getCustomerById;
/**
 * Update customer
 * PUT /api/customers/:id
 */
const updateCustomer = async (req, res, next) => {
    try {
        const { id } = req.params;
        const customer = await customer_service_1.customerService.updateWithRelations(id, req.body);
        res.status(200).json({
            data: customer,
            message: 'Customer updated successfully',
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updateCustomer = updateCustomer;
/**
 * Delete customer (soft delete)
 * DELETE /api/customers/:id
 */
const deleteCustomer = async (req, res, next) => {
    try {
        const { id } = req.params;
        await customer_service_1.customerService.softDelete(id);
        res.status(200).json({
            message: 'Customer deleted successfully',
        });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteCustomer = deleteCustomer;
/**
 * Get all accessory presets for a customer
 * GET /api/customers/:id/accessory-presets
 */
const getCustomerAccessoryPresets = async (req, res, next) => {
    try {
        const { id } = req.params;
        const presets = await customer_service_1.customerService.getAccessoryPresets(id);
        res.status(200).json({
            data: presets,
            message: 'Accessory presets retrieved successfully',
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getCustomerAccessoryPresets = getCustomerAccessoryPresets;
/**
 * Create new accessory preset for a customer
 * POST /api/customers/:id/accessory-presets
 */
const createAccessoryPreset = async (req, res, next) => {
    try {
        const { id: customerId } = req.params;
        const preset = await customer_service_1.customerService.createAccessoryPreset(customerId, req.body);
        res.status(201).json({
            data: preset,
            message: 'Accessory preset created successfully',
        });
    }
    catch (error) {
        next(error);
    }
};
exports.createAccessoryPreset = createAccessoryPreset;
/**
 * Update accessory preset
 * PUT /api/customers/:id/accessory-presets/:presetId
 */
const updateAccessoryPreset = async (req, res, next) => {
    try {
        const { id: customerId, presetId } = req.params;
        const preset = await customer_service_1.customerService.updateAccessoryPreset(customerId, presetId, req.body);
        res.status(200).json({
            data: preset,
            message: 'Accessory preset updated successfully',
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updateAccessoryPreset = updateAccessoryPreset;
/**
 * Delete accessory preset
 * DELETE /api/customers/:id/accessory-presets/:presetId
 */
const deleteAccessoryPreset = async (req, res, next) => {
    try {
        const { presetId } = req.params;
        await customer_service_1.customerService.deleteAccessoryPreset(presetId);
        res.status(200).json({
            message: 'Accessory preset deleted successfully',
        });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteAccessoryPreset = deleteAccessoryPreset;
