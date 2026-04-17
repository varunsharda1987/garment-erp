import { Router } from 'express';
import { tcsController } from '../controllers/tcs.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery } from '../middleware/validation.middleware';
import { createTCSSchema, updateTCSSchema, updateTCSStatusSchema, tcsQuerySchema } from '../schemas/tcs.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

router.get('/summary', asyncHandler(tcsController.getSummary.bind(tcsController)));
router.get('/', validateQuery(tcsQuerySchema), asyncHandler(tcsController.getAll.bind(tcsController)));
router.get('/:id', asyncHandler(tcsController.getById.bind(tcsController)));
router.post('/', validateBody(createTCSSchema), asyncHandler(tcsController.create.bind(tcsController)));
router.put('/:id', validateBody(updateTCSSchema), asyncHandler(tcsController.update.bind(tcsController)));
router.put(
  '/:id/status',
  validateBody(updateTCSStatusSchema),
  asyncHandler(tcsController.updateStatus.bind(tcsController))
);
router.delete('/:id', asyncHandler(tcsController.delete.bind(tcsController)));

export default router;
