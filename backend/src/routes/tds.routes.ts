import { Router } from 'express';
import { tdsController } from '../controllers/tds.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import { createTDSSchema, updateTDSSchema, updateTDSStatusSchema, tdsQuerySchema } from '../schemas/tds.schema';
import { idParamSchema } from '../schemas/common.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

router.get('/summary', asyncHandler(tdsController.getSummary.bind(tdsController)));
router.get('/', validateQuery(tdsQuerySchema), asyncHandler(tdsController.getAll.bind(tdsController)));
router.get('/:id', validateParams(idParamSchema), asyncHandler(tdsController.getById.bind(tdsController)));
router.post('/', validateBody(createTDSSchema), asyncHandler(tdsController.create.bind(tdsController)));
router.put(
  '/:id',
  validateParams(idParamSchema),
  validateBody(updateTDSSchema),
  asyncHandler(tdsController.update.bind(tdsController))
);
router.put(
  '/:id/status',
  validateParams(idParamSchema),
  validateBody(updateTDSStatusSchema),
  asyncHandler(tdsController.updateStatus.bind(tdsController))
);
router.delete('/:id', validateParams(idParamSchema), asyncHandler(tdsController.delete.bind(tdsController)));

export default router;
