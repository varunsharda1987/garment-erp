// Processing Delivery Routes
import { Router } from 'express';
import * as processingDeliveryController from '../controllers/processingDelivery.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { UserRole } from '@prisma/client';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import {
  createProcessingDeliverySchema,
  updateProcessingDeliverySchema,
  performQCSchema,
  acceptDeliverySchema,
  rejectDeliverySchema,
  processingDeliveryQuerySchema,
  processingDeliveryIdParamSchema,
  batchIdParamSchema,
  stageIdParamSchema,
} from '../schemas/processing.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Phase 5b: batches are FROZEN pending stage-JWO wiring — mutations are role-gated
// (these routes previously had NO role check at all)
const mutatingAuthorize = authorize(UserRole.ADMIN, UserRole.PRODUCTION_MANAGER, UserRole.FACTORY_SUPERVISOR);
router.use((req, res, next) => (req.method === 'GET' ? next() : mutatingAuthorize(req, res, next)));

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
router.get(
  '/batch/:batchId',
  validateParams(batchIdParamSchema),
  asyncHandler(processingDeliveryController.getDeliveriesByBatch)
);
router.get(
  '/stage/:stageId',
  validateParams(stageIdParamSchema),
  asyncHandler(processingDeliveryController.getDeliveriesByStage)
);
router.get(
  '/:id',
  validateParams(processingDeliveryIdParamSchema),
  asyncHandler(processingDeliveryController.getDeliveryById)
);
router.put(
  '/:id',
  validateParams(processingDeliveryIdParamSchema),
  validateBody(updateProcessingDeliverySchema),
  asyncHandler(processingDeliveryController.updateDelivery)
);
router.post(
  '/:id/qc',
  validateParams(processingDeliveryIdParamSchema),
  validateBody(performQCSchema),
  asyncHandler(processingDeliveryController.performQC)
);
router.post(
  '/:id/accept',
  validateParams(processingDeliveryIdParamSchema),
  validateBody(acceptDeliverySchema),
  asyncHandler(processingDeliveryController.acceptDelivery)
);
router.post(
  '/:id/reject',
  validateParams(processingDeliveryIdParamSchema),
  validateBody(rejectDeliverySchema),
  asyncHandler(processingDeliveryController.rejectDelivery)
);
router.delete(
  '/:id',
  validateParams(processingDeliveryIdParamSchema),
  asyncHandler(processingDeliveryController.deleteDelivery)
);

export default router;
