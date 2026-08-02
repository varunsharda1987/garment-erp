/**
 * Color Master Controller
 * Handles HTTP requests for color master operations
 */

import { Request, Response } from 'express';
import { ColorService } from '../services/color.service';
import { NotFoundError, ConflictError, ValidationError } from '../errors';
import type { ColorQueryInput, ColorSearchInput, CreateColorInput, UpdateColorInput } from '../schemas/color.schema';

/**
 * Create new color
 * POST /api/colors
 */
export const createColor = async (req: Request, res: Response): Promise<void> => {
  const data: CreateColorInput = req.body;
  const color = await ColorService.createColor(data);

  res.status(201).json({
    data: color,
    message: 'Color created successfully',
  });
};

/**
 * Get all colors with pagination and filters
 * GET /api/colors
 */
export const getAllColors = async (req: Request, res: Response): Promise<void> => {
  const query = ((req as any).validatedQuery ?? req.query) as ColorQueryInput;

  const result = await ColorService.getAllColors({
    page: Number(query.page) || 1,
    limit: Math.max(1, Number(query.limit) || 10),
    search: query.search,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    colorFamily: query.colorFamily,
    isActive: query.isActive !== undefined ? String(query.isActive) === 'true' : undefined,
  });

  res.json({
    data: result.data,
    pagination: result.pagination,
  });
};

/**
 * Get color by ID
 * GET /api/colors/:id
 */
export const getColorById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const color = await ColorService.getById(id);

  res.json({
    data: color,
  });
};

/**
 * Update color
 * PUT /api/colors/:id
 */
export const updateColor = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const data: UpdateColorInput = req.body;
  const color = await ColorService.updateColor(id, data);

  res.json({
    data: color,
    message: 'Color updated successfully',
  });
};

/**
 * Delete color (soft delete)
 * DELETE /api/colors/:id
 */
export const deleteColor = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  await ColorService.deleteColor(id);

  res.json({
    message: 'Color deleted successfully',
  });
};

/**
 * Search colors (for dropdowns)
 * GET /api/colors/search
 */
export const searchColors = async (req: Request, res: Response): Promise<void> => {
  const query = req.query as unknown as ColorSearchInput;
  const colors = await ColorService.searchColors({
    search: query.search,
    colorFamily: query.colorFamily,
    limit: query.limit || 50,
  });

  res.json({
    data: colors,
  });
};

/**
 * Get color families (fixed list)
 * GET /api/colors/families
 */
export const getColorFamilies = async (_req: Request, res: Response): Promise<void> => {
  const families = ColorService.getFamilies();

  res.json({
    data: families,
  });
};

/**
 * Bulk import colors
 * POST /api/colors/bulk-import
 * BUG-COL3 Fix: Removed dead validation - route middleware already validates via colorBulkImportSchema
 */
export const bulkImportColors = async (req: Request, res: Response): Promise<void> => {
  const { colors } = req.body;
  // Validation is handled by validateBody(colorBulkImportSchema) middleware in routes
  const result = await ColorService.bulkImport(colors);

  res.json({
    data: result,
    message: `Import completed: ${result.success} successful, ${result.failed} failed`,
  });
};

/**
 * Get import template
 * GET /api/colors/template
 */
export const getImportTemplate = async (_req: Request, res: Response): Promise<void> => {
  // Return template structure for Excel import
  const template = {
    columns: [
      { field: 'colorName', header: 'Color Name', required: true, description: 'Name of the color (e.g., Navy Blue)' },
      { field: 'hexCode', header: 'Hex Code', required: false, description: 'Color hex code (e.g., #000080)' },
      {
        field: 'colorFamily',
        header: 'Color Family',
        required: false,
        description:
          'Family: Reds, Blues, Greens, Yellows, Oranges, Purples, Pinks, Browns, Neutrals, Prints, Metallics',
      },
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
};
