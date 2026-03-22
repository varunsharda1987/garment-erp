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
import { validateBody, validateQuery } from '../middleware/validation.middleware';
import {
  createGarmentPhysicalTestSchema,
  updateGarmentPhysicalTestSchema,
  retestGarmentSchema,
  approveGarmentTestSchema,
  buyerApproveGarmentTestSchema,
  garmentPhysicalTestQuerySchema,
} from '../schemas/testing.schemas';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Routes
router.post('/', validateBody(createGarmentPhysicalTestSchema), asyncHandler(createGarmentPhysicalTest));
router.get('/', validateQuery(garmentPhysicalTestQuerySchema), asyncHandler(getAllGarmentPhysicalTests));
router.get('/:id', asyncHandler(getGarmentPhysicalTestById));
router.put('/:id', validateBody(updateGarmentPhysicalTestSchema), asyncHandler(updateGarmentPhysicalTest));
router.post('/retest', validateBody(retestGarmentSchema), asyncHandler(createRetestGarmentPhysicalTest));
router.post('/:id/approve', validateBody(approveGarmentTestSchema), asyncHandler(approveGarmentPhysicalTest));
router.post(
  '/:id/buyer-approve',
  validateBody(buyerApproveGarmentTestSchema),
  asyncHandler(buyerApproveGarmentPhysicalTest)
);
router.delete('/:id', asyncHandler(deleteGarmentPhysicalTest));

export default router;
