"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.approveWorkOrder = exports.getProductionDashboard = exports.addProductionTracking = exports.deleteWorkOrder = exports.updateWorkOrder = exports.createWorkOrder = exports.getWorkOrdersByOrderId = exports.getWorkOrderById = exports.getAllWorkOrders = void 0;
const workOrder_service_1 = __importDefault(require("../services/workOrder.service"));
const client_1 = require("@prisma/client");
/**
 * @route GET /api/work-orders
 * @desc Get all work orders with optional filters
 * @access Private (PRODUCTION_MANAGER, ADMIN)
 */
const getAllWorkOrders = async (req, res) => {
    try {
        const { status, priority, locationId, styleId, orderId, search, startDate, endDate } = req.query;
        const filters = {
            status: status,
            priority: priority,
            locationId: locationId,
            styleId: styleId,
            orderId: orderId,
            search: search,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
        };
        const workOrders = await workOrder_service_1.default.getAllWorkOrders(filters);
        res.json({
            success: true,
            data: workOrders,
            count: workOrders.length,
        });
    }
    catch (error) {
        console.error('Get all work orders error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch work orders',
        });
    }
};
exports.getAllWorkOrders = getAllWorkOrders;
/**
 * @route GET /api/work-orders/:id
 * @desc Get work order by ID
 * @access Private
 */
const getWorkOrderById = async (req, res) => {
    try {
        const { id } = req.params;
        const workOrder = await workOrder_service_1.default.getWorkOrderById(id);
        res.json({
            success: true,
            data: workOrder,
        });
    }
    catch (error) {
        console.error('Get work order by ID error:', error);
        const statusCode = error.message.includes('not found') ? 404 : 500;
        res.status(statusCode).json({
            success: false,
            message: error.message || 'Failed to fetch work order',
        });
    }
};
exports.getWorkOrderById = getWorkOrderById;
/**
 * @route GET /api/work-orders/order/:orderId
 * @desc Get work orders by order ID
 * @access Private
 */
const getWorkOrdersByOrderId = async (req, res) => {
    try {
        const { orderId } = req.params;
        const workOrders = await workOrder_service_1.default.getWorkOrdersByOrderId(orderId);
        res.json({
            success: true,
            data: workOrders,
            count: workOrders.length,
        });
    }
    catch (error) {
        console.error('Get work orders by order ID error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch work orders',
        });
    }
};
exports.getWorkOrdersByOrderId = getWorkOrdersByOrderId;
/**
 * @route POST /api/work-orders
 * @desc Create a new work order
 * @access Private (PRODUCTION_MANAGER, ADMIN)
 */
const createWorkOrder = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated',
            });
        }
        const workOrderData = {
            ...req.body,
            plannedStartDate: new Date(req.body.plannedStartDate),
            plannedEndDate: new Date(req.body.plannedEndDate),
            createdById: userId,
        };
        const workOrder = await workOrder_service_1.default.createWorkOrder(workOrderData);
        res.status(201).json({
            success: true,
            data: workOrder,
            message: 'Work order created successfully',
        });
    }
    catch (error) {
        console.error('Create work order error:', error);
        const statusCode = error.message.includes('already exists') ? 400 : 500;
        res.status(statusCode).json({
            success: false,
            message: error.message || 'Failed to create work order',
        });
    }
};
exports.createWorkOrder = createWorkOrder;
/**
 * @route PUT /api/work-orders/:id
 * @desc Update a work order
 * @access Private (PRODUCTION_MANAGER, ADMIN)
 */
const updateWorkOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = {
            ...req.body,
        };
        // Convert date strings to Date objects if present
        if (req.body.plannedStartDate) {
            updateData.plannedStartDate = new Date(req.body.plannedStartDate);
        }
        if (req.body.plannedEndDate) {
            updateData.plannedEndDate = new Date(req.body.plannedEndDate);
        }
        if (req.body.actualStartDate) {
            updateData.actualStartDate = new Date(req.body.actualStartDate);
        }
        if (req.body.actualEndDate) {
            updateData.actualEndDate = new Date(req.body.actualEndDate);
        }
        const workOrder = await workOrder_service_1.default.updateWorkOrder(id, updateData);
        res.json({
            success: true,
            data: workOrder,
            message: 'Work order updated successfully',
        });
    }
    catch (error) {
        console.error('Update work order error:', error);
        const statusCode = error.message.includes('not found') ? 404 : 500;
        res.status(statusCode).json({
            success: false,
            message: error.message || 'Failed to update work order',
        });
    }
};
exports.updateWorkOrder = updateWorkOrder;
/**
 * @route DELETE /api/work-orders/:id
 * @desc Delete a work order
 * @access Private (ADMIN)
 */
const deleteWorkOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await workOrder_service_1.default.deleteWorkOrder(id);
        res.json(result);
    }
    catch (error) {
        console.error('Delete work order error:', error);
        const statusCode = error.message.includes('not found') ? 404 : 500;
        res.status(statusCode).json({
            success: false,
            message: error.message || 'Failed to delete work order',
        });
    }
};
exports.deleteWorkOrder = deleteWorkOrder;
/**
 * @route POST /api/work-orders/:id/tracking
 * @desc Add production tracking update
 * @access Private (PRODUCTION_MANAGER, FACTORY_SUPERVISOR)
 */
const addProductionTracking = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId || req.user?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated',
            });
        }
        const trackingData = {
            workOrderId: id,
            productionStage: req.body.productionStage,
            quantityCompleted: parseInt(req.body.quantityCompleted),
            remarks: req.body.remarks,
            updatedById: userId,
        };
        const tracking = await workOrder_service_1.default.addProductionTracking(trackingData);
        res.status(201).json({
            success: true,
            data: tracking,
            message: 'Production tracking updated successfully',
        });
    }
    catch (error) {
        console.error('Add production tracking error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to add production tracking',
        });
    }
};
exports.addProductionTracking = addProductionTracking;
/**
 * @route GET /api/work-orders/dashboard/summary
 * @desc Get production dashboard data
 * @access Private (PRODUCTION_MANAGER, ADMIN)
 */
const getProductionDashboard = async (req, res) => {
    try {
        const dashboard = await workOrder_service_1.default.getProductionDashboard();
        res.json({
            success: true,
            data: dashboard,
        });
    }
    catch (error) {
        console.error('Get production dashboard error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch production dashboard',
        });
    }
};
exports.getProductionDashboard = getProductionDashboard;
/**
 * @route PATCH /api/work-orders/:id/approve
 * @desc Approve a work order
 * @access Private (PRODUCTION_MANAGER, ADMIN)
 */
const approveWorkOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated',
            });
        }
        const workOrder = await workOrder_service_1.default.updateWorkOrder(id, {
            approvedById: userId,
            status: client_1.OrderStatus.PENDING,
        });
        res.json({
            success: true,
            data: workOrder,
            message: 'Work order approved successfully',
        });
    }
    catch (error) {
        console.error('Approve work order error:', error);
        const statusCode = error.message.includes('not found') ? 404 : 500;
        res.status(statusCode).json({
            success: false,
            message: error.message || 'Failed to approve work order',
        });
    }
};
exports.approveWorkOrder = approveWorkOrder;
