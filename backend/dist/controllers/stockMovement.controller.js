"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStockLedger = exports.getMovementSummary = exports.getMaterialMovementHistory = exports.createStockAdjustment = exports.createStockTransfer = exports.createStockOut = exports.createStockIn = exports.getMovementById = exports.getAllMovements = void 0;
const stockMovement_service_1 = __importDefault(require("../services/stockMovement.service"));
const library_1 = require("@prisma/client/runtime/library");
const logger_1 = require("../utils/logger");
/**
 * @route GET /api/stock-movements
 * @desc Get all stock movements with filters
 * @access Private
 */
const getAllMovements = async (req, res) => {
    try {
        const { warehouseId, materialId, movementType, startDate, endDate, referenceType, referenceId } = req.query;
        const filters = {};
        if (warehouseId)
            filters.warehouseId = warehouseId;
        if (materialId)
            filters.materialId = materialId;
        if (movementType)
            filters.movementType = movementType;
        if (referenceType)
            filters.referenceType = referenceType;
        if (referenceId)
            filters.referenceId = referenceId;
        if (startDate)
            filters.startDate = new Date(startDate);
        if (endDate)
            filters.endDate = new Date(endDate);
        const movements = await stockMovement_service_1.default.getAllMovements(filters);
        res.json({
            success: true,
            data: movements,
            count: movements.length,
        });
    }
    catch (error) {
        (0, logger_1.logError)('Get all movements error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch stock movements',
        });
    }
};
exports.getAllMovements = getAllMovements;
/**
 * @route GET /api/stock-movements/:id
 * @desc Get movement by ID
 * @access Private
 */
const getMovementById = async (req, res) => {
    try {
        const { id } = req.params;
        const movement = await stockMovement_service_1.default.getMovementById(id);
        res.json({
            success: true,
            data: movement,
        });
    }
    catch (error) {
        (0, logger_1.logError)('Get movement by ID error:', error);
        const statusCode = error.message.includes('not found') ? 404 : 500;
        res.status(statusCode).json({
            success: false,
            message: error.message || 'Failed to fetch movement',
        });
    }
};
exports.getMovementById = getMovementById;
/**
 * @route POST /api/stock-movements/stock-in
 * @desc Create stock in movement (receipt)
 * @access Private
 */
const createStockIn = async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated',
            });
        }
        const { materialId, warehouseId, quantity, unit, rate, referenceType, referenceId, referenceNumber, remarks } = req.body;
        // Validation
        if (!materialId || !warehouseId || !quantity || !unit) {
            return res.status(400).json({
                success: false,
                message: 'Material, warehouse, quantity, and unit are required',
            });
        }
        const movementData = {
            movementType: 'STOCK_IN',
            materialId,
            warehouseId,
            quantity: new library_1.Decimal(quantity),
            unit: unit,
            rate: rate ? new library_1.Decimal(rate) : undefined,
            referenceType,
            referenceId,
            referenceNumber,
            remarks,
            performedById: userId,
        };
        const movement = await stockMovement_service_1.default.createStockIn(movementData);
        res.status(201).json({
            success: true,
            message: 'Stock in movement created successfully',
            data: movement,
        });
    }
    catch (error) {
        (0, logger_1.logError)('Create stock in error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to create stock in movement',
        });
    }
};
exports.createStockIn = createStockIn;
/**
 * @route POST /api/stock-movements/stock-out
 * @desc Create stock out movement (issue)
 * @access Private
 */
const createStockOut = async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated',
            });
        }
        const { materialId, warehouseId, quantity, unit, referenceType, referenceId, referenceNumber, remarks } = req.body;
        // Validation
        if (!materialId || !warehouseId || !quantity || !unit) {
            return res.status(400).json({
                success: false,
                message: 'Material, warehouse, quantity, and unit are required',
            });
        }
        const movementData = {
            movementType: 'STOCK_OUT',
            materialId,
            warehouseId,
            quantity: new library_1.Decimal(quantity),
            unit: unit,
            referenceType,
            referenceId,
            referenceNumber,
            remarks,
            performedById: userId,
        };
        const movement = await stockMovement_service_1.default.createStockOut(movementData);
        res.status(201).json({
            success: true,
            message: 'Stock out movement created successfully',
            data: movement,
        });
    }
    catch (error) {
        (0, logger_1.logError)('Create stock out error:', error);
        const statusCode = error.message.includes('Insufficient stock') ? 400 : 500;
        res.status(statusCode).json({
            success: false,
            message: error.message || 'Failed to create stock out movement',
        });
    }
};
exports.createStockOut = createStockOut;
/**
 * @route POST /api/stock-movements/transfer
 * @desc Create stock transfer between warehouses
 * @access Private
 */
const createStockTransfer = async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated',
            });
        }
        const { materialId, fromWarehouseId, toWarehouseId, quantity, unit, remarks } = req.body;
        // Validation
        if (!materialId || !fromWarehouseId || !toWarehouseId || !quantity || !unit) {
            return res.status(400).json({
                success: false,
                message: 'Material, source warehouse, destination warehouse, quantity, and unit are required',
            });
        }
        if (fromWarehouseId === toWarehouseId) {
            return res.status(400).json({
                success: false,
                message: 'Source and destination warehouses must be different',
            });
        }
        const transferData = {
            materialId,
            fromWarehouseId,
            toWarehouseId,
            quantity: new library_1.Decimal(quantity),
            unit: unit,
            remarks,
            performedById: userId,
        };
        const result = await stockMovement_service_1.default.createStockTransfer(transferData);
        res.status(201).json({
            success: true,
            message: 'Stock transfer created successfully',
            data: result,
        });
    }
    catch (error) {
        (0, logger_1.logError)('Create stock transfer error:', error);
        const statusCode = error.message.includes('Insufficient stock') ? 400 : 500;
        res.status(statusCode).json({
            success: false,
            message: error.message || 'Failed to create stock transfer',
        });
    }
};
exports.createStockTransfer = createStockTransfer;
/**
 * @route POST /api/stock-movements/adjustment
 * @desc Create stock adjustment
 * @access Private (Inventory Manager only)
 */
const createStockAdjustment = async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated',
            });
        }
        const { materialId, warehouseId, adjustmentQuantity, unit, reason } = req.body;
        // Validation
        if (!materialId || !warehouseId || adjustmentQuantity === undefined || !unit || !reason) {
            return res.status(400).json({
                success: false,
                message: 'Material, warehouse, adjustment quantity, unit, and reason are required',
            });
        }
        const adjustmentData = {
            materialId,
            warehouseId,
            adjustmentQuantity: new library_1.Decimal(adjustmentQuantity),
            unit: unit,
            reason,
            performedById: userId,
        };
        const movement = await stockMovement_service_1.default.createStockAdjustment(adjustmentData);
        res.status(201).json({
            success: true,
            message: 'Stock adjustment created successfully',
            data: movement,
        });
    }
    catch (error) {
        (0, logger_1.logError)('Create stock adjustment error:', error);
        const statusCode = error.message.includes('Insufficient stock') ? 400 : 500;
        res.status(statusCode).json({
            success: false,
            message: error.message || 'Failed to create stock adjustment',
        });
    }
};
exports.createStockAdjustment = createStockAdjustment;
/**
 * @route GET /api/stock-movements/material/:materialId/history
 * @desc Get material movement history
 * @access Private
 */
const getMaterialMovementHistory = async (req, res) => {
    try {
        const { materialId } = req.params;
        const { warehouseId } = req.query;
        const history = await stockMovement_service_1.default.getMaterialMovementHistory(materialId, warehouseId);
        res.json({
            success: true,
            data: history,
            count: history.length,
        });
    }
    catch (error) {
        (0, logger_1.logError)('Get material movement history error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch movement history',
        });
    }
};
exports.getMaterialMovementHistory = getMaterialMovementHistory;
/**
 * @route GET /api/stock-movements/summary/:warehouseId
 * @desc Get movement summary for a warehouse
 * @access Private
 */
const getMovementSummary = async (req, res) => {
    try {
        const { warehouseId } = req.params;
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Start date and end date are required',
            });
        }
        const summary = await stockMovement_service_1.default.getMovementSummary(warehouseId, new Date(startDate), new Date(endDate));
        res.json({
            success: true,
            data: summary,
        });
    }
    catch (error) {
        (0, logger_1.logError)('Get movement summary error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch movement summary',
        });
    }
};
exports.getMovementSummary = getMovementSummary;
/**
 * @route GET /api/stock-movements/ledger/:materialId/:warehouseId
 * @desc Get stock ledger for a material in a warehouse
 * @access Private
 */
const getStockLedger = async (req, res) => {
    try {
        const { materialId, warehouseId } = req.params;
        const ledger = await stockMovement_service_1.default.getStockLedger(materialId, warehouseId);
        res.json({
            success: true,
            data: ledger,
            count: ledger.length,
        });
    }
    catch (error) {
        (0, logger_1.logError)('Get stock ledger error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch stock ledger',
        });
    }
};
exports.getStockLedger = getStockLedger;
