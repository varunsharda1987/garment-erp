// Processing Batch Routes
import { Router } from 'express';
import * as processingBatchController from '../controllers/processingBatch.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Batch management
router.post('/', processingBatchController.createBatch);
router.get('/', processingBatchController.getAllBatches);
router.get('/summary/job-work', processingBatchController.getJobWorkSummary);
router.get('/processor/:processorId', processingBatchController.getBatchesByProcessor);
router.get('/:id', processingBatchController.getBatchById);
router.put('/:id', processingBatchController.updateBatch);
router.post('/:id/cancel', processingBatchController.cancelBatch);
router.post('/:id/complete', processingBatchController.completeBatch);

export default router;
