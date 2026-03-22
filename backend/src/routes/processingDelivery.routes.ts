// Processing Delivery Routes
import { Router } from 'express';
import * as processingDeliveryController from '../controllers/processingDelivery.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Delivery management
router.post('/', asyncHandler(processingDeliveryController.createDelivery));
router.get('/', asyncHandler(processingDeliveryController.getAllDeliveries));
router.get('/pending-qc', asyncHandler(processingDeliveryController.getPendingQCDeliveries));
router.get('/summary', asyncHandler(processingDeliveryController.getDeliverySummary));
router.get('/batch/:batchId', asyncHandler(processingDeliveryController.getDeliveriesByBatch));
router.get('/stage/:stageId', asyncHandler(processingDeliveryController.getDeliveriesByStage));
router.get('/:id', asyncHandler(processingDeliveryController.getDeliveryById));
router.put('/:id', asyncHandler(processingDeliveryController.updateDelivery));
router.post('/:id/qc', asyncHandler(processingDeliveryController.performQC));
router.post('/:id/accept', asyncHandler(processingDeliveryController.acceptDelivery));
router.post('/:id/reject', asyncHandler(processingDeliveryController.rejectDelivery));
router.delete('/:id', asyncHandler(processingDeliveryController.deleteDelivery));

export default router;
