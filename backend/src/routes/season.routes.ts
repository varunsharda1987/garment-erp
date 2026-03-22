/**
 * Season Master Routes
 * API routes for season master operations
 */

import { Router } from 'express';
import {
  createSeason,
  getAllSeasons,
  getSeasonById,
  updateSeason,
  deleteSeason,
  searchSeasons,
  getSeasonTypes,
  generateSeasons,
} from '../controllers/season.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/seasons/search
 * @desc    Search seasons for dropdown (minimal data)
 * @access  Private (Authenticated users)
 */
router.get('/search', asyncHandler(searchSeasons));

/**
 * @route   GET /api/seasons/types
 * @desc    Get season types (fixed list: SS, AW)
 * @access  Private (Authenticated users)
 */
router.get('/types', asyncHandler(getSeasonTypes));

/**
 * @route   POST /api/seasons/generate
 * @desc    Generate seasons for a year range
 * @access  Private (Authenticated users)
 */
router.post('/generate', asyncHandler(generateSeasons));

/**
 * @route   POST /api/seasons
 * @desc    Create new season
 * @access  Private (Authenticated users)
 */
router.post('/', asyncHandler(createSeason));

/**
 * @route   GET /api/seasons
 * @desc    Get all seasons with pagination and filters
 * @access  Private (Authenticated users)
 */
router.get('/', asyncHandler(getAllSeasons));

/**
 * @route   GET /api/seasons/:id
 * @desc    Get season by ID
 * @access  Private (Authenticated users)
 */
router.get('/:id', asyncHandler(getSeasonById));

/**
 * @route   PUT /api/seasons/:id
 * @desc    Update season
 * @access  Private (Authenticated users)
 */
router.put('/:id', asyncHandler(updateSeason));

/**
 * @route   DELETE /api/seasons/:id
 * @desc    Delete season (soft delete)
 * @access  Private (Authenticated users)
 */
router.delete('/:id', asyncHandler(deleteSeason));

export default router;
