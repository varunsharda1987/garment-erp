import { Router } from 'express';
import { tcsController } from '../controllers/tcs.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import { createTCSSchema, updateTCSSchema, updateTCSStatusSchema, tcsQuerySchema } from '../schemas/tcs.schema';
import { idParamSchema } from '../schemas/common.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

router.get('/summary', asyncHandler(tcsController.getSummary.bind(tcsController)));
router.get('/', validateQuery(tcsQuerySchema), asyncHandler(tcsController.getAll.bind(tcsController)));
router.get('/:id', validateParams(idParamSchema), asyncHandler(tcsController.getById.bind(tcsController)));
router.post('/', validateBody(createTCSSchema), asyncHandler(tcsController.create.bind(tcsController)));
router.put(
  '/:id',
  validateParams(idParamSchema),
  validateBody(updateTCSSchema),
  asyncHandler(tcsController.update.bind(tcsController))
);
router.put(
  '/:id/status',
  validateParams(idParamSchema),
  validateBody(updateTCSStatusSchema),
  asyncHandler(tcsController.updateStatus.bind(tcsController))
);
router.delete('/:id', validateParams(idParamSchema), asyncHandler(tcsController.delete.bind(tcsController)));

export default router;
