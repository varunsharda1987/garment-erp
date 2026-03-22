// Processing Movement Routes
import { Router } from 'express';
import * as processingMovementController from '../controllers/processingMovement.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Movement management
router.post('/', asyncHandler(processingMovementController.createMovement));
router.get('/', asyncHandler(processingMovementController.getAllMovements));
router.get('/in-transit', asyncHandler(processingMovementController.getInTransitMovements));
router.get('/summary/transit', asyncHandler(processingMovementController.getTransitSummary));
router.get('/batch/:batchId', asyncHandler(processingMovementController.getMovementsByBatch));
router.get('/stage/:stageId', asyncHandler(processingMovementController.getMovementsByStage));
router.get('/:id', asyncHandler(processingMovementController.getMovementById));
router.put('/:id', asyncHandler(processingMovementController.updateMovement));
router.post('/:id/deliver', asyncHandler(processingMovementController.markAsDelivered));
router.delete('/:id', asyncHandler(processingMovementController.deleteMovement));

export default router;
