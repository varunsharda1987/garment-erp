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

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/lookups/categories - Get all categories with counts
router.get('/categories', getAllCategories);

// GET /api/lookups?category=LACE_TYPE - Get lookups by category
router.get('/', getLookupsByCategory);

// POST /api/lookups - Create new lookup value
router.post('/', createLookup);

// POST /api/lookups/bulk - Bulk create lookup values
router.post('/bulk', bulkCreateLookups);

// PUT /api/lookups/:id - Update lookup value
router.put('/:id', updateLookup);

// DELETE /api/lookups/:id - Delete lookup value
router.delete('/:id', deleteLookup);

export default router;
