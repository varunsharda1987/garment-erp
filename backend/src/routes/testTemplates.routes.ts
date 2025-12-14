import { Router } from 'express';
import {
  createTestTemplate,
  getAllTestTemplates,
  getTestTemplateById,
  updateTestTemplate,
  deleteTestTemplate,
} from '../controllers/testTemplates.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { validateBody, validateQuery } from '../middleware/validation.middleware';
import {
  createTestTemplateSchema,
  updateTestTemplateSchema,
  testTemplateQuerySchema,
} from '../schemas/testing.schemas';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Routes
router.post('/', validateBody(createTestTemplateSchema), createTestTemplate);
router.get('/', validateQuery(testTemplateQuerySchema), getAllTestTemplates);
router.get('/:id', getTestTemplateById);
router.put('/:id', validateBody(updateTestTemplateSchema), updateTestTemplate);
router.delete('/:id', deleteTestTemplate);

export default router;
