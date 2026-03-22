import { Router } from 'express';
import { hsnSacMasterController } from '../controllers/hsnSacMaster.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/hsn-sac-masters/search - Search for dropdown/autocomplete (must be before /:id)
router.get('/search', asyncHandler(hsnSacMasterController.search.bind(hsnSacMasterController)));

// GET /api/hsn-sac-masters/code/:code - Get by code string (must be before /:id)
router.get('/code/:code', asyncHandler(hsnSacMasterController.getByCode.bind(hsnSacMasterController)));

// GET /api/hsn-sac-masters/rate/:code - Get default GST rate for a code (must be before /:id)
router.get('/rate/:code', asyncHandler(hsnSacMasterController.getDefaultRate.bind(hsnSacMasterController)));

// GET /api/hsn-sac-masters - Get all with pagination
router.get('/', asyncHandler(hsnSacMasterController.getAll.bind(hsnSacMasterController)));

// GET /api/hsn-sac-masters/:id - Get by ID
router.get('/:id', asyncHandler(hsnSacMasterController.getById.bind(hsnSacMasterController)));

// POST /api/hsn-sac-masters - Create new HSN/SAC code
router.post('/', asyncHandler(hsnSacMasterController.create.bind(hsnSacMasterController)));

// PUT /api/hsn-sac-masters/:id - Update HSN/SAC code
router.put('/:id', asyncHandler(hsnSacMasterController.update.bind(hsnSacMasterController)));

// DELETE /api/hsn-sac-masters/:id - Delete HSN/SAC code (soft delete)
router.delete('/:id', asyncHandler(hsnSacMasterController.delete.bind(hsnSacMasterController)));

export default router;
