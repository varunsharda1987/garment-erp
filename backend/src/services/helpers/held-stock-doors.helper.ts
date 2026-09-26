/**
 * The doors for goods WE own that a processor holds (direct-to-processor plan, Phase 4).
 *
 * 4b — Bring to store: greige, lace or ready fabric lying at a processor (delivered straight there, or
 * parked by a Stock-Out) comes back into one of our stores. ONE inward challan from the processor —
 * the job-work return (CGST Rule 45) that ITC-04 Table B lists against the challan the goods went out
 * under — books a new lot in the store, takes the metres off the held lot, and moves the ledger. The
 * covering challan's status follows (rule 7). Until 2026-09-26 the only door (Stock In → Processor
 * Return) took the metres off a Stock-Out lot, booked nothing into any store, and filed no challan.
 *
 * The stock tables are written by their own services (greige-stock / laceStock / fabric-stock, which
 * keep stock_levels in sync); this helper owns the order of events and the challan.
 */
import type { Prisma } from '@prisma/client';
import { Unit } from '@prisma/client';
import prisma from '../../config/database';
import { BusinessError } from '../../errors';
import { createChallan, type CreateChallanItemInput } from '../challan.service';
import greigeStockService from '../greige-stock.service';
import fabricStockService from '../fabric-stock.service';
import { bringHeldLaceLotToStore } from '../laceStock.service';
import {
  challanDestination,
  greigeHolderId,
  LOT_WAREHOUSE_SELECT,
  unitLotHolderId,
  coveringChallanWhere,
} from './lot-location.helper';
import { recomputeCoveringChallansForLots } from './jwo-challan-lifecycle.helper';
import { multiplyCurrency, roundToCent, toNumber } from '../../utils/currency';
import { formatDate, toDateInputValue } from '../../utils/date';
import { qtyExceeds, snapToLimit } from '../../utils/quantity';

type Tx = Prisma.TransactionClient;

export type HeldLotType = 'GREIGE' | 'LACE' | 'FABRIC';

export const RETURN_FROM_JOB_WORKER_REASON =
  'Inputs returned by the job worker to the principal (CGST Rule 45) — not a supply';

export interface BringToStoreLine {
  lotType: HeldLotType;
  lotId: string;
  /** ACTUAL metres (the stock figure) */
  quantity: number;
}

export interface BringToStoreInput {
  lines: BringToStoreLine[];
  storeWarehouseId: string;
  /** The day the goods reached our store; defaults to today */
  broughtOn?: Date;
  userId: string;
  remarks?: string | null;
}

export interface BringToStoreResult {
  challanId: string;
  challanNumber: string;
  processorName: string;
  lines: Array<BringToStoreLine & { storeLotId: string; remainingAtProcessor: number }>;
}

interface PlacedLot {
  line: BringToStoreLine;
  qty: number;
  holderId: string;
  holderName: string;
  code: string;
  rate: number | null;
  receivedDate: Date | null;
  coveringChallanNumber: string | null;
}

/** Load a held lot, check it is at a processor and how much of it is free to move. */
async function placeHeldLot(tx: Tx, line: BringToStoreLine): Promise<PlacedLot> {
  const fail = (message: string, code: string) => new BusinessError(message, { code, lotId: line.lotId });
  if (line.lotType === 'GREIGE') {
    const lot = await tx.greige_stock.findUnique({
      where: { id: line.lotId },
      include: {
        greige: { select: { greigeCode: true } },
        processor: { select: { name: true } },
        warehouse: { select: LOT_WAREHOUSE_SELECT },
        sourceChallan: { select: { challanNumber: true } },
      },
    });
    if (!lot) throw fail('That greige lot no longer exists.', 'LOT_NOT_FOUND');
    const holderId = greigeHolderId(lot);
    if (!holderId) throw fail(`${lot.greige.greigeCode} is in our store, not at a processor.`, 'LOT_NOT_HELD');
    // Greige reservations are claims on metres still on the lot (convention B) — they stay put
    const reserved = Number(lot.quantityReserved ?? 0);
    const free = Math.max(0, Number(lot.quantityAvailable) - reserved);
    const holderName = lot.processor?.name ?? lot.warehouse?.supplier?.name ?? 'the processor';
    if (qtyExceeds(line.quantity, free)) {
      throw fail(
        `Only ${free} m of ${lot.greige.greigeCode} is free at ${holderName}` +
          (reserved > 0 ? ` (${reserved} m is reserved for a requirement)` : '') +
          '.',
        'QTY_EXCEEDS_HELD'
      );
    }
    return {
      line,
      qty: snapToLimit(line.quantity, free),
      holderId,
      holderName,
      code: lot.greige.greigeCode,
      rate:
        lot.purchaseCost != null
          ? Number(lot.purchaseCost)
          : lot.weightedAvgCost != null
            ? Number(lot.weightedAvgCost)
            : null,
      receivedDate: lot.receivedDate,
      coveringChallanNumber: lot.sourceChallan?.challanNumber ?? null,
    };
  }
  const lot =
    line.lotType === 'LACE'
      ? await tx.lace_stock.findUnique({
          where: { id: line.lotId },
          include: { laceMaster: { select: { laceCode: true } }, warehouse: { select: LOT_WAREHOUSE_SELECT } },
        })
      : await tx.fabric_stock.findUnique({
          where: { id: line.lotId },
          include: { fabricMaster: { select: { fabricCode: true } }, warehouse: { select: LOT_WAREHOUSE_SELECT } },
        });
  if (!lot) throw fail('That lot no longer exists.', 'LOT_NOT_FOUND');
  const code =
    'laceMaster' in lot
      ? lot.laceMaster.laceCode
      : ((lot as { fabricMaster?: { fabricCode: string } | null }).fabricMaster?.fabricCode ?? 'Fabric');
  const holderId = unitLotHolderId(lot);
  if (!holderId) throw fail(`${code} is in our store, not at a processor.`, 'LOT_NOT_HELD');
  const free = Number(lot.quantityAvailable);
  if (qtyExceeds(line.quantity, free)) {
    throw fail(
      `Only ${free} m of ${code} is at ${lot.warehouse?.supplier?.name ?? 'the processor'}.`,
      'QTY_EXCEEDS_HELD'
    );
  }
  const covering = await tx.challan_items.findFirst({
    where: {
      ...(line.lotType === 'LACE' ? { laceStockId: lot.id } : { fabricStockId: lot.id }),
      challan: coveringChallanWhere(),
    },
    select: { challan: { select: { challanNumber: true } } },
  });
  return {
    line,
    qty: snapToLimit(line.quantity, free),
    holderId,
    holderName: lot.warehouse?.supplier?.name ?? lot.warehouse?.warehouseName ?? 'the processor',
    code,
    rate: lot.purchaseCost != null ? Number(lot.purchaseCost) : Number(lot.weightedAvgCost),
    receivedDate: lot.receivedDate,
    coveringChallanNumber: covering?.challan.challanNumber ?? null,
  };
}

/**
 * Bring goods held at ONE processor back into one of our stores, on one inward challan.
 */
export async function bringHeldStockToStore(input: BringToStoreInput): Promise<BringToStoreResult> {
  if (input.lines.length === 0) throw new BusinessError('Pick at least one lot to bring back.', { code: 'NO_LINES' });
  const broughtOn = input.broughtOn ?? new Date();
  if (toDateInputValue(broughtOn) > toDateInputValue(new Date())) {
    throw new BusinessError('The date the goods reached the store cannot be in the future.', {
      code: 'DATE_IN_FUTURE',
    });
  }

  return prisma.$transaction(
    async (tx) => {
      const store = await tx.warehouses.findUnique({
        where: { id: input.storeWarehouseId },
        select: { id: true, warehouseName: true, warehouseType: true, isActive: true },
      });
      if (!store || !store.isActive) {
        throw new BusinessError('Pick an active store to bring the goods into.', { code: 'STORE_INACTIVE' });
      }
      if (store.warehouseType === 'JOB_WORK') {
        throw new BusinessError(
          `${store.warehouseName} is a processor's unit, not our store — to send goods from one processor to another, use Move to another processor.`,
          { code: 'NOT_A_STORE' }
        );
      }

      const placed: PlacedLot[] = [];
      for (const line of input.lines) placed.push(await placeHeldLot(tx, line));
      const holders = new Set(placed.map((p) => p.holderId));
      if (holders.size > 1) {
        throw new BusinessError(
          'One challan comes from one processor — bring each processor’s goods back separately.',
          {
            code: 'MIXED_PROCESSORS',
          }
        );
      }
      for (const p of placed) {
        if (p.receivedDate && toDateInputValue(broughtOn) < toDateInputValue(p.receivedDate)) {
          throw new BusinessError(
            `${p.code} reached ${p.holderName} on ${formatDate(p.receivedDate)} — it cannot be back before that.`,
            { code: 'DATE_BEFORE_ARRIVAL' }
          );
        }
      }
      const { holderId, holderName } = placed[0];

      const items: CreateChallanItemInput[] = placed.map((p) => ({
        itemType: p.line.lotType,
        // The HELD lot: ITC-04 Table B finds the challan the goods went out under through it
        greigeStockId: p.line.lotType === 'GREIGE' ? p.line.lotId : undefined,
        laceStockId: p.line.lotType === 'LACE' ? p.line.lotId : undefined,
        fabricStockId: p.line.lotType === 'FABRIC' ? p.line.lotId : undefined,
        description:
          `${p.code} returned by ${holderName}` +
          (p.coveringChallanNumber ? ` (went out under ${p.coveringChallanNumber})` : ''),
        quantity: p.qty,
        unit: Unit.METER,
        rate: p.rate ?? undefined,
        declaredValue: p.rate != null ? toNumber(roundToCent(multiplyCurrency(p.qty, p.rate))) : undefined,
      }));
      const covering = [...new Set(placed.map((p) => p.coveringChallanNumber).filter((n): n is string => !!n))];
      const challan = await createChallan(
        {
          challanType: 'INWARD',
          challanDate: broughtOn,
          fromType: 'VENDOR',
          fromId: holderId,
          fromName: holderName,
          ...(await challanDestination(tx, [store.id])),
          issuedById: input.userId,
          status: 'RECEIVED',
          receivedDate: broughtOn,
          receivedById: input.userId,
          reasonForTransport: RETURN_FROM_JOB_WORKER_REASON,
          unit: Unit.METER,
          remarks:
            `Brought back to ${store.warehouseName} from ${holderName}` +
            (covering.length ? `; sent under ${covering.join(', ')}` : '') +
            (input.remarks ? `. ${input.remarks}` : ''),
          items,
        },
        tx
      );

      const moved: BringToStoreResult['lines'] = [];
      for (const p of placed) {
        const args = {
          stockId: p.line.lotId,
          quantity: p.qty,
          storeWarehouseId: store.id,
          inwardChallanId: challan.id,
          inwardChallanNumber: challan.challanNumber,
          broughtOn,
          userId: input.userId,
        };
        const result =
          p.line.lotType === 'GREIGE'
            ? await greigeStockService.bringHeldLotToStore(tx, args)
            : p.line.lotType === 'LACE'
              ? await bringHeldLaceLotToStore(tx, args)
              : await fabricStockService.bringHeldLotToStore(tx, args);
        moved.push({ ...p.line, quantity: p.qty, ...result });
      }

      await recomputeCoveringChallansForLots(
        tx,
        {
          greigeIds: placed.filter((p) => p.line.lotType === 'GREIGE').map((p) => p.line.lotId),
          laceIds: placed.filter((p) => p.line.lotType === 'LACE').map((p) => p.line.lotId),
          fabricIds: placed.filter((p) => p.line.lotType === 'FABRIC').map((p) => p.line.lotId),
        },
        broughtOn
      );

      return { challanId: challan.id, challanNumber: challan.challanNumber, processorName: holderName, lines: moved };
    },
    { timeout: 20000, maxWait: 5000 }
  );
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// What a processor holds for us (the Bring to store picker)
// ─────────────────────────────────────────────────────────────────────────────────────────────

export interface HeldLotRow {
  lotType: HeldLotType;
  id: string;
  code: string;
  name: string;
  /** Composition / width / shade, when the master has it */
  detail: string | null;
  /** Free to bring back (greige: less what a requirement has reserved) */
  quantityAvailable: number;
  receivedDate: Date | null;
  coveringChallanNumber: string | null;
  processorId: string;
  processorName: string;
}

/** Every greige, lace and ready-fabric lot a processor holds for us (all processors when none named). */
export async function listHeldLots(processorId?: string): Promise<HeldLotRow[]> {
  const unitWhere = { warehouseType: 'JOB_WORK' as const, ...(processorId ? { supplierId: processorId } : {}) };
  const [greige, lace, fabric] = await Promise.all([
    prisma.greige_stock.findMany({
      where: {
        status: 'AVAILABLE',
        quantityAvailable: { gt: 0 },
        OR: processorId
          ? [{ processorId }, { processorId: null, warehouse: unitWhere }]
          : [{ processorId: { not: null } }, { warehouse: unitWhere }],
      },
      include: {
        greige: { select: { greigeCode: true, greigeName: true, composition: true } },
        processor: { select: { name: true } },
        warehouse: { select: LOT_WAREHOUSE_SELECT },
        sourceChallan: { select: { challanNumber: true } },
      },
      orderBy: { receivedDate: 'asc' },
    }),
    prisma.lace_stock.findMany({
      where: { status: 'AVAILABLE', quantityAvailable: { gt: 0 }, warehouse: unitWhere },
      include: {
        laceMaster: { select: { laceCode: true, laceName: true, color: true } },
        warehouse: { select: LOT_WAREHOUSE_SELECT },
      },
      orderBy: { receivedDate: 'asc' },
    }),
    prisma.fabric_stock.findMany({
      where: { status: 'AVAILABLE', quantityAvailable: { gt: 0 }, warehouse: unitWhere },
      include: {
        fabricMaster: { select: { fabricCode: true, fabricName: true } },
        warehouse: { select: LOT_WAREHOUSE_SELECT },
      },
      orderBy: { receivedDate: 'asc' },
    }),
  ]);
  const otherIds = [...lace.map((l) => l.id), ...fabric.map((f) => f.id)];
  const coveringLines = otherIds.length
    ? await prisma.challan_items.findMany({
        where: {
          OR: [{ laceStockId: { in: otherIds } }, { fabricStockId: { in: otherIds } }],
          challan: coveringChallanWhere(),
        },
        select: { laceStockId: true, fabricStockId: true, challan: { select: { challanNumber: true } } },
      })
    : [];
  const coveringOf = new Map(coveringLines.map((l) => [(l.laceStockId ?? l.fabricStockId)!, l.challan.challanNumber]));

  const rows: HeldLotRow[] = [];
  for (const g of greige) {
    const holder = greigeHolderId(g);
    if (!holder || (processorId && holder !== processorId)) continue;
    rows.push({
      lotType: 'GREIGE',
      id: g.id,
      code: g.greige.greigeCode,
      name: g.greige.greigeName,
      detail:
        [g.greige.composition, g.greigeWidth != null ? `${Number(g.greigeWidth)}"` : null]
          .filter(Boolean)
          .join(' · ') || null,
      quantityAvailable: Math.max(0, Number(g.quantityAvailable) - Number(g.quantityReserved ?? 0)),
      receivedDate: g.receivedDate,
      coveringChallanNumber: g.sourceChallan?.challanNumber ?? null,
      processorId: holder,
      processorName: g.processor?.name ?? g.warehouse?.supplier?.name ?? 'Processor',
    });
  }
  for (const l of lace) {
    const holder = unitLotHolderId(l);
    if (!holder) continue;
    rows.push({
      lotType: 'LACE',
      id: l.id,
      code: l.laceMaster.laceCode,
      name: l.laceMaster.laceName,
      detail: l.laceMaster.color ?? null,
      quantityAvailable: Number(l.quantityAvailable),
      receivedDate: l.receivedDate,
      coveringChallanNumber: coveringOf.get(l.id) ?? null,
      processorId: holder,
      processorName: l.warehouse?.supplier?.name ?? 'Processor',
    });
  }
  for (const f of fabric) {
    const holder = unitLotHolderId(f);
    if (!holder) continue;
    rows.push({
      lotType: 'FABRIC',
      id: f.id,
      code: f.fabricMaster?.fabricCode ?? 'Fabric',
      name: f.fabricMaster?.fabricName ?? 'Ready fabric',
      detail: f.cutableWidth != null ? `${Number(f.cutableWidth)}" cutable` : null,
      quantityAvailable: Number(f.quantityAvailable),
      receivedDate: f.receivedDate,
      coveringChallanNumber: coveringOf.get(f.id) ?? null,
      processorId: holder,
      processorName: f.warehouse?.supplier?.name ?? 'Processor',
    });
  }
  return rows.filter((r) => r.quantityAvailable > 0);
}

/** The processors holding anything for us, with how much — the Bring to store processor picker. */
export async function listProcessorsHoldingStock() {
  const rows = await listHeldLots();
  const byProcessor = new Map<string, { processorName: string; totalQuantity: number; stockEntries: number }>();
  for (const r of rows) {
    const cur = byProcessor.get(r.processorId) ?? { processorName: r.processorName, totalQuantity: 0, stockEntries: 0 };
    cur.totalQuantity = Math.round((cur.totalQuantity + r.quantityAvailable) * 1000) / 1000;
    cur.stockEntries += 1;
    byProcessor.set(r.processorId, cur);
  }
  const ids = [...byProcessor.keys()];
  const [suppliers, units] = await Promise.all([
    prisma.suppliers.findMany({ where: { id: { in: ids } }, select: { id: true, code: true } }),
    prisma.warehouses.findMany({
      where: { supplierId: { in: ids }, warehouseType: 'JOB_WORK' },
      select: { supplierId: true, warehouseName: true },
    }),
  ]);
  return ids.map((id) => ({
    processorId: id,
    processorName: byProcessor.get(id)!.processorName,
    processorCode: suppliers.find((s) => s.id === id)?.code ?? '',
    warehouseName: units.find((u) => u.supplierId === id)?.warehouseName ?? null,
    totalQuantity: byProcessor.get(id)!.totalQuantity,
    stockEntries: byProcessor.get(id)!.stockEntries,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// 4c — Move to another processor (A → B)
// ─────────────────────────────────────────────────────────────────────────────────────────────

export const MOVE_BETWEEN_JOB_WORKERS_REASON =
  'Inputs sent from one job worker to another on our account (CGST Rule 45) — not a supply';

export interface MoveHeldStockInput {
  lines: BringToStoreLine[];
  /** The receiving processor's "… - Processing Unit" */
  toUnitWarehouseId: string;
  /** The day the goods left A for B; defaults to today */
  movedOn?: Date;
  userId: string;
  vehicleNumber?: string | null;
  remarks?: string | null;
}

export interface MoveHeldStockResult {
  challanId: string;
  challanNumber: string;
  fromName: string;
  toName: string;
  lines: Array<BringToStoreLine & { newLotId: string; remainingAtProcessor: number }>;
}

/**
 * Move goods we own from the processor holding them (A) to another processor (B), on ONE outward
 * challan from A to B (Rule 45 allows a job worker to send inputs on to another). The goods become held
 * at B — a new lot in B's unit that keeps the day they first reached a processor, so the one-year clock
 * does not restart — and the challan is B's covering challan. A's covering challan follows (rule 7).
 * Issuing A's lot on B's job is still refused: move it first.
 */
export async function moveHeldStockToProcessor(input: MoveHeldStockInput): Promise<MoveHeldStockResult> {
  if (input.lines.length === 0) throw new BusinessError('Pick at least one lot to move.', { code: 'NO_LINES' });
  const movedOn = input.movedOn ?? new Date();
  if (toDateInputValue(movedOn) > toDateInputValue(new Date())) {
    throw new BusinessError('The move date cannot be in the future.', { code: 'DATE_IN_FUTURE' });
  }

  return prisma.$transaction(
    async (tx) => {
      const unit = await tx.warehouses.findUnique({
        where: { id: input.toUnitWarehouseId },
        select: {
          id: true,
          warehouseName: true,
          warehouseType: true,
          isActive: true,
          supplierId: true,
          supplier: { select: { name: true } },
        },
      });
      if (!unit || !unit.isActive || unit.warehouseType !== 'JOB_WORK' || !unit.supplierId) {
        throw new BusinessError('Pick the receiving processor\'s unit (an active "… - Processing Unit").', {
          code: 'NOT_A_PROCESSOR_UNIT',
        });
      }
      const toProcessorId = unit.supplierId;
      const toName = unit.supplier?.name ?? unit.warehouseName;

      const placed: PlacedLot[] = [];
      for (const line of input.lines) placed.push(await placeHeldLot(tx, line));
      if (new Set(placed.map((p) => p.holderId)).size > 1) {
        throw new BusinessError("One challan comes from one processor — move each processor's goods separately.", {
          code: 'MIXED_PROCESSORS',
        });
      }
      const { holderId: fromProcessorId, holderName: fromName } = placed[0];
      if (fromProcessorId === toProcessorId) {
        throw new BusinessError(`These goods are already at ${toName}.`, { code: 'SAME_PROCESSOR' });
      }
      for (const p of placed) {
        if (p.receivedDate && toDateInputValue(movedOn) < toDateInputValue(p.receivedDate)) {
          throw new BusinessError(
            `${p.code} reached ${fromName} on ${formatDate(p.receivedDate)} — it cannot have left before that.`,
            { code: 'DATE_BEFORE_ARRIVAL' }
          );
        }
      }
      const arrivals = placed.map((p) => p.receivedDate).filter((d): d is Date => !!d);
      const firstArrival = arrivals.length ? new Date(Math.min(...arrivals.map((d) => d.getTime()))) : movedOn;
      const returnBy = new Date(firstArrival);
      returnBy.setFullYear(returnBy.getFullYear() + 1);
      const covering = [...new Set(placed.map((p) => p.coveringChallanNumber).filter((n): n is string => !!n))];

      const items: CreateChallanItemInput[] = placed.map((p) => ({
        itemType: p.line.lotType,
        greigeStockId: p.line.lotType === 'GREIGE' ? p.line.lotId : undefined,
        laceStockId: p.line.lotType === 'LACE' ? p.line.lotId : undefined,
        fabricStockId: p.line.lotType === 'FABRIC' ? p.line.lotId : undefined,
        description: `${p.code} moved from ${fromName} to ${toName}`,
        quantity: p.qty,
        unit: Unit.METER,
        rate: p.rate ?? undefined,
        declaredValue: p.rate != null ? toNumber(roundToCent(multiplyCurrency(p.qty, p.rate))) : undefined,
      }));
      const challan = await createChallan(
        {
          challanType: 'OUTWARD',
          challanDate: movedOn,
          fromType: 'VENDOR',
          fromId: fromProcessorId,
          fromName,
          toType: 'VENDOR',
          toId: toProcessorId,
          toName,
          issuedById: input.userId,
          status: 'ISSUED',
          issuedDate: movedOn,
          // The return period runs from the day the goods first reached a processor, not from the move
          expectedDate: returnBy,
          reasonForTransport: MOVE_BETWEEN_JOB_WORKERS_REASON,
          vehicleNumber: input.vehicleNumber ?? undefined,
          totalDeclaredValue: toNumber(roundToCent(items.reduce((sum, i) => sum + (i.declaredValue ?? 0), 0))),
          unit: Unit.METER,
          remarks:
            `Moved from ${fromName} to ${toName}; first received by ${fromName} on ${formatDate(firstArrival)}` +
            (covering.length ? ` (sent under ${covering.join(', ')})` : '') +
            (input.remarks ? `. ${input.remarks}` : ''),
          items,
        },
        tx
      );

      const challanLines = await tx.challan_items.findMany({
        where: { challanId: challan.id },
        select: { id: true, greigeStockId: true, laceStockId: true, fabricStockId: true },
      });
      const moved: MoveHeldStockResult['lines'] = [];
      for (const p of placed) {
        const args = {
          stockId: p.line.lotId,
          quantity: p.qty,
          storeWarehouseId: unit.id,
          inwardChallanId: challan.id,
          inwardChallanNumber: challan.challanNumber,
          broughtOn: movedOn,
          userId: input.userId,
          toProcessorId,
        };
        const result =
          p.line.lotType === 'GREIGE'
            ? await greigeStockService.bringHeldLotToStore(tx, args)
            : p.line.lotType === 'LACE'
              ? await bringHeldLaceLotToStore(tx, args)
              : await fabricStockService.bringHeldLotToStore(tx, args);
        // The challan's line names the lot now at B — B's covering challan is found through it
        const line = challanLines.find(
          (l) => l.greigeStockId === p.line.lotId || l.laceStockId === p.line.lotId || l.fabricStockId === p.line.lotId
        );
        if (line) {
          await tx.challan_items.update({
            where: { id: line.id },
            data:
              p.line.lotType === 'GREIGE'
                ? { greigeStockId: result.storeLotId }
                : p.line.lotType === 'LACE'
                  ? { laceStockId: result.storeLotId }
                  : { fabricStockId: result.storeLotId },
          });
        }
        moved.push({
          ...p.line,
          quantity: p.qty,
          newLotId: result.storeLotId,
          remainingAtProcessor: result.remainingAtProcessor,
        });
      }

      // A's covering challan(s): part (or all) of what they covered has left A
      await recomputeCoveringChallansForLots(
        tx,
        {
          greigeIds: placed.filter((p) => p.line.lotType === 'GREIGE').map((p) => p.line.lotId),
          laceIds: placed.filter((p) => p.line.lotType === 'LACE').map((p) => p.line.lotId),
          fabricIds: placed.filter((p) => p.line.lotType === 'FABRIC').map((p) => p.line.lotId),
        },
        movedOn
      );

      return { challanId: challan.id, challanNumber: challan.challanNumber, fromName, toName, lines: moved };
    },
    { timeout: 20000, maxWait: 5000 }
  );
}
