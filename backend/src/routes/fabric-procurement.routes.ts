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
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import {
  createProcurementSchema,
  updateProcurementSchema,
  planProcurementSchema,
  procurementQuerySchema,
} from '../schemas/fabricProcurement.schema';
import { idParamSchema } from '../schemas/common.schema';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/procurement - List all procurements with filters
router.get('/', validateQuery(procurementQuerySchema), asyncHandler(getProcurements));

// POST /api/procurement/plan - Plan procurement based on orders
router.post('/plan', validateBody(planProcurementSchema), asyncHandler(planProcurement));

// GET /api/procurement/:id - Get single procurement
router.get('/:id', validateParams(idParamSchema), asyncHandler(getProcurementById));

// POST /api/procurement - Create new procurement
router.post('/', validateBody(createProcurementSchema), asyncHandler(createProcurement));

// PUT /api/procurement/:id - Update procurement
router.put(
  '/:id',
  validateParams(idParamSchema),
  validateBody(updateProcurementSchema),
  asyncHandler(updateProcurement)
);

// DELETE /api/procurement/:id - Delete procurement
router.delete('/:id', validateParams(idParamSchema), asyncHandler(deleteProcurement));

export default router;
