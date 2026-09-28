/**
 * /api/po-allocations — allocate a sent PO to running orders (docs/plans/po-allocation-design.md §6.5).
 * All the rules live in services/helpers/po-allocation.helper.ts; this only reads the request and answers.
 * Refusals come back through the error handler: 422 PO_ALLOCATION_REFUSED / PO_ARRIVED_NOT_FREE /
 * PO_UNDO_REFUSED, 409 PO_LINE_OVER_ALLOCATED / PO_ALLOCATION_CHANGED, 404 for an unknown PO or link.
 */
import { Request, Response } from 'express';
import { UnauthorizedError } from '../errors';
import { allocatePoLines, getPoAllocation, undoPoAllocation } from '../services/helpers/po-allocation.helper';
import type {
  AllocatePoInput,
  PoAllocationLinkParams,
  PoAllocationParams,
  PoAllocationQuery,
} from '../schemas/po-allocation.schema';

const userIdOf = (req: Request): string => {
  const userId = req.user?.userId;
  if (!userId) throw new UnauthorizedError('User not authenticated');
  return userId;
};

export class PoAllocationController {
  /** GET /:poId — each line's figures, its links in fill order, and its candidates with the default split */
  async get(req: Request, res: Response) {
    const { poId } = req.params as PoAllocationParams;
    // The coerced list lives only on req.validatedQuery (req.query stays raw strings)
    const { itemIds } = (req.validatedQuery ?? {}) as PoAllocationQuery;
    const data = await getPoAllocation(poId, { itemIds });
    res.json({ success: true, data });
  }

  /** POST /:poId — link the ticked orders; answers with what was linked, the balance rows, and the new view */
  async allocate(req: Request, res: Response) {
    const { poId } = req.params as PoAllocationParams;
    const { allocations } = req.body as AllocatePoInput;
    const data = await allocatePoLines(poId, allocations, userIdOf(req));
    res.status(201).json({ success: true, data });
  }

  /** DELETE /:poId/links/:linkId — Undo one link while nothing has arrived for it */
  async undo(req: Request, res: Response) {
    const { poId, linkId } = req.params as PoAllocationLinkParams;
    const data = await undoPoAllocation(poId, linkId, userIdOf(req));
    res.json({ success: true, data });
  }
}

export const poAllocationController = new PoAllocationController();
