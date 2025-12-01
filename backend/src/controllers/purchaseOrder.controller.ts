/**
 * Purchase Order Controller
 * RESTful API endpoints for purchase order management
 */

import { Request, Response } from 'express';
import { purchaseOrderService } from '../services/purchaseOrder.service';
import { PurchaseOrderStatus } from '@prisma/client';
import { logInfo, logError } from '../utils/logger';
import {
  CreatePurchaseOrderDTO,
  UpdatePurchaseOrderDTO,
  PurchaseOrderItemDTO,
  UpdatePurchaseOrderItemDTO,
  PurchaseOrderFilters,
} from '../types/purchaseOrder.types';

/**
 * @route GET /api/purchase-orders
 * @desc Get all purchase orders with filters and pagination
 * @access Private
 */
export const getAllPurchaseOrders = async (req: Request, res: Response) => {
  try {
    const {
      status,
      supplierId,
      search,
      startDate,
      endDate,
      page,
      limit,
      sortBy,
      sortOrder,
    } = req.query;

    const filters: PurchaseOrderFilters = {
      status: status as PurchaseOrderStatus | undefined,
      supplierId: supplierId as string | undefined,
      search: search as string | undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      sortBy: sortBy as string | undefined,
      sortOrder: sortOrder as 'asc' | 'desc' | undefined,
    };

    const result = await purchaseOrderService.getAllPurchaseOrders(filters);

    res.json({
      success: true,
      ...result,
    });
  } catch (error: unknown) {
    logError('Get all purchase orders error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch purchase orders',
    });
  }
};

/**
 * @route GET /api/purchase-orders/receivable
 * @desc Get purchase orders that can receive GRN
 * @access Private
 */
export const getReceivablePurchaseOrders = async (req: Request, res: Response) => {
  try {
    const { supplierId } = req.query;

    const purchaseOrders = await purchaseOrderService.getReceivablePurchaseOrders(
      supplierId as string | undefined
    );

    res.json({
      success: true,
      data: purchaseOrders,
      count: purchaseOrders.length,
    });
  } catch (error: unknown) {
    logError('Get receivable purchase orders error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch receivable purchase orders',
    });
  }
};

/**
 * @route GET /api/purchase-orders/:id
 * @desc Get purchase order by ID
 * @access Private
 */
export const getPurchaseOrderById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const purchaseOrder = await purchaseOrderService.getPurchaseOrderById(id);

    res.json({
      success: true,
      data: purchaseOrder,
    });
  } catch (error: unknown) {
    logError('Get purchase order by ID error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch purchase order';
    const statusCode = errorMessage.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
    });
  }
};

/**
 * @route GET /api/purchase-orders/supplier/:supplierId
 * @desc Get purchase orders by supplier
 * @access Private
 */
export const getPurchaseOrdersBySupplier = async (req: Request, res: Response) => {
  try {
    const { supplierId } = req.params;
    const { status, search, startDate, endDate, page, limit } = req.query;

    const filters: PurchaseOrderFilters = {
      status: status as PurchaseOrderStatus | undefined,
      search: search as string | undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    };

    const result = await purchaseOrderService.getPurchaseOrdersBySupplier(supplierId, filters);

    res.json({
      success: true,
      ...result,
    });
  } catch (error: unknown) {
    logError('Get purchase orders by supplier error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch purchase orders',
    });
  }
};

/**
 * @route GET /api/purchase-orders/:id/pending-items
 * @desc Get pending items for a PO (for GRN creation)
 * @access Private
 */
export const getPendingItemsForPO = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const pendingItems = await purchaseOrderService.getPendingItemsForPO(id);

    res.json({
      success: true,
      data: pendingItems,
    });
  } catch (error: unknown) {
    logError('Get pending items for PO error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch pending items';
    const statusCode = errorMessage.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
    });
  }
};

/**
 * @route POST /api/purchase-orders
 * @desc Create a new purchase order
 * @access Private (PURCHASE, ADMIN)
 */
export const createPurchaseOrder = async (req: Request, res: Response) => {
  try {
    const data: CreatePurchaseOrderDTO = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    if (!data.supplierId) {
      return res.status(400).json({
        success: false,
        message: 'Supplier ID is required',
      });
    }

    if (!data.expectedDeliveryDate) {
      return res.status(400).json({
        success: false,
        message: 'Expected delivery date is required',
      });
    }

    if (!data.items || data.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one item is required',
      });
    }

    const purchaseOrder = await purchaseOrderService.createPurchaseOrder(data, userId);

    logInfo(`Purchase order created: ${purchaseOrder.poNumber}`);

    res.status(201).json({
      success: true,
      data: purchaseOrder,
      message: 'Purchase order created successfully',
    });
  } catch (error: unknown) {
    logError('Create purchase order error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create purchase order';
    const statusCode = errorMessage.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
    });
  }
};

/**
 * @route PUT /api/purchase-orders/:id
 * @desc Update a purchase order
 * @access Private (PURCHASE, ADMIN)
 */
export const updatePurchaseOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data: UpdatePurchaseOrderDTO = req.body;

    const purchaseOrder = await purchaseOrderService.updatePurchaseOrder(id, data);

    logInfo(`Purchase order updated: ${purchaseOrder.poNumber}`);

    res.json({
      success: true,
      data: purchaseOrder,
      message: 'Purchase order updated successfully',
    });
  } catch (error: unknown) {
    logError('Update purchase order error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update purchase order';
    const statusCode = errorMessage.includes('not found')
      ? 404
      : errorMessage.includes('DRAFT')
      ? 400
      : 500;
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
    });
  }
};

/**
 * @route DELETE /api/purchase-orders/:id
 * @desc Delete a purchase order
 * @access Private (PURCHASE, ADMIN)
 */
export const deletePurchaseOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await purchaseOrderService.deletePurchaseOrder(id);

    logInfo(`Purchase order deleted: ${id}`);

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error: unknown) {
    logError('Delete purchase order error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete purchase order';
    const statusCode = errorMessage.includes('not found')
      ? 404
      : errorMessage.includes('DRAFT')
      ? 400
      : 500;
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
    });
  }
};

// ============================================
// Item Management Endpoints
// ============================================

/**
 * @route POST /api/purchase-orders/:id/items
 * @desc Add an item to a purchase order
 * @access Private (PURCHASE, ADMIN)
 */
export const addPurchaseOrderItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const item: PurchaseOrderItemDTO = req.body;

    if (!item.materialId) {
      return res.status(400).json({
        success: false,
        message: 'Material ID is required',
      });
    }

    if (!item.orderedQuantity || item.orderedQuantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Ordered quantity must be greater than 0',
      });
    }

    if (!item.unitPrice || item.unitPrice < 0) {
      return res.status(400).json({
        success: false,
        message: 'Unit price must be 0 or greater',
      });
    }

    const newItem = await purchaseOrderService.addPurchaseOrderItem(id, item);

    res.status(201).json({
      success: true,
      data: newItem,
      message: 'Item added successfully',
    });
  } catch (error: unknown) {
    logError('Add purchase order item error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to add item';
    const statusCode = errorMessage.includes('not found')
      ? 404
      : errorMessage.includes('DRAFT')
      ? 400
      : 500;
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
    });
  }
};

/**
 * @route PUT /api/purchase-orders/:id/items/:itemId
 * @desc Update a purchase order item
 * @access Private (PURCHASE, ADMIN)
 */
export const updatePurchaseOrderItem = async (req: Request, res: Response) => {
  try {
    const { id, itemId } = req.params;
    const data: UpdatePurchaseOrderItemDTO = req.body;

    const updatedItem = await purchaseOrderService.updatePurchaseOrderItem(id, itemId, data);

    res.json({
      success: true,
      data: updatedItem,
      message: 'Item updated successfully',
    });
  } catch (error: unknown) {
    logError('Update purchase order item error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update item';
    const statusCode = errorMessage.includes('not found')
      ? 404
      : errorMessage.includes('DRAFT')
      ? 400
      : 500;
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
    });
  }
};

/**
 * @route DELETE /api/purchase-orders/:id/items/:itemId
 * @desc Remove an item from a purchase order
 * @access Private (PURCHASE, ADMIN)
 */
export const removePurchaseOrderItem = async (req: Request, res: Response) => {
  try {
    const { id, itemId } = req.params;

    const result = await purchaseOrderService.removePurchaseOrderItem(id, itemId);

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error: unknown) {
    logError('Remove purchase order item error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to remove item';
    const statusCode = errorMessage.includes('not found')
      ? 404
      : errorMessage.includes('DRAFT')
      ? 400
      : 500;
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
    });
  }
};

// ============================================
// Status Transition Endpoints
// ============================================

/**
 * @route PATCH /api/purchase-orders/:id/send
 * @desc Send purchase order to supplier (DRAFT -> SENT)
 * @access Private (PURCHASE, ADMIN)
 */
export const sendPurchaseOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const purchaseOrder = await purchaseOrderService.sendPurchaseOrder(id, userId);

    logInfo(`Purchase order sent: ${purchaseOrder.poNumber}`);

    res.json({
      success: true,
      data: purchaseOrder,
      message: 'Purchase order sent successfully',
    });
  } catch (error: unknown) {
    logError('Send purchase order error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to send purchase order';
    const statusCode = errorMessage.includes('not found')
      ? 404
      : errorMessage.includes('DRAFT') || errorMessage.includes('no items')
      ? 400
      : 500;
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
    });
  }
};

/**
 * @route PATCH /api/purchase-orders/:id/acknowledge
 * @desc Acknowledge purchase order (SENT -> ACKNOWLEDGED)
 * @access Private
 */
export const acknowledgePurchaseOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const purchaseOrder = await purchaseOrderService.acknowledgePurchaseOrder(id);

    logInfo(`Purchase order acknowledged: ${purchaseOrder.poNumber}`);

    res.json({
      success: true,
      data: purchaseOrder,
      message: 'Purchase order acknowledged successfully',
    });
  } catch (error: unknown) {
    logError('Acknowledge purchase order error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to acknowledge purchase order';
    const statusCode = errorMessage.includes('not found')
      ? 404
      : errorMessage.includes('SENT')
      ? 400
      : 500;
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
    });
  }
};

/**
 * @route PATCH /api/purchase-orders/:id/cancel
 * @desc Cancel purchase order
 * @access Private (PURCHASE, ADMIN)
 */
export const cancelPurchaseOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const purchaseOrder = await purchaseOrderService.cancelPurchaseOrder(id, reason);

    logInfo(`Purchase order cancelled: ${purchaseOrder.poNumber}`);

    res.json({
      success: true,
      data: purchaseOrder,
      message: 'Purchase order cancelled successfully',
    });
  } catch (error: unknown) {
    logError('Cancel purchase order error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to cancel purchase order';
    const statusCode = errorMessage.includes('not found')
      ? 404
      : errorMessage.includes('Cannot cancel')
      ? 400
      : 500;
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
    });
  }
};
