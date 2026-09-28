/**
 * /api/po-allocations — allocate a sent PO to running orders (docs/plans/po-allocation-design.md §6.5).
 * Reading a PO's allocation is open to anyone signed in. Linking and Undo need EITHER the MRP or the
 * Purchase Orders switch (owner decision D4): the PO page and the Requirements page both lead here, and
 * whoever works either one may allocate. Its own router because the PO router gates every write on
 * 'purchaseOrders' alone.
 */
import { Router } from 'express';
import { authenticateToken, requireAnyPermission } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateParams, validateQuery } from '../middleware/validation.middleware';
import {
  allocatePoSchema,
  poAllocationLinkParamSchema,
  poAllocationParamSchema,
  poAllocationQuerySchema,
} from '../schemas/po-allocation.schema';
import { poAllocationController } from '../controllers/po-allocation.controller';

const router = Router();
router.use(authenticateToken);

const canAllocate = requireAnyPermission('mrp', 'purchaseOrders');

router.get(
  '/:poId',
  validateParams(poAllocationParamSchema),
  validateQuery(poAllocationQuerySchema),
  asyncHandler(poAllocationController.get.bind(poAllocationController))
);

router.post(
  '/:poId',
  canAllocate,
  validateParams(poAllocationParamSchema),
  validateBody(allocatePoSchema),
  asyncHandler(poAllocationController.allocate.bind(poAllocationController))
);

// no-body
router.delete(
  '/:poId/links/:linkId',
  canAllocate,
  validateParams(poAllocationLinkParamSchema),
  asyncHandler(poAllocationController.undo.bind(poAllocationController))
);

export default router;
