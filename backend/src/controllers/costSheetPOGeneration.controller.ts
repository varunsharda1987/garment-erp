/**
 * Cost Sheet PO Generation Controller
 * API endpoints for generating Purchase Orders from approved Cost Sheets
 */

import { Request, Response } from 'express';
import { costSheetPOGenerationService } from '../services/costSheetPOGeneration.service';
import { logInfo, logError } from '../utils/logger';

/**
 * @route GET /api/cost-sheet-po/calculate
 * @desc Calculate material requirements from cost sheet
 * @access Private
 */
export const calculateRequirements = async (req: Request, res: Response) => {
  try {
    const { costSheetId, totalOrderQty } = req.query;

    if (!costSheetId) {
      return res.status(400).json({
        success: false,
        message: 'Cost Sheet ID is required',
      });
    }

    if (!totalOrderQty || isNaN(Number(totalOrderQty))) {
      return res.status(400).json({
        success: false,
        message: 'Total Order Quantity is required and must be a number',
      });
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
  } catch (error: unknown) {
    logError('Calculate requirements error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to calculate requirements';
    const statusCode = errorMessage.includes('not found') ? 404 : errorMessage.includes('approved') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
    });
  }
};

/**
 * @route POST /api/cost-sheet-po/generate/fabric
 * @desc Generate Fabric PO from cost sheet
 * @access Private
 */
export const generateFabricPO = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const { costSheetId, totalOrderQty, supplierId, items, notes } = req.body;

    if (!costSheetId || !totalOrderQty || !supplierId || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: costSheetId, totalOrderQty, supplierId, items',
      });
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
  } catch (error: unknown) {
    logError('Generate Fabric PO error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate Fabric PO';
    res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
};

/**
 * @route POST /api/cost-sheet-po/generate/greige
 * @desc Generate Greige PO from cost sheet
 * @access Private
 */
export const generateGreigePO = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const { costSheetId, totalOrderQty, supplierId, items, notes } = req.body;

    if (!costSheetId || !totalOrderQty || !supplierId || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: costSheetId, totalOrderQty, supplierId, items',
      });
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
  } catch (error: unknown) {
    logError('Generate Greige PO error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate Greige PO';
    res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
};

/**
 * @route POST /api/cost-sheet-po/generate/processing
 * @desc Generate Processing PO from cost sheet
 * @access Private
 */
export const generateProcessingPO = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const { costSheetId, totalOrderQty, processorId, items, linkedGreigePOId, notes } = req.body;

    if (!costSheetId || !totalOrderQty || !processorId || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: costSheetId, totalOrderQty, processorId, items',
      });
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
  } catch (error: unknown) {
    logError('Generate Processing PO error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate Processing PO';
    res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
};

/**
 * @route POST /api/cost-sheet-po/generate/trims
 * @desc Generate Trims PO from cost sheet
 * @access Private
 */
export const generateTrimsPO = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const { costSheetId, totalOrderQty, supplierId, items, notes } = req.body;

    if (!costSheetId || !totalOrderQty || !supplierId || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: costSheetId, totalOrderQty, supplierId, items',
      });
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
  } catch (error: unknown) {
    logError('Generate Trims PO error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate Trims PO';
    res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
};

/**
 * @route GET /api/cost-sheet-po/status/:costSheetId
 * @desc Get PO generation status for a cost sheet
 * @access Private
 */
export const getGenerationStatus = async (req: Request, res: Response) => {
  try {
    const { costSheetId } = req.params;

    const status = await costSheetPOGenerationService.getGenerationStatus(costSheetId);

    res.json({
      success: true,
      data: status,
    });
  } catch (error: unknown) {
    logError('Get generation status error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get generation status',
    });
  }
};

/**
 * @route GET /api/cost-sheet-po/history/:costSheetId
 * @desc Get PO generation history for a cost sheet
 * @access Private
 */
export const getGenerationHistory = async (req: Request, res: Response) => {
  try {
    const { costSheetId } = req.params;

    const history = await costSheetPOGenerationService.getGenerationHistory(costSheetId);

    res.json({
      success: true,
      data: history,
    });
  } catch (error: unknown) {
    logError('Get generation history error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get generation history',
    });
  }
};
