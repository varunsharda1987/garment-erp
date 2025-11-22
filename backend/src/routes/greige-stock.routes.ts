// Greige Stock Routes
import { Router } from 'express';
import StyleStockController from '../controllers/style-stock.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
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
  (req, res) => StyleStockController.createGreigeStock(req, res)
);

/**
 * @route   GET /api/greige/generic-stock
 * @desc    Get generic greige stock (not tied to any style)
 * @access  Protected - All authenticated users
 */
router.get('/generic-stock', authenticateToken, (req, res) => StyleStockController.getGenericGreigeStock(req, res));

export default router;
