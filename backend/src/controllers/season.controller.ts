/**
 * Season Master Controller
 * Handles HTTP requests for season master operations
 * BUG-SEA5 Fix: Removed duplicate type definitions, now imports from schema
 */

import { Request, Response } from 'express';
import { SeasonService } from '../services/season.service';
import { SEASON_TYPES, SEASON_TYPE_NAMES } from '../types/season.types';
import type {
  CreateSeasonInput,
  UpdateSeasonInput,
  GenerateSeasonsInput,
  SeasonQueryInput,
  SeasonSearchInput,
} from '../schemas/season.schema';

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
  // Use validatedQuery (transformed values) or fallback to raw query
  const query = ((req as any).validatedQuery ?? req.query) as SeasonQueryInput;

  const result = await SeasonService.getAllSeasons({
    page: query.page || 1,
    limit: query.limit || 50,
    search: query.search,
    sortBy: query.sortBy as string | undefined,
    sortOrder: query.sortOrder as 'asc' | 'desc' | undefined,
    year: query.year,
    seasonType: query.seasonType,
    isActive: query.isActive,
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
  // Use validatedQuery (transformed values) or fallback to raw query
  const query = ((req as any).validatedQuery ?? req.query) as SeasonSearchInput;
  const seasons = await SeasonService.searchSeasons({
    search: query.search,
    year: query.year,
    seasonType: query.seasonType,
    limit: query.limit || 50,
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
 * BUG-SEA6 Fix: Removed redundant manual validation - Zod schema handles all validation
 */
export const generateSeasons = async (req: Request, res: Response): Promise<void> => {
  const data: GenerateSeasonsInput = req.body;
  // Validation is handled by validateBody(generateSeasonsSchema) middleware in routes:
  // - startYear and endYear are required (z.number())
  // - endYear >= startYear (.refine)
  // - Year range <= 20 years (.refine)

  const result = await SeasonService.generateSeasons(data);

  res.json({
    data: result,
    message: `Generated ${result.created} seasons, skipped ${result.skipped} existing`,
  });
};
