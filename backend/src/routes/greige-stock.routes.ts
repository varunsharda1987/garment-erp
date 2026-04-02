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
 * @route   GET /api/greige/stock
 * @desc    Get individual greige stock entries (available, with IDs for challan issuance)
 * @access  Protected - All authenticated users
 */
router.get(
  '/stock',
  authenticateToken,
  asyncHandler((req: Request, res: Response) => StyleStockController.getAvailableGreigeStock(req, res))
);

/**
 * @route   GET /api/greige/generic-stock
 * @desc    Get generic greige stock (not tied to any style)
 * @access  Protected - All authenticated users
 */
router.get(
  '/generic-stock',
  authenticateToken,
  asyncHandler((req: Request, res: Response) => StyleStockController.getGenericGreigeStock(req, res))
);

/**
 * @route   GET /api/greige/stock-entries/:greigeId
 * @desc    Get individual stock entries for a specific greige type (expandable rows)
 * @access  Protected - All authenticated users
 */
router.get(
  '/stock-entries/:greigeId',
  authenticateToken,
  asyncHandler((req: Request, res: Response) => StyleStockController.getGreigeStockByGreigeId(req, res))
);

/**
 * @route   GET /api/greige/summary
 * @desc    Get greige stock summary for unified dashboard
 * @access  Protected - All authenticated users
 */
router.get(
  '/summary',
  authenticateToken,
  asyncHandler((req: Request, res: Response) => StyleStockController.getGreigeStockSummary(req, res))
);

/**
 * @route   PATCH /api/greige/stock/:stockId
 * @desc    Update a greige stock entry
 * @access  Protected - Admin, Inventory
 */
router.patch(
  '/stock/:stockId',
  authenticateToken,
  authorize(UserRole.ADMIN, UserRole.INVENTORY),
  asyncHandler((req: Request, res: Response) => StyleStockController.updateGreigeStockEntry(req, res))
);

/**
 * @route   POST /api/greige/stock/:stockId/adjust
 * @desc    Adjust greige stock quantity (increase/decrease with reason)
 * @access  Protected - Admin, Inventory
 */
router.post(
  '/stock/:stockId/adjust',
  authenticateToken,
  authorize(UserRole.ADMIN, UserRole.INVENTORY),
  asyncHandler((req: Request, res: Response) => StyleStockController.adjustGreigeStockEntry(req, res))
);

export default router;
