import { Request, Response } from 'express';
import { tdsService } from '../services/tds.service';
import { NotFoundError, ValidationError, UnauthorizedError } from '../errors';

class TDSController {
  async getAll(req: Request, res: Response) {
    const result = await tdsService.getAll({
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      search: req.query.search as string,
      financialYear: req.query.financialYear as string,
      quarter: req.query.quarter ? parseInt(req.query.quarter as string) : undefined,
      status: req.query.status as string,
      sortBy: req.query.sortBy as string,
      sortOrder: req.query.sortOrder as 'asc' | 'desc',
    });
    res.json(result);
  }

  async getById(req: Request, res: Response) {
    const entry = await tdsService.getById(req.params.id);
    if (!entry) throw new NotFoundError('TDS entry', req.params.id);
    res.json(entry);
  }

  async create(req: Request, res: Response) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedError('Authentication required');
    const entry = await tdsService.create(req.body, userId);
    res.status(201).json({ data: entry, message: 'TDS entry created successfully' });
  }

  async update(req: Request, res: Response) {
    const entry = await tdsService.update(req.params.id, req.body);
    res.json(entry);
  }

  async updateStatus(req: Request, res: Response) {
    const { status, certificateNo } = req.body;
    const entry = await tdsService.updateStatus(req.params.id, status, certificateNo);
    res.json(entry);
  }

  async delete(req: Request, res: Response) {
    await tdsService.delete(req.params.id);
    res.json({ message: 'TDS entry deleted' });
  }

  async getSummary(req: Request, res: Response) {
    const financialYear = req.query.financialYear as string;
    if (!financialYear) throw new ValidationError('financialYear is required');
    const summary = await tdsService.getSummary(financialYear);
    res.json(summary);
  }
}

export const tdsController = new TDSController();
