import { Request, Response } from 'express';
import { tcsService } from '../services/tcs.service';

class TCSController {
  async getAll(req: Request, res: Response) {
    try {
      const result = await tcsService.getAll({
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
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const entry = await tcsService.getById(req.params.id);
      if (!entry) return res.status(404).json({ message: 'TCS entry not found' });
      res.json(entry);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });
      const entry = await tcsService.create(req.body, userId);
      res.status(201).json(entry);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const entry = await tcsService.update(req.params.id, req.body);
      res.json(entry);
    } catch (error: any) {
      if (error.code === 'P2025') return res.status(404).json({ message: 'TCS entry not found' });
      res.status(500).json({ message: error.message });
    }
  }

  async updateStatus(req: Request, res: Response) {
    try {
      const { status } = req.body;
      const entry = await tcsService.updateStatus(req.params.id, status);
      res.json(entry);
    } catch (error: any) {
      if (error.code === 'P2025') return res.status(404).json({ message: 'TCS entry not found' });
      res.status(500).json({ message: error.message });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      await tcsService.delete(req.params.id);
      res.json({ message: 'TCS entry deleted' });
    } catch (error: any) {
      if (error.code === 'P2025') return res.status(404).json({ message: 'TCS entry not found' });
      res.status(500).json({ message: error.message });
    }
  }

  async getSummary(req: Request, res: Response) {
    try {
      const financialYear = req.query.financialYear as string;
      if (!financialYear) return res.status(400).json({ message: 'financialYear is required' });
      const summary = await tcsService.getSummary(financialYear);
      res.json(summary);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
}

export const tcsController = new TCSController();
