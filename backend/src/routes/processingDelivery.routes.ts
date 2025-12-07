// Processing Delivery Routes
import { Router } from 'express';
import * as processingDeliveryController from '../controllers/processingDelivery.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Delivery management
router.post('/', processingDeliveryController.createDelivery);
router.get('/', processingDeliveryController.getAllDeliveries);
router.get('/pending-qc', processingDeliveryController.getPendingQCDeliveries);
router.get('/summary', processingDeliveryController.getDeliverySummary);
router.get('/batch/:batchId', processingDeliveryController.getDeliveriesByBatch);
router.get('/stage/:stageId', processingDeliveryController.getDeliveriesByStage);
router.get('/:id', processingDeliveryController.getDeliveryById);
router.put('/:id', processingDeliveryController.updateDelivery);
router.post('/:id/qc', processingDeliveryController.performQC);
router.post('/:id/accept', processingDeliveryController.acceptDelivery);
router.post('/:id/reject', processingDeliveryController.rejectDelivery);
router.delete('/:id', processingDeliveryController.deleteDelivery);

export default router;
