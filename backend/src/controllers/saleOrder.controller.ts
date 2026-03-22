import { Request, Response } from 'express';
import { saleOrderService } from '../services/saleOrder.service';

export class SaleOrderController {

  async getAll(req: Request, res: Response) {
    try {
      const {
        page = '1',
        limit = '20',
        search,
        status,
        customerId,
        isActive,
        sortBy,
        sortOrder,
      } = req.query;

      const result = await saleOrderService.getAll({
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
        search: search as string | undefined,
        status: status as any,
        customerId: customerId as string | undefined,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        sortBy: sortBy as string | undefined,
        sortOrder: sortOrder as 'asc' | 'desc' | undefined,
      });

      res.json(result);
    } catch (error: any) {
      console.error('Error fetching sale orders:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch sale orders' });
    }
  }

  async search(req: Request, res: Response) {
    try {
      const { search, limit = '50' } = req.query;
      const results = await saleOrderService.search({
        search: search as string | undefined,
        limit: parseInt(limit as string, 10),
      });
      res.json(results);
    } catch (error: any) {
      console.error('Error searching sale orders:', error);
      res.status(500).json({ message: error.message || 'Failed to search sale orders' });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const so = await saleOrderService.getById(id);

      if (!so) {
        return res.status(404).json({ message: 'Sale Order not found' });
      }

      res.json(so);
    } catch (error: any) {
      console.error('Error fetching sale order:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch sale order' });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const { customerId, expectedShipDate, remarks, items } = req.body;
      const userId = (req as any).user?.id;

      if (!customerId) {
        return res.status(400).json({ message: 'Customer is required' });
      }
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'At least one item is required' });
      }

      const so = await saleOrderService.create({
        customerId,
        expectedShipDate: expectedShipDate ? new Date(expectedShipDate) : undefined,
        remarks,
        createdById: userId,
        items,
      });

      res.status(201).json(so);
    } catch (error: any) {
      console.error('Error creating sale order:', error);
      res.status(500).json({ message: error.message || 'Failed to create sale order' });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { expectedShipDate, remarks, items } = req.body;

      const so = await saleOrderService.update(id, {
        expectedShipDate: expectedShipDate ? new Date(expectedShipDate) : undefined,
        remarks,
        items,
      });

      res.json(so);
    } catch (error: any) {
      console.error('Error updating sale order:', error);
      if (error.code === 'P2025') {
        return res.status(404).json({ message: 'Sale Order not found' });
      }
      res.status(400).json({ message: error.message || 'Failed to update sale order' });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await saleOrderService.delete(id);
      res.json({ message: 'Sale Order deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting sale order:', error);
      if (error.code === 'P2025') {
        return res.status(404).json({ message: 'Sale Order not found' });
      }
      res.status(400).json({ message: error.message || 'Failed to delete sale order' });
    }
  }

  async confirm(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      const so = await saleOrderService.confirm(id, userId);
      res.json(so);
    } catch (error: any) {
      console.error('Error confirming sale order:', error);
      res.status(400).json({ message: error.message || 'Failed to confirm sale order' });
    }
  }

  async allocateStock(req: Request, res: Response) {
    try {
      const { saleOrderItemId, fgStockId, quantity } = req.body;
      const userId = (req as any).user?.id;

      if (!saleOrderItemId || !fgStockId || !quantity) {
        return res.status(400).json({ message: 'saleOrderItemId, fgStockId, and quantity are required' });
      }

      const allocation = await saleOrderService.allocateStock(
        saleOrderItemId,
        fgStockId,
        quantity,
        userId
      );

      res.status(201).json(allocation);
    } catch (error: any) {
      console.error('Error allocating stock:', error);
      res.status(400).json({ message: error.message || 'Failed to allocate stock' });
    }
  }

  async getAvailableStock(req: Request, res: Response) {
    try {
      const { styleId, colorId, sizeId } = req.query;

      if (!styleId) {
        return res.status(400).json({ message: 'styleId is required' });
      }

      const stock = await saleOrderService.getAvailableStock(
        styleId as string,
        colorId as string | undefined,
        sizeId as string | undefined
      );

      res.json(stock);
    } catch (error: any) {
      console.error('Error fetching available stock:', error);
      res.status(500).json({ message: error.message || 'Failed to fetch available stock' });
    }
  }
}

export const saleOrderController = new SaleOrderController();
