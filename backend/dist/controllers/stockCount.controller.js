"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCountSummary = exports.getVarianceReport = exports.cancelStockCount = exports.approveStockCount = exports.verifyStockCount = exports.updateCountItem = exports.startCounting = exports.createStockCount = exports.getStockCountById = exports.getAllStockCounts = void 0;
const stockCount_service_1 = __importDefault(require("../services/stockCount.service"));
const library_1 = require("@prisma/client/runtime/library");
/**
 * @route GET /api/stock-counts
 * @desc Get all stock counts with filters
 * @access Private
 */
const getAllStockCounts = async (req, res) => {
    try {
        const { warehouseId, status, countType, startDate, endDate } = req.query;
        const filters = {};
        if (warehouseId)
            filters.warehouseId = warehouseId;
        if (status)
            filters.status = status;
        if (countType)
            filters.countType = countType;
        if (startDate)
            filters.startDate = new Date(startDate);
        if (endDate)
            filters.endDate = new Date(endDate);
        const stockCounts = await stockCount_service_1.default.getAllStockCounts(filters);
        res.json({
            success: true,
            data: stockCounts,
            count: stockCounts.length,
        });
    }
    catch (error) {
        console.error('Get all stock counts error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch stock counts',
        });
    }
};
exports.getAllStockCounts = getAllStockCounts;
/**
 * @route GET /api/stock-counts/:id
 * @desc Get stock count by ID with items
 * @access Private
 */
const getStockCountById = async (req, res) => {
    try {
        const { id } = req.params;
        const stockCount = await stockCount_service_1.default.getStockCountById(id);
        res.json({
            success: true,
            data: stockCount,
        });
    }
    catch (error) {
        console.error('Get stock count by ID error:', error);
        const statusCode = error.message.includes('not found') ? 404 : 500;
        res.status(statusCode).json({
            success: false,
            message: error.message || 'Failed to fetch stock count',
        });
    }
};
exports.getStockCountById = getStockCountById;
/**
 * @route POST /api/stock-counts
 * @desc Create new stock count
 * @access Private (Inventory Manager)
 */
const createStockCount = async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated',
            });
        }
        const { warehouseId, countType, countDate, remarks, materialIds } = req.body;
        // Validation
        if (!warehouseId || !countType) {
            return res.status(400).json({
                success: false,
                message: 'Warehouse and count type are required',
            });
        }
        if ((countType === 'PARTIAL' || countType === 'SPOT_CHECK') && (!materialIds || materialIds.length === 0)) {
            return res.status(400).json({
                success: false,
                message: 'Material IDs are required for PARTIAL or SPOT_CHECK counts',
            });
        }
        const countData = {
            warehouseId,
            countType: countType,
            countDate: countDate ? new Date(countDate) : undefined,
            remarks,
            countedById: userId,
            materialIds,
        };
        const stockCount = await stockCount_service_1.default.createStockCount(countData);
        res.status(201).json({
            success: true,
            message: 'Stock count created successfully',
            data: stockCount,
        });
    }
    catch (error) {
        console.error('Create stock count error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to create stock count',
        });
    }
};
exports.createStockCount = createStockCount;
/**
 * @route POST /api/stock-counts/:id/start
 * @desc Start counting process
 * @access Private
 */
const startCounting = async (req, res) => {
    try {
        const { id } = req.params;
        const stockCount = await stockCount_service_1.default.startCounting(id);
        res.json({
            success: true,
            message: 'Stock count started successfully',
            data: stockCount,
        });
    }
    catch (error) {
        console.error('Start counting error:', error);
        const statusCode = error.message.includes('not found') ? 404 : 500;
        res.status(statusCode).json({
            success: false,
            message: error.message || 'Failed to start counting',
        });
    }
};
exports.startCounting = startCounting;
/**
 * @route PUT /api/stock-counts/:countId/items/:itemId
 * @desc Update count item with physical quantity
 * @access Private
 */
const updateCountItem = async (req, res) => {
    try {
        const { itemId } = req.params;
        const { physicalQuantity, remarks } = req.body;
        const updateData = {
            physicalQuantity: physicalQuantity !== undefined ? new library_1.Decimal(physicalQuantity) : undefined,
            remarks,
        };
        const item = await stockCount_service_1.default.updateCountItem(itemId, updateData);
        res.json({
            success: true,
            message: 'Count item updated successfully',
            data: item,
        });
    }
    catch (error) {
        console.error('Update count item error:', error);
        const statusCode = error.message.includes('not found') ? 404 :
            error.message.includes('Cannot update') ? 400 : 500;
        res.status(statusCode).json({
            success: false,
            message: error.message || 'Failed to update count item',
        });
    }
};
exports.updateCountItem = updateCountItem;
/**
 * @route POST /api/stock-counts/:id/verify
 * @desc Verify stock count
 * @access Private (Supervisor)
 */
const verifyStockCount = async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated',
            });
        }
        const { id } = req.params;
        const stockCount = await stockCount_service_1.default.verifyStockCount(id, userId);
        res.json({
            success: true,
            message: 'Stock count verified successfully',
            data: stockCount,
        });
    }
    catch (error) {
        console.error('Verify stock count error:', error);
        const statusCode = error.message.includes('not found') ? 404 :
            error.message.includes('must be') ? 400 : 500;
        res.status(statusCode).json({
            success: false,
            message: error.message || 'Failed to verify stock count',
        });
    }
};
exports.verifyStockCount = verifyStockCount;
/**
 * @route POST /api/stock-counts/:id/approve
 * @desc Approve stock count and apply adjustments
 * @access Private (Manager only)
 */
const approveStockCount = async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated',
            });
        }
        const { id } = req.params;
        const result = await stockCount_service_1.default.approveStockCount(id, userId);
        res.json({
            success: true,
            message: `Stock count approved successfully. ${result.adjustmentCount} adjustments created.`,
            data: result,
        });
    }
    catch (error) {
        console.error('Approve stock count error:', error);
        const statusCode = error.message.includes('not found') ? 404 :
            error.message.includes('must be') ? 400 : 500;
        res.status(statusCode).json({
            success: false,
            message: error.message || 'Failed to approve stock count',
        });
    }
};
exports.approveStockCount = approveStockCount;
/**
 * @route POST /api/stock-counts/:id/cancel
 * @desc Cancel stock count
 * @access Private
 */
const cancelStockCount = async (req, res) => {
    try {
        const { id } = req.params;
        const stockCount = await stockCount_service_1.default.cancelStockCount(id);
        res.json({
            success: true,
            message: 'Stock count cancelled successfully',
            data: stockCount,
        });
    }
    catch (error) {
        console.error('Cancel stock count error:', error);
        const statusCode = error.message.includes('not found') ? 404 :
            error.message.includes('Cannot cancel') ? 400 : 500;
        res.status(statusCode).json({
            success: false,
            message: error.message || 'Failed to cancel stock count',
        });
    }
};
exports.cancelStockCount = cancelStockCount;
/**
 * @route GET /api/stock-counts/:id/variance
 * @desc Get variance report for a stock count
 * @access Private
 */
const getVarianceReport = async (req, res) => {
    try {
        const { id } = req.params;
        const report = await stockCount_service_1.default.getVarianceReport(id);
        res.json({
            success: true,
            data: report,
        });
    }
    catch (error) {
        console.error('Get variance report error:', error);
        const statusCode = error.message.includes('not found') ? 404 : 500;
        res.status(statusCode).json({
            success: false,
            message: error.message || 'Failed to fetch variance report',
        });
    }
};
exports.getVarianceReport = getVarianceReport;
/**
 * @route GET /api/stock-counts/summary/:warehouseId
 * @desc Get count summary for a warehouse
 * @access Private
 */
const getCountSummary = async (req, res) => {
    try {
        const { warehouseId } = req.params;
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Start date and end date are required',
            });
        }
        const summary = await stockCount_service_1.default.getCountSummary(warehouseId, new Date(startDate), new Date(endDate));
        res.json({
            success: true,
            data: summary,
        });
    }
    catch (error) {
        console.error('Get count summary error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch count summary',
        });
    }
};
exports.getCountSummary = getCountSummary;
