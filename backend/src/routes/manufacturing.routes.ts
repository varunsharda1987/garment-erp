import { Router } from 'express';
import { manufacturingController } from '../controllers/manufacturing.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

// All routes require authentication. This was missing until 2026-09-21: GET /manufacturing/alerts
// answered 200 to an anonymous caller and handed out supplier names, quantities, order numbers,
// style codes and cost-variance percentages on a LAN-exposed API.
//
// Deliberately NOT gated with requirePermissionForWrites('manufacturing'): reads stay open per
// CLAUDE.md, and that key is granted to every role in role_permissions anyway, so it would restrict
// nothing while implying it did.
router.use(authenticateToken);

// GET /manufacturing/alerts - Get manufacturing alerts and vendor summary
router.get('/alerts', asyncHandler(manufacturingController.getAlerts.bind(manufacturingController)));

// GET /manufacturing/pipeline - Open orders, the stage each is waiting to enter, and what blocks it
router.get('/pipeline', asyncHandler(manufacturingController.getPipeline.bind(manufacturingController)));

export default router;
