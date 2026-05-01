import { Router } from 'express';
import {
  createGarmentPhysicalTest,
  getAllGarmentPhysicalTests,
  getGarmentPhysicalTestById,
  updateGarmentPhysicalTest,
  createRetestGarmentPhysicalTest,
  approveGarmentPhysicalTest,
  buyerApproveGarmentPhysicalTest,
  deleteGarmentPhysicalTest,
} from '../controllers/garmentPhysicalTests.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import {
  createGarmentPhysicalTestSchema,
  updateGarmentPhysicalTestSchema,
  retestGarmentSchema,
  approveGarmentTestSchema,
  buyerApproveGarmentTestSchema,
  garmentPhysicalTestQuerySchema,
} from '../schemas/testing.schemas';
import { idParamSchema } from '../schemas/common.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Routes
router.post('/', validateBody(createGarmentPhysicalTestSchema), asyncHandler(createGarmentPhysicalTest));
router.get('/', validateQuery(garmentPhysicalTestQuerySchema), asyncHandler(getAllGarmentPhysicalTests));
router.get('/:id', validateParams(idParamSchema), asyncHandler(getGarmentPhysicalTestById));
router.put(
  '/:id',
  validateParams(idParamSchema),
  validateBody(updateGarmentPhysicalTestSchema),
  asyncHandler(updateGarmentPhysicalTest)
);
router.post('/retest', validateBody(retestGarmentSchema), asyncHandler(createRetestGarmentPhysicalTest));
router.post(
  '/:id/approve',
  validateParams(idParamSchema),
  validateBody(approveGarmentTestSchema),
  asyncHandler(approveGarmentPhysicalTest)
);
router.post(
  '/:id/buyer-approve',
  validateParams(idParamSchema),
  validateBody(buyerApproveGarmentTestSchema),
  asyncHandler(buyerApproveGarmentPhysicalTest)
);
router.delete('/:id', validateParams(idParamSchema), asyncHandler(deleteGarmentPhysicalTest));

export default router;
