/**
 * Order BOM Routes
 * API endpoints for Order-level Bill of Materials management
 *
 * Order BOM is created after Cost Sheet approval and contains
 * order-specific quantities and prices for MRP & Production.
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import * as orderBomController from '../controllers/order-bom.controller';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// ============================================
// ORDER-LEVEL BOM ROUTES (mounted under /api/orders/:orderId/bom)
// ============================================

/**
 * @route   POST /api/orders/:orderId/bom
 * @desc    Create Order BOM from approved Cost Sheet
 * @access  Private
 * @body    { styleId: string, costSheetId: string, orderItemId?: string }
 */
router.post('/:orderId/bom', orderBomController.createFromCostSheet);

/**
 * @route   GET /api/orders/:orderId/bom
 * @desc    Get Order BOM for an order
 * @access  Private
 * @query   styleId (optional - filter by style if order has multiple styles)
 */
router.get('/:orderId/bom', orderBomController.getByOrderId);

/**
 * @route   PUT /api/orders/:orderId/bom
 * @desc    Update Order BOM items (only DRAFT status)
 * @access  Private
 * @query   styleId (optional)
 * @body    { items: OrderBOMItemInput[] }
 */
router.put('/:orderId/bom', orderBomController.updateOrderBOM);

/**
 * @route   PATCH /api/orders/:orderId/bom/approve
 * @desc    Approve Order BOM
 * @access  Private
 * @query   styleId (optional)
 */
router.patch('/:orderId/bom/approve', orderBomController.approveOrderBOM);

/**
 * @route   POST /api/orders/:orderId/bom/approve-and-calculate
 * @desc    Approve Order BOM and optionally calculate MRP
 * @access  Private
 * @body    { styleId: string, calculateMRP?: boolean, requiredDate?: Date }
 */
router.post('/:orderId/bom/approve-and-calculate', orderBomController.approveAndCalculateMRP);

/**
 * @route   POST /api/orders/:orderId/bom/calculate-mrp
 * @desc    Calculate MRP for approved Order BOM (standalone trigger)
 * @access  Private
 * @body    { styleId: string, requiredDate?: Date }
 */
router.post('/:orderId/bom/calculate-mrp', orderBomController.calculateMRPStandalone);

/**
 * @route   PATCH /api/orders/:orderId/bom/lock
 * @desc    Lock Order BOM for production
 * @access  Private
 * @query   styleId (optional)
 */
router.patch('/:orderId/bom/lock', orderBomController.lockOrderBOM);

/**
 * @route   POST /api/orders/:orderId/bom/copy/:sourceOrderId
 * @desc    Copy Order BOM from previous order (repeat orders)
 * @access  Private
 * @body    { styleId: string, orderItemId?: string, adjustQuantity?: number }
 */
router.post('/:orderId/bom/copy/:sourceOrderId', orderBomController.copyFromPreviousOrder);

/**
 * @route   GET /api/orders/:orderId/bom/requirements
 * @desc    Calculate material requirements from Order BOM
 * @access  Private
 * @query   styleId (optional)
 */
router.get('/:orderId/bom/requirements', orderBomController.calculateRequirements);

/**
 * @route   DELETE /api/orders/:orderId/bom
 * @desc    Deactivate Order BOM
 * @access  Private
 * @query   styleId (optional)
 */
router.delete('/:orderId/bom', orderBomController.deactivateOrderBOM);

// ============================================
// STANDALONE ORDER BOM ROUTES (mounted under /api/order-bom)
// ============================================

// Create a separate router for standalone routes
export const orderBomStandaloneRouter = Router();

orderBomStandaloneRouter.use(authenticateToken);

/**
 * @route   GET /api/order-bom
 * @desc    List all Order BOMs with filtering
 * @access  Private
 * @query   orderId, styleId, status, isActive, page, limit
 */
orderBomStandaloneRouter.get('/', orderBomController.listOrderBOMs);

/**
 * @route   POST /api/order-bom/cleanup-cancelled
 * @desc    Deactivate BOMs for cancelled orders (one-time cleanup)
 * @access  Private
 */
orderBomStandaloneRouter.post('/cleanup-cancelled', orderBomController.cleanupCancelledOrderBOMs);

/**
 * @route   GET /api/order-bom/:id
 * @desc    Get Order BOM by ID with full details
 * @access  Private
 */
orderBomStandaloneRouter.get('/:id', orderBomController.getById);

/**
 * @route   POST /api/order-bom/:id/change-width
 * @desc    Change fabric width on BOM items (creates new version with recalculated consumption)
 * @access  Private
 * @body    { fabricItemChanges: [{ bomItemId: string, newCadId: string }] }
 */
orderBomStandaloneRouter.post('/:id/change-width', orderBomController.changeWidth);

export default router;
