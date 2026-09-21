/**
 * Wash-care codes per buyer per fabric.
 *
 * Reads are listed for one fabric (the fabric's own screen shows every customer's code side by
 * side, which is the whole point — the same fabric, different customers, different codes).
 */

import { Request, Response } from 'express';
import { washCareService } from '../services/washCare.service';
import { ValidationError } from '../errors';
import { SetWashCareInput, WashCareQueryInput } from '../schemas/washCare.schema';

function validatedQuery<T>(req: Request): T {
  // Coerced query lives only on req.validatedQuery under Express 5 — req.query is raw strings.
  return ((req as Request & { validatedQuery?: unknown }).validatedQuery ?? req.query) as T;
}

export class WashCareController {
  async list(req: Request, res: Response) {
    const { greigeId } = validatedQuery<WashCareQueryInput>(req);
    if (!greigeId) throw new ValidationError('greigeId is required');
    res.json({ success: true, data: await washCareService.listForGreige(greigeId) });
  }

  async set(req: Request, res: Response) {
    const userId = (req as Request & { user?: { id: string } }).user!.id;
    const row = await washCareService.set(req.body as SetWashCareInput, userId);
    res.status(201).json({ success: true, data: row });
  }

  async remove(req: Request, res: Response) {
    await washCareService.remove(req.params.id);
    res.json({ success: true, message: 'Wash care code removed' });
  }
}

export const washCareController = new WashCareController();
