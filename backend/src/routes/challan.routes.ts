import { Router } from 'express';
import {
  createChallanController,
  issueChallanController,
  getChallanByIdController,
  getChallansController,
  receiveChallanController,
  cancelChallanController,
  getChallanStatsController,
  createGreigeOutwardChallanController,
  quickIssueChallanController,
  resolveRateController,
  splitProductionRunController,
} from '../controllers/challan.controller';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateParams } from '../middleware/validation.middleware';
import { createChallanSchema, quickIssueChallanSchema, receiveChallanSchema } from '../schemas/challan.schema';
import { idParamSchema } from '../schemas/common.schema';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Apply path-specific authentication (this router is mounted at '/')
// Using path-specific auth instead of global to avoid potential conflicts
router.use('/challans', authenticateToken);
router.use('/po-rates', authenticateToken);
router.use('/production-runs', authenticateToken);

// Challan routes
router.get('/challans/stats', asyncHandler(getChallanStatsController));
router.post('/challans/greige-outward', asyncHandler(createGreigeOutwardChallanController));
router.post('/challans/quick-issue', validateBody(quickIssueChallanSchema), asyncHandler(quickIssueChallanController));
router.get('/challans', asyncHandler(getChallansController));
router.post('/challans', validateBody(createChallanSchema), asyncHandler(createChallanController));
router.get('/challans/:id', validateParams(idParamSchema), asyncHandler(getChallanByIdController));
router.put('/challans/:id/issue', validateParams(idParamSchema), asyncHandler(issueChallanController));
router.put(
  '/challans/:id/receive',
  validateParams(idParamSchema),
  validateBody(receiveChallanSchema),
  asyncHandler(receiveChallanController)
);
router.put('/challans/:id/cancel', validateParams(idParamSchema), asyncHandler(cancelChallanController));

// PO rate resolution
router.get('/po-rates/resolve', asyncHandler(resolveRateController));

// Production run split
router.post('/production-runs/:id/split', validateParams(idParamSchema), asyncHandler(splitProductionRunController));

export default router;
