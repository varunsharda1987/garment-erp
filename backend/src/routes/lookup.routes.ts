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
import { validateBody, validateQuery } from '../middleware/validation.middleware';
import {
  createLookupSchema,
  updateLookupSchema,
  bulkCreateLookupsSchema,
  lookupQuerySchema,
} from '../schemas/lookup.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/lookups/categories - Get all categories with counts
router.get('/categories', asyncHandler(getAllCategories));

// GET /api/lookups?category=LACE_TYPE - Get lookups by category
router.get('/', validateQuery(lookupQuerySchema), asyncHandler(getLookupsByCategory));

// POST /api/lookups - Create new lookup value
router.post('/', validateBody(createLookupSchema), asyncHandler(createLookup));

// POST /api/lookups/bulk - Bulk create lookup values
router.post('/bulk', validateBody(bulkCreateLookupsSchema), asyncHandler(bulkCreateLookups));

// PUT /api/lookups/:id - Update lookup value
router.put('/:id', validateBody(updateLookupSchema), asyncHandler(updateLookup));

// DELETE /api/lookups/:id - Delete lookup value
router.delete('/:id', asyncHandler(deleteLookup));

export default router;
