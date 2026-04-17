/**
 * Purchase Order Routes
 * RESTful API routes for purchase order management
 */

import { Router } from 'express';
import {
  getAllPurchaseOrders,
  getReceivablePurchaseOrders,
  getPurchaseOrderById,
  getPurchaseOrdersBySupplier,
  getPendingItemsForPO,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  addPurchaseOrderItem,
  updatePurchaseOrderItem,
  removePurchaseOrderItem,
  sendPurchaseOrder,
  acknowledgePurchaseOrder,
  cancelPurchaseOrder,
} from '../controllers/purchaseOrder.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery } from '../middleware/validation.middleware';
import {
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  addPurchaseOrderItemSchema,
  updatePurchaseOrderItemSchema,
  cancelPurchaseOrderSchema,
  purchaseOrderQuerySchema,
} from '../schemas/purchaseOrder.schema';
import { getPOStatsController, getPOsBySourceController } from '../controllers/unified-po.controller';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// ============================================
// List & Query Routes
// ============================================

/**
 * @route   GET /api/purchase-orders
 * @desc    Get all purchase orders with filters and pagination
 * @access  Private
 */
router.get('/', validateQuery(purchaseOrderQuerySchema), asyncHandler(getAllPurchaseOrders));

/**
 * @route   GET /api/purchase-orders/receivable
 * @desc    Get purchase orders that can receive GRN (SENT, ACKNOWLEDGED, PARTIALLY_RECEIVED)
 * @access  Private
 */
router.get('/receivable', asyncHandler(getReceivablePurchaseOrders));

/**
 * @route   GET /api/purchase-orders/supplier/:supplierId
 * @desc    Get purchase orders by supplier
 * @access  Private
 */
router.get('/supplier/:supplierId', asyncHandler(getPurchaseOrdersBySupplier));

/**
 * @route   GET /api/purchase-orders/stats
 * @desc    Get PO statistics grouped by source, category, and status
 * @access  Private (ADMIN, PURCHASE, PRODUCTION_MANAGER, MERCHANDISER, ACCOUNTS)
 */
router.get(
  '/stats',
  authorize('ADMIN', 'PURCHASE', 'PRODUCTION_MANAGER', 'MERCHANDISER', 'ACCOUNTS'),
  asyncHandler(getPOStatsController)
);

/**
 * @route   GET /api/purchase-orders/by-source/:source
 * @desc    Get POs filtered by source type
 * @access  Private (ADMIN, PURCHASE, PRODUCTION_MANAGER, MERCHANDISER, ACCOUNTS)
 */
router.get(
  '/by-source/:source',
  authorize('ADMIN', 'PURCHASE', 'PRODUCTION_MANAGER', 'MERCHANDISER', 'ACCOUNTS'),
  asyncHandler(getPOsBySourceController)
);

/**
 * @route   GET /api/purchase-orders/:id
 * @desc    Get purchase order by ID with all relations
 * @access  Private
 */
router.get('/:id', asyncHandler(getPurchaseOrderById));

/**
 * @route   GET /api/purchase-orders/:id/pending-items
 * @desc    Get pending items for a PO (for GRN creation)
 * @access  Private
 */
router.get('/:id/pending-items', asyncHandler(getPendingItemsForPO));

// ============================================
// CRUD Routes
// ============================================

/**
 * @route   POST /api/purchase-orders
 * @desc    Create a new purchase order
 * @access  Private (PURCHASE, ADMIN)
 */
router.post('/', validateBody(createPurchaseOrderSchema), asyncHandler(createPurchaseOrder));

/**
 * @route   PUT /api/purchase-orders/:id
 * @desc    Update a purchase order (DRAFT only)
 * @access  Private (PURCHASE, ADMIN)
 */
router.put('/:id', validateBody(updatePurchaseOrderSchema), asyncHandler(updatePurchaseOrder));

/**
 * @route   DELETE /api/purchase-orders/:id
 * @desc    Delete a purchase order (DRAFT only)
 * @access  Private (PURCHASE, ADMIN)
 */
router.delete('/:id', asyncHandler(deletePurchaseOrder));

// ============================================
// Item Management Routes
// ============================================

/**
 * @route   POST /api/purchase-orders/:id/items
 * @desc    Add an item to a purchase order
 * @access  Private (PURCHASE, ADMIN)
 */
router.post('/:id/items', validateBody(addPurchaseOrderItemSchema), asyncHandler(addPurchaseOrderItem));

/**
 * @route   PUT /api/purchase-orders/:id/items/:itemId
 * @desc    Update a purchase order item
 * @access  Private (PURCHASE, ADMIN)
 */
router.put('/:id/items/:itemId', validateBody(updatePurchaseOrderItemSchema), asyncHandler(updatePurchaseOrderItem));

/**
 * @route   DELETE /api/purchase-orders/:id/items/:itemId
 * @desc    Remove an item from a purchase order
 * @access  Private (PURCHASE, ADMIN)
 */
router.delete('/:id/items/:itemId', asyncHandler(removePurchaseOrderItem));

// ============================================
// Status Transition Routes
// ============================================

/**
 * @route   PATCH /api/purchase-orders/:id/send
 * @desc    Send purchase order to supplier (DRAFT -> SENT)
 * @access  Private (PURCHASE, ADMIN)
 */
router.patch('/:id/send', asyncHandler(sendPurchaseOrder));

/**
 * @route   PATCH /api/purchase-orders/:id/acknowledge
 * @desc    Acknowledge purchase order (SENT -> ACKNOWLEDGED)
 * @access  Private
 */
router.patch('/:id/acknowledge', asyncHandler(acknowledgePurchaseOrder));

/**
 * @route   PATCH /api/purchase-orders/:id/cancel
 * @desc    Cancel purchase order
 * @access  Private (PURCHASE, ADMIN)
 */
router.patch('/:id/cancel', validateBody(cancelPurchaseOrderSchema), asyncHandler(cancelPurchaseOrder));

export default router;
