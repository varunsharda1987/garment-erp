/**
 * The Rule 45 challan for goods a supplier delivered STRAIGHT to a job worker (direct-to-processor
 * plan, Phase 2, 2026-09-25).
 *
 * CGST Rule 45(1): inputs go to a job worker under a challan issued by the principal "including where
 * such goods are sent directly to a job worker"; Sec 19 counts the one-year return period from the day
 * the job worker received them. So when a purchase receipt books goods at a processor's unit, we issue
 * that challan in the same transaction — OUTWARD, from the supplier on our account, to the processor,
 * already ISSUED, and dated the day the processor got the goods. It is what puts the goods on the
 * Processor Statement, in ITC-04 and in §143 ageing from arrival.
 *
 * THE ONE WRITER of these challans: GRN approval and the one-time conversion script
 * (scripts/backfill-direct-delivery.ts) both call it. A job that later uses the goods where they lie
 * files no second challan — this one covers them.
 */
import type { Prisma } from '@prisma/client';
import { Unit } from '@prisma/client';
import { createChallan, type CreateChallanItemInput } from '../challan.service';
import { addCurrency, multiplyCurrency, roundToCent, toCurrency, toNumber } from '../../utils/currency';
import { formatDate } from '../../utils/date';
import { foldActual, hasFold } from '../../utils/fold-length';
import { isQtyZero, qtyExceeds } from '../../utils/quantity';
import { normalizeUnit } from '../../utils/units';
import { BusinessError } from '../../errors';
import greigeStockService from '../greige-stock.service';
import { systemSettingsService } from '../system-settings.service';
import { loadDeliveryProgress } from './po-delivery-plan.helper';
import { listStateOf } from './lot-pieces.helper';
import {
  CLAIMED_TRANSIT_WHERE,
  OPEN_TRANSIT_WHERE,
  PENDING_TRANSIT_WHERE,
  istDay,
  yearAfter,
} from './transit-challan-state';

type Tx = Prisma.TransactionClient;

export const DIRECT_SUPPLY_REASON =
  'Job work — inputs supplied directly to the job worker on our account (CGST Rule 45(1)) — not a supply';

/** Phase 4g: the processor sold us the goods and keeps them to process for us. Wording for the CA to confirm. */
export const RETAINED_BY_SUPPLIER_REASON =
  'Purchased from you and retained at your premises for job work on our account (CGST Rule 45(1)) — not a supply';

export interface DirectSupplyLine {
  itemType: 'GREIGE' | 'LACE' | 'FABRIC' | 'TRIM';
  greigeStockId?: string;
  laceStockId?: string;
  fabricStockId?: string;
  materialId?: string;
  /** The receipt line's PO line — how a goods-in-transit challan's line is matched to what arrived */
  poItemId?: string;
  /** ACTUAL metres (or units) — the fold-length rule's stock figure, never the counted one. */
  quantity: number;
  unit: Unit;
  /** The purchase rate — the material's value for the declaration, never a job-work rate. */
  rate: number;
  foldLengthCm?: number;
  description: string;
}

export interface DirectSupplyChallanInput {
  grnId: string;
  grnNumber: string;
  supplierId: string | null;
  supplierName: string;
  processorId: string;
  processorName: string;
  invoiceNumber?: string | null;
  invoiceDate?: Date | null;
  /** The day the job worker received the goods — starts the one-year return period. */
  receivedOn: Date;
  /** The challan's own date: the receipt date for a live GRN, the conversion day for a late one. */
  challanDate: Date;
  lines: DirectSupplyLine[];
  userId: string;
  /** Extra wording for the remarks, e.g. why a challan is issued late. */
  note?: string;
  /** The supplier IS the processor (Phase 4g): it sold us the goods and keeps them to process. */
  retainedBySupplier?: boolean;
}

export async function createDirectSupplyChallanInTx(
  tx: Tx,
  input: DirectSupplyChallanInput
): Promise<{ id: string; challanNumber: string }> {
  if (input.lines.length === 0) throw new Error('A direct-supply challan needs at least one line');

  const items: CreateChallanItemInput[] = input.lines.map((l) => ({
    itemType: l.itemType,
    greigeStockId: l.greigeStockId,
    laceStockId: l.laceStockId,
    fabricStockId: l.fabricStockId,
    materialId: l.materialId,
    poItemId: l.poItemId,
    quantity: l.quantity,
    unit: l.unit,
    rate: l.rate,
    foldLengthCm: l.foldLengthCm,
    description: l.description,
    declaredValue: toNumber(roundToCent(multiplyCurrency(l.quantity, l.rate))),
  }));
  const totalDeclared = items.reduce((acc, i) => addCurrency(acc, i.declaredValue ?? 0), toCurrency(0));

  const invoice = input.invoiceNumber
    ? `invoice ${input.invoiceNumber}${input.invoiceDate ? ` dated ${formatDate(input.invoiceDate)}` : ''}, `
    : '';
  const remarks =
    (input.retainedBySupplier
      ? `Purchased from ${input.supplierName} vide ${invoice}GRN ${input.grnNumber} and retained at its premises ` +
        `for job work from ${formatDate(input.receivedOn)}.`
      : `Supplied directly by ${input.supplierName} vide ${invoice}GRN ${input.grnNumber}; ` +
        `received by job worker on ${formatDate(input.receivedOn)}.`) + (input.note ? ` ${input.note}` : '');

  const challan = await createChallan(
    {
      challanType: 'OUTWARD',
      challanDate: input.challanDate,
      fromType: 'SUPPLIER',
      fromId: input.supplierId ?? undefined,
      fromName: input.retainedBySupplier
        ? `Purchased from ${input.supplierName} — retained at its premises`
        : `Supplied directly by ${input.supplierName}`,
      toType: 'VENDOR',
      toId: input.processorId,
      toName: input.processorName,
      issuedById: input.userId,
      status: 'ISSUED',
      issuedDate: input.challanDate,
      // The return period runs from the job worker's receipt, not from the challan's own date.
      expectedDate: yearAfter(input.receivedOn),
      directSupplyGrnId: input.grnId,
      reasonForTransport: input.retainedBySupplier ? RETAINED_BY_SUPPLIER_REASON : DIRECT_SUPPLY_REASON,
      totalDeclaredValue: toNumber(roundToCent(totalDeclared)),
      unit: input.lines.every((l) => l.unit === input.lines[0].unit) ? input.lines[0].unit : Unit.PIECE,
      remarks,
      items,
    },
    tx
  );

  // Greige lots point back at the challan that covers them (lace / fabric rows have no such column;
  // their challan is found through challans.directSupplyGrnId).
  const greigeIds = input.lines.map((l) => l.greigeStockId).filter((id): id is string => !!id);
  await greigeStockService.linkCoveringChallan(greigeIds, challan.id, tx);
  return { id: challan.id, challanNumber: challan.challanNumber };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Goods in transit (2026-09-29): the challan issued when the supplier DESPATCHES, adopted by the receipt on arrival
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
//
// A dyer will not inward goods without our Rule 45 challan, so it must travel with the truck — before any receipt
// exists. PO2609-0004's delivery to Shree Bhavya was received AHEAD of arrival (GRN2609-1581 dated 03-Oct, filed
// 29-Sep) only to get CH2609-2129 out. The transit challan is that document without the early receipt: issued on
// the day we give it (owner), carrying the supplier's invoice, the e-way bill and the than / bale / roll list as
// despatched (challan_item_pieces). The receipt, filed the day the goods really arrive, CLAIMS it at create and
// ADOPTS it at approval — lots linked, arrivedQty on each line, the one-year clock from arrival. A challan once
// given never changes (owner): quantity and pieces stay as despatched; what arrived is on the receipt.
// States and predicates: transit-challan-state.ts.

const TRANSIT_CATEGORIES = new Set(['GREIGE', 'GREIGE_LACE', 'LACE', 'FABRIC']);
const TRANSIT_PO_STATUSES = new Set(['SENT', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED']);

export type TransitEntryMode = 'TOTAL_METERS' | 'THAN_WISE' | 'BALE_WISE' | 'ROLL_WISE';

export interface TransitPieceInput {
  detailType: 'THAN' | 'ROLL';
  baleNumber?: number | null;
  sequenceNo: number;
  /** COUNTED tag metres */
  meters: number;
  baleNo?: string | null;
  thanNo?: string | null;
}

export interface TransitLineInput {
  poItemId: string;
  /** COUNTED — the figure on the supplier's paper; at fold L the challan line is counted × L/100 (ACTUAL) */
  quantity: number;
  foldLengthCm?: number | null;
  entryMode?: TransitEntryMode | null;
  pieces?: TransitPieceInput[];
}

export interface TransitChallanInput {
  poId: string;
  /** Split PO: the point the goods travel to. One-place PO: omitted — the PO's Deliver To */
  poDeliveryPointId?: string | null;
  /** The challan's own date — the day we issue it (default today); never in the future */
  challanDate?: Date | null;
  /** The day the supplier despatched the goods */
  dispatchedOn: Date;
  invoiceNumber?: string | null;
  invoiceDate?: Date | null;
  vehicleNumber?: string | null;
  lrNumber?: string | null;
  ewayBillNumber?: string | null;
  ewayBillDate?: Date | null;
  remarks?: string | null;
  lines: TransitLineInput[];
  userId: string;
}

/** Where a transit challan's goods are headed: its delivery point's place, else the PO's one place. */
export function transitUnitOf(
  challan: { deliveryPoint?: { warehouseId: string } | null },
  po: { deliveryLocationId: string | null }
): string | null {
  return challan.deliveryPoint?.warehouseId ?? po.deliveryLocationId;
}

function refuse(code: string, message: string, extra: Record<string, unknown> = {}): never {
  throw new BusinessError(message, { code, reason: code, ...extra });
}

const itemTypeOf = (poCategory: string): 'GREIGE' | 'LACE' | 'FABRIC' =>
  poCategory === 'FABRIC' ? 'FABRIC' : poCategory === 'LACE' || poCategory === 'GREIGE_LACE' ? 'LACE' : 'GREIGE';

/** THE writer of a goods-in-transit challan. Everything is checked before anything is written. */
export async function createTransitChallanInTx(
  tx: Tx,
  input: TransitChallanInput
): Promise<{ id: string; challanNumber: string }> {
  const po = await tx.purchase_orders.findUnique({
    where: { id: input.poId },
    select: {
      id: true,
      poNumber: true,
      status: true,
      poCategory: true,
      supplierId: true,
      deliveryLocationId: true,
      suppliers: { select: { name: true } },
      deliveryPoints: { select: { id: true, warehouseId: true } },
      purchase_order_items: {
        select: { id: true, unit: true, unitPrice: true, materials: { select: { code: true, name: true } } },
      },
    },
  });
  if (!po) refuse('TRANSIT_PO_NOT_FOUND', 'Purchase order not found.');
  if (!TRANSIT_PO_STATUSES.has(po.status)) {
    refuse(
      'TRANSIT_PO_STATUS',
      `${po.poNumber} is ${po.status.toLowerCase().replace(/_/g, ' ')} — a challan for goods on the way is issued only on a sent purchase order.`
    );
  }
  if (!TRANSIT_CATEGORIES.has(po.poCategory ?? '')) {
    refuse(
      'TRANSIT_CATEGORY',
      `A challan for goods on the way is issued for greige, fabric and lace purchase orders only — ${po.poNumber} is ${po.poCategory ?? 'uncategorised'}.`
    );
  }

  // Where the goods are headed: the point (split PO) or the PO's one place — a processor's unit
  let unitId: string | null;
  let pointId: string | null = null;
  if (po.deliveryPoints.length > 0) {
    const point = po.deliveryPoints.find((p) => p.id === input.poDeliveryPointId);
    if (!point) {
      refuse(
        'TRANSIT_POINT_REQUIRED',
        `${po.poNumber} delivers to several places — pick which one these goods are going to.`
      );
    }
    unitId = point.warehouseId;
    pointId = point.id;
  } else {
    unitId = po.deliveryLocationId;
  }
  if (!unitId) {
    refuse(
      'TRANSIT_NO_PLACE',
      `${po.poNumber} has no delivery place yet ("to be advised") — set where it delivers first.`
    );
  }
  const unit = await tx.warehouses.findUnique({
    where: { id: unitId },
    select: { warehouseName: true, warehouseType: true, supplierId: true },
  });
  if (!unit || unit.warehouseType !== 'JOB_WORK' || !unit.supplierId) {
    refuse(
      'TRANSIT_NOT_PROCESSOR',
      `${unit?.warehouseName ?? 'That place'} is not a processor's unit — goods coming to our own store travel on the supplier's papers, with no challan of ours.`
    );
  }
  const processor = await tx.suppliers.findUnique({ where: { id: unit.supplierId }, select: { id: true, name: true } });
  if (!processor) refuse('TRANSIT_NOT_PROCESSOR', `The processor behind ${unit.warehouseName} no longer exists.`);
  if (po.supplierId === processor.id) {
    refuse(
      'TRANSIT_SELF_SUPPLY',
      `${processor.name} is both the supplier and the processor — nothing travels; approve its receipt as "sold us this and keeps it to process".`
    );
  }
  const supplierName = po.suppliers?.name ?? 'the supplier';

  // Dates are IST calendar days (a receipt the same day as the challan must never be "before" it)
  const today = istDay(new Date());
  const challanDate = istDay(input.challanDate ?? new Date());
  const dispatchedOn = istDay(input.dispatchedOn);
  if (challanDate > today) {
    refuse('TRANSIT_DATE_IN_FUTURE', 'The challan is dated the day it is issued — not a future date.');
  }
  if (dispatchedOn > today) {
    refuse('TRANSIT_DISPATCH_IN_FUTURE', 'The supplier cannot have despatched the goods on a future date.');
  }
  if (dispatchedOn > challanDate) {
    refuse(
      'TRANSIT_DISPATCH_AFTER_CHALLAN',
      'The goods were despatched after the challan date — date the challan the day you issue it, on or after the despatch.'
    );
  }

  if (input.lines.length === 0) refuse('TRANSIT_NO_LINES', 'Add at least one line with what was despatched.');
  const poItemIds = input.lines.map((l) => l.poItemId);
  if (new Set(poItemIds).size !== poItemIds.length) {
    refuse('TRANSIT_DUPLICATE_LINE', 'A PO line appears twice — enter each line once.');
  }

  // How much can still travel to this place: planned − received − what is already on the way there
  const tolerance = await systemSettingsService.getNumberDefault('GRN_OVER_RECEIPT_TOLERANCE_PERCENT');
  const progress = await loadDeliveryProgress(tx, po.id, 0);
  const place = progress.points.find((p) => p.planned && p.warehouseId === unitId);
  const onTheWay = await tx.challan_items.findMany({
    where: {
      poItemId: { in: poItemIds },
      challan: { ...OPEN_TRANSIT_WHERE, purchaseOrderId: po.id, toId: processor.id },
    },
    select: { poItemId: true, quantity: true },
  });
  const travelling = (poItemId: string) =>
    onTheWay
      .filter((r) => r.poItemId === poItemId)
      .reduce((acc, r) => addCurrency(acc, Number(r.quantity)), toCurrency(0))
      .toNumber();

  const itemType = itemTypeOf(po.poCategory ?? '');
  const lines: Array<{ item: CreateChallanItemInput; pieces: TransitPieceInput[] }> = [];
  for (const line of input.lines) {
    const poItem = po.purchase_order_items.find((i) => i.id === line.poItemId);
    if (!poItem) refuse('TRANSIT_LINE_NOT_ON_PO', `A line is not on ${po.poNumber} — reload the page and try again.`);
    const label = poItem.materials?.code ?? poItem.materials?.name ?? 'a line';
    if (!(line.quantity > 0)) refuse('TRANSIT_QTY_REQUIRED', `Enter the quantity despatched for ${label}.`);
    const unitOfLine = normalizeUnit(poItem.unit) ?? Unit.METER;
    const fold = hasFold(line.foldLengthCm) ? Number(line.foldLengthCm) : null;
    if (fold != null && unitOfLine !== Unit.METER) {
      refuse('TRANSIT_FOLD_NOT_METRES', `${label} is bought in ${poItem.unit} — a fold length applies to metres only.`);
    }
    const qty = foldActual(line.quantity, fold).toNumber();

    const planned = place?.lines.find((l) => l.poItemId === poItem.id);
    if (!planned || !(planned.planned > 0)) {
      refuse('TRANSIT_LINE_NOT_PLANNED', `${label} is not planned for ${unit.warehouseName} on ${po.poNumber}.`);
    }
    const room = toNumber(
      toCurrency(planned.planned)
        .times(1 + tolerance / 100)
        .minus(planned.received)
        .minus(travelling(poItem.id))
    );
    if (qtyExceeds(qty, room)) {
      refuse(
        'TRANSIT_EXCEEDS_PENDING',
        `${label}: ${qty} is more than can still come to ${unit.warehouseName} (${Math.max(0, room)} with the ${tolerance}% allowance, after what was received and what is already on the way).`,
        { poItemId: poItem.id, room }
      );
    }

    // The packing list as despatched: one kind of piece per line, adding up to the line within ±1%
    const pieces = line.pieces ?? [];
    if (itemType === 'LACE' && pieces.length > 0) {
      refuse('TRANSIT_LACE_PIECES', 'Lace travels by quantity — no than / roll list.');
    }
    const kinds = new Set(pieces.map((p) => p.detailType));
    if (kinds.size > 1) refuse('TRANSIT_MIXED_PIECES', `${label}: list thans or rolls, not both, on one line.`);
    const entryMode: TransitEntryMode =
      line.entryMode ??
      (pieces.length === 0
        ? 'TOTAL_METERS'
        : kinds.has('ROLL')
          ? 'ROLL_WISE'
          : pieces.some((p) => p.baleNumber != null)
            ? 'BALE_WISE'
            : 'THAN_WISE');
    if (entryMode === 'TOTAL_METERS' && pieces.length > 0) {
      refuse('TRANSIT_PIECES_MODE', `${label}: pick thans, bales or rolls to list pieces.`);
    }
    if (entryMode === 'ROLL_WISE' && kinds.has('THAN')) {
      refuse('TRANSIT_PIECES_MODE', `${label}: a roll-wise line lists rolls.`);
    }
    if ((entryMode === 'THAN_WISE' || entryMode === 'BALE_WISE') && kinds.has('ROLL')) {
      refuse('TRANSIT_PIECES_MODE', `${label}: a than-wise line lists thans.`);
    }
    if (entryMode === 'BALE_WISE' && pieces.some((p) => p.baleNumber == null)) {
      refuse('TRANSIT_PIECES_MODE', `${label}: every than on a bale-wise line belongs to a bale.`);
    }
    if (pieces.some((p) => !(p.meters > 0))) {
      refuse('TRANSIT_PIECE_METRES', `${label}: every than / roll needs its metres.`);
    }
    if (pieces.length > 0) {
      const tagTotal = addCurrency(...pieces.map((p) => p.meters));
      const state = listStateOf({
        piecesRecorded: pieces.length,
        listActual: foldActual(tagTotal, fold).toNumber(),
        onHand: qty,
      });
      if (state !== 'IN_STEP') {
        refuse(
          'TRANSIT_PIECES_OFF',
          `${label}: the ${pieces.length} pieces add up to ${tagTotal.toNumber()} m — more than 1% away from the ${line.quantity} despatched.`
        );
      }
    }

    const rate = Number(poItem.unitPrice ?? 0);
    lines.push({
      item: {
        itemType,
        quantity: qty,
        unit: unitOfLine,
        rate,
        declaredValue: toNumber(roundToCent(multiplyCurrency(qty, rate))),
        ...(fold != null ? { foldLengthCm: fold } : {}),
        ...(pieces.length > 0 ? { thanCount: pieces.length } : {}),
        description: poItem.materials ? `${poItem.materials.code} — ${poItem.materials.name}` : label,
        poItemId: poItem.id,
        entryMode,
      },
      pieces,
    });
  }

  const totalDeclared = lines.reduce((acc, l) => addCurrency(acc, l.item.declaredValue ?? 0), toCurrency(0));
  const invoiceText = input.invoiceNumber
    ? ` vide invoice ${input.invoiceNumber}${input.invoiceDate ? ` dated ${formatDate(input.invoiceDate)}` : ''}`
    : '';
  const remarks =
    `Supplied directly by ${supplierName}${invoiceText}; despatched by the supplier on ${formatDate(dispatchedOn)} ` +
    `straight to the job worker.` +
    (input.remarks?.trim() ? ` ${input.remarks.trim()}` : '');

  const challan = await createChallan(
    {
      challanType: 'OUTWARD',
      challanDate,
      fromType: 'SUPPLIER',
      fromId: po.supplierId ?? undefined,
      fromName: `Supplied directly by ${supplierName}`,
      toType: 'VENDOR',
      toId: processor.id,
      toName: processor.name,
      issuedById: input.userId,
      status: 'IN_TRANSIT',
      issuedDate: challanDate,
      purchaseOrderId: po.id,
      poDeliveryPointId: pointId ?? undefined,
      supplierDispatchedAt: dispatchedOn,
      supplierInvoiceNumber: input.invoiceNumber?.trim() || undefined,
      supplierInvoiceDate: input.invoiceDate ? istDay(input.invoiceDate) : undefined,
      vehicleNumber: input.vehicleNumber?.trim() || undefined,
      lrNumber: input.lrNumber?.trim() || undefined,
      ewayBillNumber: input.ewayBillNumber?.trim() || undefined,
      ewayBillDate: input.ewayBillDate ? istDay(input.ewayBillDate) : undefined,
      reasonForTransport: DIRECT_SUPPLY_REASON,
      totalDeclaredValue: toNumber(roundToCent(totalDeclared)),
      unit: lines.every((l) => l.item.unit === lines[0].item.unit) ? lines[0].item.unit : Unit.PIECE,
      remarks,
      items: lines.map((l) => l.item),
    },
    tx
  );

  const pieceRows = lines.flatMap((l) => {
    const item = challan.items.find((i) => i.poItemId === l.item.poItemId);
    if (!item) return [];
    return l.pieces.map((p) => ({
      challanItemId: item.id,
      detailType: p.detailType,
      baleNumber: p.baleNumber ?? null,
      sequenceNo: p.sequenceNo,
      meters: p.meters,
      baleNo: p.baleNo?.trim() || null,
      thanNo: p.thanNo?.trim() || null,
    }));
  });
  if (pieceRows.length > 0) await tx.challan_item_pieces.createMany({ data: pieceRows });
  return { id: challan.id, challanNumber: challan.challanNumber };
}

type Reader = Pick<Prisma.TransactionClient, 'challans' | 'purchase_orders'>;

/**
 * A receipt at a processor's unit, before it is written: which transit challan it comes in against. Refuses a
 * challan that is not this delivery's, and a receipt that names none while one is open to this unit — two
 * challans for the same goods would count twice in ITC-04 (the receipt names it or says "not against it").
 */
export async function resolveTransitForReceipt(
  client: Reader,
  input: {
    poId: string;
    supplierId: string | null;
    warehouseId: string | null;
    receivingDate: Date;
    transitChallanId?: string | null;
    notAgainstTransitChallan?: boolean;
    lines: Array<{ poItemId: string; receivedAsReadyFabric?: boolean | null }>;
  }
): Promise<{ id: string; challanNumber: string } | null> {
  if (!input.warehouseId) return null;
  const po = await client.purchase_orders.findUnique({
    where: { id: input.poId },
    select: { deliveryLocationId: true },
  });
  if (!po) return null;
  const include = {
    items: { select: { poItemId: true } },
    deliveryPoint: { select: { warehouseId: true } },
  } as const;

  if (input.transitChallanId) {
    const c = await client.challans.findUnique({ where: { id: input.transitChallanId }, include });
    if (!c || c.supplierDispatchedAt == null) {
      refuse('TRANSIT_CHALLAN_UNKNOWN', 'That challan is not one issued for goods on the way.');
    }
    if (c.status === 'CANCELLED') refuse('TRANSIT_CHALLAN_CANCELLED', `${c.challanNumber} was cancelled.`);
    if (c.status !== 'IN_TRANSIT' || c.directSupplyGrnId) {
      refuse(
        'TRANSIT_CHALLAN_TAKEN',
        `${c.challanNumber} has already been received against — one challan, one receipt.`
      );
    }
    if (c.purchaseOrderId !== input.poId) {
      refuse('TRANSIT_CHALLAN_OTHER_PO', `${c.challanNumber} is for another purchase order.`);
    }
    if (input.supplierId && c.fromId && c.fromId !== input.supplierId) {
      refuse('TRANSIT_CHALLAN_OTHER_PO', `${c.challanNumber} is for goods from another supplier.`);
    }
    if (transitUnitOf(c, po) !== input.warehouseId) {
      refuse(
        'TRANSIT_CHALLAN_WRONG_PLACE',
        `${c.challanNumber} took the goods to ${c.toName} — receive them into ${c.toName}'s unit.`
      );
    }
    if (istDay(input.receivingDate) < istDay(c.challanDate)) {
      refuse(
        'RECEIPT_BEFORE_TRANSIT_CHALLAN',
        `The goods cannot have arrived before ${c.challanNumber} was issued (${formatDate(c.challanDate)}). ` +
          `If they came first, receive them without the challan — the receipt makes one.`
      );
    }
    const onChallan = new Set(c.items.map((i) => i.poItemId).filter((id): id is string => !!id));
    const receiptIds = input.lines.map((l) => l.poItemId);
    if (new Set(receiptIds).size !== receiptIds.length) {
      refuse('TRANSIT_DUPLICATE_LINE', 'A PO line appears twice on this receipt.');
    }
    if (!receiptIds.some((id) => onChallan.has(id))) {
      refuse('TRANSIT_CHALLAN_NO_LINES', `None of these lines travelled on ${c.challanNumber}.`);
    }
    if (input.lines.some((l) => l.receivedAsReadyFabric && onChallan.has(l.poItemId))) {
      refuse(
        'TRANSIT_READY_FABRIC',
        `${c.challanNumber} took these goods to the processor as greige — they cannot be received as ready fabric against it.`
      );
    }
    return { id: c.id, challanNumber: c.challanNumber };
  }

  const open = await client.challans.findMany({
    where: { ...OPEN_TRANSIT_WHERE, purchaseOrderId: input.poId },
    include,
  });
  const here = open.filter((c) => transitUnitOf(c, po) === input.warehouseId);
  if (here.length > 0 && !input.notAgainstTransitChallan) {
    const numbers = here.map((c) => c.challanNumber);
    const one = numbers.length === 1;
    refuse(
      'TRANSIT_CHALLAN_UNCONFIRMED',
      `${numbers.join(', ')} ${one ? 'was' : 'were'} issued for goods on the way to ${here[0].toName}. ` +
        `Receive against ${one ? 'it' : 'one of them'}, or say this delivery is not against ${one ? 'it' : 'them'}.`,
      { challans: here.map((c) => ({ id: c.id, challanNumber: c.challanNumber })) }
    );
  }
  return null;
}

/** The receipt's own transaction: take the challan for this receipt (one challan, one receipt — a double-click loses). */
export async function claimTransitChallanInTx(tx: Tx, challanId: string, grnId: string): Promise<void> {
  const { count } = await tx.challans.updateMany({
    where: { id: challanId, ...OPEN_TRANSIT_WHERE },
    data: { directSupplyGrnId: grnId },
  });
  if (count === 0) refuse('TRANSIT_CHALLAN_TAKEN', 'That challan has just been received against by someone else.');
}

/** The transit challan a receipt waiting for QC has claimed, if any (approval checks the place against it). */
export async function claimedTransitOf(
  client: Pick<Prisma.TransactionClient, 'challans'>,
  grnId: string
): Promise<{ id: string; challanNumber: string; toId: string | null; toName: string } | null> {
  return client.challans.findFirst({
    where: { ...CLAIMED_TRANSIT_WHERE, directSupplyGrnId: grnId },
    select: { id: true, challanNumber: true, toId: true, toName: true },
  });
}

/**
 * Approval: the receipt adopts the challan it claimed, for the lines the challan carries — each line gets the lot
 * booked for it and what arrived (arrivedQty; 0 = none of it came), the challan becomes ISSUED and its return
 * clock runs from arrival. The challan's own quantities and pieces never change. Returns the receipt lines the
 * challan does not carry — they get a challan made at receipt, as before. Nothing accepted on any of its lines
 * releases the challan instead (the goods are not with the processor).
 */
export async function adoptTransitChallanInTx(
  tx: Tx,
  input: { grnId: string; processorId: string; lines: DirectSupplyLine[]; receivedOn: Date }
): Promise<{ challanId: string; challanNumber: string; uncovered: DirectSupplyLine[]; released: boolean } | null> {
  const challan = await tx.challans.findFirst({
    where: { ...CLAIMED_TRANSIT_WHERE, directSupplyGrnId: input.grnId },
    include: { items: { select: { id: true, poItemId: true } } },
  });
  if (!challan) return null;
  if (challan.toId !== input.processorId) {
    refuse(
      'TRANSIT_CHALLAN_WRONG_PLACE',
      `${challan.challanNumber} took these goods to ${challan.toName} — approve the receipt into ${challan.toName}'s unit, or reject it to release the challan.`
    );
  }
  const carried = new Set(challan.items.map((i) => i.poItemId).filter((id): id is string => !!id));
  const covered = input.lines.filter((l) => l.poItemId && carried.has(l.poItemId));
  const uncovered = input.lines.filter((l) => !l.poItemId || !carried.has(l.poItemId));

  if (covered.every((l) => isQtyZero(l.quantity))) {
    await tx.challans.updateMany({
      where: { id: challan.id, ...CLAIMED_TRANSIT_WHERE },
      data: { directSupplyGrnId: null },
    });
    return { challanId: challan.id, challanNumber: challan.challanNumber, uncovered, released: true };
  }

  for (const item of challan.items) {
    const line = covered.find((l) => l.poItemId === item.poItemId);
    await tx.challan_items.update({
      where: { id: item.id },
      data: line
        ? {
            greigeStockId: line.greigeStockId ?? null,
            fabricStockId: line.fabricStockId ?? null,
            laceStockId: line.laceStockId ?? null,
            arrivedQty: line.quantity,
          }
        : { arrivedQty: 0 },
    });
  }
  const { count } = await tx.challans.updateMany({
    where: { id: challan.id, ...CLAIMED_TRANSIT_WHERE, directSupplyGrnId: input.grnId },
    data: { status: 'ISSUED', expectedDate: yearAfter(istDay(input.receivedOn)) },
  });
  if (count === 0) {
    refuse(
      'TRANSIT_CHALLAN_TAKEN',
      `${challan.challanNumber} changed while this receipt was being approved — try again.`
    );
  }
  const greigeIds = covered.map((l) => l.greigeStockId).filter((id): id is string => !!id);
  await greigeStockService.linkCoveringChallan(greigeIds, challan.id, tx);
  return { challanId: challan.id, challanNumber: challan.challanNumber, uncovered, released: false };
}

/**
 * The receipt is rejected or reversed: its transit challan goes back to "on the way", unclaimed — the goods really
 * travelled, so the challan is released, never cancelled. Refused once a job drew cloth under it or any came back.
 */
export async function releaseTransitChallanInTx(tx: Tx, grnId: string): Promise<{ challanNumber: string } | null> {
  const challan = await tx.challans.findFirst({
    where: { directSupplyGrnId: grnId, supplierDispatchedAt: { not: null }, status: { not: 'CANCELLED' } },
    select: { id: true, challanNumber: true, status: true },
  });
  if (!challan) return null;
  const drawn = await tx.greige_issue_details.count({ where: { challanId: challan.id } });
  if (drawn > 0 || (challan.status !== 'IN_TRANSIT' && challan.status !== 'ISSUED')) {
    refuse(
      'TRANSIT_CHALLAN_IN_USE',
      `Cloth that came under ${challan.challanNumber} has already gone on a job or come back — undo that first.`
    );
  }
  await tx.challan_items.updateMany({
    where: { challanId: challan.id },
    data: { greigeStockId: null, fabricStockId: null, laceStockId: null, arrivedQty: null },
  });
  await greigeStockService.unlinkCoveringChallan(challan.id, tx);
  const { count } = await tx.challans.updateMany({
    where: { id: challan.id, status: challan.status, directSupplyGrnId: grnId },
    data: { status: 'IN_TRANSIT', directSupplyGrnId: null, expectedDate: null },
  });
  if (count === 0) refuse('TRANSIT_CHALLAN_IN_USE', `${challan.challanNumber} changed meanwhile — try again.`);
  return { challanNumber: challan.challanNumber };
}

/** The last day of the Indian quarter a day falls in (30-Jun, 30-Sep, 31-Dec, 31-Mar) */
function quarterEnd(day: Date): Date {
  const m = day.getUTCMonth(); // 0-based
  const endMonth = m < 3 ? 2 : m < 6 ? 5 : m < 9 ? 8 : 11;
  return new Date(Date.UTC(day.getUTCFullYear(), endMonth + 1, 0));
}

/**
 * The truck never came, or the goods went elsewhere: an OPEN transit challan is cancelled (it drops out of ITC-04).
 * A claimed one is released by rejecting its receipt first. Warns when its quarter has ended (ITC-04 may be filed).
 */
export async function cancelTransitChallanInTx(
  tx: Tx,
  challanId: string,
  reason: string
): Promise<{ challanNumber: string; warning: string | null }> {
  const challan = await tx.challans.findUnique({
    where: { id: challanId },
    select: {
      challanNumber: true,
      challanDate: true,
      status: true,
      directSupplyGrnId: true,
      supplierDispatchedAt: true,
      remarks: true,
    },
  });
  if (!challan || challan.supplierDispatchedAt == null) {
    refuse('TRANSIT_CHALLAN_UNKNOWN', 'That challan is not one issued for goods on the way.');
  }
  if (challan.status === 'CANCELLED')
    refuse('TRANSIT_CHALLAN_CANCELLED', `${challan.challanNumber} is already cancelled.`);
  if (challan.status !== 'IN_TRANSIT') {
    refuse(
      'TRANSIT_CHALLAN_ARRIVED',
      `The goods on ${challan.challanNumber} have arrived — reverse the receipt instead.`
    );
  }
  if (challan.directSupplyGrnId) {
    refuse('TRANSIT_CHALLAN_TAKEN', `A receipt against ${challan.challanNumber} is waiting for QC — reject it first.`);
  }
  const { count } = await tx.challans.updateMany({
    where: { id: challanId, ...OPEN_TRANSIT_WHERE },
    data: {
      status: 'CANCELLED',
      remarks: [challan.remarks, `Cancelled ${formatDate(new Date())}: ${reason.trim()}`].filter(Boolean).join('\n'),
    },
  });
  if (count === 0) refuse('TRANSIT_CHALLAN_TAKEN', `${challan.challanNumber} changed meanwhile — reload it.`);
  const ended = quarterEnd(istDay(challan.challanDate)) < istDay(new Date());
  return {
    challanNumber: challan.challanNumber,
    warning: ended
      ? `${challan.challanNumber} is dated in a quarter that has ended — if its ITC-04 is already filed, tell the CA it was cancelled.`
      : null,
  };
}

/** Every transit challan of a PO, with its lines, pieces and arrival — for the PO page and the receipt form. */
export async function listTransitChallans(client: Pick<Prisma.TransactionClient, 'challans'>, poId: string) {
  return client.challans.findMany({
    where: { supplierDispatchedAt: { not: null }, purchaseOrderId: poId },
    orderBy: [{ challanDate: 'desc' }, { challanNumber: 'desc' }],
    select: {
      id: true,
      challanNumber: true,
      challanDate: true,
      status: true,
      supplierDispatchedAt: true,
      supplierInvoiceNumber: true,
      supplierInvoiceDate: true,
      vehicleNumber: true,
      lrNumber: true,
      ewayBillNumber: true,
      ewayBillDate: true,
      toId: true,
      toName: true,
      poDeliveryPointId: true,
      directSupplyGrnId: true,
      deliveryPoint: { select: { warehouseId: true } },
      directSupplyGrn: { select: { id: true, grnNumber: true, receivingDate: true, status: true } },
      items: {
        select: {
          id: true,
          poItemId: true,
          description: true,
          quantity: true,
          unit: true,
          foldLengthCm: true,
          entryMode: true,
          arrivedQty: true,
          pieces: {
            orderBy: [{ baleNumber: 'asc' }, { sequenceNo: 'asc' }],
            select: { detailType: true, baleNumber: true, baleNo: true, thanNo: true, sequenceNo: true, meters: true },
          },
        },
      },
    },
  });
}
