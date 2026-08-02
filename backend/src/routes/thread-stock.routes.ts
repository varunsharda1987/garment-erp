/**
 * Thread Stock Routes
 * API endpoints for managing thread inventory
 */
import { Router, Request, Response } from 'express';
import { threadStockService } from '../services/thread-stock.service';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { validateBody, validateQuery } from '../middleware/validation.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { createThreadStockSchema, threadStockQuerySchema } from '../schemas/threadStock.schema';
import { UserRole } from '@prisma/client';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * GET /api/thread-stock
 * Get all thread stock entries with optional filters
 */
router.get(
  '/',
  validateQuery(threadStockQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const filters = {
      threadId: req.query.threadId as string | undefined,
      status: req.query.status as any,
      minQuantity: req.query.minQuantity ? Number(req.query.minQuantity) : undefined,
      warehouseLocation: req.query.warehouseLocation as string | undefined,
      packagingType: req.query.packagingType as string | undefined,
    };

    const stocks = await threadStockService.getThreadStock(filters);
    res.json({ success: true, data: stocks });
  })
);

/**
 * GET /api/thread-stock/summary
 * Get aggregated stock summary by thread
 */
router.get(
  '/summary',
  asyncHandler(async (req: Request, res: Response) => {
    const summary = await threadStockService.getStockSummary();
    res.json({ success: true, data: summary });
  })
);

/**
 * GET /api/thread-stock/:id
 * Get a specific thread stock entry
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const stock = await threadStockService.getById(req.params.id);
    if (!stock) {
      return res.status(404).json({
        success: false,
        error: 'Thread stock entry not found',
      });
    }
    res.json({ success: true, data: stock });
  })
);

/**
 * POST /api/thread-stock
 * Create a new thread stock entry (manual entry)
 *
 * BUG-TH10: Race condition on concurrent stock creation for same thread was fixed in
 * material-sync.helper.ts (syncStockLevelQuantity now uses upsert instead of create).
 * The thread_stock table itself allows multiple batch/lot entries per thread (valid).
 * The ensureMaterialRecord helper already handled P2002 for materials table.
 */
router.post(
  '/',
  authorize(
    UserRole.ADMIN,
    UserRole.INVENTORY,
    UserRole.PRODUCTION_MANAGER,
    UserRole.FACTORY_SUPERVISOR,
    UserRole.PURCHASE
  ),
  validateBody(createThreadStockSchema),
  asyncHandler(async (req: Request, res: Response) => {
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

    // BUG-TH8 FIX: Trust Zod schema - it already coerces types
    // (quantity: z.number(), purchaseCost: z.number(), receivedDate: z.coerce.date())
    const stock = await threadStockService.createThreadStock(
      {
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
        sourceType: 'MANUAL',
      },
      userId
    );

    res.status(201).json({ success: true, data: stock });
  })
);

export default router;
