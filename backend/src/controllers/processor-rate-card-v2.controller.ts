/**
 * Processor Rate Card V2 Controller
 * Matrix-based rate card management for DYEING and PRINTING processors
 */

import { Request, Response } from 'express';
import processorRateV2Service from '../services/processor-rate-v2.service';
import { serialize } from '../utils/serializer';
import {
  ProcessingTypeV2,
  PrintingTypeV2,
  PRINTING_TYPES,
  CopyRatesInput,
  SaveMatrixRequest,
} from '../types/processor-rate-v2.types';

/**
 * GET /api/processor-rate-cards/v2/processors
 * Get all DYEING/PRINTING processors
 */
export async function getProcessors(req: Request, res: Response) {
  try {
    const processors = await processorRateV2Service.getAllDyeingPrintingProcessors();

    res.json(serialize({
      success: true,
      data: processors,
    }));
  } catch (error: any) {
    console.error('Error fetching processors:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch processors',
    });
  }
}

/**
 * GET /api/processor-rate-cards/v2/processors/:processorId/matrix
 * Get complete rate matrix for a processor
 * For PRINTING, printingType query param specifies which printing sub-type to get
 */
export async function getProcessorMatrix(req: Request, res: Response) {
  try {
    const { processorId } = req.params;
    const { processingType, printingType } = req.query;

    if (!processingType || !['DYEING', 'PRINTING'].includes(processingType as string)) {
      return res.status(400).json({
        success: false,
        error: 'processingType query parameter must be DYEING or PRINTING',
      });
    }

    // Validate printingType for PRINTING
    if (processingType === 'PRINTING') {
      if (printingType && !PRINTING_TYPES.includes(printingType as PrintingTypeV2)) {
        return res.status(400).json({
          success: false,
          error: `printingType must be one of: ${PRINTING_TYPES.join(', ')}`,
        });
      }
    }

    const matrix = await processorRateV2Service.getProcessorRateMatrix(
      processorId,
      processingType as ProcessingTypeV2,
      processingType === 'PRINTING' ? (printingType as PrintingTypeV2 || 'PIGMENT') : undefined
    );

    res.json(serialize({
      success: true,
      data: matrix,
    }));
  } catch (error: any) {
    console.error('Error fetching processor matrix:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch processor matrix',
    });
  }
}

/**
 * GET /api/processor-rate-cards/v2/greiges
 * Get all active greige fabrics for row population
 */
export async function getGreigesForRateCard(req: Request, res: Response) {
  try {
    const greiges = await processorRateV2Service.getGreigeFabricsForRateCard();

    res.json(serialize({
      success: true,
      data: greiges,
    }));
  } catch (error: any) {
    console.error('Error fetching greiges:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch greiges',
    });
  }
}

/**
 * POST /api/processor-rate-cards/v2/processors/:processorId/slabs
 * Update slab definitions for a processor
 */
export async function updateSlabs(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const { processorId } = req.params;
    const { processingType, slabs } = req.body;

    if (!processingType || !['DYEING', 'PRINTING'].includes(processingType)) {
      return res.status(400).json({
        success: false,
        error: 'processingType must be DYEING or PRINTING',
      });
    }

    if (!Array.isArray(slabs) || slabs.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'slabs must be a non-empty array',
      });
    }

    const updatedSlabs = await processorRateV2Service.updateProcessorSlabs(
      processorId,
      processingType as ProcessingTypeV2,
      slabs,
      userId
    );

    res.json(serialize({
      success: true,
      data: updatedSlabs,
      message: 'Slabs updated successfully',
    }));
  } catch (error: any) {
    console.error('Error updating slabs:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update slabs',
    });
  }
}

/**
 * PUT /api/processor-rate-cards/v2/processors/:processorId/matrix
 * Bulk save entire rate matrix
 * For PRINTING, printingType in body specifies which printing sub-type to save
 */
export async function saveMatrix(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const { processorId } = req.params;
    const { processingType, printingType, slabs, rates, shrinkages, deletedGreigeIds } = req.body;

    if (!processingType || !['DYEING', 'PRINTING'].includes(processingType)) {
      return res.status(400).json({
        success: false,
        error: 'processingType must be DYEING or PRINTING',
      });
    }

    // Validate printingType for PRINTING
    if (processingType === 'PRINTING') {
      if (!printingType || !PRINTING_TYPES.includes(printingType as PrintingTypeV2)) {
        return res.status(400).json({
          success: false,
          error: `printingType is required for PRINTING and must be one of: ${PRINTING_TYPES.join(', ')}`,
        });
      }
    }

    const request: SaveMatrixRequest = {
      slabs: slabs || [],
      rates: rates || [],
      shrinkages: shrinkages || [],
      deletedGreigeIds: deletedGreigeIds || [],
    };

    await processorRateV2Service.saveProcessorRateMatrix(
      processorId,
      processingType as ProcessingTypeV2,
      processingType === 'PRINTING' ? (printingType as PrintingTypeV2) : undefined,
      request,
      userId
    );

    res.json(serialize({
      success: true,
      message: 'Rate matrix saved successfully',
    }));
  } catch (error: any) {
    console.error('Error saving matrix:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to save rate matrix',
    });
  }
}

/**
 * POST /api/processor-rate-cards/v2/copy
 * Copy rate matrix from one processor to another
 * For PRINTING, printingType specifies which printing sub-type to copy
 */
export async function copyRates(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const { sourceProcessorId, targetProcessorId, processingType, printingType, copySlabs, copyRates: copyRatesFlag } = req.body;

    if (!sourceProcessorId || !targetProcessorId) {
      return res.status(400).json({
        success: false,
        error: 'sourceProcessorId and targetProcessorId are required',
      });
    }

    if (!processingType || !['DYEING', 'PRINTING'].includes(processingType)) {
      return res.status(400).json({
        success: false,
        error: 'processingType must be DYEING or PRINTING',
      });
    }

    // Validate printingType for PRINTING
    if (processingType === 'PRINTING') {
      if (!printingType || !PRINTING_TYPES.includes(printingType as PrintingTypeV2)) {
        return res.status(400).json({
          success: false,
          error: `printingType is required for PRINTING and must be one of: ${PRINTING_TYPES.join(', ')}`,
        });
      }
    }

    if (sourceProcessorId === targetProcessorId) {
      return res.status(400).json({
        success: false,
        error: 'Source and target processor must be different',
      });
    }

    const input: CopyRatesInput = {
      sourceProcessorId,
      targetProcessorId,
      processingType: processingType as ProcessingTypeV2,
      printingType: processingType === 'PRINTING' ? (printingType as PrintingTypeV2) : undefined,
      copySlabs: copySlabs !== false, // Default to true
      copyRates: copyRatesFlag === true, // Default to false
    };

    await processorRateV2Service.copyProcessorRates(input, userId);

    res.json(serialize({
      success: true,
      message: 'Rates copied successfully',
    }));
  } catch (error: any) {
    console.error('Error copying rates:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to copy rates',
    });
  }
}

/**
 * POST /api/processor-rate-cards/v2/processors/:processorId/greiges/:greigeId
 * Add a greige row to processor's matrix
 * For PRINTING, printingType specifies which printing sub-type to add the greige to
 */
export async function addGreige(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const { processorId, greigeId } = req.params;
    const { processingType, printingType } = req.body;

    if (!processingType || !['DYEING', 'PRINTING'].includes(processingType)) {
      return res.status(400).json({
        success: false,
        error: 'processingType must be DYEING or PRINTING',
      });
    }

    // Validate printingType for PRINTING
    if (processingType === 'PRINTING') {
      if (!printingType || !PRINTING_TYPES.includes(printingType as PrintingTypeV2)) {
        return res.status(400).json({
          success: false,
          error: `printingType is required for PRINTING and must be one of: ${PRINTING_TYPES.join(', ')}`,
        });
      }
    }

    await processorRateV2Service.addGreigeToProcessor(
      processorId,
      processingType as ProcessingTypeV2,
      processingType === 'PRINTING' ? (printingType as PrintingTypeV2) : undefined,
      greigeId,
      userId
    );

    res.json(serialize({
      success: true,
      message: 'Greige added successfully',
    }));
  } catch (error: any) {
    console.error('Error adding greige:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to add greige',
    });
  }
}

/**
 * DELETE /api/processor-rate-cards/v2/processors/:processorId/greiges/:greigeId
 * Remove a greige row from processor's matrix
 * For PRINTING, printingType query param specifies which printing sub-type to remove from
 */
export async function removeGreige(req: Request, res: Response) {
  try {
    const { processorId, greigeId } = req.params;
    const { processingType, printingType } = req.query;

    if (!processingType || !['DYEING', 'PRINTING'].includes(processingType as string)) {
      return res.status(400).json({
        success: false,
        error: 'processingType query parameter must be DYEING or PRINTING',
      });
    }

    // Validate printingType for PRINTING
    if (processingType === 'PRINTING') {
      if (!printingType || !PRINTING_TYPES.includes(printingType as PrintingTypeV2)) {
        return res.status(400).json({
          success: false,
          error: `printingType is required for PRINTING and must be one of: ${PRINTING_TYPES.join(', ')}`,
        });
      }
    }

    await processorRateV2Service.removeGreigeFromProcessor(
      processorId,
      processingType as ProcessingTypeV2,
      processingType === 'PRINTING' ? (printingType as PrintingTypeV2) : undefined,
      greigeId
    );

    res.json(serialize({
      success: true,
      message: 'Greige removed successfully',
    }));
  } catch (error: any) {
    console.error('Error removing greige:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to remove greige',
    });
  }
}

/**
 * GET /api/processor-rate-cards/v2/summary
 * Get summary dashboard data for all processors
 */
export async function getSummary(req: Request, res: Response) {
  try {
    const summary = await processorRateV2Service.getProcessorRateCardSummary();

    res.json(serialize({
      success: true,
      data: summary,
    }));
  } catch (error: any) {
    console.error('Error fetching summary:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch summary',
    });
  }
}

/**
 * POST /api/processor-rate-cards/v2/lookup
 * Lookup rate for fabric costing
 * For PRINTING, printingType specifies which printing sub-type rate to lookup
 */
export async function lookupRate(req: Request, res: Response) {
  try {
    const { processorId, processingType, printingType, greigeId, quantityMeters } = req.body;

    if (!processorId || !processingType || !greigeId || !quantityMeters) {
      return res.status(400).json({
        success: false,
        error: 'processorId, processingType, greigeId, and quantityMeters are required',
      });
    }

    if (!['DYEING', 'PRINTING'].includes(processingType)) {
      return res.status(400).json({
        success: false,
        error: 'processingType must be DYEING or PRINTING',
      });
    }

    // Validate printingType for PRINTING
    if (processingType === 'PRINTING') {
      if (!printingType || !PRINTING_TYPES.includes(printingType as PrintingTypeV2)) {
        return res.status(400).json({
          success: false,
          error: `printingType is required for PRINTING and must be one of: ${PRINTING_TYPES.join(', ')}`,
        });
      }
    }

    const result = await processorRateV2Service.lookupRate({
      processorId,
      processingType: processingType as ProcessingTypeV2,
      printingType: processingType === 'PRINTING' ? (printingType as PrintingTypeV2) : undefined,
      greigeId,
      quantityMeters: parseFloat(quantityMeters),
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'No matching rate found',
      });
    }

    res.json(serialize({
      success: true,
      data: result,
    }));
  } catch (error: any) {
    console.error('Error looking up rate:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to lookup rate',
    });
  }
}

// ==========================================
// LACE RATE CARD CONTROLLER FUNCTIONS
// ==========================================

/**
 * GET /api/processor-rate-cards/v2/laces
 * Get all greige lace items for row population
 */
export async function getGreigeLacesForRateCard(req: Request, res: Response) {
  try {
    const laces = await processorRateV2Service.getGreigeLaceForRateCard();

    res.json(serialize({
      success: true,
      data: laces,
    }));
  } catch (error: any) {
    console.error('Error fetching greige laces:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch greige laces',
    });
  }
}

/**
 * GET /api/processor-rate-cards/v2/processors/:processorId/lace-matrix
 * Get lace rate matrix for a processor (DYEING only)
 */
export async function getLaceProcessorMatrix(req: Request, res: Response) {
  try {
    const { processorId } = req.params;

    const matrix = await processorRateV2Service.getLaceProcessorRateMatrix(processorId);

    res.json(serialize({
      success: true,
      data: matrix,
    }));
  } catch (error: any) {
    console.error('Error fetching lace processor matrix:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch lace processor matrix',
    });
  }
}

/**
 * PUT /api/processor-rate-cards/v2/processors/:processorId/lace-matrix
 * Bulk save lace rate matrix
 */
export async function saveLaceMatrix(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const { processorId } = req.params;
    const { rates } = req.body;

    if (!Array.isArray(rates)) {
      return res.status(400).json({
        success: false,
        error: 'rates must be an array',
      });
    }

    const result = await processorRateV2Service.saveLaceRateMatrix(
      processorId,
      rates,
      userId
    );

    res.json(serialize({
      success: true,
      message: `Lace rate matrix saved successfully. ${result.saved} saved, ${result.skipped} skipped.`,
      data: result,
    }));
  } catch (error: any) {
    console.error('Error saving lace matrix:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to save lace rate matrix',
    });
  }
}

/**
 * POST /api/processor-rate-cards/v2/processors/:processorId/laces/:laceId
 * Add a greige lace row to processor's matrix
 */
export async function addLace(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const { processorId, laceId } = req.params;

    await processorRateV2Service.addLaceToProcessor(
      processorId,
      laceId,
      userId
    );

    res.json(serialize({
      success: true,
      message: 'Greige lace added successfully',
    }));
  } catch (error: any) {
    console.error('Error adding lace:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to add lace',
    });
  }
}

/**
 * DELETE /api/processor-rate-cards/v2/processors/:processorId/laces/:laceId
 * Remove a greige lace row from processor's matrix
 */
export async function removeLace(req: Request, res: Response) {
  try {
    const { processorId, laceId } = req.params;

    await processorRateV2Service.removeLaceFromProcessor(
      processorId,
      laceId
    );

    res.json(serialize({
      success: true,
      message: 'Greige lace removed successfully',
    }));
  } catch (error: any) {
    console.error('Error removing lace:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to remove lace',
    });
  }
}

/**
 * POST /api/processor-rate-cards/v2/lookup-lace
 * Lookup rate for lace costing
 */
export async function lookupLaceRate(req: Request, res: Response) {
  try {
    const { processorId, laceId, quantityMeters } = req.body;

    if (!laceId || !quantityMeters) {
      return res.status(400).json({
        success: false,
        error: 'laceId and quantityMeters are required',
      });
    }

    const result = await processorRateV2Service.lookupLaceRate({
      processorId, // Optional - will use SYSTEM_DEFAULT if not provided
      laceId,
      quantityMeters: parseFloat(quantityMeters),
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'No matching lace rate found',
      });
    }

    res.json(serialize({
      success: true,
      data: result,
    }));
  } catch (error: any) {
    console.error('Error looking up lace rate:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to lookup lace rate',
    });
  }
}

export default {
  getProcessors,
  getProcessorMatrix,
  getGreigesForRateCard,
  updateSlabs,
  saveMatrix,
  copyRates,
  addGreige,
  removeGreige,
  lookupRate,
  getSummary,
  // Lace rate card functions
  getGreigeLacesForRateCard,
  getLaceProcessorMatrix,
  saveLaceMatrix,
  addLace,
  removeLace,
  lookupLaceRate,
};
