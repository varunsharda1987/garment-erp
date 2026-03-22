// Import Routes
import { Router } from 'express';
import * as importController from '../controllers/import.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { uploadImportFile } from '../middleware/upload.middleware';

const router = Router();

/**
 * @route   POST /api/import/:module/preview
 * @desc    Preview import data (first 100 rows) with validation
 * @access  Private
 * @file    CSV or Excel file
 */
router.post('/:module/preview', authenticateToken, uploadImportFile, asyncHandler(importController.previewImport));

/**
 * @route   POST /api/import/:module/execute
 * @desc    Execute import after validation
 * @access  Private
 * @file    CSV or Excel file
 */
router.post('/:module/execute', authenticateToken, uploadImportFile, asyncHandler(importController.executeImport));

/**
 * @route   GET /api/import/:module/template?format=csv|excel
 * @desc    Download import template for a module
 * @access  Private
 */
router.get('/:module/template', authenticateToken, asyncHandler(importController.downloadTemplate));

export default router;
