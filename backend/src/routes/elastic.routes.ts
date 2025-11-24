import { Router } from 'express';
import {
  createElastic,
  getAllElastic,
  getElasticById,
  updateElastic,
  deleteElastic,
  bulkImportElastic,
  downloadTemplate
} from '../controllers/elastic.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/materials/elastic
 * @desc    Create a single elastic item
 * @access  Private
 */
router.post('/', createElastic);

/**
 * @route   GET /api/materials/elastic
 * @desc    Get all elastic items with pagination and search
 * @access  Private
 * @query   page, limit, search, supplierId
 */
router.get('/', getAllElastic);

/**
 * @route   GET /api/materials/elastic/template
 * @desc    Download Excel template for bulk import
 * @access  Private
 */
router.get('/template', downloadTemplate);

/**
 * @route   GET /api/materials/elastic/:id
 * @desc    Get single elastic item by ID
 * @access  Private
 */
router.get('/:id', getElasticById);

/**
 * @route   PUT /api/materials/elastic/:id
 * @desc    Update elastic item
 * @access  Private
 */
router.put('/:id', updateElastic);

/**
 * @route   DELETE /api/materials/elastic/:id
 * @desc    Delete elastic item
 * @access  Private
 */
router.delete('/:id', deleteElastic);

/**
 * @route   POST /api/materials/elastic/bulk-import
 * @desc    Bulk import elastic items from Excel
 * @access  Private
 */
router.post('/bulk-import', bulkImportElastic);

export default router;
