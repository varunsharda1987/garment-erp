/**
 * Style Costing Lace Items Controller
 *
 * API endpoints for managing lace items within a style cost sheet.
 */

import { Request, Response } from 'express';
import {
  addLaceItemToCostSheet,
  updateLaceItem,
  removeLaceItem,
  getLaceItemsForCostSheet,
  getLaceItemById,
  calculateLaceItemCostOptions,
  bulkAddLaceItems,
} from '../services/styleCostingLaceItems.service';
import { serialize } from '../utils/serializer';
import { NotFoundError, ValidationError } from '../errors';
import logger from '../utils/logger';

/**
 * POST /api/style-costing/:costingId/lace-items
 * Add a lace item to a cost sheet
 */
export async function addLaceItem(req: Request, res: Response) {
  const { costingId } = req.params;
  const {
    laceId,
    laceName,
    colorName,
    width,
    quantityPerGarment,
    wastagePercent,
    sourcingStrategy,
    greigeCost,
    processingCost,
    readyLaceCost,
    stockCost,
    costPerMeter,
    greigeLaceId,
    processorId,
    rateCardId,
    stockLotId,
    procurementId,
    labDipId,
    labDipStatus,
    isManualOverride,
    overrideReason,
    notes,
  } = req.body;

  // Validation
  if (!laceId || !laceName || quantityPerGarment === undefined || !sourcingStrategy || costPerMeter === undefined) {
    throw new ValidationError(
      'Missing required fields: laceId, laceName, quantityPerGarment, sourcingStrategy, costPerMeter'
    );
  }

  // Validate sourcing strategy
  const validStrategies = ['STOCK_REUSE', 'READY_LACE', 'GREIGE_PROCESSED'];
  if (!validStrategies.includes(sourcingStrategy)) {
    throw new ValidationError(`Invalid sourcingStrategy. Must be one of: ${validStrategies.join(', ')}`);
  }

  const laceItem = await addLaceItemToCostSheet({
    costingId,
    laceId,
    laceName,
    colorName,
    width: width ? parseFloat(width) : undefined,
    quantityPerGarment: parseFloat(quantityPerGarment),
    // costing-17: nullish check so a legal wastagePercent of 0 is not dropped
    wastagePercent: wastagePercent != null ? parseFloat(wastagePercent) : undefined,
    sourcingStrategy,
    greigeCost: greigeCost ? parseFloat(greigeCost) : undefined,
    processingCost: processingCost ? parseFloat(processingCost) : undefined,
    readyLaceCost: readyLaceCost ? parseFloat(readyLaceCost) : undefined,
    stockCost: stockCost ? parseFloat(stockCost) : undefined,
    costPerMeter: parseFloat(costPerMeter),
    greigeLaceId,
    processorId,
    rateCardId,
    stockLotId,
    procurementId,
    labDipId,
    labDipStatus,
    isManualOverride,
    overrideReason,
    notes,
  });

  res.status(201).json(
    serialize({
      success: true,
      data: laceItem,
      message: 'Lace item added to cost sheet',
    })
  );
}

/**
 * PUT /api/style-costing/:costingId/lace-items/:itemId
 * Update a lace item in a cost sheet
 */
export async function updateLaceItemController(req: Request, res: Response) {
  const { itemId } = req.params;
  const updateData = req.body;

  // Validate sourcing strategy if provided
  if (updateData.sourcingStrategy) {
    const validStrategies = ['STOCK_REUSE', 'READY_LACE', 'GREIGE_PROCESSED'];
    if (!validStrategies.includes(updateData.sourcingStrategy)) {
      throw new ValidationError(`Invalid sourcingStrategy. Must be one of: ${validStrategies.join(', ')}`);
    }
  }

  // Parse numeric fields
  const parsedData: any = { ...updateData };
  if (updateData.width !== undefined) parsedData.width = parseFloat(updateData.width);
  if (updateData.quantityPerGarment !== undefined)
    parsedData.quantityPerGarment = parseFloat(updateData.quantityPerGarment);
  if (updateData.wastagePercent !== undefined) parsedData.wastagePercent = parseFloat(updateData.wastagePercent);
  if (updateData.greigeCost !== undefined)
    parsedData.greigeCost = updateData.greigeCost ? parseFloat(updateData.greigeCost) : undefined;
  if (updateData.processingCost !== undefined)
    parsedData.processingCost = updateData.processingCost ? parseFloat(updateData.processingCost) : undefined;
  if (updateData.readyLaceCost !== undefined)
    parsedData.readyLaceCost = updateData.readyLaceCost ? parseFloat(updateData.readyLaceCost) : undefined;
  if (updateData.stockCost !== undefined)
    parsedData.stockCost = updateData.stockCost ? parseFloat(updateData.stockCost) : undefined;
  if (updateData.costPerMeter !== undefined) parsedData.costPerMeter = parseFloat(updateData.costPerMeter);

  const laceItem = await updateLaceItem(itemId, parsedData);

  res.json(
    serialize({
      success: true,
      data: laceItem,
      message: 'Lace item updated',
    })
  );
}

/**
 * DELETE /api/style-costing/:costingId/lace-items/:itemId
 * Remove a lace item from a cost sheet
 */
export async function deleteLaceItem(req: Request, res: Response) {
  const { itemId } = req.params;

  await removeLaceItem(itemId);

  res.json(
    serialize({
      success: true,
      message: 'Lace item removed from cost sheet',
    })
  );
}

/**
 * GET /api/style-costing/:costingId/lace-items
 * Get all lace items for a cost sheet
 */
export async function getLaceItems(req: Request, res: Response) {
  const { costingId } = req.params;

  const items = await getLaceItemsForCostSheet(costingId);

  // Calculate total
  const totalCost = items.reduce((sum, item) => sum + Number(item.totalCost || 0), 0);

  res.json(
    serialize({
      success: true,
      data: {
        items,
        summary: {
          count: items.length,
          totalCost,
        },
      },
    })
  );
}

/**
 * GET /api/style-costing/:costingId/lace-items/:itemId
 * Get a single lace item by ID
 */
export async function getLaceItem(req: Request, res: Response) {
  const { itemId } = req.params;

  const item = await getLaceItemById(itemId);

  if (!item) {
    throw new NotFoundError('Lace item', itemId);
  }

  res.json(
    serialize({
      success: true,
      data: item,
    })
  );
}

/**
 * POST /api/style-costing/:costingId/lace-items/calculate-options
 * Calculate cost options for a lace item (shows all sourcing strategies)
 */
export async function calculateLaceOptions(req: Request, res: Response) {
  const { costingId } = req.params;
  const { laceId, quantityPerGarment, orderQuantity, wastagePercent, styleId } = req.body;

  if (!laceId || quantityPerGarment === undefined) {
    throw new ValidationError('Missing required fields: laceId, quantityPerGarment');
  }

  // wastagePercent is required - no hardcoded default (0 is valid, meaning no wastage)
  if (wastagePercent === undefined || wastagePercent === null) {
    return res.status(400).json({ success: false, message: 'wastagePercent is required' });
  }

  const options = await calculateLaceItemCostOptions(
    laceId,
    parseFloat(quantityPerGarment),
    orderQuantity ? parseInt(orderQuantity) : 1,
    parseFloat(wastagePercent),
    styleId,
    costingId
  );

  res.json(
    serialize({
      success: true,
      data: options,
    })
  );
}

/**
 * POST /api/style-costing/:costingId/lace-items/bulk
 * Bulk add lace items to a cost sheet
 */
export async function bulkAddLaceItemsController(req: Request, res: Response) {
  const { costingId } = req.params;
  const { items } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new ValidationError('Missing or invalid items array');
  }

  // Parse numeric fields for each item
  const parsedItems = items.map((item: any) => ({
    ...item,
    width: item.width ? parseFloat(item.width) : undefined,
    quantityPerGarment: parseFloat(item.quantityPerGarment),
    // costing-17: nullish check so a legal wastagePercent of 0 is not dropped
    wastagePercent: item.wastagePercent != null ? parseFloat(item.wastagePercent) : undefined,
    greigeCost: item.greigeCost ? parseFloat(item.greigeCost) : undefined,
    processingCost: item.processingCost ? parseFloat(item.processingCost) : undefined,
    readyLaceCost: item.readyLaceCost ? parseFloat(item.readyLaceCost) : undefined,
    stockCost: item.stockCost ? parseFloat(item.stockCost) : undefined,
    costPerMeter: parseFloat(item.costPerMeter),
  }));

  const createdItems = await bulkAddLaceItems(costingId, parsedItems);

  res.status(201).json(
    serialize({
      success: true,
      data: {
        items: createdItems,
        count: createdItems.length,
      },
      message: `${createdItems.length} lace item(s) added to cost sheet`,
    })
  );
}

export default {
  addLaceItem,
  updateLaceItemController,
  deleteLaceItem,
  getLaceItems,
  getLaceItem,
  calculateLaceOptions,
  bulkAddLaceItemsController,
};
