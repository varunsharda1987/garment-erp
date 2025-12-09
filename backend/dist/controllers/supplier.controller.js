"use strict";
/**
 * Supplier Management Controller
 * Handles HTTP requests and delegates business logic to SupplierService
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSupplier = exports.updateSupplier = exports.getSupplierById = exports.getAllSuppliers = exports.createSupplier = void 0;
const supplier_service_1 = require("../services/supplier.service");
/**
 * Create new supplier
 * POST /api/suppliers
 */
const createSupplier = async (req, res, next) => {
    try {
        const supplier = await supplier_service_1.supplierService.createSupplier(req.body, req.user.userId);
        res.status(201).json({
            data: supplier,
            message: 'Supplier created successfully',
        });
    }
    catch (error) {
        next(error);
    }
};
exports.createSupplier = createSupplier;
/**
 * Get all suppliers with pagination and search
 * GET /api/suppliers
 */
const getAllSuppliers = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search;
        const rating = req.query.rating ? parseInt(req.query.rating) : undefined;
        const category = req.query.category;
        const result = await supplier_service_1.supplierService.findAllWithFilters({
            page,
            limit,
            search,
            rating,
            category,
        });
        res.status(200).json(result);
    }
    catch (error) {
        next(error);
    }
};
exports.getAllSuppliers = getAllSuppliers;
/**
 * Get supplier by ID
 * GET /api/suppliers/:id
 */
const getSupplierById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const supplier = await supplier_service_1.supplierService.findByIdOrThrow(id);
        res.status(200).json({ data: supplier });
    }
    catch (error) {
        next(error);
    }
};
exports.getSupplierById = getSupplierById;
/**
 * Update supplier
 * PUT /api/suppliers/:id
 */
const updateSupplier = async (req, res, next) => {
    try {
        const { id } = req.params;
        const supplier = await supplier_service_1.supplierService.updateSupplier(id, req.body);
        res.status(200).json({
            data: supplier,
            message: 'Supplier updated successfully',
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updateSupplier = updateSupplier;
/**
 * Delete supplier (soft delete)
 * DELETE /api/suppliers/:id
 */
const deleteSupplier = async (req, res, next) => {
    try {
        const { id } = req.params;
        await supplier_service_1.supplierService.softDelete(id);
        res.status(200).json({
            message: 'Supplier deleted successfully',
        });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteSupplier = deleteSupplier;
