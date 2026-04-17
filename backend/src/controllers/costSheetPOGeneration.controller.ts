/**
 * Cost Sheet PO Generation Controller
 * API endpoints for generating Purchase Orders from approved Cost Sheets
 */

import { Request, Response } from 'express';
import { costSheetPOGenerationService } from '../services/costSheetPOGeneration.service';
import { logInfo } from '../utils/logger';
import { UnauthorizedError, ValidationError } from '../errors';

/**
 * @route GET /api/cost-sheet-po/calculate
 * @desc Calculate material requirements from cost sheet
 * @access Private
 */
export const calculateRequirements = async (req: Request, res: Response) => {
  const { costSheetId, totalOrderQty } = req.query;

  if (!costSheetId) {
    throw new ValidationError('Cost Sheet ID is required');
  }

  if (!totalOrderQty || isNaN(Number(totalOrderQty))) {
    throw new ValidationError('Total Order Quantity is required and must be a number');
  }

  const requirements = await costSheetPOGenerationService.calculateRequirements(
    costSheetId as string,
    Number(totalOrderQty)
  );

  // Calculate order quantities with default allowance
  const fabricOrderQtys = costSheetPOGenerationService.calculateOrderQuantities(requirements.fabricItems, 3);
  const greigeOrderQtys = costSheetPOGenerationService.calculateOrderQuantities(requirements.greigeItems, 3);
  const trimsOrderQtys = costSheetPOGenerationService.calculateOrderQuantities(requirements.trimsItems, 3);

  res.json({
    success: true,
    data: {
      ...requirements,
      fabricOrderQtys,
      greigeOrderQtys,
      trimsOrderQtys,
    },
  });
};

/**
 * @route POST /api/cost-sheet-po/generate/fabric
 * @desc Generate Fabric PO from cost sheet
 * @access Private
 */
export const generateFabricPO = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  const { costSheetId, totalOrderQty, supplierId, items, notes } = req.body;

  if (!costSheetId || !totalOrderQty || !supplierId || !items || items.length === 0) {
    throw new ValidationError('Missing required fields: costSheetId, totalOrderQty, supplierId, items');
  }

  const result = await costSheetPOGenerationService.generateFabricPO({
    costSheetId,
    totalOrderQty,
    userId,
    supplierId,
    items,
    notes,
  });

  logInfo(`Fabric PO generated: ${result.poNumber}`);

  res.status(201).json({
    success: true,
    data: result,
    message: 'Fabric PO generated successfully',
  });
};

/**
 * @route POST /api/cost-sheet-po/generate/greige
 * @desc Generate Greige PO from cost sheet
 * @access Private
 */
export const generateGreigePO = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  const { costSheetId, totalOrderQty, supplierId, items, notes } = req.body;

  if (!costSheetId || !totalOrderQty || !supplierId || !items || items.length === 0) {
    throw new ValidationError('Missing required fields: costSheetId, totalOrderQty, supplierId, items');
  }

  const result = await costSheetPOGenerationService.generateGreigePO({
    costSheetId,
    totalOrderQty,
    userId,
    supplierId,
    items,
    notes,
  });

  logInfo(`Greige PO generated: ${result.poNumber}`);

  res.status(201).json({
    success: true,
    data: result,
    message: 'Greige PO generated successfully',
  });
};

/**
 * @route POST /api/cost-sheet-po/generate/processing
 * @desc Generate Processing PO from cost sheet
 * @access Private
 */
export const generateProcessingPO = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  const { costSheetId, totalOrderQty, processorId, items, linkedGreigePOId, notes } = req.body;

  if (!costSheetId || !totalOrderQty || !processorId || !items || items.length === 0) {
    throw new ValidationError('Missing required fields: costSheetId, totalOrderQty, processorId, items');
  }

  const result = await costSheetPOGenerationService.generateProcessingPO({
    costSheetId,
    totalOrderQty,
    userId,
    processorId,
    items,
    linkedGreigePOId,
    notes,
  });

  logInfo(`Processing PO generated: ${result.poNumber}`);

  res.status(201).json({
    success: true,
    data: result,
    message: 'Processing PO generated successfully',
  });
};

/**
 * @route POST /api/cost-sheet-po/generate/trims
 * @desc Generate Trims PO from cost sheet
 * @access Private
 */
export const generateTrimsPO = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  const { costSheetId, totalOrderQty, supplierId, items, notes } = req.body;

  if (!costSheetId || !totalOrderQty || !supplierId || !items || items.length === 0) {
    throw new ValidationError('Missing required fields: costSheetId, totalOrderQty, supplierId, items');
  }

  const result = await costSheetPOGenerationService.generateTrimsPO({
    costSheetId,
    totalOrderQty,
    userId,
    supplierId,
    items,
    notes,
  });

  logInfo(`Trims PO generated: ${result.poNumber}`);

  res.status(201).json({
    success: true,
    data: result,
    message: 'Trims PO generated successfully',
  });
};

/**
 * @route GET /api/cost-sheet-po/status/:costSheetId
 * @desc Get PO generation status for a cost sheet
 * @access Private
 */
export const getGenerationStatus = async (req: Request, res: Response) => {
  const { costSheetId } = req.params;

  const status = await costSheetPOGenerationService.getGenerationStatus(costSheetId);

  res.json({
    success: true,
    data: status,
  });
};

/**
 * @route GET /api/cost-sheet-po/history/:costSheetId
 * @desc Get PO generation history for a cost sheet
 * @access Private
 */
export const getGenerationHistory = async (req: Request, res: Response) => {
  const { costSheetId } = req.params;

  const history = await costSheetPOGenerationService.getGenerationHistory(costSheetId);

  res.json({
    success: true,
    data: history,
  });
};
