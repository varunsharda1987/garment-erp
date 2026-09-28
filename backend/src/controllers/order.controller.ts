// Order Management Controller
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { logInfo, logWarn } from '../utils/logger';
import { orderService } from '../services/order.service';
import { processorRateValidationService } from '../services/processor-rate-validation.service';
import { NotFoundError, ValidationError, BusinessError, UnauthorizedError, ConflictError } from '../errors';
import { saleOrderService, assertDeliveryWithinDeadline } from '../services/saleOrder.service';
import workOrderService from '../services/workOrder.service';
import { generateAtomicOrderNumber } from '../utils/atomicCodeGenerator';
import { multiplyCurrency, roundToCent, Decimal } from '../utils/currency';
import type { OrderQueryInput } from '../schemas/order.schema';
import { applySearch } from '../utils/search-filter';
import {
  deriveOrderStatus,
  loadOrderStatusFacts,
  lockOrder,
  syncOrderStatus,
} from '../services/helpers/order-status.helper';
import { getRunFabricPosition } from '../services/helpers/run-fabric.helper';
import { orderRequirementBuckets } from '../services/helpers/order-requirements.helper';
import { resolveSizeLineColours } from '../services/helpers/sku-colour.helper';

// ============================================
// Types for Order Controller
// ============================================

interface OrderItemBreakup {
  colorId: string | null; // Can be null or empty for size-only orders
  sizeId: string;
  quantity: number;
}

interface OrderItem {
  styleId: string;
  unitPrice: string | number;
  totalQuantity?: number; // Direct total quantity (used when breakup is empty)
  deliveryDate?: string;
  itemDescription?: string;
  remarks?: string;
  breakup: OrderItemBreakup[];
}

/**
 * Merge duplicate (colorId, sizeId) breakup lines, normalising empty colorId to null.
 * Postgres treats NULL colorId as distinct in the (orderItemId, colorId, sizeId) unique index,
 * so size-only orders could otherwise insert duplicate rows that double-count sizes downstream
 * (bug-hunt orders-16 — server-side half; the partial unique index needs a migration).
 */
function dedupeBreakup(breakup: OrderItemBreakup[]): OrderItemBreakup[] {
  const merged = new Map<string, OrderItemBreakup>();
  for (const b of breakup) {
    const colorId = b.colorId && b.colorId !== '' ? b.colorId : null;
    const key = `${colorId ?? 'NULL'}|${b.sizeId}`;
    const existing = merged.get(key);
    if (existing) {
      existing.quantity += b.quantity;
    } else {
      merged.set(key, { colorId, sizeId: b.sizeId, quantity: b.quantity });
    }
  }
  return [...merged.values()];
}

/**
 * Create new order with items and breakup
 * POST /api/orders
 */
export const createOrder = async (req: Request, res: Response): Promise<void> => {
  const {
    customerId,
    orderDate,
    expectedDeliveryDate,
    priority,
    paymentTerms,
    shippingAddress,
    remarks,
    items, // Array of { styleId, unitPrice, deliveryDate, breakup: [{ colorId, sizeId, quantity }] }
    // The sale order this order is made for — Orders → New fills itself from it (2026-09-25). Until
    // then this route had no such field and silently dropped it: no manual order was ever linked.
    saleOrderId,
  } = req.body;

  // Debug logging
  logInfo(
    '[createOrder] Request body:',
    JSON.stringify(
      {
        customerId,
        orderDate,
        expectedDeliveryDate,
        priority,
        items: items?.map((item: OrderItem) => ({
          styleId: item.styleId,
          unitPrice: item.unitPrice,
          breakupCount: item.breakup?.length,
          breakup: item.breakup?.slice(0, 3), // Log first 3 breakup items
        })),
      },
      null,
      2
    )
  );

  const userId = req.user?.userId;

  if (!userId) {
    throw new ValidationError('User not authenticated');
  }

  // ========================================
  // CRITICAL VALIDATION: Check cost sheet requirements
  // ========================================
  logInfo('[createOrder] Validating cost sheet requirements for all order items...');

  for (const item of items as OrderItem[]) {
    // 0. Style must be published (ACTIVE status)
    const style = await prisma.styles.findUnique({
      where: { id: item.styleId },
      select: { status: true, styleCode: true, buyerStyleRef: true },
    });

    if (!style || style.status !== 'ACTIVE') {
      throw new ValidationError(
        `Style ${style?.styleCode || item.styleId} must be published (ACTIVE) before creating an order. Please publish the style first.`,
        { code: 'STYLE_NOT_ACTIVE' }
      );
    }

    // 1. Must have RAW_MATERIAL_CALCULATION or PRODUCTION cost sheet
    // (Also accepts legacy PROCUREMENT_PRODUCTION for backward compatibility)
    const costSheet = await prisma.style_costing.findFirst({
      where: {
        styleId: item.styleId,
        purpose: { in: ['RAW_MATERIAL_CALCULATION', 'PRODUCTION', 'PROCUREMENT_PRODUCTION'] },
        supersededById: null,
      },
    });

    if (!costSheet) {
      throw new ValidationError(
        `Cannot create order for style ${item.styleId}. A cost sheet with 'Raw Material Calculation' or 'Production' mode must be completed and approved first.`,
        { code: 'MISSING_PROCUREMENT_COSTING' }
      );
    }

    // 2. Cost sheet must be approved
    if (!costSheet.isApproved) {
      throw new ValidationError(`Procurement cost sheet for style ${item.styleId} is pending approval.`, {
        code: 'COSTING_NOT_APPROVED',
      });
    }

    // 3. If variance exists, it must be approved
    if (costSheet.varianceStatus === 'REQUIRES_APPROVAL') {
      throw new ValidationError(
        `Actual costs for style ${item.styleId} exceed budget limits. Admin approval required before creating order.`,
        { code: 'VARIANCE_PENDING' }
      );
    }

    if (costSheet.varianceStatus === 'REJECTED') {
      throw new ValidationError(
        `Procurement costs for style ${item.styleId} were rejected. Please revise procurement before creating order.`,
        { code: 'VARIANCE_REJECTED' }
      );
    }

    logInfo(`[createOrder] Cost sheet validation passed for style ${item.styleId}`);
  }

  // All validations passed -> Proceed with order creation
  logInfo('[createOrder] All cost sheet validations passed. Proceeding with order creation...');

  // A size line without a colour takes the style's only colour: a colourless run can be cut but never
  // records stitching output (the rule Link to Production Order and Start Production apply). A style
  // with no colours stays size-only; one with several is left for the page to have chosen.
  const onlyColour = new Map<string, string>();
  for (const item of items as OrderItem[]) {
    if (!(item.breakup || []).some((b) => !b.colorId && b.quantity > 0) || onlyColour.has(item.styleId)) continue;
    const colours = await prisma.color_options.findMany({ where: { styleId: item.styleId }, select: { id: true } });
    if (colours.length === 1) onlyColour.set(item.styleId, colours[0].id);
  }

  // The sale order link: the same rule as Link to Production Order, plus the Buyer Deadline
  if (saleOrderId) {
    const styleCodes = new Map(
      (
        await prisma.styles.findMany({
          where: { id: { in: (items as OrderItem[]).map((i) => i.styleId) } },
          select: { id: true, styleCode: true },
        })
      ).map((st) => [st.id, st.styleCode])
    );
    await saleOrderService.assertLinkable(saleOrderId, {
      label: 'This order',
      customerId,
      items: (items as OrderItem[]).map((item) => {
        const breakupQty = (item.breakup || []).reduce((sum, b) => sum + b.quantity, 0);
        return {
          styleId: item.styleId,
          styleCode: styleCodes.get(item.styleId),
          quantity: breakupQty > 0 ? breakupQty : item.totalQuantity || 0,
          sized: breakupQty > 0,
        };
      }),
      expectedDeliveryDate: new Date(expectedDeliveryDate),
    });
  }

  // Generate order number atomically — the old local findFirst+parseInt generator raced under
  // concurrent creates and collided on the orderNumber unique (bug-hunt orders-5)
  const orderNumber = await generateAtomicOrderNumber();

  // Calculate totals (decimal.js — raw float sums drifted at paise level, bug-hunt orders-17)
  let totalQuantity = 0;
  let totalAmountDec = new Decimal(0);

  const orderItemsData = (items as OrderItem[]).map((item) => {
    const breakup = dedupeBreakup(
      (item.breakup || []).map((b) => ({ ...b, colorId: b.colorId || onlyColour.get(item.styleId) || b.colorId }))
    );
    // Use breakup sum if available, otherwise use direct totalQuantity
    const breakupQty = breakup.reduce((sum: number, b) => sum + b.quantity, 0);
    const itemTotalQty = breakupQty > 0 ? breakupQty : item.totalQuantity || 0;
    // Handle empty/undefined unitPrice - default to 0 for orders without pricing
    const parsedUnitPrice = parseFloat(String(item.unitPrice)) || 0;
    const itemTotalDec = roundToCent(multiplyCurrency(itemTotalQty, parsedUnitPrice));
    const itemTotal = itemTotalDec.toNumber();

    totalQuantity += itemTotalQty;
    totalAmountDec = totalAmountDec.plus(itemTotalDec);

    logInfo(
      '[createOrder] Processing item:',
      JSON.stringify({
        styleId: item.styleId,
        breakupCount: breakup.length,
        itemTotalQty,
        parsedUnitPrice,
        itemTotal,
      })
    );

    return {
      id: randomUUID(),
      styleId: item.styleId,
      itemDescription: item.itemDescription || null,
      totalQuantity: itemTotalQty,
      unitPrice: parsedUnitPrice,
      totalPrice: itemTotal,
      deliveryDate: item.deliveryDate ? new Date(item.deliveryDate) : null,
      remarks: item.remarks || null,
      order_item_breakup: {
        create: breakup.map((b) => ({
          id: randomUUID(),
          colorId: b.colorId, // Already normalised (empty → null) by dedupeBreakup
          sizeId: b.sizeId,
          quantity: b.quantity,
        })),
      },
    };
  });

  const createOrderRow = () =>
    prisma.orders.create({
      data: {
        id: randomUUID(),
        orderNumber,
        customerId,
        saleOrderId: saleOrderId || null,
        orderDate: orderDate ? new Date(orderDate) : new Date(),
        expectedDeliveryDate: new Date(expectedDeliveryDate),
        priority: priority || 'MEDIUM',
        totalQuantity,
        totalAmount: roundToCent(totalAmountDec).toNumber(),
        paymentTerms,
        shippingAddress,
        remarks,
        createdById: userId,
        order_items: {
          create: orderItemsData,
        },
      } as any,
      include: {
        customers: {
          select: {
            id: true,
            code: true,
            name: true,
            contactPerson: true,
            phone: true,
            email: true,
          },
        },
        users_orders_createdByIdTousers: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        order_items: {
          include: {
            styles: {
              select: {
                id: true,
                styleCode: true,
                buyerStyleRef: true,
                styleName: true,
                image: true,
              },
            },
            order_item_breakup: {
              include: {
                color_options: true,
                size_options: true,
              },
            },
          },
        },
      },
    });
  let order: Awaited<ReturnType<typeof createOrderRow>>;
  try {
    order = await createOrderRow();
  } catch (err) {
    // The partial unique index orders_saleOrderId_active_key: another order took this sale order
    // between the check above and this insert
    if (
      saleOrderId &&
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002' &&
      String(err.meta?.target ?? '').includes('saleOrderId')
    ) {
      throw new ConflictError('A production order was linked to this sale order a moment ago.');
    }
    throw err;
  }

  // =====================================================
  // CREATE COST SHEET SNAPSHOTS FOR EACH ORDER ITEM
  // Single writer lives in orderService.createCostingSnapshots — shared with the Sale Order
  // path (createWithItems), which previously created NO snapshot at all (qty-rate audit
  // 2026-08-24). Failures are surfaced in the response instead of silently swallowed
  // (bug-hunt orders-7).
  // =====================================================
  const snapshotResult = await orderService.createCostingSnapshots(
    order.order_items.map((oi) => ({ id: oi.id, styleId: oi.styleId }))
  );
  const costingSnapshots = snapshotResult.created;
  const costingFailures = snapshotResult.failures;

  // Qty-rate audit 2026-08-24: non-blocking WARN at creation — the BLOCK sits at Order BOM
  // creation and at IN_PRODUCTION confirmation. This just tells the user up front that the
  // order's quantity prices in a different processor rate slab than the style costing assumed.
  const rateWarnings: Array<{ styleId: string; driftItems: unknown[] }> = [];
  for (const orderItem of order.order_items) {
    try {
      const latestSheet = await prisma.style_costing.findFirst({
        where: { styleId: orderItem.styleId, isApproved: true, supersededById: null },
        orderBy: { version: 'desc' },
        select: { id: true },
      });
      if (!latestSheet) continue;
      const slabCheck = await processorRateValidationService.validateQuantitySlabs(
        latestSheet.id,
        orderItem.totalQuantity
      );
      if (slabCheck.driftItems.length > 0) {
        rateWarnings.push({ styleId: orderItem.styleId, driftItems: slabCheck.driftItems });
      }
    } catch (warnError) {
      // Read-only advisory check — a failure here must never fail order creation
      logWarn(`[createOrder] Rate-slab advisory check failed for style ${orderItem.styleId}:`, warnError);
    }
  }

  res.status(201).json({
    data: order,
    message: 'Order created successfully',
    costingInfo: {
      snapshotsCreated: costingSnapshots.length,
      totalItems: order.order_items.length,
      failures: costingFailures.length > 0 ? costingFailures : undefined,
    },
    rateWarnings: rateWarnings.length > 0 ? rateWarnings : undefined,
  });
};

/**
 * The Orders list's filter, shared with its Excel export so "Export" writes exactly the rows the
 * list shows (the export used to ignore search).
 */
export function buildOrderListWhere(
  query: Pick<OrderQueryInput, 'search' | 'customerId' | 'status' | 'priority' | 'fromDate' | 'toDate'>
): Prisma.ordersWhereInput {
  const { search = '', customerId, status, priority, fromDate, toDate } = query;
  const where: Prisma.ordersWhereInput = {};

  // The list renders a Style(s) column that was not searchable at all — the same gap the Sale
  // Orders list had. Matching the sale order it came from matters too: the factory is often handed
  // the buyer's PO number, not ours.
  applySearch(where as Record<string, unknown>, search as string | undefined, [
    'orderNumber',
    'customers.name',
    'customers.code',
    'order_items[].styles.styleCode',
    'order_items[].styles.buyerStyleRef',
    'order_items[].styles.styleName',
    'sale_orders.saleOrderNumber',
    'sale_orders.buyerPoNumber',
    'remarks',
  ]);

  if (customerId) {
    where.customerId = customerId;
  }

  if (status) {
    where.status = status;
  }

  if (priority) {
    where.priority = priority;
  }

  if (fromDate || toDate) {
    where.orderDate = {};
    if (fromDate) {
      where.orderDate.gte = fromDate;
    }
    if (toDate) {
      where.orderDate.lte = toDate;
    }
  }
  return where;
}

/**
 * Newest first, with a unique tie-break: orders created the same day share one orderDate (the form
 * sends a bare date), and skip/take over tied rows can repeat or drop an order between pages.
 */
export function orderListOrderBy(
  sortBy: OrderQueryInput['sortBy'] = 'orderDate',
  sortOrder: OrderQueryInput['sortOrder'] = 'desc'
): Prisma.ordersOrderByWithRelationInput[] {
  return [{ [sortBy]: sortOrder }, { orderNumber: sortOrder }, { id: sortOrder }];
}

/**
 * Get all orders with pagination, search, and filters
 * GET /api/orders
 */
export const getAllOrders = async (req: Request, res: Response): Promise<void> => {
  // Read from the Zod-validated query so fromDate/toDate are real Dates — the schema previously
  // validated startDate/endDate that nobody sent, letting garbage dates through raw (bug-hunt orders-12)
  const query = (req.validatedQuery || req.query) as unknown as OrderQueryInput;
  const pageNum = Number(query.page ?? 1);
  const limitNum = Number(query.limit ?? 10);
  const skip = (pageNum - 1) * limitNum;
  const where = buildOrderListWhere(query);

  const [rows, total] = await Promise.all([
    prisma.orders.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: orderListOrderBy(query.sortBy, query.sortOrder),
      include: {
        customers: {
          select: {
            id: true,
            code: true,
            name: true,
            contactPerson: true,
          },
        },
        users_orders_createdByIdTousers: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        order_items: {
          select: {
            id: true,
            styleId: true,
            styles: {
              select: { id: true, styleCode: true, buyerStyleRef: true },
            },
          },
        },
        // Every active BOM, newest first — reduced below to the latest per style (BOMs are per
        // style; `take: 1` showed one arbitrary style's BOM for a multi-style order).
        orderBoms: {
          where: { isActive: true },
          select: { id: true, status: true, styleId: true, version: true },
          orderBy: { version: 'desc' as const },
        },
        // Make-to-order origin (serializes as saleOrder)
        sale_orders: {
          select: { id: true, saleOrderNumber: true, buyerPoNumber: true, status: true },
        },
        _count: {
          select: { order_items: true },
        },
      },
    }),
    prisma.orders.count({ where }),
  ]);

  const orders = rows.map((order) => {
    const latestPerStyle = new Map<string, (typeof order.orderBoms)[number]>();
    for (const bom of order.orderBoms) {
      if (!latestPerStyle.has(bom.styleId)) latestPerStyle.set(bom.styleId, bom);
    }
    return { ...order, orderBoms: [...latestPerStyle.values()] };
  });

  res.json({
    data: orders,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  });
};

/**
 * Get single order by ID with full details
 * GET /api/orders/:id
 */
export const getOrderById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const order = await prisma.orders.findUnique({
    where: { id },
    include: {
      customers: true,
      users_orders_createdByIdTousers: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      users_orders_approvedByIdTousers: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      order_items: {
        include: {
          styles: true,
          order_item_breakup: {
            include: {
              color_options: true,
              size_options: true,
            },
          },
          // Costing Details + Production Variance panel (OrderDetail.tsx reads
          // item.orderItemCosting — serializer camelizes order_item_costing).
          order_item_costing: true,
        },
      },
      // Every BOM, newest version first — the order page shows each style's latest active one; the
      // order form counts approved ones
      orderBoms: {
        select: {
          id: true,
          status: true,
          styleId: true,
          version: true,
          isActive: true,
          totalMaterialCost: true,
          style: { select: { styleCode: true, styleName: true, buyerStyleRef: true } },
          _count: { select: { items: true } },
        },
        orderBy: { version: 'desc' },
      },
      // Make-to-order origin (serializes as saleOrder)
      sale_orders: {
        select: { id: true, saleOrderNumber: true, buyerPoNumber: true, status: true },
      },
      material_requirements: {
        where: { status: { notIn: ['CANCELLED'] } },
        select: { id: true },
        take: 1, // Only need to know if any exist
      },
    },
  });

  if (!order) {
    throw new NotFoundError('Order', id);
  }

  // Where the order stands, for the order page — each fact from its one helper:
  //   requirementsSummary  one bucket per live requirement line (order-requirements.helper)
  //   statusReason/shipment why the (derived) status is what it is, and ordered vs shipped (order-status.helper)
  //   runFabric            fabric issued to / still at Cutting per run (run-fabric.helper)
  //   dispatchNotes/orderInvoices  raised against the order OR its sale order — a sale-order dispatch
  //                        never carries orderId, so an ?orderId= list missed every one of them
  const soScope = order.saleOrderId ? [{ saleOrderId: order.saleOrderId }] : [];
  const liveRunIds = await prisma.work_orders.findMany({
    where: { orderId: id, status: { not: 'CANCELLED' } },
    select: { id: true },
  });
  const [requirementsSummary, facts, notes, orderInvoices, runFabric] = await Promise.all([
    orderRequirementBuckets(prisma, id),
    loadOrderStatusFacts(prisma, id),
    prisma.delivery_notes.findMany({
      where: { OR: [{ orderId: id }, ...soScope] },
      select: {
        id: true,
        deliveryNumber: true,
        status: true,
        deliveryDate: true,
        delivery_note_items: { select: { quantity: true } },
      },
      orderBy: { deliveryDate: 'desc' },
    }),
    prisma.invoices.findMany({
      where: { OR: [{ orderId: id }, ...soScope] },
      select: { id: true, invoiceNumber: true, status: true, totalAmount: true, invoiceDate: true },
      orderBy: { invoiceDate: 'desc' },
    }),
    Promise.all(
      liveRunIds.map(async ({ id: runId }) => {
        const lots = [...(await getRunFabricPosition([runId])).lots.values()];
        return {
          workOrderId: runId,
          issued: lots.reduce((sum, l) => sum + l.issued, 0),
          returned: lots.reduce((sum, l) => sum + l.returned, 0),
          atCutting: lots.reduce((sum, l) => sum + l.atCutting, 0),
          consumed: lots.reduce((sum, l) => sum + l.consumed, 0),
        };
      })
    ),
  ]);
  const derived = facts ? deriveOrderStatus(facts) : null;

  // Closed Cost per Piece (the buyer's agreed price, excl. GST) of the cost sheet each line was costed
  // from — new snapshots carry it; older ones name their sheet by id
  const closedCostByItem: Record<string, number | null> = {};
  for (const item of order.order_items) {
    const snap = (item.order_item_costing?.costingSnapshot ?? null) as { id?: string; closedCost?: unknown } | null;
    const fromSnap = snap?.closedCost;
    if (fromSnap !== undefined && fromSnap !== null) {
      closedCostByItem[item.id] = Number(fromSnap);
      continue;
    }
    const sheetId = item.order_item_costing?.baseCostingId ?? snap?.id ?? null;
    const sheet = sheetId
      ? await prisma.style_costing.findUnique({ where: { id: sheetId }, select: { closedCost: true } })
      : null;
    closedCostByItem[item.id] = sheet?.closedCost != null ? Number(sheet.closedCost) : null;
  }

  res.json({
    data: {
      ...order,
      requirementsSummary,
      statusReason: derived?.reason ?? null,
      shipment: facts
        ? {
            ordered: facts.shipments.reduce((sum, g) => sum + g.ordered, 0),
            shipped: facts.shipments.reduce((sum, g) => sum + Math.min(g.shipped, g.ordered), 0),
          }
        : null,
      dispatchNotes: notes.map(({ delivery_note_items, ...note }) => ({
        ...note,
        quantity: delivery_note_items.reduce((sum, i) => sum + i.quantity, 0),
      })),
      orderInvoices,
      runFabric,
      closedCostByItem,
    },
  });
};

/**
 * Update order
 * PUT /api/orders/:id
 */
export const updateOrder = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { customerId, orderDate, expectedDeliveryDate, priority, paymentTerms, shippingAddress, remarks, items } =
    req.body;

  // Item replacement is destructive (delete-and-recreate, cascading order_item_costing etc.),
  // so it needs a status gate and a completeness rule the old code lacked (qty-rate audit 2026-08-24).
  const existingOrder = await prisma.orders.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      order_items: { select: { id: true, styleId: true } },
      sale_orders: { select: { saleOrderNumber: true, buyerDeadline: true } },
    },
  });
  if (!existingOrder) {
    throw new NotFoundError('Order not found');
  }
  if (existingOrder.status === 'CANCELLED' || existingOrder.status === 'SPLIT') {
    throw new BusinessError(`Cannot edit a ${existingOrder.status} order.`);
  }
  // A linked order must still finish by its sale order's Buyer Deadline
  if (expectedDeliveryDate && existingOrder.sale_orders) {
    assertDeliveryWithinDeadline(new Date(expectedDeliveryDate), existingOrder.sale_orders);
  }

  // Build order-level update data
  const updateData: Record<string, unknown> = {
    orderDate: orderDate ? new Date(orderDate) : undefined,
    expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : undefined,
    priority,
    paymentTerms,
    shippingAddress,
    remarks,
  };

  if (customerId) {
    updateData.customerId = customerId;
  }

  // If items are provided, check for downstream dependencies before replacing
  if (items && Array.isArray(items) && items.length > 0) {
    if (existingOrder.status !== 'PENDING') {
      throw new BusinessError(
        `Order items can only be edited while the order is PENDING (current status: ${existingOrder.status}). ` +
          `Items on a running order are consumed by work orders, dispatch and costing — edit those documents instead.`
      );
    }

    // Replacement deletes EVERY existing item and recreates only what was sent. A payload
    // holding a subset (the old OrderForm sent just the first item) silently destroyed the
    // other styles of a multi-style order. Require the payload to cover every existing style.
    const submittedStyleIds = new Set((items as OrderItem[]).map((item) => item.styleId));
    const missingStyleIds = [
      ...new Set(existingOrder.order_items.filter((oi) => !submittedStyleIds.has(oi.styleId)).map((oi) => oi.styleId)),
    ];
    if (missingStyleIds.length > 0) {
      throw new BusinessError(
        `Order item update must include every existing item. ${missingStyleIds.length} existing style(s) are missing ` +
          `from the payload — saving would permanently delete them from the order.`
      );
    }

    const [approvedBoms, activeRequirements] = await Promise.all([
      prisma.order_bom.count({
        where: { orderId: id, status: { in: ['APPROVED', 'LOCKED'] } },
      }),
      prisma.material_requirements.count({
        where: { orderId: id, status: { notIn: ['CANCELLED'] } },
      }),
    ]);

    if (approvedBoms > 0 || activeRequirements > 0) {
      throw new BusinessError(
        'Cannot modify order items: this order has approved BOMs or active material requirements. Cancel the BOM/MRP first, then edit the order.'
      );
    }
  }

  // Styles that could not be costed during an item replacement — surfaced in the response below.
  const resnapshotFailures: Array<{ orderItemId: string; styleId: string; reason: string }> = [];

  // If items are provided, recalculate totals and replace order items
  if (items && Array.isArray(items) && items.length > 0) {
    let calcTotalQuantity = 0;
    // decimal.js accumulation — raw float sums drifted at paise level (bug-hunt orders-17)
    let calcTotalAmountDec = new Decimal(0);

    const orderItemsData = (items as OrderItem[]).map((item) => {
      const breakup = dedupeBreakup(item.breakup || []); // bug-hunt orders-16
      const breakupQty = breakup.reduce((sum: number, b) => sum + b.quantity, 0);
      const itemTotalQty = breakupQty > 0 ? breakupQty : item.totalQuantity || 0;
      const parsedUnitPrice = parseFloat(String(item.unitPrice)) || 0;
      const itemTotalDec = roundToCent(multiplyCurrency(itemTotalQty, parsedUnitPrice));

      calcTotalQuantity += itemTotalQty;
      calcTotalAmountDec = calcTotalAmountDec.plus(itemTotalDec);

      return {
        id: randomUUID(),
        styleId: item.styleId,
        itemDescription: item.itemDescription || null,
        totalQuantity: itemTotalQty,
        unitPrice: parsedUnitPrice,
        totalPrice: itemTotalDec.toNumber(),
        deliveryDate: item.deliveryDate ? new Date(item.deliveryDate) : null,
        remarks: item.remarks || null,
        order_item_breakup: {
          create: breakup.map((b) => ({
            id: randomUUID(),
            colorId: b.colorId,
            sizeId: b.sizeId,
            quantity: b.quantity,
          })),
        },
      };
    });

    updateData.totalQuantity = calcTotalQuantity;
    updateData.totalAmount = roundToCent(calcTotalAmountDec).toNumber();

    // The costing baseline this order was PLACED against, before its items are replaced.
    //
    // order_item_costing is `onDelete: Cascade` off order_items, so replacing the items destroys
    // it. Re-snapshotting afterwards reads whatever cost sheet is approved NOW, which silently
    // rebases the order onto a price agreed after it was sold (finding #12: ORD2026080030 frozen
    // at ESSKY091LS v1 Rs225.42 while an approved v2 Rs224.00 supersedes it). originalCostSheetVersion
    // means "the version this order was placed against" — an item-quantity edit must not move it.
    const priorCosting = await prisma.order_item_costing.findMany({
      where: { order_item: { orderId: id } },
      include: { order_item: { select: { styleId: true } } },
    });
    const priorByStyle = new Map(priorCosting.map((row) => [row.order_item.styleId, row]));
    // Items whose style is new to this order — snapshotted after the transaction (see below).
    const freshSnapshotQueue: Array<{ id: string; styleId: string }> = [];

    // Delete + recreate + work-order sync + header totals in ONE transaction. These ran as loose
    // top-level writes before, so a mid-loop failure left the order with zero/partial items and
    // stale header totals, and the dependency check above raced concurrent BOM/MRP writes.
    await prisma.$transaction(async (tx) => {
      await lockOrder(tx, id); // first: this edit re-plans runs, which the order's status reads
      // Delete existing order items and breakup, then create new ones
      await tx.order_item_breakup.deleteMany({
        where: { order_items: { orderId: id } },
      });
      await tx.order_items.deleteMany({
        where: { orderId: id },
      });

      // Create new order items
      for (const itemData of orderItemsData) {
        await tx.order_items.create({
          data: {
            ...itemData,
            orderId: id,
          } as any,
        });
      }

      // Re-attach the ORIGINAL baseline to the recreated items, inside this transaction so the
      // preserved snapshot commits or rolls back together with the items it belongs to. This is
      // the part that must be atomic: it is the only copy of the rates the order was sold on.
      //
      // Styles with NO prior baseline (genuinely new on this order) are snapshotted AFTER the
      // transaction instead — deliberately. createCostingSnapshots swallows per-item failures by
      // design (a style with no approved sheet is a reportable gap, not a reason to refuse the
      // edit — createOrder behaves the same way), and a swallowed DB error inside a Postgres
      // transaction would leave it aborted, turning that non-fatal gap into a failed order edit
      // with a confusing error.
      const needFreshSnapshot: Array<{ id: string; styleId: string }> = [];
      for (const itemData of orderItemsData) {
        const prior = priorByStyle.get(itemData.styleId);
        if (!prior) {
          needFreshSnapshot.push({ id: itemData.id, styleId: itemData.styleId });
          continue;
        }
        await tx.order_item_costing.create({
          data: {
            orderItemId: itemData.id,
            baseCostingId: prior.baseCostingId,
            selectedCadId: prior.selectedCadId,
            cadMeters: prior.cadMeters,
            cadWidth: prior.cadWidth,
            fabricTotal: prior.fabricTotal,
            trimsTotal: prior.trimsTotal,
            cmtTotal: prior.cmtTotal,
            embroideryTotal: prior.embroideryTotal,
            accessoriesTotal: prior.accessoriesTotal,
            processingTotal: prior.processingTotal,
            overheadsTotal: prior.overheadsTotal,
            totalCostPerPiece: prior.totalCostPerPiece,
            profitMargin: prior.profitMargin,
            sellingPricePerPiece: prior.sellingPricePerPiece,
            estimatedCostPerPiece: prior.estimatedCostPerPiece,
            actualCostPerPiece: prior.actualCostPerPiece,
            costVarianceAmount: prior.costVarianceAmount,
            costVariancePercent: prior.costVariancePercent,
            // The only record of the rates this order was sold on — carried verbatim.
            // DbNull, not JsonNull: the column is nullable, and a prior row with SQL NULL must
            // come back as SQL NULL. JsonNull would store the JSON value `null` instead, which
            // reads back as present-but-null and is a different thing to every consumer.
            costingSnapshot: prior.costingSnapshot ?? Prisma.DbNull,
            snapshotCreatedAt: prior.snapshotCreatedAt,
            originalCostSheetVersion: prior.originalCostSheetVersion,
            recalculatedAt: prior.recalculatedAt,
            varianceCalculatedAt: prior.varianceCalculatedAt,
          },
        });
      }

      freshSnapshotQueue.push(...needFreshSnapshot);

      // Auto-sync PENDING work orders with updated order items
      const pendingWorkOrders = await tx.work_orders.findMany({
        where: { orderId: id, status: 'PENDING' },
      });

      for (const wo of pendingWorkOrders) {
        const matchingNewItem = await tx.order_items.findFirst({
          where: { orderId: id, styleId: wo.styleId },
          include: { order_item_breakup: true },
        });

        if (matchingNewItem) {
          await tx.work_order_breakup.deleteMany({
            where: { workOrderId: wo.id },
          });

          await tx.work_orders.update({
            where: { id: wo.id },
            data: {
              orderItemId: matchingNewItem.id,
              totalQuantity: matchingNewItem.totalQuantity,
            },
          });

          for (const b of matchingNewItem.order_item_breakup) {
            await tx.work_order_breakup.create({
              data: {
                id: randomUUID(),
                workOrderId: wo.id,
                colorId: b.colorId,
                sizeId: b.sizeId,
                plannedQuantity: b.quantity,
              },
            });
          }

          logInfo(`[updateOrder] Synced work order ${wo.workOrderNumber} with updated order items`);
        }
      }

      // Header totals commit atomically with the items they were computed from; the outer
      // update below re-applies the same values only to load the response payload.
      await tx.orders.update({
        where: { id },
        data: updateData as any,
      });
      await syncOrderStatus(tx, id);
    });

    // Existing baselines were preserved inside the transaction above. Styles new to this order
    // get their first snapshot here, outside it, because a failure is reportable rather than
    // fatal (see the comment at the queue). Anything that could not be snapshotted is returned
    // to the caller below — createOrder already does this, and not doing it here is why an order
    // could end up with no costing and nobody was told.
    if (freshSnapshotQueue.length > 0) {
      const fresh = await orderService.createCostingSnapshots(freshSnapshotQueue);
      resnapshotFailures.push(...fresh.failures);
    }
    if (resnapshotFailures.length > 0) {
      logWarn('[updateOrder] Cost-sheet snapshot failures for styles new to this order', {
        orderId: id,
        failures: resnapshotFailures,
      });
    }
  } else {
    // Never trust client-supplied header totals: always recompute totalQuantity/totalAmount from
    // SUM(order_items) so the stored aggregates (which feed statistics) cannot drift (bug-hunt orders-6)
    const agg = await prisma.order_items.aggregate({
      where: { orderId: id },
      _sum: { totalQuantity: true, totalPrice: true },
    });
    updateData.totalQuantity = agg._sum.totalQuantity ?? 0;
    updateData.totalAmount = agg._sum.totalPrice ?? 0;
  }

  const order = await prisma.orders.update({
    where: { id },
    data: updateData as any,
    include: {
      customers: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
      order_items: {
        include: {
          styles: {
            select: {
              id: true,
              styleCode: true,
              buyerStyleRef: true,
              styleName: true,
            },
          },
          order_item_breakup: {
            include: {
              color_options: true,
              size_options: true,
            },
          },
        },
      },
    },
  });

  res.json({
    data: order,
    message: 'Order updated successfully',
    // Mirrors createOrder: a style that could not be costed must reach the user, not just the log.
    ...(resnapshotFailures.length > 0 && { costingInfo: { failures: resnapshotFailures } }),
  });
};

/**
 * Cancel order with options for handling allocated materials (lace)
 * POST /api/orders/:id/cancel
 */
export const cancelOrderWithOptions = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { laceHandling, cancellationReason } = req.body;
  const userId = req.user?.userId;

  // Validate lace handling option
  if (laceHandling && !['RELEASE_TO_STOCK', 'RETURN_TO_SUPPLIER'].includes(laceHandling)) {
    throw new ValidationError('laceHandling must be either RELEASE_TO_STOCK or RETURN_TO_SUPPLIER');
  }

  // Check if order exists and get lace allocation info
  const order = await prisma.orders.findUnique({
    where: { id },
    include: {
      _count: {
        select: { order_items: true },
      },
    },
  });

  if (!order) {
    throw new NotFoundError('Order', id);
  }

  if (order.status === 'CANCELLED') {
    throw new ValidationError('Order is already cancelled');
  }

  // Check for lace allocations to inform the response
  const laceAllocations = await prisma.lace_stock_allocation.findMany({
    where: {
      orderId: id,
      allocationStatus: { in: ['RESERVED', 'IN_USE'] },
    },
    include: {
      stock: {
        include: {
          laceMaster: {
            select: { id: true, laceName: true, laceCode: true },
          },
        },
      },
    },
  });

  // Cancel the order with options
  await orderService.cancelOrder(id, {
    laceHandling: laceHandling || 'RELEASE_TO_STOCK',
    userId,
    cancellationReason: cancellationReason || 'Order cancelled',
  });

  // Build response with lace handling summary
  const laceHandlingSummary =
    laceAllocations.length > 0
      ? {
          allocationsProcessed: laceAllocations.length,
          handlingMethod: laceHandling || 'RELEASE_TO_STOCK',
          details: laceAllocations.map((alloc) => ({
            laceName: alloc.stock.laceMaster?.laceName || 'Unknown',
            laceCode: alloc.stock.laceMaster?.laceCode || '',
            quantityAllocated: Number(alloc.quantityAllocated),
            quantityConsumed: Number(alloc.quantityConsumed),
            quantityReleased:
              Number(alloc.quantityAllocated) - Number(alloc.quantityConsumed) - Number(alloc.quantityReturned || 0),
          })),
        }
      : null;

  res.json({
    message: 'Order cancelled successfully',
    laceHandling: laceHandlingSummary,
  });
};

/**
 * Get lace allocations for an order (to inform cancellation decisions)
 * GET /api/orders/:id/lace-allocations
 */
export const getOrderLaceAllocations = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  // Check if order exists
  const order = await prisma.orders.findUnique({
    where: { id },
    select: { id: true, orderNumber: true, status: true },
  });

  if (!order) {
    throw new NotFoundError('Order', id);
  }

  // Get all lace allocations for this order
  const allocations = await prisma.lace_stock_allocation.findMany({
    where: { orderId: id },
    include: {
      stock: {
        include: {
          laceMaster: {
            select: {
              id: true,
              laceName: true,
              laceCode: true,
              color: true,
              width: true,
            },
          },
        },
      },
      style: {
        select: { id: true, styleCode: true, buyerStyleRef: true, styleName: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Calculate summary
  const summary = {
    totalAllocations: allocations.length,
    activeAllocations: allocations.filter((a) => ['RESERVED', 'IN_USE'].includes(a.allocationStatus)).length,
    totalAllocatedQuantity: allocations.reduce((sum, a) => sum + Number(a.quantityAllocated), 0),
    totalConsumedQuantity: allocations.reduce((sum, a) => sum + Number(a.quantityConsumed), 0),
    totalReturnedQuantity: allocations.reduce((sum, a) => sum + Number(a.quantityReturned || 0), 0),
    releasableQuantity: allocations
      .filter((a) => ['RESERVED', 'IN_USE'].includes(a.allocationStatus))
      .reduce((sum, a) => {
        return sum + (Number(a.quantityAllocated) - Number(a.quantityConsumed) - Number(a.quantityReturned || 0));
      }, 0),
  };

  res.json({
    data: {
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
      },
      allocations,
      summary,
    },
  });
};

/**
 * Check if order can be hard deleted
 * GET /api/orders/:id/can-delete
 */
export const canDeleteOrder = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  // Same floor as the hard-delete route's requireAdmin(): answer "no" here rather than let the
  // page offer a Delete that can only come back 403.
  if (req.user?.role !== 'ADMIN') {
    res.json({ canDelete: false, code: 'ADMIN_ONLY', reason: 'Only an administrator can delete an order.' });
    return;
  }
  const result = await orderService.canDeleteOrder(id);
  res.json(result);
};

/**
 * Hard delete order and all related records
 * DELETE /api/orders/:id/hard-delete
 */
export const hardDeleteOrder = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  await orderService.hardDeleteOrder(id);
  res.json({ message: 'Order deleted successfully' });
};

/**
 * Get order statistics grouped by customer
 * GET /api/orders/statistics/by-customer
 */
export const getOrderStatisticsByCustomer = async (req: Request, res: Response): Promise<void> => {
  // Get statistics for orders that are not cancelled
  const statistics = await prisma.orders.groupBy({
    by: ['customerId'],
    where: {
      status: {
        not: 'CANCELLED',
      },
    },
    _count: {
      id: true,
    },
    _sum: {
      totalQuantity: true,
      totalAmount: true,
    },
  });

  // Get customer details for each statistic
  const customerIds = statistics.map((s) => s.customerId);
  const customers = await prisma.customers.findMany({
    where: {
      id: { in: customerIds },
    },
    select: {
      id: true,
      code: true,
      name: true,
    },
  });

  const customerMap = new Map(customers.map((c) => [c.id, c]));

  // Combine statistics with customer info
  const result = statistics.map((stat) => ({
    customerId: stat.customerId,
    customerCode: customerMap.get(stat.customerId)?.code || '',
    customerName: customerMap.get(stat.customerId)?.name || '',
    orderCount: stat._count.id,
    totalPieces: stat._sum.totalQuantity || 0,
    totalAmount: stat._sum.totalAmount || 0,
  }));

  // Calculate totals
  const totals = {
    totalOrders: result.reduce((sum, r) => sum + r.orderCount, 0),
    totalPieces: result.reduce((sum, r) => sum + r.totalPieces, 0),
    totalAmount: result.reduce((sum, r) => sum + Number(r.totalAmount), 0),
  };

  res.json({
    data: result,
    totals,
  });
};

/**
 * Create any missing production work orders for an order.
 * POST /api/orders/:orderId/work-orders
 *
 * Explicit replacement for the silent fallback that used to run inside
 * approveAndCalculateMRP. Approving a bill of materials and planning materials is a
 * procurement decision; scheduling production is a separate one with different
 * prerequisites (a colour/size breakup) and different timing — you often buy fabric weeks
 * before you are ready to cut. Burying work-order creation inside BOM approval meant a
 * cutting-stage prerequisite surfaced as an error on a procurement action, and it stamped
 * invented planned dates (now, now + 30 days) onto anything it did create.
 *
 * Idempotent: skips order items that already have a work order for their style.
 */
export const createWorkOrdersForOrder = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }
  const { orderId } = req.params;
  const { plannedStartDate, plannedEndDate, priority } = req.body ?? {};

  const result = await createMissingWorkOrders(orderId, userId, { plannedStartDate, plannedEndDate, priority });

  res.json({
    success: true,
    data: result,
    message:
      result.failed.length > 0
        ? `${result.created.length} work order(s) created, ${result.failed.length} could not be created`
        : `${result.created.length} work order(s) created`,
  });
};

/**
 * Set (or replace) the size/colour breakup of ONE order item, then let everything downstream
 * catch up.
 * PUT /api/orders/:orderId/items/:orderItemId/size-breakup
 *
 * Orders are deliberately created without a size split so long-lead greige/dyeing/printing
 * procurement can start; the sizes arrive later. PUT /orders/:id cannot serve that flow — it
 * refuses once a BOM is approved, and it destroys and recreates order_items, which would
 * orphan material_requirements and cascade-delete costing/samples/inspections/label overrides.
 *
 * This endpoint is deliberately additive: it touches ONLY order_item_breakup for an existing
 * order_items row, so every downstream link survives. It then syncs pending work-order
 * breakups, recalculates MRP (which is PO-safe: rows already on a PO are preserved) and
 * creates any work orders that were impossible while the order had no sizes.
 */
export const setOrderItemSizeBreakup = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }
  const { orderId, orderItemId } = req.params;
  const { breakup, confirmQuantityChange } = req.body as {
    breakup: OrderItemBreakup[];
    confirmQuantityChange?: boolean;
  };
  const result = await applyOrderItemSizeBreakup({ orderId, orderItemId, breakup, confirmQuantityChange, userId });
  res.json({ success: true, data: result.data, message: result.message });
};

/**
 * The whole sizes-later cascade — breakup (with colour), pending work-order sync, MRP re-run,
 * work-order catch-up. Shared by PUT …/size-breakup and linking a production order to its sale
 * order (which copies the buyer PO's sizes onto a sizeless order).
 */
export async function applyOrderItemSizeBreakup(params: {
  orderId: string;
  orderItemId: string;
  breakup: OrderItemBreakup[];
  confirmQuantityChange?: boolean;
  userId: string;
}) {
  const { orderId, orderItemId, breakup, confirmQuantityChange, userId } = params;

  const orderItem = await prisma.order_items.findFirst({
    where: { id: orderItemId, orderId },
    select: {
      id: true,
      styleId: true,
      totalQuantity: true,
      unitPrice: true, // needed to recompute totalPrice when the quantity changes
      orders: { select: { id: true, orderNumber: true, status: true } },
    },
  });
  if (!orderItem) {
    throw new NotFoundError('Order item', orderItemId);
  }
  if (orderItem.orders.status === 'CANCELLED' || orderItem.orders.status === 'SPLIT') {
    throw new BusinessError(`Cannot set a size breakdown on a ${orderItem.orders.status} order.`);
  }

  const sizesOnly = dedupeBreakup(breakup).filter((b) => b.quantity > 0);
  if (sizesOnly.length === 0) {
    throw new ValidationError('Provide at least one size with a quantity greater than zero.');
  }

  // The colour rule (sku-colour.helper): a one-colour style fills it in, a several-colour style must
  // say which, a foreign colour is refused — and a style with NO colour keeps its sizes blank-coloured.
  // Until 2026-09-28 that last case was refused, so Link to Production Order copied no sizes for six
  // Easybuy orders and their size-wise labels sat in "Size Split Pending" (owner: colour is optional).
  const withColour = await resolveSizeLineColours(prisma, orderItem.styleId, sizesOnly);
  const cleaned = dedupeBreakup(withColour);

  // Every size must belong to this style, or the breakup silently plans for sizes the style
  // does not have (and the label size-variant match downstream would never resolve).
  const sizeIds = [...new Set(cleaned.map((b) => b.sizeId))];
  const validSizes = await prisma.size_options.findMany({
    where: { id: { in: sizeIds }, styleId: orderItem.styleId },
    select: { id: true },
  });
  if (validSizes.length !== sizeIds.length) {
    const valid = new Set(validSizes.map((s) => s.id));
    throw new ValidationError(
      `${sizeIds.filter((id) => !valid.has(id)).length} size(s) do not belong to this order item's style.`
    );
  }

  const newTotal = cleaned.reduce((sum, b) => sum + b.quantity, 0);
  const currentTotal = orderItem.totalQuantity;
  const quantityChanged = newTotal !== currentTotal;

  // Changing the committed quantity is allowed, but never silently: greige/dyeing POs may
  // already be placed against the current total, and the BOM was computed at it.
  if (quantityChanged && !confirmQuantityChange) {
    const [approvedBoms, poLinkedCount, liveWorkOrders] = await Promise.all([
      prisma.order_bom.count({ where: { orderId, status: { in: ['APPROVED', 'LOCKED'] }, isActive: true } }),
      prisma.material_requirements.count({
        where: { orderId, status: { in: ['PO_GENERATED', 'PO_SENT', 'PARTIALLY_RECEIVED', 'RECEIVED'] } },
      }),
      // Work orders past PENDING are being cut/stitched against the current quantity; the
      // breakup sync below deliberately only touches PENDING ones, so say so plainly.
      prisma.work_orders.count({ where: { orderId, status: { notIn: ['PENDING', 'CANCELLED'] } } }),
    ]);
    throw new BusinessError(
      `These sizes add up to ${newTotal} pcs but the order item currently carries ${currentTotal} pcs. ` +
        `Confirm to change the order quantity to ${newTotal}.` +
        (approvedBoms > 0
          ? ` The approved BOM was calculated at ${currentTotal} pcs and will need regenerating.`
          : '') +
        (poLinkedCount > 0
          ? ` ${poLinkedCount} requirement(s) are already on a purchase order and will NOT be adjusted automatically.`
          : '') +
        (liveWorkOrders > 0
          ? ` ${liveWorkOrders} work order(s) are already in production and will NOT be re-planned.`
          : '') +
        (orderItem.orders.status !== 'PENDING' ? ` This order is ${orderItem.orders.status}.` : ''),
      {
        code: 'QUANTITY_CHANGE_REQUIRES_CONFIRMATION',
        currentTotal,
        newTotal,
        approvedBoms,
        poLinkedRequirements: poLinkedCount,
        liveWorkOrders,
        orderStatus: orderItem.orders.status,
      }
    );
  }

  // Replace this item's breakup only — the order_items row (and every FK pointing at it) stays.
  await prisma.$transaction(async (tx) => {
    // The order is locked before anything else in a status-syncing transaction (order-status.helper)
    await lockOrder(tx, orderId);
    // Lock the order item first. Two concurrent calls would otherwise each delete the rows
    // visible in their own snapshot and then insert, merging both breakups into one item
    // (Postgres READ COMMITTED). The loser blocks here and re-reads after the winner commits.
    await tx.$queryRaw`SELECT id FROM order_items WHERE id = ${orderItem.id} FOR UPDATE`;

    // Re-read the committed total inside the lock: the pre-flight quantity-change gate above
    // ran on an unlocked snapshot that a concurrent write may have moved.
    const locked = await tx.order_items.findUniqueOrThrow({
      where: { id: orderItem.id },
      select: { totalQuantity: true, unitPrice: true },
    });
    if (locked.totalQuantity !== currentTotal && newTotal !== locked.totalQuantity && !confirmQuantityChange) {
      throw new BusinessError(
        `This order item changed to ${locked.totalQuantity} pcs while you were entering sizes. Reload and try again.`,
        { code: 'QUANTITY_CHANGE_REQUIRES_CONFIRMATION', currentTotal: locked.totalQuantity, newTotal }
      );
    }

    await tx.order_item_breakup.deleteMany({ where: { orderItemId: orderItem.id } });
    for (const b of cleaned) {
      await tx.order_item_breakup.create({
        data: {
          id: randomUUID(),
          orderItemId: orderItem.id,
          colorId: b.colorId,
          sizeId: b.sizeId,
          quantity: b.quantity,
        },
      });
    }

    if (newTotal !== locked.totalQuantity) {
      // Money is stored, not derived — updating quantity alone would leave totalPrice and the
      // order's totalAmount stating the OLD quantity's value (the create path computes both).
      const newItemTotal = roundToCent(multiplyCurrency(newTotal, Number(locked.unitPrice))).toNumber();
      await tx.order_items.update({
        where: { id: orderItem.id },
        data: { totalQuantity: newTotal, totalPrice: newItemTotal },
      });
      const itemTotals = await tx.order_items.aggregate({
        where: { orderId },
        _sum: { totalQuantity: true, totalPrice: true },
      });
      await tx.orders.update({
        where: { id: orderId },
        data: {
          totalQuantity: itemTotals._sum.totalQuantity ?? newTotal,
          totalAmount: itemTotals._sum.totalPrice ?? newItemTotal,
        },
      });
    }

    // Keep this item's PENDING work orders in step. Scoped by orderItemId (not styleId): an
    // order can carry two items of the same style, and re-pointing by style would steal the
    // sibling's work order and leave it with this item's breakup.
    const pendingWorkOrders = await tx.work_orders.findMany({
      where: { orderId, orderItemId: orderItem.id, status: 'PENDING' },
      select: { id: true },
    });
    for (const wo of pendingWorkOrders) {
      await tx.work_order_breakup.deleteMany({ where: { workOrderId: wo.id } });
      await tx.work_orders.update({ where: { id: wo.id }, data: { totalQuantity: newTotal } });
      for (const b of cleaned) {
        await tx.work_order_breakup.create({
          data: {
            id: randomUUID(),
            workOrderId: wo.id,
            colorId: b.colorId,
            sizeId: b.sizeId,
            plannedQuantity: b.quantity,
          },
        });
      }
    }
    await syncOrderStatus(tx, orderId);
  });

  logInfo(
    `[SizeBreakup] Order ${orderItem.orders.orderNumber} item ${orderItem.id}: ${cleaned.length} size line(s), ` +
      `total ${currentTotal} → ${newTotal}`
  );

  // Recalculate requirements so SIZE_PENDING labels become per-size lines. PO'd rows are
  // preserved by MRP itself; failures here must not lose the breakup we just saved.
  let requirements: { created: number; updated: number; sizePending: number } | null = null;
  let mrpError: string | null = null;
  try {
    const { calculateRequirementsFromOrder } = await import('../services/mrp.service');
    const mrpResult = await calculateRequirementsFromOrder({ orderId, checkStock: true }, userId);
    requirements = {
      created: mrpResult.created,
      updated: mrpResult.updated,
      sizePending: (mrpResult.sizePending || []).length,
    };
  } catch (error) {
    mrpError = error instanceof Error ? error.message : 'Unknown error';
    logWarn(`[SizeBreakup] MRP recalculation failed for order ${orderId}: ${mrpError}`);
  }

  // Production planning was impossible without sizes — catch it up now.
  let workOrders: { created: string[]; skipped: string[]; failed: { styleId: string; reason: string }[] } | null = null;
  let workOrderError: string | null = null;
  try {
    workOrders = await createMissingWorkOrders(orderId, userId);
  } catch (error) {
    workOrderError = error instanceof Error ? error.message : 'Unknown error';
    logWarn(`[SizeBreakup] Work order creation failed for order ${orderId}: ${workOrderError}`);
  }

  const messageParts = [`Size breakdown saved (${cleaned.length} size line(s), ${newTotal} pcs)`];
  if (quantityChanged) messageParts.push(`order quantity changed ${currentTotal} → ${newTotal}`);
  if (requirements) messageParts.push(`${requirements.created + requirements.updated} material requirements updated`);
  if (mrpError) messageParts.push(`MRP recalculation failed: ${mrpError}`);
  if (workOrders && workOrders.created.length > 0)
    messageParts.push(`${workOrders.created.length} work order(s) created`);
  if (workOrderError) messageParts.push(`Work order creation failed: ${workOrderError}`);

  return {
    data: {
      orderItemId: orderItem.id,
      breakup: cleaned,
      quantityChanged,
      currentTotal,
      newTotal,
      requirements,
      workOrders,
      // Inside `data` deliberately: clients read data.*, so top-level error fields were
      // unreachable and a failed MRP recalc would have been reported to the user as success.
      mrpError,
      workOrderError,
    },
    message: messageParts.join('. '),
  };
}

/**
 * Idempotently create work orders for any order item that lacks one.
 *
 * Shared by POST /orders/:orderId/work-orders and the size-breakup endpoint — an order
 * created without sizes cannot have work orders at all (createFromOrderItem requires the
 * breakup sum to match the total), so entering the sizes is exactly the moment production
 * planning becomes possible and should catch up.
 */
export async function createMissingWorkOrders(
  orderId: string,
  userId: string,
  opts: {
    plannedStartDate?: string | Date;
    plannedEndDate?: string | Date;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  } = {}
): Promise<{ created: string[]; skipped: string[]; failed: { styleId: string; reason: string }[] }> {
  const order = await prisma.orders.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      expectedDeliveryDate: true,
      order_items: { select: { id: true, styleId: true } },
    },
  });
  if (!order) {
    throw new NotFoundError('Order', orderId);
  }

  const created: string[] = [];
  const skipped: string[] = [];
  const failed: { styleId: string; reason: string }[] = [];

  for (const item of order.order_items) {
    const existing = await prisma.work_orders.findFirst({ where: { orderId, styleId: item.styleId } });
    if (existing) {
      skipped.push(item.styleId);
      continue;
    }
    try {
      const wo = await workOrderService.createFromOrderItem(item.id, orderId, {
        // Default to the order's own delivery date rather than an invented +30 days.
        plannedStartDate: opts.plannedStartDate ? new Date(opts.plannedStartDate) : new Date(),
        plannedEndDate: opts.plannedEndDate ? new Date(opts.plannedEndDate) : order.expectedDeliveryDate,
        priority: opts.priority || 'MEDIUM',
        createdById: userId,
      });
      created.push((wo as { workOrderNumber?: string })?.workOrderNumber ?? item.styleId);
    } catch (error) {
      // Per item, so one unbreakable item does not abandon the rest.
      failed.push({ styleId: item.styleId, reason: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  return { created, skipped, failed };
}
