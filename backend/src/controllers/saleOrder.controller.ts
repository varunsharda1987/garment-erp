import { Request, Response } from 'express';
import { saleOrderService } from '../services/saleOrder.service';
import { NotFoundError, ValidationError } from '../errors';

export class SaleOrderController {
  async getAll(req: Request, res: Response) {
    const { page = '1', limit = '20', search, status, customerId, isActive, sortBy, sortOrder } = req.query;

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
  }

  async search(req: Request, res: Response) {
    const { search, limit = '50' } = req.query;
    const results = await saleOrderService.search({
      search: search as string | undefined,
      limit: parseInt(limit as string, 10),
    });
    res.json(results);
  }

  async getById(req: Request, res: Response) {
    const { id } = req.params;
    const so = await saleOrderService.getById(id);

    if (!so) {
      throw new NotFoundError('Sale Order', id);
    }

    res.json(so);
  }

  async create(req: Request, res: Response) {
    const { customerId, expectedShipDate, remarks, items } = req.body;
    const userId = req.user?.id;

    if (!customerId) {
      throw new ValidationError('Customer is required');
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new ValidationError('At least one item is required');
    }

    const so = await saleOrderService.create({
      customerId,
      expectedShipDate: expectedShipDate ? new Date(expectedShipDate) : undefined,
      remarks,
      createdById: userId,
      items,
    });

    res.status(201).json(so);
  }

  async update(req: Request, res: Response) {
    const { id } = req.params;
    const { expectedShipDate, remarks, items } = req.body;

    const so = await saleOrderService.update(id, {
      expectedShipDate: expectedShipDate ? new Date(expectedShipDate) : undefined,
      remarks,
      items,
    });

    res.json(so);
  }

  async delete(req: Request, res: Response) {
    const { id } = req.params;
    await saleOrderService.delete(id);
    res.json({ message: 'Sale Order deleted successfully' });
  }

  async confirm(req: Request, res: Response) {
    const { id } = req.params;
    const userId = req.user?.id;

    const so = await saleOrderService.confirm(id, userId);
    res.json(so);
  }

  async allocateStock(req: Request, res: Response) {
    const { saleOrderItemId, fgStockId, quantity } = req.body;
    const userId = req.user?.id;

    if (!saleOrderItemId || !fgStockId || !quantity) {
      throw new ValidationError('saleOrderItemId, fgStockId, and quantity are required');
    }

    const allocation = await saleOrderService.allocateStock(saleOrderItemId, fgStockId, quantity, userId);

    res.status(201).json(allocation);
  }

  async getAvailableStock(req: Request, res: Response) {
    const { styleId, colorId, sizeId } = req.query;

    if (!styleId) {
      throw new ValidationError('styleId is required');
    }

    const stock = await saleOrderService.getAvailableStock(
      styleId as string,
      colorId as string | undefined,
      sizeId as string | undefined
    );

    res.json(stock);
  }
}

export const saleOrderController = new SaleOrderController();
