"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrderStatisticsByCustomer = exports.deleteOrder = exports.updateOrder = exports.updateOrderStatus = exports.getOrderById = exports.getAllOrders = exports.createOrder = void 0;
const crypto_1 = require("crypto");
const database_1 = __importDefault(require("../config/database"));
const logger_1 = require("../utils/logger");
/**
 * Create new order with items and breakup
 * POST /api/orders
 */
const createOrder = async (req, res) => {
    try {
        const { customerId, orderDate, expectedDeliveryDate, priority, paymentTerms, shippingAddress, remarks, items, // Array of { styleId, unitPrice, deliveryDate, breakup: [{ colorId, sizeId, quantity }] }
         } = req.body;
        // Debug logging
        (0, logger_1.logInfo)('[createOrder] Request body:', JSON.stringify({
            customerId,
            orderDate,
            expectedDeliveryDate,
            priority,
            items: items?.map((item) => ({
                styleId: item.styleId,
                unitPrice: item.unitPrice,
                breakupCount: item.breakup?.length,
                breakup: item.breakup?.slice(0, 3), // Log first 3 breakup items
            })),
        }, null, 2));
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
            // Handle empty/undefined unitPrice - default to 0 for orders without pricing
            const parsedUnitPrice = parseFloat(String(item.unitPrice)) || 0;
            const itemTotal = itemTotalQty * parsedUnitPrice;
            totalQuantity += itemTotalQty;
            totalAmount += itemTotal;
            (0, logger_1.logInfo)('[createOrder] Processing item:', JSON.stringify({
                styleId: item.styleId,
                breakupCount: item.breakup?.length,
                itemTotalQty,
                parsedUnitPrice,
                itemTotal,
            }));
            return {
                id: (0, crypto_1.randomUUID)(),
                styleId: item.styleId,
                itemDescription: item.itemDescription || null,
                totalQuantity: itemTotalQty,
                unitPrice: parsedUnitPrice,
                totalPrice: itemTotal,
                deliveryDate: item.deliveryDate ? new Date(item.deliveryDate) : null,
                remarks: item.remarks || null,
                order_item_breakup: {
                    create: item.breakup.map((b) => ({
                        id: (0, crypto_1.randomUUID)(),
                        colorId: b.colorId && b.colorId !== '' ? b.colorId : null, // Handle empty or null colorId
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
                orderDate: orderDate ? new Date(orderDate) : new Date(),
                expectedDeliveryDate: new Date(expectedDeliveryDate),
                priority: priority || 'MEDIUM',
                totalQuantity,
                totalAmount,
                paymentTerms,
                shippingAddress,
                remarks,
                createdById: userId,
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
        (0, logger_1.logError)('[createOrder] Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : undefined;
        (0, logger_1.logError)('[createOrder] Error details:', errorMessage);
        (0, logger_1.logError)('[createOrder] Error stack:', errorStack);
        // Check for Prisma-specific errors
        const prismaError = error;
        if (prismaError.code) {
            (0, logger_1.logError)('[createOrder] Prisma error code:', prismaError.code);
            (0, logger_1.logError)('[createOrder] Prisma error meta:', JSON.stringify(prismaError.meta));
        }
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to create order',
            details: errorMessage,
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
                { customers: { name: { contains: search, mode: 'insensitive' } } },
                { customers: { code: { contains: search, mode: 'insensitive' } } },
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
        (0, logger_1.logError)('Get orders error:', error);
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
        // Debug logging
        (0, logger_1.logInfo)('[getOrderById] Order found:', order.orderNumber);
        (0, logger_1.logInfo)('[getOrderById] Order items count:', order.order_items?.length || 0);
        if (order.order_items && order.order_items.length > 0) {
            (0, logger_1.logInfo)('[getOrderById] First item breakup count:', order.order_items[0].order_item_breakup?.length || 0);
            (0, logger_1.logInfo)('[getOrderById] First breakup sample:', JSON.stringify(order.order_items[0].order_item_breakup?.[0]));
        }
        res.json({ data: order });
    }
    catch (error) {
        (0, logger_1.logError)('Get order error:', error);
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
        (0, logger_1.logError)('Update order status error:', error);
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
        const { orderDate, expectedDeliveryDate, priority, paymentTerms, shippingAddress, remarks, } = req.body;
        const order = await database_1.default.orders.update({
            where: { id },
            data: {
                orderDate: orderDate ? new Date(orderDate) : undefined,
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
        (0, logger_1.logError)('Update order error:', error);
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
        (0, logger_1.logError)('Delete order error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to cancel order',
        });
    }
};
exports.deleteOrder = deleteOrder;
/**
 * Get order statistics grouped by customer
 * GET /api/orders/statistics/by-customer
 */
const getOrderStatisticsByCustomer = async (req, res) => {
    try {
        // Get statistics for orders that are not cancelled
        const statistics = await database_1.default.orders.groupBy({
            by: ['customerId'],
            where: {
                status: {
                    not: 'CANCELLED',
                },
            },
            _count: {
                id: true,
            },
            _sum: {
                totalQuantity: true,
                totalAmount: true,
            },
        });
        // Get customer details for each statistic
        const customerIds = statistics.map(s => s.customerId);
        const customers = await database_1.default.customers.findMany({
            where: {
                id: { in: customerIds },
            },
            select: {
                id: true,
                code: true,
                name: true,
            },
        });
        const customerMap = new Map(customers.map(c => [c.id, c]));
        // Combine statistics with customer info
        const result = statistics.map(stat => ({
            customerId: stat.customerId,
            customerCode: customerMap.get(stat.customerId)?.code || '',
            customerName: customerMap.get(stat.customerId)?.name || '',
            orderCount: stat._count.id,
            totalPieces: stat._sum.totalQuantity || 0,
            totalAmount: stat._sum.totalAmount || 0,
        }));
        // Calculate totals
        const totals = {
            totalOrders: result.reduce((sum, r) => sum + r.orderCount, 0),
            totalPieces: result.reduce((sum, r) => sum + r.totalPieces, 0),
            totalAmount: result.reduce((sum, r) => sum + Number(r.totalAmount), 0),
        };
        res.json({
            data: result,
            totals,
        });
    }
    catch (error) {
        (0, logger_1.logError)('Get order statistics error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch order statistics',
        });
    }
};
exports.getOrderStatisticsByCustomer = getOrderStatisticsByCustomer;
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
