// Order Management Controller
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { logInfo, logWarn } from '../utils/logger';
import { orderService } from '../services/order.service';
import { processorRateValidationService } from '../services/processor-rate-validation.service';
import { NotFoundError, ValidationError, BusinessError, UnauthorizedError } from '../errors';
import workOrderService from '../services/workOrder.service';
import { generateAtomicOrderNumber } from '../utils/atomicCodeGenerator';
import { multiplyCurrency, roundToCent, Decimal } from '../utils/currency';
import type { OrderQueryInput } from '../schemas/order.schema';

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

  // Generate order number atomically — the old local findFirst+parseInt generator raced under
  // concurrent creates and collided on the orderNumber unique (bug-hunt orders-5)
  const orderNumber = await generateAtomicOrderNumber();

  // Calculate totals (decimal.js — raw float sums drifted at paise level, bug-hunt orders-17)
  let totalQuantity = 0;
  let totalAmountDec = new Decimal(0);

  const orderItemsData = (items as OrderItem[]).map((item) => {
    const breakup = dedupeBreakup(item.breakup || []);
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

  const order = await prisma.orders.create({
    data: {
      id: randomUUID(),
      orderNumber,
      customerId,
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
 * Get all orders with pagination, search, and filters
 * GET /api/orders
 */
export const getAllOrders = async (req: Request, res: Response): Promise<void> => {
  // Read from the Zod-validated query so fromDate/toDate are real Dates — the schema previously
  // validated startDate/endDate that nobody sent, letting garbage dates through raw (bug-hunt orders-12)
  const {
    page = 1,
    limit = 10,
    search = '',
    customerId,
    status,
    priority,
    fromDate,
    toDate,
  } = (req.validatedQuery || req.query) as unknown as OrderQueryInput;

  const pageNum = Number(page);
  const limitNum = Number(limit);
  const skip = (pageNum - 1) * limitNum;

  // Build where clause
  const where: Prisma.ordersWhereInput = {};

  if (search) {
    where.OR = [
      { orderNumber: { contains: search as string, mode: 'insensitive' } },
      { customers: { name: { contains: search as string, mode: 'insensitive' } } },
      { customers: { code: { contains: search as string, mode: 'insensitive' } } },
    ];
  }

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

  const [orders, total] = await Promise.all([
    prisma.orders.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { orderDate: 'desc' },
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
        orderBoms: {
          where: { isActive: true },
          select: { id: true, status: true },
          orderBy: { version: 'desc' as const },
          take: 1,
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
      orderBoms: {
        select: { id: true, status: true, styleId: true },
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

  res.json({ data: order });
};

/**
 * Update order status
 * PATCH /api/orders/:id/status
 */
export const updateOrderStatus = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { status, reason, acceptRates } = req.body;

  // Get the current order with items to check for status change
  const currentOrder = await prisma.orders.findUnique({
    where: { id },
    include: {
      order_items: {
        select: {
          id: true,
          styleId: true,
          totalQuantity: true,
        },
      },
    },
  });

  if (!currentOrder) {
    throw new NotFoundError('Order', id);
  }

  const previousStatus = currentOrder.status;

  // =====================================================
  // Qty-rate audit 2026-08-24: PRE-TRANSITION rate-slab gate.
  // This MUST run before orderService.updateStatus — the status flip commits there, and the
  // RM-clone loop below swallows its errors by design, so any check placed inside it can never
  // block. If this order's quantity lands in a different processor rate slab than the style was
  // costed at, confirmation stops until the user accepts the order-quantity rates
  // (acceptRates: true), which apply to THIS order only — the style costing is never edited.
  // =====================================================
  if (status === 'IN_PRODUCTION' && previousStatus !== 'IN_PRODUCTION' && acceptRates !== true) {
    for (const orderItem of currentOrder.order_items) {
      const gateCostSheet = await prisma.style_costing.findFirst({
        where: {
          styleId: orderItem.styleId,
          purpose: { in: ['RAW_MATERIAL_CALCULATION', 'PRODUCTION', 'PROCUREMENT_PRODUCTION'] },
          supersededById: null,
          isApproved: true,
        },
        orderBy: { version: 'desc' },
        select: { id: true },
      });
      if (!gateCostSheet) continue; // cost-sheet existence is enforced at order creation

      const slabCheck = await processorRateValidationService.validateQuantitySlabs(
        gateCostSheet.id,
        orderItem.totalQuantity
      );
      if (slabCheck.driftItems.length > 0) {
        const driftSummary = slabCheck.driftItems
          .map(
            (d) =>
              `${d.itemName}: costed ₹${d.costSheetRate}/m @ ${d.slabLabelOld ?? 'costed slab'} → this order ` +
              `₹${d.orderRate}/m @ ${d.slabLabelNew} (${d.percentageChange > 0 ? '+' : ''}${d.percentageChange.toFixed(1)}%)`
          )
          .join('; ');
        throw new BusinessError(
          `Cannot confirm: this order's quantity (${orderItem.totalQuantity} pcs) falls in a different processor ` +
            `rate slab than the style was costed at. ${driftSummary}. Confirm again accepting the order-quantity ` +
            `rates (they apply to this order only).`,
          { code: 'RATE_SLAB_CHANGED', driftItems: slabCheck.driftItems, styleId: orderItem.styleId }
        );
      }
    }
  }

  // Delegate to the service so the state machine actually runs (validateTransition + admin-override
  // logging). The raw prisma.orders.update this replaced allowed ANY transition — e.g. DELIVERED back
  // to PENDING — silently bypassing the validator that already existed (bug-hunt orders-3).
  const updated = await orderService.updateStatus(id, status, req.user?.role, reason);
  const order = { ...updated, order_items: currentOrder.order_items };

  // =====================================================
  // AUTO-TRIGGER RAW_MATERIAL_CALCULATION CAD
  // When order status changes to IN_PRODUCTION (confirmation)
  // Clone COSTING CAD rows to RAW_MATERIAL_CALCULATION purpose
  // =====================================================
  const rawMatResults: { styleId: string; clonedCount: number; skipped: boolean; reason?: string }[] = [];

  if (status === 'IN_PRODUCTION' && previousStatus !== 'IN_PRODUCTION') {
    logInfo(
      `[updateOrderStatus] Order ${id} confirmed (IN_PRODUCTION) - triggering RAW_MATERIAL_CALCULATION CAD creation`
    );

    for (const orderItem of order.order_items) {
      try {
        // Idempotency guard, scoped to THIS order. The old guard fetched an ARBITRARY RM row
        // for the style (findFirst, no orderBy) and skipped only if that one row happened to
        // belong to this order — so a repeat order for the same style always re-cloned the
        // whole RM set, and re-confirming could duplicate it (qty-rate audit 2026-08-24).
        const existingRawMat = await prisma.fabric_width_cad.findFirst({
          where: {
            purpose: 'RAW_MATERIAL_CALCULATION',
            clonedFromOrderId: id,
            styleFabric: {
              style_components: {
                styleId: orderItem.styleId,
              },
            },
          } as any,
          select: { id: true },
        });

        if (existingRawMat) {
          rawMatResults.push({
            styleId: orderItem.styleId,
            clonedCount: 0,
            skipped: true,
            reason: 'RAW_MATERIAL_CALCULATION already exists for this order',
          });
          continue;
        }

        // Find fully-approved COSTING CAD rows for this style.
        // Two-owner split (2026-08-22): BOTH approvals are required by policy — CAD-geometry
        // approval (quantities are final) AND the costing PRICE approval with an actual price.
        // The old `approvedBy: { not: null }` proxy matched either flow and also matched
        // phantom rows with no price, which cloned ₹0 RM rows.
        const costingCadRows = await prisma.fabric_width_cad.findMany({
          where: {
            purpose: 'COSTING',
            approvalStatus: 'APPROVED', // allow-cad-approval: CAD half of the both-approvals gate
            costingApprovalStatus: { in: ['APPROVED', 'ALTERNATE_APPROVED'] },
            totalCostPerMeter: { not: null },
            styleFabric: {
              style_components: {
                styleId: orderItem.styleId,
              },
            },
          },
          include: {
            styleFabric: {
              select: {
                id: true,
                componentId: true,
                fabricId: true,
                genericGreigeName: true,
              },
            },
            sizeBreakdowns: true, // Correct relation name
          },
        });

        if (costingCadRows.length === 0) {
          rawMatResults.push({
            styleId: orderItem.styleId,
            clonedCount: 0,
            skipped: true,
            reason:
              'No fully-approved COSTING CAD found (needs CAD approval in CAD Planning AND an approved costing price)',
          });
          continue;
        }

        // Clone each COSTING CAD row to RAW_MATERIAL_CALCULATION
        let clonedCount = 0;
        for (const costingCad of costingCadRows) {
          const newCadId = randomUUID();

          // Use type assertion for fields with @map
          await prisma.fabric_width_cad.create({
            data: {
              id: newCadId,
              styleFabricId: costingCad.styleFabricId,
              greigeId: costingCad.greigeId,
              cutableWidth: costingCad.cutableWidth,
              cadMeters: costingCad.cadMeters,
              cadYards: costingCad.cadYards,
              cadAverage: costingCad.cadAverage,
              cadWastagePercent: costingCad.cadWastagePercent,
              markerEfficiency: costingCad.markerEfficiency,
              // RAW_MATERIAL_CALCULATION purpose
              // BUG-FC7 fix: sync purpose fields - always set both purpose and purposeEnum together
              purpose: 'RAW_MATERIAL_CALCULATION',
              purposeEnum: 'RAW_MATERIAL_CALCULATION' as any,
              // Link to order - these fields use @map in schema
              clonedFromOrderId: id,
              clonedFromCadId: costingCad.id,
              notes: `Cloned from COSTING CAD ${costingCad.id} when order ${order.orderNumber} was confirmed`,
              // Cost data — qty-rate audit 2026-08-24: the clone used to DROP the identity of the
              // price (processorId/rateCardId/costingStyleId/fabricId/componentName/shrinkage/
              // screen), leaving an unauditable number, an orphan invisible to every
              // costingStyleId-keyed reader, and R2 phantom-check growth. Copy the full costing
              // decoration and stamp THIS order's quantity beside the costed basis.
              costingStyleId: orderItem.styleId,
              fabricId: costingCad.fabricId,
              componentName: costingCad.componentName,
              patternPartId: costingCad.patternPartId,
              processorId: costingCad.processorId,
              rateCardId: costingCad.rateCardId,
              shrinkagePercent: costingCad.shrinkagePercent,
              shrinkageCostPerMeter: costingCad.shrinkageCostPerMeter,
              transportCostPerMeter: costingCad.transportCostPerMeter,
              screenCostPerMeter: costingCad.screenCostPerMeter,
              screenType: costingCad.screenType,
              numberOfColors: costingCad.numberOfColors,
              processingBatchGroupColorId: costingCad.processingBatchGroupColorId,
              orderQuantityPcs: orderItem.totalQuantity,
              costedAtQuantityMeters: costingCad.costedAtQuantityMeters,
              costedRateIsBatch: costingCad.costedRateIsBatch,
              createdById: req.user?.userId ?? null,
              greigeCostPerMeter: costingCad.greigeCostPerMeter,
              processingPricePerMeter: costingCad.processingPricePerMeter,
              totalCostPerMeter: costingCad.totalCostPerMeter,
              costInputMode: costingCad.costInputMode,
              // Clone size breakdowns if they exist
              sizeBreakdowns:
                costingCad.sizeBreakdowns.length > 0
                  ? {
                      create: costingCad.sizeBreakdowns.map((sb: any) => ({
                        sizeName: sb.sizeName,
                        sizeId: sb.sizeId,
                        quantity: sb.quantity,
                        cadMeters: sb.cadMeters,
                        cadYards: sb.cadYards,
                      })),
                    }
                  : undefined,
            } as any,
          });
          clonedCount++;
        }

        rawMatResults.push({
          styleId: orderItem.styleId,
          clonedCount,
          skipped: false,
        });

        logInfo(
          `[updateOrderStatus] Cloned ${clonedCount} COSTING CAD rows to RAW_MATERIAL_CALCULATION for style ${orderItem.styleId}`
        );
      } catch (rawMatError) {
        // allow-swallow — per-item failure is surfaced to the caller via rawMaterialCalculation.results in the response (T2)
        // Per-item error handling - don't fail the whole status update
        logWarn(
          `[updateOrderStatus] Failed to create RAW_MATERIAL_CALCULATION CAD for style ${orderItem.styleId}:`,
          rawMatError
        );
        rawMatResults.push({
          styleId: orderItem.styleId,
          clonedCount: 0,
          skipped: true,
          reason: `Error during cloning: ${rawMatError instanceof Error ? rawMatError.message : String(rawMatError)}`,
        });
      }
    }
  }

  res.json({
    data: order,
    message: 'Order status updated successfully',
    rawMaterialCalculation:
      rawMatResults.length > 0
        ? {
            triggered: true,
            results: rawMatResults,
          }
        : undefined,
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
    },
  });
  if (!existingOrder) {
    throw new NotFoundError('Order not found');
  }
  if (existingOrder.status === 'CANCELLED' || existingOrder.status === 'SPLIT') {
    throw new BusinessError(`Cannot edit a ${existingOrder.status} order.`);
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

    // Delete + recreate + work-order sync + header totals in ONE transaction. These ran as loose
    // top-level writes before, so a mid-loop failure left the order with zero/partial items and
    // stale header totals, and the dependency check above raced concurrent BOM/MRP writes.
    await prisma.$transaction(async (tx) => {
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
    });

    // Qty-rate audit 2026-08-24: replacing the items CASCADE-deleted order_item_costing and
    // nothing ever recreated it — after any edit the order permanently lost its costing
    // baseline (variance anchor, version badge). Re-snapshot at the new quantities.
    const resnapshot = await orderService.createCostingSnapshots(
      orderItemsData.map((item) => ({ id: item.id, styleId: item.styleId }))
    );
    if (resnapshot.failures.length > 0) {
      logWarn('[updateOrder] Cost-sheet re-snapshot failures after item replacement', {
        orderId: id,
        failures: resnapshot.failures,
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
  });
};

/**
 * Delete/Cancel order
 * DELETE /api/orders/:id
 */
export const deleteOrder = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const userId = req.user?.userId;

  // Check if order exists
  const order = await prisma.orders.findUnique({
    where: { id },
  });

  if (!order) {
    throw new NotFoundError('Order', id);
  }

  // Use the service to cancel with default lace handling (release to stock)
  await orderService.cancelOrder(id, {
    laceHandling: 'RELEASE_TO_STOCK',
    userId,
    cancellationReason: 'Order cancelled via DELETE request',
  });

  res.json({ message: 'Order cancelled successfully' });
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

  const orderItem = await prisma.order_items.findFirst({
    where: { id: orderItemId, orderId },
    select: {
      id: true,
      styleId: true,
      totalQuantity: true,
      orders: { select: { id: true, orderNumber: true, status: true } },
    },
  });
  if (!orderItem) {
    throw new NotFoundError('Order item', orderItemId);
  }
  if (orderItem.orders.status === 'CANCELLED' || orderItem.orders.status === 'SPLIT') {
    throw new BusinessError(`Cannot set a size breakdown on a ${orderItem.orders.status} order.`);
  }

  const cleaned = dedupeBreakup(breakup).filter((b) => b.quantity > 0);
  if (cleaned.length === 0) {
    throw new ValidationError('Provide at least one size with a quantity greater than zero.');
  }

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
    const [approvedBoms, poLinkedCount] = await Promise.all([
      prisma.order_bom.count({ where: { orderId, status: { in: ['APPROVED', 'LOCKED'] }, isActive: true } }),
      prisma.material_requirements.count({
        where: { orderId, status: { in: ['PO_GENERATED', 'PO_SENT', 'PARTIALLY_RECEIVED', 'RECEIVED'] } },
      }),
    ]);
    throw new BusinessError(
      `These sizes add up to ${newTotal} pcs but the order item currently carries ${currentTotal} pcs. ` +
        `Confirm to change the order quantity to ${newTotal}.` +
        (approvedBoms > 0
          ? ` The approved BOM was calculated at ${currentTotal} pcs and will need regenerating.`
          : '') +
        (poLinkedCount > 0
          ? ` ${poLinkedCount} requirement(s) are already on a purchase order and will NOT be adjusted automatically.`
          : ''),
      {
        code: 'QUANTITY_CHANGE_REQUIRES_CONFIRMATION',
        currentTotal,
        newTotal,
        approvedBoms,
        poLinkedRequirements: poLinkedCount,
      }
    );
  }

  // Replace this item's breakup only — the order_items row (and every FK pointing at it) stays.
  await prisma.$transaction(async (tx) => {
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

    if (quantityChanged) {
      await tx.order_items.update({ where: { id: orderItem.id }, data: { totalQuantity: newTotal } });
      const itemTotals = await tx.order_items.aggregate({
        where: { orderId },
        _sum: { totalQuantity: true },
      });
      await tx.orders.update({
        where: { id: orderId },
        data: { totalQuantity: itemTotals._sum.totalQuantity ?? newTotal },
      });
    }

    // Mirror the order-edit path: keep PENDING work orders' breakup in step.
    const pendingWorkOrders = await tx.work_orders.findMany({
      where: { orderId, styleId: orderItem.styleId, status: 'PENDING' },
      select: { id: true },
    });
    for (const wo of pendingWorkOrders) {
      await tx.work_order_breakup.deleteMany({ where: { workOrderId: wo.id } });
      await tx.work_orders.update({
        where: { id: wo.id },
        data: { orderItemId: orderItem.id, totalQuantity: newTotal },
      });
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

  res.json({
    success: true,
    data: {
      orderItemId: orderItem.id,
      breakup: cleaned,
      quantityChanged,
      currentTotal,
      newTotal,
      requirements,
      workOrders,
    },
    mrpError,
    workOrderError,
    message: messageParts.join('. '),
  });
};

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
