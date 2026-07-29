import { Request, Response } from 'express';
import logger, { logWarn } from '../utils/logger';
import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import crypto from 'crypto';
import { NotFoundError, ValidationError, UnauthorizedError } from '../errors';
import { generateAtomicMasterCode } from '../utils/atomicCodeGenerator';

// ============================================
// Helper Functions
// ============================================

const transformDeliveryNote = ({ users, ...note }: any) => ({
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
  // `users` is destructured OUT of the spread above so the raw relation is never returned; only the
  // curated createdBy is exposed. The include is also a safe-select (no password), so this is belt-and-braces.
  createdBy: users
    ? {
        id: users.id,
        name: `${users.firstName} ${users.lastName}`,
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
  // Include POD (full record: sign-off, shortage, rejection, customer GRN) and transport when the
  // extended include was used — these were stored but never returned (bug-hunt dispatch-13).
  ext: note.delivery_notes_ext
    ? {
        id: note.delivery_notes_ext.id,
        pod: note.delivery_notes_ext.pod ?? null,
        transport: note.delivery_notes_ext.transport ?? null,
        cartons: note.delivery_notes_ext.cartons ?? [],
      }
    : null,
});

const transformASN = ({ createdBy, ...asn }: any) => ({
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
  // `createdBy` destructured OUT of the spread so the raw user relation (incl. password hash) is never
  // returned; only the curated form is exposed. The include is also a safe-select — belt-and-braces.
  createdBy: createdBy
    ? {
        id: createdBy.id,
        name: `${createdBy.firstName} ${createdBy.lastName}`,
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

/** Highest numeric suffix among codes shaped `${prefix}-<digits>` (the dash keeps the scope exact). */
const maxNumericSuffix = (codes: Array<string | null>, prefix: string): number => {
  let max = 0;
  for (const code of codes) {
    if (!code || !code.startsWith(`${prefix}-`)) continue;
    const suffix = code.slice(prefix.length + 1);
    if (/^\d+$/.test(suffix)) max = Math.max(max, parseInt(suffix, 10));
  }
  return max;
};

/**
 * Lazily seed the atomic sequence for a per-scope compound prefix (e.g. `DN-20260726`,
 * `ASN-ORD...`). Static seeding (scripts/seed-code-sequences.ts) is impossible for prefixes
 * that embed a date/order scope, so before first use in a scope: if code_sequences has no row
 * for the prefix but rows already exist in the target table, initialize the sequence with their
 * max numeric suffix (idempotent GREATEST upsert, mirroring the seed script).
 */
const seedScopedSequenceIfMissing = async (prefix: string, findMaxSuffix: () => Promise<number>): Promise<void> => {
  const existing = await prisma.$queryRaw<Array<{ found: number }>>(
    Prisma.sql`SELECT 1 AS found FROM code_sequences WHERE prefix = ${prefix} LIMIT 1`
  );
  if (existing.length > 0) return;
  const max = await findMaxSuffix();
  if (max <= 0) return;
  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO code_sequences (id, prefix, "lastValue", "updatedAt")
      VALUES (gen_random_uuid(), ${prefix}, ${max}, NOW())
      ON CONFLICT (prefix) DO UPDATE SET
        "lastValue" = GREATEST(code_sequences."lastValue", ${max}),
        "updatedAt" = NOW()
    `
  );
};

/** True when err is a Prisma P2002 unique violation whose target involves the given column. */
const isUniqueViolationOn = (err: unknown, column: string): boolean => {
  const e = err as { code?: string; meta?: { target?: unknown } } | null;
  if (!e || e.code !== 'P2002') return false;
  const target = e.meta?.target;
  const text = Array.isArray(target) ? target.join(',') : String(target ?? '');
  return text.includes(column);
};

const generateDeliveryNumber = async (): Promise<string> => {
  const today = new Date();
  const prefix = `DN-${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}`;
  await seedScopedSequenceIfMissing(prefix, async () => {
    const rows = await prisma.delivery_notes.findMany({
      where: { deliveryNumber: { startsWith: `${prefix}-` } },
      select: { deliveryNumber: true },
    });
    return maxNumericSuffix(
      rows.map((r) => r.deliveryNumber),
      prefix
    );
  });
  // Atomic per-day sequence (race-prone count() replaced); visible format preserved: DN-YYYYMMDD-NNNN
  return generateAtomicMasterCode(prefix, 4);
};

const generateASNNumber = async (orderNumber: string): Promise<string> => {
  const prefix = `ASN-${orderNumber}`;
  await seedScopedSequenceIfMissing(prefix, async () => {
    const rows = await prisma.asn_applications.findMany({
      where: { asnNumber: { startsWith: `${prefix}-` } },
      select: { asnNumber: true },
    });
    return maxNumericSuffix(
      rows.map((r) => r.asnNumber),
      prefix
    );
  });
  // Atomic per-order sequence; visible format preserved: ASN-{orderNumber}-NNN
  return generateAtomicMasterCode(prefix, 3);
};

// Include options
const deliveryNoteIncludeOptions = {
  orders: true,
  customers: true,
  // Safe-select only — NEVER `users: true` (that returns the password hash, which
  // transformDeliveryNote would then spread into the API response). Match the safe-select pattern.
  users: { select: { id: true, firstName: true, lastName: true } },
  delivery_note_items: {
    include: {
      styles: true,
      color_options: true,
      size_options: true,
    },
  },
};

// Extended include options with POD + transport + cartons for delivery note detail
const deliveryNoteExtendedIncludeOptions = {
  ...deliveryNoteIncludeOptions,
  delivery_notes_ext: {
    include: {
      pod: true,
      transport: true,
      cartons: true,
    },
  },
};

const asnIncludeOptions = {
  order: {
    include: {
      customers: true,
    },
  },
  // Safe-select only — NEVER `createdBy: true` (returns the password hash, which transformASN
  // would spread into the response).
  createdBy: { select: { id: true, firstName: true, lastName: true } },
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
      // Extended include (POD + cartons) so list rows carry carton counts and the customer GRN
      include: deliveryNoteExtendedIncludeOptions,
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

  // Extended include so POD/transport details actually reach the client (bug-hunt dispatch-13)
  const note = await prisma.delivery_notes.findUnique({
    where: { id },
    include: deliveryNoteExtendedIncludeOptions,
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
  const { orderId, customerId, deliveryDate, remarks, items, cartonIds } = req.body;

  // Note creation + FG deductions run in ONE transaction with guarded atomic decrements (bug-hunt
  // dispatch-1). The old code was off-transaction read-modify-write: concurrent notes lost deductions,
  // a SKU split across locations was skipped entirely, and a missing colorId deducted ANY color's stock
  // (finished_goods_stock.colorId is required, so `colorId: undefined` dropped the filter).
  // Shortfalls no longer vanish silently: what exists is deducted, the gap is flagged in the response.
  type FgShortfall = {
    styleId: string;
    colorId: string | null;
    sizeId: string;
    requested: number;
    deducted: number;
  };

  // Records of exactly which FG rows this note deducts (and how much) — written with the note so a
  // later delete can restore stock precisely (bug-hunt dispatch-2).
  type FgAllocation = { fgStockId: string; quantity: number };

  const attemptCreateNote = (deliveryNumber: string, fgShortfalls: FgShortfall[], fgAllocations: FgAllocation[]) =>
    prisma.$transaction(
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

            // Net out goods the customer did NOT keep (bug-hunt dispatch-12): REJECTED PODs return the
            // whole note; PARTIAL PODs return shortageQty. Without this, returned goods permanently ate
            // the order's dispatch allowance and the redelivery was blocked. Header-level shortage has no
            // per-SKU detail, so netting applies to the order-total backstop only — the per-SKU caps above
            // stay conservative (may block a redelivery of a heavily-shorted SKU early; safe direction).
            const podNotes = await tx.delivery_notes.findMany({
              where: { orderId },
              select: {
                delivery_notes_ext: { select: { pod: { select: { deliveryStatus: true, shortageQty: true } } } },
                delivery_note_items: { select: { quantity: true } },
              },
            });
            let returnedQty = 0;
            for (const n of podNotes) {
              const pod = n.delivery_notes_ext?.pod;
              if (!pod) continue;
              if (pod.deliveryStatus === 'REJECTED') {
                returnedQty += n.delivery_note_items.reduce((s, i) => s + i.quantity, 0);
              } else {
                returnedQty += Number(pod.shortageQty || 0);
              }
            }

            // Order-total backstop (also covers legacy orders without SKU breakups)
            const totalOrdered = order.order_items.reduce((sum, oi) => sum + oi.totalQuantity, 0);
            const totalAlreadyDispatched =
              Array.from(dispatchedMap.values()).reduce((sum, qty) => sum + qty, 0) - returnedQty;
            const totalNewDispatch = items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
            if (totalAlreadyDispatched + totalNewDispatch > totalOrdered) {
              throw new ValidationError(
                `Dispatch quantity (${totalNewDispatch}) would exceed order limit. ` +
                  `Ordered: ${totalOrdered}, already dispatched (net of returns): ${totalAlreadyDispatched}, ` +
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

        // Link the packed cartons this note covers (dispatch_cartons rows) so dispatching the note can
        // flip them to DISPATCHED — previously nothing ever linked or dispatched cartons, so they stayed
        // "available" forever and dispatchedPieces was always 0 (bug-hunt dispatch-9).
        if (cartonIds?.length > 0) {
          const uniqueCartonIds: string[] = [...new Set<string>(cartonIds)];
          const cartons = await tx.carton_packings.findMany({
            where: { id: { in: uniqueCartonIds } },
            select: { id: true, cartonNumber: true, status: true, dispatchItems: { select: { id: true } } },
          });
          if (cartons.length !== uniqueCartonIds.length) {
            throw new ValidationError('One or more selected cartons do not exist');
          }
          const unavailable = cartons.filter((c) => c.status !== 'PACKED' || c.dispatchItems.length > 0);
          if (unavailable.length > 0) {
            throw new ValidationError(
              `Carton(s) not available for dispatch (not PACKED or already on a delivery note): ` +
                unavailable.map((c) => c.cartonNumber).join(', ')
            );
          }
          const ext = await tx.delivery_notes_ext.create({
            data: { deliveryNoteId: created.id, totalCartons: uniqueCartonIds.length },
          });
          await tx.dispatch_cartons.createMany({
            data: uniqueCartonIds.map((cartonId) => ({ deliveryNoteExtId: ext.id, cartonId })),
          });
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

  // deliveryNumber is UNIQUE — if a pre-atomic row in today's scope still collides with the freshly
  // seeded sequence, retry the whole attempt with the next atomic number. Arrays are re-created per
  // attempt so a retried transaction can never double-count shortfalls/allocations.
  const createNoteWithFreshNumber = async () => {
    for (let attempt = 1; ; attempt++) {
      const deliveryNumber = await generateDeliveryNumber();
      const fgShortfalls: FgShortfall[] = [];
      const fgAllocations: FgAllocation[] = [];
      try {
        const note = await attemptCreateNote(deliveryNumber, fgShortfalls, fgAllocations);
        return { note, deliveryNumber, fgShortfalls };
      } catch (err) {
        if (isUniqueViolationOn(err, 'deliveryNumber') && attempt < 3) continue;
        throw err;
      }
    }
  };
  const { note, deliveryNumber, fgShortfalls } = await createNoteWithFreshNumber();

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
      // allow-swallow — pure timeline SHIPPED production_tracking entries; must not fail the already-created delivery note
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

  // ext create + transport upsert + note update in ONE transaction — a failure between the separate
  // writes used to leave the ext/transport/note trio inconsistent (bug-hunt dispatch-11).
  await prisma.$transaction(async (tx) => {
    // Check or create delivery_notes_ext
    let noteExt = await tx.delivery_notes_ext.findUnique({
      where: { deliveryNoteId: id },
    });

    if (!noteExt) {
      noteExt = await tx.delivery_notes_ext.create({
        data: {
          deliveryNoteId: id,
        },
      });
    }

    // Create or update transport
    await tx.dispatch_transports.upsert({
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
    await tx.delivery_notes.update({
      where: { id },
      data: {
        vehicleNumber,
        driverName,
        driverPhone,
      },
    });
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

  // Status flip + transport dispatch date + carton dispatch in ONE transaction (bug-hunt dispatch-11);
  // the guarded updateMany also closes the race where two concurrent dispatch calls both passed the
  // pre-check above.
  const note = await prisma.$transaction(async (tx) => {
    const flipped = await tx.delivery_notes.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'IN_TRANSIT' },
    });
    if (flipped.count === 0) {
      throw new ValidationError('Can only dispatch pending delivery notes');
    }

    const noteExt = await tx.delivery_notes_ext.findUnique({
      where: { deliveryNoteId: id },
      include: { cartons: { select: { cartonId: true } } },
    });

    if (noteExt) {
      // Update transport dispatch date
      await tx.dispatch_transports.updateMany({
        where: { deliveryNoteExtId: noteExt.id },
        data: { dispatchDate: new Date() },
      });

      // Mark the note's linked cartons DISPATCHED so they leave the available pool and the
      // orders-ready rollup counts them (bug-hunt dispatch-9).
      if (noteExt.cartons.length > 0) {
        await tx.carton_packings.updateMany({
          where: { id: { in: noteExt.cartons.map((c) => c.cartonId) } },
          data: { status: 'DISPATCHED' },
        });
      }
    }

    return tx.delivery_notes.findUnique({
      where: { id },
      include: deliveryNoteIncludeOptions,
    });
  });

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

  // POD + FG restore + note status in ONE transaction (bug-hunt dispatch-12: a PARTIAL/REJECTED POD
  // used to change nothing — rejected/short goods stayed deducted from finished-goods stock forever and
  // kept counting against the order's dispatch cap).
  const restoredQty = await prisma.$transaction(async (tx) => {
    let noteExt = await tx.delivery_notes_ext.findUnique({
      where: { deliveryNoteId: id },
    });
    if (!noteExt) {
      noteExt = await tx.delivery_notes_ext.create({ data: { deliveryNoteId: id } });
    }

    // Upsert (not create) on the unique deliveryNoteExtId so a retry after a previous partial failure
    // cannot wedge the note behind a permanent P2002 (bug-hunt dispatch-11).
    const podData = {
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
    };
    await tx.dispatch_pods.upsert({
      where: { deliveryNoteExtId: noteExt.id },
      update: podData,
      create: {
        deliveryNoteExtId: noteExt.id,
        ...podData,
        createdById: userId,
      },
    });

    // Restore finished-goods stock for goods that did NOT stay with the customer: everything for a
    // REJECTED delivery, shortageQty for a PARTIAL one. Restored against this note's own allocation
    // records (same rows the creation deducted), and the allocation quantities are reduced so a later
    // note-delete cannot double-restore. Header-level shortage has no per-SKU detail, so restoration
    // is greedy across allocations — exact in aggregate.
    let restored = 0;
    const wantRestore =
      deliveryStatus === 'REJECTED'
        ? Number.MAX_SAFE_INTEGER
        : deliveryStatus === 'PARTIAL'
          ? Number(shortageQty || 0)
          : 0;
    if (wantRestore > 0) {
      const allocations = await tx.delivery_note_fg_allocations.findMany({
        where: { deliveryNoteId: id, quantity: { gt: 0 } },
        orderBy: { createdAt: 'desc' },
      });
      let remaining = wantRestore;
      for (const a of allocations) {
        if (remaining <= 0) break;
        const restore = Math.min(a.quantity, remaining);
        await tx.finished_goods_stock.update({
          where: { id: a.fgStockId },
          data: { quantity: { increment: restore }, lastUpdated: new Date() },
        });
        await tx.delivery_note_fg_allocations.update({
          where: { id: a.id },
          data: { quantity: { decrement: restore } },
        });
        remaining -= restore;
        restored += restore;
      }
    }

    // Note status: DELIVERED marks the end of the journey; the POD row carries the PARTIAL/REJECTED
    // truth, and the dispatch-cap computation nets it (see createDeliveryNote).
    await tx.delivery_notes.update({
      where: { id },
      data: { status: 'DELIVERED' },
    });

    return restored;
  });

  res.json({
    message:
      restoredQty > 0
        ? `POD recorded — ${restoredQty} piece(s) restored to finished-goods stock (${deliveryStatus})`
        : 'POD recorded successfully',
  });
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
    // A carton already linked to a delivery note (even a PENDING one) is spoken for — without this,
    // dispatched/reserved cartons stayed "available" forever (bug-hunt dispatch-9).
    dispatchItems: { none: {} },
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
