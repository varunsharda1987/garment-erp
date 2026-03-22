/**
 * Season Master Service
 * Business logic for season master operations
 */

import prisma from '../config/database';
import { BaseService, PaginationOptions, PaginatedResult, IncludeConfig } from './base.service';
import { NotFoundError, ConflictError } from '../errors';
import { logError, logInfo, logDebug } from '../utils/logger';
import { SearchFilter, OrderByClause } from '../types/prisma.types';
import type {
  SeasonMaster,
  SeasonSearchResult,
  SeasonType,
  GenerateSeasonsRequest,
  GenerateSeasonsResponse,
} from '../types/season.types';
import { SEASON_TYPE_NAMES } from '../types/season.types';

/**
 * Input types for season operations
 */
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

interface SeasonSearchInput {
  search?: string;
  year?: number;
  seasonType?: SeasonType;
  limit?: number;
}

/**
 * Season Service Class
 */
class SeasonServiceClass extends BaseService<SeasonMaster, CreateSeasonInput, UpdateSeasonInput> {
  protected readonly modelName = 'season_master';
  protected readonly entityName = 'Season';

  protected get model() {
    return prisma.season_master as unknown as {
      create: (args: { data: unknown; include?: IncludeConfig }) => Promise<SeasonMaster>;
      findUnique: (args: { where: { id: string }; include?: IncludeConfig }) => Promise<SeasonMaster | null>;
      findFirst: (args: { where?: Record<string, unknown>; include?: IncludeConfig }) => Promise<SeasonMaster | null>;
      findMany: (args: {
        where?: Record<string, unknown>;
        skip?: number;
        take?: number;
        orderBy?: Record<string, 'asc' | 'desc'> | Array<Record<string, 'asc' | 'desc'>>;
        include?: IncludeConfig;
      }) => Promise<SeasonMaster[]>;
      update: (args: { where: { id: string }; data: unknown; include?: IncludeConfig }) => Promise<SeasonMaster>;
      delete: (args: { where: { id: string } }) => Promise<SeasonMaster>;
      count: (args: { where?: Record<string, unknown> }) => Promise<number>;
    };
  }

  protected buildSearchFilter(search: string): SearchFilter {
    return [{ code: { contains: search, mode: 'insensitive' } }, { name: { contains: search, mode: 'insensitive' } }];
  }

  protected getDefaultIncludes(): IncludeConfig {
    return undefined; // No relations needed by default
  }

  /**
   * Calculate sort order for a season
   * Format: YYYYS where S is 1 for SS, 2 for AW
   */
  private calculateSortOrder(year: number, seasonType: SeasonType): number {
    const seasonOrder = seasonType === 'SS' ? 1 : 2;
    return year * 10 + seasonOrder;
  }

  /**
   * Create a new season
   */
  async createSeason(data: CreateSeasonInput): Promise<SeasonMaster> {
    try {
      logDebug('Creating season', { data });

      // Check for duplicate code
      const existing = await prisma.season_master.findUnique({
        where: { code: data.code },
      });

      if (existing) {
        throw new ConflictError(`Season with code '${data.code}' already exists`);
      }

      // Calculate sort order if not provided
      const sortOrder = data.sortOrder ?? this.calculateSortOrder(data.year, data.seasonType);

      const season = await prisma.season_master.create({
        data: {
          code: data.code.toUpperCase(),
          name: data.name,
          year: data.year,
          seasonType: data.seasonType,
          sortOrder,
          isActive: data.isActive ?? true,
        },
      });

      logInfo('Season created successfully', { id: season.id, code: season.code });
      return season as SeasonMaster;
    } catch (error) {
      if (error instanceof ConflictError) throw error;
      logError('Failed to create season', error instanceof Error ? error : new Error(String(error)));
      this.handlePrismaError(error);
      throw error;
    }
  }

  /**
   * Update a season
   */
  async updateSeason(id: string, data: UpdateSeasonInput): Promise<SeasonMaster> {
    try {
      logDebug('Updating season', { id, data });

      // Verify season exists
      const existing = await this.findByIdOrThrow(id);

      // Check for duplicate code if changing
      if (data.code && data.code !== (existing as SeasonMaster).code) {
        const duplicate = await prisma.season_master.findUnique({
          where: { code: data.code },
        });

        if (duplicate) {
          throw new ConflictError(`Season with code '${data.code}' already exists`);
        }
      }

      // Recalculate sort order if year or seasonType changed
      let sortOrder = data.sortOrder;
      if ((data.year !== undefined || data.seasonType !== undefined) && sortOrder === undefined) {
        const year = data.year ?? (existing as SeasonMaster).year;
        const seasonType = data.seasonType ?? (existing as SeasonMaster).seasonType;
        sortOrder = this.calculateSortOrder(year, seasonType);
      }

      const season = await prisma.season_master.update({
        where: { id },
        data: {
          ...(data.code !== undefined && { code: data.code.toUpperCase() }),
          ...(data.name !== undefined && { name: data.name }),
          ...(data.year !== undefined && { year: data.year }),
          ...(data.seasonType !== undefined && { seasonType: data.seasonType }),
          ...(sortOrder !== undefined && { sortOrder }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      });

      logInfo('Season updated successfully', { id });
      return season as SeasonMaster;
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ConflictError) throw error;
      logError('Failed to update season', error instanceof Error ? error : new Error(String(error)));
      this.handlePrismaError(error);
      throw error;
    }
  }

  /**
   * Get all seasons with pagination and filters
   */
  async getAllSeasons(
    options: PaginationOptions & { year?: number; seasonType?: SeasonType; isActive?: boolean }
  ): Promise<PaginatedResult<SeasonMaster>> {
    try {
      const { page, limit, search, sortBy, sortOrder, year, seasonType, isActive } = options;
      const skip = (page - 1) * limit;

      // Build where clause
      const where: Record<string, unknown> = {};

      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      if (year !== undefined) {
        where.year = year;
      }

      if (seasonType) {
        where.seasonType = seasonType;
      }

      if (search) {
        where.OR = this.buildSearchFilter(search);
      }

      // Count total
      const total = await prisma.season_master.count({ where });

      // Build orderBy - default to sortOrder descending (newest first)
      const orderBy: OrderByClause = sortBy ? { [sortBy]: sortOrder || 'asc' } : { sortOrder: 'desc' };

      // Fetch seasons
      const seasons = await prisma.season_master.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      });

      return {
        data: seasons as SeasonMaster[],
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logError('Failed to get all seasons', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Search seasons (for dropdowns - minimal data)
   */
  async searchSeasons(params: SeasonSearchInput): Promise<SeasonSearchResult[]> {
    try {
      const { search, year, seasonType, limit = 50 } = params;
      const takeLimit = typeof limit === 'string' ? parseInt(limit as string, 10) : limit;

      const where: Record<string, unknown> = {
        isActive: true,
      };

      if (year !== undefined) {
        where.year = year;
      }

      if (seasonType) {
        where.seasonType = seasonType;
      }

      if (search) {
        where.OR = [
          { code: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
        ];
      }

      const seasons = await prisma.season_master.findMany({
        where,
        take: takeLimit,
        orderBy: { sortOrder: 'desc' },
        select: {
          id: true,
          code: true,
          name: true,
          year: true,
          seasonType: true,
        },
      });

      return seasons as SeasonSearchResult[];
    } catch (error) {
      logError('Failed to search seasons', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Generate seasons for a year range
   */
  async generateSeasons(params: GenerateSeasonsRequest): Promise<GenerateSeasonsResponse> {
    const { startYear, endYear, seasonTypes = ['SS', 'AW'] } = params;
    const result: GenerateSeasonsResponse = {
      created: 0,
      skipped: 0,
      seasons: [],
    };

    for (let year = startYear; year <= endYear; year++) {
      for (const seasonType of seasonTypes) {
        const yearSuffix = year.toString().slice(-2);
        const code = `${seasonType}${yearSuffix}`;
        const name = `${SEASON_TYPE_NAMES[seasonType]} ${year}`;

        // Check if already exists
        const existing = await prisma.season_master.findUnique({
          where: { code },
        });

        if (existing) {
          result.skipped++;
          continue;
        }

        const season = await prisma.season_master.create({
          data: {
            code,
            name,
            year,
            seasonType,
            sortOrder: this.calculateSortOrder(year, seasonType),
            isActive: true,
          },
        });

        result.created++;
        result.seasons.push(season as SeasonMaster);
      }
    }

    logInfo('Seasons generated', { created: result.created, skipped: result.skipped });
    return result;
  }

  /**
   * Get season by ID
   */
  async getById(id: string): Promise<SeasonMaster> {
    const season = await prisma.season_master.findUnique({
      where: { id },
    });

    if (!season) {
      throw new NotFoundError('Season', id);
    }

    return season as SeasonMaster;
  }

  /**
   * Get season by code
   */
  async getByCode(code: string): Promise<SeasonMaster | null> {
    const season = await prisma.season_master.findUnique({
      where: { code: code.toUpperCase() },
    });

    return season as SeasonMaster | null;
  }

  /**
   * Find or create season by code pattern
   * Used during import to auto-create unmatched seasons
   */
  async findOrCreateByPattern(seasonText: string): Promise<SeasonMaster | null> {
    if (!seasonText || !seasonText.trim()) {
      return null;
    }

    const trimmed = seasonText.trim();

    // Try direct code match first
    const directMatch = await this.getByCode(trimmed);
    if (directMatch) {
      return directMatch;
    }

    // Pattern matching for common variations
    const patterns: { regex: RegExp; type: SeasonType }[] = [
      { regex: /^SS[-_\s]?(\d{2,4})$/i, type: 'SS' },
      { regex: /^AW[-_\s]?(\d{2,4})$/i, type: 'AW' },
      { regex: /^Summer[-_\s]?(\d{2,4})$/i, type: 'SS' },
      { regex: /^Winter[-_\s]?(\d{2,4})$/i, type: 'AW' },
      { regex: /^Spring[-_/]?Summer[-_\s]?(\d{2,4})$/i, type: 'SS' },
      { regex: /^Autumn[-_/]?Winter[-_\s]?(\d{2,4})$/i, type: 'AW' },
      { regex: /^Fall[-_/]?Winter[-_\s]?(\d{2,4})$/i, type: 'AW' },
      { regex: /^S\/S[-_\s]?(\d{2,4})$/i, type: 'SS' },
      { regex: /^A\/W[-_\s]?(\d{2,4})$/i, type: 'AW' },
      { regex: /^F\/W[-_\s]?(\d{2,4})$/i, type: 'AW' },
    ];

    for (const pattern of patterns) {
      const match = trimmed.match(pattern.regex);
      if (match) {
        let yearStr = match[1];
        let year = parseInt(yearStr, 10);

        // Handle 2-digit years
        if (year < 100) {
          year = year < 50 ? 2000 + year : 1900 + year;
        }

        const code = `${pattern.type}${year.toString().slice(-2)}`;

        // Check if this code exists
        const existingSeason = await this.getByCode(code);
        if (existingSeason) {
          return existingSeason;
        }

        // Create new season
        const name = `${SEASON_TYPE_NAMES[pattern.type]} ${year}`;
        const newSeason = await this.createSeason({
          code,
          name,
          year,
          seasonType: pattern.type,
        });

        logInfo('Auto-created season from pattern', { input: trimmed, code, name });
        return newSeason;
      }
    }

    // No pattern matched - create with original text as code
    logDebug('No pattern matched for season', { input: trimmed });
    return null;
  }

  /**
   * Delete season (soft delete)
   */
  async deleteSeason(id: string): Promise<void> {
    await this.findByIdOrThrow(id);
    await this.softDelete(id);
  }
}

// Export singleton instance
export const SeasonService = new SeasonServiceClass();
