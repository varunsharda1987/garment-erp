/**
 * Correct CAD endpoints (cad-correction.service).
 */

import { Request, Response } from 'express';
import prisma from '../config/database';
import { UnauthorizedError } from '../errors';
import { cadCorrectionService } from '../services/cad-correction.service';

function requireUser(req: Request): string {
  const userId = req.user?.userId;
  if (!userId) throw new UnauthorizedError('User not authenticated');
  return userId;
}

/**
 * What a correction would change — CAD average, ₹/m and slab, ₹ per piece, cost sheets, orders and their
 * requirements. Writes nothing.
 * POST /api/cad-planning/:styleId/row/:rowId/correction/preview
 */
export async function previewCadCorrection(req: Request, res: Response) {
  const userId = requireUser(req);
  const { styleId, rowId } = req.params;
  const data = await cadCorrectionService.previewCorrection(styleId, rowId, req.body, userId);
  res.json({ success: true, data });
}

/**
 * Make the correction: applied at once when nothing approved is built on the row, otherwise new cost-sheet
 * versions wait for an admin and the CAD shows "Correction pending".
 * POST /api/cad-planning/:styleId/row/:rowId/correction
 */
export async function submitCadCorrection(req: Request, res: Response) {
  const userId = requireUser(req);
  const { styleId, rowId } = req.params;
  const { correction, impact, status } = await cadCorrectionService.submitCorrection(styleId, rowId, req.body, userId);
  const versions = correction.newCostSheetIds.length;
  res.status(201).json({
    success: true,
    data: { correctionId: correction.id, status, newCostSheetIds: correction.newCostSheetIds, impact },
    message:
      status === 'APPLIED'
        ? 'CAD corrected.'
        : `Correction sent for approval — ${versions} new cost sheet version${versions > 1 ? 's' : ''} ` +
          'wait for an admin. Orders and requirements update when it is approved.',
  });
}

/**
 * Pending corrections of a style's CAD rows — the "Correction pending" badges
 * GET /api/cad-planning/:styleId/corrections/pending
 */
export async function getPendingCadCorrections(req: Request, res: Response) {
  const { styleId } = req.params;
  const rows = await prisma.cad_corrections.findMany({
    where: { styleId, status: { in: ['PENDING_APPROVAL', 'PARTIAL'] } },
    orderBy: { correctedAt: 'desc' },
    include: { correctedBy: { select: { firstName: true, lastName: true, email: true } } },
  });
  res.json({
    success: true,
    data: rows.map((c) => ({
      correctionId: c.id,
      cadId: c.cadId,
      status: c.status,
      reason: c.reason,
      correctedAt: c.correctedAt,
      correctedBy: c.correctedBy
        ? {
            name: [c.correctedBy.firstName, c.correctedBy.lastName].filter(Boolean).join(' ') || null,
            email: c.correctedBy.email,
          }
        : null,
      newCostSheetIds: c.newCostSheetIds,
      appliedOrders: c.appliedOrders,
    })),
  });
}

/**
 * The CAD correction a cost-sheet version was made by, if any — the banner on the cost sheet
 * GET /api/cad-planning/corrections/by-cost-sheet/:costSheetId
 */
export async function getCorrectionForCostSheet(req: Request, res: Response) {
  const correction = await cadCorrectionService.correctionForCostSheet(req.params.costSheetId);
  res.json({ success: true, data: correction });
}

/**
 * Carry a partly applied correction through again (after unlocking an order BOM, adding a rate …)
 * POST /api/cad-planning/corrections/:correctionId/retry
 */
export async function retryCadCorrection(req: Request, res: Response) {
  const userId = requireUser(req);
  await cadCorrectionService.retryCorrection(req.params.correctionId, userId);
  const correction = await prisma.cad_corrections.findUnique({ where: { id: req.params.correctionId } });
  res.json({
    success: true,
    data: correction,
    message: `Correction ${correction?.status === 'APPLIED' ? 'applied' : 'retried'}.`,
  });
}
