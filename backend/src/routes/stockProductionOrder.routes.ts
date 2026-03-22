import { Router } from 'express';
import { stockProductionOrderController } from '../controllers/stockProductionOrder.controller';

const router = Router();

// GET /api/stock-production-orders/search - Search for dropdown (must be before /:id)
router.get('/search', stockProductionOrderController.search.bind(stockProductionOrderController));

// GET /api/stock-production-orders - Get all with pagination
router.get('/', stockProductionOrderController.getAll.bind(stockProductionOrderController));

// GET /api/stock-production-orders/:id - Get by ID
router.get('/:id', stockProductionOrderController.getById.bind(stockProductionOrderController));

// POST /api/stock-production-orders - Create new
router.post('/', stockProductionOrderController.create.bind(stockProductionOrderController));

// PUT /api/stock-production-orders/:id - Update
router.put('/:id', stockProductionOrderController.update.bind(stockProductionOrderController));

// DELETE /api/stock-production-orders/:id - Delete
router.delete('/:id', stockProductionOrderController.delete.bind(stockProductionOrderController));

// POST /api/stock-production-orders/:id/approve - Approve SPO
router.post('/:id/approve', stockProductionOrderController.approve.bind(stockProductionOrderController));

// POST /api/stock-production-orders/:id/generate-work-orders - Generate work orders
router.post('/:id/generate-work-orders', stockProductionOrderController.generateWorkOrders.bind(stockProductionOrderController));

export default router;
