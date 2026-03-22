// Processing Batch Routes
import { Router } from 'express';
import * as processingBatchController from '../controllers/processingBatch.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Batch management
router.post('/', asyncHandler(processingBatchController.createBatch));
router.get('/', asyncHandler(processingBatchController.getAllBatches));
router.get('/summary/job-work', asyncHandler(processingBatchController.getJobWorkSummary));
router.get('/processor/:processorId', asyncHandler(processingBatchController.getBatchesByProcessor));
router.get('/:id', asyncHandler(processingBatchController.getBatchById));
router.put('/:id', asyncHandler(processingBatchController.updateBatch));
router.post('/:id/cancel', asyncHandler(processingBatchController.cancelBatch));
router.post('/:id/complete', asyncHandler(processingBatchController.completeBatch));

export default router;
