import { Router } from 'express';
import { saleOrderController } from '../controllers/saleOrder.controller';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import {
  createSaleOrderSchema,
  updateSaleOrderSchema,
  confirmSaleOrderSchema,
  startProductionSchema,
  allocateStockSchema,
  deallocateStockSchema,
  saleOrderQuerySchema,
  addBuyerPoSchema,
} from '../schemas/saleOrder.schema';
import { authenticateToken } from '../middleware/auth.middleware';
import { idParamSchema } from '../schemas/common.schema';

const router = Router();

// Apply authentication to all sale order routes
router.use(authenticateToken);

// GET /api/sale-orders/search - Search for dropdown (must be before /:id)
router.get('/search', asyncHandler(saleOrderController.search.bind(saleOrderController)));

// GET /api/sale-orders/available-stock - Get available FG stock for allocation
router.get('/available-stock', asyncHandler(saleOrderController.getAvailableStock.bind(saleOrderController)));

// GET /api/sale-orders - Get all with pagination
router.get(
  '/',
  validateQuery(saleOrderQuerySchema),
  asyncHandler(saleOrderController.getAll.bind(saleOrderController))
);

// GET /api/sale-orders/:id/stock-preview - Get stock availability preview before confirmation
router.get(
  '/:id/stock-preview',
  validateParams(idParamSchema),
  asyncHandler(saleOrderController.getStockPreview.bind(saleOrderController))
);

// GET /api/sale-orders/:id - Get by ID
router.get('/:id', validateParams(idParamSchema), asyncHandler(saleOrderController.getById.bind(saleOrderController)));

// POST /api/sale-orders - Create new
router.post(
  '/',
  validateBody(createSaleOrderSchema),
  asyncHandler(saleOrderController.create.bind(saleOrderController))
);

// PUT /api/sale-orders/:id - Update
router.put(
  '/:id',
  validateParams(idParamSchema),
  validateBody(updateSaleOrderSchema),
  asyncHandler(saleOrderController.update.bind(saleOrderController))
);

// DELETE /api/sale-orders/:id - Delete
router.delete(
  '/:id',
  validateParams(idParamSchema),
  asyncHandler(saleOrderController.delete.bind(saleOrderController))
);

// POST /api/sale-orders/:id/confirm - Confirm sale order
router.post(
  '/:id/confirm',
  validateParams(idParamSchema),
  validateBody(confirmSaleOrderSchema),
  asyncHandler(saleOrderController.confirm.bind(saleOrderController))
);

// POST /api/sale-orders/:id/start-production - Create linked production order (make-to-order)
router.post(
  '/:id/start-production',
  validateParams(idParamSchema),
  validateBody(startProductionSchema),
  asyncHandler(saleOrderController.startProduction.bind(saleOrderController))
);

// POST /api/sale-orders/allocate-stock - Allocate FG stock to sale order item
router.post(
  '/allocate-stock',
  validateBody(allocateStockSchema),
  asyncHandler(saleOrderController.allocateStock.bind(saleOrderController))
);

// POST /api/sale-orders/deallocate-stock - Release FG stock allocation (P7.2)
router.post(
  '/deallocate-stock',
  validateBody(deallocateStockSchema),
  asyncHandler(saleOrderController.deallocate.bind(saleOrderController))
);

// POST /api/sale-orders/:id/cancel - Cancel sale order and release all allocations (P7.2) // no-body
router.post(
  '/:id/cancel',
  validateParams(idParamSchema),
  asyncHandler(saleOrderController.cancel.bind(saleOrderController))
);

// === Buyer PO Management ===

// POST /api/sale-orders/:id/buyer-pos - Add a buyer PO to a sale order
router.post(
  '/:id/buyer-pos',
  validateParams(idParamSchema),
  validateBody(addBuyerPoSchema),
  asyncHandler(saleOrderController.addBuyerPo.bind(saleOrderController))
);

// DELETE /api/sale-orders/buyer-pos/:poId - Remove a buyer PO
router.delete('/buyer-pos/:poId', asyncHandler(saleOrderController.removeBuyerPo.bind(saleOrderController)));

// POST /api/sale-orders/buyer-pos/:poId/set-primary - Set a buyer PO as primary
// no-body — action route, no payload needed
router.post(
  '/buyer-pos/:poId/set-primary',
  asyncHandler(saleOrderController.setPrimaryBuyerPo.bind(saleOrderController))
);

export default router;
