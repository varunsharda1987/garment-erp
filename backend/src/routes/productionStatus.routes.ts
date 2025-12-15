import { Router } from 'express';
import {
  getAllProductionStatus,
  getProductionStatusSummary,
} from '../controllers/productionStatus.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Routes
router.get('/', getAllProductionStatus);
router.get('/summary', getProductionStatusSummary);

export default router;
