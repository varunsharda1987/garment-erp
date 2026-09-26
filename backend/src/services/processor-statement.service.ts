/**
 * Processor Statement — a greige-wise reconciliation of everything one processor holds.
 *
 * WHAT IT ANSWERS: "How much of our cloth is with this dyer, and does it add up?" — as a
 * statement we PRINT AND SEND TO THE PROCESSOR to confirm. So the figures must be ones the
 * processor can tick off against their own register: dated sends, dated receipts, the agreed
 * shrinkage they quoted, and what is still lying with them.
 *
 * THE MODEL IS A LEDGER, NOT A SNAPSHOT. Per (processor, material) we build dated events and
 * sum them into a window:
 *
 *   closing = opening + sent − received − returned − shrinkage − shortfall
 *
 * `opening` is every event before the window; the period columns are the events inside it.
 * A snapshot of `job_work_orders.qtySentMeters − qtyReceivedMeters` cannot do this: it has no
 * opening balance, it cannot be asked "as at 31 Aug", and it silently drops the two ways cloth
 * reaches a processor WITHOUT a job (a transfer challan) and comes back without one.
 *
 * WHY SHRINKAGE AND SHORTFALL ARE SEPARATE COLUMNS (owner, 2026-09-21): a dyer who returns
 * 900 m for 1000 m sent at an agreed 10 % has lost us nothing — printing one "loss 100 m"
 * column invites an argument every month. Agreed shrinkage is what we accepted when we placed
 * the job; shortfall is the only figure either side needs to discuss. They are separable
 * because `shrinkage + shortfall === sent − returned − received`, so Balance still reconciles.
 *
 * SOURCES (each event has exactly ONE authoritative source — no cross-source dedup guessing):
 *   SENT      ISSUED outward challan lines (job lines by `challan_items.jobWorkOrderId`, which
 *             survives a consolidated dispatch where the HEADER's job is null), plus transfer
 *             challans that parked a lot at this processor, plus the Rule 45 challans for goods a
 *             supplier delivered STRAIGHT to it (`challans.directSupplyGrnId`) — dated the day the
 *             processor received them. A job that later takes that cloth where it lies adds no
 *             second SENT: its lot was already here (`virtual`).
 *   RECEIVED  ACCEPTED GRNs keyed on `goods_receiving_notes.jobWorkOrderId` — one per part.
 *             NEVER the job's own `grnId`: that names only the LATEST part.
 *   RETURNED  the INWARD challan GREIGE line, not the `greige_stock_transaction` RETURN row —
 *             the cancel path writes an identical row shape and stamps it `now()` instead of
 *             the user's return date (see `unissueForCancel`).
 *   SHRINKAGE
 *   SHORTFALL derived per job at its final receipt, on the same basis as vendor performance.
 */

import prisma from '../config/database';
import {
  addCurrency,
  applyShrinkageLoss,
  divideCurrency,
  multiplyCurrency,
  subtractCurrency,
  toCurrency,
  toNumber,
} from '../utils/currency';
import { foldActual } from '../utils/fold-length';
import { resolveJwoGreige } from './helpers/jwo-greige.helper';
import { unitToJwoUom, type JwoUom } from '../utils/units';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MaterialKind = 'GREIGE' | 'LACE' | 'FABRIC' | 'GARMENT';
export type Uom = JwoUom;
export type EventType = 'SENT' | 'RECEIVED' | 'RETURNED' | 'SHRINKAGE' | 'SHORTFALL';
export type RefKind = 'CHALLAN' | 'TRANSFER' | 'DIRECT_SUPPLY' | 'GRN' | 'JOB' | 'SEND_OUT';

export interface MaterialKey {
  kind: MaterialKind;
  id: string;
  code: string;
  name: string;
}

export interface LedgerEvent {
  type: EventType;
  date: Date;
  /** Always positive EXCEPT SHORTFALL, where a negative value means the processor sent back MORE. */
  qty: number;
  unit: Uom;
  material: MaterialKey;
  jwoId: string | null;
  ref: string;
  refKind: RefKind;
}

export interface StatementReceipt {
  grnNumber: string;
  date: Date;
  qty: number;
}

/** One job's line under its material row — what the processor ticks off. */
export interface JobLine {
  jwoId: string;
  jobWorkNumber: string;
  processType: string;
  jwoStatus: string;
  material: MaterialKey;
  unit: Uom;
  sentDate: Date | null;
  sentQty: number;
  challanNumbers: string[];
  receipts: StatementReceipt[];
  returned: number;
  agreedShrinkagePct: number | null;
  dueBack: number | null;
  shrinkage: number;
  shortfall: number;
  balance: number;
  /** Its greige was already at the processor, so no challan moved — flagged, not hidden. */
  virtual: boolean;
  damaged: number | null;
  /** Never printed. The processor's copy carries no tolerance verdict or debit figure. */
  screenOnly: {
    qtyNormalLoss: number | null;
    qtyAbnormalLoss: number | null;
    tolerancePercent: number | null;
    isOverTolerance: boolean;
  };
}

export interface StatementRow {
  material: MaterialKey;
  unit: Uom;
  unitMixed: boolean;
  opening: number;
  sent: number;
  received: number;
  returned: number;
  shrinkage: number;
  shortfall: number;
  closing: number;
  jobs: JobLine[];
}

export interface StatementTotals {
  opening: number;
  sent: number;
  received: number;
  returned: number;
  shrinkage: number;
  shortfall: number;
  closing: number;
}

export interface StatementSection {
  kind: MaterialKind;
  title: string;
  unit: Uom;
  rows: StatementRow[];
  totals: StatementTotals;
}

export interface ProcessorStatement {
  processor: { id: string; code: string; name: string; gstin: string | null };
  periodStart: Date;
  periodEnd: Date;
  sections: StatementSection[];
  warnings: string[];
  generatedAt: Date;
}

export interface StatementPeriod {
  start: Date;
  end: Date;
}

// ---------- loader output (plain values, so the pure layer is unit-testable) -------------

export interface JobSource {
  id: string;
  jobWorkNumber: string;
  processType: string;
  jwoStatus: string;
  uom: string;
  qtySentMeters: number;
  qtyReceivedMeters: number | null;
  qtyBillable: number | null;
  expectedShrinkage: number | null;
  qtyNormalLoss: number | null;
  qtyAbnormalLoss: number | null;
  tolerancePercent: number | null;
  sentDate: Date | null;
  receivedDate: Date | null;
  remarks: string | null;
  /** Resolved candidates, most authoritative first — see `resolveJobKey`. */
  greige: MaterialKey | null;
  lace: MaterialKey | null;
  fabric: MaterialKey | null;
  garment: MaterialKey | null;
  /** True when the job's greige lot already sat at this processor (virtual issuance). */
  lotAtThisProcessor: boolean;
  receipts: StatementReceipt[];
  hasSendOuts: boolean;
}

export interface SentLineSource {
  id: string;
  challanId: string;
  challanNumber: string;
  challanDate: Date;
  jobWorkOrderId: string | null;
  quantity: number;
  unit: string;
  /** Resolved from the line's stock lot; null when the line named no lot we can identify. */
  material: MaterialKey | null;
  isTransfer: boolean;
  /** A Rule 45 challan for goods a supplier delivered straight to this processor (no job behind it) */
  isDirectSupply: boolean;
  /** The day the processor received the goods — for a direct-supply line, the SENT date (a late challan is dated later) */
  arrivedOn: Date | null;
}

export interface ReturnLineSource {
  jobWorkOrderId: string;
  challanNumber: string;
  challanDate: Date;
  quantity: number;
  unit: string;
}

export interface NoJobReturnSource {
  id: string;
  date: Date;
  qty: number;
  material: MaterialKey;
}

export interface SendOutSource {
  id: string;
  batchNumber: string;
  processType: string;
  unit: string;
  quantitySent: number;
  quantityReceived: number | null;
  quantityDamaged: number | null;
  sendDate: Date;
  actualReturnDate: Date | null;
  status: string;
  outwardChallanId: string | null;
  jobWorkOrderId: string | null;
  material: MaterialKey;
}

export interface StatementSources {
  processor: { id: string; code: string; name: string; gstin: string | null };
  jobs: JobSource[];
  sentLines: SentLineSource[];
  returnLines: ReturnLineSource[];
  noJobReturns: NoJobReturnSource[];
  sendOuts: SendOutSource[];
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

const SECTION_ORDER: MaterialKind[] = ['GREIGE', 'LACE', 'FABRIC', 'GARMENT'];

const SECTION_TITLE: Record<MaterialKind, string> = {
  GREIGE: 'Greige',
  LACE: 'Greige lace',
  FABRIC: 'Fabric (reprocessing / embroidery)',
  GARMENT: 'Garment pieces',
};

/** Statuses at which a job's shrinkage/shortfall is settled. Anything earlier stays in Balance. */
const SETTLED_STATUSES = new Set(['RECEIVED', 'QUALITY_CHECKED', 'STOCK_UPDATED', 'CLOSED']);

/**
 * Units are spelt three ways across the tables this reads — `METER`/`PIECE` on challans and
 * GRNs, `MTR`/`PCS`/`KG` on the job, `meters` on greige lots — so every quantity is normalised
 * once here (through the registry's alias table) rather than compared as free text. A blank or
 * unreadable unit is bucketed as metres, as the statement always has: every job it covers is
 * fabric or lace unless its row says otherwise.
 */
export function normalizeUom(uom: string | null | undefined): Uom {
  return unitToJwoUom(uom) ?? 'MTR';
}

/**
 * A SENT event adds to what the processor holds; everything else takes away. SHORTFALL carries
 * its own sign (negative = they returned more than due), so negating it is correct in both
 * directions and Balance lands on zero for a settled job either way.
 */
function signedQty(event: LedgerEvent): number {
  return event.type === 'SENT' ? event.qty : -event.qty;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function materialKeyOf(material: MaterialKey): string {
  return `${material.kind}:${material.id}`;
}

/**
 * The agreed shrinkage this job was placed at, as a percent.
 *
 * Same basis as `getVendorPerformance`: `expectedShrinkage` is preferred because it survives
 * close's settle-on-actuals overwrite of `qtyBillable`, so a statement reprinted after closing
 * shows the same agreed figure it showed before. `qtyBillable` is the fallback for older rows.
 */
export function agreedShrinkagePercent(
  job: Pick<JobSource, 'expectedShrinkage' | 'qtyBillable' | 'qtySentMeters'>
): number {
  const expected = job.expectedShrinkage;
  if (expected != null && expected > 0 && expected < 100) return expected;

  const billable = job.qtyBillable;
  if (billable != null && billable > 0 && job.qtySentMeters > 0 && billable < job.qtySentMeters) {
    const ratio = divideCurrency(billable, job.qtySentMeters);
    const pct = toNumber(subtractCurrency(1, ratio).times(100));
    if (pct > 0 && pct < 100) return pct;
  }
  return 0;
}

/**
 * Which material a job's RECEIVED / RETURNED / SHRINKAGE events belong to.
 *
 * Every event of a job must use ONE key, or its sends and its receipts land on different rows
 * and neither balances. The order matters: a fabric-reprocessing or lace job would otherwise
 * resolve through `fabric.greigeId` and be filed under a greige it never sent.
 *
 * Note the receipts are deliberately NOT used to identify the material — a dyeing job books its
 * output against `finishedFabricId`, a different master from the greige that went out.
 */
export function resolveJobKey(
  job: JobSource,
  sentLinesForJob: SentLineSource[]
): { material: MaterialKey; resolved: boolean } {
  const fromChallan = sentLinesForJob.find((line) => line.material != null)?.material;
  if (fromChallan) return { material: fromChallan, resolved: true };

  if (job.lace) return { material: job.lace, resolved: true };
  if (job.fabric) return { material: job.fabric, resolved: true };
  if (job.greige) return { material: job.greige, resolved: true };
  if (job.garment) return { material: job.garment, resolved: true };

  return {
    material: { kind: 'GREIGE', id: `UNRESOLVED:${job.id}`, code: '—', name: 'Unidentified material' },
    resolved: false,
  };
}

// ---------------------------------------------------------------------------
// Pure: sources → dated events + job lines
// ---------------------------------------------------------------------------

export function buildLedgerEvents(sources: StatementSources): {
  events: LedgerEvent[];
  jobs: JobLine[];
  warnings: string[];
} {
  const events: LedgerEvent[] = [];
  const jobLines: JobLine[] = [];
  const warnings: string[] = [];

  const sentLinesByJob = new Map<string, SentLineSource[]>();
  const transferLines: SentLineSource[] = [];
  // A piece-work send-out already has its own outward challan; counting the challan line as well
  // would send the same pieces twice.
  const sendOutChallanIds = new Set(
    sources.sendOuts.map((s) => s.outwardChallanId).filter((id): id is string => id != null)
  );

  for (const line of sources.sentLines) {
    if (sendOutChallanIds.has(line.challanId)) continue;
    if (line.jobWorkOrderId) {
      const list = sentLinesByJob.get(line.jobWorkOrderId) ?? [];
      list.push(line);
      sentLinesByJob.set(line.jobWorkOrderId, list);
    } else if ((line.isTransfer || line.isDirectSupply) && line.material) {
      transferLines.push(line);
    }
  }

  const returnsByJob = new Map<string, ReturnLineSource[]>();
  for (const line of sources.returnLines) {
    const list = returnsByJob.get(line.jobWorkOrderId) ?? [];
    list.push(line);
    returnsByJob.set(line.jobWorkOrderId, list);
  }

  // --- cloth at the processor with no job behind it: parked by a transfer challan, or delivered
  // straight there by the supplier (dated the day it arrived — the one-year clock's day too) -----
  for (const line of transferLines) {
    events.push({
      type: 'SENT',
      date: line.isDirectSupply ? (line.arrivedOn ?? line.challanDate) : line.challanDate,
      qty: line.quantity,
      unit: normalizeUom(line.unit),
      material: line.material!,
      jwoId: null,
      ref: line.challanNumber,
      refKind: line.isDirectSupply ? 'DIRECT_SUPPLY' : 'TRANSFER',
    });
  }

  for (const ret of sources.noJobReturns) {
    events.push({
      type: 'RETURNED',
      date: ret.date,
      qty: ret.qty,
      unit: 'MTR',
      material: ret.material,
      jwoId: null,
      ref: 'Return (no job)',
      refKind: 'TRANSFER',
    });
  }

  // --- jobs -------------------------------------------------------------------------------
  for (const job of sources.jobs) {
    const sentLines = sentLinesByJob.get(job.id) ?? [];
    const { material, resolved } = resolveJobKey(job, sentLines);
    if (!resolved) {
      warnings.push(
        `${job.jobWorkNumber}: could not identify which material was sent — shown under "Unidentified material".`
      );
    }

    const unit = normalizeUom(job.uom);
    const isPieces = unit === 'PCS';

    for (const line of sentLines) {
      events.push({
        type: 'SENT',
        date: line.challanDate,
        qty: line.quantity,
        unit: normalizeUom(line.unit),
        material,
        jwoId: job.id,
        ref: line.challanNumber,
        refKind: 'CHALLAN',
      });
    }

    // Its greige was already lying at this processor, so nothing physically moved and no challan
    // exists. The earlier transfer challan was the SENT; suppressing a second one keeps the row
    // balanced instead of double-counting the same cloth.
    const virtual = sentLines.length === 0 && job.lotAtThisProcessor;

    // A job with neither a challan line nor a lot here is a hole in the trail, not a zero —
    // EXCEPT a cancelled one: cancelling un-issues the job and credits the lot back, so its
    // challan is cancelled too and nothing was ever with the processor. Warning on those would
    // put a permanent false alarm on every statement for a job that was called off.
    if (
      sentLines.length === 0 &&
      !virtual &&
      !job.hasSendOuts &&
      job.qtySentMeters > 0 &&
      job.jwoStatus !== 'CANCELLED'
    ) {
      warnings.push(
        `${job.jobWorkNumber}: ${job.qtySentMeters} ${unit} recorded as sent but no issued challan line was found.`
      );
    }

    const receiptsTotal = job.receipts.reduce((sum, r) => toNumber(addCurrency(sum, r.qty)), 0);
    for (const receipt of job.receipts) {
      events.push({
        type: 'RECEIVED',
        date: receipt.date,
        qty: receipt.qty,
        unit,
        material,
        jwoId: job.id,
        ref: receipt.grnNumber,
        refKind: 'GRN',
      });
    }

    // Piece work receives without a GRN: the legacy receive route stamps the job only.
    let receivedForJob = receiptsTotal;
    if (job.receipts.length === 0 && !job.hasSendOuts && (job.qtyReceivedMeters ?? 0) > 0 && job.receivedDate) {
      receivedForJob = job.qtyReceivedMeters ?? 0;
      events.push({
        type: 'RECEIVED',
        date: job.receivedDate,
        qty: receivedForJob,
        unit,
        material,
        jwoId: job.id,
        ref: job.jobWorkNumber,
        refKind: 'JOB',
      });
    }

    const returnLines = returnsByJob.get(job.id) ?? [];
    let returnedForJob = 0;
    for (const line of returnLines) {
      returnedForJob = toNumber(addCurrency(returnedForJob, line.quantity));
      events.push({
        type: 'RETURNED',
        date: line.challanDate,
        qty: line.quantity,
        unit: normalizeUom(line.unit),
        material,
        jwoId: job.id,
        ref: line.challanNumber,
        refKind: 'CHALLAN',
      });
    }

    // The cancel/return path marks the job in remarks; if its challan is missing the cloth would
    // silently stay on the statement as still-with-the-processor.
    if (returnLines.length === 0 && (job.remarks ?? '').includes('[RETURNED UNPROCESSED]')) {
      warnings.push(
        `${job.jobWorkNumber}: marked returned unprocessed but no inward challan was found — its balance may be overstated.`
      );
    }

    // --- shrinkage + shortfall, settled jobs only -------------------------------------------
    let shrinkage = 0;
    let shortfall = 0;
    let agreedPct: number | null = null;
    let dueBack: number | null = null;

    if (!isPieces && job.receivedDate != null && SETTLED_STATUSES.has(job.jwoStatus)) {
      const processed = Math.max(0, toNumber(subtractCurrency(job.qtySentMeters, returnedForJob)));
      agreedPct = agreedShrinkagePercent(job);
      dueBack = agreedPct > 0 ? toNumber(applyShrinkageLoss(processed, agreedPct)) : processed;
      shrinkage = toNumber(subtractCurrency(processed, dueBack));
      shortfall = toNumber(subtractCurrency(dueBack, receivedForJob));

      if (agreedPct === 0 && shortfall > 0) {
        warnings.push(
          `${job.jobWorkNumber}: no agreed shrinkage recorded, so the whole ${shortfall.toFixed(2)} ${unit} gap is shown as short.`
        );
      }

      if (shrinkage !== 0) {
        events.push({
          type: 'SHRINKAGE',
          date: job.receivedDate,
          qty: shrinkage,
          unit,
          material,
          jwoId: job.id,
          ref: job.jobWorkNumber,
          refKind: 'JOB',
        });
      }
      if (shortfall !== 0) {
        events.push({
          type: 'SHORTFALL',
          date: job.receivedDate,
          qty: shortfall,
          unit,
          material,
          jwoId: job.id,
          ref: job.jobWorkNumber,
          refKind: 'JOB',
        });
      }
    }

    const sentQty = sentLines.reduce((sum, l) => toNumber(addCurrency(sum, l.quantity)), 0);

    jobLines.push({
      jwoId: job.id,
      jobWorkNumber: job.jobWorkNumber,
      processType: job.processType,
      jwoStatus: job.jwoStatus,
      material,
      unit,
      sentDate: job.sentDate,
      sentQty: virtual ? job.qtySentMeters : sentQty,
      challanNumbers: [...new Set(sentLines.map((l) => l.challanNumber))],
      receipts: job.receipts,
      returned: returnedForJob,
      agreedShrinkagePct: agreedPct,
      dueBack,
      shrinkage,
      shortfall,
      balance: 0, // filled by the aggregator, which knows the window
      virtual,
      damaged: null,
      screenOnly: {
        qtyNormalLoss: job.qtyNormalLoss,
        qtyAbnormalLoss: job.qtyAbnormalLoss,
        tolerancePercent: job.tolerancePercent,
        isOverTolerance:
          job.tolerancePercent != null && dueBack != null && dueBack > 0
            ? toNumber(multiplyCurrency(divideCurrency(Math.max(0, shortfall), dueBack), 100)) > job.tolerancePercent
            : false,
      },
    });
  }

  // --- piece-work vendors -------------------------------------------------------------------
  for (const sendOut of sources.sendOuts) {
    const unit = normalizeUom(sendOut.unit);
    events.push({
      type: 'SENT',
      date: sendOut.sendDate,
      qty: sendOut.quantitySent,
      unit,
      material: sendOut.material,
      jwoId: null,
      ref: sendOut.batchNumber,
      refKind: 'SEND_OUT',
    });

    const received = sendOut.quantityReceived ?? 0;
    const receipts: StatementReceipt[] = [];
    if (received > 0 && sendOut.actualReturnDate) {
      // The inward challan line carries the CUMULATIVE received figure, not the delta, so it
      // cannot be summed per receipt — one event at the latest return date is the honest read.
      events.push({
        type: 'RECEIVED',
        date: sendOut.actualReturnDate,
        qty: received,
        unit,
        material: sendOut.material,
        jwoId: null,
        ref: sendOut.batchNumber,
        refKind: 'SEND_OUT',
      });
      receipts.push({ grnNumber: sendOut.batchNumber, date: sendOut.actualReturnDate, qty: received });
    }

    jobLines.push({
      jwoId: sendOut.id,
      jobWorkNumber: sendOut.batchNumber,
      processType: sendOut.processType,
      jwoStatus: sendOut.status,
      material: sendOut.material,
      unit,
      sentDate: sendOut.sendDate,
      sentQty: sendOut.quantitySent,
      challanNumbers: [],
      receipts,
      returned: 0,
      agreedShrinkagePct: null,
      dueBack: null,
      shrinkage: 0,
      shortfall: 0,
      balance: 0,
      virtual: false,
      damaged: sendOut.quantityDamaged ?? null,
      screenOnly: { qtyNormalLoss: null, qtyAbnormalLoss: null, tolerancePercent: null, isOverTolerance: false },
    });
  }

  return { events, jobs: jobLines, warnings };
}

// ---------------------------------------------------------------------------
// Pure: events → the statement
// ---------------------------------------------------------------------------

export function aggregateProcessorStatement(
  events: LedgerEvent[],
  jobs: JobLine[],
  period: StatementPeriod
): StatementSection[] {
  const start = startOfDay(period.start);
  const end = endOfDay(period.end);

  const eventsByMaterial = new Map<string, LedgerEvent[]>();
  const materials = new Map<string, MaterialKey>();
  for (const event of events) {
    const key = materialKeyOf(event.material);
    materials.set(key, event.material);
    const list = eventsByMaterial.get(key) ?? [];
    list.push(event);
    eventsByMaterial.set(key, list);
  }

  const jobsByMaterial = new Map<string, JobLine[]>();
  for (const job of jobs) {
    const key = materialKeyOf(job.material);
    materials.set(key, job.material);
    const list = jobsByMaterial.get(key) ?? [];
    list.push(job);
    jobsByMaterial.set(key, list);
  }

  const eventsByJob = new Map<string, LedgerEvent[]>();
  for (const event of events) {
    if (!event.jwoId) continue;
    const list = eventsByJob.get(event.jwoId) ?? [];
    list.push(event);
    eventsByJob.set(event.jwoId, list);
  }

  const rowsByKind = new Map<MaterialKind, StatementRow[]>();

  for (const [key, material] of materials) {
    const rowEvents = eventsByMaterial.get(key) ?? [];

    let opening = 0;
    let sent = 0;
    let received = 0;
    let returned = 0;
    let shrinkage = 0;
    let shortfall = 0;

    for (const event of rowEvents) {
      if (event.date < start) {
        opening = toNumber(addCurrency(opening, signedQty(event)));
        continue;
      }
      if (event.date > end) continue;
      switch (event.type) {
        case 'SENT':
          sent = toNumber(addCurrency(sent, event.qty));
          break;
        case 'RECEIVED':
          received = toNumber(addCurrency(received, event.qty));
          break;
        case 'RETURNED':
          returned = toNumber(addCurrency(returned, event.qty));
          break;
        case 'SHRINKAGE':
          shrinkage = toNumber(addCurrency(shrinkage, event.qty));
          break;
        case 'SHORTFALL':
          shortfall = toNumber(addCurrency(shortfall, event.qty));
          break;
      }
    }

    const closing = toNumber(subtractCurrency(addCurrency(opening, sent), received, returned, shrinkage, shortfall));

    // Unit is taken from what LEFT here: a dyeing job sends metres and may book its receipt in a
    // different spelling, and the column the processor checks is the one they were sent in.
    const sentEvent = rowEvents.find((e) => e.type === 'SENT');
    const unit = sentEvent?.unit ?? rowEvents[0]?.unit ?? 'MTR';
    const unitMixed = new Set(rowEvents.map((e) => e.unit)).size > 1;

    const rowJobs = (jobsByMaterial.get(key) ?? [])
      .map((job) => {
        const jobEvents = eventsByJob.get(job.jwoId) ?? [];
        // A job that took cloth already lying here has no SENT of its own — the transfer or direct-
        // supply challan carries those metres in the row. Its own balance still starts from what it
        // took, so the processor sees which job holds how much. Row totals are untouched.
        const takesHere = job.virtual && job.jwoStatus !== 'CANCELLED' && job.sentDate != null;
        const takenQty = takesHere && job.sentDate! <= end ? job.sentQty : 0;
        const balance = jobEvents
          .filter((e) => e.date <= end)
          .reduce((sum, e) => toNumber(addCurrency(sum, signedQty(e))), takenQty);
        const touchedWindow =
          jobEvents.some((e) => e.date >= start && e.date <= end) ||
          (takesHere && job.sentDate! >= start && job.sentDate! <= end);
        return { job: { ...job, balance }, touchedWindow };
      })
      .filter(({ job, touchedWindow }) => touchedWindow || Math.abs(job.balance) > 0.005)
      .map(({ job }) => job)
      .sort((a, b) => (a.sentDate?.getTime() ?? 0) - (b.sentDate?.getTime() ?? 0));

    const isEmpty =
      Math.abs(opening) <= 0.005 &&
      Math.abs(sent) <= 0.005 &&
      Math.abs(received) <= 0.005 &&
      Math.abs(returned) <= 0.005 &&
      Math.abs(shrinkage) <= 0.005 &&
      Math.abs(shortfall) <= 0.005 &&
      Math.abs(closing) <= 0.005;
    if (isEmpty) continue;

    const row: StatementRow = {
      material,
      unit,
      unitMixed,
      opening,
      sent,
      received,
      returned,
      shrinkage,
      shortfall,
      closing,
      jobs: rowJobs,
    };
    const list = rowsByKind.get(material.kind) ?? [];
    list.push(row);
    rowsByKind.set(material.kind, list);
  }

  const sections: StatementSection[] = [];
  for (const kind of SECTION_ORDER) {
    const rows = (rowsByKind.get(kind) ?? []).sort((a, b) => a.material.code.localeCompare(b.material.code));
    if (rows.length === 0) continue;

    const totals: StatementTotals = rows.reduce<StatementTotals>(
      (acc, row) => ({
        opening: toNumber(addCurrency(acc.opening, row.opening)),
        sent: toNumber(addCurrency(acc.sent, row.sent)),
        received: toNumber(addCurrency(acc.received, row.received)),
        returned: toNumber(addCurrency(acc.returned, row.returned)),
        shrinkage: toNumber(addCurrency(acc.shrinkage, row.shrinkage)),
        shortfall: toNumber(addCurrency(acc.shortfall, row.shortfall)),
        closing: toNumber(addCurrency(acc.closing, row.closing)),
      }),
      { opening: 0, sent: 0, received: 0, returned: 0, shrinkage: 0, shortfall: 0, closing: 0 }
    );

    sections.push({ kind, title: SECTION_TITLE[kind], unit: rows[0].unit, rows, totals });
  }

  return sections;
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export class ProcessorNotFoundError extends Error {
  constructor(processorId: string) {
    super(`Processor ${processorId} not found`);
    this.name = 'ProcessorNotFoundError';
  }
}

const num = (value: unknown): number => toNumber(toCurrency(value as never));
const numOrNull = (value: unknown): number | null => (value == null ? null : num(value));

/**
 * Everything about this processor, with NO date filter: the opening balance needs the full
 * history, so the window is applied in memory by the aggregator.
 */
export async function loadProcessorStatementSources(processorId: string): Promise<StatementSources> {
  const processor = await prisma.suppliers.findUnique({
    where: { id: processorId },
    select: {
      id: true,
      code: true,
      name: true,
      gst_numbers: { where: { isPrimary: true }, select: { gstNumber: true }, take: 1 },
    },
  });
  if (!processor) throw new ProcessorNotFoundError(processorId);

  const jobRows = await prisma.job_work_orders.findMany({
    where: { processorId, isActive: true, sentDate: { not: null } },
    select: {
      id: true,
      jobWorkNumber: true,
      processType: true,
      jwoStatus: true,
      uom: true,
      qtySentMeters: true,
      qtyReceivedMeters: true,
      qtyBillable: true,
      expectedShrinkage: true,
      qtyNormalLoss: true,
      qtyAbnormalLoss: true,
      tolerancePercent: true,
      sentDate: true,
      receivedDate: true,
      remarks: true,
      styleId: true,
      greigeId: true,
      greigeLaceId: true,
      fabricId: true,
      fabricStockLotId: true,
      style: { select: { id: true, styleCode: true, styleName: true } },
      greige: { select: { id: true, greigeCode: true, greigeName: true } },
      greigeLace: { select: { id: true, laceCode: true, laceName: true } },
      fabric: { select: { id: true, fabricCode: true, fabricName: true, greigeId: true } },
      fabricStockLot: {
        select: { fabricId: true, fabricMaster: { select: { id: true, fabricCode: true, fabricName: true } } },
      },
      greigeStockLot: { select: { greigeId: true, processorId: true } },
      labDip: { select: { fabric: { select: { greigeId: true } } } },
      components: { select: { materialType: true, greigeId: true }, orderBy: { sortOrder: 'asc' } },
      requirementLinks: {
        select: { material_requirements: { select: { materials: { select: { greigeId: true } } } } },
      },
      processTypeMaster: { select: { tolerancePercent: true } },
      receivingGRNs: {
        where: { status: 'ACCEPTED' },
        select: {
          grnNumber: true,
          receivingDate: true,
          grn_items: { select: { receivedQuantity: true, foldLengthCm: true } },
        },
        // Both parts of a same-day return share a receivingDate, so the number breaks the tie —
        // otherwise the two deliveries print in whatever order the rows came back.
        orderBy: [{ receivingDate: 'asc' }, { grnNumber: 'asc' }],
      },
      externalProcessSendOuts: { select: { id: true } },
    },
  });

  const jobIds = jobRows.map((j) => j.id);

  // Greige masters the chain resolved but the row did not already include.
  const chainGreigeIds = new Set<string>();
  for (const job of jobRows) {
    const resolution = resolveJwoGreige(job);
    if (resolution && resolution.source !== 'header') chainGreigeIds.add(resolution.greigeId);
  }
  const chainGreiges = chainGreigeIds.size
    ? await prisma.greige_master.findMany({
        where: { id: { in: [...chainGreigeIds] } },
        select: { id: true, greigeCode: true, greigeName: true },
      })
    : [];
  const greigeById = new Map(chainGreiges.map((g) => [g.id, g]));

  const sendOutRows = await prisma.external_process_send_outs.findMany({
    where: { supplierId: processorId, isActive: true, status: { notIn: ['DRAFT', 'CANCELLED'] } },
    select: {
      id: true,
      batchNumber: true,
      processType: true,
      unit: true,
      quantitySent: true,
      quantityReceived: true,
      quantityDamaged: true,
      sendDate: true,
      actualReturnDate: true,
      status: true,
      outwardChallanId: true,
      jobWorkOrderId: true,
      styleId: true,
      style: { select: { id: true, styleCode: true, styleName: true } },
      fabricStock: { select: { fabricMaster: { select: { id: true, fabricCode: true, fabricName: true } } } },
    },
  });

  // SENT: job lines are matched on the LINE, which survives a consolidated dispatch where the
  // header names no job. Transfer lines are only counted when a lot was actually parked at this
  // processor — a Stock-Out to a supplier is otherwise a purchase return, not a send for work.
  const transferChallanIds = (
    await prisma.greige_stock.findMany({
      where: { processorId, sourceType: 'TRANSFER', sourceChallanId: { not: null } },
      select: { sourceChallanId: true },
    })
  )
    .map((g) => g.sourceChallanId)
    .filter((id): id is string => id != null);

  // Goods a supplier delivered straight to this processor: the Rule 45 challan the receipt raised
  // (helpers/direct-supply-challan.helper.ts). A reversed receipt cancels it, so it drops out below.
  const directSupplyChallanIds = (
    await prisma.challans.findMany({
      where: { directSupplyGrnId: { not: null }, toId: processorId },
      select: { id: true },
    })
  ).map((c) => c.id);

  const sentLineRows = await prisma.challan_items.findMany({
    where: {
      challan: {
        challanType: 'OUTWARD',
        status: { in: ['ISSUED', 'IN_TRANSIT', 'RECEIVED', 'PARTIALLY_RECEIVED'] },
      },
      OR: [
        ...(jobIds.length ? [{ jobWorkOrderId: { in: jobIds } }] : []),
        ...(transferChallanIds.length ? [{ challanId: { in: transferChallanIds } }] : []),
        ...(directSupplyChallanIds.length ? [{ challanId: { in: directSupplyChallanIds } }] : []),
      ],
    },
    select: {
      id: true,
      challanId: true,
      quantity: true,
      unit: true,
      jobWorkOrderId: true,
      fabricId: true,
      challan: { select: { challanNumber: true, challanDate: true, toType: true } },
      greigeStock: {
        select: { receivedDate: true, greige: { select: { id: true, greigeCode: true, greigeName: true } } },
      },
      laceStock: { select: { laceMaster: { select: { id: true, laceCode: true, laceName: true } } } },
      fabricStock: { select: { fabricMaster: { select: { id: true, fabricCode: true, fabricName: true } } } },
    },
  });

  // RETURNED (unprocessed, against a job): the inward challan's GREIGE line. Receipt-part inward
  // challans are excluded by `grnId: null` — those carry the processed FABRIC coming back.
  const returnLineRows = jobIds.length
    ? await prisma.challan_items.findMany({
        where: {
          itemType: 'GREIGE',
          challan: { challanType: 'INWARD', grnId: null, status: { not: 'CANCELLED' } },
          OR: [{ jobWorkOrderId: { in: jobIds } }, { challan: { jobWorkOrderId: { in: jobIds } } }],
        },
        select: {
          quantity: true,
          unit: true,
          jobWorkOrderId: true,
          challan: { select: { challanNumber: true, challanDate: true, jobWorkOrderId: true } },
        },
      })
    : [];

  // RETURNED with no job: greige the processor held (parked by a Stock-Out, or delivered straight there)
  // brought back to our store — Bring to store (held-stock-doors.helper, Phase 4b).
  const noJobReturnRows = await prisma.greige_stock_transaction.findMany({
    where: {
      transactionType: 'RECEIPT',
      referenceType: 'PROCESSING_DELIVERY',
      stock: { processorId, sourceType: { in: ['TRANSFER', 'DIRECT'] } },
    },
    select: {
      id: true,
      quantity: true,
      transactionDate: true,
      stock: { select: { greige: { select: { id: true, greigeCode: true, greigeName: true } } } },
    },
  });

  // ---- map to plain sources -----------------------------------------------------------------

  const jobs: JobSource[] = jobRows.map((job) => {
    const resolution = resolveJwoGreige(job);
    const greigeMaster =
      resolution?.source === 'header' && job.greige
        ? job.greige
        : resolution
          ? greigeById.get(resolution.greigeId)
          : undefined;

    const fabricMaster = job.fabricStockLot?.fabricMaster ?? (job.fabricStockLotId ? job.fabric : null);

    return {
      id: job.id,
      jobWorkNumber: job.jobWorkNumber,
      processType: job.processType,
      jwoStatus: job.jwoStatus,
      uom: job.uom,
      qtySentMeters: num(job.qtySentMeters),
      qtyReceivedMeters: numOrNull(job.qtyReceivedMeters),
      qtyBillable: numOrNull(job.qtyBillable),
      expectedShrinkage: numOrNull(job.expectedShrinkage),
      qtyNormalLoss: numOrNull(job.qtyNormalLoss),
      qtyAbnormalLoss: numOrNull(job.qtyAbnormalLoss),
      tolerancePercent: numOrNull(job.tolerancePercent ?? job.processTypeMaster?.tolerancePercent),
      sentDate: job.sentDate,
      receivedDate: job.receivedDate,
      remarks: job.remarks,
      greige: greigeMaster
        ? { kind: 'GREIGE', id: greigeMaster.id, code: greigeMaster.greigeCode, name: greigeMaster.greigeName }
        : null,
      lace: job.greigeLace
        ? { kind: 'LACE', id: job.greigeLace.id, code: job.greigeLace.laceCode, name: job.greigeLace.laceName }
        : null,
      fabric: fabricMaster
        ? { kind: 'FABRIC', id: fabricMaster.id, code: fabricMaster.fabricCode, name: fabricMaster.fabricName }
        : null,
      garment:
        normalizeUom(job.uom) === 'PCS' && job.style
          ? {
              kind: 'GARMENT',
              id: job.style.id,
              code: job.style.styleCode,
              name: job.style.styleName ?? job.style.styleCode,
            }
          : null,
      lotAtThisProcessor: job.greigeStockLot?.processorId === processorId,
      receipts: job.receivingGRNs.map((grn) => ({
        grnNumber: grn.grnNumber,
        date: grn.receivingDate,
        // ACTUAL metres — the processor's counted figure converted at the receipt's fold length.
        qty: grn.grn_items.reduce(
          (sum, item) => toNumber(addCurrency(sum, foldActual(item.receivedQuantity, item.foldLengthCm))),
          0
        ),
      })),
      hasSendOuts: job.externalProcessSendOuts.length > 0,
    };
  });

  const transferChallanIdSet = new Set(transferChallanIds);
  const directSupplyChallanIdSet = new Set(directSupplyChallanIds);
  const sentLines: SentLineSource[] = sentLineRows.map((line) => {
    const greige = line.greigeStock?.greige;
    const lace = line.laceStock?.laceMaster;
    const fabric = line.fabricStock?.fabricMaster;
    const material: MaterialKey | null = greige
      ? { kind: 'GREIGE', id: greige.id, code: greige.greigeCode, name: greige.greigeName }
      : lace
        ? { kind: 'LACE', id: lace.id, code: lace.laceCode, name: lace.laceName }
        : fabric
          ? { kind: 'FABRIC', id: fabric.id, code: fabric.fabricCode, name: fabric.fabricName }
          : null;

    return {
      id: line.id,
      challanId: line.challanId,
      challanNumber: line.challan.challanNumber,
      challanDate: line.challan.challanDate,
      jobWorkOrderId: line.jobWorkOrderId,
      quantity: num(line.quantity),
      unit: line.unit,
      material,
      isTransfer: line.jobWorkOrderId == null && transferChallanIdSet.has(line.challanId),
      isDirectSupply: line.jobWorkOrderId == null && directSupplyChallanIdSet.has(line.challanId),
      arrivedOn: line.greigeStock?.receivedDate ?? null,
    };
  });

  const returnLines: ReturnLineSource[] = returnLineRows
    .map((line) => ({
      jobWorkOrderId: line.jobWorkOrderId ?? line.challan.jobWorkOrderId ?? '',
      challanNumber: line.challan.challanNumber,
      challanDate: line.challan.challanDate,
      quantity: num(line.quantity),
      unit: line.unit,
    }))
    .filter((line) => line.jobWorkOrderId !== '');

  const noJobReturns: NoJobReturnSource[] = noJobReturnRows
    .filter((row) => row.stock?.greige != null)
    .map((row) => ({
      id: row.id,
      date: row.transactionDate,
      qty: Math.abs(num(row.quantity)),
      material: {
        kind: 'GREIGE' as const,
        id: row.stock!.greige!.id,
        code: row.stock!.greige!.greigeCode,
        name: row.stock!.greige!.greigeName,
      },
    }));

  const sendOuts: SendOutSource[] = sendOutRows.map((sendOut) => {
    const fabric = sendOut.fabricStock?.fabricMaster;
    const material: MaterialKey = fabric
      ? { kind: 'FABRIC', id: fabric.id, code: fabric.fabricCode, name: fabric.fabricName }
      : sendOut.style
        ? {
            kind: 'GARMENT',
            id: sendOut.style.id,
            code: sendOut.style.styleCode,
            name: sendOut.style.styleName ?? sendOut.style.styleCode,
          }
        : { kind: 'GARMENT', id: `UNRESOLVED:${sendOut.id}`, code: '—', name: 'Unidentified style' };

    return {
      id: sendOut.id,
      batchNumber: sendOut.batchNumber,
      processType: sendOut.processType,
      unit: sendOut.unit,
      quantitySent: num(sendOut.quantitySent),
      quantityReceived: numOrNull(sendOut.quantityReceived),
      quantityDamaged: numOrNull(sendOut.quantityDamaged),
      sendDate: sendOut.sendDate,
      actualReturnDate: sendOut.actualReturnDate,
      status: sendOut.status,
      outwardChallanId: sendOut.outwardChallanId,
      jobWorkOrderId: sendOut.jobWorkOrderId,
      material,
    };
  });

  return {
    processor: {
      id: processor.id,
      code: processor.code,
      name: processor.name,
      gstin: processor.gst_numbers[0]?.gstNumber ?? null,
    },
    jobs,
    sentLines,
    returnLines,
    noJobReturns,
    sendOuts,
  };
}

/** The statement for one processor over one window. */
export async function getProcessorStatement(
  processorId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<ProcessorStatement> {
  const sources = await loadProcessorStatementSources(processorId);
  const { events, jobs, warnings } = buildLedgerEvents(sources);
  const sections = aggregateProcessorStatement(events, jobs, { start: periodStart, end: periodEnd });

  return {
    processor: sources.processor,
    periodStart,
    periodEnd,
    sections,
    warnings,
    generatedAt: new Date(),
  };
}

export default {
  getProcessorStatement,
  loadProcessorStatementSources,
  buildLedgerEvents,
  aggregateProcessorStatement,
};
