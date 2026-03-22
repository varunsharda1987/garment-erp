import { Router } from 'express';
import { agencyController } from '../controllers/agency.controller';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { createAgencySchema, updateAgencySchema } from '../schemas/agency.schema';

const router = Router();

// GET /api/agencies/search - Search agencies for dropdown (must be before /:id)
router.get('/search', asyncHandler(agencyController.search.bind(agencyController)));

// GET /api/agencies - Get all agencies with pagination
router.get('/', asyncHandler(agencyController.getAll.bind(agencyController)));

// GET /api/agencies/:id - Get agency by ID
router.get('/:id', asyncHandler(agencyController.getById.bind(agencyController)));

// POST /api/agencies - Create new agency
router.post('/', validateBody(createAgencySchema), asyncHandler(agencyController.create.bind(agencyController)));

// PUT /api/agencies/:id - Update agency
router.put('/:id', validateBody(updateAgencySchema), asyncHandler(agencyController.update.bind(agencyController)));

// DELETE /api/agencies/:id - Delete agency
router.delete('/:id', asyncHandler(agencyController.delete.bind(agencyController)));

export default router;
