import { Router } from 'express';
import { saleOrderController } from '../controllers/saleOrder.controller';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

// GET /api/sale-orders/search - Search for dropdown (must be before /:id)
router.get('/search', asyncHandler(saleOrderController.search.bind(saleOrderController)));

// GET /api/sale-orders/available-stock - Get available FG stock for allocation
router.get('/available-stock', asyncHandler(saleOrderController.getAvailableStock.bind(saleOrderController)));

// GET /api/sale-orders - Get all with pagination
router.get('/', asyncHandler(saleOrderController.getAll.bind(saleOrderController)));

// GET /api/sale-orders/:id - Get by ID
router.get('/:id', asyncHandler(saleOrderController.getById.bind(saleOrderController)));

// POST /api/sale-orders - Create new
router.post('/', asyncHandler(saleOrderController.create.bind(saleOrderController)));

// PUT /api/sale-orders/:id - Update
router.put('/:id', asyncHandler(saleOrderController.update.bind(saleOrderController)));

// DELETE /api/sale-orders/:id - Delete
router.delete('/:id', asyncHandler(saleOrderController.delete.bind(saleOrderController)));

// POST /api/sale-orders/:id/confirm - Confirm sale order
router.post('/:id/confirm', asyncHandler(saleOrderController.confirm.bind(saleOrderController)));

// POST /api/sale-orders/allocate-stock - Allocate FG stock to sale order item
router.post('/allocate-stock', asyncHandler(saleOrderController.allocateStock.bind(saleOrderController)));

export default router;
