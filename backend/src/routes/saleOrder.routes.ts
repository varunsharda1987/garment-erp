import { Router } from 'express';
import { saleOrderController } from '../controllers/saleOrder.controller';

const router = Router();

// GET /api/sale-orders/search - Search for dropdown (must be before /:id)
router.get('/search', saleOrderController.search.bind(saleOrderController));

// GET /api/sale-orders/available-stock - Get available FG stock for allocation
router.get('/available-stock', saleOrderController.getAvailableStock.bind(saleOrderController));

// GET /api/sale-orders - Get all with pagination
router.get('/', saleOrderController.getAll.bind(saleOrderController));

// GET /api/sale-orders/:id - Get by ID
router.get('/:id', saleOrderController.getById.bind(saleOrderController));

// POST /api/sale-orders - Create new
router.post('/', saleOrderController.create.bind(saleOrderController));

// PUT /api/sale-orders/:id - Update
router.put('/:id', saleOrderController.update.bind(saleOrderController));

// DELETE /api/sale-orders/:id - Delete
router.delete('/:id', saleOrderController.delete.bind(saleOrderController));

// POST /api/sale-orders/:id/confirm - Confirm sale order
router.post('/:id/confirm', saleOrderController.confirm.bind(saleOrderController));

// POST /api/sale-orders/allocate-stock - Allocate FG stock to sale order item
router.post('/allocate-stock', saleOrderController.allocateStock.bind(saleOrderController));

export default router;
