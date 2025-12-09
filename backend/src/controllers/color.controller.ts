/**
 * Color Master Controller
 * Handles HTTP requests for color master operations
 */

import { Request, Response } from 'express';
import { ColorService } from '../services/color.service';
import { logError, logInfo } from '../utils/logger';
import { NotFoundError, ConflictError, ValidationError } from '../errors';
import type { ColorQueryInput, ColorSearchInput, CreateColorInput, UpdateColorInput } from '../schemas/color.schema';

/**
 * Create new color
 * POST /api/colors
 */
export const createColor = async (req: Request, res: Response): Promise<void> => {
  try {
    const data: CreateColorInput = req.body;
    const color = await ColorService.createColor(data);

    res.status(201).json({
      data: color,
      message: 'Color created successfully',
    });
  } catch (error) {
    if (error instanceof ConflictError) {
      res.status(409).json({
        error: 'Conflict',
        message: error.message,
      });
      return;
    }
    logError('Create color error', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create color',
    });
  }
};

/**
 * Get all colors with pagination and filters
 * GET /api/colors
 */
export const getAllColors = async (req: Request, res: Response): Promise<void> => {
  try {
    const query = req.query as unknown as ColorQueryInput;

    const result = await ColorService.getAllColors({
      page: query.page || 1,
      limit: query.limit || 10,
      search: query.search,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      colorFamily: query.colorFamily,
      isActive: query.isActive,
    });

    res.json({
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    logError('Get all colors error', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch colors',
    });
  }
};

/**
 * Get color by ID
 * GET /api/colors/:id
 */
export const getColorById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const color = await ColorService.getById(id);

    res.json({
      data: color,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json({
        error: 'Not Found',
        message: error.message,
      });
      return;
    }
    logError('Get color by ID error', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch color',
    });
  }
};

/**
 * Update color
 * PUT /api/colors/:id
 */
export const updateColor = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const data: UpdateColorInput = req.body;
    const color = await ColorService.updateColor(id, data);

    res.json({
      data: color,
      message: 'Color updated successfully',
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
    logError('Update color error', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update color',
    });
  }
};

/**
 * Delete color (soft delete)
 * DELETE /api/colors/:id
 */
export const deleteColor = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await ColorService.deleteColor(id);

    res.json({
      message: 'Color deleted successfully',
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json({
        error: 'Not Found',
        message: error.message,
      });
      return;
    }
    logError('Delete color error', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete color',
    });
  }
};

/**
 * Search colors (for dropdowns)
 * GET /api/colors/search
 */
export const searchColors = async (req: Request, res: Response): Promise<void> => {
  try {
    const query = req.query as unknown as ColorSearchInput;
    const colors = await ColorService.searchColors({
      search: query.search,
      colorFamily: query.colorFamily,
      limit: query.limit || 50,
    });

    res.json({
      data: colors,
    });
  } catch (error) {
    logError('Search colors error', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to search colors',
    });
  }
};

/**
 * Get color families (fixed list)
 * GET /api/colors/families
 */
export const getColorFamilies = async (_req: Request, res: Response): Promise<void> => {
  try {
    const families = ColorService.getFamilies();

    res.json({
      data: families,
    });
  } catch (error) {
    logError('Get color families error', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch color families',
    });
  }
};

/**
 * Bulk import colors
 * POST /api/colors/bulk-import
 */
export const bulkImportColors = async (req: Request, res: Response): Promise<void> => {
  try {
    const { colors } = req.body;

    if (!colors || !Array.isArray(colors) || colors.length === 0) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Colors array is required and must not be empty',
      });
      return;
    }

    const result = await ColorService.bulkImport(colors);

    res.json({
      data: result,
      message: `Import completed: ${result.success} successful, ${result.failed} failed`,
    });
  } catch (error) {
    logError('Bulk import colors error', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to import colors',
    });
  }
};

/**
 * Get import template
 * GET /api/colors/template
 */
export const getImportTemplate = async (_req: Request, res: Response): Promise<void> => {
  try {
    // Return template structure for Excel import
    const template = {
      columns: [
        { field: 'colorName', header: 'Color Name', required: true, description: 'Name of the color (e.g., Navy Blue)' },
        { field: 'hexCode', header: 'Hex Code', required: false, description: 'Color hex code (e.g., #000080)' },
        { field: 'colorFamily', header: 'Color Family', required: false, description: 'Family: Reds, Blues, Greens, Yellows, Oranges, Purples, Pinks, Browns, Neutrals, Prints, Metallics' },
        { field: 'description', header: 'Description', required: false, description: 'Optional description' },
      ],
      sampleData: [
        { colorName: 'Navy Blue', hexCode: '#000080', colorFamily: 'Blues', description: 'Deep navy blue' },
        { colorName: 'Crimson', hexCode: '#DC143C', colorFamily: 'Reds', description: 'Bright crimson red' },
        { colorName: 'Forest Green', hexCode: '#228B22', colorFamily: 'Greens', description: 'Deep forest green' },
      ],
    };

    res.json({
      data: template,
    });
  } catch (error) {
    logError('Get import template error', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get import template',
    });
  }
};
