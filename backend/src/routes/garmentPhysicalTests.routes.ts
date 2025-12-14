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
router.post('/', validateBody(createGarmentPhysicalTestSchema), createGarmentPhysicalTest);
router.get('/', validateQuery(garmentPhysicalTestQuerySchema), getAllGarmentPhysicalTests);
router.get('/:id', getGarmentPhysicalTestById);
router.put('/:id', validateBody(updateGarmentPhysicalTestSchema), updateGarmentPhysicalTest);
router.post('/retest', validateBody(retestGarmentSchema), createRetestGarmentPhysicalTest);
router.post('/:id/approve', validateBody(approveGarmentTestSchema), approveGarmentPhysicalTest);
router.post('/:id/buyer-approve', validateBody(buyerApproveGarmentTestSchema), buyerApproveGarmentPhysicalTest);
router.delete('/:id', deleteGarmentPhysicalTest);

export default router;
