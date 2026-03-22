import express from 'express';
import {
  getProcurements,
  getProcurementById,
  createProcurement,
  updateProcurement,
  planProcurement,
  deleteProcurement,
} from '../controllers/fabric-procurement.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/procurement - List all procurements with filters
router.get('/', asyncHandler(getProcurements));

// POST /api/procurement/plan - Plan procurement based on orders
router.post('/plan', asyncHandler(planProcurement));

// GET /api/procurement/:id - Get single procurement
router.get('/:id', asyncHandler(getProcurementById));

// POST /api/procurement - Create new procurement
router.post('/', asyncHandler(createProcurement));

// PUT /api/procurement/:id - Update procurement
router.put('/:id', asyncHandler(updateProcurement));

// DELETE /api/procurement/:id - Delete procurement
router.delete('/:id', asyncHandler(deleteProcurement));

export default router;
