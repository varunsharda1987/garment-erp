import { Request, Response } from 'express';
import { stockProductionOrderService } from '../services/stockProductionOrder.service';

export class StockProductionOrderController {

  async getAll(req: Request, res: Response) {
    try {
      const {
        page = '1',
        limit = '20',
        search,
        status,
        styleId,
        isActive,
        sortBy,
        sortOrder,
      } = req.query;

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
    } catch (error: any) {
      console.error('Error fetching stock production orders:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch stock production orders' });
    }
  }

  async search(req: Request, res: Response) {
    try {
      const { search, limit = '50' } = req.query;

      const results = await stockProductionOrderService.search({
        search: search as string | undefined,
        limit: parseInt(limit as string, 10),
      });

      res.json(results);
    } catch (error: any) {
      console.error('Error searching stock production orders:', error);
      res.status(500).json({ message: error.message || 'Failed to search stock production orders' });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const spo = await stockProductionOrderService.getById(id);

      if (!spo) {
        return res.status(404).json({ message: 'Stock Production Order not found' });
      }

      res.json(spo);
    } catch (error: any) {
      console.error('Error fetching stock production order:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch stock production order' });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const { styleId, totalQuantity, targetDate, priority, remarks, items } = req.body;
      const userId = (req as any).user?.id;

      if (!styleId) {
        return res.status(400).json({ message: 'Style is required' });
      }
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'At least one item (size/color breakup) is required' });
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
    } catch (error: any) {
      console.error('Error creating stock production order:', error);
      res.status(500).json({ message: error.message || 'Failed to create stock production order' });
    }
  }

  async update(req: Request, res: Response) {
    try {
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
    } catch (error: any) {
      console.error('Error updating stock production order:', error);
      if (error.code === 'P2025') {
        return res.status(404).json({ message: 'Stock Production Order not found' });
      }
      res.status(400).json({ message: error.message || 'Failed to update stock production order' });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await stockProductionOrderService.delete(id);
      res.json({ message: 'Stock Production Order deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting stock production order:', error);
      if (error.code === 'P2025') {
        return res.status(404).json({ message: 'Stock Production Order not found' });
      }
      res.status(400).json({ message: error.message || 'Failed to delete stock production order' });
    }
  }

  async approve(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      const spo = await stockProductionOrderService.approve(id, userId);
      res.json(spo);
    } catch (error: any) {
      console.error('Error approving stock production order:', error);
      res.status(400).json({ message: error.message || 'Failed to approve stock production order' });
    }
  }

  async generateWorkOrders(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      const workOrder = await stockProductionOrderService.generateWorkOrders(id, userId);
      res.status(201).json(workOrder);
    } catch (error: any) {
      console.error('Error generating work orders:', error);
      res.status(400).json({ message: error.message || 'Failed to generate work orders' });
    }
  }
}

export const stockProductionOrderController = new StockProductionOrderController();
