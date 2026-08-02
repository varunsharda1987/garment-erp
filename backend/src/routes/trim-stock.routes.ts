/**
 * Unified Trim Stock Routes
 * API endpoints for managing trim inventory (button, zipper, elastic, label, packaging)
 */
import { Router, Request, Response } from 'express';
import { trimStockService, TrimType } from '../services/trim-stock.service';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { createTrimStockSchema } from '../schemas/trimStock.schema';
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
router.get(
  '/summary',
  asyncHandler(async (req: Request, res: Response) => {
    const summary = await trimStockService.getAllTrimStockSummary();
    res.json({ success: true, data: summary });
  })
);

/**
 * GET /api/trim-stock/:trimType
 * Get stock entries for a specific trim type
 */
router.get(
  '/:trimType',
  asyncHandler(async (req: Request, res: Response) => {
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
  })
);

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
  validateBody(createTrimStockSchema),
  asyncHandler(async (req: Request, res: Response) => {
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
  })
);

export default router;
