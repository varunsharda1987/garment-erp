"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateWarehouseCode = exports.getWarehousesByType = exports.getWarehouseStockSummary = exports.deleteWarehouse = exports.updateWarehouse = exports.createWarehouse = exports.getWarehouseByCode = exports.getWarehouseById = exports.getAllWarehouses = void 0;
const warehouse_service_1 = __importDefault(require("../services/warehouse.service"));
/**
 * @route GET /api/warehouses
 * @desc Get all warehouses with optional filters
 * @access Private
 */
const getAllWarehouses = async (req, res) => {
    try {
        const { warehouseType, isActive, search } = req.query;
        const filters = {
            warehouseType: warehouseType,
            isActive: isActive !== undefined ? isActive === 'true' : undefined,
            search: search,
        };
        const warehouses = await warehouse_service_1.default.getAllWarehouses(filters);
        res.json({
            success: true,
            data: warehouses,
            count: warehouses.length,
        });
    }
    catch (error) {
        console.error('Get all warehouses error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch warehouses',
        });
    }
};
exports.getAllWarehouses = getAllWarehouses;
/**
 * @route GET /api/warehouses/:id
 * @desc Get warehouse by ID
 * @access Private
 */
const getWarehouseById = async (req, res) => {
    try {
        const { id } = req.params;
        const warehouse = await warehouse_service_1.default.getWarehouseById(id);
        res.json({
            success: true,
            data: warehouse,
        });
    }
    catch (error) {
        console.error('Get warehouse by ID error:', error);
        const statusCode = error.message.includes('not found') ? 404 : 500;
        res.status(statusCode).json({
            success: false,
            message: error.message || 'Failed to fetch warehouse',
        });
    }
};
exports.getWarehouseById = getWarehouseById;
/**
 * @route GET /api/warehouses/code/:warehouseCode
 * @desc Get warehouse by code
 * @access Private
 */
const getWarehouseByCode = async (req, res) => {
    try {
        const { warehouseCode } = req.params;
        const warehouse = await warehouse_service_1.default.getWarehouseByCode(warehouseCode);
        res.json({
            success: true,
            data: warehouse,
        });
    }
    catch (error) {
        console.error('Get warehouse by code error:', error);
        const statusCode = error.message.includes('not found') ? 404 : 500;
        res.status(statusCode).json({
            success: false,
            message: error.message || 'Failed to fetch warehouse',
        });
    }
};
exports.getWarehouseByCode = getWarehouseByCode;
/**
 * @route POST /api/warehouses
 * @desc Create new warehouse
 * @access Private (Admin/Inventory Manager)
 */
const createWarehouse = async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated',
            });
        }
        const warehouseData = {
            ...req.body,
            createdById: userId,
        };
        // Validation
        if (!warehouseData.warehouseCode) {
            return res.status(400).json({
                success: false,
                message: 'Warehouse code is required',
            });
        }
        if (!warehouseData.warehouseName) {
            return res.status(400).json({
                success: false,
                message: 'Warehouse name is required',
            });
        }
        if (!warehouseData.warehouseType) {
            return res.status(400).json({
                success: false,
                message: 'Warehouse type is required',
            });
        }
        const warehouse = await warehouse_service_1.default.createWarehouse(warehouseData);
        res.status(201).json({
            success: true,
            message: 'Warehouse created successfully',
            data: warehouse,
        });
    }
    catch (error) {
        console.error('Create warehouse error:', error);
        const statusCode = error.message.includes('already exists') ? 409 : 500;
        res.status(statusCode).json({
            success: false,
            message: error.message || 'Failed to create warehouse',
        });
    }
};
exports.createWarehouse = createWarehouse;
/**
 * @route PUT /api/warehouses/:id
 * @desc Update warehouse
 * @access Private (Admin/Inventory Manager)
 */
const updateWarehouse = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        const warehouse = await warehouse_service_1.default.updateWarehouse(id, updateData);
        res.json({
            success: true,
            message: 'Warehouse updated successfully',
            data: warehouse,
        });
    }
    catch (error) {
        console.error('Update warehouse error:', error);
        const statusCode = error.message.includes('not found') ? 404 : 500;
        res.status(statusCode).json({
            success: false,
            message: error.message || 'Failed to update warehouse',
        });
    }
};
exports.updateWarehouse = updateWarehouse;
/**
 * @route DELETE /api/warehouses/:id
 * @desc Delete warehouse (soft delete)
 * @access Private (Admin only)
 */
const deleteWarehouse = async (req, res) => {
    try {
        const { id } = req.params;
        const warehouse = await warehouse_service_1.default.deleteWarehouse(id);
        res.json({
            success: true,
            message: 'Warehouse deleted successfully',
            data: warehouse,
        });
    }
    catch (error) {
        console.error('Delete warehouse error:', error);
        const statusCode = error.message.includes('not found') ? 404 : 400;
        res.status(statusCode).json({
            success: false,
            message: error.message || 'Failed to delete warehouse',
        });
    }
};
exports.deleteWarehouse = deleteWarehouse;
/**
 * @route GET /api/warehouses/:id/stock-summary
 * @desc Get warehouse stock summary
 * @access Private
 */
const getWarehouseStockSummary = async (req, res) => {
    try {
        const { id } = req.params;
        const summary = await warehouse_service_1.default.getWarehouseStockSummary(id);
        res.json({
            success: true,
            data: summary,
        });
    }
    catch (error) {
        console.error('Get warehouse stock summary error:', error);
        const statusCode = error.message.includes('not found') ? 404 : 500;
        res.status(statusCode).json({
            success: false,
            message: error.message || 'Failed to fetch stock summary',
        });
    }
};
exports.getWarehouseStockSummary = getWarehouseStockSummary;
/**
 * @route GET /api/warehouses/by-type/:warehouseType
 * @desc Get active warehouses by type
 * @access Private
 */
const getWarehousesByType = async (req, res) => {
    try {
        const { warehouseType } = req.params;
        const warehouses = await warehouse_service_1.default.getWarehousesByType(warehouseType);
        res.json({
            success: true,
            data: warehouses,
            count: warehouses.length,
        });
    }
    catch (error) {
        console.error('Get warehouses by type error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch warehouses',
        });
    }
};
exports.getWarehousesByType = getWarehousesByType;
/**
 * @route GET /api/warehouses/generate-code/:warehouseType
 * @desc Generate next warehouse code for a type
 * @access Private
 */
const generateWarehouseCode = async (req, res) => {
    try {
        const { warehouseType } = req.params;
        const code = await warehouse_service_1.default.generateWarehouseCode(warehouseType);
        res.json({
            success: true,
            data: { warehouseCode: code },
        });
    }
    catch (error) {
        console.error('Generate warehouse code error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to generate warehouse code',
        });
    }
};
exports.generateWarehouseCode = generateWarehouseCode;
