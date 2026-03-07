import { Router } from 'express';
import {
  createChallanController,
  issueChallanController,
  getChallanByIdController,
  getChallansController,
  receiveChallanController,
  cancelChallanController,
  getChallanStatsController,
  resolveRateController,
  splitProductionRunController,
} from '../controllers/challan.controller';

const router = Router();

// Challan routes
router.get('/challans/stats', getChallanStatsController);
router.get('/challans', getChallansController);
router.post('/challans', createChallanController);
router.get('/challans/:id', getChallanByIdController);
router.put('/challans/:id/issue', issueChallanController);
router.put('/challans/:id/receive', receiveChallanController);
router.put('/challans/:id/cancel', cancelChallanController);

// PO rate resolution
router.get('/po-rates/resolve', resolveRateController);

// Production run split
router.post('/production-runs/:id/split', splitProductionRunController);

export default router;
