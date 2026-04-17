/**
 * Lace Lab Dip Controller
 *
 * API endpoints for managing lace lab dip approval workflow.
 */

import { Request, Response } from 'express';
import laceLabDipService from '../services/laceLabDip.service';
import { serialize } from '../utils/serializer';
import { LaceLabDipStatus } from '@prisma/client';
import { NotFoundError, ValidationError } from '../errors';

/**
 * POST /api/lace-lab-dips
 * Create a new lace lab dip request
 */
export async function createLabDip(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'User not authenticated',
    });
  }

  const { greigeLaceId, targetColor, processorId, sampleQuantity, colorRecipe, costSheetId, styleId, labDipCost } =
    req.body;

  if (!greigeLaceId || !targetColor || !processorId || !sampleQuantity) {
    throw new ValidationError('greigeLaceId, targetColor, processorId, and sampleQuantity are required');
  }

  const labDip = await laceLabDipService.createLaceLabDip(
    {
      greigeLaceId,
      targetColor,
      processorId,
      sampleQuantity: parseFloat(sampleQuantity),
      colorRecipe,
      costSheetId,
      styleId,
      labDipCost: labDipCost ? parseFloat(labDipCost) : undefined,
    },
    userId
  );

  res.status(201).json(
    serialize({
      success: true,
      data: labDip,
      message: 'Lab dip request created successfully',
    })
  );
}

/**
 * GET /api/lace-lab-dips
 * Get all lace lab dips with filters
 */
export async function getLabDips(req: Request, res: Response) {
  const { status, greigeLaceId, processorId, styleId, costSheetId, page = '1', limit = '20' } = req.query;

  const filters: any = {
    page: parseInt(page as string),
    limit: parseInt(limit as string),
  };

  if (status) filters.status = status as LaceLabDipStatus;
  if (greigeLaceId) filters.greigeLaceId = greigeLaceId as string;
  if (processorId) filters.processorId = processorId as string;
  if (styleId) filters.styleId = styleId as string;
  if (costSheetId) filters.costSheetId = costSheetId as string;

  const result = await laceLabDipService.getLaceLabDips(filters);

  res.json(
    serialize({
      success: true,
      ...result,
    })
  );
}

/**
 * GET /api/lace-lab-dips/:id
 * Get single lace lab dip by ID
 */
export async function getLabDipById(req: Request, res: Response) {
  const { id } = req.params;

  const labDip = await laceLabDipService.getLaceLabDipById(id);

  if (!labDip) {
    throw new NotFoundError('Lab dip', id);
  }

  res.json(
    serialize({
      success: true,
      data: labDip,
    })
  );
}

/**
 * PUT /api/lace-lab-dips/:id
 * Update lace lab dip details
 */
export async function updateLabDip(req: Request, res: Response) {
  const { id } = req.params;
  const { targetColor, colorRecipe, sampleQuantity, labDipCost, buyerRemarks, rejectionReason, approvalReference } =
    req.body;

  const updated = await laceLabDipService.updateLaceLabDip(id, {
    targetColor,
    colorRecipe,
    sampleQuantity: sampleQuantity ? parseFloat(sampleQuantity) : undefined,
    labDipCost: labDipCost ? parseFloat(labDipCost) : undefined,
    buyerRemarks,
    rejectionReason,
    approvalReference,
  });

  res.json(
    serialize({
      success: true,
      data: updated,
      message: 'Lab dip updated successfully',
    })
  );
}

/**
 * POST /api/lace-lab-dips/:id/status
 * Update lab dip status (workflow transitions)
 */
export async function updateStatus(req: Request, res: Response) {
  const { id } = req.params;
  const { status, buyerRemarks, rejectionReason, approvalReference } = req.body;

  if (!status) {
    throw new ValidationError('status is required');
  }

  const validStatuses: LaceLabDipStatus[] = [
    'PENDING',
    'SENT_TO_PROCESSOR',
    'SAMPLE_RECEIVED',
    'AWAITING_BUYER_APPROVAL',
    'APPROVED',
    'REJECTED',
  ];

  if (!validStatuses.includes(status)) {
    throw new ValidationError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  const updated = await laceLabDipService.updateLabDipStatus(id, status as LaceLabDipStatus, {
    buyerRemarks,
    rejectionReason,
    approvalReference,
  });

  res.json(
    serialize({
      success: true,
      data: updated,
      message: `Lab dip status updated to ${status}`,
    })
  );
}

/**
 * GET /api/lace-lab-dips/approved/:greigeLaceId
 * Get approved lab dips for a greige lace (for processor selection)
 */
export async function getApprovedForLace(req: Request, res: Response) {
  const { greigeLaceId } = req.params;

  const labDips = await laceLabDipService.getApprovedLabDipsForLace(greigeLaceId);

  res.json(
    serialize({
      success: true,
      data: labDips,
    })
  );
}

/**
 * DELETE /api/lace-lab-dips/:id
 * Delete lab dip (only if PENDING)
 */
export async function deleteLabDip(req: Request, res: Response) {
  const { id } = req.params;

  await laceLabDipService.deleteLaceLabDip(id);

  res.json(
    serialize({
      success: true,
      message: 'Lab dip deleted successfully',
    })
  );
}

export default {
  createLabDip,
  getLabDips,
  getLabDipById,
  updateLabDip,
  updateStatus,
  getApprovedForLace,
  deleteLabDip,
};
