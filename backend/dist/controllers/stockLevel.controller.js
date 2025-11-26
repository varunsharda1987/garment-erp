"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStockValuationReport = exports.getStockAgingReport = exports.getMaterialsBelowReorderLevel = exports.updateStockLevel = exports.getStockLevelsByWarehouse = exports.getStockLevelsByMaterial = exports.getStockLevelById = exports.getAllStockLevels = void 0;
const stockLevel_service_1 = __importDefault(require("../services/stockLevel.service"));
const library_1 = require("@prisma/client/runtime/library");
const logger_1 = require("../utils/logger");
/**
 * @route GET /api/stock-levels
 * @desc Get all stock levels with optional filters
 * @access Private
 */
const getAllStockLevels = async (req, res) => {
    try {
        const { warehouseId, materialId, belowReorderLevel, search } = req.query;
        const filters = {
            warehouseId: warehouseId,
            materialId: materialId,
            belowReorderLevel: belowReorderLevel === 'true',
            search: search,
        };
        const stockLevels = await stockLevel_service_1.default.getAllStockLevels(filters);
        res.json({
            success: true,
            data: stockLevels,
            count: stockLevels.length,
        });
    }
    catch (error) {
        (0, logger_1.logError)('Get all stock levels error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch stock levels',
        });
    }
};
exports.getAllStockLevels = getAllStockLevels;
/**
 * @route GET /api/stock-levels/:id
 * @desc Get stock level by ID
 * @access Private
 */
const getStockLevelById = async (req, res) => {
    try {
        const { id } = req.params;
        const stockLevel = await stockLevel_service_1.default.getStockLevelById(id);
        res.json({
            success: true,
            data: stockLevel,
        });
    }
    catch (error) {
        (0, logger_1.logError)('Get stock level by ID error:', error);
        const statusCode = error.message.includes('not found') ? 404 : 500;
        res.status(statusCode).json({
            success: false,
            message: error.message || 'Failed to fetch stock level',
        });
    }
};
exports.getStockLevelById = getStockLevelById;
/**
 * @route GET /api/stock-levels/material/:materialId
 * @desc Get stock levels for a material across all warehouses
 * @access Private
 */
const getStockLevelsByMaterial = async (req, res) => {
    try {
        const { materialId } = req.params;
        const result = await stockLevel_service_1.default.getStockLevelsByMaterial(materialId);
        res.json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        (0, logger_1.logError)('Get stock levels by material error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch stock levels',
        });
    }
};
exports.getStockLevelsByMaterial = getStockLevelsByMaterial;
/**
 * @route GET /api/stock-levels/warehouse/:warehouseId
 * @desc Get all stock levels in a warehouse
 * @access Private
 */
const getStockLevelsByWarehouse = async (req, res) => {
    try {
        const { warehouseId } = req.params;
        const result = await stockLevel_service_1.default.getStockLevelsByWarehouse(warehouseId);
        res.json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        (0, logger_1.logError)('Get stock levels by warehouse error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch stock levels',
        });
    }
};
exports.getStockLevelsByWarehouse = getStockLevelsByWarehouse;
/**
 * @route PUT /api/stock-levels/:id
 * @desc Update stock level (for manual adjustments)
 * @access Private (Inventory Manager only)
 */
const updateStockLevel = async (req, res) => {
    try {
        const { id } = req.params;
        const { quantity, reorderLevel, maxLevel, minLevel, valuationRate } = req.body;
        const updateData = {};
        if (quantity !== undefined)
            updateData.quantity = new library_1.Decimal(quantity);
        if (reorderLevel !== undefined)
            updateData.reorderLevel = new library_1.Decimal(reorderLevel);
        if (maxLevel !== undefined)
            updateData.maxLevel = new library_1.Decimal(maxLevel);
        if (minLevel !== undefined)
            updateData.minLevel = new library_1.Decimal(minLevel);
        if (valuationRate !== undefined)
            updateData.valuationRate = new library_1.Decimal(valuationRate);
        const stockLevel = await stockLevel_service_1.default.updateStockLevel(id, updateData);
        res.json({
            success: true,
            message: 'Stock level updated successfully',
            data: stockLevel,
        });
    }
    catch (error) {
        (0, logger_1.logError)('Update stock level error:', error);
        const statusCode = error.message.includes('not found') ? 404 : 500;
        res.status(statusCode).json({
            success: false,
            message: error.message || 'Failed to update stock level',
        });
    }
};
exports.updateStockLevel = updateStockLevel;
/**
 * @route GET /api/stock-levels/below-reorder
 * @desc Get materials below reorder level
 * @access Private
 */
const getMaterialsBelowReorderLevel = async (req, res) => {
    try {
        const { warehouseId } = req.query;
        const materials = await stockLevel_service_1.default.getMaterialsBelowReorderLevel(warehouseId);
        res.json({
            success: true,
            data: materials,
            count: materials.length,
        });
    }
    catch (error) {
        (0, logger_1.logError)('Get materials below reorder level error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch low stock materials',
        });
    }
};
exports.getMaterialsBelowReorderLevel = getMaterialsBelowReorderLevel;
/**
 * @route GET /api/stock-levels/aging/:warehouseId
 * @desc Get stock aging report for a warehouse
 * @access Private
 */
const getStockAgingReport = async (req, res) => {
    try {
        const { warehouseId } = req.params;
        const aging = await stockLevel_service_1.default.getStockAgingReport(warehouseId);
        res.json({
            success: true,
            data: aging,
            count: aging.length,
        });
    }
    catch (error) {
        (0, logger_1.logError)('Get stock aging report error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch stock aging report',
        });
    }
};
exports.getStockAgingReport = getStockAgingReport;
/**
 * @route GET /api/stock-levels/valuation
 * @desc Get stock valuation report
 * @access Private
 */
const getStockValuationReport = async (req, res) => {
    try {
        const { warehouseId } = req.query;
        const report = await stockLevel_service_1.default.getStockValuationReport(warehouseId);
        res.json({
            success: true,
            data: report,
        });
    }
    catch (error) {
        (0, logger_1.logError)('Get stock valuation report error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch valuation report',
        });
    }
};
exports.getStockValuationReport = getStockValuationReport;
