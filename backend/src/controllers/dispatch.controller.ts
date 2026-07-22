import { Request, Response } from 'express';
import logger, { logWarn } from '../utils/logger';
import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import crypto from 'crypto';
import { NotFoundError, ValidationError, UnauthorizedError } from '../errors';

// ============================================
// Helper Functions
// ============================================

const transformDeliveryNote = (note: any) => ({
  ...note,
  order: note.orders
    ? {
        id: note.orders.id,
        orderNumber: note.orders.orderNumber,
      }
    : null,
  customer: note.customers
    ? {
        id: note.customers.id,
        name: note.customers.name,
        billingName: note.customers.billingName,
      }
    : null,
  createdBy: note.users
    ? {
        id: note.users.id,
        name: `${note.users.firstName} ${note.users.lastName}`,
      }
    : null,
  items: note.delivery_note_items?.map((item: any) => ({
    ...item,
    style: item.styles
      ? {
          id: item.styles.id,
          styleCode: item.styles.styleCode,
          styleName: item.styles.styleName,
        }
      : null,
    color: item.color_options
      ? {
          id: item.color_options.id,
          colorName: item.color_options.colorName,
          colorCode: item.color_options.colorCode,
        }
      : null,
    size: item.size_options
      ? {
          id: item.size_options.id,
          sizeName: item.size_options.sizeName,
          sortOrder: item.size_options.sortOrder,
        }
      : null,
  })),
  // Include POD with customer GRN if available
  ext: note.delivery_notes_ext
    ? {
        id: note.delivery_notes_ext.id,
        pod: note.delivery_notes_ext.pod
          ? {
              id: note.delivery_notes_ext.pod.id,
              deliveryDate: note.delivery_notes_ext.pod.deliveryDate,
              receivedBy: note.delivery_notes_ext.pod.receivedBy,
              deliveryStatus: note.delivery_notes_ext.pod.deliveryStatus,
              customerGrnNumber: note.delivery_notes_ext.pod.customerGrnNumber,
              customerGrnDate: note.delivery_notes_ext.pod.customerGrnDate,
            }
          : null,
      }
    : null,
});

const transformASN = (asn: any) => ({
  ...asn,
  order: asn.order
    ? {
        id: asn.order.id,
        orderNumber: asn.order.orderNumber,
        customer: asn.order.customers
          ? {
              id: asn.order.customers.id,
              name: asn.order.customers.name,
              billingName: asn.order.customers.billingName,
            }
          : null,
      }
    : null,
  createdBy: asn.createdBy
    ? {
        id: asn.createdBy.id,
        name: `${asn.createdBy.firstName} ${asn.createdBy.lastName}`,
      }
    : null,
  skus: asn.skuBreakdown?.map((sku: any) => ({
    ...sku,
    color: sku.color
      ? {
          id: sku.color.id,
          colorName: sku.color.colorName,
          colorCode: sku.color.colorCode,
        }
      : null,
    size: sku.size
      ? {
          id: sku.size.id,
          sizeName: sku.size.sizeName,
          sortOrder: sku.size.sortOrder,
        }
      : null,
  })),
});

const generateDeliveryNumber = async (): Promise<string> => {
  const today = new Date();
  const prefix = `DN-${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}`;

  const existingCount = await prisma.delivery_notes.count({
    where: {
      deliveryNumber: {
        startsWith: prefix,
      },
    },
  });

  return `${prefix}-${(existingCount + 1).toString().padStart(4, '0')}`;
};

const generateASNNumber = async (orderNumber: string): Promise<string> => {
  const prefix = `ASN-${orderNumber}`;

  const existingCount = await prisma.asn_applications.count({
    where: {
      asnNumber: {
        startsWith: prefix,
      },
    },
  });

  return `${prefix}-${(existingCount + 1).toString().padStart(3, '0')}`;
};

// Include options
const deliveryNoteIncludeOptions = {
  orders: true,
  customers: true,
  users: true,
  delivery_note_items: {
    include: {
      styles: true,
      color_options: true,
      size_options: true,
    },
  },
};

// Extended include options with POD for delivery note detail
const deliveryNoteExtendedIncludeOptions = {
  ...deliveryNoteIncludeOptions,
  delivery_notes_ext: {
    include: {
      pod: true,
    },
  },
};

const asnIncludeOptions = {
  order: {
    include: {
      customers: true,
    },
  },
  createdBy: true,
  skuBreakdown: {
    include: {
      color: true,
      size: true,
    },
  },
};

// ============================================
// Delivery Note CRUD
// ============================================

export const getAllDeliveryNotes = async (req: Request, res: Response) => {
  const { page = 1, limit = 20, search, status, orderId, customerId, fromDate, toDate } = req.query;

  const skip = (Number(page) - 1) * Number(limit);

  const where: Prisma.delivery_notesWhereInput = {};

  if (search) {
    where.OR = [
      { deliveryNumber: { contains: String(search), mode: 'insensitive' } },
      { orders: { orderNumber: { contains: String(search), mode: 'insensitive' } } },
      { customers: { name: { contains: String(search), mode: 'insensitive' } } },
    ];
  }

  if (status) {
    where.status = status as any;
  }

  if (orderId) {
    where.orderId = String(orderId);
  }

  if (customerId) {
    where.customerId = String(customerId);
  }

  if (fromDate || toDate) {
    where.deliveryDate = {};
    if (fromDate) {
      where.deliveryDate.gte = new Date(String(fromDate));
    }
    if (toDate) {
      where.deliveryDate.lte = new Date(String(toDate));
    }
  }

  const [notes, total] = await Promise.all([
    prisma.delivery_notes.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: deliveryNoteIncludeOptions,
    }),
    prisma.delivery_notes.count({ where }),
  ]);

  res.json({
    data: notes.map(transformDeliveryNote),
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
  });
};

export const getDeliveryNoteById = async (req: Request, res: Response) => {
  const { id } = req.params;

  const note = await prisma.delivery_notes.findUnique({
    where: { id },
    include: deliveryNoteIncludeOptions,
  });

  if (!note) {
    throw new NotFoundError('Delivery note', id);
  }

  res.json({ data: transformDeliveryNote(note) });
};

export const createDeliveryNote = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }
  const { orderId, customerId, deliveryDate, remarks, items } = req.body;

  const deliveryNumber = await generateDeliveryNumber();

  // Note creation + FG deductions run in ONE transaction with guarded atomic decrements (bug-hunt
  // dispatch-1). The old code was off-transaction read-modify-write: concurrent notes lost deductions,
  // a SKU split across locations was skipped entirely, and a missing colorId deducted ANY color's stock
  // (finished_goods_stock.colorId is required, so `colorId: undefined` dropped the filter).
  // Shortfalls no longer vanish silently: what exists is deducted, the gap is flagged in the response.
  const fgShortfalls: Array<{
    styleId: string;
    colorId: string | null;
    sizeId: string;
    requested: number;
    deducted: number;
  }> = [];

  // Records of exactly which FG rows this note deducts (and how much) — written with the note so a
  // later delete can restore stock precisely (bug-hunt dispatch-2).
  const fgAllocations: Array<{ fgStockId: string; quantity: number }> = [];

  const note = await prisma.$transaction(
    async (tx) => {
      // Over-dispatch validation runs INSIDE the tx with the order row locked — the old pre-tx
      // check-then-insert raced (two concurrent notes both passed, then both inserted), and it only
      // compared ORDER-TOTAL quantities, so one SKU could absorb another SKU's allowance
      // (bug-hunt dispatch-3). Per-SKU caps come from order_item_breakup where it exists.
      if (orderId && items?.length > 0) {
        await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;
        const order = await tx.orders.findUnique({
          where: { id: orderId },
          include: { order_items: { include: { order_item_breakup: true } } },
        });

        if (order) {
          const existingDeliveryItems = await tx.delivery_note_items.findMany({
            where: { delivery_notes: { orderId } },
            select: { styleId: true, colorId: true, sizeId: true, quantity: true },
          });

          const skuKey = (styleId?: string | null, colorId?: string | null, sizeId?: string | null) =>
            `${styleId || ''}-${colorId || ''}-${sizeId || ''}`;

          const dispatchedMap = new Map<string, number>();
          for (const di of existingDeliveryItems) {
            const key = skuKey(di.styleId, di.colorId, di.sizeId);
            dispatchedMap.set(key, (dispatchedMap.get(key) || 0) + di.quantity);
          }

          // Ordered per SKU (style+color+size) from the order item breakups
          const orderedMap = new Map<string, number>();
          let hasBreakup = false;
          for (const oi of order.order_items) {
            for (const b of oi.order_item_breakup) {
              hasBreakup = true;
              const key = skuKey(oi.styleId, b.colorId, b.sizeId);
              orderedMap.set(key, (orderedMap.get(key) || 0) + b.quantity);
            }
          }

          if (hasBreakup) {
            for (const item of items) {
              if (!item.styleId || !item.sizeId || !item.quantity) continue;
              const key = skuKey(item.styleId, item.colorId, item.sizeId);
              const ordered = orderedMap.get(key) ?? 0;
              const already = dispatchedMap.get(key) ?? 0;
              if (already + item.quantity > ordered) {
                throw new ValidationError(
                  `Dispatch exceeds ordered quantity for this SKU (style/color/size): ordered ${ordered}, ` +
                    `already dispatched ${already}, requested ${item.quantity}`
                );
              }
            }
          }

          // Order-total backstop (also covers legacy orders without SKU breakups)
          const totalOrdered = order.order_items.reduce((sum, oi) => sum + oi.totalQuantity, 0);
          const totalAlreadyDispatched = Array.from(dispatchedMap.values()).reduce((sum, qty) => sum + qty, 0);
          const totalNewDispatch = items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
          if (totalAlreadyDispatched + totalNewDispatch > totalOrdered) {
            throw new ValidationError(
              `Dispatch quantity (${totalNewDispatch}) would exceed order limit. ` +
                `Ordered: ${totalOrdered}, already dispatched: ${totalAlreadyDispatched}, ` +
                `remaining: ${totalOrdered - totalAlreadyDispatched}`
            );
          }
        }
      }

      const created = await tx.delivery_notes.create({
        data: {
          id: crypto.randomUUID(),
          deliveryNumber,
          orderId,
          customerId,
          deliveryDate: deliveryDate ? new Date(deliveryDate) : new Date(),
          status: 'PENDING',
          remarks,
          createdById: userId,
          delivery_note_items:
            items?.length > 0
              ? {
                  create: items.map((item: any) => ({
                    id: crypto.randomUUID(),
                    styleId: item.styleId,
                    colorId: item.colorId,
                    sizeId: item.sizeId,
                    quantity: item.quantity,
                  })),
                }
              : undefined,
        },
        include: deliveryNoteIncludeOptions,
      });

      if (items?.length > 0) {
        for (const item of items) {
          if (!item.styleId || !item.sizeId || !item.quantity) continue;
          let remaining: number = item.quantity;

          // Exact-SKU rows only. Without a colorId we cannot know WHICH color's stock left the warehouse,
          // so nothing is deducted and the full quantity is flagged (never deduct a different SKU).
          if (item.colorId) {
            // Deterministic order (quantity desc, id asc) so concurrent notes lock rows in the same
            // sequence — avoids lock-order deadlocks between notes covering the same SKU.
            const rows = await tx.finished_goods_stock.findMany({
              where: { styleId: item.styleId, colorId: item.colorId, sizeId: item.sizeId, quantity: { gt: 0 } },
              orderBy: [{ quantity: 'desc' }, { id: 'asc' }],
              select: { id: true },
            });
            for (const row of rows) {
              if (remaining <= 0) break;
              // Atomic take-min under a row lock: takes whatever the row STILL has (up to remaining) even
              // if a concurrent note consumed part of it after our findMany — the snapshot-based
              // "decrement exactly N or skip" version under-deducted in that race (review finding).
              const taken: Array<{ taken: number }> = await tx.$queryRaw`
              WITH before AS (
                SELECT quantity FROM finished_goods_stock WHERE id = ${row.id} FOR UPDATE
              )
              UPDATE finished_goods_stock f
              SET quantity = f.quantity - LEAST(f.quantity, CAST(${remaining} AS int)),
                  "lastUpdated" = now()
              FROM before
              WHERE f.id = ${row.id} AND f.quantity > 0
              RETURNING LEAST(before.quantity, CAST(${remaining} AS int)) AS taken`;
              if (taken.length > 0) {
                const took = Number(taken[0].taken);
                remaining -= took;
                if (took > 0) fgAllocations.push({ fgStockId: row.id, quantity: took });
              }
            }
          }

          if (remaining > 0) {
            fgShortfalls.push({
              styleId: item.styleId,
              colorId: item.colorId ?? null,
              sizeId: item.sizeId,
              requested: item.quantity,
              deducted: item.quantity - remaining,
            });
          }
        }
      }

      // Persist the exact deductions so deleting this (PENDING) note can restore them precisely.
      if (fgAllocations.length > 0) {
        await tx.delivery_note_fg_allocations.createMany({
          data: fgAllocations.map((a) => ({
            id: crypto.randomUUID(),
            deliveryNoteId: created.id,
            fgStockId: a.fgStockId,
            quantity: a.quantity,
          })),
        });
      }

      return created;
    },
    { timeout: 15000, maxWait: 5000 }
  ); // headroom over Prisma's 5s default: per-item row-locked allocation on large notes

  if (fgShortfalls.length > 0) {
    logWarn(`Delivery note ${deliveryNumber} created with FG stock shortfalls (dispatched more than on-hand FG)`, {
      deliveryNoteId: note.id,
      fgShortfalls,
    });
  }

  // Auto-create production_tracking: SHIPPED for all work orders of this order
  if (orderId) {
    try {
      const workOrders = await prisma.work_orders.findMany({
        where: { orderId },
        select: { id: true, totalQuantity: true },
      });
      for (const wo of workOrders) {
        await prisma.production_tracking.create({
          data: {
            id: crypto.randomUUID(),
            workOrderId: wo.id,
            productionStage: 'SHIPPED',
            quantityCompleted: items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0,
            updatedById: userId,
            updateDate: new Date(),
          },
        });
      }
    } catch (err) {
      logger.error('Failed to create production_tracking for dispatch:', err);
    }
  }

  res.status(201).json({
    data: transformDeliveryNote(note),
    // Explicit flag (never silent): SKUs whose FG on-hand couldn't cover the dispatched quantity.
    fgShortfalls: fgShortfalls.length > 0 ? fgShortfalls : undefined,
    message:
      fgShortfalls.length > 0
        ? `Delivery note created — WARNING: ${fgShortfalls.length} item(s) exceeded finished-goods stock on hand`
        : 'Delivery note created successfully',
  });
};

export const deleteDeliveryNote = async (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = await prisma.delivery_notes.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!existing) {
    throw new NotFoundError('Delivery note', id);
  }

  if (existing.status !== 'PENDING') {
    throw new ValidationError('Can only delete pending delivery notes');
  }

  // Restore + delete in ONE tx, from the note's own allocation records — the exact FG rows and
  // quantities its creation deducted. Deleting used to just drop the note, leaking every deduction
  // forever (bug-hunt dispatch-2). Restore-by-allocation (not by SKU) is exact: it never re-inflates
  // quantity a shortfall-creation didn't deduct, and it restores to the same location rows.
  // Notes created BEFORE allocation records existed simply have none — delete behaves as before.
  await prisma.$transaction(async (tx) => {
    const allocations = await tx.delivery_note_fg_allocations.findMany({
      where: { deliveryNoteId: id },
      select: { fgStockId: true, quantity: true },
    });
    for (const a of allocations) {
      await tx.finished_goods_stock.update({
        where: { id: a.fgStockId },
        data: { quantity: { increment: a.quantity }, lastUpdated: new Date() },
      });
    }
    // allocations cascade-delete with the note
    await tx.delivery_notes.delete({ where: { id } });
  });

  res.json({ message: 'Delivery note deleted successfully (finished-goods stock restored)' });
};

// ============================================
// Delivery Note Workflow
// ============================================

export const assignTransport = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }
  const {
    transporterName,
    transporterGstin,
    vehicleNumber,
    vehicleType,
    driverName,
    driverPhone,
    driverLicense,
    lrNumber,
    lrDate,
    freightCharges,
    freightPaidBy,
    expectedDeliveryDate,
    remarks,
  } = req.body;

  // Check if delivery note exists
  const note = await prisma.delivery_notes.findUnique({
    where: { id },
  });

  if (!note) {
    throw new NotFoundError('Delivery note', id);
  }

  // Check or create delivery_notes_ext
  let noteExt = await prisma.delivery_notes_ext.findUnique({
    where: { deliveryNoteId: id },
  });

  if (!noteExt) {
    noteExt = await prisma.delivery_notes_ext.create({
      data: {
        deliveryNoteId: id,
      },
    });
  }

  // Create or update transport
  await prisma.dispatch_transports.upsert({
    where: { deliveryNoteExtId: noteExt.id },
    update: {
      transporterName,
      transporterGstin,
      vehicleNumber,
      vehicleType,
      driverName,
      driverPhone,
      driverLicense,
      lrNumber,
      lrDate: lrDate ? new Date(lrDate) : null,
      freightCharges,
      freightPaidBy,
      expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
      remarks,
    },
    create: {
      deliveryNoteExtId: noteExt.id,
      transporterName,
      transporterGstin,
      vehicleNumber,
      vehicleType,
      driverName,
      driverPhone,
      driverLicense,
      lrNumber,
      lrDate: lrDate ? new Date(lrDate) : null,
      freightCharges,
      freightPaidBy,
      expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
      remarks,
      createdById: userId,
    },
  });

  // Update delivery note with vehicle info
  await prisma.delivery_notes.update({
    where: { id },
    data: {
      vehicleNumber,
      driverName,
      driverPhone,
    },
  });

  res.json({ message: 'Transport assigned successfully' });
};

export const dispatchDeliveryNote = async (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = await prisma.delivery_notes.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!existing) {
    throw new NotFoundError('Delivery note', id);
  }

  if (existing.status !== 'PENDING') {
    throw new ValidationError('Can only dispatch pending delivery notes');
  }

  // QC gate: check if customer requires GPT approval before dispatch
  const deliveryNote = await prisma.delivery_notes.findUnique({
    where: { id },
    include: {
      orders: { include: { customers: { select: { gptBlocksShipment: true } } } },
      delivery_note_items: { select: { styleId: true } },
    },
  });

  if (deliveryNote?.orders?.customers?.gptBlocksShipment) {
    const styleIds = [...new Set(deliveryNote.delivery_note_items.map((i) => i.styleId))];
    for (const styleId of styleIds) {
      const gptResult = await prisma.garment_physical_tests.findFirst({
        where: {
          styleId,
          overallTestResult: 'PASS',
        },
      });
      if (!gptResult) {
        throw new ValidationError(
          `GPT (Garment Physical Test) has not passed for style ${styleId}. This customer requires GPT approval before dispatch.`
        );
      }
    }
  }

  const note = await prisma.delivery_notes.update({
    where: { id },
    data: { status: 'IN_TRANSIT' },
    include: deliveryNoteIncludeOptions,
  });

  // Update transport dispatch date
  const noteExt = await prisma.delivery_notes_ext.findUnique({
    where: { deliveryNoteId: id },
  });

  if (noteExt) {
    await prisma.dispatch_transports.updateMany({
      where: { deliveryNoteExtId: noteExt.id },
      data: { dispatchDate: new Date() },
    });
  }

  res.json({ data: transformDeliveryNote(note) });
};

export const recordPOD = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }
  const {
    deliveryDate,
    deliveryTime,
    receivedBy,
    designation,
    customerSignOff,
    podDocumentUrl,
    deliveryStatus,
    shortageQty,
    rejectionReason,
    customerGrnNumber,
    customerGrnDate,
    remarks,
  } = req.body;

  const note = await prisma.delivery_notes.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!note) {
    throw new NotFoundError('Delivery note', id);
  }

  if (note.status !== 'IN_TRANSIT') {
    throw new ValidationError('Can only record POD for in-transit deliveries');
  }

  // Check or create delivery_notes_ext
  let noteExt = await prisma.delivery_notes_ext.findUnique({
    where: { deliveryNoteId: id },
  });

  if (!noteExt) {
    noteExt = await prisma.delivery_notes_ext.create({
      data: {
        deliveryNoteId: id,
      },
    });
  }

  // Create POD
  await prisma.dispatch_pods.create({
    data: {
      deliveryNoteExtId: noteExt.id,
      deliveryDate: new Date(deliveryDate),
      deliveryTime,
      receivedBy,
      designation,
      customerSignOff: customerSignOff || false,
      podDocumentUrl,
      deliveryStatus,
      shortageQty,
      rejectionReason,
      customerGrnNumber,
      customerGrnDate: customerGrnDate ? new Date(customerGrnDate) : null,
      remarks,
      createdById: userId,
    },
  });

  // Update delivery note status
  await prisma.delivery_notes.update({
    where: { id },
    data: { status: 'DELIVERED' },
  });

  res.json({ message: 'POD recorded successfully' });
};

// ============================================
// ASN CRUD
// ============================================

export const getAllASN = async (req: Request, res: Response) => {
  const { page = 1, limit = 20, search, status, orderId, fromDate, toDate } = req.query;

  const skip = (Number(page) - 1) * Number(limit);

  const where: Prisma.asn_applicationsWhereInput = {};

  if (search) {
    where.OR = [
      { asnNumber: { contains: String(search), mode: 'insensitive' } },
      { order: { orderNumber: { contains: String(search), mode: 'insensitive' } } },
    ];
  }

  if (status) {
    where.status = status as any;
  }

  if (orderId) {
    where.orderId = String(orderId);
  }

  if (fromDate || toDate) {
    where.applicationDate = {};
    if (fromDate) {
      where.applicationDate.gte = new Date(String(fromDate));
    }
    if (toDate) {
      where.applicationDate.lte = new Date(String(toDate));
    }
  }

  const [asns, total] = await Promise.all([
    prisma.asn_applications.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: asnIncludeOptions,
    }),
    prisma.asn_applications.count({ where }),
  ]);

  res.json({
    data: asns.map(transformASN),
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
  });
};

export const getASNById = async (req: Request, res: Response) => {
  const { id } = req.params;

  const asn = await prisma.asn_applications.findUnique({
    where: { id },
    include: asnIncludeOptions,
  });

  if (!asn) {
    throw new NotFoundError('ASN application', id);
  }

  res.json({ data: transformASN(asn) });
};

export const createASN = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }
  const { orderId, plannedDispatchQty, cartonsPlanned, requestedShipDate, remarks, skus } = req.body;

  // Get order to generate ASN number
  const order = await prisma.orders.findUnique({
    where: { id: orderId },
    select: { orderNumber: true },
  });

  if (!order) {
    throw new ValidationError('Order not found');
  }

  const asnNumber = await generateASNNumber(order.orderNumber);

  const asn = await prisma.asn_applications.create({
    data: {
      asnNumber,
      orderId,
      plannedDispatchQty,
      cartonsPlanned,
      requestedShipDate: new Date(requestedShipDate),
      status: 'PENDING',
      remarks,
      createdById: userId,
      skuBreakdown:
        skus?.length > 0
          ? {
              create: skus.map((sku: any) => ({
                colorId: sku.colorId,
                sizeId: sku.sizeId,
                plannedQty: sku.plannedQty,
              })),
            }
          : undefined,
    },
    include: asnIncludeOptions,
  });

  res.status(201).json({ data: transformASN(asn), message: 'ASN created successfully' });
};

export const applyASN = async (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = await prisma.asn_applications.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!existing) {
    throw new NotFoundError('ASN application', id);
  }

  if (existing.status !== 'PENDING') {
    throw new ValidationError('Can only apply pending ASN');
  }

  const asn = await prisma.asn_applications.update({
    where: { id },
    data: { status: 'APPLIED' },
    include: asnIncludeOptions,
  });

  res.json({ data: transformASN(asn) });
};

export const approveASN = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { appointmentDate, appointmentTime, buyerRefNumber, approvedQty } = req.body;

  const existing = await prisma.asn_applications.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!existing) {
    throw new NotFoundError('ASN application', id);
  }

  if (existing.status !== 'APPLIED') {
    throw new ValidationError('Can only approve applied ASN');
  }

  const asn = await prisma.asn_applications.update({
    where: { id },
    data: {
      status: 'APPROVED',
      appointmentDate: new Date(appointmentDate),
      appointmentTime,
      buyerRefNumber,
      approvedQty,
    },
    include: asnIncludeOptions,
  });

  res.json({ data: transformASN(asn) });
};

export const rejectASN = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { rejectionReason } = req.body;

  const existing = await prisma.asn_applications.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!existing) {
    throw new NotFoundError('ASN application', id);
  }

  if (existing.status !== 'APPLIED') {
    throw new ValidationError('Can only reject applied ASN');
  }

  const asn = await prisma.asn_applications.update({
    where: { id },
    data: {
      status: 'REJECTED',
      rejectionReason,
    },
    include: asnIncludeOptions,
  });

  res.json({ data: transformASN(asn) });
};

export const rescheduleASN = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { rescheduleDate } = req.body;

  const existing = await prisma.asn_applications.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!existing) {
    throw new NotFoundError('ASN application', id);
  }

  const asn = await prisma.asn_applications.update({
    where: { id },
    data: {
      status: 'RESCHEDULE',
      rescheduleDate: new Date(rescheduleDate),
    },
    include: asnIncludeOptions,
  });

  res.json({ data: transformASN(asn) });
};

export const deleteASN = async (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = await prisma.asn_applications.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!existing) {
    throw new NotFoundError('ASN application', id);
  }

  if (existing.status !== 'PENDING') {
    throw new ValidationError('Can only delete pending ASN');
  }

  await prisma.asn_applications.delete({
    where: { id },
  });

  res.json({ message: 'ASN application deleted successfully' });
};

// ============================================
// Summary Endpoints
// ============================================

export const getSummary = async (req: Request, res: Response) => {
  const [deliveryStatusCounts, asnStatusCounts, itemTotals] = await Promise.all([
    prisma.delivery_notes.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
    prisma.asn_applications.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
    prisma.delivery_note_items.aggregate({
      _sum: {
        quantity: true,
      },
    }),
  ]);

  res.json({
    data: {
      total: deliveryStatusCounts.reduce((sum, s) => sum + s._count.id, 0),
      pending: deliveryStatusCounts.find((s) => s.status === 'PENDING')?._count.id || 0,
      inTransit: deliveryStatusCounts.find((s) => s.status === 'IN_TRANSIT')?._count.id || 0,
      delivered: deliveryStatusCounts.find((s) => s.status === 'DELIVERED')?._count.id || 0,
      totalPieces: Number(itemTotals._sum?.quantity || 0),
      totalCartons: 0, // Would need to aggregate from carton_packings
      asnSummary: {
        pending: asnStatusCounts.find((s) => s.status === 'PENDING')?._count.id || 0,
        applied: asnStatusCounts.find((s) => s.status === 'APPLIED')?._count.id || 0,
        approved: asnStatusCounts.find((s) => s.status === 'APPROVED')?._count.id || 0,
        rejected: asnStatusCounts.find((s) => s.status === 'REJECTED')?._count.id || 0,
      },
    },
  });
};

export const getAvailableCartons = async (req: Request, res: Response) => {
  const { orderId } = req.query;

  const where: Prisma.carton_packingsWhereInput = {
    status: 'PACKED',
  };

  if (orderId) {
    where.workOrder = {
      orderId: String(orderId),
    };
  }

  const cartons = await prisma.carton_packings.findMany({
    where,
    include: {
      workOrder: {
        include: {
          styles: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({
    data: cartons.map((carton) => ({
      id: carton.id,
      cartonNumber: carton.cartonNumber,
      workOrderNumber: carton.workOrder?.workOrderNumber || '',
      styleName: carton.workOrder?.styles?.styleName || '',
      totalPieces: carton.pcsPerCarton,
      packedDate: carton.createdAt,
    })),
  });
};

export const getOrdersReadyForDispatch = async (req: Request, res: Response) => {
  // Get orders that have packed cartons
  const orders = await prisma.orders.findMany({
    where: {
      work_orders: {
        some: {
          carton_packings: {
            some: {
              status: 'PACKED',
            },
          },
        },
      },
    },
    include: {
      customers: true,
      work_orders: {
        include: {
          carton_packings: {
            select: {
              pcsPerCarton: true,
              status: true,
            },
          },
        },
      },
    },
  });

  res.json({
    data: orders.map((order) => {
      const allCartons = order.work_orders.flatMap((wo: any) => wo.carton_packings);
      const packedPieces = allCartons
        .filter((c: any) => c.status === 'PACKED')
        .reduce((sum: number, c: any) => sum + c.pcsPerCarton, 0);
      const dispatchedPieces = allCartons
        .filter((c: any) => c.status === 'DISPATCHED')
        .reduce((sum: number, c: any) => sum + c.pcsPerCarton, 0);

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customers?.name || '',
        totalPieces: allCartons.reduce((sum: number, c: any) => sum + c.pcsPerCarton, 0),
        packedPieces,
        dispatchedPieces,
      };
    }),
  });
};
