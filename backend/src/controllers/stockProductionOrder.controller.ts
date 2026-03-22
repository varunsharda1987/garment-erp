import { Request, Response } from 'express';
import { stockProductionOrderService } from '../services/stockProductionOrder.service';
import { NotFoundError, ValidationError } from '../errors';

export class StockProductionOrderController {
  async getAll(req: Request, res: Response) {
    const { page = '1', limit = '20', search, status, styleId, isActive, sortBy, sortOrder } = req.query;

    const result = await stockProductionOrderService.getAll({
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
      search: search as string | undefined,
      status: status as any,
      styleId: styleId as string | undefined,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      sortBy: sortBy as string | undefined,
      sortOrder: sortOrder as 'asc' | 'desc' | undefined,
    });

    res.json(result);
  }

  async search(req: Request, res: Response) {
    const { search, limit = '50' } = req.query;

    const results = await stockProductionOrderService.search({
      search: search as string | undefined,
      limit: parseInt(limit as string, 10),
    });

    res.json(results);
  }

  async getById(req: Request, res: Response) {
    const { id } = req.params;
    const spo = await stockProductionOrderService.getById(id);

    if (!spo) {
      throw new NotFoundError('Stock Production Order', id);
    }

    res.json(spo);
  }

  async create(req: Request, res: Response) {
    const { styleId, totalQuantity, targetDate, priority, remarks, items } = req.body;
    const userId = (req as any).user?.id;

    if (!styleId) {
      throw new ValidationError('Style is required');
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new ValidationError('At least one item (size/color breakup) is required');
    }

    const spo = await stockProductionOrderService.create({
      styleId,
      totalQuantity,
      targetDate: targetDate ? new Date(targetDate) : undefined,
      priority,
      remarks,
      createdById: userId,
      items,
    });

    res.status(201).json(spo);
  }

  async update(req: Request, res: Response) {
    const { id } = req.params;
    const { totalQuantity, targetDate, priority, remarks, items } = req.body;

    const spo = await stockProductionOrderService.update(id, {
      totalQuantity,
      targetDate: targetDate ? new Date(targetDate) : undefined,
      priority,
      remarks,
      items,
    });

    res.json(spo);
  }

  async delete(req: Request, res: Response) {
    const { id } = req.params;
    await stockProductionOrderService.delete(id);
    res.json({ message: 'Stock Production Order deleted successfully' });
  }

  async approve(req: Request, res: Response) {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    const spo = await stockProductionOrderService.approve(id, userId);
    res.json(spo);
  }

  async generateWorkOrders(req: Request, res: Response) {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    const workOrder = await stockProductionOrderService.generateWorkOrders(id, userId);
    res.status(201).json(workOrder);
  }
}

export const stockProductionOrderController = new StockProductionOrderController();
