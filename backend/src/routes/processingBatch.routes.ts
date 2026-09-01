// Processing Batch Routes
import { Router } from 'express';
import * as processingBatchController from '../controllers/processingBatch.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { UserRole } from '@prisma/client';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateParams } from '../middleware/validation.middleware';
import {
  processingBatchIdParamSchema,
  processorIdParamSchema,
  createProcessingBatchSchema,
  updateProcessingBatchSchema,
  receiveProcessedLaceSchema,
} from '../schemas/processing.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Phase 5b: batches are FROZEN pending stage-JWO wiring — mutations are role-gated
// (these routes previously had NO role check at all)
const mutatingAuthorize = authorize(UserRole.ADMIN, UserRole.PRODUCTION_MANAGER, UserRole.FACTORY_SUPERVISOR);
router.use((req, res, next) => (req.method === 'GET' ? next() : mutatingAuthorize(req, res, next)));

// Batch management
router.post('/', validateBody(createProcessingBatchSchema), asyncHandler(processingBatchController.createBatch));
router.get('/', asyncHandler(processingBatchController.getAllBatches));
router.get('/summary/job-work', asyncHandler(processingBatchController.getJobWorkSummary));
router.get(
  '/processor/:processorId',
  validateParams(processorIdParamSchema),
  asyncHandler(processingBatchController.getBatchesByProcessor)
);
router.get('/:id', validateParams(processingBatchIdParamSchema), asyncHandler(processingBatchController.getBatchById));
router.put(
  '/:id',
  validateParams(processingBatchIdParamSchema),
  validateBody(updateProcessingBatchSchema),
  asyncHandler(processingBatchController.updateBatch)
);
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

// Receive dyed lace back from the processor — books it into stock under the DYED master and
// syncs stock_levels. Closes the greige→dyed loop for lace.
router.post(
  '/:id/receive-lace',
  validateParams(processingBatchIdParamSchema),
  validateBody(receiveProcessedLaceSchema),
  asyncHandler(processingBatchController.receiveLace)
);

export default router;
