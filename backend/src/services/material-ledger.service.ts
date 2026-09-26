/**
 * Material Ledger — for ONE material: when it came in, where it went, and what is left.
 *
 * WHY THIS IS NOT ONE QUERY. There is no single table that holds a material's history:
 *
 *  - `stock_movements` misses the lot-tracked doors entirely. A job-work receipt writes a
 *    `fabric_stock` lot and `stock_levels` and no movement row; greige lots are created without
 *    one; every lot-level challan issue (greige/fabric/lace/thread) bypasses it.
 *  - The four `*_stock_transaction` tables miss the other half: no row is written when a fabric
 *    lot is received, nor when fabric is issued to cutting on a challan.
 *  - Trims (button, zipper, label, packaging, elastic…) have no transaction table at all, so
 *    `stock_movements` IS their ledger.
 *
 * So the rule is ONE authoritative source per (material kind, event kind), never a union with
 * cross-source de-duplication — that is how the same issue gets counted twice:
 *
 *    lot-tracked (GREIGE/FABRIC/LACE/THREAD) → the lot rows are the receipts,
 *                                              the *_stock_transaction rows are the movements,
 *                                              plus (FABRIC only) challan lines and manual
 *                                              stock_movements, which write no transaction row.
 *    everything else                         → stock_movements.
 *
 * HOW A RECEIPT QUANTITY IS DERIVED. Not `available + consumed + reserved`: several writers move
 * `quantityAvailable` without touching `quantityConsumed` (challan inward credit, both adjust
 * paths, GRN reversal, embroidery send-out), so that sum double-counts. Instead we BALANCE BACK —
 * `receipt = quantityAvailable − Σ(signed movements on that lot)`. The closing balance then
 * equals Σ quantityAvailable by construction, which is exactly what the stock pages show, and any
 * disagreement with `stock_levels` surfaces as drift instead of hiding inside a receipt figure.
 *
 * SIGNS. Direction comes from `transactionType`, never from the sign of `quantity`: fabric
 * writers store every quantity positive whatever the direction, greige/lace/thread use negatives
 * for OUT, and one greige reversal path writes a positive ADJUSTMENT_OUT.
 */

import prisma from '../config/database';
import { addCurrency, subtractCurrency, toCurrency, toNumber } from '../utils/currency';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MaterialLedgerKind = 'GREIGE' | 'FABRIC' | 'LACE' | 'THREAD' | 'GENERIC';
export type LedgerEntryKind = 'RECEIPT' | 'ISSUE' | 'RETURN' | 'TRANSFER' | 'ADJUSTMENT' | 'RESERVE' | 'RELEASE';
export type Direction = 'IN' | 'OUT';

export type SourceType =
  | 'GRN'
  | 'PO'
  | 'JOB_WORK_ORDER'
  | 'CHALLAN'
  | 'EXTERNAL_PROCESS'
  | 'ISSUE_NOTE'
  | 'PROCESSING_BATCH'
  | 'CUTTING'
  | 'ORDER'
  | 'PROCUREMENT'
  | 'EMBROIDERY'
  | 'TRANSFER'
  | 'ADJUSTMENT'
  | 'STOCK_IN'
  | 'MANUAL';

export interface LedgerSource {
  type: SourceType;
  number: string | null;
  id: string | null;
  /** Frontend path for a link, or null when no page shows this document. */
  route: string | null;
  party: string | null;
  destination: string | null;
}

export interface LedgerEvent {
  id: string;
  date: Date;
  /** Receipts sort first within a day: a lot cannot be issued before it arrives. */
  seq: number;
  direction: Direction;
  kind: LedgerEntryKind;
  qty: number;
  unit: string;
  warehouse: { id: string; name: string } | null;
  lot: { id: string; label: string | null } | null;
  source: LedgerSource;
  remarks: string | null;
  performedBy: string | null;
  flags: string[];
}

export interface LedgerRow extends LedgerEvent {
  balance: number;
}

export interface MaterialLedger {
  material: {
    id: string;
    code: string;
    name: string;
    unit: string;
    materialType: string;
    kind: MaterialLedgerKind;
    sizeVariant: string | null;
  };
  filters: { from: Date | null; to: Date | null; warehouseId: string | null; warehouseName: string | null };
  opening: number | null;
  rows: LedgerRow[];
  totals: { in: number; out: number; closing: number };
  onHand: {
    stockLevels: number | null;
    lotsAvailable: number | null;
    lotsReserved: number | null;
    ledgerClosingAllTime: number;
    drift: boolean;
  };
  warnings: string[];
}

export interface LedgerQuery {
  from?: Date;
  to?: Date;
  warehouseId?: string;
}

export class MaterialNotFoundError extends Error {
  constructor(materialId: string) {
    super(`Material ${materialId} not found`);
    this.name = 'MaterialNotFoundError';
  }
}

// ---------------------------------------------------------------------------
// Pure: classification
// ---------------------------------------------------------------------------

/** Raw transaction shape shared by the four specialized tables. */
export interface RawTxn {
  id: string;
  lotId: string;
  transactionType: string;
  referenceType: string | null;
  referenceId: string | null;
  quantity: number;
  notes: string | null;
  date: Date;
  performedBy: string | null;
}

/**
 * What a specialized transaction row means for the ledger — or null to skip it.
 *
 * Skipped on purpose:
 *  - receipt-shaped rows (STOCK_IN / RECEIPT / EMBROIDERY_RECEIPT). The lot row is the receipt;
 *    these are only written by SOME doors, so counting them would double the ones that write both.
 *  - fabric TRANSFER, which relabels a lot's warehouse without changing quantity.
 *  - lace CONSUMPTION against an allocation or issue note: that moves reserved → consumed and
 *    leaves `quantityAvailable` alone, so it must not move a balance built on available.
 *  - PRICE_CORRECTION / QUALITY_DOWNGRADE: value and grade, not quantity.
 */
export function classifyTxn(
  kind: MaterialLedgerKind,
  txn: Pick<RawTxn, 'transactionType' | 'referenceType'>
): { direction: Direction; kind: LedgerEntryKind } | null {
  const t = txn.transactionType;
  const ref = txn.referenceType;

  if (t === 'PRICE_CORRECTION' || t === 'QUALITY_DOWNGRADE') return null;
  if (t === 'STOCK_IN' || t === 'RECEIPT' || t === 'EMBROIDERY_RECEIPT') return null;

  if (t === 'ADJUSTMENT_IN') return { direction: 'IN', kind: 'ADJUSTMENT' };
  if (t === 'ADJUSTMENT_OUT') return { direction: 'OUT', kind: 'ADJUSTMENT' };

  if (kind === 'LACE') {
    // Reservation moves change `quantityAvailable`, so they belong on the ledger — shown as
    // RESERVE/RELEASE rather than as issues, because the lace has not left the building.
    if (t === 'ALLOCATION' || t === 'TRANSFER_OUT') return { direction: 'OUT', kind: 'RESERVE' };
    if (t === 'RETURN' && ref === 'ALLOCATION') return { direction: 'IN', kind: 'RELEASE' };
    if (t === 'CONSUMPTION' && (ref === 'ALLOCATION' || ref === 'ISSUE_NOTE')) return null;
  }

  if (t === 'ALLOCATION') return null;
  if (t === 'TRANSFER') return kind === 'FABRIC' ? null : { direction: 'OUT', kind: 'TRANSFER' };
  if (t === 'TRANSFER_OUT') return { direction: 'OUT', kind: 'TRANSFER' };
  if (t === 'TRANSFER_IN') return { direction: 'IN', kind: 'TRANSFER' };

  if (t === 'CONSUMPTION' || t === 'ISSUE' || t === 'EMBROIDERY_SEND_OUT') {
    return { direction: 'OUT', kind: ref === 'TRANSFER' ? 'TRANSFER' : 'ISSUE' };
  }

  if (t === 'RETURN' || t === 'EMBROIDERY_CANCELLED') return { direction: 'IN', kind: 'RETURN' };
  if (t === 'RETURN_TO_SUPPLIER') return { direction: 'OUT', kind: 'RETURN' };

  return null;
}

const signed = (e: Pick<LedgerEvent, 'direction' | 'qty'>): number => (e.direction === 'IN' ? e.qty : -e.qty);

// ---------------------------------------------------------------------------
// Pure: lot receipts by balance-back
// ---------------------------------------------------------------------------

export interface RawLot {
  id: string;
  quantityAvailable: number;
  quantityReserved: number;
  receivedDate: Date | null;
  warehouse: { id: string; name: string } | null;
  unit: string;
  label: string | null;
  /** What the paperwork said arrived, where it was recorded — used only to flag disagreement. */
  declaredQty: number | null;
  source: LedgerSource;
}

/**
 * @param movements every non-receipt event for these lots
 * @param unattributedNet signed total of events that changed a lot's available quantity WITHOUT
 *   naming which lot — a fabric Stock Out is the live case: it deducts lots FIFO but its
 *   `stock_movements` row carries no lot id. Left out, the receipts would be short by exactly
 *   that amount and the ledger would stop tying to on-hand. It is folded into the earliest lot,
 *   which is flagged, because the alternative (spreading it silently) hides the imprecision.
 */
export function deriveLotReceipts(lots: RawLot[], movements: LedgerEvent[], unattributedNet = 0): LedgerEvent[] {
  const movementsByLot = new Map<string, LedgerEvent[]>();
  for (const event of movements) {
    if (!event.lot) continue;
    const list = movementsByLot.get(event.lot.id) ?? [];
    list.push(event);
    movementsByLot.set(event.lot.id, list);
  }

  const earliestLotId = [...lots].sort((a, b) => (a.receivedDate?.getTime() ?? 0) - (b.receivedDate?.getTime() ?? 0))[0]
    ?.id;

  return lots.map((lot) => {
    const lotMovements = movementsByLot.get(lot.id) ?? [];
    const net = lotMovements.reduce((sum, e) => toNumber(addCurrency(sum, signed(e))), 0);
    let qty = toNumber(subtractCurrency(lot.quantityAvailable, net));

    const flags: string[] = [];
    if (lot.id === earliestLotId && Math.abs(unattributedNet) > 0.005) {
      qty = toNumber(subtractCurrency(qty, unattributedNet));
      flags.push(
        `Includes ${Math.abs(unattributedNet).toFixed(2)} whose lot was never recorded — shown against the oldest lot`
      );
    }
    if (qty < -0.005) {
      flags.push('Derived receipt is negative — this lot has movements its receipt cannot account for');
    }
    if (lot.declaredQty != null && Math.abs(lot.declaredQty - qty) > 0.005) {
      // Which way it disagrees tells the reader what to look for. More implied than recorded
      // usually means a movement was written twice — the classic case is the legacy duplicate
      // TRANSFER_OUT that challan transfers used to write alongside their CONSUMPTION row.
      flags.push(
        qty > lot.declaredQty
          ? `Receipt recorded as ${lot.declaredQty.toFixed(2)} but the movements need ${qty.toFixed(2)} to balance — check for a movement counted twice`
          : `Receipt recorded as ${lot.declaredQty.toFixed(2)} but the movements only account for ${qty.toFixed(2)} — a movement may be missing`
      );
    }

    // A backdated Stock In sets receivedDate in the past while its movements are stamped now; a
    // receipt dated after its own issues would drive the running balance negative for no reason.
    const earliestMovement = lotMovements.reduce<Date | null>(
      (min, e) => (min === null || e.date < min ? e.date : min),
      null
    );
    const received = lot.receivedDate ?? earliestMovement ?? new Date(0);
    const date = earliestMovement && earliestMovement < received ? earliestMovement : received;

    return {
      id: `lot:${lot.id}`,
      date,
      seq: 0,
      direction: 'IN' as const,
      kind: 'RECEIPT' as const,
      qty,
      unit: lot.unit,
      warehouse: lot.warehouse,
      lot: { id: lot.id, label: lot.label },
      source: lot.source,
      remarks: null,
      performedBy: null,
      flags,
    };
  });
}

// ---------------------------------------------------------------------------
// Pure: events → ledger
// ---------------------------------------------------------------------------

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

const KIND_ORDER: Record<LedgerEntryKind, number> = {
  RECEIPT: 0,
  RETURN: 1,
  RELEASE: 2,
  TRANSFER: 3,
  ADJUSTMENT: 4,
  RESERVE: 5,
  ISSUE: 6,
};

export function buildLedger(
  events: LedgerEvent[],
  query: LedgerQuery
): { opening: number | null; rows: LedgerRow[]; totalIn: number; totalOut: number; closing: number } {
  const from = query.from ? startOfDay(query.from) : null;
  const to = query.to ? endOfDay(query.to) : null;

  const scoped = query.warehouseId ? events.filter((e) => e.warehouse?.id === query.warehouseId) : events;

  const sorted = [...scoped].sort(
    (a, b) =>
      a.date.getTime() - b.date.getTime() ||
      a.seq - b.seq ||
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      a.id.localeCompare(b.id)
  );

  let opening: number | null = null;
  if (from) {
    opening = sorted.filter((e) => e.date < from).reduce((sum, e) => toNumber(addCurrency(sum, signed(e))), 0);
  }

  let balance = opening ?? 0;
  let totalIn = 0;
  let totalOut = 0;
  const rows: LedgerRow[] = [];

  for (const event of sorted) {
    if (from && event.date < from) continue;
    if (to && event.date > to) continue;
    balance = toNumber(addCurrency(balance, signed(event)));
    if (event.direction === 'IN') totalIn = toNumber(addCurrency(totalIn, event.qty));
    else totalOut = toNumber(addCurrency(totalOut, event.qty));
    rows.push({ ...event, balance });
  }

  return { opening, rows, totalIn, totalOut, closing: balance };
}

// ---------------------------------------------------------------------------
// Reference resolution
// ---------------------------------------------------------------------------

const ROUTE: Partial<Record<SourceType, (id: string) => string>> = {
  GRN: (id) => `/procurement/grn/${id}`,
  PO: (id) => `/procurement/purchase-orders/${id}`,
  JOB_WORK_ORDER: (id) => `/job-work-orders/${id}`,
  CHALLAN: (id) => `/manufacturing/challans/${id}`,
  CUTTING: (id) => `/manufacturing/cutting/${id}`,
};

function routeFor(type: SourceType, id: string | null): string | null {
  if (!id) return null;
  const build = ROUTE[type];
  return build ? build(id) : null;
}

/** Everything the events referenced, fetched in one batch per table. */
interface ReferenceMaps {
  challans: Map<
    string,
    {
      number: string;
      toName: string;
      fromName: string;
      jwoId: string | null;
      jwoNumber: string | null;
      processor: string | null;
    }
  >;
  grns: Map<
    string,
    {
      number: string;
      supplier: string | null;
      poId: string | null;
      poNumber: string | null;
      jwoNumber: string | null;
      processor: string | null;
    }
  >;
  jwos: Map<string, { number: string; processor: string | null; style: string | null; processType: string }>;
  issueNotes: Map<string, { number: string; style: string | null }>;
  batches: Map<string, { number: string }>;
  sendOuts: Map<string, { number: string; supplier: string | null }>;
  users: Map<string, string>;
}

async function resolveReferences(events: LedgerEvent[]): Promise<ReferenceMaps> {
  const ids = (type: string) => [
    ...new Set(events.filter((e) => e.source.type === type && e.source.id).map((e) => e.source.id!)),
  ];

  const challanIds = ids('CHALLAN');
  const grnIds = ids('GRN');
  const jwoIds = ids('JOB_WORK_ORDER');
  const issueNoteIds = ids('ISSUE_NOTE');
  const batchIds = ids('PROCESSING_BATCH');
  const sendOutIds = ids('EXTERNAL_PROCESS');
  const userIds = [...new Set(events.map((e) => e.performedBy).filter((v): v is string => !!v))];

  const [challans, grns, jwos, issueNotes, batches, sendOuts, users] = await Promise.all([
    challanIds.length
      ? prisma.challans.findMany({
          where: { id: { in: challanIds } },
          select: {
            id: true,
            challanNumber: true,
            toName: true,
            fromName: true,
            jobWorkOrderId: true,
            jobWorkOrder: { select: { jobWorkNumber: true, processor: { select: { name: true } } } },
          },
        })
      : [],
    grnIds.length
      ? prisma.goods_receiving_notes.findMany({
          where: { id: { in: grnIds } },
          select: {
            id: true,
            grnNumber: true,
            suppliers: { select: { name: true } },
            poId: true,
            purchase_orders: { select: { poNumber: true } },
            jobWorkOrder: { select: { jobWorkNumber: true, processor: { select: { name: true } } } },
          },
        })
      : [],
    jwoIds.length
      ? prisma.job_work_orders.findMany({
          where: { id: { in: jwoIds } },
          select: {
            id: true,
            jobWorkNumber: true,
            processType: true,
            processor: { select: { name: true } },
            style: { select: { styleCode: true } },
          },
        })
      : [],
    issueNoteIds.length
      ? prisma.lace_issue_note.findMany({
          where: { id: { in: issueNoteIds } },
          select: { id: true, issueNumber: true, style: { select: { styleCode: true } } },
        })
      : [],
    batchIds.length
      ? prisma.processing_batch.findMany({ where: { id: { in: batchIds } }, select: { id: true, batchNumber: true } })
      : [],
    sendOutIds.length
      ? prisma.external_process_send_outs.findMany({
          where: { id: { in: sendOutIds } },
          select: { id: true, batchNumber: true, supplier: { select: { name: true } } },
        })
      : [],
    userIds.length
      ? prisma.users.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true, lastName: true } })
      : [],
  ]);

  return {
    challans: new Map(
      challans.map((c) => [
        c.id,
        {
          number: c.challanNumber,
          toName: c.toName,
          fromName: c.fromName,
          jwoId: c.jobWorkOrderId,
          jwoNumber: c.jobWorkOrder?.jobWorkNumber ?? null,
          processor: c.jobWorkOrder?.processor?.name ?? null,
        },
      ])
    ),
    grns: new Map(
      grns.map((g) => [
        g.id,
        {
          number: g.grnNumber,
          supplier: g.suppliers?.name ?? null,
          poId: g.poId,
          poNumber: g.purchase_orders?.poNumber ?? null,
          jwoNumber: g.jobWorkOrder?.jobWorkNumber ?? null,
          processor: g.jobWorkOrder?.processor?.name ?? null,
        },
      ])
    ),
    jwos: new Map(
      jwos.map((j) => [
        j.id,
        {
          number: j.jobWorkNumber,
          processor: j.processor?.name ?? null,
          style: j.style?.styleCode ?? null,
          processType: j.processType,
        },
      ])
    ),
    issueNotes: new Map(issueNotes.map((n) => [n.id, { number: n.issueNumber, style: n.style?.styleCode ?? null }])),
    batches: new Map(batches.map((b) => [b.id, { number: b.batchNumber }])),
    sendOuts: new Map(sendOuts.map((s) => [s.id, { number: s.batchNumber, supplier: s.supplier?.name ?? null }])),
    users: new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()])),
  };
}

/** Fill in document numbers, parties and links once the referenced rows are loaded. */
function applyReferences(events: LedgerEvent[], refs: ReferenceMaps): void {
  for (const event of events) {
    const { type, id } = event.source;
    if (event.performedBy) event.performedBy = refs.users.get(event.performedBy) ?? event.performedBy;
    if (!id) continue;

    switch (type) {
      case 'CHALLAN': {
        const c = refs.challans.get(id);
        if (!c) break;
        event.source.number = c.number;
        event.source.party = event.direction === 'IN' ? c.fromName : c.toName;
        event.source.destination = c.jwoNumber ? `${c.jwoNumber}${c.processor ? ` · ${c.processor}` : ''}` : c.toName;
        break;
      }
      case 'GRN': {
        const g = refs.grns.get(id);
        if (!g) break;
        event.source.number = g.number;
        // A job-work return is a receipt too, but from OUR processor, not from a seller —
        // labelling it with the supplier column would read as a purchase.
        event.source.party = g.jwoNumber ? `${g.processor ?? 'processor'} (job work return)` : g.supplier;
        event.source.destination = g.jwoNumber ?? g.poNumber;
        break;
      }
      case 'JOB_WORK_ORDER': {
        const j = refs.jwos.get(id);
        if (!j) break;
        event.source.number = j.number;
        event.source.party = j.processor;
        event.source.destination = [j.processType, j.style].filter(Boolean).join(' · ') || null;
        break;
      }
      case 'ISSUE_NOTE': {
        const n = refs.issueNotes.get(id);
        if (!n) break;
        event.source.number = n.number;
        event.source.destination = n.style;
        break;
      }
      case 'PROCESSING_BATCH': {
        const b = refs.batches.get(id);
        if (b) event.source.number = b.number;
        break;
      }
      case 'EXTERNAL_PROCESS': {
        const s = refs.sendOuts.get(id);
        if (!s) break;
        event.source.number = s.number;
        event.source.party = s.supplier;
        break;
      }
    }
    event.source.route = routeFor(type, id);
  }
}

/** `TransactionReferenceType` → how the ledger labels it. */
function sourceFromReference(referenceType: string | null, referenceId: string | null): LedgerSource {
  const base = { number: null, id: referenceId, route: null, party: null, destination: null };
  switch (referenceType) {
    case 'CHALLAN':
      return { ...base, type: 'CHALLAN' };
    case 'GRN':
    case 'GRN_REJECTION':
      return { ...base, type: 'GRN' };
    case 'JOB_WORK_ORDER':
      return { ...base, type: 'JOB_WORK_ORDER' };
    case 'EXTERNAL_PROCESS':
    case 'EMBROIDERY_SEND_OUT':
      return { ...base, type: 'EXTERNAL_PROCESS' };
    case 'ISSUE_NOTE':
      return { ...base, type: 'ISSUE_NOTE' };
    case 'PROCESSING_BATCH':
    case 'PROCESSING_DELIVERY':
      return { ...base, type: 'PROCESSING_BATCH' };
    case 'ORDER':
      return { ...base, type: 'ORDER' };
    case 'PROCUREMENT':
      return { ...base, type: 'PROCUREMENT' };
    case 'TRANSFER':
    case 'ALLOCATION':
      return { ...base, type: 'TRANSFER' };
    case 'MANUAL':
    case 'MANUAL_ADJUSTMENT':
    case 'ADJUSTMENT':
      return { ...base, type: 'ADJUSTMENT', id: null };
    default:
      return { ...base, type: 'MANUAL', id: null };
  }
}

// ---------------------------------------------------------------------------
// Loaders — one per material kind
// ---------------------------------------------------------------------------

const num = (v: unknown): number => toNumber(toCurrency(v as never));

/** Specialized transactions → events, sharing one classification and one shape. */
function txnsToEvents(kind: MaterialLedgerKind, txns: RawTxn[], lots: Map<string, RawLot>): LedgerEvent[] {
  const events: LedgerEvent[] = [];
  for (const txn of txns) {
    const classified = classifyTxn(kind, txn);
    if (!classified) continue;
    const lot = lots.get(txn.lotId);
    events.push({
      id: `txn:${txn.id}`,
      date: txn.date,
      seq: 1,
      direction: classified.direction,
      kind: classified.kind,
      // Never the stored sign: fabric writers store OUT as positive, greige/lace/thread as negative.
      qty: Math.abs(txn.quantity),
      unit: lot?.unit ?? '',
      warehouse: lot?.warehouse ?? null,
      lot: { id: txn.lotId, label: lot?.label ?? null },
      source: sourceFromReference(txn.referenceType, txn.referenceId),
      remarks: txn.notes,
      performedBy: txn.performedBy,
      flags: [],
    });
  }
  return events;
}

function warehouseOf(w: { id: string; warehouseName: string } | null | undefined) {
  return w ? { id: w.id, name: w.warehouseName } : null;
}

async function loadGreige(greigeId: string): Promise<{ lots: RawLot[]; txns: RawTxn[] }> {
  const rows = await prisma.greige_stock.findMany({
    // Every lot, those a processor holds included: a Stock-Out's lot at the processor's unit is on hand
    // there (Phase 4e) — the store lot's consumption is the move out, this lot the move in.
    where: { greigeId },
    select: {
      id: true,
      quantityAvailable: true,
      quantityReserved: true,
      receivedDate: true,
      unit: true,
      rollNumbers: true,
      sourceType: true,
      procurementId: true,
      sourceChallanId: true,
      nominalQuantity: true,
      calculatedActualMeters: true,
      warehouse: { select: { id: true, warehouseName: true } },
      grnItem: { select: { grnId: true } },
      transactions: {
        select: {
          id: true,
          stockId: true,
          transactionType: true,
          referenceType: true,
          referenceId: true,
          quantity: true,
          notes: true,
          transactionDate: true,
          performedById: true,
        },
      },
    },
  });

  const lots: RawLot[] = rows.map((lot) => {
    const source: LedgerSource = lot.grnItem?.grnId
      ? { type: 'GRN', number: null, id: lot.grnItem.grnId, route: null, party: null, destination: null }
      : lot.sourceChallanId
        ? { type: 'CHALLAN', number: null, id: lot.sourceChallanId, route: null, party: null, destination: null }
        : // `createGreigeStock` mints a fabric_procurement even for a hand entry, so sourceType
          // decides first — otherwise every manual lot would claim to be a purchase.
          lot.sourceType === 'MANUAL' || lot.sourceType === 'ADJUSTMENT'
          ? { type: 'STOCK_IN', number: null, id: null, route: null, party: null, destination: null }
          : lot.procurementId
            ? { type: 'PROCUREMENT', number: null, id: lot.procurementId, route: null, party: null, destination: null }
            : {
                type: lot.sourceType === 'GRN' ? 'GRN' : 'STOCK_IN',
                number: lot.sourceType === 'GRN' ? 'receipt not linked' : null,
                id: null,
                route: null,
                party: null,
                destination: null,
              };

    return {
      id: lot.id,
      quantityAvailable: num(lot.quantityAvailable),
      quantityReserved: num(lot.quantityReserved),
      receivedDate: lot.receivedDate,
      warehouse: warehouseOf(lot.warehouse),
      unit: lot.unit,
      label: lot.rollNumbers,
      declaredQty:
        lot.calculatedActualMeters != null
          ? num(lot.calculatedActualMeters)
          : lot.nominalQuantity != null
            ? num(lot.nominalQuantity)
            : null,
      source,
    };
  });

  const txns: RawTxn[] = rows.flatMap((lot) =>
    lot.transactions.map((t) => ({
      id: t.id,
      lotId: t.stockId,
      transactionType: t.transactionType,
      referenceType: t.referenceType,
      referenceId: t.referenceId,
      quantity: num(t.quantity),
      notes: t.notes,
      date: t.transactionDate,
      performedBy: t.performedById,
    }))
  );

  return { lots, txns };
}

async function loadFabric(fabricId: string): Promise<{ lots: RawLot[]; txns: RawTxn[]; extra: LedgerEvent[] }> {
  const rows = await prisma.fabric_stock.findMany({
    where: { fabricId },
    select: {
      id: true,
      quantityAvailable: true,
      quantityReserved: true,
      receivedDate: true,
      unit: true,
      rollNumbers: true,
      procurementId: true,
      warehouse: { select: { id: true, warehouseName: true } },
      grnItem: { select: { grnId: true } },
      embroideryResultOf: { select: { id: true } },
      stockTransactions: {
        select: {
          id: true,
          stockId: true,
          transactionType: true,
          referenceType: true,
          referenceId: true,
          quantity: true,
          notes: true,
          transactionDate: true,
          createdById: true,
        },
      },
    },
  });

  const lots: RawLot[] = rows.map((lot) => ({
    id: lot.id,
    quantityAvailable: num(lot.quantityAvailable),
    quantityReserved: num(lot.quantityReserved),
    receivedDate: lot.receivedDate,
    warehouse: warehouseOf(lot.warehouse),
    unit: lot.unit,
    label: lot.rollNumbers,
    declaredQty: null,
    source: lot.grnItem?.grnId
      ? { type: 'GRN', number: null, id: lot.grnItem.grnId, route: null, party: null, destination: null }
      : lot.embroideryResultOf
        ? {
            type: 'EXTERNAL_PROCESS',
            number: null,
            id: lot.embroideryResultOf.id,
            route: null,
            party: null,
            destination: null,
          }
        : lot.procurementId
          ? { type: 'PROCUREMENT', number: null, id: lot.procurementId, route: null, party: null, destination: null }
          : { type: 'STOCK_IN', number: null, id: null, route: null, party: null, destination: null },
  }));

  const txns: RawTxn[] = rows.flatMap((lot) =>
    lot.stockTransactions.map((t) => ({
      id: t.id,
      lotId: t.stockId,
      transactionType: t.transactionType,
      referenceType: t.referenceType,
      referenceId: t.referenceId,
      quantity: num(t.quantity),
      notes: t.notes,
      date: t.transactionDate,
      performedBy: t.createdById,
    }))
  );

  const lotIds = rows.map((l) => l.id);
  const lotById = new Map(lots.map((l) => [l.id, l]));
  const extra: LedgerEvent[] = [];

  if (lotIds.length) {
    // Fabric issued on a challan writes NO transaction row — `challan.service.ts` decrements the
    // lot directly. The challan line is therefore the only record that this fabric went to
    // cutting. A JWO challan is skipped because that path DOES write a transaction.
    const lines = await prisma.challan_items.findMany({
      where: { fabricStockId: { in: lotIds }, challan: { status: { notIn: ['DRAFT', 'CANCELLED'] } } },
      select: {
        id: true,
        fabricStockId: true,
        quantity: true,
        receivedQty: true,
        unit: true,
        jobWorkOrderId: true,
        challan: {
          select: {
            id: true,
            challanType: true,
            challanDate: true,
            issuedDate: true,
            receivedDate: true,
            jobWorkOrderId: true,
            grnId: true,
          },
        },
      },
    });

    for (const line of lines) {
      const belongsToJob = line.jobWorkOrderId != null || line.challan.jobWorkOrderId != null;
      if (belongsToJob) continue;
      const lot = line.fabricStockId ? lotById.get(line.fabricStockId) : undefined;
      const common = {
        unit: line.unit,
        warehouse: lot?.warehouse ?? null,
        lot: line.fabricStockId ? { id: line.fabricStockId, label: lot?.label ?? null } : null,
        source: {
          type: 'CHALLAN' as const,
          number: null,
          id: line.challan.id,
          route: null,
          party: null,
          destination: null,
        },
        remarks: null,
        performedBy: null,
        flags: [],
        seq: 1,
      };

      if (line.challan.challanType === 'OUTWARD' || line.challan.challanType === 'INTERNAL') {
        extra.push({
          ...common,
          id: `challan:${line.id}`,
          date: line.challan.issuedDate ?? line.challan.challanDate,
          direction: 'OUT',
          kind: 'ISSUE',
          qty: num(line.quantity),
        });
      } else if (line.challan.challanType === 'INWARD' && line.challan.grnId == null && num(line.receivedQty) > 0) {
        extra.push({
          ...common,
          id: `challan:${line.id}`,
          date: line.challan.receivedDate ?? line.challan.challanDate,
          direction: 'IN',
          kind: 'RETURN',
          qty: num(line.receivedQty),
        });
      }
    }
  }

  return { lots, txns, extra };
}

async function loadLace(laceId: string): Promise<{ lots: RawLot[]; txns: RawTxn[] }> {
  const rows = await prisma.lace_stock.findMany({
    where: { laceId },
    select: {
      id: true,
      quantityAvailable: true,
      quantityReserved: true,
      receivedDate: true,
      unit: true,
      lotNumber: true,
      rollNumbers: true,
      grnItem: { select: { grnId: true } },
      warehouse: { select: { id: true, warehouseName: true } },
      transactions: {
        select: {
          id: true,
          stockId: true,
          transactionType: true,
          referenceType: true,
          referenceId: true,
          quantity: true,
          notes: true,
          transactionDate: true,
          performedById: true,
        },
      },
    },
  });

  const lots: RawLot[] = rows.map((lot) => ({
    id: lot.id,
    quantityAvailable: num(lot.quantityAvailable),
    quantityReserved: num(lot.quantityReserved),
    receivedDate: lot.receivedDate,
    warehouse: warehouseOf(lot.warehouse),
    unit: lot.unit,
    label: lot.lotNumber ?? lot.rollNumbers,
    declaredQty: null,
    source: lot.grnItem?.grnId
      ? { type: 'GRN', number: null, id: lot.grnItem.grnId, route: null, party: null, destination: null }
      : { type: 'STOCK_IN', number: null, id: null, route: null, party: null, destination: null },
  }));

  const txns: RawTxn[] = rows.flatMap((lot) =>
    lot.transactions.map((t) => ({
      id: t.id,
      lotId: t.stockId,
      transactionType: t.transactionType,
      referenceType: t.referenceType,
      referenceId: t.referenceId,
      quantity: num(t.quantity),
      notes: t.notes,
      date: t.transactionDate,
      performedBy: t.performedById,
    }))
  );

  return { lots, txns };
}

async function loadThread(threadId: string): Promise<{ lots: RawLot[]; txns: RawTxn[] }> {
  const rows = await prisma.thread_stock.findMany({
    where: { threadId },
    select: {
      id: true,
      quantityAvailable: true,
      quantityReserved: true,
      receivedDate: true,
      unit: true,
      supplierLotNumber: true,
      warehouse: { select: { id: true, warehouseName: true } },
      transactions: {
        select: {
          id: true,
          stockId: true,
          transactionType: true,
          referenceType: true,
          referenceId: true,
          quantity: true,
          notes: true,
          transactionDate: true,
          performedById: true,
        },
      },
    },
  });

  const lots: RawLot[] = rows.map((lot) => {
    // thread_stock has no grnItem link; its receipt GRN is only on the STOCK_IN transaction.
    const receipt = lot.transactions.find((t) => t.transactionType === 'STOCK_IN' || t.transactionType === 'RECEIPT');
    return {
      id: lot.id,
      quantityAvailable: num(lot.quantityAvailable),
      quantityReserved: num(lot.quantityReserved),
      receivedDate: lot.receivedDate,
      warehouse: warehouseOf(lot.warehouse),
      unit: lot.unit,
      label: lot.supplierLotNumber,
      declaredQty: null,
      source:
        receipt?.referenceType === 'GRN' && receipt.referenceId
          ? { type: 'GRN', number: null, id: receipt.referenceId, route: null, party: null, destination: null }
          : { type: 'STOCK_IN', number: null, id: null, route: null, party: null, destination: null },
    };
  });

  const txns: RawTxn[] = rows.flatMap((lot) =>
    lot.transactions.map((t) => ({
      id: t.id,
      lotId: t.stockId,
      transactionType: t.transactionType,
      referenceType: t.referenceType,
      referenceId: t.referenceId,
      quantity: num(t.quantity),
      notes: t.notes,
      date: t.transactionDate,
      performedBy: t.performedById,
    }))
  );

  return { lots, txns };
}

const MOVEMENT_KIND: Record<string, { direction: Direction; kind: LedgerEntryKind }> = {
  STOCK_IN: { direction: 'IN', kind: 'RECEIPT' },
  STOCK_OUT: { direction: 'OUT', kind: 'ISSUE' },
  TRANSFER_IN: { direction: 'IN', kind: 'TRANSFER' },
  TRANSFER_OUT: { direction: 'OUT', kind: 'TRANSFER' },
  ADJUSTMENT_IN: { direction: 'IN', kind: 'ADJUSTMENT' },
  ADJUSTMENT_OUT: { direction: 'OUT', kind: 'ADJUSTMENT' },
};

/** `stock_movements.referenceType` is a free string, not the transaction enum. */
function sourceFromMovement(
  referenceType: string | null,
  referenceId: string | null,
  referenceNumber: string | null
): LedgerSource {
  const source = sourceFromReference(referenceType, referenceId);
  if (referenceNumber) source.number = referenceNumber;
  if (referenceType === 'BULK_STOCK_IN' || referenceType === 'MANUAL' || !referenceType) {
    return { type: 'STOCK_IN', number: referenceNumber, id: null, route: null, party: null, destination: null };
  }
  return source;
}

async function loadGenericMovements(materialId: string, onlyOut: boolean): Promise<LedgerEvent[]> {
  const rows = await prisma.stock_movements.findMany({
    where: {
      materialId,
      ...(onlyOut
        ? {
            movementType: { in: ['STOCK_OUT', 'TRANSFER_OUT', 'ADJUSTMENT_OUT'] },
            // GRN and challan rows would duplicate the lot receipt and the challan line.
            NOT: { referenceType: { in: ['GRN', 'GRN_REJECTION', 'CHALLAN'] } },
          }
        : {}),
    },
    select: {
      id: true,
      movementType: true,
      quantity: true,
      unit: true,
      referenceType: true,
      referenceId: true,
      referenceNumber: true,
      remarks: true,
      movementDate: true,
      performedById: true,
      warehouses: { select: { id: true, warehouseName: true } },
      suppliers: { select: { name: true } },
    },
  });

  return rows.flatMap((m) => {
    const mapped = MOVEMENT_KIND[m.movementType];
    if (!mapped) return [];
    const source = sourceFromMovement(m.referenceType, m.referenceId, m.referenceNumber);
    if (m.suppliers?.name) source.party = m.suppliers.name;
    return [
      {
        id: `mov:${m.id}`,
        date: m.movementDate,
        seq: mapped.kind === 'RECEIPT' ? 0 : 1,
        direction: mapped.direction,
        kind: mapped.kind,
        qty: Math.abs(num(m.quantity)),
        unit: m.unit,
        warehouse: warehouseOf(m.warehouses),
        lot: null,
        source,
        remarks: m.remarks,
        performedBy: m.performedById,
        flags: [],
      },
    ];
  });
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

function kindOf(material: {
  greigeId: string | null;
  fabricId: string | null;
  laceId: string | null;
  threadId: string | null;
}): { kind: MaterialLedgerKind; masterId: string | null } {
  // Same precedence the stock-routing helper uses, so the ledger reads the table the writes went to.
  if (material.greigeId) return { kind: 'GREIGE', masterId: material.greigeId };
  if (material.fabricId) return { kind: 'FABRIC', masterId: material.fabricId };
  if (material.laceId) return { kind: 'LACE', masterId: material.laceId };
  if (material.threadId) return { kind: 'THREAD', masterId: material.threadId };
  return { kind: 'GENERIC', masterId: null };
}

export async function getMaterialLedger(materialId: string, query: LedgerQuery): Promise<MaterialLedger> {
  const material = await prisma.materials.findUnique({
    where: { id: materialId },
    select: {
      id: true,
      code: true,
      name: true,
      unit: true,
      materialType: true,
      greigeId: true,
      fabricId: true,
      laceId: true,
      threadId: true,
      labelId: true,
      sizeVariantId: true,
    },
  });
  if (!material) throw new MaterialNotFoundError(materialId);

  const { kind, masterId } = kindOf(material);
  const warnings: string[] = [];

  let lots: RawLot[] = [];
  let txns: RawTxn[] = [];
  let events: LedgerEvent[] = [];

  if (kind === 'GREIGE' && masterId) {
    ({ lots, txns } = await loadGreige(masterId));
  } else if (kind === 'FABRIC' && masterId) {
    const loaded = await loadFabric(masterId);
    lots = loaded.lots;
    txns = loaded.txns;
    events.push(...loaded.extra);
    // Stock Out / Transfer / Adjust on a fabric lot writes no transaction row, so the movement
    // is the only trace. IN movements are skipped: those create a lot, which IS the receipt.
    events.push(...(await loadGenericMovements(materialId, true)));
  } else if (kind === 'LACE' && masterId) {
    ({ lots, txns } = await loadLace(masterId));
  } else if (kind === 'THREAD' && masterId) {
    ({ lots, txns } = await loadThread(masterId));
  } else {
    events = await loadGenericMovements(materialId, false);
  }

  if (kind !== 'GENERIC') {
    const lotMap = new Map(lots.map((l) => [l.id, l]));
    // `events` already holds the fabric extras (challan lines, manual movements); the receipts
    // must balance back against those AND the transactions, each counted exactly once.
    const movements = [...events, ...txnsToEvents(kind, txns, lotMap)];
    const unattributedNet = movements
      .filter((e) => e.lot == null)
      .reduce((sum, e) => toNumber(addCurrency(sum, signed(e))), 0);
    events = [...movements, ...deriveLotReceipts(lots, movements, unattributedNet)];
  }

  const refs = await resolveReferences(events);
  applyReferences(events, refs);

  const ledger = buildLedger(events, query);
  const allTime = buildLedger(events, { warehouseId: query.warehouseId });

  // --- on hand ------------------------------------------------------------------------------
  const stockLevelRows = await prisma.stock_levels.findMany({
    where: { materialId, ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}) },
    select: { quantity: true },
  });
  const stockLevels = stockLevelRows.length
    ? stockLevelRows.reduce((sum, r) => toNumber(addCurrency(sum, r.quantity)), 0)
    : null;

  const scopedLots = query.warehouseId ? lots.filter((l) => l.warehouse?.id === query.warehouseId) : lots;
  const lotsAvailable =
    kind === 'GENERIC' ? null : scopedLots.reduce((s, l) => toNumber(addCurrency(s, l.quantityAvailable)), 0);
  const lotsReserved =
    kind === 'GENERIC' ? null : scopedLots.reduce((s, l) => toNumber(addCurrency(s, l.quantityReserved)), 0);

  const drift =
    (stockLevels != null && Math.abs(stockLevels - allTime.closing) > 0.005) ||
    (lotsAvailable != null && Math.abs(lotsAvailable - allTime.closing) > 0.005);

  if (events.some((e) => e.warehouse == null) && query.warehouseId) {
    warnings.push('Some movements have no warehouse recorded and are not shown while a warehouse filter is on.');
  }
  for (const event of events) {
    for (const flag of event.flags) warnings.push(flag);
  }

  const warehouse = query.warehouseId
    ? await prisma.warehouses.findUnique({ where: { id: query.warehouseId }, select: { warehouseName: true } })
    : null;

  return {
    material: {
      id: material.id,
      code: material.code,
      name: material.name,
      unit: material.unit,
      materialType: material.materialType,
      kind,
      sizeVariant: null,
    },
    filters: {
      from: query.from ?? null,
      to: query.to ?? null,
      warehouseId: query.warehouseId ?? null,
      warehouseName: warehouse?.warehouseName ?? null,
    },
    opening: ledger.opening,
    rows: ledger.rows,
    totals: { in: ledger.totalIn, out: ledger.totalOut, closing: ledger.closing },
    onHand: {
      stockLevels,
      lotsAvailable,
      lotsReserved,
      ledgerClosingAllTime: allTime.closing,
      drift,
    },
    warnings: [...new Set(warnings)],
  };
}

export default {
  classifyTxn,
  deriveLotReceipts,
  buildLedger,
  getMaterialLedger,
};
