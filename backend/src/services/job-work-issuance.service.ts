/**
 * Job Work Issuance Service — THE single implementation of "issue material to processor".
 *
 * Consolidates the four historical paths (JWO /issue, dyeing/printing process-po send,
 * createProcessPO autoSend, legacy /jobs/:id/send) onto one atomic transaction:
 *   mutex → challan (in-tx) → guarded stock consumption → components (multi-lot) →
 *   reservation release → challan ISSUED → statutory date → totals → JWO stamp.
 *
 * Invariants:
 * - GREIGE orders REQUIRE at least one lot (NO_GREIGE_LOT) — a despatch that consumes
 *   nothing was never a feature, it was the bug class that stranded orders.
 * - The whole issue commits or rolls back as ONE unit; a challan failure can no longer
 *   strand consumed stock, and a retry can no longer consume twice (JWO-row mutex).
 * - Challans are born ISSUED (physical dispatch IS happening) — the challan page's
 *   Issue button can never deduct the same stock a second time.
 * - Consumption is AVAILABLE-only (see consumeGreigeStock) — reservations are never
 *   stolen; this order's own MRP reservation rows are marked CONSUMED in the same tx.
 * - Status writes unified on status 'AT_MILL' + jwoStatus 'ISSUED' (all readers accept
 *   both legacy values; four AT_MILL-only dashboards start seeing issued orders).
 */

import { Prisma, Unit } from '@prisma/client';
import prisma from '../config/database';
import { createChallan, type CreateChallanItemInput } from './challan.service';
import greigeStockService from './greige-stock.service';
import { consumeLaceStock, restoreLaceStock } from './laceStock.service';
import { jobWorkOrderService, JobWorkOrderError, JWO_ERROR_CODES } from './job-work-order.service';
import { ensureMaterialRecord, syncStockLevelQuantity } from './helpers/material-sync.helper';
import { jwoStockUnit, setJwoStatus } from './helpers/jwo-status.helper';
import { toCurrency, addCurrency, multiplyCurrency, roundToCent, toNumber } from '../utils/currency';
import { logInfo, logWarn, logError } from '../utils/logger';
import { hasFold } from '../utils/fold-length';
import { formatDate } from '../utils/date';
import { qtyExceeds, snapToLimit } from '../utils/quantity';

type Tx = Prisma.TransactionClient;

/**
 * One source lot on an issue. Exactly one id is set: a job is either a cloth job consuming greige
 * lots or a lace job consuming lace lots — `fabricType` decides which, and the validator refuses
 * the other kind rather than guessing.
 */
export interface IssueLotInput {
  greigeStockLotId?: string;
  laceStockLotId?: string;
  qty: number;
}

/** Individual than/bale detail selection for bale-wise issuance */
export interface IssueDetailInput {
  greigeStockDetailId: string;
  metersToIssue: number;
}

/** Lot input with optional detail-level selections */
export interface IssueLotWithDetailsInput {
  greigeStockLotId: string;
  /** When provided, issue these specific thans/bales instead of just quantity */
  details?: IssueDetailInput[];
  /** Fallback qty when details not provided (lot-level issuance) */
  qty?: number;
}

export interface IssueJwoOptions {
  userId: string;
  sentDate?: Date;
  /** Greige source lots (fabricType 'GREIGE'). Single lot = array of one. */
  lots?: IssueLotInput[];
  /** Single-lot convenience: full qtySentMeters from this lot (ignored when lots[] given). */
  greigeStockLotId?: string | null;
  /** Finished-roll source (EMBROIDERY etc.) — used only when no greige lots are in play. */
  fabricStockLotId?: string | null;
  /** Manual challan-book reference → challans.remarks + jwo.challanNumber. */
  challanNumber?: string;
  vehicleNumber?: string;
  /** Pre-minted by the dyeing/printing callers (fabric-identity helper). */
  finishedFabricId?: string | null;
  acknowledgeWidthMismatch?: boolean;
}

export interface IssueJwoResult {
  jwoId: string;
  /** Null for virtual issuance (stock already at processor, no dispatch needed) */
  challanId: string | null;
  /** 'VIRTUAL-ALLOCATION' for virtual issuance */
  challanNumber: string;
  warnings: string[];
}

export const ISSUE_ERROR_CODES = {
  ALREADY_ISSUED: 'ALREADY_ISSUED',
  ORDER_CANCELLED: 'ORDER_CANCELLED',
  NO_GREIGE_LOT: 'NO_GREIGE_LOT',
  NO_LACE_LOT: 'NO_LACE_LOT',
  LOT_NOT_FOUND: 'LOT_NOT_FOUND',
  LOT_LACE_MISMATCH: 'LOT_LACE_MISMATCH',
  INSUFFICIENT_LACE: 'INSUFFICIENT_LACE',
  LOT_GREIGE_MISMATCH: 'LOT_GREIGE_MISMATCH',
  LOT_GREIGE_MIXED: 'LOT_GREIGE_MIXED',
  LOT_DUPLICATE: 'LOT_DUPLICATE',
  LOT_WIDTH_MISMATCH: 'LOT_WIDTH_MISMATCH',
  LOT_QTY_MISMATCH: 'LOT_QTY_MISMATCH',
  PURCHASED_ITEM_AS_COMPONENT: 'PURCHASED_ITEM_AS_COMPONENT',
  LOT_AT_PROCESSOR: 'LOT_AT_PROCESSOR',
  LOT_AT_WRONG_PROCESSOR: 'LOT_AT_WRONG_PROCESSOR',
  INSUFFICIENT_GREIGE: 'INSUFFICIENT_GREIGE',
  INSUFFICIENT_FABRIC_STOCK: 'INSUFFICIENT_FABRIC_STOCK',
  CANCEL_RESTORE_FAILED: 'CANCEL_RESTORE_FAILED',
  // Consolidated dispatch only — problems that exist because the orders travel together
  NO_ORDERS: 'NO_ORDERS',
  PROCESSOR_MISMATCH: 'PROCESSOR_MISMATCH',
  LOT_REUSED_ACROSS_ORDERS: 'LOT_REUSED_ACROSS_ORDERS',
} as const;

/** Nominal greige width varies loom to loom — this is the acceptable slack. */
const WIDTH_TOLERANCE_INCHES = 1.0;

const JWO_ISSUE_INCLUDE = {
  processor: { select: { id: true, name: true } },
  style: { select: { styleCode: true, buyerStyleRef: true } },
  fabric: { select: { id: true, greigeId: true } },
  greigeLace: { select: { id: true, laceCode: true, laceName: true } },
  finishedLace: { select: { id: true, laceCode: true, laceName: true, color: true } },
  labDip: { select: { fabric: { select: { greigeId: true } } } },
  requirementLinks: {
    select: {
      material_requirements: {
        select: { id: true, materialId: true, materials: { select: { greigeId: true } } },
      },
    },
  },
} satisfies Prisma.job_work_ordersInclude;

type JwoForIssue = Prisma.job_work_ordersGetPayload<{ include: typeof JWO_ISSUE_INCLUDE }>;

export interface IssueBlocker {
  code: string;
  message: string;
}

export interface ValidateIssueResult {
  jwo: JwoForIssue;
  /** Resolved greige lots, sorted qty desc, with their stock rows attached. */
  lots: Array<{
    row: Prisma.greige_stockGetPayload<{ include: { greige: { select: { greigeCode: true; greigeName: true } } } }>;
    qty: number;
    /** True if lot is already at target processor (virtual issuance — no challan needed) */
    atProcessor?: boolean;
  }>;
  /** Resolved GREIGE LACE lots (fabricType 'LACE'). Empty on every cloth job. */
  laceLots: Array<{
    row: Prisma.lace_stockGetPayload<{ include: { laceMaster: { select: { laceCode: true; laceName: true } } } }>;
    qty: number;
  }>;
  fabricLotRow: { id: string; quantityAvailable: Prisma.Decimal } | null;
  expectedGreigeId: string | null;
  expectedGreige: { id: string; greigeCode: string; greigeName: string } | null;
  blockers: IssueBlocker[];
}

/**
 * READ-ONLY validation — shared by issueJobWorkOrder (throws first blocker) and the
 * GET /:id/issue-preview endpoint (returns all blockers for the UI).
 */
export async function validateIssue(
  jwoId: string,
  opts: Omit<IssueJwoOptions, 'userId'>
): Promise<ValidateIssueResult> {
  const jwo = await prisma.job_work_orders.findUnique({ where: { id: jwoId }, include: JWO_ISSUE_INCLUDE });
  if (!jwo) {
    throw new JobWorkOrderError('NOT_FOUND', 'Job work order not found');
  }

  const blockers: IssueBlocker[] = [];
  if (jwo.sentDate) {
    blockers.push({
      code: ISSUE_ERROR_CODES.ALREADY_ISSUED,
      message: `${jwo.jobWorkNumber} was already issued on ${formatDate(jwo.sentDate)}.`,
    });
  }
  if (jwo.jwoStatus === 'CANCELLED' || jwo.jwoStatus === 'CLOSED') {
    blockers.push({
      code: ISSUE_ERROR_CODES.ORDER_CANCELLED,
      message: `${jwo.jobWorkNumber} is ${jwo.jwoStatus.toLowerCase()} and cannot be issued.`,
    });
  }

  // A lace job consumes lace lots and nothing else — there is no header lot pointer to fall back
  // on, because the greige lace is chosen at issue time from whatever lots are on the shelf.
  const isLaceJob = jwo.fabricType === 'LACE';

  // Resolve the source: explicit lots → caller's single lot → the JWO's own lot → fabric roll
  const singleLotId = isLaceJob ? null : (opts.greigeStockLotId ?? jwo.greigeStockLotId ?? null);
  const lotInputs: IssueLotInput[] =
    opts.lots && opts.lots.length > 0
      ? opts.lots
      : singleLotId
        ? [{ greigeStockLotId: singleLotId, qty: Number(jwo.qtySentMeters) }]
        : [];
  const greigeLotInputs = isLaceJob
    ? []
    : lotInputs.filter((l): l is IssueLotInput & { greigeStockLotId: string } => !!l.greigeStockLotId);
  const laceLotInputs = isLaceJob
    ? lotInputs.filter((l): l is IssueLotInput & { laceStockLotId: string } => !!l.laceStockLotId)
    : [];
  const fabricLotId =
    isLaceJob || lotInputs.length > 0 ? null : (opts.fabricStockLotId ?? jwo.fabricStockLotId ?? null);

  if (jwo.fabricType === 'GREIGE' && greigeLotInputs.length === 0 && !fabricLotId) {
    blockers.push({
      code: ISSUE_ERROR_CODES.NO_GREIGE_LOT,
      message: `${jwo.jobWorkNumber} issues greige — pick the greige lot(s) to consume before sending.`,
    });
  }
  if (isLaceJob && laceLotInputs.length === 0) {
    blockers.push({
      code: ISSUE_ERROR_CODES.NO_LACE_LOT,
      message: `${jwo.jobWorkNumber} issues lace — pick the greige lace lot(s) to consume before sending.`,
    });
  }

  // ---- LACE lots ----------------------------------------------------------------------------
  // Deliberately shorter than the greige checks below: lace_stock has no processorId (there are no
  // at-processor lace lots), no supplierId (so no R6 free-issue-back check) and no width.
  const laceLots: ValidateIssueResult['laceLots'] = [];
  if (laceLotInputs.length > 0) {
    const sum = laceLotInputs.reduce((acc, l) => addCurrency(acc, l.qty), toCurrency(0));
    if (laceLotInputs.some((l) => !(l.qty > 0))) {
      blockers.push({
        code: ISSUE_ERROR_CODES.LOT_QTY_MISMATCH,
        message: 'Every lot quantity must be greater than 0.',
      });
    } else if (toNumber(sum.minus(toCurrency(jwo.qtySentMeters)).abs()) > 0.01) {
      blockers.push({
        code: ISSUE_ERROR_CODES.LOT_QTY_MISMATCH,
        message: `Lot quantities total ${toNumber(sum)} but the order issues ${Number(jwo.qtySentMeters)} ${jwo.uom}.`,
      });
    }

    for (const input of laceLotInputs) {
      const row = await prisma.lace_stock.findUnique({
        where: { id: input.laceStockLotId },
        include: { laceMaster: { select: { laceCode: true, laceName: true } } },
      });
      if (!row) {
        blockers.push({
          code: ISSUE_ERROR_CODES.LOT_NOT_FOUND,
          message: `Lace stock lot ${input.laceStockLotId} not found.`,
        });
        continue;
      }
      // The dyer is paid to turn ONE greige into ONE dyed variant. A lot of anything else would
      // come back as a colour of a lace that was never sent.
      if (jwo.greigeLaceId && row.laceId !== jwo.greigeLaceId) {
        blockers.push({
          code: ISSUE_ERROR_CODES.LOT_LACE_MISMATCH,
          message:
            `Lot ${row.laceMaster?.laceCode ?? row.id.slice(0, 8)} is ${row.laceMaster?.laceName ?? 'a different lace'}, ` +
            `but this order sends ${jwo.greigeLace?.laceCode ?? jwo.greigeLaceId}.`,
        });
      }
      // Friendly pre-check; the guarded consume inside the tx is the authority
      // Quantity rule (utils/quantity): the whole lot typed within dust is the whole lot — snapped
      // below so the guarded consume is asked for exactly what the lot holds.
      if (qtyExceeds(input.qty, row.quantityAvailable)) {
        blockers.push({
          code: ISSUE_ERROR_CODES.INSUFFICIENT_LACE,
          message: `Insufficient lace in lot ${row.laceMaster?.laceCode ?? row.id.slice(0, 8)}: ${Number(row.quantityAvailable)}m available, ${input.qty}m needed.`,
        });
      }
      laceLots.push({ row, qty: snapToLimit(input.qty, row.quantityAvailable) });
    }

    const laceLotIds = laceLotInputs.map((l) => l.laceStockLotId);
    if (new Set(laceLotIds).size !== laceLotIds.length) {
      blockers.push({
        code: ISSUE_ERROR_CODES.LOT_DUPLICATE,
        message: 'The same lace lot is listed twice — combine the quantities into one row.',
      });
    }
    laceLots.sort((a, b) => b.qty - a.qty);
  }

  // The cloth this order is about. A hand-raised stock job names it on the header — that is the
  // greige its rate and shrinkage were quoted on, so it is the contract and comes first
  // (2026-09-21). An order-linked job leaves the column null and derives it from the chain.
  const greigeFromHeader = jwo.greigeId != null;
  const expectedGreigeId =
    jwo.greigeId ??
    jwo.requirementLinks[0]?.material_requirements?.materials?.greigeId ??
    jwo.fabric?.greigeId ??
    jwo.labDip?.fabric?.greigeId ??
    null;
  const expectedGreige = expectedGreigeId
    ? await prisma.greige_master.findUnique({
        where: { id: expectedGreigeId },
        select: { id: true, greigeCode: true, greigeName: true },
      })
    : null;
  if (greigeLotInputs.length > 0 && !expectedGreigeId) {
    logWarn(`[Issuance] ${jwo.jobWorkNumber}: greige identity unresolvable — lot identity check skipped`, {
      jwoId,
    });
  }

  const lots: ValidateIssueResult['lots'] = [];
  if (greigeLotInputs.length > 0) {
    // Quantities must add up to what the order says leaves the building
    const sum = greigeLotInputs.reduce((acc, l) => addCurrency(acc, l.qty), toCurrency(0));
    if (greigeLotInputs.some((l) => !(l.qty > 0))) {
      blockers.push({
        code: ISSUE_ERROR_CODES.LOT_QTY_MISMATCH,
        message: 'Every lot quantity must be greater than 0.',
      });
    } else if (toNumber(sum.minus(toCurrency(jwo.qtySentMeters)).abs()) > 0.01) {
      blockers.push({
        code: ISSUE_ERROR_CODES.LOT_QTY_MISMATCH,
        message: `Lot quantities total ${toNumber(sum)} but the order issues ${Number(jwo.qtySentMeters)} ${jwo.uom}.`,
      });
    }

    for (const input of greigeLotInputs) {
      const row = await prisma.greige_stock.findUnique({
        where: { id: input.greigeStockLotId },
        include: { greige: { select: { greigeCode: true, greigeName: true } } },
      });
      if (!row) {
        blockers.push({
          code: ISSUE_ERROR_CODES.LOT_NOT_FOUND,
          message: `Greige stock lot ${input.greigeStockLotId} not found.`,
        });
        continue;
      }
      // Stock at a DIFFERENT processor cannot be issued (it's not here).
      // Stock at the SAME processor = "virtual issuance" — no physical movement needed.
      if (row.processorId != null && row.processorId !== jwo.processorId) {
        blockers.push({
          code: ISSUE_ERROR_CODES.LOT_AT_WRONG_PROCESSOR,
          message: `Lot ${row.greige?.greigeCode ?? row.id.slice(0, 8)} is at a different processor and cannot be issued from here.`,
        });
      }
      // Transferred stock at main warehouse is blocked (it was meant for another processor).
      // But transferred stock AT the target processor is fine — it's already there.
      if (row.sourceType === 'TRANSFER' && row.processorId == null) {
        blockers.push({
          code: ISSUE_ERROR_CODES.LOT_AT_PROCESSOR,
          message: `Lot ${row.greige?.greigeCode ?? row.id.slice(0, 8)} is transferred stock at main warehouse — it was meant for another processor.`,
        });
      }
      // R6: the processor's own supplied material cannot be issued back to them as ours
      if (row.supplierId != null && row.supplierId === jwo.processorId) {
        blockers.push({
          code: ISSUE_ERROR_CODES.PURCHASED_ITEM_AS_COMPONENT,
          message: `Lot ${row.greige?.greigeCode ?? row.id.slice(0, 8)} was supplied by this processor — it cannot be free-issued back to them (R6).`,
        });
      }
      if (expectedGreigeId && row.greigeId !== expectedGreigeId) {
        blockers.push({
          code: ISSUE_ERROR_CODES.LOT_GREIGE_MISMATCH,
          message:
            `Lot ${row.greige?.greigeCode ?? ''} is ${row.greige?.greigeName ?? 'a different greige'}, ` +
            `but this order ${greigeFromHeader ? 'was raised for' : "'s requirement chain calls for"} ` +
            `${expectedGreige?.greigeCode ?? expectedGreigeId}` +
            `${expectedGreige?.greigeName ? ` ${expectedGreige.greigeName}` : ''}. ` +
            `Pick a lot of that greige, or raise a separate job work order.`,
        });
      }
      if (
        !opts.acknowledgeWidthMismatch &&
        jwo.greigeWidthInches != null &&
        row.greigeWidth != null &&
        Math.abs(Number(row.greigeWidth) - Number(jwo.greigeWidthInches)) > WIDTH_TOLERANCE_INCHES
      ) {
        blockers.push({
          code: ISSUE_ERROR_CODES.LOT_WIDTH_MISMATCH,
          message:
            `Lot ${row.greige?.greigeCode ?? ''} is ${Number(row.greigeWidth)}" wide but the order expects ` +
            `${Number(jwo.greigeWidthInches)}" greige. Confirm the width to issue anyway.`,
        });
      }
      // Friendly pre-check; the guarded consume inside the tx is the authority
      // Quantity rule (utils/quantity): the whole lot typed within dust is the whole lot — snapped
      // below so the guarded consume is asked for exactly what the lot holds.
      if (qtyExceeds(input.qty, row.quantityAvailable)) {
        blockers.push({
          code: ISSUE_ERROR_CODES.INSUFFICIENT_GREIGE,
          message: `Insufficient greige in lot ${row.greige?.greigeCode ?? ''}: ${Number(row.quantityAvailable)}m available, ${input.qty}m needed.`,
        });
      }
      // Track if lot is already at target processor (virtual issuance — no challan needed)
      const atProcessor = row.processorId != null && row.processorId === jwo.processorId;
      lots.push({ row, qty: snapToLimit(input.qty, row.quantityAvailable), atProcessor });
    }

    // Two rows on one lot double-consume it and mint two components for one physical lot.
    const lotIds = greigeLotInputs.map((l) => l.greigeStockLotId);
    if (new Set(lotIds).size !== lotIds.length) {
      blockers.push({
        code: ISSUE_ERROR_CODES.LOT_DUPLICATE,
        message: 'The same greige lot is listed twice — combine the quantities into one row.',
      });
    }
    // One job work order mints exactly ONE finished fabric master at receipt (from the first
    // lot's greige), so two greiges in one issue would silently claim to be one cloth.
    // Redundant wherever expectedGreigeId resolved — LOT_GREIGE_MISMATCH already forces every
    // lot equal to it — this is the ONLY guard on style-less stock orders, where identity is
    // unresolvable and nothing else compares the lots to each other.
    if (greigeLotInputs.length > 1 && new Set(lots.map((l) => l.row.greigeId)).size > 1) {
      blockers.push({
        code: ISSUE_ERROR_CODES.LOT_GREIGE_MIXED,
        message: 'All lots in one issue must be the same greige — issue them as separate job work orders.',
      });
    }
    lots.sort((a, b) => b.qty - a.qty);
  }

  let fabricLotRow: ValidateIssueResult['fabricLotRow'] = null;
  if (fabricLotId) {
    const row = await prisma.fabric_stock.findUnique({
      where: { id: fabricLotId },
      select: { id: true, quantityAvailable: true },
    });
    if (!row) {
      blockers.push({ code: ISSUE_ERROR_CODES.LOT_NOT_FOUND, message: 'Fabric stock lot not found.' });
    } else if (Number(row.quantityAvailable) < Number(jwo.qtySentMeters)) {
      blockers.push({
        code: ISSUE_ERROR_CODES.INSUFFICIENT_FABRIC_STOCK,
        message: `Insufficient fabric stock in the selected lot for ${Number(jwo.qtySentMeters)}m.`,
      });
    } else {
      fabricLotRow = row;
    }
  }

  return { jwo, lots, laceLots, fabricLotRow, expectedGreigeId, expectedGreige, blockers };
}

/**
 * The soonest date any job on a shared challan is due back, or undefined when none of them says.
 * A consolidated challan is late the moment its first job is late.
 */
function earliestExpectedReturn(dates: (Date | null | undefined)[]): Date | undefined {
  const known = dates.filter((d): d is Date => d != null);
  if (known.length === 0) return undefined;
  return known.reduce((earliest, d) => (d < earliest ? d : earliest));
}

/**
 * The Rule 55 challan lines for ONE order's material. Split out so a consolidated dispatch can
 * concatenate several orders' lines onto a single challan — each line still names its own order
 * via `jobWorkOrderId`, which is what keeps reconciliation (it sums challan_items BY order)
 * correct under a shared header.
 */
function buildOutwardChallanItems(v: ValidateIssueResult): CreateChallanItemInput[] {
  const { jwo, lots, laceLots, fabricLotRow } = v;
  const isMeters = jwo.uom === 'MTR';
  const unit = jwoStockUnit(jwo.uom);
  const description = `${jwo.processType} job work — ${jwo.jobWorkNumber}${jwo.style?.styleCode ? ` (${jwo.style.styleCode})` : ''}`;

  if (laceLots.length > 0) {
    // laceStockId is set for the trail, NOT for deduction: the challan is created DRAFT and
    // flipped to ISSUED here, so the challan page's own lace deduction never runs on it. The
    // consume below is the one and only writer.
    return laceLots.map(({ row, qty }) => ({
      itemType: 'LACE',
      laceStockId: row.id,
      quantity: qty,
      unit,
      // MATERIAL value (movement declaration), never the job-work rate
      rate: row.purchaseCost != null ? Number(row.purchaseCost) : undefined,
      description: `${description} — ${row.laceMaster?.laceName ?? 'greige lace'}`,
      jobWorkOrderId: jwo.id,
    }));
  }

  if (lots.length > 0) {
    return lots.map(({ row, qty }) => ({
      itemType: 'GREIGE',
      greigeStockId: row.id,
      // ACTUAL metres; the lot's fold length rides along so the challan can print the counted figure.
      quantity: qty,
      ...(hasFold(row.foldLengthCm) ? { foldLengthCm: Number(row.foldLengthCm) } : {}),
      unit,
      // MATERIAL value (movement declaration), never the job-work rate
      rate: row.purchaseCost != null ? Number(row.purchaseCost) : undefined,
      description,
      jobWorkOrderId: jwo.id,
    }));
  }
  return [
    {
      itemType: fabricLotRow ? 'FABRIC' : isMeters ? 'FABRIC' : 'GARMENT',
      fabricId: jwo.fabricId || undefined,
      fabricStockId: fabricLotRow?.id ?? undefined,
      quantity: Number(jwo.qtySentMeters),
      unit,
      description,
      jobWorkOrderId: jwo.id,
    },
  ];
}

/**
 * Claim the order for this issue. The JWO row IS the mutex: a concurrent issue loses the
 * updateMany and its whole transaction rolls back, so the same stock can never leave twice.
 * Explicit OR because Prisma `notIn` on a nullable enum silently excludes NULL rows.
 */
async function acquireIssueMutex(tx: Tx, jwo: JwoForIssue, issueDate: Date): Promise<void> {
  const mutex = await tx.job_work_orders.updateMany({
    where: {
      id: jwo.id,
      sentDate: null,
      jwoStatus: { notIn: ['CANCELLED', 'CLOSED'] },
    },
    data: { sentDate: issueDate },
  });
  if (mutex.count > 0) return;

  const now = await tx.job_work_orders.findUnique({
    where: { id: jwo.id },
    select: { sentDate: true, jwoStatus: true },
  });
  if (now?.jwoStatus === 'CANCELLED' || now?.jwoStatus === 'CLOSED') {
    throw new JobWorkOrderError(
      ISSUE_ERROR_CODES.ORDER_CANCELLED,
      `${jwo.jobWorkNumber} is ${now.jwoStatus.toLowerCase()}.`
    );
  }
  throw new JobWorkOrderError(
    ISSUE_ERROR_CODES.ALREADY_ISSUED,
    `${jwo.jobWorkNumber} was already issued${now?.sentDate ? ` on ${formatDate(now.sentDate)}` : ''}.`
  );
}

/** What issueOneWithinTx needs beyond the validated order and the challan it travels on. */
interface IssueOneOptions {
  userId: string;
  challanNumber?: string;
  vehicleNumber?: string;
  finishedFabricId?: string | null;
  /** Skip greige stock consumption (used when consumption was done with detail tracking) */
  skipGreigeConsumption?: boolean;
}

/** The challan shape both callers hand down — whatever createChallan returned. */
type IssuedChallan = {
  id: string;
  challanNumber: string;
  items: Array<{
    id: string;
    greigeStockId: string | null;
    laceStockId: string | null;
    jobWorkOrderId: string | null;
  }>;
};

/**
 * Everything one order does inside the issue transaction, AFTER its mutex is held and the
 * challan it travels on exists: consume → components → release reservations → statutory date →
 * totals → stamp. Both the single issue and the consolidated dispatch run exactly this, which
 * is the point: the two paths cannot drift apart into different definitions of "issued".
 *
 * Returns non-fatal warnings (currently only an unresolved GST rate).
 */
async function issueOneWithinTx(
  tx: Tx,
  v: ValidateIssueResult,
  challan: IssuedChallan | null,
  opts: IssueOneOptions,
  issueDate: Date
): Promise<string[]> {
  const { jwo, lots, laceLots, fabricLotRow } = v;
  const jwoId = jwo.id;
  const warnings: string[] = [];

  // 3a. CONSUME LACE — guarded, per lot, ledgered against the challan. Lace never sits at a
  // processor (lace_stock has no processorId), so there is no virtual-issuance case here.
  for (const { row, qty } of laceLots) {
    if (!challan) {
      throw new JobWorkOrderError('INTERNAL', 'Challan required for lace lot consumption');
    }
    await consumeLaceStock(row.id, qty, opts.userId, tx, {
      referenceType: 'CHALLAN',
      referenceId: challan.id,
      notes: `Issued to ${jwo.processor?.name ?? 'processor'} — ${jwo.jobWorkNumber} / ${challan.challanNumber}`,
    });
  }

  // 3. CONSUME — guarded, per lot, ledgered against the challan
  // Skip if caller already did detail-level consumption (bale/than tracking)
  // For processor lots (virtual issuance), skip consumption — stock is already at processor
  if (!opts.skipGreigeConsumption) {
    for (const { row, qty, atProcessor } of lots) {
      // Skip consumption for lots already at processor (virtual issuance)
      if (atProcessor) {
        logInfo(
          `[Issuance] Lot ${row.greige?.greigeCode ?? row.id.slice(0, 8)} already at processor — skipping consumption (virtual allocation)`
        );
        continue;
      }
      if (!challan) {
        // This shouldn't happen — main warehouse lots should always have a challan
        throw new JobWorkOrderError('INTERNAL', 'Challan required for main warehouse lot consumption');
      }
      await greigeStockService.consumeGreigeStock(row.id, qty, opts.userId, tx, {
        referenceType: 'CHALLAN',
        referenceId: challan.id,
        notes: `Issued to ${jwo.processor?.name ?? 'processor'} — ${jwo.jobWorkNumber} / ${challan.challanNumber}`,
      });
    }
  }
  if (lots.length === 0 && fabricLotRow) {
    // Phase 5b fabric-roll source (EMBROIDERY) — guarded decrement + ledger + sync
    const qty = Number(jwo.qtySentMeters);
    const deducted = await tx.fabric_stock.updateMany({
      where: { id: fabricLotRow.id, quantityAvailable: { gte: qty } },
      data: { quantityAvailable: { decrement: qty }, needsEmbroidery: false },
    });
    if (deducted.count === 0) {
      throw new JobWorkOrderError(
        ISSUE_ERROR_CODES.INSUFFICIENT_FABRIC_STOCK,
        `Insufficient fabric stock in the selected lot for ${qty}m`
      );
    }
    const lotRow = await tx.fabric_stock.findUnique({
      where: { id: fabricLotRow.id },
      select: { fabricId: true, warehouseId: true, weightedAvgCost: true, quantityAvailable: true },
    });
    const wac = Number(lotRow?.weightedAvgCost ?? 0);
    const balanceAfter = Number(lotRow?.quantityAvailable ?? 0);
    await tx.fabric_stock_transaction.create({
      data: {
        stockId: fabricLotRow.id,
        transactionType: 'EMBROIDERY_SEND_OUT',
        quantity: new Prisma.Decimal(qty),
        referenceType: 'JOB_WORK_ORDER',
        referenceId: jwo.id,
        costPerUnit: new Prisma.Decimal(wac),
        weightedAvgCost: new Prisma.Decimal(wac),
        totalValue: new Prisma.Decimal(toNumber(roundToCent(multiplyCurrency(qty, wac)))),
        balanceAfter: new Prisma.Decimal(balanceAfter),
        valueAfter: new Prisma.Decimal(toNumber(roundToCent(multiplyCurrency(balanceAfter, wac)))),
        notes: `Issued for ${jwo.processType} — ${jwo.jobWorkNumber}`,
        createdById: opts.userId,
      },
    });
    if (lotRow?.fabricId) {
      const materialId = await ensureMaterialRecord(lotRow.fabricId, 'FABRIC', tx);
      await syncStockLevelQuantity(materialId, -qty, lotRow.warehouseId ?? undefined, 'METER', tx);
    }
  }

  // 4a. LACE COMPONENTS — written for EVERY lace lot, even a single one. Unlike greige, the
  // header has no lot pointer to fall back on, so the component IS the record of which lot went
  // out and at what cost; cancel-restore and the receipt's cost build both read it.
  for (let i = 0; i < laceLots.length; i++) {
    const { row, qty } = laceLots[i];
    const cost = row.purchaseCost != null ? Number(row.purchaseCost) : Number(row.weightedAvgCost);
    const component = await tx.job_work_order_components.create({
      data: {
        jobWorkOrderId: jwo.id,
        materialType: 'LACE',
        laceId: row.laceId,
        laceStockId: row.id,
        qtySent: new Prisma.Decimal(qty),
        unit: jwo.uom,
        rate: new Prisma.Decimal(cost),
        rateAtIssue: new Prisma.Decimal(cost),
        declaredValue: new Prisma.Decimal(toNumber(roundToCent(multiplyCurrency(qty, cost)))),
        isChargeable: false, // principal's free-issue material
        isReturnable: true,
        componentName: `Greige lace lot ${i + 1} — ${row.laceMaster?.laceCode ?? row.id.slice(0, 8)}`,
        sortOrder: i,
      },
    });
    if (challan) {
      const challanItem = challan.items.find((it) => it.laceStockId === row.id && it.jobWorkOrderId === jwo.id);
      if (challanItem) {
        await tx.challan_items.update({
          where: { id: challanItem.id },
          data: { jobWorkOrderComponentId: component.id },
        });
      }
    }
  }

  // 4. MULTI-LOT — components carry the per-lot trail (reconciliation + PDF prefer them)
  if (lots.length > 1) {
    for (let i = 0; i < lots.length; i++) {
      const { row, qty } = lots[i];
      const cost =
        row.purchaseCost != null
          ? Number(row.purchaseCost)
          : row.weightedAvgCost != null
            ? Number(row.weightedAvgCost)
            : null;
      const component = await tx.job_work_order_components.create({
        data: {
          jobWorkOrderId: jwo.id,
          materialType: 'GREIGE',
          greigeId: row.greigeId,
          greigeStockId: row.id,
          qtySent: new Prisma.Decimal(qty),
          unit: jwo.uom,
          rate: cost != null ? new Prisma.Decimal(cost) : null,
          rateAtIssue: cost != null ? new Prisma.Decimal(cost) : null,
          declaredValue: cost != null ? new Prisma.Decimal(toNumber(roundToCent(multiplyCurrency(qty, cost)))) : null,
          isChargeable: false, // principal's free-issue material
          isReturnable: true,
          componentName: `Greige lot ${i + 1} — ${row.greige?.greigeCode ?? row.id.slice(0, 8)}`,
          sortOrder: i,
        },
      });
      // Match on the ORDER too: a consolidated dispatch puts several orders' lines on one
      // challan, and only the pair (order, lot) identifies a line there.
      // For virtual issuance (no challan), skip this linking.
      if (challan) {
        const challanItem = challan.items.find((it) => it.greigeStockId === row.id && it.jobWorkOrderId === jwo.id);
        if (challanItem) {
          await tx.challan_items.update({
            where: { id: challanItem.id },
            data: { jobWorkOrderComponentId: component.id },
          });
        }
      }
    }
  }

  // 5. RESERVATION RELEASE — this order's own MRP reservations are fulfilled by the issue
  const reqIds = jwo.requirementLinks.map((l) => l.material_requirements.id);
  if (reqIds.length > 0) {
    const released = await tx.stock_reservations.updateMany({
      where: { referenceId: { in: reqIds }, status: 'ACTIVE' },
      data: { status: 'CONSUMED', completedAt: issueDate },
    });
    if (released.count > 0) {
      for (const { row, qty } of lots) {
        const fresh = await tx.greige_stock.findUnique({
          where: { id: row.id },
          select: { quantityReserved: true },
        });
        const dec = Math.min(Number(fresh?.quantityReserved ?? 0), qty);
        if (dec > 0) {
          await tx.greige_stock.updateMany({
            where: { id: row.id, quantityReserved: { gte: dec } },
            data: { quantityReserved: { decrement: dec } },
          });
        }
      }
      for (const { row, qty } of laceLots) {
        const fresh = await tx.lace_stock.findUnique({ where: { id: row.id }, select: { quantityReserved: true } });
        const dec = Math.min(Number(fresh?.quantityReserved ?? 0), qty);
        if (dec > 0) {
          await tx.lace_stock.updateMany({
            where: { id: row.id, quantityReserved: { gte: dec } },
            data: { quantityReserved: { decrement: dec } },
          });
        }
      }
      logInfo(`[Issuance] Released ${released.count} MRP reservation(s) fulfilled by ${jwo.jobWorkNumber}`);
    }
  }

  // 6. (challan → ISSUED is a CHALLAN-level act, so the caller does it once — see below)

  // 7. STATUTORY — set once, kept silently thereafter (R2: immutable once set)
  if (!jwo.statutoryDueDate) {
    await jobWorkOrderService.setStatutoryDueDate(jwoId, issueDate, tx);
  }

  // 8. TOTALS — non-fatal (R1 blocks documents, not issue). Throws before any SQL
  //    when the rate is unresolved, so the tx is never aborted mid-flight.
  try {
    await jobWorkOrderService.computeCommercialTotals(jwoId, tx);
  } catch (error) {
    if (error instanceof JobWorkOrderError && error.code === JWO_ERROR_CODES.GST_RATE_UNRESOLVED) {
      warnings.push(`Issued, but the GST rate for ${jwo.processType} is unresolved — commercial totals pending.`);
    } else {
      throw error;
    }
  }

  // 9. STAMP
  const sumGreigeValue = lots.reduce((acc, { row, qty }) => {
    const cost =
      row.purchaseCost != null
        ? Number(row.purchaseCost)
        : row.weightedAvgCost != null
          ? Number(row.weightedAvgCost)
          : null;
    return cost != null ? addCurrency(acc, multiplyCurrency(qty, cost)) : acc;
  }, toCurrency(0));
  const sumLotValue = laceLots.reduce((acc, { row, qty }) => {
    const cost = row.purchaseCost != null ? Number(row.purchaseCost) : Number(row.weightedAvgCost);
    return addCurrency(acc, multiplyCurrency(qty, cost));
  }, sumGreigeValue);
  const declaredValue = toNumber(roundToCent(sumLotValue));
  // For virtual issuance (all lots at processor), use 'VIRTUAL-ALLOCATION' as challan number
  const isVirtualIssuance = lots.every((l) => l.atProcessor);
  await setJwoStatus(tx, jwoId, 'ISSUED', {
    challanNumber: opts.challanNumber || challan?.challanNumber || (isVirtualIssuance ? 'VIRTUAL-ALLOCATION' : ''),
    vehicleNumber: opts.vehicleNumber || null,
    greigeStockLotId: lots[0]?.row.id ?? null,
    fabricStockLotId: fabricLotRow?.id ?? jwo.fabricStockLotId,
    outwardChallanId: challan?.id ?? null,
    finishedFabricId: opts.finishedFabricId ?? jwo.finishedFabricId,
    ...(declaredValue > 0 ? { declaredValue } : {}),
    // Actual lot width wins silence: fill only when creation didn't already set it
    ...(jwo.greigeWidthInches == null && lots[0]?.row.greigeWidth != null
      ? { greigeWidthInches: Number(lots[0].row.greigeWidth) }
      : {}),
  });

  return warnings;
}

/**
 * Issue ONE job work order — a single-order dispatch. Throws JobWorkOrderError (422 codes)
 * on any blocker; on success the JWO is AT_MILL/ISSUED with an ISSUED outward challan whose
 * header names it.
 */
export async function issueJobWorkOrder(jwoId: string, opts: IssueJwoOptions): Promise<IssueJwoResult> {
  const v = await validateIssue(jwoId, opts);
  if (v.blockers.length > 0) {
    throw new JobWorkOrderError(v.blockers[0].code, v.blockers[0].message);
  }
  const { jwo, lots, laceLots } = v;
  const issueDate = opts.sentDate ?? new Date();

  // Separate lots: mainWarehouseLots need challan + consumption, processorLots are virtual issuance
  const mainWarehouseLots = lots.filter((l) => !l.atProcessor);
  const processorLots = lots.filter((l) => l.atProcessor);
  const isVirtualIssuance = mainWarehouseLots.length === 0 && processorLots.length > 0;
  // Lace always travels: every lace lot is in our own warehouse, so a lace issue is never virtual.
  const needsChallan = mainWarehouseLots.length > 0 || laceLots.length > 0;

  const result = await prisma.$transaction(
    async (tx) => {
      // 1. MUTEX — claim the order before anything is created or consumed
      await acquireIssueMutex(tx, jwo, issueDate);

      let challan: IssuedChallan | null = null;

      // 2. CHALLAN — only needed if dispatching from main warehouse
      if (needsChallan) {
        // Build challan items only for main warehouse lots
        const challanV = { ...v, lots: mainWarehouseLots };
        challan = await createChallan(
          {
            challanType: 'OUTWARD',
            challanDate: issueDate,
            fromType: 'WAREHOUSE',
            fromName: 'Main Warehouse',
            toType: 'VENDOR',
            toId: jwo.processorId,
            toName: jwo.processor?.name || 'Processor',
            purchaseOrderId: jwo.purchaseOrderId || undefined,
            jobWorkOrderId: jwo.id,
            vehicleNumber: opts.vehicleNumber || undefined,
            issuedById: opts.userId,
            unit: jwoStockUnit(jwo.uom),
            remarks: opts.challanNumber ? `Manual challan ref: ${opts.challanNumber}` : undefined,
            // When the goods are due back. Left NULL until 2026-09-21, which made the Control
            // Center's overdue-challan alert unfireable — Prisma's `{ lt: today }` skips NULLs.
            expectedDate: jwo.expectedReturnDate ?? undefined,
            items: buildOutwardChallanItems(challanV),
          },
          tx
        );
      }

      // 3-9: Issue with consumption for main warehouse lots, skip for processor lots
      const warnings = await issueOneWithinTx(tx, v, challan, opts, issueDate);

      // Challan → ISSUED (dispatch is real; also disarms the challan-page re-consume)
      if (challan) {
        await tx.challans.update({ where: { id: challan.id }, data: { status: 'ISSUED', issuedDate: issueDate } });
      }

      return {
        jwoId,
        challanId: challan?.id ?? null,
        challanNumber: challan?.challanNumber ?? (isVirtualIssuance ? 'VIRTUAL-ALLOCATION' : ''),
        warnings,
      };
    },
    { timeout: 15000, maxWait: 5000 }
  );

  if (isVirtualIssuance) {
    logInfo(
      `[Issuance] Virtual issuance ${jwo.jobWorkNumber} — ${processorLots.length} lot(s) already at ${jwo.processor?.name}, no dispatch needed`
    );
  } else {
    logInfo(
      `[Issuance] Issued ${jwo.jobWorkNumber} — challan ${result.challanNumber}` +
        (laceLots.length > 0
          ? `, ${laceLots.length} lace lot(s) consumed (${Number(jwo.qtySentMeters)}${jwo.uom})`
          : '') +
        (mainWarehouseLots.length > 0
          ? `, ${mainWarehouseLots.length} greige lot(s) consumed (${Number(jwo.qtySentMeters)}${jwo.uom})`
          : '') +
        (processorLots.length > 0 ? `, ${processorLots.length} lot(s) already at processor (virtual)` : '')
    );
  }
  return result;
}

/** One order's place on a consolidated dispatch: which order, and which lots go on the truck. */
export interface DispatchOrderInput {
  jwoId: string;
  lots?: IssueLotInput[];
  greigeStockLotId?: string | null;
  fabricStockLotId?: string | null;
}

export interface DispatchInput {
  userId: string;
  /** Every order must be for THIS processor — one truck, one destination. */
  processorId: string;
  sentDate?: Date;
  vehicleNumber?: string;
  /** Manual challan-book reference for the whole vehicle. */
  challanNumber?: string;
  acknowledgeWidthMismatch?: boolean;
  orders: DispatchOrderInput[];
}

export interface DispatchOrderBlockers {
  jwoId: string;
  jobWorkNumber: string | null;
  blockers: IssueBlocker[];
}

export interface ValidateDispatchResult {
  /** Per-order validation, in input order. */
  validations: ValidateIssueResult[];
  /** Problems with the dispatch AS A WHOLE (wrong processor, a lot claimed twice, empty). */
  dispatchBlockers: IssueBlocker[];
  /** Per-order problems, so the UI can put each message against the right row. */
  orderBlockers: DispatchOrderBlockers[];
  canDispatch: boolean;
}

/**
 * READ-ONLY validation of a consolidated dispatch — every order's own blockers plus the ones
 * that only exist because the orders travel together.
 */
export async function validateDispatch(input: DispatchInput): Promise<ValidateDispatchResult> {
  const dispatchBlockers: IssueBlocker[] = [];
  const orderBlockers: DispatchOrderBlockers[] = [];

  if (input.orders.length === 0) {
    return {
      validations: [],
      dispatchBlockers: [
        { code: ISSUE_ERROR_CODES.NO_ORDERS, message: 'Pick at least one job work order to dispatch.' },
      ],
      orderBlockers: [],
      canDispatch: false,
    };
  }

  const validations: ValidateIssueResult[] = [];
  for (const order of input.orders) {
    const v = await validateIssue(order.jwoId, {
      lots: order.lots,
      greigeStockLotId: order.greigeStockLotId,
      fabricStockLotId: order.fabricStockLotId,
      acknowledgeWidthMismatch: input.acknowledgeWidthMismatch,
    });
    validations.push(v);
    if (v.blockers.length > 0) {
      orderBlockers.push({ jwoId: order.jwoId, jobWorkNumber: v.jwo.jobWorkNumber, blockers: v.blockers });
    }
  }

  // One challan is one movement to ONE destination. Mixing processors would declare goods as
  // delivered somewhere they never went, and Section 143 tracks the return per processor.
  for (const v of validations) {
    if (v.jwo.processorId !== input.processorId) {
      dispatchBlockers.push({
        code: ISSUE_ERROR_CODES.PROCESSOR_MISMATCH,
        message: `${v.jwo.jobWorkNumber} is for a different processor — a dispatch is one vehicle to one processor.`,
      });
    }
  }

  // Each order dedups its OWN lots (LOT_DUPLICATE), but nothing there can see its siblings:
  // the same physical lot on two orders would be consumed twice from one roll of cloth.
  // Keyed on the order's ID, not its number: two rows listing the same lot WITHIN one order is
  // LOT_DUPLICATE's business, and jobWorkNumber carries no uniqueness constraint to rely on.
  const seenLots = new Map<string, { jwoId: string; jobWorkNumber: string }>();
  for (const v of validations) {
    for (const { row } of v.lots) {
      const firstOwner = seenLots.get(row.id);
      if (firstOwner && firstOwner.jwoId !== v.jwo.id) {
        dispatchBlockers.push({
          code: ISSUE_ERROR_CODES.LOT_REUSED_ACROSS_ORDERS,
          message:
            `Lot ${row.greige?.greigeCode ?? row.id.slice(0, 8)} is on both ${firstOwner.jobWorkNumber} and ` +
            `${v.jwo.jobWorkNumber} — one lot can only be sent once. Split the quantity across lots.`,
        });
      } else if (!firstOwner) {
        seenLots.set(row.id, { jwoId: v.jwo.id, jobWorkNumber: v.jwo.jobWorkNumber });
      }
    }
  }

  return {
    validations,
    dispatchBlockers,
    orderBlockers,
    canDispatch: dispatchBlockers.length === 0 && orderBlockers.length === 0,
  };
}

export interface DispatchResult {
  challanId: string;
  challanNumber: string;
  orders: Array<{ jwoId: string; jobWorkNumber: string }>;
  warnings: string[];
}

/**
 * Consolidated dispatch — ONE outward challan carrying SEVERAL job work orders to one processor
 * (user decision 2026-08-19, Option A).
 *
 * The real-world event this models: a truck leaves for the dyer with 5,000 m of one greige for
 * one style, 3,000 m of another for a second style, and 2,000 m for a third. Each of those is
 * its own job work order — its own rate, shrinkage, expected width, receipt date, loss
 * reconciliation and finished fabric — and stays so. What was missing was the DISPATCH above
 * them; without it the same vehicle produced three challans.
 *
 * The header's jobWorkOrderId is deliberately null (it cannot name one order truthfully); every
 * LINE carries its own `jobWorkOrderId`, which is what reconciliation already keys on. Nothing
 * downstream needed changing for that — receipt, loss split and Section 143 remain per order.
 *
 * All-or-nothing: one transaction, so a truck's paperwork can never be half-written.
 */
export async function dispatchJobWorkOrders(input: DispatchInput): Promise<DispatchResult> {
  const v = await validateDispatch(input);
  if (v.dispatchBlockers.length > 0) {
    throw new JobWorkOrderError(v.dispatchBlockers[0].code, v.dispatchBlockers[0].message);
  }
  if (v.orderBlockers.length > 0) {
    const first = v.orderBlockers[0];
    throw new JobWorkOrderError(first.blockers[0].code, `${first.jobWorkNumber}: ${first.blockers[0].message}`);
  }

  const issueDate = input.sentDate ?? new Date();
  const processorName = v.validations[0].jwo.processor?.name || 'Processor';
  // Lines carry their own unit; the header takes the orders' unit only when they all share one.
  const orderUnits = new Set(v.validations.map((x) => jwoStockUnit(x.jwo.uom)));
  const headerUnit = orderUnits.size === 1 ? [...orderUnits][0] : Unit.PIECE;

  const result = await prisma.$transaction(
    async (tx) => {
      // 1. MUTEX every order FIRST — an already-issued order in the list must stop the whole
      //    dispatch before a challan number is drawn, not halfway through consuming stock.
      for (const one of v.validations) {
        await acquireIssueMutex(tx, one.jwo, issueDate);
      }

      // 2. ONE challan for the vehicle. purchaseOrderId is omitted on purpose: the orders may
      //    sit under different POs, and a header can only name one truthfully.
      const challan = await createChallan(
        {
          challanType: 'OUTWARD',
          challanDate: issueDate,
          fromType: 'WAREHOUSE',
          fromName: 'Main Warehouse',
          toType: 'VENDOR',
          toId: input.processorId,
          toName: processorName,
          vehicleNumber: input.vehicleNumber || undefined,
          issuedById: input.userId,
          unit: headerUnit,
          remarks:
            `Consolidated dispatch — ${v.validations.length} job work orders` +
            (input.challanNumber ? `. Manual challan ref: ${input.challanNumber}` : ''),
          // One challan, several jobs: the EARLIEST due date governs. The challan becomes overdue
          // as soon as the first job on it is late — anything later would let a slipping job hide
          // behind a patient one on the same truck.
          expectedDate: earliestExpectedReturn(v.validations.map((one) => one.jwo.expectedReturnDate)),
          items: v.validations.flatMap((one) => buildOutwardChallanItems(one)),
        },
        tx
      );

      // 3. Each order runs the SAME body a single issue runs
      const warnings: string[] = [];
      for (const one of v.validations) {
        const w = await issueOneWithinTx(
          tx,
          one,
          challan,
          { userId: input.userId, challanNumber: input.challanNumber, vehicleNumber: input.vehicleNumber },
          issueDate
        );
        warnings.push(...w);
      }

      await tx.challans.update({ where: { id: challan.id }, data: { status: 'ISSUED', issuedDate: issueDate } });

      return {
        challanId: challan.id,
        challanNumber: challan.challanNumber,
        orders: v.validations.map((one) => ({ jwoId: one.jwo.id, jobWorkNumber: one.jwo.jobWorkNumber })),
        warnings,
      };
    },
    // Scales with the number of orders on the truck, unlike the single-order path's flat 15s.
    { timeout: Math.min(60000, 15000 + v.validations.length * 5000), maxWait: 5000 }
  );

  logInfo(
    `[Issuance] Dispatched ${result.orders.length} order(s) to ${processorName} on challan ${result.challanNumber}: ` +
      result.orders.map((o) => o.jobWorkNumber).join(', ')
  );
  return result;
}

/**
 * Reverse an issue as part of JWO cancellation — runs inside the CALLER's transaction.
 * Restores every consumed lot (guarded — never drives quantityConsumed negative),
 * writes RETURN ledger rows, syncs stock_levels (the piece the old cancel path missed),
 * and cancels the outward challan so ITC-04 stops declaring the movement.
 *
 * No reservation resurrection: consumption is available-only, so nothing was taken from
 * quantityReserved; requirements reverted to PO_REQUIRED get re-reserved by re-planning.
 */
export async function unissueForCancel(
  tx: Tx,
  jwo: {
    id: string;
    jobWorkNumber: string;
    processType: string;
    qtySentMeters: Prisma.Decimal | number;
    greigeStockLotId: string | null;
    fabricStockLotId: string | null;
    outwardChallanId: string | null;
  },
  userId: string
): Promise<void> {
  const totalQty = Number(jwo.qtySentMeters);

  // Lace lots are always recorded as components (the header carries no lace lot pointer), so the
  // components ARE the restore list. Keyed off materialType, so no fabricType is needed here.
  const laceComponents = await tx.job_work_order_components.findMany({
    where: { jobWorkOrderId: jwo.id, materialType: 'LACE', laceStockId: { not: null } },
    select: { laceStockId: true, qtySent: true },
  });
  for (const c of laceComponents) {
    try {
      await restoreLaceStock(c.laceStockId as string, Number(c.qtySent), userId, tx, {
        referenceType: 'JOB_WORK_ORDER',
        referenceId: jwo.id,
        notes: `Job work cancelled — ${jwo.jobWorkNumber}`,
      });
    } catch (error) {
      throw new JobWorkOrderError(
        ISSUE_ERROR_CODES.CANCEL_RESTORE_FAILED,
        `Cannot credit ${Number(c.qtySent)}m back to lace lot ${c.laceStockId} — ` +
          `${error instanceof Error ? error.message : 'restore failed'}. Reconcile the lot manually before cancelling.`
      );
    }
  }

  // Multi-lot issues recorded their split on components; single-lot uses the JWO pointer
  const components = await tx.job_work_order_components.findMany({
    where: { jobWorkOrderId: jwo.id, materialType: 'GREIGE', greigeStockId: { not: null } },
    select: { greigeStockId: true, qtySent: true },
  });
  const greigeLots: Array<{ id: string; qty: number }> =
    components.length > 0
      ? components.map((c) => ({ id: c.greigeStockId as string, qty: Number(c.qtySent) }))
      : jwo.greigeStockLotId
        ? [{ id: jwo.greigeStockLotId, qty: totalQty }]
        : [];

  for (const lot of greigeLots) {
    const restored = await tx.greige_stock.updateMany({
      where: { id: lot.id, quantityConsumed: { gte: lot.qty } },
      data: {
        quantityAvailable: { increment: lot.qty },
        quantityConsumed: { decrement: lot.qty },
        status: 'AVAILABLE',
      },
    });
    if (restored.count === 0) {
      throw new JobWorkOrderError(
        ISSUE_ERROR_CODES.CANCEL_RESTORE_FAILED,
        `Cannot credit ${lot.qty}m back to greige lot ${lot.id} — its consumed balance is smaller ` +
          `(the lot was adjusted after issue). Reconcile the lot manually before cancelling.`
      );
    }
    const lotRow = await tx.greige_stock.findUnique({
      where: { id: lot.id },
      select: { greigeId: true, warehouseId: true, quantityAvailable: true, purchaseCost: true, weightedAvgCost: true },
    });
    const cost =
      lotRow?.purchaseCost != null
        ? Number(lotRow.purchaseCost)
        : lotRow?.weightedAvgCost != null
          ? Number(lotRow.weightedAvgCost)
          : null;
    await tx.greige_stock_transaction.create({
      data: {
        stockId: lot.id,
        transactionType: 'RETURN',
        quantity: new Prisma.Decimal(lot.qty),
        balanceAfter: lotRow?.quantityAvailable ?? new Prisma.Decimal(0),
        costPerUnit: cost != null ? new Prisma.Decimal(cost) : null,
        totalValue: cost != null ? new Prisma.Decimal(toNumber(roundToCent(multiplyCurrency(lot.qty, cost)))) : null,
        referenceType: 'JOB_WORK_ORDER',
        referenceId: jwo.id,
        notes: `Job work cancelled — ${jwo.jobWorkNumber}`,
        performedById: userId,
      },
    });
    // The piece the old cancel path missed: keep the central ledger in step
    const material = lotRow?.greigeId
      ? await tx.materials.findFirst({ where: { greigeId: lotRow.greigeId }, select: { id: true } })
      : null;
    if (material) {
      await syncStockLevelQuantity(material.id, lot.qty, lotRow?.warehouseId ?? undefined, 'METER', tx);
    } else {
      logError(
        `[Issuance] No materials shim row for greige ${lotRow?.greigeId} — stock_levels NOT restored for ` +
          `${lot.qty}m cancel credit (lot ${lot.id})`,
        new Error('missing materials mirror')
      );
    }
  }

  if (greigeLots.length === 0 && jwo.fabricStockLotId) {
    // Fabric-roll source (EMBROIDERY) — credit back, ledger, sync (moved from the controller)
    await tx.fabric_stock.update({
      where: { id: jwo.fabricStockLotId },
      data: {
        quantityAvailable: { increment: totalQty },
        ...(jwo.processType === 'EMBROIDERY' ? { needsEmbroidery: true } : {}),
      },
    });
    const lotRow = await tx.fabric_stock.findUnique({
      where: { id: jwo.fabricStockLotId },
      select: { fabricId: true, warehouseId: true, weightedAvgCost: true, quantityAvailable: true },
    });
    const wac = Number(lotRow?.weightedAvgCost ?? 0);
    const balanceAfter = Number(lotRow?.quantityAvailable ?? 0);
    await tx.fabric_stock_transaction.create({
      data: {
        stockId: jwo.fabricStockLotId,
        transactionType: 'EMBROIDERY_CANCELLED',
        quantity: new Prisma.Decimal(totalQty),
        referenceType: 'JOB_WORK_ORDER',
        referenceId: jwo.id,
        costPerUnit: new Prisma.Decimal(wac),
        weightedAvgCost: new Prisma.Decimal(wac),
        totalValue: new Prisma.Decimal(toNumber(roundToCent(multiplyCurrency(totalQty, wac)))),
        balanceAfter: new Prisma.Decimal(balanceAfter),
        valueAfter: new Prisma.Decimal(toNumber(roundToCent(multiplyCurrency(balanceAfter, wac)))),
        notes: `Job work cancelled — ${jwo.jobWorkNumber}`,
        createdById: userId,
      },
    });
    if (lotRow?.fabricId) {
      const materialId = await ensureMaterialRecord(lotRow.fabricId, 'FABRIC', tx);
      await syncStockLevelQuantity(materialId, totalQty, lotRow.warehouseId ?? undefined, 'METER', tx);
    }
  }

  // Cancel the outward challan — safe HERE because this same tx just restored the stock
  // the issue deducted (the DRAFT-only guard on cancelChallan protects everyone else).
  // ITC-04 and reconciliation filter status != CANCELLED, so the movement stops counting.
  if (jwo.outwardChallanId) {
    const cancelled = await tx.challans.updateMany({
      where: { id: jwo.outwardChallanId, status: { in: ['DRAFT', 'ISSUED'] } },
      data: { status: 'CANCELLED' },
    });
    if (cancelled.count === 0) {
      logWarn(`[Issuance] Outward challan ${jwo.outwardChallanId} not cancellable (already received?) — left as-is`, {
        jwoId: jwo.id,
      });
    }
  }
}

/**
 * Options for issuing with explicit bale/than detail selection.
 * User selects specific thans to send to the processor.
 */
export interface IssueJwoWithDetailsOptions {
  userId: string;
  sentDate?: Date;
  /** Lots with explicit bale/than detail selections */
  lotsWithDetails: IssueLotWithDetailsInput[];
  challanNumber?: string;
  vehicleNumber?: string;
  finishedFabricId?: string | null;
  acknowledgeWidthMismatch?: boolean;
}

/**
 * Issue a job work order with explicit bale/than detail selection.
 * Similar to issueJobWorkOrder but tracks which specific thans were issued.
 *
 * This function:
 * 1. Validates the JWO can be issued (same as issueJobWorkOrder)
 * 2. Creates an outward challan
 * 3. Consumes greige stock at the detail level (tracking individual thans)
 * 4. Creates greige_issue_details records for audit
 */
export async function issueJobWorkOrderWithDetails(
  jwoId: string,
  opts: IssueJwoWithDetailsOptions
): Promise<IssueJwoResult> {
  // Convert lotsWithDetails to standard lots format for validation. Than rows carry the COUNTED tag
  // figure; the lot and the job are ACTUAL metres, so a pick is converted at the lot's fold length.
  const standardLots: IssueLotInput[] = await Promise.all(
    opts.lotsWithDetails.map(async (l) => ({
      greigeStockLotId: l.greigeStockLotId,
      qty:
        l.details && l.details.length > 0
          ? (await greigeStockService.thanPickActualQty(l.greigeStockLotId, l.details)).actual
          : (l.qty ?? 0),
    }))
  );

  // Use existing validation
  const v = await validateIssue(jwoId, { ...opts, lots: standardLots });
  if (v.blockers.length > 0) {
    throw new JobWorkOrderError(v.blockers[0].code, v.blockers[0].message);
  }
  const { jwo } = v;
  const issueDate = opts.sentDate ?? new Date();

  const result = await prisma.$transaction(
    async (tx) => {
      // 1. MUTEX — claim the order before anything is created or consumed
      await acquireIssueMutex(tx, jwo, issueDate);

      // 2. CHALLAN — Rule 55 movement document
      const challan = await createChallan(
        {
          challanType: 'OUTWARD',
          challanDate: issueDate,
          fromType: 'WAREHOUSE',
          fromName: 'Main Warehouse',
          toType: 'VENDOR',
          toId: jwo.processorId,
          toName: jwo.processor?.name || 'Processor',
          purchaseOrderId: jwo.purchaseOrderId || undefined,
          jobWorkOrderId: jwo.id,
          vehicleNumber: opts.vehicleNumber || undefined,
          issuedById: opts.userId,
          unit: jwoStockUnit(jwo.uom),
          remarks: opts.challanNumber ? `Manual challan ref: ${opts.challanNumber}` : undefined,
          // See the with-details path: a NULL expectedDate is invisible to the overdue alert.
          expectedDate: jwo.expectedReturnDate ?? undefined,
          items: buildOutwardChallanItems(v),
        },
        tx
      );

      // 3. CONSUME — with detail tracking
      for (const lotInput of opts.lotsWithDetails) {
        if (lotInput.details && lotInput.details.length > 0) {
          // Detail-level consumption (bale/than tracking)
          await greigeStockService.consumeWithDetails(lotInput.greigeStockLotId, lotInput.details, opts.userId, tx, {
            referenceType: 'CHALLAN',
            referenceId: challan.id,
            notes: `Issued to ${jwo.processor?.name ?? 'processor'} — ${jwo.jobWorkNumber} / ${challan.challanNumber}`,
            jobWorkOrderId: jwo.id,
            challanId: challan.id,
          });
        } else if (lotInput.qty && lotInput.qty > 0) {
          // Fallback: lot-level consumption (no detail tracking)
          await greigeStockService.consumeGreigeStock(lotInput.greigeStockLotId, lotInput.qty, opts.userId, tx, {
            referenceType: 'CHALLAN',
            referenceId: challan.id,
            notes: `Issued to ${jwo.processor?.name ?? 'processor'} — ${jwo.jobWorkNumber} / ${challan.challanNumber}`,
          });
        }
      }

      // 4-9: Same as issueOneWithinTx — components, reservations, status, etc.
      // Use the existing helper for the remaining steps (skip greige consumption since we did it above)
      const warnings = await issueOneWithinTx(tx, v, challan, { ...opts, skipGreigeConsumption: true }, issueDate);

      // Challan → ISSUED
      await tx.challans.update({ where: { id: challan.id }, data: { status: 'ISSUED', issuedDate: issueDate } });

      return { jwoId, challanId: challan.id, challanNumber: challan.challanNumber, warnings };
    },
    { timeout: 15000, maxWait: 5000 }
  );

  const totalMeters = standardLots.reduce((sum, l) => sum + l.qty, 0);
  logInfo(
    `[Issuance] Issued ${jwo.jobWorkNumber} with detail tracking — challan ${result.challanNumber}, ` +
      `${totalMeters}m from ${opts.lotsWithDetails.length} lot(s)`
  );
  return result;
}
