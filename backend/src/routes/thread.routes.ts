import { Router } from 'express';
import {
  createThread,
  getAllThreads,
  getThreadById,
  updateThread,
  deleteThread,
  bulkImportThreads,
  downloadTemplate
} from '../controllers/thread.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/materials/thread
 * @desc    Create a single thread item
 * @access  Private
 */
router.post('/', createThread);

/**
 * @route   GET /api/materials/thread
 * @desc    Get all thread items with pagination and search
 * @access  Private
 * @query   page, limit, search, supplierId
 */
router.get('/', getAllThreads);

/**
 * @route   GET /api/materials/thread/template
 * @desc    Download Excel template for bulk import
 * @access  Private
 */
router.get('/template', downloadTemplate);

/**
 * @route   GET /api/materials/thread/:id
 * @desc    Get single thread item by ID
 * @access  Private
 */
router.get('/:id', getThreadById);

/**
 * @route   PUT /api/materials/thread/:id
 * @desc    Update thread item
 * @access  Private
 */
router.put('/:id', updateThread);

/**
 * @route   DELETE /api/materials/thread/:id
 * @desc    Delete thread item
 * @access  Private
 */
router.delete('/:id', deleteThread);

/**
 * @route   POST /api/materials/thread/bulk-import
 * @desc    Bulk import thread items from Excel
 * @access  Private
 */
router.post('/bulk-import', bulkImportThreads);

export default router;
