// Processing Movement Routes
import { Router } from 'express';
import * as processingMovementController from '../controllers/processingMovement.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Movement management
router.post('/', processingMovementController.createMovement);
router.get('/', processingMovementController.getAllMovements);
router.get('/in-transit', processingMovementController.getInTransitMovements);
router.get('/summary/transit', processingMovementController.getTransitSummary);
router.get('/batch/:batchId', processingMovementController.getMovementsByBatch);
router.get('/stage/:stageId', processingMovementController.getMovementsByStage);
router.get('/:id', processingMovementController.getMovementById);
router.put('/:id', processingMovementController.updateMovement);
router.post('/:id/deliver', processingMovementController.markAsDelivered);
router.delete('/:id', processingMovementController.deleteMovement);

export default router;
