import { Router } from 'express';
import { saleOrderController } from '../controllers/saleOrder.controller';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import {
  createSaleOrderSchema,
  updateSaleOrderSchema,
  confirmSaleOrderSchema,
  allocateStockSchema,
  saleOrderQuerySchema,
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

// POST /api/sale-orders/allocate-stock - Allocate FG stock to sale order item
router.post(
  '/allocate-stock',
  validateBody(allocateStockSchema),
  asyncHandler(saleOrderController.allocateStock.bind(saleOrderController))
);

export default router;
