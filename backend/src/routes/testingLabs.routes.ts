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
import { validateBody, validateQuery } from '../middleware/validation.middleware';
import {
  createTestingLabSchema,
  updateTestingLabSchema,
  testingLabQuerySchema,
} from '../schemas/testing.schemas';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Routes
router.post('/', validateBody(createTestingLabSchema), createTestingLab);
router.get('/', validateQuery(testingLabQuerySchema), getAllTestingLabs);
router.get('/:id', getTestingLabById);
router.get('/:id/stats', getLabStats);
router.put('/:id', validateBody(updateTestingLabSchema), updateTestingLab);
router.delete('/:id', deleteTestingLab);

export default router;
