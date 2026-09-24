import { Request, Response } from 'express';
import { saleOrderService } from '../services/saleOrder.service';
import { applyOrderItemSizeBreakup } from './order.controller';
import { createAuditLog } from '../services/audit.service';
import { NotFoundError, ValidationError, UnauthorizedError } from '../errors';

/**
 * Partial-update date semantics: omitted (undefined) leaves the column alone, an explicit null
 * clears it. Both spellings arrive as strings from the wire, so the check must be on `undefined`
 * itself — `value ? new Date(value) : null` treats the two identically and silently clears.
 */
function toNullableDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return new Date(value);
}

export class SaleOrderController {
  async getAll(req: Request, res: Response) {
    const {
      page = '1',
      limit = '20',
      search,
      status,
      customerId,
      isActive,
      sortBy,
      sortOrder,
      fromDate,
      toDate,
    } = req.query;

    const result = await saleOrderService.getAll({
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
      search: search as string | undefined,
      status: status as any,
      customerId: customerId as string | undefined,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      fromDate: fromDate as string | undefined,
      toDate: toDate as string | undefined,
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
      buyerPoNumber,
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
    // Items are deliberately OPTIONAL: a sale order starts as an empty DRAFT and lines are added
    // on the detail page (the AI assistant's create_sale_order action relies on this, and the Zod
    // schema has always defaulted `items` to []). `confirm` is the gate that requires ≥1 line.

    const so = await saleOrderService.create({
      customerId,
      buyerPoNumber: buyerPoNumber ?? null,
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
      buyerPoNumber,
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
      buyerPoNumber,
      styleId,
      // undefined = field omitted = leave unchanged; null = explicitly cleared. The old
      // `x ? new Date(x) : null` collapsed "omitted" into "clear it", so any partial PUT wiped
      // these two dates while every sibling field below correctly left them alone.
      expectedShipDate: toNullableDate(expectedShipDate),
      buyerDeadline: toNullableDate(buyerDeadline),
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

  /**
   * Start production for a confirmed sale order (make-to-order).
   * Creates a linked production order for the full SO quantity; work orders auto-created.
   */
  async startProduction(req: Request, res: Response) {
    const { id } = req.params;
    const { expectedDeliveryDate, priority, remarks, quantityMode, items } = req.body;
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedError();
    }

    const order = await saleOrderService.startProduction(id, userId, {
      expectedDeliveryDate,
      priority,
      remarks,
      quantityMode,
      items,
    });

    res.status(201).json({ data: order, message: 'Production order created' });
  }

  async getLinkableProductionOrders(req: Request, res: Response) {
    const data = await saleOrderService.getLinkableProductionOrders(req.params.id);
    res.json({ data });
  }

  /**
   * Link an existing production order to this sale order, then copy the buyer PO's sizes onto any
   * order item that has none (the sizes-later cascade: MRP re-run, production run created).
   */
  async linkProductionOrder(req: Request, res: Response) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedError();
    }
    const linked = await saleOrderService.linkProductionOrder(req.params.id, req.body.orderId);

    const sized: Array<{ orderItemId: string; newTotal?: number; error?: string; runs?: string[] }> = [];
    for (const item of linked.toSize) {
      try {
        const result = await applyOrderItemSizeBreakup({
          orderId: linked.orderId,
          orderItemId: item.orderItemId,
          breakup: item.breakup,
          confirmQuantityChange: true, // the production order makes the buyer PO exactly
          userId,
        });
        sized.push({
          orderItemId: item.orderItemId,
          newTotal: result.data.newTotal,
          runs: result.data.workOrders?.created ?? [],
          ...(result.data.mrpError ? { error: `Requirements not recalculated: ${result.data.mrpError}` } : {}),
        });
      } catch (err) {
        // The link stands; the sizes can still be entered on the order page
        sized.push({ orderItemId: item.orderItemId, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    const failed = sized.filter((s) => s.error);
    res.json({
      data: { ...linked, sized },
      message:
        `${linked.orderNumber} linked to ${linked.saleOrderNumber}` +
        (sized.length > 0
          ? ` — sizes copied from the buyer PO (${sized.length - failed.length}/${sized.length})`
          : '') +
        (failed.length > 0 ? `. ${failed[0].error}` : ''),
    });
  }

  /**
   * Admin correction of a confirmed order's size split. The new split is copied onto the linked
   * production order (its PENDING runs follow) where that order still mirrored the old one.
   */
  async amendQuantities(req: Request, res: Response) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedError();
    }
    const { lines, reason } = req.body;
    const amended = await saleOrderService.amendQuantities(req.params.id, lines);

    await createAuditLog({
      userId,
      action: 'UPDATE',
      entityType: 'SALE_ORDER',
      entityId: req.params.id,
      oldValues: { quantities: amended.changes.map((c) => ({ style: c.style, size: c.size, quantity: c.from })) },
      newValues: {
        quantities: amended.changes.map((c) => ({ style: c.style, size: c.size, quantity: c.to })),
        reason,
      },
      ipAddress: req.ip ?? null,
    });

    const sized: Array<{ orderItemId: string; newTotal?: number; error?: string }> = [];
    for (const item of amended.toSize) {
      try {
        const result = await applyOrderItemSizeBreakup({
          orderId: amended.linkedOrder!.orderId,
          orderItemId: item.orderItemId,
          breakup: item.breakup,
          confirmQuantityChange: true, // the production order makes the buyer PO exactly
          userId,
        });
        sized.push({
          orderItemId: item.orderItemId,
          newTotal: result.data.newTotal,
          ...(result.data.mrpError ? { error: `Requirements not recalculated: ${result.data.mrpError}` } : {}),
        });
      } catch (err) {
        // The amendment stands; the order's sizes can still be corrected on the order page
        sized.push({ orderItemId: item.orderItemId, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    const failed = sized.filter((s) => s.error);
    const order = amended.linkedOrder?.orderNumber;
    res.json({
      data: { ...amended, sized },
      message:
        `${amended.saleOrderNumber} amended (${amended.changes.length} line${amended.changes.length === 1 ? '' : 's'})` +
        (sized.length - failed.length > 0 ? ` — ${order} updated to the new sizes` : '') +
        (amended.notFollowed.length > 0
          ? `. ${order} was NOT changed for ${amended.notFollowed.join(', ')} — its sizes already differed from this sale order; correct them on the order page`
          : '') +
        (failed.length > 0 ? `. ${failed[0].error}` : ''),
    });
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

  /**
   * Add a buyer PO number to a sale order.
   */
  async addBuyerPo(req: Request, res: Response) {
    const { id } = req.params;
    const { buyerPoNumber, remarks, deliveryAddressId, poDate } = req.body;

    const result = await saleOrderService.addBuyerPo(id, buyerPoNumber, remarks, { deliveryAddressId, poDate });
    res.status(201).json({ data: result, message: 'Buyer PO added' });
  }

  /**
   * Edit a buyer PO's delivery location / PO date / remarks.
   */
  async updateBuyerPo(req: Request, res: Response) {
    const { poId } = req.params;

    const result = await saleOrderService.updateBuyerPo(poId, req.body);
    res.json({ data: result, message: 'Buyer PO updated' });
  }

  /**
   * Attach (or replace) the customer's PO document on a buyer PO.
   */
  async uploadBuyerPoDocument(req: Request, res: Response) {
    const { poId } = req.params;
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) {
      throw new ValidationError('A PO file is required');
    }

    const result = await saleOrderService.attachBuyerPoDocument(
      poId,
      {
        // Root-relative, matching every other upload in the app — the frontend prefixes it with
        // getUploadUrl(). Served from behind an auth check; see app.ts.
        fileUrl: `/uploads/po-documents/${file.filename}`,
        fileName: file.originalname,
        fileSize: file.size,
      },
      req.user?.userId
    );
    res.status(201).json({ data: result, message: 'PO document uploaded' });
  }

  /**
   * Remove the PO document, leaving the buyer PO itself in place.
   */
  async removeBuyerPoDocument(req: Request, res: Response) {
    const { poId } = req.params;

    const result = await saleOrderService.removeBuyerPoDocument(poId);
    res.json({ data: result, message: 'PO document removed' });
  }

  /**
   * Remove a buyer PO from a sale order.
   */
  async removeBuyerPo(req: Request, res: Response) {
    const { poId } = req.params;

    await saleOrderService.removeBuyerPo(poId);
    res.json({ message: 'Buyer PO removed' });
  }

  /**
   * Set a buyer PO as primary for a sale order.
   */
  async setPrimaryBuyerPo(req: Request, res: Response) {
    const { poId } = req.params;

    const result = await saleOrderService.setPrimaryBuyerPo(poId);
    res.json({ data: result, message: 'Primary buyer PO updated' });
  }
}

export const saleOrderController = new SaleOrderController();
