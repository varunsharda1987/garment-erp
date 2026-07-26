/**
 * Color Master Service
 * Business logic for color master operations
 */

import prisma from '../config/database';
import { BaseService, PaginationOptions, PaginatedResult, IncludeConfig } from './base.service';
import { NotFoundError, ConflictError } from '../errors';
import { logError, logInfo, logDebug } from '../utils/logger';
import { SearchFilter, OrderByClause } from '../types/prisma.types';
import type { CreateColorInput, UpdateColorInput, ColorSearchInput } from '../schemas/color.schema';
import type { ColorMaster, ColorSearchResult, ColorBulkImportResult, ColorImportRow } from '../types/color.types';
import { COLOR_FAMILIES } from '../types/color.types';
import { generateAtomicMasterCode } from '../utils/atomicCodeGenerator';

/**
 * Color Service Class
 */
class ColorServiceClass extends BaseService<ColorMaster, CreateColorInput, UpdateColorInput> {
  protected readonly modelName = 'color_master';
  protected readonly entityName = 'Color';

  protected get model() {
    return prisma.color_master as unknown as {
      create: (args: { data: unknown; include?: IncludeConfig }) => Promise<ColorMaster>;
      findUnique: (args: { where: { id: string }; include?: IncludeConfig }) => Promise<ColorMaster | null>;
      findFirst: (args: { where?: Record<string, unknown>; include?: IncludeConfig }) => Promise<ColorMaster | null>;
      findMany: (args: {
        where?: Record<string, unknown>;
        skip?: number;
        take?: number;
        orderBy?: Record<string, 'asc' | 'desc'>;
        include?: IncludeConfig;
      }) => Promise<ColorMaster[]>;
      update: (args: { where: { id: string }; data: unknown; include?: IncludeConfig }) => Promise<ColorMaster>;
      delete: (args: { where: { id: string } }) => Promise<ColorMaster>;
      count: (args: { where?: Record<string, unknown> }) => Promise<number>;
    };
  }

  protected buildSearchFilter(search: string): SearchFilter {
    return [
      { colorName: { contains: search, mode: 'insensitive' } },
      { colorCode: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  protected getDefaultIncludes(): IncludeConfig {
    return undefined; // No relations needed by default
  }

  /**
   * Generate unique color code (CLR001, CLR002, etc.)
   */
  private async generateColorCode(): Promise<string> {
    // Atomic sequence; strip the helper's dash to keep the CLR001 format
    const code = await generateAtomicMasterCode('CLR', 3);
    return code.replace('CLR-', 'CLR');
  }

  /**
   * Create a new color
   */
  async createColor(data: CreateColorInput): Promise<ColorMaster> {
    try {
      logDebug('Creating color', { data });

      // Check for duplicate color name (only among active colors)
      const existing = await prisma.color_master.findFirst({
        where: {
          colorName: {
            equals: data.colorName,
            mode: 'insensitive',
          },
          isActive: true,
        },
      });

      if (existing) {
        throw new ConflictError(`Color with name '${data.colorName}' already exists`);
      }

      // Generate color code
      const colorCode = await this.generateColorCode();

      const color = await prisma.color_master.create({
        data: {
          colorCode,
          colorName: data.colorName,
          hexCode: data.hexCode || null,
          colorFamily: data.colorFamily || null,
          description: data.description || null,
          isActive: data.isActive ?? true,
          sortOrder: data.sortOrder ?? 0,
        },
      });

      logInfo('Color created successfully', { id: color.id, colorCode: color.colorCode });
      return color as ColorMaster;
    } catch (error) {
      if (error instanceof ConflictError) throw error;
      logError('Failed to create color', error instanceof Error ? error : new Error(String(error)));
      this.handlePrismaError(error);
      throw error;
    }
  }

  /**
   * Update a color
   */
  async updateColor(id: string, data: UpdateColorInput): Promise<ColorMaster> {
    try {
      logDebug('Updating color', { id, data });

      // Verify color exists
      const existing = await this.findByIdOrThrow(id);

      // Check for duplicate color name if changing
      if (data.colorName && data.colorName !== (existing as ColorMaster).colorName) {
        const duplicate = await prisma.color_master.findFirst({
          where: {
            colorName: {
              equals: data.colorName,
              mode: 'insensitive',
            },
            id: {
              not: id,
            },
          },
        });

        if (duplicate) {
          throw new ConflictError(`Color with name '${data.colorName}' already exists`);
        }
      }

      const color = await prisma.color_master.update({
        where: { id },
        data: {
          ...(data.colorName !== undefined && { colorName: data.colorName }),
          ...(data.hexCode !== undefined && { hexCode: data.hexCode }),
          ...(data.colorFamily !== undefined && { colorFamily: data.colorFamily }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
          ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        },
      });

      logInfo('Color updated successfully', { id });
      return color as ColorMaster;
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ConflictError) throw error;
      logError('Failed to update color', error instanceof Error ? error : new Error(String(error)));
      this.handlePrismaError(error);
      throw error;
    }
  }

  /**
   * Get all colors with pagination and filters
   */
  async getAllColors(
    options: PaginationOptions & { colorFamily?: string; isActive?: boolean }
  ): Promise<PaginatedResult<ColorMaster>> {
    try {
      const { page, limit, search, sortBy, sortOrder, colorFamily, isActive } = options;
      const skip = (page - 1) * limit;

      // Build where clause
      const where: Record<string, unknown> = {};

      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      if (colorFamily) {
        where.colorFamily = colorFamily;
      }

      if (search) {
        where.OR = this.buildSearchFilter(search);
      }

      // Count total
      const total = await prisma.color_master.count({ where });

      // Build orderBy
      const orderBy: OrderByClause = sortBy ? { [sortBy]: sortOrder || 'asc' } : { sortOrder: 'asc' };

      // Fetch colors
      const colors = await prisma.color_master.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      });

      return {
        data: colors as ColorMaster[],
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logError('Failed to get all colors', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Search colors (for dropdowns - minimal data)
   */
  async searchColors(params: ColorSearchInput): Promise<ColorSearchResult[]> {
    try {
      const { search, colorFamily, limit = 50 } = params;
      // Ensure limit is a number (query params may come as strings)
      const takeLimit = typeof limit === 'string' ? parseInt(limit, 10) : limit;

      const where: Record<string, unknown> = {
        isActive: true,
      };

      if (colorFamily) {
        where.colorFamily = colorFamily;
      }

      if (search) {
        where.OR = [
          { colorName: { contains: search, mode: 'insensitive' } },
          { colorCode: { contains: search, mode: 'insensitive' } },
        ];
      }

      const colors = await prisma.color_master.findMany({
        where,
        take: takeLimit,
        orderBy: { colorName: 'asc' },
        select: {
          id: true,
          colorCode: true,
          colorName: true,
          hexCode: true,
          colorFamily: true,
        },
      });

      return colors as ColorSearchResult[];
    } catch (error) {
      logError('Failed to search colors', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get distinct color families (returns the fixed list)
   */
  getFamilies(): string[] {
    return [...COLOR_FAMILIES];
  }

  /**
   * Bulk import colors
   */
  async bulkImport(colors: ColorImportRow[]): Promise<ColorBulkImportResult> {
    const result: ColorBulkImportResult = {
      success: 0,
      failed: 0,
      errors: [],
    };

    for (let i = 0; i < colors.length; i++) {
      const row = colors[i];
      const rowNumber = i + 2; // Excel row (1-indexed + header)

      try {
        // Check for duplicate
        const existing = await prisma.color_master.findFirst({
          where: {
            colorName: {
              equals: row.colorName,
              mode: 'insensitive',
            },
          },
        });

        if (existing) {
          result.failed++;
          result.errors.push({
            row: rowNumber,
            colorName: row.colorName,
            error: `Color '${row.colorName}' already exists`,
          });
          continue;
        }

        // Generate code and create
        const colorCode = await this.generateColorCode();

        await prisma.color_master.create({
          data: {
            colorCode,
            colorName: row.colorName,
            hexCode: row.hexCode || null,
            colorFamily: row.colorFamily || null,
            description: row.description || null,
            isActive: true,
            sortOrder: 0,
          },
        });

        result.success++;
      } catch (error) {
        // allow-swallow — per-row bulk-import reporter: single-table create, the failure is surfaced in result.errors[]
        result.failed++;
        result.errors.push({
          row: rowNumber,
          colorName: row.colorName,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logInfo('Bulk import completed', { success: result.success, failed: result.failed });
    return result;
  }

  /**
   * Get color by ID
   */
  async getById(id: string): Promise<ColorMaster> {
    const color = await prisma.color_master.findUnique({
      where: { id },
    });

    if (!color) {
      throw new NotFoundError('Color', id);
    }

    return color as ColorMaster;
  }

  /**
   * Delete color (soft delete)
   */
  async deleteColor(id: string): Promise<void> {
    await this.findByIdOrThrow(id);
    await this.softDelete(id);
  }
}

// Export singleton instance
export const ColorService = new ColorServiceClass();
