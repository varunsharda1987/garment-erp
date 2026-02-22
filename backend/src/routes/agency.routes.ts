import { Router } from 'express';
import { agencyController } from '../controllers/agency.controller';

const router = Router();

// GET /api/agencies/search - Search agencies for dropdown (must be before /:id)
router.get('/search', agencyController.search.bind(agencyController));

// GET /api/agencies - Get all agencies with pagination
router.get('/', agencyController.getAll.bind(agencyController));

// GET /api/agencies/:id - Get agency by ID
router.get('/:id', agencyController.getById.bind(agencyController));

// POST /api/agencies - Create new agency
router.post('/', agencyController.create.bind(agencyController));

// PUT /api/agencies/:id - Update agency
router.put('/:id', agencyController.update.bind(agencyController));

// DELETE /api/agencies/:id - Delete agency
router.delete('/:id', agencyController.delete.bind(agencyController));

export default router;
