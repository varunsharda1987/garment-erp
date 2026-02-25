/**
 * Style Tech Specs Controller
 * Handles HTTP requests for style technical specifications
 */
import { Request, Response } from 'express';
import { styleTechSpecsService } from '../services/style-tech-specs.service';
import { NotFoundError, ValidationError } from '../errors';
import { logError } from '../utils/logger';

/**
 * Get tech specs for a style
 * GET /api/styles/:styleId/tech-specs
 */
export const getTechSpecs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { styleId } = req.params;
    const specs = await styleTechSpecsService.getByStyleId(styleId);

    res.status(200).json({
      data: specs,
    });
  } catch (error) {
    handleError(res, error, 'Failed to get tech specs');
  }
};

/**
 * Create or update tech specs for a style
 * PUT /api/styles/:styleId/tech-specs
 */
export const saveTechSpecs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { styleId } = req.params;
    const {
      overallLength,
      topLength,
      bottomLength,
      lengthUnit,
      sleeveType,
      collarType,
      fitType,
      closureType,
      designNotes,
      constructionNotes,
    } = req.body;

    const specs = await styleTechSpecsService.upsert(styleId, {
      overallLength,
      topLength,
      bottomLength,
      lengthUnit,
      sleeveType,
      collarType,
      fitType,
      closureType,
      designNotes,
      constructionNotes,
    });

    res.status(200).json({
      data: specs,
      message: 'Tech specs saved successfully',
    });
  } catch (error) {
    handleError(res, error, 'Failed to save tech specs');
  }
};

/**
 * Delete tech specs for a style
 * DELETE /api/styles/:styleId/tech-specs
 */
export const deleteTechSpecs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { styleId } = req.params;
    await styleTechSpecsService.delete(styleId);

    res.status(200).json({
      message: 'Tech specs deleted successfully',
    });
  } catch (error) {
    handleError(res, error, 'Failed to delete tech specs');
  }
};

/**
 * Get dropdown options for tech specs form
 * GET /api/styles/tech-specs/options
 */
export const getOptions = async (_req: Request, res: Response): Promise<void> => {
  try {
    const options = styleTechSpecsService.getOptions();

    res.status(200).json({
      data: options,
    });
  } catch (error) {
    handleError(res, error, 'Failed to get options');
  }
};

/**
 * Get style data for tech pack PDF
 * GET /api/styles/:styleId/tech-pack-data
 */
export const getTechPackData = async (req: Request, res: Response): Promise<void> => {
  try {
    const { styleId } = req.params;
    const data = await styleTechSpecsService.getStyleForTechPack(styleId);

    res.status(200).json({
      data,
    });
  } catch (error) {
    handleError(res, error, 'Failed to get tech pack data');
  }
};

/**
 * Error handler helper
 */
function handleError(res: Response, error: unknown, defaultMessage: string): void {
  if (error instanceof NotFoundError) {
    res.status(404).json({ error: error.message });
  } else if (error instanceof ValidationError) {
    res.status(400).json({ error: error.message });
  } else {
    logError(defaultMessage, error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({ error: defaultMessage });
  }
}
