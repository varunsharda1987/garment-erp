import { Router } from 'express';
import {
  getLookupsByCategory,
  getAllCategories,
  createLookup,
  updateLookup,
  deleteLookup,
  bulkCreateLookups,
} from '../controllers/lookup.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/lookups/categories - Get all categories with counts
router.get('/categories', asyncHandler(getAllCategories));

// GET /api/lookups?category=LACE_TYPE - Get lookups by category
router.get('/', asyncHandler(getLookupsByCategory));

// POST /api/lookups - Create new lookup value
router.post('/', asyncHandler(createLookup));

// POST /api/lookups/bulk - Bulk create lookup values
router.post('/bulk', asyncHandler(bulkCreateLookups));

// PUT /api/lookups/:id - Update lookup value
router.put('/:id', asyncHandler(updateLookup));

// DELETE /api/lookups/:id - Delete lookup value
router.delete('/:id', asyncHandler(deleteLookup));

export default router;
