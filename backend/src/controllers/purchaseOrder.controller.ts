/**
 * Purchase Order Controller
 * RESTful API endpoints for purchase order management
 */

import { Request, Response } from 'express';
import { purchaseOrderService } from '../services/purchaseOrder.service';
import { PurchaseOrderStatus, POSource } from '@prisma/client';
import { logInfo } from '../utils/logger';
import {
  CreatePurchaseOrderDTO,
  UpdatePurchaseOrderDTO,
  PurchaseOrderItemDTO,
  UpdatePurchaseOrderItemDTO,
  PurchaseOrderFilters,
} from '../types/purchaseOrder.types';
import { updateCostSheetActuals } from '../services/costSheet.service';
import { NotFoundError, ValidationError, ConflictError, BusinessError, UnauthorizedError } from '../errors';

/**
 * @route GET /api/purchase-orders
 * @desc Get all purchase orders with filters and pagination
 * @access Private
 */
export const getAllPurchaseOrders = async (req: Request, res: Response) => {
  const {
    status,
    source,
    poCategories,
    supplierId,
    serviceWorkOrderId,
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
    source: source as POSource | undefined,
    poCategories: poCategories ? (poCategories as string).split(',') : undefined,
    supplierId: supplierId as string | undefined,
    serviceWorkOrderId: serviceWorkOrderId as string | undefined,
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
};

/**
 * @route GET /api/purchase-orders/receivable
 * @desc Get purchase orders that can receive GRN
 * @access Private
 */
export const getReceivablePurchaseOrders = async (req: Request, res: Response) => {
  const { supplierId } = req.query;

  const purchaseOrders = await purchaseOrderService.getReceivablePurchaseOrders(supplierId as string | undefined);

  res.json({
    success: true,
    data: purchaseOrders,
    count: purchaseOrders.length,
  });
};

/**
 * @route GET /api/purchase-orders/:id
 * @desc Get purchase order by ID
 * @access Private
 */
export const getPurchaseOrderById = async (req: Request, res: Response) => {
  const { id } = req.params;

  const purchaseOrder = await purchaseOrderService.getPurchaseOrderById(id);

  res.json({
    success: true,
    data: purchaseOrder,
  });
};

/**
 * @route GET /api/purchase-orders/supplier/:supplierId
 * @desc Get purchase orders by supplier
 * @access Private
 */
export const getPurchaseOrdersBySupplier = async (req: Request, res: Response) => {
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
};

/**
 * @route GET /api/purchase-orders/:id/pending-items
 * @desc Get pending items for a PO (for GRN creation)
 * @access Private
 */
export const getPendingItemsForPO = async (req: Request, res: Response) => {
  const { id } = req.params;

  const pendingItems = await purchaseOrderService.getPendingItemsForPO(id);

  res.json({
    success: true,
    data: pendingItems,
  });
};

/**
 * @route POST /api/purchase-orders
 * @desc Create a new purchase order
 * @access Private (PURCHASE, ADMIN)
 */
export const createPurchaseOrder = async (req: Request, res: Response) => {
  const data: CreatePurchaseOrderDTO = req.body;
  const userId = req.user?.userId;

  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  if (!data.supplierId) {
    throw new ValidationError('Supplier ID is required');
  }

  if (!data.expectedDeliveryDate) {
    throw new ValidationError('Expected delivery date is required');
  }

  if (!data.items || data.items.length === 0) {
    throw new ValidationError('At least one item is required');
  }

  const purchaseOrder = await purchaseOrderService.createPurchaseOrder(data, userId);

  logInfo(`Purchase order created: ${purchaseOrder.poNumber}`);

  // ==========================================
  // PHASE 2C: Auto-update cost sheet actuals
  // ==========================================
  // Note: This is a best-effort hook for PO creation
  // PO items may not always be linked to specific styles
  // (e.g., generic stock purchases)
  // If linked via requirement_po_links, actual costs will
  // be updated when GRN is approved (more accurate)
  // ==========================================

  res.status(201).json({
    success: true,
    data: purchaseOrder,
    message: 'Purchase order created successfully',
  });
};

/**
 * @route PUT /api/purchase-orders/:id
 * @desc Update a purchase order
 * @access Private (PURCHASE, ADMIN)
 */
export const updatePurchaseOrder = async (req: Request, res: Response) => {
  const { id } = req.params;
  const data: UpdatePurchaseOrderDTO = req.body;

  const purchaseOrder = await purchaseOrderService.updatePurchaseOrder(id, data);

  if (!purchaseOrder) {
    throw new NotFoundError('Purchase order', id);
  }

  logInfo(`Purchase order updated: ${purchaseOrder.poNumber}`);

  res.json({
    success: true,
    data: purchaseOrder,
    message: 'Purchase order updated successfully',
  });
};

/**
 * @route DELETE /api/purchase-orders/:id
 * @desc Delete a purchase order
 * @access Private (PURCHASE, ADMIN)
 */
export const deletePurchaseOrder = async (req: Request, res: Response) => {
  const { id } = req.params;

  const result = await purchaseOrderService.deletePurchaseOrder(id);

  logInfo(`Purchase order deleted: ${id}`);

  res.json({
    success: true,
    message: result.message,
  });
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
  const { id } = req.params;
  const item: PurchaseOrderItemDTO = req.body;

  if (!item.materialId && !item.serviceType) {
    throw new ValidationError('Either Material ID or Service Type is required');
  }

  if (!item.orderedQuantity || item.orderedQuantity <= 0) {
    throw new ValidationError('Ordered quantity must be greater than 0');
  }

  if (item.unitPrice === undefined || item.unitPrice === null || item.unitPrice < 0) {
    throw new ValidationError('Unit price must be 0 or greater');
  }

  const newItem = await purchaseOrderService.addPurchaseOrderItem(id, item);

  res.status(201).json({
    success: true,
    data: newItem,
    message: 'Item added successfully',
  });
};

/**
 * @route PUT /api/purchase-orders/:id/items/:itemId
 * @desc Update a purchase order item
 * @access Private (PURCHASE, ADMIN)
 */
export const updatePurchaseOrderItem = async (req: Request, res: Response) => {
  const { id, itemId } = req.params;
  const data: UpdatePurchaseOrderItemDTO = req.body;

  const updatedItem = await purchaseOrderService.updatePurchaseOrderItem(id, itemId, data);

  res.json({
    success: true,
    data: updatedItem,
    message: 'Item updated successfully',
  });
};

/**
 * @route DELETE /api/purchase-orders/:id/items/:itemId
 * @desc Remove an item from a purchase order
 * @access Private (PURCHASE, ADMIN)
 */
export const removePurchaseOrderItem = async (req: Request, res: Response) => {
  const { id, itemId } = req.params;

  const result = await purchaseOrderService.removePurchaseOrderItem(id, itemId);

  res.json({
    success: true,
    message: result.message,
  });
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
  const { id } = req.params;
  const userId = req.user?.userId;

  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  const purchaseOrder = await purchaseOrderService.sendPurchaseOrder(id, userId);

  logInfo(`Purchase order sent: ${purchaseOrder.poNumber}`);

  res.json({
    success: true,
    data: purchaseOrder,
    message: 'Purchase order sent successfully',
  });
};

/**
 * @route PATCH /api/purchase-orders/:id/acknowledge
 * @desc Acknowledge purchase order (SENT -> ACKNOWLEDGED)
 * @access Private
 */
export const acknowledgePurchaseOrder = async (req: Request, res: Response) => {
  const { id } = req.params;

  const purchaseOrder = await purchaseOrderService.acknowledgePurchaseOrder(id);

  logInfo(`Purchase order acknowledged: ${purchaseOrder.poNumber}`);

  res.json({
    success: true,
    data: purchaseOrder,
    message: 'Purchase order acknowledged successfully',
  });
};

/**
 * @route PATCH /api/purchase-orders/:id/cancel
 * @desc Cancel purchase order
 * @access Private (PURCHASE, ADMIN)
 */
export const cancelPurchaseOrder = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;

  const purchaseOrder = await purchaseOrderService.cancelPurchaseOrder(id, reason);

  logInfo(`Purchase order cancelled: ${purchaseOrder.poNumber}`);

  res.json({
    success: true,
    data: purchaseOrder,
    message: 'Purchase order cancelled successfully',
  });
};

/**
 * @route PATCH /api/purchase-orders/:id/delivery-location
 * @desc Amend delivery location for a purchase order
 * @access Private (PURCHASE, ADMIN)
 */
export const amendDeliveryLocation = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { deliveryLocationId } = req.body;
  const userId = (req as any).user?.id;

  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  const purchaseOrder = await purchaseOrderService.amendDeliveryLocation(id, deliveryLocationId, userId);

  logInfo(`Purchase order delivery location amended: ${purchaseOrder.poNumber}`);

  res.json({
    success: true,
    data: purchaseOrder,
    message: 'Delivery location amended successfully',
  });
};
