/**
 * Unified Trim Stock Routes
 * API endpoints for managing trim inventory (button, zipper, elastic, label, packaging)
 */
import { Router, Request, Response } from 'express';
import { trimStockService, TrimType } from '../services/trim-stock.service';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

const VALID_TRIM_TYPES: TrimType[] = [
  'BUTTON',
  'ZIPPER',
  'ELASTIC',
  'LABEL',
  'PACKAGING',
  'MACHINE_PART',
  'OTHER_MATERIAL',
];

/**
 * GET /api/trim-stock/summary
 * Get aggregated stock summary for all trim types
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const summary = await trimStockService.getAllTrimStockSummary();
    res.json({ success: true, data: summary });
  } catch (error) {
    console.error('Error fetching trim stock summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trim stock summary',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/trim-stock/:trimType
 * Get stock entries for a specific trim type
 */
router.get('/:trimType', async (req: Request, res: Response) => {
  try {
    const trimType = req.params.trimType.toUpperCase() as TrimType;

    if (!VALID_TRIM_TYPES.includes(trimType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid trim type. Must be one of: ${VALID_TRIM_TYPES.join(', ')}`,
      });
    }

    const filters = {
      masterId: req.query.masterId as string | undefined,
      status: req.query.status as any,
      minQuantity: req.query.minQuantity ? Number(req.query.minQuantity) : undefined,
      warehouseLocation: req.query.warehouseLocation as string | undefined,
    };

    const stocks = await trimStockService.getTrimStock(trimType, filters);
    res.json({ success: true, data: stocks });
  } catch (error) {
    console.error('Error fetching trim stock:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trim stock',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/trim-stock/:trimType
 * Create a new trim stock entry (manual entry)
 */
router.post(
  '/:trimType',
  authorize(
    UserRole.ADMIN,
    UserRole.INVENTORY,
    UserRole.PRODUCTION_MANAGER,
    UserRole.FACTORY_SUPERVISOR,
    UserRole.PURCHASE
  ),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const trimType = req.params.trimType.toUpperCase() as TrimType;

      if (!VALID_TRIM_TYPES.includes(trimType)) {
        return res.status(400).json({
          success: false,
          error: `Invalid trim type. Must be one of: ${VALID_TRIM_TYPES.join(', ')}`,
        });
      }

      const {
        masterId,
        quantity,
        unit,
        purchaseCost,
        supplierId,
        batchNumber,
        lotNumber,
        warehouseId,
        warehouseLocation,
        rackNumber,
        qualityGrade,
        receivedDate,
      } = req.body;

      // Validate required fields
      if (!masterId) {
        return res.status(400).json({
          success: false,
          error: 'masterId is required',
        });
      }
      if (!quantity || quantity <= 0) {
        return res.status(400).json({
          success: false,
          error: 'quantity must be a positive number',
        });
      }
      if (purchaseCost === undefined || purchaseCost < 0) {
        return res.status(400).json({
          success: false,
          error: 'purchaseCost is required and must be non-negative',
        });
      }

      const stock = await trimStockService.createTrimStock(
        {
          trimType,
          masterId,
          quantity: Number(quantity),
          unit,
          purchaseCost: Number(purchaseCost),
          supplierId,
          batchNumber,
          lotNumber,
          warehouseId,
          warehouseLocation,
          rackNumber,
          qualityGrade,
          receivedDate: receivedDate ? new Date(receivedDate) : undefined,
          sourceType: 'MANUAL',
        },
        userId
      );

      res.status(201).json({ success: true, data: stock });
    } catch (error) {
      console.error('Error creating trim stock:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create trim stock',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

export default router;
