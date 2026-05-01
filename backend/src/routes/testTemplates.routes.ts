import { Router } from 'express';
import {
  createTestTemplate,
  getAllTestTemplates,
  getTestTemplateById,
  updateTestTemplate,
  deleteTestTemplate,
} from '../controllers/testTemplates.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import {
  createTestTemplateSchema,
  updateTestTemplateSchema,
  testTemplateQuerySchema,
} from '../schemas/testing.schemas';
import { idParamSchema } from '../schemas/common.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Routes
router.post('/', validateBody(createTestTemplateSchema), asyncHandler(createTestTemplate));
router.get('/', validateQuery(testTemplateQuerySchema), asyncHandler(getAllTestTemplates));
router.get('/:id', validateParams(idParamSchema), asyncHandler(getTestTemplateById));
router.put(
  '/:id',
  validateParams(idParamSchema),
  validateBody(updateTestTemplateSchema),
  asyncHandler(updateTestTemplate)
);
router.delete('/:id', validateParams(idParamSchema), asyncHandler(deleteTestTemplate));

export default router;
