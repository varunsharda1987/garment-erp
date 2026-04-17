// Processing Delivery Routes
import { Router } from 'express';
import * as processingDeliveryController from '../controllers/processingDelivery.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery } from '../middleware/validation.middleware';
import {
  createProcessingDeliverySchema,
  updateProcessingDeliverySchema,
  performQCSchema,
  acceptDeliverySchema,
  rejectDeliverySchema,
  processingDeliveryQuerySchema,
} from '../schemas/processing.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Delivery management
router.post(
  '/',
  validateBody(createProcessingDeliverySchema),
  asyncHandler(processingDeliveryController.createDelivery)
);
router.get(
  '/',
  validateQuery(processingDeliveryQuerySchema),
  asyncHandler(processingDeliveryController.getAllDeliveries)
);
router.get('/pending-qc', asyncHandler(processingDeliveryController.getPendingQCDeliveries));
router.get('/summary', asyncHandler(processingDeliveryController.getDeliverySummary));
router.get('/batch/:batchId', asyncHandler(processingDeliveryController.getDeliveriesByBatch));
router.get('/stage/:stageId', asyncHandler(processingDeliveryController.getDeliveriesByStage));
router.get('/:id', asyncHandler(processingDeliveryController.getDeliveryById));
router.put(
  '/:id',
  validateBody(updateProcessingDeliverySchema),
  asyncHandler(processingDeliveryController.updateDelivery)
);
router.post('/:id/qc', validateBody(performQCSchema), asyncHandler(processingDeliveryController.performQC));
router.post(
  '/:id/accept',
  validateBody(acceptDeliverySchema),
  asyncHandler(processingDeliveryController.acceptDelivery)
);
router.post(
  '/:id/reject',
  validateBody(rejectDeliverySchema),
  asyncHandler(processingDeliveryController.rejectDelivery)
);
router.delete('/:id', asyncHandler(processingDeliveryController.deleteDelivery));

export default router;
