import { Router } from 'express';
import { tdsController } from '../controllers/tds.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { UserRole } from '@prisma/client';
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
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.ACCOUNTS),
  validateBody(createTDSSchema),
  asyncHandler(tdsController.create.bind(tdsController))
);
router.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.ACCOUNTS),
  validateParams(idParamSchema),
  validateBody(updateTDSSchema),
  asyncHandler(tdsController.update.bind(tdsController))
);
router.put(
  '/:id/status',
  authorize(UserRole.ADMIN, UserRole.ACCOUNTS),
  validateParams(idParamSchema),
  validateBody(updateTDSStatusSchema),
  asyncHandler(tdsController.updateStatus.bind(tdsController))
);
router.delete(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.ACCOUNTS),
  validateParams(idParamSchema),
  asyncHandler(tdsController.delete.bind(tdsController))
);

export default router;
