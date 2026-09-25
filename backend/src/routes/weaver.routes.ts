/**
 * /api/weavers — pick or add the weaver of a greige / fabric purchase (Phase 1b, 2026-09-25).
 * Reads are open; adding a weaver is allowed to anyone who raises POs OR receives goods, since the
 * weaver is named on the PO line or, when only the delivery says, on the GRN line.
 */
import { Router } from 'express';
import { authenticateToken, requireAnyPermission } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery } from '../middleware/validation.middleware';
import { createWeaverSchema, weaverQuerySchema } from '../schemas/weaver.schema';
import { weaverController } from '../controllers/weaver.controller';

const router = Router();
router.use(authenticateToken);

router.get('/', validateQuery(weaverQuerySchema), asyncHandler(weaverController.search));
router.post(
  '/',
  requireAnyPermission('purchaseOrders', 'grn'),
  validateBody(createWeaverSchema),
  asyncHandler(weaverController.create)
);

export default router;
