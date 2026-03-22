import { Router } from 'express';
import { gstReportController } from '../controllers/gstReport.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

router.get('/gstr1', asyncHandler(gstReportController.generateGSTR1.bind(gstReportController)));
router.get('/gstr3b', asyncHandler(gstReportController.generateGSTR3B.bind(gstReportController)));

export default router;
