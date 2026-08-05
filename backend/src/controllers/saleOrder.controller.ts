import { Request, Response } from 'express';
import { saleOrderService } from '../services/saleOrder.service';
import { NotFoundError, ValidationError, UnauthorizedError } from '../errors';

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
    const {
      customerId,
      styleId,
      expectedShipDate,
      buyerDeadline,
      orderDate,
      deliveryDate,
      paymentTerms,
      deliveryAddress,
      remarks,
      items,
    } = req.body;
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedError();
    }

    if (!customerId) {
      throw new ValidationError('Customer is required');
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new ValidationError('At least one item is required');
    }

    const so = await saleOrderService.create({
      customerId,
      styleId: styleId || null,
      expectedShipDate: expectedShipDate ? new Date(expectedShipDate) : null,
      buyerDeadline: buyerDeadline ? new Date(buyerDeadline) : null,
      // Zod z.coerce.date() already produced Date objects (or null/undefined)
      orderDate: orderDate ?? null,
      deliveryDate: deliveryDate ?? null,
      paymentTerms: paymentTerms ?? null,
      deliveryAddress: deliveryAddress ?? null,
      remarks,
      createdById: userId,
      items,
    });

    res.status(201).json({ data: so, message: 'Sale order created successfully' });
  }

  async update(req: Request, res: Response) {
    const { id } = req.params;
    // BUG-ORD5 fix: Include customerId in destructuring (was silently dropped before)
    const {
      customerId,
      styleId,
      expectedShipDate,
      buyerDeadline,
      orderDate,
      deliveryDate,
      paymentTerms,
      deliveryAddress,
      remarks,
      items,
    } = req.body;

    const so = await saleOrderService.update(id, {
      customerId,
      styleId,
      expectedShipDate: expectedShipDate ? new Date(expectedShipDate) : null,
      buyerDeadline: buyerDeadline ? new Date(buyerDeadline) : null,
      // undefined = field omitted = leave unchanged; Zod coerced dates already
      orderDate,
      deliveryDate,
      paymentTerms,
      deliveryAddress,
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
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedError();
    }

    const so = await saleOrderService.confirm(id, userId);
    res.json(so);
  }

  async allocateStock(req: Request, res: Response) {
    const { saleOrderItemId, fgStockId, quantity } = req.body;
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedError();
    }

    if (!saleOrderItemId || !fgStockId || !quantity) {
      throw new ValidationError('saleOrderItemId, fgStockId, and quantity are required');
    }

    const allocation = await saleOrderService.allocateStock(saleOrderItemId, fgStockId, quantity, userId);

    res.status(201).json({ data: allocation, message: 'Stock allocated successfully' });
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

  /**
   * Get stock preview for a sale order before confirmation.
   * Shows FG stock availability + style readiness for items needing production.
   */
  async getStockPreview(req: Request, res: Response) {
    const { id } = req.params;
    const preview = await saleOrderService.getStockPreview(id);
    res.json(preview);
  }

  /**
   * Cancel a sale order and release all FG stock allocations.
   * P7.2: Allocation lifecycle — prevents permanent phantom allocations.
   */
  async cancel(req: Request, res: Response) {
    const { id } = req.params;
    const result = await saleOrderService.cancel(id);
    res.json({ data: result, message: 'Sale order cancelled, allocations released' });
  }

  /**
   * Deallocate (release) a specific FG stock allocation.
   * P7.2: Allows partial deallocation when stock needs to go elsewhere.
   */
  async deallocate(req: Request, res: Response) {
    const { allocationId } = req.body;

    if (!allocationId) {
      throw new ValidationError('allocationId is required');
    }

    const result = await saleOrderService.deallocateStock(allocationId);
    res.json({ data: result, message: 'Allocation released successfully' });
  }
}

export const saleOrderController = new SaleOrderController();
