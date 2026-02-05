/**
 * Lace Defect Controller
 *
 * API endpoints for lace defect tracking and claims:
 * - Log defects
 * - Submit claims
 * - Update claim status
 * - Record replacements
 */

import { Request, Response } from 'express';
import {
  logLaceDefect,
  submitClaim,
  updateClaimStatus,
  recordReplacement,
  getDefectById,
  getDefects,
  getPendingClaims,
  getDefectStatistics,
  DefectType,
  DiscoveredAt,
  ClaimStatus,
} from '../services/laceDefect.service';
import { serialize } from '../utils/serializer';

/**
 * POST /api/lace-defects
 * Log a new defect
 */
export async function logDefect(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const {
      stockId,
      laceId,
      orderId,
      styleId,
      defectType,
      defectQuantity,
      defectDescription,
      discoveredAt,
      photos,
    } = req.body;

    // Validation
    if (!stockId || !laceId || !defectType || defectQuantity === undefined || !discoveredAt) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: stockId, laceId, defectType, defectQuantity, discoveredAt',
      });
    }

    // Validate defect type
    const validDefectTypes: DefectType[] = ['WEAVE_DEFECT', 'COLOR_VARIATION', 'WIDTH_VARIATION', 'DAMAGE'];
    if (!validDefectTypes.includes(defectType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid defectType. Must be one of: ${validDefectTypes.join(', ')}`,
      });
    }

    // Validate discovered at
    const validDiscoveredAt: DiscoveredAt[] = ['RECEIVING', 'CUTTING', 'STITCHING', 'QC'];
    if (!validDiscoveredAt.includes(discoveredAt)) {
      return res.status(400).json({
        success: false,
        error: `Invalid discoveredAt. Must be one of: ${validDiscoveredAt.join(', ')}`,
      });
    }

    const defect = await logLaceDefect({
      stockId,
      laceId,
      orderId,
      styleId,
      defectType,
      defectQuantity: parseFloat(defectQuantity),
      defectDescription,
      discoveredAt,
      photos,
      discoveredById: userId,
    });

    res.status(201).json(serialize({
      success: true,
      data: defect,
      message: 'Defect logged successfully',
    }));
  } catch (error: any) {
    console.error('Error logging defect:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to log defect',
    });
  }
}

/**
 * POST /api/lace-defects/:id/claim/submit
 * Submit a claim for a defect
 */
export async function submitClaimController(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { claimReference, claimAmount, notes } = req.body;

    if (!claimReference || claimAmount === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: claimReference, claimAmount',
      });
    }

    const defect = await submitClaim({
      defectId: id,
      claimReference,
      claimAmount: parseFloat(claimAmount),
      notes,
    });

    res.json(serialize({
      success: true,
      data: defect,
      message: 'Claim submitted successfully',
    }));
  } catch (error: any) {
    console.error('Error submitting claim:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to submit claim',
    });
  }
}

/**
 * PUT /api/lace-defects/:id/claim/status
 * Update claim status
 */
export async function updateClaimStatusController(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { status, resolution } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: status',
      });
    }

    // Validate status
    const validStatuses: ClaimStatus[] = ['PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED', 'RESOLVED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const defect = await updateClaimStatus({
      defectId: id,
      status,
      resolution,
    });

    res.json(serialize({
      success: true,
      data: defect,
      message: 'Claim status updated successfully',
    }));
  } catch (error: any) {
    console.error('Error updating claim status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update claim status',
    });
  }
}

/**
 * POST /api/lace-defects/:id/replacement
 * Record replacement material
 */
export async function recordReplacementController(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { replacementStockId, replacementQuantity } = req.body;

    if (!replacementStockId || replacementQuantity === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: replacementStockId, replacementQuantity',
      });
    }

    const defect = await recordReplacement({
      defectId: id,
      replacementStockId,
      replacementQuantity: parseFloat(replacementQuantity),
    });

    res.json(serialize({
      success: true,
      data: defect,
      message: 'Replacement recorded successfully',
    }));
  } catch (error: any) {
    console.error('Error recording replacement:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to record replacement',
    });
  }
}

/**
 * GET /api/lace-defects/:id
 * Get defect by ID
 */
export async function getDefectByIdController(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const defect = await getDefectById(id);

    if (!defect) {
      return res.status(404).json({
        success: false,
        error: 'Defect not found',
      });
    }

    res.json(serialize({
      success: true,
      data: defect,
    }));
  } catch (error: any) {
    console.error('Error fetching defect:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch defect',
    });
  }
}

/**
 * GET /api/lace-defects
 * Get defects with filters
 */
export async function getDefectsController(req: Request, res: Response) {
  try {
    const {
      stockId,
      laceId,
      orderId,
      styleId,
      defectType,
      claimStatus,
      discoveredAt,
      search,
      page,
      limit,
    } = req.query;

    const result = await getDefects({
      stockId: stockId as string,
      laceId: laceId as string,
      orderId: orderId as string,
      styleId: styleId as string,
      defectType: defectType as DefectType,
      claimStatus: claimStatus as ClaimStatus,
      discoveredAt: discoveredAt as DiscoveredAt,
      search: search as string,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json(serialize({
      success: true,
      ...result,
    }));
  } catch (error: any) {
    console.error('Error fetching defects:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch defects',
    });
  }
}

/**
 * GET /api/lace-defects/claims/pending
 * Get pending claims dashboard
 */
export async function getPendingClaimsController(req: Request, res: Response) {
  try {
    const result = await getPendingClaims();

    res.json(serialize({
      success: true,
      data: result,
    }));
  } catch (error: any) {
    console.error('Error fetching pending claims:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch pending claims',
    });
  }
}

/**
 * GET /api/lace-defects/statistics
 * Get defect statistics
 */
export async function getDefectStatisticsController(req: Request, res: Response) {
  try {
    const result = await getDefectStatistics();

    res.json(serialize({
      success: true,
      data: result,
    }));
  } catch (error: any) {
    console.error('Error fetching defect statistics:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch defect statistics',
    });
  }
}

export default {
  logDefect,
  submitClaimController,
  updateClaimStatusController,
  recordReplacementController,
  getDefectByIdController,
  getDefectsController,
  getPendingClaimsController,
  getDefectStatisticsController,
};
