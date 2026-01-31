/**
 * Season Master Controller
 * Handles HTTP requests for season master operations
 */

import { Request, Response } from 'express';
import { SeasonService } from '../services/season.service';
import { logError } from '../utils/logger';
import { NotFoundError, ConflictError } from '../errors';
import type { SeasonType } from '../types/season.types';
import { SEASON_TYPES, SEASON_TYPE_NAMES } from '../types/season.types';

/**
 * Query input types
 */
interface SeasonQueryInput {
  page?: string;
  limit?: string;
  search?: string;
  year?: string;
  seasonType?: SeasonType;
  isActive?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface SeasonSearchInput {
  search?: string;
  year?: string;
  seasonType?: SeasonType;
  limit?: string | number;
}

interface CreateSeasonInput {
  code: string;
  name: string;
  year: number;
  seasonType: SeasonType;
  sortOrder?: number;
  isActive?: boolean;
}

interface UpdateSeasonInput {
  code?: string;
  name?: string;
  year?: number;
  seasonType?: SeasonType;
  sortOrder?: number;
  isActive?: boolean;
}

interface GenerateSeasonsInput {
  startYear: number;
  endYear: number;
  seasonTypes?: SeasonType[];
}

/**
 * Create new season
 * POST /api/seasons
 */
export const createSeason = async (req: Request, res: Response): Promise<void> => {
  try {
    const data: CreateSeasonInput = req.body;
    const season = await SeasonService.createSeason(data);

    res.status(201).json({
      data: season,
      message: 'Season created successfully',
    });
  } catch (error) {
    if (error instanceof ConflictError) {
      res.status(409).json({
        error: 'Conflict',
        message: error.message,
      });
      return;
    }
    logError('Create season error', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create season',
    });
  }
};

/**
 * Get all seasons with pagination and filters
 * GET /api/seasons
 */
export const getAllSeasons = async (req: Request, res: Response): Promise<void> => {
  try {
    const query = req.query as unknown as SeasonQueryInput;

    const result = await SeasonService.getAllSeasons({
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 50,
      search: query.search,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      year: query.year ? Number(query.year) : undefined,
      seasonType: query.seasonType,
      isActive: query.isActive !== undefined ? String(query.isActive) === 'true' : undefined,
    });

    res.json({
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    logError('Get all seasons error', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch seasons',
    });
  }
};

/**
 * Get season by ID
 * GET /api/seasons/:id
 */
export const getSeasonById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const season = await SeasonService.getById(id);

    res.json({
      data: season,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json({
        error: 'Not Found',
        message: error.message,
      });
      return;
    }
    logError('Get season by ID error', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch season',
    });
  }
};

/**
 * Update season
 * PUT /api/seasons/:id
 */
export const updateSeason = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const data: UpdateSeasonInput = req.body;
    const season = await SeasonService.updateSeason(id, data);

    res.json({
      data: season,
      message: 'Season updated successfully',
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json({
        error: 'Not Found',
        message: error.message,
      });
      return;
    }
    if (error instanceof ConflictError) {
      res.status(409).json({
        error: 'Conflict',
        message: error.message,
      });
      return;
    }
    logError('Update season error', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update season',
    });
  }
};

/**
 * Delete season (soft delete)
 * DELETE /api/seasons/:id
 */
export const deleteSeason = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await SeasonService.deleteSeason(id);

    res.json({
      message: 'Season deleted successfully',
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json({
        error: 'Not Found',
        message: error.message,
      });
      return;
    }
    logError('Delete season error', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete season',
    });
  }
};

/**
 * Search seasons (for dropdowns)
 * GET /api/seasons/search
 */
export const searchSeasons = async (req: Request, res: Response): Promise<void> => {
  try {
    const query = req.query as unknown as SeasonSearchInput;
    const seasons = await SeasonService.searchSeasons({
      search: query.search,
      year: query.year ? Number(query.year) : undefined,
      seasonType: query.seasonType,
      limit: query.limit ? Number(query.limit) : 50,
    });

    res.json({
      data: seasons,
    });
  } catch (error) {
    logError('Search seasons error', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to search seasons',
    });
  }
};

/**
 * Get season types (fixed list)
 * GET /api/seasons/types
 */
export const getSeasonTypes = async (_req: Request, res: Response): Promise<void> => {
  try {
    const types = SEASON_TYPES.map((type) => ({
      code: type,
      name: SEASON_TYPE_NAMES[type],
    }));

    res.json({
      data: types,
    });
  } catch (error) {
    logError('Get season types error', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch season types',
    });
  }
};

/**
 * Generate seasons for year range
 * POST /api/seasons/generate
 */
export const generateSeasons = async (req: Request, res: Response): Promise<void> => {
  try {
    const data: GenerateSeasonsInput = req.body;

    if (!data.startYear || !data.endYear) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'startYear and endYear are required',
      });
      return;
    }

    if (data.startYear > data.endYear) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'startYear must be less than or equal to endYear',
      });
      return;
    }

    if (data.endYear - data.startYear > 20) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Year range cannot exceed 20 years',
      });
      return;
    }

    const result = await SeasonService.generateSeasons(data);

    res.json({
      data: result,
      message: `Generated ${result.created} seasons, skipped ${result.skipped} existing`,
    });
  } catch (error) {
    logError('Generate seasons error', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to generate seasons',
    });
  }
};
