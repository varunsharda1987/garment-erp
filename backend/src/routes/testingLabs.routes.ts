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
import { validateBody, validateQuery } from '../middleware/validation.middleware';
import { createTestingLabSchema, updateTestingLabSchema, testingLabQuerySchema } from '../schemas/testing.schemas';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Routes
router.post('/', validateBody(createTestingLabSchema), asyncHandler(createTestingLab));
router.get('/', validateQuery(testingLabQuerySchema), asyncHandler(getAllTestingLabs));
router.get('/:id', asyncHandler(getTestingLabById));
router.get('/:id/stats', asyncHandler(getLabStats));
router.put('/:id', validateBody(updateTestingLabSchema), asyncHandler(updateTestingLab));
router.delete('/:id', asyncHandler(deleteTestingLab));

export default router;
