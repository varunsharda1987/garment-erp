"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Work Order Service - Production Planning & Work Order Management
const client_1 = require("@prisma/client");
const crypto_1 = require("crypto");
const prisma = new client_1.PrismaClient();
class WorkOrderService {
    /**
     * Generate unique work order number
     */
    async generateWorkOrderNumber() {
        const year = new Date().getFullYear().toString().slice(-2);
        const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
        // Find the last work order number for this month
        const lastWorkOrder = await prisma.work_orders.findFirst({
            where: {
                workOrderNumber: {
                    startsWith: `WO${year}${month}`,
                },
            },
            orderBy: {
                workOrderNumber: 'desc',
            },
        });
        let sequence = 1;
        if (lastWorkOrder) {
            const lastSequence = parseInt(lastWorkOrder.workOrderNumber.slice(-4));
            sequence = lastSequence + 1;
        }
        return `WO${year}${month}${sequence.toString().padStart(4, '0')}`;
    }
    /**
     * Create a new work order
     */
    async createWorkOrder(data) {
        const workOrderNumber = await this.generateWorkOrderNumber();
        const workOrder = await prisma.work_orders.create({
            data: {
                id: (0, crypto_1.randomUUID)(),
                workOrderNumber,
                orderId: data.orderId,
                orderItemId: data.orderItemId,
                styleId: data.styleId,
                locationId: data.locationId || null, // Handle nullable locationId
                plannedStartDate: data.plannedStartDate,
                plannedEndDate: data.plannedEndDate,
                totalQuantity: data.totalQuantity,
                completedQuantity: 0,
                status: client_1.OrderStatus.PENDING,
                priority: data.priority || client_1.Priority.MEDIUM,
                remarks: data.remarks,
                createdById: data.createdById,
                work_order_breakup: {
                    create: data.colorSizeBreakup.map(breakup => ({
                        id: (0, crypto_1.randomUUID)(),
                        colorId: breakup.colorId || null, // Handle nullable colorId
                        sizeId: breakup.sizeId,
                        plannedQuantity: breakup.quantity,
                        completedQuantity: 0,
                    })),
                },
            },
            include: {
                orders: {
                    select: {
                        id: true,
                        orderNumber: true,
                        customers: {
                            select: {
                                id: true,
                                name: true,
                                code: true,
                            },
                        },
                    },
                },
                order_items: {
                    select: {
                        id: true,
                        itemDescription: true,
                        totalQuantity: true,
                        unitPrice: true,
                    },
                },
                styles: {
                    select: {
                        id: true,
                        styleCode: true,
                        styleName: true,
                        categoryId: true,
                    },
                },
                locations: {
                    select: {
                        id: true,
                        locationCode: true,
                        locationName: true,
                        locationType: true,
                    },
                },
                users_work_orders_createdByIdTousers: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
                work_order_breakup: {
                    include: {
                        color_options: {
                            select: {
                                id: true,
                                colorName: true,
                                colorCode: true,
                            },
                        },
                        size_options: {
                            select: {
                                id: true,
                                sizeName: true,
                                sizeCode: true,
                            },
                        },
                    },
                },
            },
        });
        return workOrder;
    }
    /**
     * Get all work orders with optional filters
     */
    async getAllWorkOrders(filters) {
        const where = {};
        if (filters?.status) {
            where.status = filters.status;
        }
        if (filters?.priority) {
            where.priority = filters.priority;
        }
        if (filters?.locationId) {
            where.locationId = filters.locationId;
        }
        if (filters?.styleId) {
            where.styleId = filters.styleId;
        }
        if (filters?.orderId) {
            where.orderId = filters.orderId;
        }
        if (filters?.search) {
            where.OR = [
                { workOrderNumber: { contains: filters.search, mode: 'insensitive' } },
                { orders: { orderNumber: { contains: filters.search, mode: 'insensitive' } } },
                { styles: { styleCode: { contains: filters.search, mode: 'insensitive' } } },
            ];
        }
        if (filters?.startDate || filters?.endDate) {
            where.plannedStartDate = {};
            if (filters?.startDate) {
                where.plannedStartDate.gte = filters.startDate;
            }
            if (filters?.endDate) {
                where.plannedStartDate.lte = filters.endDate;
            }
        }
        const workOrders = await prisma.work_orders.findMany({
            where,
            include: {
                orders: {
                    select: {
                        id: true,
                        orderNumber: true,
                        customers: {
                            select: {
                                id: true,
                                name: true,
                                code: true,
                            },
                        },
                    },
                },
                order_items: {
                    select: {
                        id: true,
                        itemDescription: true,
                        totalQuantity: true,
                        unitPrice: true,
                    },
                },
                styles: {
                    select: {
                        id: true,
                        styleCode: true,
                        styleName: true,
                        categoryId: true,
                    },
                },
                locations: {
                    select: {
                        id: true,
                        locationCode: true,
                        locationName: true,
                        locationType: true,
                    },
                },
                users_work_orders_createdByIdTousers: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
                users_work_orders_approvedByIdTousers: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
                work_order_breakup: {
                    include: {
                        color_options: {
                            select: {
                                id: true,
                                colorName: true,
                                colorCode: true,
                            },
                        },
                        size_options: {
                            select: {
                                id: true,
                                sizeName: true,
                                sizeCode: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
        return workOrders;
    }
    /**
     * Get a single work order by ID
     */
    async getWorkOrderById(id) {
        const workOrder = await prisma.work_orders.findUnique({
            where: { id },
            include: {
                orders: {
                    select: {
                        id: true,
                        orderNumber: true,
                        orderDate: true,
                        expectedDeliveryDate: true,
                        customers: {
                            select: {
                                id: true,
                                name: true,
                                code: true,
                            },
                        },
                    },
                },
                order_items: {
                    select: {
                        id: true,
                        itemDescription: true,
                        totalQuantity: true,
                        unitPrice: true,
                        totalPrice: true,
                    },
                },
                styles: {
                    select: {
                        id: true,
                        styleCode: true,
                        styleName: true,
                        categoryId: true,
                        description: true,
                        imageUrl: true,
                    },
                },
                locations: {
                    select: {
                        id: true,
                        locationCode: true,
                        locationName: true,
                        locationType: true,
                        address: true,
                    },
                },
                users_work_orders_createdByIdTousers: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
                users_work_orders_approvedByIdTousers: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
                work_order_breakup: {
                    include: {
                        color_options: {
                            select: {
                                id: true,
                                colorName: true,
                                colorCode: true,
                            },
                        },
                        size_options: {
                            select: {
                                id: true,
                                sizeName: true,
                                sizeCode: true,
                            },
                        },
                    },
                },
                production_tracking: {
                    include: {
                        users: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                            },
                        },
                    },
                    orderBy: {
                        updateDate: 'desc',
                    },
                },
            },
        });
        if (!workOrder) {
            throw new Error('Work order not found');
        }
        return workOrder;
    }
    /**
     * Update a work order
     */
    async updateWorkOrder(id, data) {
        const workOrder = await prisma.work_orders.update({
            where: { id },
            data: {
                ...data,
            },
            include: {
                orders: {
                    select: {
                        id: true,
                        orderNumber: true,
                        customers: {
                            select: {
                                id: true,
                                name: true,
                                code: true,
                            },
                        },
                    },
                },
                styles: {
                    select: {
                        id: true,
                        styleCode: true,
                        styleName: true,
                    },
                },
                locations: {
                    select: {
                        id: true,
                        locationCode: true,
                        locationName: true,
                    },
                },
            },
        });
        return workOrder;
    }
    /**
     * Delete a work order
     */
    async deleteWorkOrder(id) {
        await prisma.work_orders.delete({
            where: { id },
        });
        return { success: true, message: 'Work order deleted successfully' };
    }
    /**
     * Add production tracking update
     */
    async addProductionTracking(data) {
        const tracking = await prisma.production_tracking.create({
            data: {
                id: (0, crypto_1.randomUUID)(),
                workOrderId: data.workOrderId,
                productionStage: data.productionStage,
                quantityCompleted: data.quantityCompleted,
                remarks: data.remarks,
                updatedById: data.updatedById,
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
                work_orders: {
                    select: {
                        id: true,
                        workOrderNumber: true,
                        totalQuantity: true,
                    },
                },
            },
        });
        // Update work order status based on production stage
        const workOrder = await prisma.work_orders.findUnique({
            where: { id: data.workOrderId },
        });
        if (workOrder) {
            let newStatus = workOrder.status;
            if (data.productionStage === client_1.ProductionStage.CUTTING && !workOrder.actualStartDate) {
                // Mark as started when cutting begins
                await prisma.work_orders.update({
                    where: { id: data.workOrderId },
                    data: {
                        actualStartDate: new Date(),
                        status: client_1.OrderStatus.IN_PRODUCTION,
                    },
                });
            }
            else if (data.productionStage === client_1.ProductionStage.PACKING && data.quantityCompleted >= workOrder.totalQuantity) {
                // Mark as completed when packing is done
                await prisma.work_orders.update({
                    where: { id: data.workOrderId },
                    data: {
                        actualEndDate: new Date(),
                        status: client_1.OrderStatus.COMPLETED,
                        completedQuantity: workOrder.totalQuantity,
                    },
                });
            }
        }
        return tracking;
    }
    /**
     * Get production dashboard data
     */
    async getProductionDashboard() {
        // Get work orders summary by status
        const statusSummary = await prisma.work_orders.groupBy({
            by: ['status'],
            _count: {
                id: true,
            },
            _sum: {
                totalQuantity: true,
                completedQuantity: true,
            },
        });
        // Get work orders by location
        const locationSummary = await prisma.work_orders.groupBy({
            by: ['locationId'],
            _count: {
                id: true,
            },
            where: {
                status: {
                    in: [client_1.OrderStatus.PENDING, client_1.OrderStatus.IN_PRODUCTION],
                },
            },
        });
        // Get recent production tracking updates
        const recentUpdates = await prisma.production_tracking.findMany({
            take: 10,
            orderBy: {
                updateDate: 'desc',
            },
            include: {
                work_orders: {
                    select: {
                        id: true,
                        workOrderNumber: true,
                        styles: {
                            select: {
                                styleCode: true,
                                styleName: true,
                            },
                        },
                    },
                },
                users: {
                    select: {
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });
        // Get active work orders with stage breakdown
        const activeWorkOrders = await prisma.work_orders.findMany({
            where: {
                status: {
                    in: [client_1.OrderStatus.PENDING, client_1.OrderStatus.IN_PRODUCTION],
                },
            },
            include: {
                styles: {
                    select: {
                        styleCode: true,
                        styleName: true,
                    },
                },
                locations: {
                    select: {
                        locationName: true,
                    },
                },
                production_tracking: {
                    orderBy: {
                        updateDate: 'desc',
                    },
                    take: 1,
                },
            },
            orderBy: {
                plannedStartDate: 'asc',
            },
        });
        return {
            statusSummary,
            locationSummary,
            recentUpdates,
            activeWorkOrders,
        };
    }
    /**
     * Get work orders by order ID
     */
    async getWorkOrdersByOrderId(orderId) {
        return await prisma.work_orders.findMany({
            where: { orderId },
            include: {
                styles: {
                    select: {
                        styleCode: true,
                        styleName: true,
                    },
                },
                locations: {
                    select: {
                        locationName: true,
                        locationCode: true,
                    },
                },
                work_order_breakup: {
                    include: {
                        color_options: {
                            select: {
                                id: true,
                                colorName: true,
                                colorCode: true,
                            },
                        },
                        size_options: {
                            select: {
                                id: true,
                                sizeName: true,
                                sizeCode: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }
    /**
     * Create work order automatically from order item
     * Used when auto-creating work orders during order creation
     */
    async createFromOrderItem(orderItemId, orderId, orderData) {
        // Fetch the order item with its breakup
        const orderItem = await prisma.order_items.findUnique({
            where: { id: orderItemId },
            include: {
                order_item_breakup: true,
            },
        });
        if (!orderItem) {
            throw new Error(`Order item not found: ${orderItemId}`);
        }
        // Map order item breakup to work order breakup format
        const colorSizeBreakup = orderItem.order_item_breakup.map(breakup => ({
            colorId: breakup.colorId, // Can be null for size-only orders
            sizeId: breakup.sizeId,
            quantity: breakup.quantity,
        }));
        // Create work order using existing method
        const workOrder = await this.createWorkOrder({
            orderId,
            orderItemId,
            styleId: orderItem.styleId,
            locationId: null, // Location to be assigned later
            plannedStartDate: orderData.plannedStartDate,
            plannedEndDate: orderData.plannedEndDate,
            totalQuantity: orderItem.totalQuantity,
            priority: orderData.priority,
            remarks: 'Auto-created from order',
            createdById: orderData.createdById,
            colorSizeBreakup,
        });
        return workOrder;
    }
    /**
     * Split a work order into two for partial dispatch
     * Creates a new work order with the split quantities and reduces original
     */
    async splitWorkOrder(workOrderId, data, userId) {
        // Get the existing work order with breakup
        const originalWorkOrder = await prisma.work_orders.findUnique({
            where: { id: workOrderId },
            include: {
                work_order_breakup: true,
            },
        });
        if (!originalWorkOrder) {
            throw new Error('Work order not found');
        }
        if (originalWorkOrder.status !== client_1.OrderStatus.PENDING) {
            throw new Error('Can only split work orders in PENDING status');
        }
        // Validate split quantities
        let totalSplitQty = 0;
        for (const splitItem of data.breakupToSplit) {
            const originalBreakup = originalWorkOrder.work_order_breakup.find(b => b.colorId === splitItem.colorId && b.sizeId === splitItem.sizeId);
            if (!originalBreakup) {
                throw new Error(`Color/Size combination not found in original work order`);
            }
            if (splitItem.quantity > originalBreakup.plannedQuantity) {
                throw new Error(`Split quantity exceeds available quantity for color/size`);
            }
            if (splitItem.quantity <= 0) {
                continue; // Skip zero quantities
            }
            totalSplitQty += splitItem.quantity;
        }
        if (totalSplitQty <= 0) {
            throw new Error('Must specify at least some quantity to split');
        }
        if (totalSplitQty >= originalWorkOrder.totalQuantity) {
            throw new Error('Cannot split entire quantity - some must remain in original');
        }
        // Use transaction to ensure consistency
        const result = await prisma.$transaction(async (tx) => {
            // 1. Create new work order with split quantities
            const newWorkOrderNumber = await this.generateWorkOrderNumber();
            const newWorkOrder = await tx.work_orders.create({
                data: {
                    id: (0, crypto_1.randomUUID)(),
                    workOrderNumber: newWorkOrderNumber,
                    orderId: originalWorkOrder.orderId,
                    orderItemId: originalWorkOrder.orderItemId,
                    styleId: originalWorkOrder.styleId,
                    locationId: originalWorkOrder.locationId,
                    plannedStartDate: originalWorkOrder.plannedStartDate,
                    plannedEndDate: data.plannedDispatchDate,
                    totalQuantity: totalSplitQty,
                    completedQuantity: 0,
                    status: client_1.OrderStatus.PENDING,
                    priority: originalWorkOrder.priority,
                    remarks: data.remarks || `Split from ${originalWorkOrder.workOrderNumber}`,
                    createdById: userId,
                    work_order_breakup: {
                        create: data.breakupToSplit
                            .filter(item => item.quantity > 0)
                            .map(item => ({
                            id: (0, crypto_1.randomUUID)(),
                            colorId: item.colorId,
                            sizeId: item.sizeId,
                            plannedQuantity: item.quantity,
                            completedQuantity: 0,
                        })),
                    },
                },
            });
            // 2. Update original work order breakup quantities
            for (const splitItem of data.breakupToSplit) {
                if (splitItem.quantity <= 0)
                    continue;
                const originalBreakup = originalWorkOrder.work_order_breakup.find(b => b.colorId === splitItem.colorId && b.sizeId === splitItem.sizeId);
                if (originalBreakup) {
                    const newQty = originalBreakup.plannedQuantity - splitItem.quantity;
                    if (newQty > 0) {
                        await tx.work_order_breakup.update({
                            where: { id: originalBreakup.id },
                            data: { plannedQuantity: newQty },
                        });
                    }
                    else {
                        // Remove breakup entry if quantity is zero
                        await tx.work_order_breakup.delete({
                            where: { id: originalBreakup.id },
                        });
                    }
                }
            }
            // 3. Update original work order total quantity
            await tx.work_orders.update({
                where: { id: workOrderId },
                data: {
                    totalQuantity: originalWorkOrder.totalQuantity - totalSplitQty,
                },
            });
            return newWorkOrder;
        });
        // Fetch complete new work order with includes
        return await this.getWorkOrderById(result.id);
    }
    /**
     * Cancel all work orders for an order (used when order is cancelled)
     */
    async cancelWorkOrdersByOrderId(orderId) {
        const result = await prisma.work_orders.updateMany({
            where: {
                orderId,
                status: {
                    in: [client_1.OrderStatus.PENDING, client_1.OrderStatus.IN_PRODUCTION],
                },
            },
            data: {
                status: client_1.OrderStatus.CANCELLED,
            },
        });
        return { cancelled: result.count };
    }
}
exports.default = new WorkOrderService();
