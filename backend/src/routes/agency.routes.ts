import { Router } from 'express';
import { agencyController } from '../controllers/agency.controller';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateParams } from '../middleware/validation.middleware';
import { createAgencySchema, updateAgencySchema } from '../schemas/agency.schema';
import { authenticateToken } from '../middleware/auth.middleware';
import { idParamSchema } from '../schemas/common.schema';

const router = Router();

// Apply authentication to all agency routes
router.use(authenticateToken);

// GET /api/agencies/search - Search agencies for dropdown (must be before /:id)
router.get('/search', asyncHandler(agencyController.search.bind(agencyController)));

// GET /api/agencies - Get all agencies with pagination
router.get('/', asyncHandler(agencyController.getAll.bind(agencyController)));

// GET /api/agencies/:id - Get agency by ID
router.get('/:id', validateParams(idParamSchema), asyncHandler(agencyController.getById.bind(agencyController)));

// POST /api/agencies - Create new agency
router.post('/', validateBody(createAgencySchema), asyncHandler(agencyController.create.bind(agencyController)));

// PUT /api/agencies/:id - Update agency
router.put(
  '/:id',
  validateParams(idParamSchema),
  validateBody(updateAgencySchema),
  asyncHandler(agencyController.update.bind(agencyController))
);

// DELETE /api/agencies/:id - Delete agency
router.delete('/:id', validateParams(idParamSchema), asyncHandler(agencyController.delete.bind(agencyController)));

export default router;
