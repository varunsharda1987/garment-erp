// Order Management Controller
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { logInfo, logWarn } from '../utils/logger';
import { orderService } from '../services/order.service';
import { NotFoundError, ValidationError, BusinessError } from '../errors';
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
      select: { status: true, styleCode: true },
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
  // This captures the cost sheet data at order creation time
  // for accurate pricing and variance tracking later
  // =====================================================
  const costingSnapshots: string[] = [];
  // Snapshot failures are surfaced in the response instead of being silently swallowed (bug-hunt orders-7)
  const costingFailures: { orderItemId: string; styleId: string; reason: string }[] = [];

  for (const orderItem of order.order_items) {
    try {
      // Find the approved cost sheet for this style (latest version)
      const costSheet = await prisma.style_costing.findFirst({
        where: {
          styleId: orderItem.styleId,
          isApproved: true,
          supersededById: null, // Only get the current active version
        },
        orderBy: { version: 'desc' },
      });

      if (costSheet) {
        // Create the costing snapshot
        const costingSnapshot = {
          id: costSheet.id,
          version: costSheet.version,
          versionDate: costSheet.versionDate,
          fabricDetails: costSheet.fabricDetails,
          fabricTotal: costSheet.fabricTotal,
          trimsDetails: costSheet.trimsDetails,
          trimsTotal: costSheet.trimsTotal,
          cmtTotal: costSheet.cmtTotal,
          cuttingCost: costSheet.cuttingCost,
          stitchingCost: costSheet.stitchingCost,
          finishingCost: costSheet.finishingCost,
          embroideryDetails: costSheet.embroideryDetails,
          embroideryTotal: costSheet.embroideryTotal,
          accessoriesDetails: costSheet.accessoriesDetails,
          accessoriesTotal: costSheet.accessoriesTotal,
          valueLossPercent: costSheet.valueLossPercent,
          valueLossAmount: costSheet.valueLossAmount,
          markupPercent: costSheet.markupPercent,
          markupAmount: costSheet.markupAmount,
          subtotal: costSheet.subtotal,
          totalProductCost: costSheet.totalProductCost,
          totalCostPerPiece: costSheet.totalCostPerPiece,
          sellingPricePerPiece: costSheet.sellingPricePerPiece,
          profitMargin: costSheet.profitMargin,
        };

        // Create order_item_costing record with snapshot
        // Note: Using type assertion for fields that use @map in schema
        await prisma.order_item_costing.create({
          data: {
            orderItemId: orderItem.id,
            baseCostingId: costSheet.id,
            fabricTotal: costSheet.fabricTotal || 0,
            trimsTotal: costSheet.trimsTotal || 0,
            cmtTotal: costSheet.cmtTotal || 0,
            embroideryTotal: costSheet.embroideryTotal || 0,
            accessoriesTotal: costSheet.accessoriesTotal || 0,
            totalCostPerPiece: costSheet.totalCostPerPiece || costSheet.totalProductCost || 0,
            profitMargin: costSheet.profitMargin,
            sellingPricePerPiece: costSheet.sellingPricePerPiece,
            // Fields with @map need to use the Prisma model name (camelCase)
            costingSnapshot: costingSnapshot as any,
            snapshotCreatedAt: new Date(),
            originalCostSheetVersion: costSheet.version,
            estimatedCostPerPiece: costSheet.totalCostPerPiece || costSheet.totalProductCost || 0,
          } as any,
        });

        costingSnapshots.push(orderItem.id);
        logInfo(
          `[createOrder] Created cost sheet snapshot for order item ${orderItem.id} from cost sheet v${costSheet.version}`
        );
      } else {
        logWarn(`[createOrder] No approved cost sheet found for style ${orderItem.styleId}`);
        costingFailures.push({
          orderItemId: orderItem.id,
          styleId: orderItem.styleId,
          reason: 'No approved cost sheet found for style',
        });
      }
    } catch (snapshotError) {
      // allow-swallow — failure is surfaced to the caller via costingInfo.failures in the response (T2)
      // Don't fail the order if snapshot fails — but report it so the caller can retry
      // instead of silently losing the variance baseline (bug-hunt orders-7)
      logWarn(`[createOrder] Failed to create cost sheet snapshot for order item ${orderItem.id}:`, snapshotError);
      costingFailures.push({
        orderItemId: orderItem.id,
        styleId: orderItem.styleId,
        reason: snapshotError instanceof Error ? snapshotError.message : 'Snapshot creation failed',
      });
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
              select: { id: true, styleCode: true },
            },
          },
        },
        orderBoms: {
          where: { isActive: true },
          select: { id: true, status: true },
          orderBy: { version: 'desc' as const },
          take: 1,
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
  const { status, reason } = req.body;

  // Get the current order with items to check for status change
  const currentOrder = await prisma.orders.findUnique({
    where: { id },
    include: {
      order_items: {
        select: {
          id: true,
          styleId: true,
        },
      },
    },
  });

  if (!currentOrder) {
    throw new NotFoundError('Order', id);
  }

  const previousStatus = currentOrder.status;

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
        // Check if RAW_MATERIAL_CALCULATION CAD already exists for this style+order
        // Using raw query due to field name mapping in Prisma schema
        const existingRawMat = await prisma.fabric_width_cad.findFirst({
          where: {
            purpose: 'RAW_MATERIAL_CALCULATION',
            styleFabric: {
              style_components: {
                styleId: orderItem.styleId,
              },
            },
          } as any,
        });

        // Check if this specific order has already triggered RAW_MAT
        if (existingRawMat && (existingRawMat as any).clonedFromOrderId === id) {
          rawMatResults.push({
            styleId: orderItem.styleId,
            clonedCount: 0,
            skipped: true,
            reason: 'RAW_MATERIAL_CALCULATION already exists for this order',
          });
          continue;
        }

        // Find approved COSTING CAD rows for this style
        // approvedBy is set when CAD is approved (not null means approved)
        const costingCadRows = await prisma.fabric_width_cad.findMany({
          where: {
            purpose: 'COSTING',
            approvedBy: { not: null }, // CAD is approved when approvedBy is set
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
            reason: 'No approved COSTING CAD found',
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
              purpose: 'RAW_MATERIAL_CALCULATION',
              // Link to order - these fields use @map in schema
              clonedFromOrderId: id,
              clonedFromCadId: costingCad.id,
              notes: `Cloned from COSTING CAD ${costingCad.id} when order ${order.orderNumber} was confirmed`,
              // Cost data
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

    // Delete existing order items and breakup, then create new ones
    await prisma.order_item_breakup.deleteMany({
      where: { order_items: { orderId: id } },
    });
    await prisma.order_items.deleteMany({
      where: { orderId: id },
    });

    // Create new order items
    for (const itemData of orderItemsData) {
      await prisma.order_items.create({
        data: {
          ...itemData,
          orderId: id,
        } as any,
      });
    }

    // Auto-sync PENDING work orders with updated order items
    const pendingWorkOrders = await prisma.work_orders.findMany({
      where: { orderId: id, status: 'PENDING' },
    });

    for (const wo of pendingWorkOrders) {
      const matchingNewItem = await prisma.order_items.findFirst({
        where: { orderId: id, styleId: wo.styleId },
        include: { order_item_breakup: true },
      });

      if (matchingNewItem) {
        await prisma.work_order_breakup.deleteMany({
          where: { workOrderId: wo.id },
        });

        await prisma.work_orders.update({
          where: { id: wo.id },
          data: {
            orderItemId: matchingNewItem.id,
            totalQuantity: matchingNewItem.totalQuantity,
          },
        });

        for (const b of matchingNewItem.order_item_breakup) {
          await prisma.work_order_breakup.create({
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
        select: { id: true, styleCode: true, styleName: true },
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
