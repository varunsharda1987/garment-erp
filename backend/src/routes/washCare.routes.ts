/**
 * Wash-care codes per buyer per fabric.
 *
 * Gated by the same permission as the fabric masters these hang off, not by 'testing' — the
 * codes are fabric master data that the Test Requirement Form happens to read.
 */

import { Router } from 'express';
import { washCareController } from '../controllers/washCare.controller';
import { authenticateToken, requirePermissionForWrites } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import { setWashCareSchema, washCareQuerySchema } from '../schemas/washCare.schema';
import { idParamSchema } from '../schemas/common.schema';

const router = Router();

router.use(authenticateToken);
router.use(requirePermissionForWrites('fabricMasters'));

router.get('/', validateQuery(washCareQuerySchema), asyncHandler(washCareController.list.bind(washCareController)));
router.post('/', validateBody(setWashCareSchema), asyncHandler(washCareController.set.bind(washCareController)));
router.delete('/:id', validateParams(idParamSchema), asyncHandler(washCareController.remove.bind(washCareController)));

export default router;
