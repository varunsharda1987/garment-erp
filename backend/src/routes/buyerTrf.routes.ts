/**
 * Buyer Test Requirement Form (TRF) routes.
 *
 * Reads are open; writes are gated by the 'testing' permission, same as FPT/GPT — the TRF is
 * part of the Testing module and should not need a second permission key to administer.
 */

import { Router } from 'express';
import { buyerTrfController } from '../controllers/buyerTrf.controller';
import { authenticateToken, requirePermissionForWrites } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import {
  createBuyerTrfSchema,
  updateBuyerTrfSchema,
  buyerTrfQuerySchema,
  buyerTrfPrefillQuerySchema,
} from '../schemas/buyerTrf.schema';
import { idParamSchema } from '../schemas/common.schema';

const router = Router();

router.use(authenticateToken);
router.use(requirePermissionForWrites('testing'));

// Static paths before /:id, or "form-options" and "prefill" are parsed as ids and 400 on the
// UUID param check.
router.get('/form-options', asyncHandler(buyerTrfController.formOptions.bind(buyerTrfController)));
router.get(
  '/prefill',
  validateQuery(buyerTrfPrefillQuerySchema),
  asyncHandler(buyerTrfController.prefill.bind(buyerTrfController))
);

router.get('/', validateQuery(buyerTrfQuerySchema), asyncHandler(buyerTrfController.getAll.bind(buyerTrfController)));
router.get('/:id', validateParams(idParamSchema), asyncHandler(buyerTrfController.getById.bind(buyerTrfController)));
router.post('/', validateBody(createBuyerTrfSchema), asyncHandler(buyerTrfController.create.bind(buyerTrfController)));
router.put(
  '/:id',
  validateParams(idParamSchema),
  validateBody(updateBuyerTrfSchema),
  asyncHandler(buyerTrfController.update.bind(buyerTrfController))
);
router.delete('/:id', validateParams(idParamSchema), asyncHandler(buyerTrfController.delete.bind(buyerTrfController)));

export default router;
