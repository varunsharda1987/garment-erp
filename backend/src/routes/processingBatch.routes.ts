// Processing Batch Routes
import { Router } from 'express';
import * as processingBatchController from '../controllers/processingBatch.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateParams } from '../middleware/validation.middleware';
import { processingBatchIdParamSchema, processorIdParamSchema } from '../schemas/processing.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Batch management
router.post('/', asyncHandler(processingBatchController.createBatch));
router.get('/', asyncHandler(processingBatchController.getAllBatches));
router.get('/summary/job-work', asyncHandler(processingBatchController.getJobWorkSummary));
router.get(
  '/processor/:processorId',
  validateParams(processorIdParamSchema),
  asyncHandler(processingBatchController.getBatchesByProcessor)
);
router.get('/:id', validateParams(processingBatchIdParamSchema), asyncHandler(processingBatchController.getBatchById));
router.put('/:id', validateParams(processingBatchIdParamSchema), asyncHandler(processingBatchController.updateBatch));
router.post(
  '/:id/cancel',
  validateParams(processingBatchIdParamSchema),
  asyncHandler(processingBatchController.cancelBatch)
);
router.post(
  '/:id/complete',
  validateParams(processingBatchIdParamSchema),
  asyncHandler(processingBatchController.completeBatch)
);

export default router;
