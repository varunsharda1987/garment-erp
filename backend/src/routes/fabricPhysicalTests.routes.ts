import { Router } from 'express';
import {
  createFabricPhysicalTest,
  getAllFabricPhysicalTests,
  getFabricPhysicalTestById,
  updateFabricPhysicalTest,
  createRetestFabricPhysicalTest,
  approveFabricPhysicalTest,
  deleteFabricPhysicalTest,
} from '../controllers/fabricPhysicalTests.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import {
  createFabricPhysicalTestSchema,
  updateFabricPhysicalTestSchema,
  retestFabricSchema,
  approveFabricTestSchema,
  fabricPhysicalTestQuerySchema,
} from '../schemas/testing.schemas';
import { idParamSchema } from '../schemas/common.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Routes
router.post('/', validateBody(createFabricPhysicalTestSchema), asyncHandler(createFabricPhysicalTest));
router.get('/', validateQuery(fabricPhysicalTestQuerySchema), asyncHandler(getAllFabricPhysicalTests));
router.post('/retest', validateBody(retestFabricSchema), asyncHandler(createRetestFabricPhysicalTest));
router.get('/:id', validateParams(idParamSchema), asyncHandler(getFabricPhysicalTestById));
router.put(
  '/:id',
  validateParams(idParamSchema),
  validateBody(updateFabricPhysicalTestSchema),
  asyncHandler(updateFabricPhysicalTest)
);
router.post(
  '/:id/approve',
  validateParams(idParamSchema),
  validateBody(approveFabricTestSchema),
  asyncHandler(approveFabricPhysicalTest)
);
router.delete('/:id', validateParams(idParamSchema), asyncHandler(deleteFabricPhysicalTest));

export default router;
