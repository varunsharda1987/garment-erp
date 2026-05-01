import { Router } from 'express';
import {
  createTestingLab,
  getAllTestingLabs,
  getTestingLabById,
  updateTestingLab,
  deleteTestingLab,
  getLabStats,
} from '../controllers/testingLabs.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import { createTestingLabSchema, updateTestingLabSchema, testingLabQuerySchema } from '../schemas/testing.schemas';
import { idParamSchema } from '../schemas/common.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Routes
router.post('/', validateBody(createTestingLabSchema), asyncHandler(createTestingLab));
router.get('/', validateQuery(testingLabQuerySchema), asyncHandler(getAllTestingLabs));
router.get('/:id', validateParams(idParamSchema), asyncHandler(getTestingLabById));
router.get('/:id/stats', validateParams(idParamSchema), asyncHandler(getLabStats));
router.put('/:id', validateParams(idParamSchema), validateBody(updateTestingLabSchema), asyncHandler(updateTestingLab));
router.delete('/:id', validateParams(idParamSchema), asyncHandler(deleteTestingLab));

export default router;
