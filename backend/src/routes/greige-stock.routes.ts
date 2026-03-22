// Greige Stock Routes
import { Router, Request, Response } from 'express';
import StyleStockController from '../controllers/style-stock.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

/**
 * @route   POST /api/greige/stock-entry
 * @desc    Create generic greige stock entry
 * @access  Protected - Admin, Inventory
 */
router.post(
  '/stock-entry',
  authenticateToken,
  authorize(UserRole.ADMIN, UserRole.INVENTORY),
  asyncHandler((req: Request, res: Response) => StyleStockController.createGreigeStock(req, res))
);

/**
 * @route   GET /api/greige/generic-stock
 * @desc    Get generic greige stock (not tied to any style)
 * @access  Protected - All authenticated users
 */
router.get('/generic-stock', authenticateToken, asyncHandler((req: Request, res: Response) => StyleStockController.getGenericGreigeStock(req, res)));

/**
 * @route   GET /api/greige/summary
 * @desc    Get greige stock summary for unified dashboard
 * @access  Protected - All authenticated users
 */
router.get('/summary', authenticateToken, asyncHandler((req: Request, res: Response) => StyleStockController.getGreigeStockSummary(req, res)));

export default router;
