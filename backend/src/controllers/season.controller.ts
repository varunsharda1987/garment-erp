/**
 * Season Master Controller
 * Handles HTTP requests for season master operations
 */

import { Request, Response } from 'express';
import { SeasonService } from '../services/season.service';
import { NotFoundError, ConflictError, ValidationError } from '../errors';
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
  const data: CreateSeasonInput = req.body;
  const season = await SeasonService.createSeason(data);

  res.status(201).json({
    data: season,
    message: 'Season created successfully',
  });
};

/**
 * Get all seasons with pagination and filters
 * GET /api/seasons
 */
export const getAllSeasons = async (req: Request, res: Response): Promise<void> => {
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
};

/**
 * Get season by ID
 * GET /api/seasons/:id
 */
export const getSeasonById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const season = await SeasonService.getById(id);

  res.json({
    data: season,
  });
};

/**
 * Update season
 * PUT /api/seasons/:id
 */
export const updateSeason = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const data: UpdateSeasonInput = req.body;
  const season = await SeasonService.updateSeason(id, data);

  res.json({
    data: season,
    message: 'Season updated successfully',
  });
};

/**
 * Delete season (soft delete)
 * DELETE /api/seasons/:id
 */
export const deleteSeason = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  await SeasonService.deleteSeason(id);

  res.json({
    message: 'Season deleted successfully',
  });
};

/**
 * Search seasons (for dropdowns)
 * GET /api/seasons/search
 */
export const searchSeasons = async (req: Request, res: Response): Promise<void> => {
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
};

/**
 * Get season types (fixed list)
 * GET /api/seasons/types
 */
export const getSeasonTypes = async (_req: Request, res: Response): Promise<void> => {
  const types = SEASON_TYPES.map((type) => ({
    code: type,
    name: SEASON_TYPE_NAMES[type],
  }));

  res.json({
    data: types,
  });
};

/**
 * Generate seasons for year range
 * POST /api/seasons/generate
 */
export const generateSeasons = async (req: Request, res: Response): Promise<void> => {
  const data: GenerateSeasonsInput = req.body;

  if (!data.startYear || !data.endYear) {
    throw new ValidationError('startYear and endYear are required');
  }

  if (data.startYear > data.endYear) {
    throw new ValidationError('startYear must be less than or equal to endYear');
  }

  if (data.endYear - data.startYear > 20) {
    throw new ValidationError('Year range cannot exceed 20 years');
  }

  const result = await SeasonService.generateSeasons(data);

  res.json({
    data: result,
    message: `Generated ${result.created} seasons, skipped ${result.skipped} existing`,
  });
};
