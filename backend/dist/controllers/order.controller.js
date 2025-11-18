"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteOrder = exports.updateOrder = exports.updateOrderStatus = exports.getOrderById = exports.getAllOrders = exports.createOrder = void 0;
const crypto_1 = require("crypto");
const database_1 = __importDefault(require("../config/database"));
/**
 * Create new order with items and breakup
 * POST /api/orders
 */
const createOrder = async (req, res) => {
    try {
        const { customerId, expectedDeliveryDate, priority, paymentTerms, shippingAddress, remarks, items, // Array of { styleId, unitPrice, deliveryDate, breakup: [{ colorId, sizeId, quantity }] }
         } = req.body;
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'User not authenticated',
            });
            return;
        }
        // Generate order number
        const orderNumber = await generateOrderNumber();
        // Calculate totals
        let totalQuantity = 0;
        let totalAmount = 0;
        const orderItemsData = items.map((item) => {
            const itemTotalQty = item.breakup.reduce((sum, b) => sum + b.quantity, 0);
            const itemTotal = itemTotalQty * parseFloat(item.unitPrice);
            totalQuantity += itemTotalQty;
            totalAmount += itemTotal;
            return {
                id: (0, crypto_1.randomUUID)(),
                styleId: item.styleId,
                itemDescription: item.itemDescription || null,
                totalQuantity: itemTotalQty,
                unitPrice: parseFloat(item.unitPrice),
                totalPrice: itemTotal,
                deliveryDate: item.deliveryDate ? new Date(item.deliveryDate) : null,
                remarks: item.remarks || null,
                order_item_breakup: {
                    create: item.breakup.map((b) => ({
                        id: (0, crypto_1.randomUUID)(),
                        colorId: b.colorId,
                        sizeId: b.sizeId,
                        quantity: b.quantity,
                    })),
                },
            };
        });
        const order = await database_1.default.orders.create({
            data: {
                id: (0, crypto_1.randomUUID)(),
                orderNumber,
                customerId,
                orderDate: new Date(),
                expectedDeliveryDate: new Date(expectedDeliveryDate),
                priority: priority || 'MEDIUM',
                totalQuantity,
                totalAmount,
                paymentTerms,
                shippingAddress,
                remarks,
                createdById: userId,
                updatedAt: new Date(),
                order_items: {
                    create: orderItemsData,
                },
            },
            include: {
                customers: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        contactPerson: true,
                        phone: true,
                        email: true,
                    },
                },
                users_orders_createdByIdTousers: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
                order_items: {
                    include: {
                        styles: {
                            select: {
                                id: true,
                                styleCode: true,
                                styleName: true,
                                image: true,
                            },
                        },
                        order_item_breakup: {
                            include: {
                                color_options: true,
                                size_options: true,
                            },
                        },
                    },
                },
            },
        });
        res.status(201).json({
            data: order,
            message: 'Order created successfully',
        });
    }
    catch (error) {
        console.error('Create order error:', error);
        console.error('Error details:', error.message);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to create order',
            details: error.message,
        });
    }
};
exports.createOrder = createOrder;
/**
 * Get all orders with pagination, search, and filters
 * GET /api/orders
 */
const getAllOrders = async (req, res) => {
    try {
        const { page = '1', limit = '10', search = '', customerId, status, priority, fromDate, toDate, } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;
        // Build where clause
        const where = {};
        if (search) {
            where.OR = [
                { orderNumber: { contains: search, mode: 'insensitive' } },
                { customer: { name: { contains: search, mode: 'insensitive' } } },
                { customer: { code: { contains: search, mode: 'insensitive' } } },
            ];
        }
        if (customerId) {
            where.customerId = customerId;
        }
        if (status) {
            where.status = status;
        }
        if (priority) {
            where.priority = priority;
        }
        if (fromDate || toDate) {
            where.orderDate = {};
            if (fromDate) {
                where.orderDate.gte = new Date(fromDate);
            }
            if (toDate) {
                where.orderDate.lte = new Date(toDate);
            }
        }
        const [orders, total] = await Promise.all([
            database_1.default.orders.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: { orderDate: 'desc' },
                include: {
                    customers: {
                        select: {
                            id: true,
                            code: true,
                            name: true,
                            contactPerson: true,
                        },
                    },
                    users_orders_createdByIdTousers: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                    _count: {
                        select: { order_items: true },
                    },
                },
            }),
            database_1.default.orders.count({ where }),
        ]);
        res.json({
            data: orders,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum),
            },
        });
    }
    catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch orders',
        });
    }
};
exports.getAllOrders = getAllOrders;
/**
 * Get single order by ID with full details
 * GET /api/orders/:id
 */
const getOrderById = async (req, res) => {
    try {
        const { id } = req.params;
        const order = await database_1.default.orders.findUnique({
            where: { id },
            include: {
                customers: true,
                users_orders_createdByIdTousers: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
                users_orders_approvedByIdTousers: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
                order_items: {
                    include: {
                        styles: true,
                        order_item_breakup: {
                            include: {
                                color_options: true,
                                size_options: true,
                            },
                        },
                    },
                },
            },
        });
        if (!order) {
            res.status(404).json({
                error: 'Not Found',
                message: 'Order not found',
            });
            return;
        }
        res.json({ data: order });
    }
    catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch order',
        });
    }
};
exports.getOrderById = getOrderById;
/**
 * Update order status
 * PATCH /api/orders/:id/status
 */
const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const order = await database_1.default.orders.update({
            where: { id },
            data: { status },
            include: {
                customers: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                    },
                },
            },
        });
        res.json({
            data: order,
            message: 'Order status updated successfully',
        });
    }
    catch (error) {
        console.error('Update order status error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to update order status',
        });
    }
};
exports.updateOrderStatus = updateOrderStatus;
/**
 * Update order
 * PUT /api/orders/:id
 */
const updateOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const { expectedDeliveryDate, priority, paymentTerms, shippingAddress, remarks, } = req.body;
        const order = await database_1.default.orders.update({
            where: { id },
            data: {
                expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : undefined,
                priority,
                paymentTerms,
                shippingAddress,
                remarks,
            },
            include: {
                customers: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                    },
                },
                order_items: {
                    include: {
                        styles: {
                            select: {
                                id: true,
                                styleCode: true,
                                styleName: true,
                            },
                        },
                    },
                },
            },
        });
        res.json({
            data: order,
            message: 'Order updated successfully',
        });
    }
    catch (error) {
        console.error('Update order error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to update order',
        });
    }
};
exports.updateOrder = updateOrder;
/**
 * Delete/Cancel order
 * DELETE /api/orders/:id
 */
const deleteOrder = async (req, res) => {
    try {
        const { id } = req.params;
        // Check if order exists
        const order = await database_1.default.orders.findUnique({
            where: { id },
        });
        if (!order) {
            res.status(404).json({
                error: 'Not Found',
                message: 'Order not found',
            });
            return;
        }
        // Cancel order instead of hard delete
        await database_1.default.orders.update({
            where: { id },
            data: { status: 'CANCELLED' },
        });
        res.json({ message: 'Order cancelled successfully' });
    }
    catch (error) {
        console.error('Delete order error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to cancel order',
        });
    }
};
exports.deleteOrder = deleteOrder;
/**
 * Generate unique order number
 */
async function generateOrderNumber() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    // Find the last order number for this month
    const lastOrder = await database_1.default.orders.findFirst({
        where: {
            orderNumber: {
                startsWith: `ORD${year}${month}`,
            },
        },
        orderBy: {
            orderNumber: 'desc',
        },
    });
    let sequence = 1;
    if (lastOrder) {
        const lastSequence = parseInt(lastOrder.orderNumber.slice(-4));
        sequence = lastSequence + 1;
    }
    return `ORD${year}${month}${String(sequence).padStart(4, '0')}`;
}
