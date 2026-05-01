/**
 * Thread Stock Routes
 * API endpoints for managing thread inventory
 */
import { Router, Request, Response } from 'express';
import { threadStockService } from '../services/thread-stock.service';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * GET /api/thread-stock
 * Get all thread stock entries with optional filters
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const filters = {
      threadId: req.query.threadId as string | undefined,
      status: req.query.status as any,
      minQuantity: req.query.minQuantity ? Number(req.query.minQuantity) : undefined,
      warehouseLocation: req.query.warehouseLocation as string | undefined,
      packagingType: req.query.packagingType as string | undefined,
    };

    const stocks = await threadStockService.getThreadStock(filters);
    res.json({ success: true, data: stocks });
  } catch (error) {
    console.error('Error fetching thread stock:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch thread stock',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/thread-stock/summary
 * Get aggregated stock summary by thread
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const summary = await threadStockService.getStockSummary();
    res.json({ success: true, data: summary });
  } catch (error) {
    console.error('Error fetching thread stock summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stock summary',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/thread-stock/:id
 * Get a specific thread stock entry
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const stock = await threadStockService.getById(req.params.id);
    if (!stock) {
      return res.status(404).json({
        success: false,
        error: 'Thread stock entry not found',
      });
    }
    res.json({ success: true, data: stock });
  } catch (error) {
    console.error('Error fetching thread stock:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch thread stock',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/thread-stock
 * Create a new thread stock entry (manual entry)
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const {
      threadId,
      quantity,
      unit,
      metersPerUnit,
      unitsPerBox,
      purchaseCost,
      supplierLotNumber,
      warehouseLocation,
      rackNumber,
      qualityGrade,
      receivedDate,
    } = req.body;

    // Validate required fields
    if (!threadId) {
      return res.status(400).json({
        success: false,
        error: 'threadId is required',
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

    const stock = await threadStockService.createThreadStock(
      {
        threadId,
        quantity: Number(quantity),
        unit,
        metersPerUnit: metersPerUnit ? Number(metersPerUnit) : undefined,
        unitsPerBox: unitsPerBox ? Number(unitsPerBox) : undefined,
        purchaseCost: Number(purchaseCost),
        supplierLotNumber,
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
    console.error('Error creating thread stock:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create thread stock',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
