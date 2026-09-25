import { Request, Response } from 'express';
import { weaverService } from '../services/weaver.service';
import type { CreateWeaverInput, WeaverQuery } from '../schemas/weaver.schema';

export const weaverController = {
  async search(req: Request, res: Response) {
    // The COERCED query lives only on req.validatedQuery (limit arrives as a string on req.query).
    const data = await weaverService.search((req.validatedQuery ?? req.query) as unknown as WeaverQuery);
    res.json({ success: true, data });
  },

  async create(req: Request, res: Response) {
    const { name, city, supplierId } = req.body as CreateWeaverInput;
    const { weaver, created } = await weaverService.findOrCreate({ name, city, supplierId }, req.user!.userId);
    res.status(created ? 201 : 200).json({ success: true, data: weaver, created });
  },
};
