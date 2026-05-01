// Processing Movement Routes
import { Router } from 'express';
import * as processingMovementController from '../controllers/processingMovement.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import {
  createProcessingMovementSchema,
  updateProcessingMovementSchema,
  markAsDeliveredSchema,
  processingMovementQuerySchema,
  processingMovementIdParamSchema,
  batchIdParamSchema,
  stageIdParamSchema,
} from '../schemas/processing.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Movement management
router.post(
  '/',
  validateBody(createProcessingMovementSchema),
  asyncHandler(processingMovementController.createMovement)
);
router.get(
  '/',
  validateQuery(processingMovementQuerySchema),
  asyncHandler(processingMovementController.getAllMovements)
);
router.get('/in-transit', asyncHandler(processingMovementController.getInTransitMovements));
router.get('/summary/transit', asyncHandler(processingMovementController.getTransitSummary));
router.get(
  '/batch/:batchId',
  validateParams(batchIdParamSchema),
  asyncHandler(processingMovementController.getMovementsByBatch)
);
router.get(
  '/stage/:stageId',
  validateParams(stageIdParamSchema),
  asyncHandler(processingMovementController.getMovementsByStage)
);
router.get(
  '/:id',
  validateParams(processingMovementIdParamSchema),
  asyncHandler(processingMovementController.getMovementById)
);
router.put(
  '/:id',
  validateParams(processingMovementIdParamSchema),
  validateBody(updateProcessingMovementSchema),
  asyncHandler(processingMovementController.updateMovement)
);
router.post(
  '/:id/deliver',
  validateParams(processingMovementIdParamSchema),
  validateBody(markAsDeliveredSchema),
  asyncHandler(processingMovementController.markAsDelivered)
);
router.delete(
  '/:id',
  validateParams(processingMovementIdParamSchema),
  asyncHandler(processingMovementController.deleteMovement)
);

export default router;
