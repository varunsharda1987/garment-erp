/**
 * Lace Costing Controller
 * API endpoints for lace cost calculation with sourcing strategies
 */

import { Request, Response } from 'express';
import {
  calculateLaceCost,
  calculateBatchLaceCost,
  validateGreigeProcessingForPO,
} from '../services/laceCostingCalculation.service';
import { serialize } from '../utils/serializer';

/**
 * POST /api/lace-costing/calculate
 * Calculate lace cost with all sourcing options
 */
export async function calculateSingleLaceCost(req: Request, res: Response) {
  try {
    const {
      laceId,
      quantityPerGarment,
      orderQuantity,
      wastagePercent,
      styleId,
      costSheetId,
    } = req.body;

    // Validation
    if (!laceId || quantityPerGarment === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: laceId, quantityPerGarment',
      });
    }

    const result = await calculateLaceCost({
      laceId,
      quantityPerGarment: parseFloat(quantityPerGarment),
      orderQuantity: orderQuantity ? parseInt(orderQuantity) : undefined,
      wastagePercent: wastagePercent ? parseFloat(wastagePercent) : undefined,
      styleId,
      costSheetId,
    });

    res.json(serialize({
      success: true,
      data: result,
    }));
  } catch (error: any) {
    console.error('Error calculating lace cost:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to calculate lace cost',
    });
  }
}

/**
 * POST /api/lace-costing/batch-calculate
 * Calculate costs for multiple lace items
 */
export async function calculateBatchLaceCosts(req: Request, res: Response) {
  try {
    const { laceItems, orderQuantity, styleId, costSheetId } = req.body;

    if (!laceItems || !Array.isArray(laceItems) || laceItems.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid laceItems array',
      });
    }

    // Map items with shared orderQuantity/styleId
    const items = laceItems.map((item: any) => ({
      laceId: item.laceId,
      laceName: item.laceName,
      quantityPerGarment: parseFloat(item.quantityPerGarment),
      orderQuantity: item.orderQuantity
        ? parseInt(item.orderQuantity)
        : orderQuantity
          ? parseInt(orderQuantity)
          : undefined,
      wastagePercent: item.wastagePercent
        ? parseFloat(item.wastagePercent)
        : undefined,
      styleId: item.styleId || styleId,
      costSheetId: item.costSheetId || costSheetId,
    }));

    const result = await calculateBatchLaceCost(items);

    res.json(serialize({
      success: true,
      data: result,
    }));
  } catch (error: any) {
    console.error('Error in batch lace cost calculation:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to calculate batch lace costs',
    });
  }
}

/**
 * POST /api/lace-costing/validate-po
 * Validate if lace costing item is ready for PO generation
 * (checks lab dip approval for GREIGE_PROCESSED strategy)
 */
export async function validateLaceCostingForPO(req: Request, res: Response) {
  try {
    const { costingItemId } = req.body;

    if (!costingItemId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: costingItemId',
      });
    }

    const validation = await validateGreigeProcessingForPO(costingItemId);

    res.json(serialize({
      success: true,
      data: validation,
    }));
  } catch (error: any) {
    console.error('Error validating lace costing for PO:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to validate lace costing',
    });
  }
}

export default {
  calculateSingleLaceCost,
  calculateBatchLaceCosts,
  validateLaceCostingForPO,
};
