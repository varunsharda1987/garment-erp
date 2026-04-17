// Style Import routes
import { Router, Request, Response } from 'express';
import StyleImportController from '../controllers/style-import.controller';
import StyleStockController from '../controllers/style-stock.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { UserRole } from '@prisma/client';
import multer from 'multer';
import {
  retryImportSchema,
  createStyleStockSchema,
  bulkStockQuerySchema,
  createGreigeStockSchema,
} from '../schemas/styleImport.schema';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Accept CSV and Excel files only
    if (
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files are allowed'));
    }
  },
});

// All routes require authentication
router.use(authenticateToken);

// ============================================
// STYLE IMPORT ROUTES
// ============================================

/**
 * @route   POST /api/styles/import
 * @desc    Import styles from CSV/Excel file
 * @access  Protected - Admin, Merchandiser
 */
router.post(
  '/import',
  authorize(UserRole.ADMIN, UserRole.MERCHANDISER),
  upload.single('file'),
  asyncHandler((req: Request, res: Response) => StyleImportController.importStyles(req, res))
);

/**
 * @route   GET /api/styles/import/template
 * @desc    Download sample CSV template
 * @access  Protected - All authenticated users
 */
router.get(
  '/import/template',
  asyncHandler((req: Request, res: Response) => StyleImportController.downloadTemplate(req, res))
);

/**
 * @route   GET /api/styles/import/:batchId
 * @desc    Get import status and summary
 * @access  Protected - All authenticated users
 */
router.get(
  '/import/:batchId',
  asyncHandler((req: Request, res: Response) => StyleImportController.getImportStatus(req, res))
);

/**
 * @route   POST /api/styles/import/:batchId/retry
 * @desc    Retry failed imports
 * @access  Protected - Admin, Merchandiser
 */
router.post(
  '/import/:batchId/retry',
  authorize(UserRole.ADMIN, UserRole.MERCHANDISER),
  validateBody(retryImportSchema),
  asyncHandler((req: Request, res: Response) => StyleImportController.retryImport(req, res))
);

// ============================================
// STYLE STOCK ROUTES
// ============================================

/**
 * @route   POST /api/styles/:styleId/stock-entry
 * @desc    Bulk stock entry for style fabrics
 * @access  Protected - Admin, Inventory
 */
router.post(
  '/:styleId/stock-entry',
  authorize(UserRole.ADMIN, UserRole.INVENTORY),
  validateBody(createStyleStockSchema),
  asyncHandler((req: Request, res: Response) => StyleStockController.createStyleStock(req, res))
);

/**
 * @route   GET /api/styles/:styleId/stock
 * @desc    Get stock availability for style
 * @access  Protected - All authenticated users
 */
router.get(
  '/:styleId/stock',
  asyncHandler((req: Request, res: Response) => StyleStockController.getStyleStock(req, res))
);

/**
 * @route   GET /api/styles/:styleId/fabrics
 * @desc    Get fabrics used in style
 * @access  Protected - All authenticated users
 */
router.get(
  '/:styleId/fabrics',
  asyncHandler((req: Request, res: Response) => StyleStockController.getStyleFabrics(req, res))
);

/**
 * @route   POST /api/styles/bulk-stock
 * @desc    Get stock for multiple styles (for reports)
 * @access  Protected - All authenticated users
 */
router.post(
  '/bulk-stock',
  validateBody(bulkStockQuerySchema),
  asyncHandler((req: Request, res: Response) => StyleStockController.getBulkStyleStock(req, res))
);

// ============================================
// FABRIC QUERY ROUTES
// ============================================

/**
 * @route   GET /api/fabrics/:fabricId/styles
 * @desc    Get styles that use this fabric
 * @access  Protected - All authenticated users
 */
router.get(
  '/fabrics/:fabricId/styles',
  asyncHandler((req: Request, res: Response) => StyleStockController.getFabricStyles(req, res))
);

/**
 * @route   GET /api/fabrics/:fabricId/stock-history
 * @desc    Get stock origin history for fabric
 * @access  Protected - All authenticated users
 */
router.get(
  '/fabrics/:fabricId/stock-history',
  asyncHandler((req: Request, res: Response) => StyleStockController.getFabricStockHistory(req, res))
);

// ============================================
// GREIGE STOCK ROUTES
// ============================================

/**
 * @route   POST /api/greige/stock-entry (when mounted under /api/greige)
 * @route   POST /api/styles/greige/stock-entry (when mounted under /api/styles)
 * @desc    Create generic greige stock entry
 * @access  Protected - Admin, Inventory
 */
router.post(
  '/greige/stock-entry',
  authorize(UserRole.ADMIN, UserRole.INVENTORY),
  validateBody(createGreigeStockSchema),
  asyncHandler((req: Request, res: Response) => StyleStockController.createGreigeStock(req, res))
);

/**
 * @route   GET /api/greige/generic-stock (when mounted under /api/greige)
 * @route   GET /api/styles/greige/generic-stock (when mounted under /api/styles)
 * @desc    Get generic greige stock (not tied to any style)
 * @access  Protected - All authenticated users
 */
router.get(
  '/greige/generic-stock',
  asyncHandler((req: Request, res: Response) => StyleStockController.getGenericGreigeStock(req, res))
);

export default router;
