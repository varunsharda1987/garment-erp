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
import { ValidationError } from '../errors';

/**
 * POST /api/lace-costing/calculate
 * Calculate lace cost with all sourcing options
 */
export async function calculateSingleLaceCost(req: Request, res: Response) {
  const { laceId, quantityPerGarment, orderQuantity, wastagePercent, styleId, costSheetId, processorId } = req.body;

  // Validation
  if (!laceId || quantityPerGarment === undefined) {
    throw new ValidationError('Missing required fields: laceId, quantityPerGarment');
  }

  const result = await calculateLaceCost({
    laceId,
    quantityPerGarment: parseFloat(quantityPerGarment),
    orderQuantity: orderQuantity ? parseInt(orderQuantity) : undefined,
    // costing-17: nullish check so a legal wastagePercent of 0 is not dropped
    wastagePercent: wastagePercent != null ? parseFloat(wastagePercent) : undefined,
    styleId,
    costSheetId,
    // Pins the dyeing processor when the user chose one explicitly.
    processorId: processorId || undefined,
  });

  res.json(
    serialize({
      success: true,
      data: result,
    })
  );
}

/**
 * POST /api/lace-costing/batch-calculate
 * Calculate costs for multiple lace items
 */
export async function calculateBatchLaceCosts(req: Request, res: Response) {
  const { laceItems, orderQuantity, styleId, costSheetId } = req.body;

  if (!laceItems || !Array.isArray(laceItems) || laceItems.length === 0) {
    throw new ValidationError('Missing or invalid laceItems array');
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
    // costing-17: nullish check so a legal wastagePercent of 0 is not dropped
    wastagePercent: item.wastagePercent != null ? parseFloat(item.wastagePercent) : undefined,
    styleId: item.styleId || styleId,
    costSheetId: item.costSheetId || costSheetId,
  }));

  const result = await calculateBatchLaceCost(items);

  res.json(
    serialize({
      success: true,
      data: result,
    })
  );
}

/**
 * POST /api/lace-costing/validate-po
 * Validate if lace costing item is ready for PO generation
 * (checks lab dip approval for GREIGE_PROCESSED strategy)
 */
export async function validateLaceCostingForPO(req: Request, res: Response) {
  const { costingItemId } = req.body;

  if (!costingItemId) {
    throw new ValidationError('Missing required field: costingItemId');
  }

  const validation = await validateGreigeProcessingForPO(costingItemId);

  res.json(
    serialize({
      success: true,
      data: validation,
    })
  );
}

export default {
  calculateSingleLaceCost,
  calculateBatchLaceCosts,
  validateLaceCostingForPO,
};
