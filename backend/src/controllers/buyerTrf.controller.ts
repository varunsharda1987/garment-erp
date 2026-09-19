/**
 * Buyer Test Requirement Form (TRF) — controller.
 *
 * Thin: validation lives in the Zod schemas, derivation and rules in the service. Errors are
 * thrown, not caught — asyncHandler plus the error middleware turn AppError subclasses into
 * their proper status codes, so a try/catch here would only flatten a 404 into a 500.
 */

import { Request, Response } from 'express';
import { buyerTrfService } from '../services/buyerTrf.service';
import { buildTrfFormOptions } from '../constants/buyer-trf.constants';
import {
  CreateBuyerTrfInput,
  UpdateBuyerTrfInput,
  BuyerTrfQueryInput,
  BuyerTrfPrefillQueryInput,
} from '../schemas/buyerTrf.schema';

export class BuyerTrfController {
  /**
   * Every label and print order the form needs, so the frontend never re-types one.
   * Static — served straight from the catalogue constants.
   */
  async formOptions(_req: Request, res: Response) {
    res.json({ success: true, data: buildTrfFormOptions() });
  }

  /**
   * What a TRF for this style would be pre-filled with, without creating one.
   * Returns the derived values, the fields that could not be derived, and where each value
   * came from.
   */
  async prefill(req: Request, res: Response) {
    const { styleId, workOrderId, saleOrderId } = req.query as unknown as BuyerTrfPrefillQueryInput;
    const result = await buyerTrfService.buildPrefill(styleId, { workOrderId, saleOrderId });
    res.json({ success: true, data: result });
  }

  async getAll(req: Request, res: Response) {
    const result = await buyerTrfService.getAll(req.query as unknown as BuyerTrfQueryInput);
    res.json({ success: true, ...result });
  }

  async getById(req: Request, res: Response) {
    const trf = await buyerTrfService.getById(req.params.id);
    res.json({ success: true, data: trf });
  }

  async create(req: Request, res: Response) {
    const userId = (req as Request & { user?: { id: string } }).user!.id;
    const trf = await buyerTrfService.create(req.body as CreateBuyerTrfInput, userId);
    res.status(201).json({ success: true, data: trf });
  }

  async update(req: Request, res: Response) {
    const trf = await buyerTrfService.update(req.params.id, req.body as UpdateBuyerTrfInput);
    res.json({ success: true, data: trf });
  }

  async delete(req: Request, res: Response) {
    await buyerTrfService.delete(req.params.id);
    res.json({ success: true, message: 'Test requirement form removed' });
  }
}

export const buyerTrfController = new BuyerTrfController();
