import prisma from '../config/database';
import { Prisma, SaleOrderStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { generateAtomicDocNumber } from '../utils/atomicCodeGenerator';
import { multiplyCurrency, divideCurrency, roundToCent, Decimal } from '../utils/currency';
import { orderService, OrderItemInput, OrderPriority } from './order.service';
import { NotFoundError, ValidationError, ConflictError, BusinessError } from '../errors';
import { recomputeSaleOrderStatus } from './helpers/sale-order-status.helper';
import { processorRateValidationService } from './processor-rate-validation.service';
import { logWarn, logInfo } from '../utils/logger';
import { sampleService } from './sample.service';
import { applySearch } from '../utils/search-filter';
import { deleteBuyerPoDocumentFile } from '../middleware/upload.middleware';

/** A line as it arrives from the ERP form or the B2B push. */
interface SOItemInput {
  styleId: string;
  colorId?: string | null;
  sizeId?: string | null;
  quantity: number;
  unitPrice: number;
  remarks?: string;
  /**
   * The buyer's own style code for this line. OMIT IT and the style's current code is captured;
   * SEND IT (including the value read back from this order) and it is kept verbatim — which is how
   * an edit preserves the code the line was originally taken under.
   */
  buyerStyleRef?: string | null;
}

interface SOCreateInput {
  customerId: string;
  buyerPoNumber?: string | null; // Buyer's (HOK) PO number — B2B tracking key
  styleId?: string | null; // Primary style for the order
  expectedShipDate?: Date | null;
  buyerDeadline?: Date | null; // Buyer's required completion date
  orderDate?: Date | null; // Buyer's PO/order date
  deliveryDate?: Date | null; // Agreed delivery date
  paymentTerms?: string | null;
  deliveryAddress?: string | null;
  remarks?: string;
  createdById: string;
  items: SOItemInput[];
}

interface SOUpdateInput {
  customerId?: string; // BUG-ORD5 fix: Allow changing customer on draft orders
  buyerPoNumber?: string | null; // undefined = leave unchanged, null = clear
  styleId?: string | null; // Primary style for the order
  expectedShipDate?: Date | null;
  buyerDeadline?: Date | null; // Buyer's required completion date
  orderDate?: Date | null; // Buyer's PO/order date (undefined = leave unchanged)
  deliveryDate?: Date | null;
  paymentTerms?: string | null;
  deliveryAddress?: string | null;
  remarks?: string;
  items?: SOItemInput[];
}

/** A line ready to persist: deduplicated, with its money already rounded to the stored scale. */
interface NormalisedSOItem {
  styleId: string;
  colorId: string | null;
  sizeId: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  remarks: string | null;
  buyerStyleRef: string | null;
}

/**
 * The buyer's current style code for each of these styles, for snapshotting onto new lines.
 *
 * `styles.buyerStyleRef` is one editable field with no history: re-coding a style rewrote every
 * document that reprinted afterwards. Capturing it per line freezes what the buyer actually
 * ordered under.
 */
async function loadBuyerStyleRefs(
  client: Prisma.TransactionClient | typeof prisma,
  styleIds: string[]
): Promise<Map<string, string | null>> {
  const unique = [...new Set(styleIds)];
  if (unique.length === 0) return new Map();

  const styles = await client.styles.findMany({
    where: { id: { in: unique } },
    select: { id: true, buyerStyleRef: true },
  });
  return new Map(styles.map((s) => [s.id, s.buyerStyleRef]));
}

/**
 * Collapse duplicate lines and compute line money with decimal arithmetic.
 *
 * `sale_order_items` is unique on (saleOrderId, styleId, colorId, sizeId), but Postgres treats
 * NULLs as DISTINCT — so two lines for the same style with no colour slipped past the index and
 * became two rows, while two fully-specified duplicates hit P2002 and surfaced a raw
 * "Unique constraint" 409. Both callers now merge duplicates up front, so neither happens.
 *
 * Money: quantity × unitPrice on floats stores 3.4499999999999997 as 3.44 in a Decimal(12,2)
 * column; decimal.js rounds it to 3.45 (CLAUDE.md money-math rule).
 */
function normaliseSOItems(
  items: SOItemInput[],
  /** Current buyer style code per style id, used only for lines that did not send their own. */
  buyerStyleRefs: Map<string, string | null> = new Map()
): { items: NormalisedSOItem[]; subtotal: number } {
  const merged = new Map<string, NormalisedSOItem>();

  for (const item of items) {
    const colorId = item.colorId || null;
    const sizeId = item.sizeId || null;
    const key = `${item.styleId}|${colorId ?? ''}|${sizeId ?? ''}`;
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, {
        styleId: item.styleId,
        colorId,
        sizeId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: 0, // computed below, once the merged quantity is final
        remarks: item.remarks ?? null,
        // An explicit value (even null) is honoured, so re-saving an order keeps the code its
        // lines were taken under. Only an ABSENT field snapshots today's code.
        buyerStyleRef:
          item.buyerStyleRef !== undefined ? item.buyerStyleRef : (buyerStyleRefs.get(item.styleId) ?? null),
      });
      continue;
    }

    // Merging lines that disagree on price would silently pick a winner and change the order
    // value — make the caller resolve it instead.
    if (existing.unitPrice !== item.unitPrice) {
      throw new ValidationError(
        `The same style/colour/size appears twice with different unit prices ` +
          `(₹${existing.unitPrice} and ₹${item.unitPrice}). Merge the lines or give them one price.`
      );
    }
    existing.quantity += item.quantity;
    existing.remarks = existing.remarks ?? item.remarks ?? null;
    existing.buyerStyleRef = existing.buyerStyleRef ?? item.buyerStyleRef ?? null;
  }

  const normalised = [...merged.values()];
  let subtotal = new Decimal(0);
  for (const item of normalised) {
    const lineTotal = roundToCent(multiplyCurrency(item.quantity, item.unitPrice));
    item.totalPrice = lineTotal.toNumber();
    subtotal = subtotal.plus(lineTotal);
  }

  return { items: normalised, subtotal: roundToCent(subtotal).toNumber() };
}

/**
 * Promote the oldest remaining buyer PO to primary and mirror it onto the legacy
 * `sale_orders.buyerPoNumber` column (or clear the column when none is left).
 */
async function promoteNextBuyerPo(tx: Prisma.TransactionClient, saleOrderId: string) {
  const next = await tx.sale_order_buyer_pos.findFirst({
    where: { saleOrderId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, buyerPoNumber: true },
  });

  if (!next) {
    await tx.sale_orders.update({ where: { id: saleOrderId }, data: { buyerPoNumber: null } });
    return;
  }

  await tx.sale_order_buyer_pos.update({ where: { id: next.id }, data: { isPrimary: true } });
  await tx.sale_orders.update({ where: { id: saleOrderId }, data: { buyerPoNumber: next.buyerPoNumber } });
}

/**
 * Point a sale order's PRIMARY buyer PO at `value`, keeping the `sale_order_buyer_pos` junction
 * and the legacy `sale_orders.buyerPoNumber` column in step.
 *
 * Both list and detail pages read the junction in preference to the column, so an edit that
 * touched only the column (what `update` used to do, when it did not drop the field entirely)
 * changed nothing the user could see.
 *
 * `null` clears: the primary row is removed and the next-oldest PO takes its place.
 */
async function syncPrimaryBuyerPo(tx: Prisma.TransactionClient, saleOrderId: string, value: string | null) {
  if (!value) {
    const primary = await tx.sale_order_buyer_pos.findFirst({
      where: { saleOrderId, isPrimary: true },
      select: { id: true },
    });
    if (primary) {
      await tx.sale_order_buyer_pos.delete({ where: { id: primary.id } });
    }
    await promoteNextBuyerPo(tx, saleOrderId);
    return;
  }

  await tx.sale_order_buyer_pos.updateMany({
    where: { saleOrderId, isPrimary: true },
    data: { isPrimary: false },
  });
  await tx.sale_order_buyer_pos.upsert({
    where: { saleOrderId_buyerPoNumber: { saleOrderId, buyerPoNumber: value } },
    create: { saleOrderId, buyerPoNumber: value, isPrimary: true },
    update: { isPrimary: true },
  });
  await tx.sale_orders.update({ where: { id: saleOrderId }, data: { buyerPoNumber: value } });
}

/** Statuses whose buyer-PO set is closed: the commercial document is finished. */
const BUYER_PO_LOCKED_STATUSES: SaleOrderStatus[] = [SaleOrderStatus.CANCELLED, SaleOrderStatus.DELIVERED];

/**
 * Orderable columns. `sortBy` lands directly in a Prisma `orderBy` key, so an unknown value
 * reaches the database and returns an opaque "Invalid data provided to database" 400.
 * Mirrors SaleOrderSortFieldEnum in schemas/saleOrder.schema.ts.
 */
/**
 * One box, every handle a person might reach for. Style codes were the notable gap: the list
 * showed a Style(s) column you could not search on, so "which order was LNG182G for?" had no
 * answer here. Buyer style codes are matched BOTH as captured on the line and as the style master
 * reads today, so an order turns up under the code it was taken under AND the buyer's current one.
 */
const SALE_ORDER_SEARCH_FIELDS = [
  'saleOrderNumber',
  'buyerPoNumber',
  'remarks',
  'customer.name',
  'customer.code',
  // Every buyer PO on the order, not just the primary one mirrored onto the header
  'buyerPos[].buyerPoNumber',
  // Header style (single-style orders)
  'style.styleCode',
  'style.buyerStyleRef',
  'style.styleName',
  // Line styles — the code as captured on the line, and the style master's own fields
  'items[].buyerStyleRef',
  'items[].style.styleCode',
  'items[].style.buyerStyleRef',
  'items[].style.styleName',
] as const;

const SORTABLE_FIELDS = new Set([
  'createdAt',
  'saleDate',
  'saleOrderNumber',
  'totalAmount',
  'status',
  'expectedShipDate',
]);

interface SOQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: SaleOrderStatus;
  customerId?: string;
  isActive?: boolean;
  fromDate?: string;
  toDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class SaleOrderService {
  private async generateSONumber(): Promise<string> {
    // Atomic sequence (SO2607-0001) — the old findFirst+parse+increment raced under concurrency
    return generateAtomicDocNumber('SO');
  }

  async create(data: SOCreateInput) {
    const saleOrderNumber = await this.generateSONumber();

    // An empty item list is legitimate: the order starts as a DRAFT shell and lines are added on
    // the detail page. `confirm` refuses to promote a line-less order.
    const buyerStyleRefs = await loadBuyerStyleRefs(
      prisma,
      (data.items ?? []).map((i) => i.styleId)
    );
    const { items, subtotal } = normaliseSOItems(data.items ?? [], buyerStyleRefs);

    const soId = randomUUID();

    return prisma.sale_orders.create({
      data: {
        id: soId,
        saleOrderNumber,
        buyerPoNumber: data.buyerPoNumber ?? null,
        customerId: data.customerId,
        styleId: data.styleId || null,
        expectedShipDate: data.expectedShipDate || null,
        buyerDeadline: data.buyerDeadline || null,
        orderDate: data.orderDate ?? null,
        deliveryDate: data.deliveryDate ?? null,
        paymentTerms: data.paymentTerms ?? null,
        deliveryAddress: data.deliveryAddress ?? null,
        status: SaleOrderStatus.DRAFT,
        subtotal,
        totalAmount: subtotal,
        remarks: data.remarks || null,
        createdById: data.createdById,
        items: {
          create: items.map((item) => ({
            id: randomUUID(),
            styleId: item.styleId,
            colorId: item.colorId,
            sizeId: item.sizeId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            remarks: item.remarks,
            buyerStyleRef: item.buyerStyleRef,
          })),
        },
        // Also create buyer PO junction record if provided
        ...(data.buyerPoNumber && {
          buyerPos: {
            create: {
              buyerPoNumber: data.buyerPoNumber,
              isPrimary: true,
            },
          },
        }),
      },
      include: this.getDefaultIncludes(),
    });
  }

  async getAll(params: SOQueryParams = {}) {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      customerId,
      isActive,
      fromDate,
      toDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const orderByField = SORTABLE_FIELDS.has(sortBy) ? sortBy : 'createdAt';
    const orderByDirection = sortOrder === 'asc' ? 'asc' : 'desc';

    const skip = (page - 1) * limit;
    const where: Prisma.sale_ordersWhereInput = {};

    applySearch(where as Record<string, unknown>, search, SALE_ORDER_SEARCH_FIELDS);

    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (isActive !== undefined) where.isActive = isActive;

    if (fromDate || toDate) {
      where.saleDate = {};
      if (fromDate) where.saleDate.gte = new Date(fromDate);
      if (toDate) {
        // saleDate is a timestamp (@default(now())) — bump to next day so the whole toDate day is included
        const end = new Date(toDate);
        end.setDate(end.getDate() + 1);
        where.saleDate.lt = end;
      }
    }

    const [data, total] = await Promise.all([
      prisma.sale_orders.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [orderByField]: orderByDirection },
        include: {
          customer: {
            select: { id: true, code: true, name: true },
          },
          createdBy: {
            select: { id: true, firstName: true, lastName: true },
          },
          // Lean item subset for list rows (style chips + qty sums); detail endpoint returns full items
          items: {
            select: {
              id: true,
              quantity: true,
              allocatedQty: true,
              dispatchedQty: true,
              buyerStyleRef: true,
              style: { select: { id: true, styleCode: true, styleName: true, buyerStyleRef: true } },
            },
          },
          buyerPos: {
            // documentUrl only, so the list can show a paperclip without a second query.
            select: { id: true, buyerPoNumber: true, isPrimary: true, documentUrl: true },
            orderBy: { isPrimary: 'desc' },
          },
          _count: {
            select: { items: true, delivery_notes: true, invoices: true },
          },
        },
      }),
      prisma.sale_orders.count({ where }),
    ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string) {
    return prisma.sale_orders.findUnique({
      where: { id },
      include: this.getDefaultIncludes(),
    });
  }

  async update(id: string, data: SOUpdateInput) {
    const so = await prisma.sale_orders.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!so) throw new NotFoundError('Sale Order', id);
    if (so.status !== SaleOrderStatus.DRAFT) {
      throw new BusinessError(`Can only update Sale Orders in DRAFT status (this one is ${so.status})`);
    }

    return prisma.$transaction(async (tx) => {
      // Duplicate lines are merged and line money is computed BEFORE anything is written, so the
      // header carries the right subtotal in the same statement that claims the order.
      const buyerStyleRefs = data.items
        ? await loadBuyerStyleRefs(
            tx,
            data.items.map((i) => i.styleId)
          )
        : new Map<string, string | null>();
      const normalised = data.items ? normaliseSOItems(data.items, buyerStyleRefs) : null;

      // Single field list for BOTH the with-items and without-items cases. Splitting them is what
      // lost `buyerPoNumber`: the items branch omitted it, and the ERP edit sheet always sends
      // items, so every PO edit made through the UI was silently dropped.
      const headerData: Prisma.sale_ordersUncheckedUpdateManyInput = {
        // BUG-ORD5 fix: Include customerId in update
        ...(data.customerId && { customerId: data.customerId }),
        buyerPoNumber: data.buyerPoNumber,
        styleId: data.styleId,
        expectedShipDate: data.expectedShipDate,
        buyerDeadline: data.buyerDeadline,
        // undefined = leave unchanged (ERP form and B2B don't always send these)
        orderDate: data.orderDate,
        deliveryDate: data.deliveryDate,
        paymentTerms: data.paymentTerms,
        deliveryAddress: data.deliveryAddress,
        remarks: data.remarks,
        ...(normalised && { subtotal: normalised.subtotal, totalAmount: normalised.subtotal }),
      };

      // Landmine №2: the DRAFT re-check lives in the WHERE of the write itself. The previous
      // SELECT-then-write left a window in which a confirm could commit between the two, letting
      // an item rewrite land on a live order.
      const claimed = await tx.sale_orders.updateMany({
        where: { id, status: SaleOrderStatus.DRAFT },
        data: headerData,
      });
      if (claimed.count === 0) {
        throw new ConflictError('Can only update Sale Orders in DRAFT status — it changed while you were editing');
      }

      if (normalised) {
        // Wholesale replace (the B2B contract's PUT semantics). An empty list is allowed: a DRAFT
        // may legitimately be emptied; `confirm` is what refuses a line-less order.
        await tx.sale_order_items.deleteMany({ where: { saleOrderId: id } });

        if (normalised.items.length > 0) {
          await tx.sale_order_items.createMany({
            data: normalised.items.map((item) => ({
              id: randomUUID(),
              saleOrderId: id,
              styleId: item.styleId,
              colorId: item.colorId,
              sizeId: item.sizeId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              remarks: item.remarks,
              buyerStyleRef: item.buyerStyleRef,
            })),
          });
        }
      }

      if (data.buyerPoNumber !== undefined) {
        await syncPrimaryBuyerPo(tx, id, data.buyerPoNumber);
      }

      return tx.sale_orders.findUnique({ where: { id }, include: this.getDefaultIncludes() });
    });
  }

  /**
   * Check if a sale order can be deleted
   * Returns { canDelete: true } or { canDelete: false, reason: string }
   */
  async canDeleteSaleOrder(id: string): Promise<{ canDelete: boolean; reason?: string }> {
    const saleOrder = await prisma.sale_orders.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            productionOrders: true,
            delivery_notes: true,
            invoices: true,
          },
        },
      },
    });

    if (!saleOrder) {
      return { canDelete: false, reason: 'Sale Order not found' };
    }

    if (saleOrder.status !== SaleOrderStatus.DRAFT) {
      return { canDelete: false, reason: `Sale Order is ${saleOrder.status}, only DRAFT orders can be deleted` };
    }

    if (saleOrder._count.productionOrders > 0) {
      return {
        canDelete: false,
        reason: `Cannot delete: ${saleOrder._count.productionOrders} production order(s) linked. Cancel production first.`,
      };
    }

    if (saleOrder._count.delivery_notes > 0) {
      return {
        canDelete: false,
        reason: `Cannot delete: ${saleOrder._count.delivery_notes} delivery note(s) exist. Cancel them first.`,
      };
    }

    if (saleOrder._count.invoices > 0) {
      return {
        canDelete: false,
        reason: `Cannot delete: ${saleOrder._count.invoices} invoice(s) exist. Cancel them first.`,
      };
    }

    return { canDelete: true };
  }

  async delete(id: string) {
    const { canDelete, reason } = await this.canDeleteSaleOrder(id);
    if (!canDelete) {
      throw new BusinessError(reason || 'Cannot delete this sale order');
    }

    // `sale_order_buyer_pos` is ON DELETE CASCADE, so the rows — and the only record of which PO
    // document belonged to this order — vanish with the delete. Read them first; unlink after the
    // transaction commits. The B2B app deletes and re-creates orders routinely, so this path is hot.
    const poDocuments = await prisma.sale_order_buyer_pos.findMany({
      where: { saleOrderId: id, documentUrl: { not: null } },
      select: { documentUrl: true },
    });

    const deleted = await prisma.$transaction(async (tx) => {
      // P7.2.2: Release any allocations before delete (defensive — DRAFT shouldn't have allocations)
      const items = await tx.sale_order_items.findMany({
        where: { saleOrderId: id },
        select: { id: true },
      });
      const itemIds = items.map((i) => i.id);

      if (itemIds.length > 0) {
        await tx.fg_stock_allocations.updateMany({
          where: {
            saleOrderItemId: { in: itemIds },
            status: 'ALLOCATED',
          },
          data: { status: 'RELEASED' },
        });
      }

      return tx.sale_orders.delete({ where: { id } });
    });

    for (const po of poDocuments) {
      if (po.documentUrl) deleteBuyerPoDocumentFile(po.documentUrl);
    }

    return deleted;
  }

  async confirm(id: string, approvedById: string) {
    const so = await prisma.sale_orders.findUnique({
      where: { id },
      select: {
        status: true,
        customerId: true,
        expectedShipDate: true,
        deliveryDate: true,
        items: { select: { styleId: true } },
      },
    });

    if (!so) throw new NotFoundError('Sale Order', id);
    if (so.status !== SaleOrderStatus.DRAFT) {
      throw new BusinessError(`Can only confirm Sale Orders in DRAFT status (this one is ${so.status})`);
    }
    // A confirmed order with no lines is a dead end: update refuses it (DRAFT-only) and
    // startProduction refuses it (nothing to produce), so cancelling is the only way out.
    if (so.items.length === 0) {
      throw new ValidationError('Add at least one item before confirming this sale order');
    }

    // Update status to CONFIRMED. Conditional on DRAFT so a cancel committing between the read
    // above and this write cannot be resurrected into CONFIRMED.
    const claimed = await prisma.sale_orders.updateMany({
      where: { id, status: SaleOrderStatus.DRAFT },
      data: {
        status: SaleOrderStatus.CONFIRMED, // allow-sale-order-status: commercial event (confirm)
        approvedById,
      },
    });
    if (claimed.count === 0) {
      throw new ConflictError('Sale order is no longer in DRAFT status — reload before confirming');
    }

    const confirmed = await prisma.sale_orders.findUnique({
      where: { id },
      include: this.getDefaultIncludes(),
    });
    if (!confirmed) throw new NotFoundError('Sale Order', id);

    // Auto-create samples based on customer requirements
    const styleIds = [...new Set(so.items.map((i) => i.styleId))];
    if (styleIds.length > 0 && so.customerId) {
      const shipDate = so.expectedShipDate || so.deliveryDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      try {
        const sampleResult = await sampleService.autoCreateSamplesForOrder(
          id,
          so.customerId,
          styleIds,
          shipDate,
          approvedById,
          'SALE_ORDER'
        );
        logInfo('[confirm] Samples auto-created', {
          orderId: id,
          created: sampleResult.created.length,
          skipped: sampleResult.skipped.length,
        });
        // Attach result to response for frontend notification
        (confirmed as any).samplesCreated = sampleResult;
      } catch (err) {
        logWarn('[confirm] Sample auto-creation failed (non-blocking)', { orderId: id, error: err });
      }
    }

    return confirmed;
  }

  /**
   * Start production for a confirmed sale order (make-to-order).
   * Creates a linked production order (`orders.saleOrderId`) for the FULL sale-order quantity —
   * one order item per style, size/colour breakup carried from the SO items, work orders
   * auto-created by orderService.createWithItems.
   */
  async startProduction(
    id: string,
    userId: string,
    input: {
      expectedDeliveryDate?: string;
      priority?: string;
      remarks?: string;
      /** SHORTFALL (default): produce only what finished-goods stock does not cover; FULL: the whole order. */
      quantityMode?: 'SHORTFALL' | 'FULL';
      /** Per-line override — the complete list; a line left out is not produced. */
      items?: Array<{ saleOrderItemId: string; quantity: number }>;
    } = {}
  ) {
    const so = await prisma.sale_orders.findUnique({
      where: { id },
      include: {
        items: {
          include: { style: { select: { id: true, styleCode: true } } },
        },
      },
    });

    if (!so) throw new NotFoundError('Sale Order', id);

    const startableStatuses: SaleOrderStatus[] = [SaleOrderStatus.CONFIRMED, SaleOrderStatus.PARTIALLY_ALLOCATED];
    if (!startableStatuses.includes(so.status)) {
      throw new BusinessError(
        so.status === SaleOrderStatus.DRAFT
          ? 'Confirm the sale order before starting production'
          : `Cannot start production for a sale order in ${so.status} status`
      );
    }

    if (so.items.length === 0) {
      throw new BusinessError('Sale order has no items — nothing to produce');
    }

    // Duplicate guard: one active production order per sale order (a CANCELLED one may be replaced).
    // findFirst check only — the double-click race is mitigated by the UI disabling the button.
    const existing = await prisma.orders.findFirst({
      where: { saleOrderId: id, status: { not: 'CANCELLED' }, isActive: true },
      select: { orderNumber: true },
    });
    if (existing) {
      throw new ConflictError(`Production order ${existing.orderNumber} already exists for this sale order`);
    }

    // A production order may already plan these styles WITHOUT being linked: orders are raised early
    // (sizeless) so greige can be bought and dyed before the buyer's PO arrives. All 8 Easybuy orders
    // of Aug 2026 were like that; Start Production made a SECOND order beside each — its fabric, its
    // BOM, its MRP. Refuse and name the order to link instead.
    const unlinked = await prisma.orders.findMany({
      where: {
        saleOrderId: null,
        isActive: true,
        status: { notIn: ['CANCELLED', 'COMPLETED', 'DISPATCHED', 'SPLIT'] },
        order_items: { some: { styleId: { in: [...new Set(so.items.map((i) => i.styleId))] } } },
      },
      select: { orderNumber: true, order_items: { select: { styles: { select: { styleCode: true } } } } },
    });
    if (unlinked.length > 0) {
      const names = unlinked
        .map((o) => `${o.orderNumber} (${[...new Set(o.order_items.map((i) => i.styles.styleCode))].join(', ')})`)
        .join(', ');
      throw new ConflictError(
        `Production is already planned for this style on ${names}, which is not linked to a sale order. ` +
          `Link it to this sale order instead of starting a second production order.`,
        { code: 'UNLINKED_PRODUCTION_ORDER_EXISTS', orders: unlinked.map((o) => o.orderNumber) }
      );
    }

    // Cost-sheet gate: same predicate the Order form enforces client-side —
    // an APPROVED cost sheet for RAW_MATERIAL_CALCULATION or PRODUCTION purpose per style.
    const styleIds = [...new Set(so.items.map((i) => i.styleId))];
    const approvedCostings = await prisma.style_costing.findMany({
      where: {
        styleId: { in: styleIds },
        purpose: { in: ['RAW_MATERIAL_CALCULATION', 'PRODUCTION'] },
        OR: [{ approvalStatus: 'APPROVED' }, { isApproved: true }],
      },
      select: { styleId: true },
    });
    const approvedStyleIds = new Set(approvedCostings.map((c) => c.styleId));
    const missingStyles = styleIds.filter((sid) => !approvedStyleIds.has(sid));
    if (missingStyles.length > 0) {
      const codes = missingStyles
        .map((sid) => so.items.find((i) => i.styleId === sid)?.style?.styleCode ?? sid)
        .join(', ');
      throw new ValidationError(`Cannot start production — no approved cost sheet for: ${codes}`);
    }

    // Delivery date: explicit override, else the SO's own dates; required by the orders table.
    const deliveryDate =
      (input.expectedDeliveryDate ? new Date(input.expectedDeliveryDate) : null) ??
      so.buyerDeadline ??
      so.expectedShipDate ??
      so.deliveryDate;
    if (!deliveryDate) {
      throw new ValidationError('expectedDeliveryDate is required — the sale order has no buyer deadline or ship date');
    }

    // Map SO items (style+colour+size grain) → order items (one per style, breakup per colour/size).
    // Items without sizeId cannot be converted to production orders - they need size breakdown first.
    const itemsWithoutSize = so.items.filter((i) => !i.sizeId);
    if (itemsWithoutSize.length > 0) {
      const codes = [...new Set(itemsWithoutSize.map((i) => i.style?.styleCode ?? i.styleId))];
      throw new ValidationError(
        `Cannot start production: ${itemsWithoutSize.length} item(s) have no size specified. ` +
          `Please specify size breakdown for styles: ${codes.slice(0, 3).join(', ')}${codes.length > 3 ? '...' : ''}`
      );
    }

    // How much of each line to make. Until 2026-09-17 this was always item.quantity — a line already
    // half-covered from finished-goods stock (allocatedQty = reserved, dispatchedQty = shipped) was
    // produced in full on top of that stock (order-system T1-A). Default is the shortfall; the
    // caller can ask for the full quantity, or dictate per line.
    const toProduce = new Map<string, number>();
    if (input.items && input.items.length > 0) {
      const byId = new Map(so.items.map((i) => [i.id, i]));
      for (const override of input.items) {
        const line = byId.get(override.saleOrderItemId);
        if (!line) {
          throw new ValidationError(`Sale order item ${override.saleOrderItemId} is not on this sale order`);
        }
        if (override.quantity > line.quantity) {
          throw new ValidationError(
            `Cannot produce ${override.quantity} of a line ordered at ${line.quantity} (${line.style?.styleCode ?? line.styleId})`
          );
        }
        toProduce.set(line.id, override.quantity);
      }
    } else {
      const full = input.quantityMode === 'FULL';
      for (const item of so.items) {
        const covered = (item.allocatedQty ?? 0) + (item.dispatchedQty ?? 0);
        toProduce.set(item.id, full ? item.quantity : Math.max(0, item.quantity - covered));
      }
    }

    const byStyle = new Map<string, typeof so.items>();
    for (const item of so.items) {
      if ((toProduce.get(item.id) ?? 0) <= 0) continue;
      const group = byStyle.get(item.styleId) ?? [];
      group.push(item);
      byStyle.set(item.styleId, group);
    }
    if (byStyle.size === 0) {
      throw new BusinessError(
        input.items && input.items.length > 0
          ? 'Every quantity given is zero — nothing to produce'
          : 'Every line is already covered from finished-goods stock — nothing to produce. Choose the full quantity to produce it anyway.'
      );
    }

    const orderItems: OrderItemInput[] = [...byStyle.values()].map((group) => {
      // Aggregate by (colorId, sizeId) — defends against nulls-distinct duplicate SO rows and
      // guarantees breakup sum === totalQuantity, which work-order auto-creation requires.
      const breakupMap = new Map<string, { colorId: string | null; sizeId: string; quantity: number }>();
      for (const item of group) {
        const quantity = toProduce.get(item.id) ?? 0;
        if (quantity <= 0) continue;
        const key = `${item.colorId ?? ''}|${item.sizeId!}`;
        const entry = breakupMap.get(key);
        if (entry) {
          entry.quantity += quantity;
        } else {
          breakupMap.set(key, { colorId: item.colorId ?? null, sizeId: item.sizeId!, quantity });
        }
      }

      // order_items has a single unitPrice; SO grain is finer. Shared price → use it,
      // mixed prices → quantity-weighted average (decimal-safe), noted in item remarks.
      const prices = new Set(group.map((i) => Number(i.unitPrice)));
      let unitPrice: number;
      let priceNote: string | undefined;
      if (prices.size === 1) {
        unitPrice = [...prices][0];
      } else {
        const totalQty = group.reduce((sum, i) => sum + i.quantity, 0);
        const totalValue = group.reduce(
          (dec, i) => dec.plus(multiplyCurrency(i.quantity, Number(i.unitPrice))),
          multiplyCurrency(0, 0)
        );
        unitPrice = roundToCent(divideCurrency(totalValue, totalQty)).toNumber();
        priceNote = `Weighted avg of ${prices.size} SO line prices`;
      }

      return {
        styleId: group[0].styleId,
        unitPrice,
        remarks: priceNote,
        breakup: [...breakupMap.values()],
      };
    });

    const defaultRemarks = `Production for ${so.saleOrderNumber}${so.buyerPoNumber ? ` / Buyer PO ${so.buyerPoNumber}` : ''}`;

    let createdOrder: Awaited<ReturnType<typeof orderService.createWithItems>>;
    try {
      createdOrder = await orderService.createWithItems(
        {
          customerId: so.customerId,
          saleOrderId: id,
          expectedDeliveryDate: deliveryDate.toISOString(),
          priority: (input.priority as OrderPriority) || undefined,
          paymentTerms: so.paymentTerms ?? undefined,
          shippingAddress: so.deliveryAddress ?? undefined,
          remarks: input.remarks || defaultRemarks,
          items: orderItems,
        },
        userId
      );
    } catch (err) {
      // T2-C: the findFirst guard above cannot stop two simultaneous starts; the partial unique
      // index orders_saleOrderId_active_key (status <> CANCELLED AND isActive) can, and surfaces as
      // P2002 — reported as the same 409 the guard gives, never as a 500.
      const e = err as { code?: string; meta?: { target?: unknown } };
      if (e?.code === 'P2002' && String(e.meta?.target ?? '').includes('saleOrderId')) {
        throw new ConflictError('A production order already exists for this sale order');
      }
      throw err;
    }

    // Qty-rate audit 2026-08-24: non-blocking advisory — surface up front when this sale
    // order's quantity prices in a different processor rate slab than the style costing
    // assumed. The BLOCK sits at Order BOM creation and at IN_PRODUCTION confirmation.
    const rateWarnings: Array<{ styleId: string; driftItems: unknown[] }> = [];
    for (const orderItem of orderItems) {
      try {
        const itemQuantity = orderItem.breakup.reduce((sum, b) => sum + b.quantity, 0);
        if (itemQuantity <= 0) continue;
        const latestSheet = await prisma.style_costing.findFirst({
          where: {
            styleId: orderItem.styleId,
            isApproved: true,
            supersededById: null,
          },
          orderBy: { version: 'desc' },
          select: { id: true },
        });
        if (!latestSheet) continue;
        const slabCheck = await processorRateValidationService.validateQuantitySlabs(latestSheet.id, itemQuantity);
        if (slabCheck.driftItems.length > 0) {
          rateWarnings.push({ styleId: orderItem.styleId, driftItems: slabCheck.driftItems });
        }
      } catch (warnError) {
        // Read-only advisory — must never fail production-order creation
        logWarn(`[startProduction] Rate-slab advisory check failed for style ${orderItem.styleId}`, warnError);
      }
    }

    if (rateWarnings.length > 0) {
      return { ...createdOrder, rateWarnings } as typeof createdOrder;
    }
    return createdOrder;
  }

  /**
   * Production orders that already plan this sale order's styles but are linked to no sale order —
   * raised early (sizeless) so greige could be bought and dyed before the buyer's PO arrived.
   * These are what "Link to production order" offers, and what Start Production now refuses beside.
   */
  async getLinkableProductionOrders(saleOrderId: string) {
    const so = await prisma.sale_orders.findUnique({
      where: { id: saleOrderId },
      select: { customerId: true, items: { select: { styleId: true } } },
    });
    if (!so) throw new NotFoundError('Sale Order', saleOrderId);
    const styleIds = [...new Set(so.items.map((i) => i.styleId))];
    const orders = await prisma.orders.findMany({
      where: {
        saleOrderId: null,
        isActive: true,
        status: { notIn: ['CANCELLED', 'COMPLETED', 'DISPATCHED', 'SPLIT'] },
        order_items: { some: { styleId: { in: styleIds } } },
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalQuantity: true,
        expectedDeliveryDate: true,
        customerId: true,
        customers: { select: { name: true } },
        order_items: {
          select: {
            id: true,
            totalQuantity: true,
            styles: { select: { id: true, styleCode: true } },
            _count: { select: { order_item_breakup: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      totalQuantity: o.totalQuantity,
      expectedDeliveryDate: o.expectedDeliveryDate,
      customerName: o.customers?.name ?? null,
      sameCustomer: o.customerId === so.customerId,
      styles: o.order_items.map((i) => i.styles.styleCode),
      hasSizes: o.order_items.every((i) => i._count.order_item_breakup > 0),
    }));
  }

  /**
   * Link an EXISTING production order to this sale order (the make-to-order link Start Production
   * writes when it creates the order). Only the link is written here; the caller then copies the
   * buyer PO's sizes onto any order item that has none, through the sizes-later cascade.
   *
   * Refuses when: the sale order is not CONFIRMED/PARTIALLY_ALLOCATED; it already has an active
   * production order; the order is inactive, cancelled, split, completed or dispatched, or already
   * linked; the customer differs; the order plans a style the sale order does not carry; or an order
   * item that already has sizes plans more than the sale order line quantity still open for it.
   */
  async linkProductionOrder(saleOrderId: string, orderId: string) {
    const so = await prisma.sale_orders.findUnique({
      where: { id: saleOrderId },
      select: {
        id: true,
        saleOrderNumber: true,
        status: true,
        customerId: true,
        items: {
          select: {
            styleId: true,
            colorId: true,
            sizeId: true,
            quantity: true,
            allocatedQty: true,
            dispatchedQty: true,
          },
        },
      },
    });
    if (!so) throw new NotFoundError('Sale Order', saleOrderId);
    const linkable: SaleOrderStatus[] = [SaleOrderStatus.CONFIRMED, SaleOrderStatus.PARTIALLY_ALLOCATED];
    if (!linkable.includes(so.status)) {
      throw new BusinessError(`A ${so.status} sale order cannot be linked to production — confirm it first.`);
    }
    const already = await prisma.orders.findFirst({
      where: { saleOrderId, status: { not: 'CANCELLED' }, isActive: true },
      select: { orderNumber: true },
    });
    if (already) {
      throw new ConflictError(`${so.saleOrderNumber} is already linked to production order ${already.orderNumber}.`);
    }

    const order = await prisma.orders.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        isActive: true,
        saleOrderId: true,
        customerId: true,
        order_items: {
          select: {
            id: true,
            styleId: true,
            totalQuantity: true,
            styles: { select: { styleCode: true } },
            order_item_breakup: { select: { quantity: true } },
          },
        },
      },
    });
    if (!order) throw new NotFoundError('Production order', orderId);
    if (!order.isActive || ['CANCELLED', 'SPLIT', 'COMPLETED', 'DISPATCHED'].includes(String(order.status))) {
      throw new BusinessError(`${order.orderNumber} is ${order.status} and cannot be linked.`);
    }
    if (order.saleOrderId) {
      throw new ConflictError(`${order.orderNumber} is already linked to another sale order.`);
    }
    if (order.customerId !== so.customerId) {
      throw new BusinessError(`${order.orderNumber} is for a different customer than ${so.saleOrderNumber}.`);
    }
    const soStyles = new Set(so.items.map((i) => i.styleId));
    const foreign = order.order_items.filter((i) => !soStyles.has(i.styleId));
    if (foreign.length > 0) {
      throw new BusinessError(
        `${order.orderNumber} plans ${foreign.map((i) => i.styles.styleCode).join(', ')}, which ${so.saleOrderNumber} does not carry.`
      );
    }
    // An item that already has sizes keeps them: it must not plan more than the line has open
    // (ordered − allocated − dispatched), or the sale order is produced beyond what was bought.
    for (const item of order.order_items.filter((i) => i.order_item_breakup.length > 0)) {
      const open = so.items
        .filter((l) => l.styleId === item.styleId)
        .reduce((sum, l) => sum + Math.max(0, l.quantity - (l.allocatedQty ?? 0) - (l.dispatchedQty ?? 0)), 0);
      if (item.totalQuantity > open) {
        throw new BusinessError(
          `${order.orderNumber} plans ${item.totalQuantity} pcs of ${item.styles.styleCode}, more than the ${open} pcs ${so.saleOrderNumber} still has open.`
        );
      }
    }

    try {
      await prisma.orders.update({ where: { id: orderId }, data: { saleOrderId } });
    } catch (err) {
      // The partial unique index orders_saleOrderId_active_key catches a simultaneous second link
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError(`${so.saleOrderNumber} was linked to another production order a moment ago.`);
      }
      throw err;
    }
    logInfo(`[SO link] ${order.orderNumber} linked to ${so.saleOrderNumber}`);

    // The buyer PO's colour/size split, per sizeless order item — the production order makes the
    // PO exactly (owner decision 2026-09-24; the buyer's +5 % allowance is cut via Extra % at cutting)
    const toSize = order.order_items
      .filter((i) => i.order_item_breakup.length === 0)
      .map((i) => {
        const byKey = new Map<string, { colorId: string | null; sizeId: string; quantity: number }>();
        for (const l of so.items.filter((x) => x.styleId === i.styleId && x.sizeId)) {
          const key = `${l.colorId ?? ''}|${l.sizeId}`;
          const entry = byKey.get(key);
          if (entry) entry.quantity += l.quantity;
          else byKey.set(key, { colorId: l.colorId ?? null, sizeId: l.sizeId as string, quantity: l.quantity });
        }
        return { orderItemId: i.id, breakup: [...byKey.values()] };
      })
      .filter((x) => x.breakup.length > 0);

    return { orderId: order.id, orderNumber: order.orderNumber, saleOrderNumber: so.saleOrderNumber, toSize };
  }

  /**
   * Cancel a sale order and release all FG stock allocations.
   * P7.2: Allocation lifecycle — allocations must not stay permanent phantoms.
   */
  async cancel(id: string) {
    const so = await prisma.sale_orders.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!so) throw new NotFoundError('Sale Order', id);

    const terminalStatuses: SaleOrderStatus[] = [SaleOrderStatus.DELIVERED, SaleOrderStatus.CANCELLED];
    if (terminalStatuses.includes(so.status as SaleOrderStatus)) {
      throw new BusinessError(`Cannot cancel sale order in ${so.status} status`);
    }

    // Block cancel while a linked production order is active — the factory is already making it.
    const activeProduction = await prisma.orders.findFirst({
      where: { saleOrderId: id, status: { not: 'CANCELLED' }, isActive: true },
      select: { orderNumber: true },
    });
    if (activeProduction) {
      throw new BusinessError(
        `Cannot cancel — production order ${activeProduction.orderNumber} is active. Cancel the production order first.`
      );
    }

    // Goods that have already left cannot be un-ordered. CancelOrderDialog refuses this on screen;
    // without the same rule here an API call (or a stale tab whose payload predates the dispatch)
    // released every reservation while dispatchedQty stayed put — and the B2B app treats CANCELLED
    // as terminal, so the buyer would stop tracking a shipment that is genuinely on its way.
    const dispatched = await prisma.sale_order_items.aggregate({
      where: { saleOrderId: id },
      _sum: { dispatchedQty: true },
    });
    const dispatchedQty = dispatched._sum.dispatchedQty ?? 0;
    if (dispatchedQty > 0) {
      throw new BusinessError(`Cannot cancel — ${dispatchedQty} piece(s) have already been dispatched on this order.`);
    }

    // Belt and braces: a live note always implies dispatchedQty > 0, so this only fires if the two
    // ledgers have drifted — in which case cancelling would strand the note against a dead order.
    const liveNotes = await prisma.delivery_notes.count({
      where: { saleOrderId: id, status: { in: ['PENDING', 'IN_TRANSIT'] } },
    });
    if (liveNotes > 0) {
      throw new BusinessError(
        `Cannot cancel — ${liveNotes} delivery note(s) are still open for this order. Delete them first.`
      );
    }

    return prisma.$transaction(async (tx) => {
      // Get all allocations for this sale order's items
      const items = await tx.sale_order_items.findMany({
        where: { saleOrderId: id },
        select: { id: true },
      });

      const itemIds = items.map((i) => i.id);

      // Release all ALLOCATED allocations back to FG stock
      const allocations = await tx.fg_stock_allocations.findMany({
        where: {
          saleOrderItemId: { in: itemIds },
          status: 'ALLOCATED',
        },
      });

      for (const alloc of allocations) {
        // Mark allocation as RELEASED (not deleted, for audit trail)
        await tx.fg_stock_allocations.update({
          where: { id: alloc.id },
          data: { status: 'RELEASED' },
        });
      }

      // Reset allocatedQty on sale order items
      await tx.sale_order_items.updateMany({
        where: { saleOrderId: id },
        data: { allocatedQty: 0 },
      });

      // Update sale order status to CANCELLED
      return tx.sale_orders.update({
        where: { id },
        data: { status: SaleOrderStatus.CANCELLED }, // allow-sale-order-status: commercial event (cancel)
        include: this.getDefaultIncludes(),
      });
    });
  }

  /**
   * Deallocate (release) a specific FG stock allocation.
   * P7.2: Allows partial deallocation when stock needs to go elsewhere.
   */
  async deallocateStock(allocationId: string) {
    const allocation = await prisma.fg_stock_allocations.findUnique({
      where: { id: allocationId },
      include: {
        saleOrderItem: {
          select: {
            id: true,
            saleOrderId: true,
            saleOrder: { select: { status: true, saleOrderNumber: true } },
          },
        },
      },
    });

    if (!allocation) throw new NotFoundError('Allocation', allocationId);
    if (allocation.status !== 'ALLOCATED') {
      throw new BusinessError(`Cannot release — this allocation is already ${allocation.status}`);
    }

    // A finished order's reservations are history, not a working set.
    const soStatus = allocation.saleOrderItem?.saleOrder.status;
    if (soStatus === SaleOrderStatus.CANCELLED || soStatus === SaleOrderStatus.DELIVERED) {
      throw new BusinessError(
        `Cannot release stock — sale order ${allocation.saleOrderItem?.saleOrder.saleOrderNumber} is ${soStatus}.`
      );
    }

    return prisma.$transaction(async (tx) => {
      // Claim the row: only the caller that flips ALLOCATED → RELEASED gets to decrement. The
      // status check above runs outside the transaction — two simultaneous releases both passed
      // it and both decremented allocatedQty, driving it negative (order-system T2-B, 2026-09-17).
      const released = await tx.fg_stock_allocations.updateMany({
        where: { id: allocationId, status: 'ALLOCATED' },
        data: { status: 'RELEASED' },
      });
      if (released.count === 0) {
        throw new BusinessError('Cannot release — this allocation was already released');
      }

      // Decrement allocatedQty on the sale order item
      await tx.sale_order_items.update({
        where: { id: allocation.saleOrderItemId },
        data: { allocatedQty: { decrement: allocation.allocatedQty } },
      });

      // Landmine №2: derive the status from item facts — dispatch progress outranks
      // allocation, so releasing stock on a partly-shipped order keeps its B2B badge.
      const soItem = allocation.saleOrderItem;
      if (soItem) {
        await recomputeSaleOrderStatus(tx, soItem.saleOrderId);
      }

      return { success: true };
    });
  }

  /**
   * Reserve finished-goods stock against one sale-order line.
   *
   * Everything — the eligibility checks, the availability arithmetic and the write — happens in a
   * SINGLE transaction with the stock row locked. Previously the availability was read outside the
   * transaction, so two people allocating the same lot at the same moment both saw it as free and
   * both succeeded; and nothing capped the request against what the line still needed, so a typo
   * could reserve 500 pcs for a 100-pc line and report the order FULLY_ALLOCATED.
   */
  async allocateStock(saleOrderItemId: string, fgStockId: string, quantity: number, userId: string) {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new ValidationError('Allocation quantity must be a whole number greater than zero');
    }

    return prisma.$transaction(async (tx) => {
      const item = await tx.sale_order_items.findUnique({
        where: { id: saleOrderItemId },
        select: {
          saleOrderId: true,
          styleId: true,
          colorId: true,
          sizeId: true,
          quantity: true,
          allocatedQty: true,
          saleOrder: { select: { status: true, saleOrderNumber: true } },
          style: { select: { styleCode: true } },
        },
      });
      if (!item) throw new NotFoundError('Sale order item', saleOrderItemId);

      // Landmine №2: allocation must not resurrect a dead order or touch a draft one.
      // (Before this guard, allocating against a CANCELLED order silently flipped it back
      // to PARTIALLY/FULLY_ALLOCATED — visible to the B2B buyer as a live order.)
      const soStatus = item.saleOrder.status;
      if (soStatus === SaleOrderStatus.DRAFT) {
        throw new BusinessError('Confirm the sale order before allocating stock.');
      }
      if (soStatus === SaleOrderStatus.CANCELLED || soStatus === SaleOrderStatus.DELIVERED) {
        throw new BusinessError(`Cannot allocate stock — sale order ${item.saleOrder.saleOrderNumber} is ${soStatus}.`);
      }

      // Never reserve more than the line still needs.
      const remaining = item.quantity - item.allocatedQty;
      if (remaining <= 0) {
        throw new BusinessError(`This line is already fully allocated (${item.allocatedQty}/${item.quantity} pcs).`);
      }
      if (quantity > remaining) {
        throw new BusinessError(
          `Only ${remaining} pcs left to allocate on this line ` +
            `(ordered ${item.quantity}, already allocated ${item.allocatedQty}).`
        );
      }

      // Lock the stock row for the rest of the transaction so a concurrent allocation of the same
      // lot waits here rather than reading the same "available" figure we did.
      const locked = await tx.$queryRaw<
        Array<{ id: string; quantity: number; styleId: string; colorId: string; sizeId: string }>
      >`SELECT id, quantity, "styleId", "colorId", "sizeId"
          FROM finished_goods_stock WHERE id = ${fgStockId} FOR UPDATE`;
      if (locked.length === 0) throw new NotFoundError('Finished goods stock', fgStockId);
      const fgStock = locked[0];

      // The stock must be the thing this line actually ordered. Nothing checked this before, so a
      // stale dialog (or any API caller) could reserve another style's goods against this line.
      if (fgStock.styleId !== item.styleId) {
        throw new ValidationError(
          `That stock is not for style ${item.style?.styleCode ?? item.styleId} — pick stock for this line's style.`
        );
      }
      if (item.colorId && fgStock.colorId !== item.colorId) {
        throw new ValidationError("That stock is a different colour from this line's.");
      }
      if (item.sizeId && fgStock.sizeId !== item.sizeId) {
        throw new ValidationError("That stock is a different size from this line's.");
      }

      const reserved = await tx.fg_stock_allocations.aggregate({
        where: { fgStockId, status: 'ALLOCATED' },
        _sum: { allocatedQty: true },
      });
      const allocatedQty = reserved._sum.allocatedQty ?? 0;
      const availableQty = fgStock.quantity - allocatedQty;

      if (quantity > availableQty) {
        throw new BusinessError(
          `Only ${availableQty} pcs available (${fgStock.quantity} total − ${allocatedQty} already allocated)`
        );
      }

      const alloc = await tx.fg_stock_allocations.create({
        data: {
          id: randomUUID(),
          saleOrderItemId,
          fgStockId,
          allocatedQty: quantity,
          status: 'ALLOCATED',
          allocatedById: userId,
        },
      });

      await tx.sale_order_items.update({
        where: { id: saleOrderItemId },
        data: { allocatedQty: { increment: quantity } },
      });

      // Landmine №2: derive the status from item facts (never overwrite dispatch progress)
      await recomputeSaleOrderStatus(tx, item.saleOrderId);

      return alloc;
    });
  }

  // `syncSizesFromProductionOrder` lived here until 2026-09-12. It split size-less sale-order
  // lines using the production breakup, but startProduction refuses to run at all while any line
  // lacks a size, so it could never execute — and had it run, re-creating the lines would have
  // collided with @@unique([saleOrderId, styleId, colorId, sizeId]) whenever a sized row already
  // existed. Sizes are added to a sale order through the edit sheet.

  async getAvailableStock(styleId: string, colorId?: string, sizeId?: string) {
    const where: Prisma.finished_goods_stockWhereInput = { styleId };
    if (colorId) where.colorId = colorId;
    if (sizeId) where.sizeId = sizeId;

    const stocks = await prisma.finished_goods_stock.findMany({
      where,
      include: {
        color_options: { select: { id: true, colorName: true } },
        size_options: { select: { id: true, sizeName: true, sizeCode: true } },
        locations: { select: { id: true, locationName: true } },
        fg_stock_allocations: {
          where: { status: 'ALLOCATED' },
          select: { allocatedQty: true },
        },
      },
    });

    return stocks
      .map((stock) => {
        const allocatedQty = stock.fg_stock_allocations.reduce(
          (sum: number, a: { allocatedQty: number }) => sum + a.allocatedQty,
          0
        );
        return {
          ...stock,
          availableQty: stock.quantity - allocatedQty,
          allocatedQty,
        };
      })
      .filter((s) => s.availableQty > 0);
  }

  async search(params: { search?: string; limit?: number }) {
    const { search, limit = 50 } = params;

    const where: Prisma.sale_ordersWhereInput = { isActive: true };

    // The typeahead searches the same fields as the list. Leaving it on the old three-field
    // version meant a dropdown could not find an order the list page could.
    applySearch(where as Record<string, unknown>, search, SALE_ORDER_SEARCH_FIELDS);

    return prisma.sale_orders.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        saleOrderNumber: true,
        status: true,
        totalAmount: true,
        customer: {
          select: { id: true, code: true, name: true },
        },
      },
    });
  }

  /**
   * Get stock preview for a sale order before confirmation.
   * Shows FG stock availability for each item + style readiness for items needing production.
   */
  async getStockPreview(saleOrderId: string) {
    const so = await prisma.sale_orders.findUnique({
      where: { id: saleOrderId },
      include: {
        items: {
          include: {
            style: {
              select: {
                id: true,
                styleCode: true,
                buyerStyleRef: true,
                styleName: true,
                status: true,
                _count: {
                  select: {
                    style_components: true,
                    size_options: true,
                    style_variants: true,
                  },
                },
              },
            },
            color: { select: { id: true, colorName: true } },
            size: { select: { id: true, sizeName: true, sizeCode: true } },
          },
        },
      },
    });

    if (!so) throw new NotFoundError('Sale Order', saleOrderId);

    // Build item previews with stock availability and style readiness
    const itemPreviews = await Promise.all(
      so.items.map(async (item) => {
        // Get available FG stock for this item
        const stocks = await this.getAvailableStock(item.styleId, item.colorId || undefined, item.sizeId || undefined);
        const totalAvailable = stocks.reduce((sum, s) => sum + s.availableQty, 0);
        const availableQty = Math.min(totalAvailable, item.quantity);
        const shortfall = Math.max(0, item.quantity - totalAvailable);

        const status: 'FULL' | 'PARTIAL' | 'NONE' =
          totalAvailable >= item.quantity ? 'FULL' : totalAvailable > 0 ? 'PARTIAL' : 'NONE';

        // For items needing production, check style readiness
        let styleReadiness:
          | {
              status: string;
              hasComponents: boolean;
              hasFabrics: boolean;
              hasSizes: boolean;
              hasVariants: boolean;
              isReady: boolean;
              missingSteps: string[];
            }
          | undefined;

        if (status !== 'FULL' && item.style) {
          // Check if style has fabrics (via style_components -> style_fabrics)
          const fabricCount = await prisma.style_fabrics.count({
            where: {
              style_components: { styleId: item.styleId },
            },
          });

          const hasComponents = (item.style._count?.style_components || 0) > 0;
          const hasFabrics = fabricCount > 0;
          const hasSizes = (item.style._count?.size_options || 0) > 0;
          const hasVariants = (item.style._count?.style_variants || 0) > 0;
          // StyleStatus enum: DRAFT, ACTIVE, ARCHIVED - ACTIVE means ready for production
          const isActive = item.style.status === 'ACTIVE';

          const missingSteps: string[] = [];
          if (!isActive) missingSteps.push('Activate style');
          if (!hasComponents) missingSteps.push('Add components');
          if (!hasFabrics) missingSteps.push('Assign fabrics');
          if (!hasSizes) missingSteps.push('Define sizes');
          if (!hasVariants) missingSteps.push('Create SKU variants');

          styleReadiness = {
            status: item.style.status,
            hasComponents,
            hasFabrics,
            hasSizes,
            hasVariants,
            isReady: missingSteps.length === 0,
            missingSteps,
          };
        }

        return {
          id: item.id,
          style: item.style
            ? {
                id: item.style.id,
                // The line's captured code first, so the preview names the style the way the
                // order does rather than the way the style master reads today.
                buyerStyleRef: item.buyerStyleRef ?? item.style.buyerStyleRef ?? null,
                styleCode: item.style.styleCode,
                styleName: item.style.styleName,
              }
            : null,
          color: item.color,
          size: item.size,
          orderedQty: item.quantity,
          availableQty,
          shortfall,
          status,
          styleReadiness,
        };
      })
    );

    // Calculate summary
    const summary = {
      itemsWithStock: itemPreviews.filter((i) => i.status === 'FULL').length,
      itemsPartialStock: itemPreviews.filter((i) => i.status === 'PARTIAL').length,
      itemsNoStock: itemPreviews.filter((i) => i.status === 'NONE').length,
      quantityAvailable: itemPreviews.reduce((sum, i) => sum + i.availableQty, 0),
      quantityNeedsProduction: itemPreviews.reduce((sum, i) => sum + i.shortfall, 0),
    };

    // Determine recommended action
    let recommendedAction: 'ALLOCATE_ALL' | 'START_PRODUCTION' | 'MIXED';
    if (summary.itemsNoStock === 0 && summary.itemsPartialStock === 0) {
      recommendedAction = 'ALLOCATE_ALL';
    } else if (summary.itemsWithStock === 0 && summary.itemsPartialStock === 0) {
      recommendedAction = 'START_PRODUCTION';
    } else {
      recommendedAction = 'MIXED';
    }

    return {
      saleOrderId: so.id,
      saleOrderNumber: so.saleOrderNumber,
      totalItems: so.items.length,
      totalQuantity: so.items.reduce((sum, i) => sum + i.quantity, 0),
      summary,
      items: itemPreviews,
      recommendedAction,
    };
  }

  private getDefaultIncludes() {
    return {
      customer: {
        select: {
          id: true,
          code: true,
          name: true,
          billingAddress: true,
          shippingAddress: true,
          gstNumber: true,
        },
      },
      style: {
        select: { id: true, styleCode: true, buyerStyleRef: true, styleName: true, imageUrl: true },
      },
      items: {
        include: {
          style: {
            select: { id: true, styleCode: true, buyerStyleRef: true, styleName: true, imageUrl: true },
          },
          color: {
            select: { id: true, colorName: true, colorCode: true },
          },
          size: {
            select: { id: true, sizeName: true, sizeCode: true },
          },
          allocations: {
            include: {
              fgStock: {
                select: {
                  id: true,
                  quantity: true,
                  locations: { select: { id: true, locationName: true } },
                },
              },
            },
          },
        },
      },
      createdBy: {
        select: { id: true, firstName: true, lastName: true },
      },
      approvedBy: {
        select: { id: true, firstName: true, lastName: true },
      },
      productionOrders: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalQuantity: true,
          expectedDeliveryDate: true,
          createdAt: true,
        },
      },
      buyerPos: {
        orderBy: [{ isPrimary: 'desc' as const }, { createdAt: 'asc' as const }],
        select: {
          id: true,
          buyerPoNumber: true,
          isPrimary: true,
          remarks: true,
          createdAt: true,
          poDate: true,
          documentUrl: true,
          documentName: true,
          documentSize: true,
          documentUploadedAt: true,
          deliveryAddressId: true,
          // Enough to name the destination without a second request. Deliberately NOT the uploader
          // relation — this include is on every sale-order read, including the B2B app's poll.
          deliveryAddress: {
            select: { id: true, label: true, addressType: true, pincode: true, city: { select: { cityName: true } } },
          },
        },
      },
      _count: {
        select: { items: true, delivery_notes: true, invoices: true },
      },
    };
  }

  /**
   * Add a buyer PO number to a sale order.
   * First PO added becomes primary automatically.
   */
  async addBuyerPo(
    saleOrderId: string,
    buyerPoNumber: string,
    remarks?: string,
    details?: { deliveryAddressId?: string | null; poDate?: string | null }
  ) {
    const so = await prisma.sale_orders.findUnique({
      where: { id: saleOrderId },
      select: { id: true, buyerPoNumber: true, status: true, saleOrderNumber: true, customerId: true },
    });
    if (!so) throw new NotFoundError('Sale Order', saleOrderId);
    if (BUYER_PO_LOCKED_STATUSES.includes(so.status)) {
      throw new BusinessError(`Cannot change buyer POs — sale order ${so.saleOrderNumber} is ${so.status}.`);
    }

    // A PO ships to one of the CUSTOMER's own locations. Checking it here turns a foreign-key
    // violation (a 500 naming a constraint) into a sentence, and stops one customer's PO being
    // pointed at another customer's warehouse.
    if (details?.deliveryAddressId) {
      const address = await prisma.customer_addresses.findUnique({
        where: { id: details.deliveryAddressId },
        select: { customerId: true, label: true },
      });
      if (!address) throw new NotFoundError('Delivery location', details.deliveryAddressId);
      if (address.customerId !== so.customerId) {
        throw new ValidationError(`Delivery location "${address.label}" belongs to a different customer.`);
      }
    }

    return prisma.$transaction(async (tx) => {
      const duplicate = await tx.sale_order_buyer_pos.findFirst({
        where: { saleOrderId, buyerPoNumber },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictError(`Buyer PO ${buyerPoNumber} is already on this sale order.`);
      }

      // Check if this is the first PO
      const existingCount = await tx.sale_order_buyer_pos.count({
        where: { saleOrderId },
      });

      // Move the legacy single-column PO into the junction before a second one is added. Without
      // this the first "Add PO" simply overwrote sale_orders.buyerPoNumber, and the number the
      // buyer originally raised the order under survived nowhere — while the screen was telling
      // the user that adding a PO would migrate it.
      const legacyPoNumber = so.buyerPoNumber;
      const migratesLegacy = existingCount === 0 && !!legacyPoNumber && legacyPoNumber !== buyerPoNumber;
      if (migratesLegacy) {
        await tx.sale_order_buyer_pos.create({
          data: {
            saleOrderId,
            buyerPoNumber: legacyPoNumber!,
            isPrimary: true,
            remarks: 'Original PO number',
          },
        });
      }

      // The first PO on an order becomes primary; one added alongside an existing PO does not.
      const isPrimary = existingCount === 0 && !migratesLegacy;

      const buyerPo = await tx.sale_order_buyer_pos.create({
        data: {
          saleOrderId,
          buyerPoNumber,
          isPrimary,
          remarks: remarks || null,
          deliveryAddressId: details?.deliveryAddressId || null,
          poDate: details?.poDate ? new Date(details.poDate) : null,
        },
      });

      // If this is the first/primary PO, sync to legacy field
      if (isPrimary) {
        await tx.sale_orders.update({
          where: { id: saleOrderId },
          data: { buyerPoNumber },
        });
      }

      return buyerPo;
    });
  }

  /**
   * Remove a buyer PO from a sale order.
   * If removing the primary, the next oldest becomes primary.
   */
  async removeBuyerPo(buyerPoId: string) {
    const buyerPo = await prisma.sale_order_buyer_pos.findUnique({
      where: { id: buyerPoId },
      select: {
        id: true,
        saleOrderId: true,
        isPrimary: true,
        documentUrl: true,
        saleOrder: { select: { status: true, saleOrderNumber: true } },
      },
    });
    if (!buyerPo) throw new NotFoundError('Buyer PO', buyerPoId);
    if (BUYER_PO_LOCKED_STATUSES.includes(buyerPo.saleOrder.status)) {
      throw new BusinessError(
        `Cannot change buyer POs — sale order ${buyerPo.saleOrder.saleOrderNumber} is ${buyerPo.saleOrder.status}.`
      );
    }

    await prisma.$transaction(async (tx) => {
      // Delete the PO
      await tx.sale_order_buyer_pos.delete({ where: { id: buyerPoId } });

      // If this was primary, promote the next oldest
      if (buyerPo.isPrimary) {
        await promoteNextBuyerPo(tx, buyerPo.saleOrderId);
      }
    });

    // Only once the row is gone for good. Deleting the PO but leaving its PDF behind strands a
    // file nothing references, and the NAS/Drive backup would copy it forever.
    if (buyerPo.documentUrl) deleteBuyerPoDocumentFile(buyerPo.documentUrl);
  }

  /**
   * Attach the customer's PO document to a buyer PO — also the REPLACE path.
   *
   * `file` has already been written to disk by multer before this runs, so every early return
   * must unlink it first or a rejected upload leaks a PDF nobody can reach.
   */
  async attachBuyerPoDocument(
    buyerPoId: string,
    file: { fileUrl: string; fileName: string; fileSize: number },
    uploadedById?: string
  ) {
    const buyerPo = await prisma.sale_order_buyer_pos.findUnique({
      where: { id: buyerPoId },
      select: {
        id: true,
        documentUrl: true,
        saleOrder: { select: { status: true, saleOrderNumber: true } },
      },
    });

    if (!buyerPo) {
      deleteBuyerPoDocumentFile(file.fileUrl);
      throw new NotFoundError('Buyer PO', buyerPoId);
    }
    if (BUYER_PO_LOCKED_STATUSES.includes(buyerPo.saleOrder.status)) {
      deleteBuyerPoDocumentFile(file.fileUrl);
      throw new BusinessError(
        `Cannot change buyer POs — sale order ${buyerPo.saleOrder.saleOrderNumber} is ${buyerPo.saleOrder.status}.`
      );
    }

    const previousUrl = buyerPo.documentUrl;

    const updated = await prisma.sale_order_buyer_pos.update({
      where: { id: buyerPoId },
      data: {
        documentUrl: file.fileUrl,
        documentName: file.fileName,
        documentSize: file.fileSize,
        documentUploadedById: uploadedById || null,
        documentUploadedAt: new Date(),
      },
    });

    // Unlink the superseded file AFTER the row points at the new one — the opposite order to a
    // delete. The row survives here, and must never be left naming a file that is already gone.
    if (previousUrl && previousUrl !== file.fileUrl) deleteBuyerPoDocumentFile(previousUrl);

    return updated;
  }

  /** Remove the PO document, leaving the PO itself in place. */
  async removeBuyerPoDocument(buyerPoId: string) {
    const buyerPo = await prisma.sale_order_buyer_pos.findUnique({
      where: { id: buyerPoId },
      select: {
        id: true,
        documentUrl: true,
        saleOrder: { select: { status: true, saleOrderNumber: true } },
      },
    });
    if (!buyerPo) throw new NotFoundError('Buyer PO', buyerPoId);
    if (BUYER_PO_LOCKED_STATUSES.includes(buyerPo.saleOrder.status)) {
      throw new BusinessError(
        `Cannot change buyer POs — sale order ${buyerPo.saleOrder.saleOrderNumber} is ${buyerPo.saleOrder.status}.`
      );
    }

    const updated = await prisma.sale_order_buyer_pos.update({
      where: { id: buyerPoId },
      data: {
        documentUrl: null,
        documentName: null,
        documentSize: null,
        documentUploadedById: null,
        documentUploadedAt: null,
      },
    });

    if (buyerPo.documentUrl) deleteBuyerPoDocumentFile(buyerPo.documentUrl);

    return updated;
  }

  /**
   * Edit a buyer PO's location / date / remarks.
   *
   * `buyerPoNumber` is deliberately not editable: it is the key of the unique index and the value
   * `syncPrimaryBuyerPo` mirrors into the legacy scalar the B2B app reads.
   */
  async updateBuyerPo(
    buyerPoId: string,
    patch: { deliveryAddressId?: string | null; poDate?: string | null; remarks?: string | null }
  ) {
    const buyerPo = await prisma.sale_order_buyer_pos.findUnique({
      where: { id: buyerPoId },
      select: {
        id: true,
        saleOrder: { select: { status: true, saleOrderNumber: true, customerId: true } },
      },
    });
    if (!buyerPo) throw new NotFoundError('Buyer PO', buyerPoId);
    if (BUYER_PO_LOCKED_STATUSES.includes(buyerPo.saleOrder.status)) {
      throw new BusinessError(
        `Cannot change buyer POs — sale order ${buyerPo.saleOrder.saleOrderNumber} is ${buyerPo.saleOrder.status}.`
      );
    }

    if (patch.deliveryAddressId) {
      const address = await prisma.customer_addresses.findUnique({
        where: { id: patch.deliveryAddressId },
        select: { customerId: true, label: true },
      });
      if (!address) throw new NotFoundError('Delivery location', patch.deliveryAddressId);
      if (address.customerId !== buyerPo.saleOrder.customerId) {
        throw new ValidationError(`Delivery location "${address.label}" belongs to a different customer.`);
      }
    }

    return prisma.sale_order_buyer_pos.update({
      where: { id: buyerPoId },
      data: {
        // An ABSENT key means "leave it"; an explicit null means "clear it".
        ...(patch.deliveryAddressId !== undefined ? { deliveryAddressId: patch.deliveryAddressId } : {}),
        ...(patch.poDate !== undefined ? { poDate: patch.poDate ? new Date(patch.poDate) : null } : {}),
        ...(patch.remarks !== undefined ? { remarks: patch.remarks } : {}),
      },
    });
  }

  /**
   * Set a buyer PO as the primary PO for a sale order.
   */
  async setPrimaryBuyerPo(buyerPoId: string) {
    const buyerPo = await prisma.sale_order_buyer_pos.findUnique({
      where: { id: buyerPoId },
      select: {
        id: true,
        saleOrderId: true,
        buyerPoNumber: true,
        isPrimary: true,
        saleOrder: { select: { status: true, saleOrderNumber: true } },
      },
    });
    if (!buyerPo) throw new NotFoundError('Buyer PO', buyerPoId);
    if (BUYER_PO_LOCKED_STATUSES.includes(buyerPo.saleOrder.status)) {
      throw new BusinessError(
        `Cannot change buyer POs — sale order ${buyerPo.saleOrder.saleOrderNumber} is ${buyerPo.saleOrder.status}.`
      );
    }
    if (buyerPo.isPrimary) return buyerPo; // Already primary

    await prisma.$transaction(async (tx) => {
      // Clear existing primary
      await tx.sale_order_buyer_pos.updateMany({
        where: { saleOrderId: buyerPo.saleOrderId, isPrimary: true },
        data: { isPrimary: false },
      });

      // Set new primary
      await tx.sale_order_buyer_pos.update({
        where: { id: buyerPoId },
        data: { isPrimary: true },
      });

      // Sync to legacy field
      await tx.sale_orders.update({
        where: { id: buyerPo.saleOrderId },
        data: { buyerPoNumber: buyerPo.buyerPoNumber },
      });
    });

    return prisma.sale_order_buyer_pos.findUnique({ where: { id: buyerPoId } });
  }
}

export const saleOrderService = new SaleOrderService();
