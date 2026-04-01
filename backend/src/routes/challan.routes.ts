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
import { validateBody } from '../middleware/validation.middleware';
import { createChallanSchema } from '../schemas/challan.schema';

const router = Router();

// Challan routes
router.get('/challans/stats', asyncHandler(getChallanStatsController));
router.post('/challans/greige-outward', asyncHandler(createGreigeOutwardChallanController));
router.post('/challans/quick-issue', asyncHandler(quickIssueChallanController));
router.get('/challans', asyncHandler(getChallansController));
router.post('/challans', validateBody(createChallanSchema), asyncHandler(createChallanController));
router.get('/challans/:id', asyncHandler(getChallanByIdController));
router.put('/challans/:id/issue', asyncHandler(issueChallanController));
router.put('/challans/:id/receive', asyncHandler(receiveChallanController));
router.put('/challans/:id/cancel', asyncHandler(cancelChallanController));

// PO rate resolution
router.get('/po-rates/resolve', asyncHandler(resolveRateController));

// Production run split
router.post('/production-runs/:id/split', asyncHandler(splitProductionRunController));

export default router;
