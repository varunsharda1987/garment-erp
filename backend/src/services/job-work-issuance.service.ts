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

import { randomUUID } from 'crypto';
import { Prisma, Unit } from '@prisma/client';
import prisma from '../config/database';
import { createChallan, type CreateChallanItemInput } from './challan.service';
import greigeStockService, { THAN_PICK_TOLERANCE_PCT, pieceKindOf, type GreigePieceKind } from './greige-stock.service';
import { consumeLaceStock, restoreLaceStock } from './laceStock.service';
import { jobWorkOrderService, JobWorkOrderError, JWO_ERROR_CODES } from './job-work-order.service';
import { ensureMaterialRecord, syncStockLevelQuantity } from './helpers/material-sync.helper';
import { jwoStockUnit, setJwoStatus } from './helpers/jwo-status.helper';
import { consumeReservations, unconsumeReservations } from './helpers/stock-reservation.helper';
import {
  heldForOtherOrders,
  heldStockConflict,
  takeHeldGoods,
  STOCK_HELD_FOR_ORDER,
  type HeldForOther,
} from './helpers/po-allocation.helper';
import {
  coveringChallanWhere,
  challanOrigin,
  LOT_WAREHOUSE_SELECT,
  resolveLotLocation,
  type LotLocation,
} from './helpers/lot-location.helper';
import { toCurrency, addCurrency, multiplyCurrency, roundToCent, toNumber } from '../utils/currency';
import { logInfo, logWarn, logError } from '../utils/logger';
import { foldActual, hasFold } from '../utils/fold-length';
import { formatDate, formatDateTime, toDateInputValue } from '../utils/date';
import { isQtyZero, qtyExceeds, snapToLimit } from '../utils/quantity';
import { unitShort } from '../utils/units';
import { styleCodeLabel } from '../utils/style-code';
import {
  fabricLotLabel,
  markPiecesOut,
  pickActualQty,
  settleLotBack,
  settleLotOut,
  type FabricPiecePick,
} from './fabric-lot-pieces.service';
import { BusinessError } from '../errors';

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
  /**
   * Named thans per greige lot id (COUNTED metres). A lot listed here is consumed than by than —
   * each than marked issued against this job and challan — instead of by plain quantity. Its
   * quantity in `lots` must be the picks' ACTUAL metres (thanPickActualQty).
   */
  thanPicks?: Record<string, IssueDetailInput[]>;
  /**
   * Named rolls / thans of the finished-fabric lot (fabricStockLotId), COUNTED metres (2026-09-28). The lot then
   * gives up what they come to at its fold (pickActualQty) — within ±1% of the order — and the pieces are
   * marked issued to this job and its challan. Without picks the lot gives up the order's quantity.
   */
  fabricPicks?: FabricPiecePick[];
  /**
   * The user confirmed "take them anyway": greige / lace on the picked lots that is held for OTHER orders is taken
   * for this job, and those orders' need reopens (owner decision D10). Without it such an issue is refused with
   * STOCK_HELD_FOR_ORDER, naming who holds the goods.
   */
  takeHeld?: boolean;
}

export interface IssueJwoResult {
  jwoId: string;
  /** Null when nothing travelled: every lot was drawn where it lies at the processor */
  challanId: string | null;
  /** The new challan's number; 'VIRTUAL-ALLOCATION' when nothing travelled */
  challanNumber: string;
  /** The processor at which some of the cloth was drawn where it lies, or null */
  drawnAt: string | null;
  /** The challan(s) already covering the cloth drawn where it lies (comma-separated), or '' */
  coveringChallans: string;
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
  /** A lot booked as held by the processor but with no challan covering it — never drawn undocumented. */
  LOT_HELD_WITHOUT_CHALLAN: 'LOT_HELD_WITHOUT_CHALLAN',
  /** Dispatch only: a lot already held at the processor never goes on a truck challan. */
  LOT_NOT_ON_TRUCK: 'LOT_NOT_ON_TRUCK',
  /** Ready fabric lying at a processor cannot be taken where it lies yet (Phase 4a). */
  /** The sent date is after today. */
  SENT_DATE_IN_FUTURE: 'SENT_DATE_IN_FUTURE',
  /** A store lot cannot leave before the day it was received. */
  SENT_DATE_BEFORE_RECEIPT: 'SENT_DATE_BEFORE_RECEIPT',
  /** Cloth already at the processor cannot be drawn before the day it reached them. */
  SENT_BEFORE_ARRIVAL: 'SENT_BEFORE_ARRIVAL',
  INSUFFICIENT_GREIGE: 'INSUFFICIENT_GREIGE',
  INSUFFICIENT_FABRIC_STOCK: 'INSUFFICIENT_FABRIC_STOCK',
  CANCEL_RESTORE_FAILED: 'CANCEL_RESTORE_FAILED',
  // Consolidated dispatch only — problems that exist because the orders travel together
  NO_ORDERS: 'NO_ORDERS',
  PROCESSOR_MISMATCH: 'PROCESSOR_MISMATCH',
  LOT_REUSED_ACROSS_ORDERS: 'LOT_REUSED_ACROSS_ORDERS',
  /** The picked greige / lace is held for other orders — a warning the user may overrule (takeHeld, D10) */
  STOCK_HELD_FOR_ORDER,
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
  workOrder: { select: { orderId: true } },
  requirementLinks: {
    select: {
      material_requirements: {
        select: {
          id: true,
          materialId: true,
          linkedRequirementId: true,
          orderId: true,
          materials: { select: { greigeId: true } },
        },
      },
    },
  },
} satisfies Prisma.job_work_ordersInclude;

type JwoForIssue = Prisma.job_work_ordersGetPayload<{ include: typeof JWO_ISSUE_INCLUDE }>;

/** The order a job works for: its requirement's order, else its work order's. A stock job has none. */
const jwoOrderId = (jwo: Pick<JwoForIssue, 'requirementLinks' | 'workOrder'>): string | null =>
  jwo.requirementLinks.find((l) => l.material_requirements.orderId)?.material_requirements.orderId ??
  jwo.workOrder?.orderId ??
  null;

/** One picked greige / lace lot, as the held-goods gate reads it */
interface PickedLot {
  table: 'greige' | 'lace';
  lotId: string;
  /** materials.id === master.id, so a lot's greigeId / laceId IS its materials id */
  materialId: string;
  lotCode: string;
  qty: number;
}

/** A picked lot that gives this job less than it asks for, because other orders hold the rest */
export interface HeldShortLot extends PickedLot {
  /** How much of other orders' holds the issue needs from this lot */
  short: number;
  held: HeldForOther[];
}

const pickedLotsOf = (v: Pick<ValidateIssueResult, 'lots' | 'laceLots'>): PickedLot[] => [
  ...v.laceLots.map((l) => ({
    table: 'lace' as const,
    lotId: l.row.id,
    materialId: l.row.laceId,
    lotCode: l.row.laceMaster?.laceCode ?? l.row.id.slice(0, 8),
    qty: l.qty,
  })),
  ...v.lots.map((l) => ({
    table: 'greige' as const,
    lotId: l.row.id,
    materialId: l.row.greigeId,
    lotCode: l.row.greige?.greigeCode ?? l.row.id.slice(0, 8),
    qty: l.qty,
  })),
];

/**
 * The held-goods gate (po-allocation design §6.7, owner decision D10): a picked lot gives this job what is on it
 * less what OTHER orders hold there — an order may always use what is held for itself, and the job what is held
 * for its own requirements (a stock job's have no order). Reads the lot as it stands: call it inside the issue's
 * transaction before any lot is consumed, or outside it for the friendly check.
 */
async function heldShortOnLots(
  client: Tx | typeof prisma,
  jwo: Pick<JwoForIssue, 'requirementLinks' | 'workOrder'>,
  picked: PickedLot[]
): Promise<HeldShortLot[]> {
  const out: HeldShortLot[] = [];
  const takerOrderId = jwoOrderId(jwo);
  const ownRequirementIds = new Set(jobRequirementIds(jwo.requirementLinks));
  const LOT_QTY = { quantityAvailable: true, quantityReserved: true } as const;
  for (const p of picked) {
    const lot =
      p.table === 'greige'
        ? await client.greige_stock.findUnique({ where: { id: p.lotId }, select: LOT_QTY })
        : await client.lace_stock.findUnique({ where: { id: p.lotId }, select: LOT_QTY });
    // A lot's reserved figure is the sum of the holds on it: nothing reserved, nobody holds it
    if (!lot || !qtyExceeds(lot.quantityReserved, 0)) continue;
    const held = (
      await heldForOtherOrders(client, {
        materialId: p.materialId,
        lotIds: [p.lotId],
        excludeOrderId: takerOrderId,
      })
    ).filter((h) => !ownRequirementIds.has(h.requirementId));
    if (held.length === 0) continue;
    const othersHeld = held.reduce((sum, h) => sum + h.qty, 0);
    const free = Number(lot.quantityAvailable) - othersHeld;
    // More than the lot holds at all is INSUFFICIENT_GREIGE / _LACE's business: only held goods can be taken
    const short = Math.round(Math.min(othersHeld, p.qty - free) * 1000) / 1000;
    if (qtyExceeds(short, 0)) out.push({ ...p, short, held });
  }
  return out;
}

/** "150 m of GRG-0042 is held for ORD…030 (MR2608-0157). …" */
function heldShortMessage(jwo: Pick<JwoForIssue, 'uom'>, heldShort: HeldShortLot[]): string {
  const unit = unitShort(jwo.uom);
  const lots = heldShort.map((s) => `${s.short} ${unit} of ${s.lotCode}`).join(', ');
  const who = [
    ...new Set(heldShort.flatMap((s) => s.held.map((h) => `${h.orderNumber ?? 'no order'} (${h.requirementNumber})`))),
  ];
  return (
    `${lots} is held for ${who.join(', ')}. ` +
    `Take it anyway and their need goes back to be bought again, or pick other lots.`
  );
}

// Named whole thans rarely add up to the job's exact metres (owner, 2026-09-24: ±1%). The one
// definition lives beside the than rows in greige-stock.service — a lot's count uses it too.
export { THAN_PICK_TOLERANCE_PCT };

export interface IssueBlocker {
  code: string;
  message: string;
}

export interface ValidateIssueResult {
  jwo: JwoForIssue;
  /** Resolved greige lots, sorted qty desc, with their stock rows attached. */
  lots: Array<{
    row: Prisma.greige_stockGetPayload<{
      include: {
        greige: { select: { greigeCode: true; greigeName: true } };
        warehouse: { select: typeof LOT_WAREHOUSE_SELECT };
        processor: { select: { name: true } };
        sourceChallan: { select: { challanNumber: true } };
      };
    }>;
    qty: number;
    /**
     * True when the lot is HELD by this job's processor (processorId — delivered straight there, or
     * parked by a Stock-Out): the job draws it where it lies, with no new challan. A legacy lot that
     * only sits in the processor's unit is false — it issues like store stock until converted.
     */
    atProcessor?: boolean;
    location?: LotLocation;
  }>;
  /** Resolved GREIGE LACE lots (fabricType 'LACE'). Empty on every cloth job. */
  laceLots: Array<{
    row: Prisma.lace_stockGetPayload<{
      include: {
        laceMaster: { select: { laceCode: true; laceName: true } };
        warehouse: { select: typeof LOT_WAREHOUSE_SELECT };
      };
    }>;
    qty: number;
    /**
     * In this job's processor's unit — delivered straight there under a Rule 45 challan: the job draws
     * it where it lies, with no new challan (lace has no processorId; its warehouse says where it is).
     */
    heldHere?: boolean;
    location?: LotLocation;
    /** The direct-supply challan the held lace is at the processor under */
    coveringChallanNumber?: string | null;
  }>;
  fabricLotRow: {
    id: string;
    quantityAvailable: Prisma.Decimal;
    warehouseId: string | null;
    receivedDate?: Date | null;
    /** ACTUAL metres the lot gives up: the named pieces' metres, else the order's quantity */
    issueQty: number;
    /** The named rolls / thans (COUNTED), when the issue names them */
    picks?: FabricPiecePick[];
    /** The fold the lot's pieces are counted at — the challan prints the counted figure beside the actual */
    foldLengthCm?: Prisma.Decimal | null;
    /**
     * Ready fabric in this job's processor's unit — delivered straight there under a Rule 45 challan
     * (Phase 4a): the job draws it where it lies, with no new challan.
     */
    heldHere?: boolean;
    /** The direct-supply challan the held fabric is at the processor under */
    coveringChallanNumber?: string | null;
  } | null;
  expectedGreigeId: string | null;
  expectedGreige: { id: string; greigeCode: string; greigeName: string } | null;
  /** Picked lots that other orders hold beyond what is free for this job, and who holds them (D10) */
  heldShort: HeldShortLot[];
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

  if (opts.sentDate && toDateInputValue(opts.sentDate) > toDateInputValue(new Date())) {
    blockers.push({
      code: ISSUE_ERROR_CODES.SENT_DATE_IN_FUTURE,
      message: `The sent date ${formatDate(opts.sentDate)} is after today — record the issue on the day it happens.`,
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
        include: {
          laceMaster: { select: { laceCode: true, laceName: true } },
          warehouse: { select: LOT_WAREHOUSE_SELECT },
        },
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
      // Where the lace is: our store, or a processor's unit (delivered straight there). Lace at ANOTHER
      // processor cannot go on this job; lace at this one is drawn where it lies, under its challan.
      const laceCode = row.laceMaster?.laceCode ?? row.id.slice(0, 8);
      const location = resolveLotLocation({ warehouse: row.warehouse }, jwo.processorId);
      let coveringChallanNumber: string | null = null;
      if (location.category === 'AT_OTHER_PROCESSOR') {
        blockers.push({
          code: ISSUE_ERROR_CODES.LOT_AT_WRONG_PROCESSOR,
          message:
            `Lace lot ${laceCode} is at ${location.holderName ?? 'another processor'}, but ${jwo.jobWorkNumber} is for ` +
            `${jwo.processor?.name ?? 'a different processor'}. Move it to ${jwo.processor?.name ?? 'this processor'} first ` +
            `(Move to another processor), or pick lace in our store or already there.`,
        });
      } else if (location.category === 'AT_THIS_PROCESSOR') {
        const covering = await prisma.challan_items.findFirst({
          where: { laceStockId: row.id, challan: coveringChallanWhere() },
          select: { challan: { select: { challanNumber: true } } },
        });
        coveringChallanNumber = covering?.challan.challanNumber ?? null;
        if (!coveringChallanNumber) {
          blockers.push({
            code: ISSUE_ERROR_CODES.LOT_HELD_WITHOUT_CHALLAN,
            message: `Lace lot ${laceCode} is at ${location.holderName ?? 'the processor'} but no challan covers it — it cannot be allocated undocumented.`,
          });
        }
      }
      const sentOnLace = toDateInputValue(opts.sentDate ?? new Date());
      if (row.receivedDate && sentOnLace < toDateInputValue(row.receivedDate)) {
        blockers.push(
          location.category === 'AT_THIS_PROCESSOR'
            ? {
                code: ISSUE_ERROR_CODES.SENT_BEFORE_ARRIVAL,
                message: `Lace lot ${laceCode} reached ${location.holderName ?? 'the processor'} on ${formatDate(row.receivedDate)} — ${jwo.jobWorkNumber} cannot draw it earlier.`,
              }
            : {
                code: ISSUE_ERROR_CODES.SENT_DATE_BEFORE_RECEIPT,
                message: `Lace lot ${laceCode} was received on ${formatDate(row.receivedDate)} — it cannot have left before that.`,
              }
        );
      }
      laceLots.push({
        row,
        qty: snapToLimit(input.qty, row.quantityAvailable),
        heldHere: location.category === 'AT_THIS_PROCESSOR',
        location,
        coveringChallanNumber,
      });
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
  const namesThans = Object.values(opts.thanPicks ?? {}).some((picks) => picks.length > 0);
  if (greigeLotInputs.length > 0) {
    // Quantities must add up to what the order says leaves the building
    const sum = greigeLotInputs.reduce((acc, l) => addCurrency(acc, l.qty), toCurrency(0));
    if (greigeLotInputs.some((l) => !(l.qty > 0))) {
      blockers.push({
        code: ISSUE_ERROR_CODES.LOT_QTY_MISMATCH,
        message: 'Every lot quantity must be greater than 0.',
      });
    } else if (
      toNumber(sum.minus(toCurrency(jwo.qtySentMeters)).abs()) >
      (namesThans ? (Number(jwo.qtySentMeters) * THAN_PICK_TOLERANCE_PCT) / 100 : 0.01)
    ) {
      blockers.push({
        code: ISSUE_ERROR_CODES.LOT_QTY_MISMATCH,
        message: namesThans
          ? `The picked thans come to ${toNumber(sum)} ${jwo.uom}, more than ${THAN_PICK_TOLERANCE_PCT}% away from the order's ${Number(jwo.qtySentMeters)} ${jwo.uom}.`
          : `Lot quantities total ${toNumber(sum)} but the order issues ${Number(jwo.qtySentMeters)} ${jwo.uom}.`,
      });
    }

    for (const input of greigeLotInputs) {
      const row = await prisma.greige_stock.findUnique({
        where: { id: input.greigeStockLotId },
        include: {
          greige: { select: { greigeCode: true, greigeName: true } },
          warehouse: { select: LOT_WAREHOUSE_SELECT },
          processor: { select: { name: true } },
          sourceChallan: { select: { challanNumber: true } },
        },
      });
      if (!row) {
        blockers.push({
          code: ISSUE_ERROR_CODES.LOT_NOT_FOUND,
          message: `Greige stock lot ${input.greigeStockLotId} not found.`,
        });
        continue;
      }
      // Where the lot IS — its processorId, else the processor whose unit it sits in (lot-location.helper).
      // Cloth at ANOTHER processor cannot go on this job: nothing may say it left from here.
      const location = resolveLotLocation(row, jwo.processorId);
      const lotCode = row.greige?.greigeCode ?? row.id.slice(0, 8);
      if (location.category === 'AT_OTHER_PROCESSOR') {
        blockers.push({
          code: ISSUE_ERROR_CODES.LOT_AT_WRONG_PROCESSOR,
          message:
            `Lot ${lotCode} is at ${location.holderName ?? 'another processor'}` +
            `${row.receivedDate ? ` (since ${formatDate(row.receivedDate)})` : ''}, but ${jwo.jobWorkNumber} is for ` +
            `${jwo.processor?.name ?? 'a different processor'}. Cloth at one processor cannot go on another processor's job — ` +
            `move it to ${jwo.processor?.name ?? 'this processor'} first (Move to another processor, with a challan), or pick a ` +
            `lot in our store or one already there.`,
        });
      }
      const heldHere = location.category === 'AT_THIS_PROCESSOR' && !location.legacyUnitLot;
      if (heldHere && !row.sourceChallanId) {
        blockers.push({
          code: ISSUE_ERROR_CODES.LOT_HELD_WITHOUT_CHALLAN,
          message: `Lot ${lotCode} is held at ${location.holderName ?? 'the processor'} but no challan covers it — it cannot be allocated undocumented.`,
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
      // R6: the processor's own supplied material cannot be issued back to them as ours — except goods it sold
      // us and kept to process (Phase 4g): a DIRECT lot held at this same processor, covered by its challan
      const retainedHere = row.sourceType === 'DIRECT' && heldHere;
      if (row.supplierId != null && row.supplierId === jwo.processorId && !retainedHere) {
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
      // Held by this processor: drawn where it lies, no new challan (issueOneWithinTx)
      lots.push({ row, qty: snapToLimit(input.qty, row.quantityAvailable), atProcessor: heldHere, location });
    }

    // The day the goods leave — or, for cloth already at the processor, the day the job draws it:
    // never before the lot got where it is (IST calendar days, the same as every date on screen).
    const sentOn = toDateInputValue(opts.sentDate ?? new Date());
    for (const { row, location } of lots) {
      if (!row.receivedDate || sentOn >= toDateInputValue(row.receivedDate)) continue;
      const lotCode = row.greige?.greigeCode ?? row.id.slice(0, 8);
      blockers.push(
        location?.category === 'AT_THIS_PROCESSOR'
          ? {
              code: ISSUE_ERROR_CODES.SENT_BEFORE_ARRIVAL,
              message: `Lot ${lotCode} reached ${location.holderName ?? 'the processor'} on ${formatDate(row.receivedDate)} — ${jwo.jobWorkNumber} cannot draw it on ${formatDate(opts.sentDate ?? new Date())}.`,
            }
          : {
              code: ISSUE_ERROR_CODES.SENT_DATE_BEFORE_RECEIPT,
              message: `Lot ${lotCode} was received on ${formatDate(row.receivedDate)} — it cannot have left on ${formatDate(opts.sentDate ?? new Date())}.`,
            }
      );
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

  // Goods held for other orders (po-allocation design §6.7): a warning, not a wall (owner decision D10). The
  // user may take them anyway (takeHeld) — the issue then reopens those orders' need (issueOneWithinTx).
  const heldShort = await heldShortOnLots(prisma, jwo, pickedLotsOf({ lots, laceLots }));
  if (heldShort.length > 0 && !opts.takeHeld) {
    blockers.push({ code: ISSUE_ERROR_CODES.STOCK_HELD_FOR_ORDER, message: heldShortMessage(jwo, heldShort) });
  }

  let fabricLotRow: ValidateIssueResult['fabricLotRow'] = null;
  if (fabricLotId) {
    const row = await prisma.fabric_stock.findUnique({
      where: { id: fabricLotId },
      select: {
        id: true,
        quantityAvailable: true,
        warehouseId: true,
        receivedDate: true,
        foldLengthCm: true,
        warehouse: { select: LOT_WAREHOUSE_SELECT },
      },
    });
    // Named rolls / thans decide what the lot gives up — within ±1% of the order (the greige rule); a pick of a
    // piece that has gone is a blocker, not a crash
    let fabricPick: { actual: number } | null = null;
    if (row && (opts.fabricPicks?.length ?? 0) > 0) {
      try {
        fabricPick = await pickActualQty(prisma, row.id, opts.fabricPicks!);
      } catch (err) {
        if (!(err instanceof BusinessError)) throw err;
        blockers.push({ code: ISSUE_ERROR_CODES.LOT_QTY_MISMATCH, message: err.message });
      }
    }
    const orderQty = Number(jwo.qtySentMeters);
    const fabricTakeQty = fabricPick?.actual ?? orderQty;
    const fabricLocation = row ? resolveLotLocation({ warehouse: row.warehouse }, jwo.processorId) : null;
    // Ready fabric delivered straight to a processor (Phase 2) is DRAWN where it lies by that processor's
    // job (Phase 4a), under the Rule 45 challan that already covers it — never put on a dispatch challan
    // as if it left our store. Another processor's fabric cannot go on this job.
    let coveringChallanNumber: string | null = null;
    if (row && fabricLocation?.category === 'AT_THIS_PROCESSOR') {
      const covering = await prisma.challan_items.findFirst({
        where: { fabricStockId: row.id, challan: coveringChallanWhere() },
        select: { challan: { select: { challanNumber: true } } },
      });
      coveringChallanNumber = covering?.challan.challanNumber ?? null;
    }
    const sentOnFabric = toDateInputValue(opts.sentDate ?? new Date());
    if (!row) {
      blockers.push({ code: ISSUE_ERROR_CODES.LOT_NOT_FOUND, message: 'Fabric stock lot not found.' });
    } else if (fabricLocation?.category === 'AT_OTHER_PROCESSOR') {
      blockers.push({
        code: ISSUE_ERROR_CODES.LOT_AT_WRONG_PROCESSOR,
        message:
          `This fabric lot is at ${fabricLocation.holderName ?? 'another processor'}, not at ${jwo.processor?.name ?? 'this processor'} — ` +
          `move it there first (Move to another processor).`,
      });
    } else if (fabricLocation?.category === 'AT_THIS_PROCESSOR' && !coveringChallanNumber) {
      blockers.push({
        code: ISSUE_ERROR_CODES.LOT_HELD_WITHOUT_CHALLAN,
        message: `This fabric lot is at ${fabricLocation.holderName ?? 'the processor'} but no challan covers it — it cannot be allocated undocumented.`,
      });
    } else if (qtyExceeds(fabricTakeQty, row.quantityAvailable)) {
      blockers.push({
        code: ISSUE_ERROR_CODES.INSUFFICIENT_FABRIC_STOCK,
        message: fabricPick
          ? `The picked rolls / thans come to ${fabricTakeQty} m, more than the ${Number(row.quantityAvailable)} m the lot holds — its list is out of step. Untick some, or Check rolls & thans on the Fabric Stock page.`
          : `Insufficient fabric stock in the selected lot for ${orderQty}m.`,
      });
    } else if (
      fabricPick &&
      qtyExceeds(Math.abs(fabricTakeQty - orderQty), (orderQty * THAN_PICK_TOLERANCE_PCT) / 100)
    ) {
      blockers.push({
        code: ISSUE_ERROR_CODES.LOT_QTY_MISMATCH,
        message: `The picked rolls / thans come to ${fabricTakeQty} ${jwo.uom}, more than ${THAN_PICK_TOLERANCE_PCT}% away from the order's ${orderQty} ${jwo.uom}.`,
      });
    } else if (row.receivedDate && sentOnFabric < toDateInputValue(row.receivedDate)) {
      blockers.push(
        fabricLocation?.category === 'AT_THIS_PROCESSOR'
          ? {
              code: ISSUE_ERROR_CODES.SENT_BEFORE_ARRIVAL,
              message: `This fabric reached ${fabricLocation.holderName ?? 'the processor'} on ${formatDate(row.receivedDate)} — ${jwo.jobWorkNumber} cannot draw it earlier.`,
            }
          : {
              code: ISSUE_ERROR_CODES.SENT_DATE_BEFORE_RECEIPT,
              message: `This fabric lot was received on ${formatDate(row.receivedDate)} — it cannot have left before that.`,
            }
      );
    } else {
      fabricLotRow = {
        id: row.id,
        quantityAvailable: row.quantityAvailable,
        warehouseId: row.warehouseId,
        receivedDate: row.receivedDate,
        heldHere: fabricLocation?.category === 'AT_THIS_PROCESSOR',
        coveringChallanNumber,
        issueQty: fabricTakeQty,
        ...(fabricPick ? { picks: opts.fabricPicks } : {}),
        foldLengthCm: row.foldLengthCm,
      };
    }
  }

  return { jwo, lots, laceLots, fabricLotRow, expectedGreigeId, expectedGreige, heldShort, blockers };
}

/**
 * The error an issue that cannot go ahead throws: a blocker the user must fix (422, the first one), or — when
 * the only thing in the way is goods held for other orders — the 409 the screen answers with "take them anyway".
 */
function issueRefusal(blockers: IssueBlocker[], heldShort: HeldShortLot[], prefix = ''): Error {
  const hard = blockers.find((b) => b.code !== ISSUE_ERROR_CODES.STOCK_HELD_FOR_ORDER);
  if (hard) return new JobWorkOrderError(hard.code, `${prefix}${hard.message}`);
  return heldStockConflict(
    `${prefix}${blockers[0]?.message ?? 'The picked goods are held for another order.'}`,
    heldShort.flatMap((s) => s.held)
  );
}

/** One greige lot a job could draw, placed relative to the job's processor. */
export interface IssueCandidateLot {
  id: string;
  greigeId: string;
  greigeCode: string | null;
  greigeName: string | null;
  greigeWidth: number | null;
  quantityAvailable: number;
  /** The day the lot arrived where it is (our store, or the processor) — ISO date */
  receivedDate: string | null;
  weaverName: string | null;
  location: {
    category: LotLocation['category'];
    /** The processor holding it (null in our store) */
    holderName: string | null;
    warehouseName: string | null;
    /** Held by this job's processor under a challan: the job draws it where it lies, no new challan */
    drawnWhereItLies: boolean;
    /** In the processor's unit but not yet booked there (the Aug-2026 lots): issued on a challan until converted */
    legacyUnitLot: boolean;
    /** The challan that already covers a held lot */
    coveringChallanNumber: string | null;
  };
  /** A held lot that came back from a cancelled job: the job it was first issued for */
  originalJwo?: { id: string; jobWorkNumber: string } | null;
}

export interface IssueCandidates {
  /** At this job's processor — oldest first, the order Auto-fill takes them */
  atProcessor: IssueCandidateLot[];
  /** In our stores — largest first */
  inStore: IssueCandidateLot[];
  /** At OTHER processors — shown, never issuable on this job */
  elsewhere: IssueCandidateLot[];
}

/**
 * THE list of greige lots a job for `processorId` could draw, with where each one is
 * (lot-location.helper). Read by the issue preview and the dispatch screen, so the two can never
 * disagree about what is at the dyer, what is in our store and what is at somebody else.
 */
export async function listIssueCandidates(
  processorId: string | null,
  greigeFilter: Prisma.greige_stockWhereInput
): Promise<IssueCandidates> {
  const rows = await prisma.greige_stock.findMany({
    where: {
      ...greigeFilter,
      status: 'AVAILABLE',
      quantityAvailable: { gt: 0 },
      // A TRANSFER lot with no holder is a leftover of a Stock-Out — never issuable. Explicit OR: a
      // `not` on the nullable sourceType would silently drop the NULL rows.
      OR: [{ sourceType: null }, { sourceType: { not: 'TRANSFER' } }, { processorId: { not: null } }],
    },
    select: {
      id: true,
      greigeId: true,
      greigeWidth: true,
      quantityAvailable: true,
      receivedDate: true,
      processorId: true,
      greige: { select: { greigeCode: true, greigeName: true } },
      warehouse: { select: LOT_WAREHOUSE_SELECT },
      processor: { select: { name: true } },
      sourceChallan: { select: { challanNumber: true } },
      weaver: { select: { name: true } },
      stockDetails: {
        select: {
          issueDetails: {
            select: { jobWorkOrder: { select: { id: true, jobWorkNumber: true } } },
            orderBy: { issuedAt: 'desc' },
            take: 1,
          },
        },
        take: 1,
      },
    },
  });

  const out: IssueCandidates = { atProcessor: [], inStore: [], elsewhere: [] };
  for (const row of rows) {
    const location = resolveLotLocation(row, processorId);
    const drawnWhereItLies = location.category === 'AT_THIS_PROCESSOR' && !location.legacyUnitLot;
    const lot: IssueCandidateLot = {
      id: row.id,
      greigeId: row.greigeId,
      greigeCode: row.greige?.greigeCode ?? null,
      greigeName: row.greige?.greigeName ?? null,
      greigeWidth: row.greigeWidth != null ? Number(row.greigeWidth) : null,
      quantityAvailable: Number(row.quantityAvailable),
      receivedDate: row.receivedDate ? toDateInputValue(row.receivedDate) : null,
      weaverName: row.weaver?.name ?? null,
      location: {
        category: location.category,
        holderName: location.holderName,
        warehouseName: location.warehouseName,
        drawnWhereItLies,
        legacyUnitLot: location.legacyUnitLot,
        coveringChallanNumber: drawnWhereItLies ? (row.sourceChallan?.challanNumber ?? null) : null,
      },
      ...(drawnWhereItLies ? { originalJwo: row.stockDetails?.[0]?.issueDetails?.[0]?.jobWorkOrder ?? null } : {}),
    };
    if (location.category === 'AT_THIS_PROCESSOR') out.atProcessor.push(lot);
    else if (location.category === 'OUR_STORE') out.inStore.push(lot);
    else out.elsewhere.push(lot);
  }
  // Cloth already at the dyer is used first, oldest first (its return clock is already running);
  // store lots largest first (the fewest lots on the vehicle).
  out.atProcessor.sort((a, b) => (a.receivedDate ?? '').localeCompare(b.receivedDate ?? ''));
  out.inStore.sort((a, b) => b.quantityAvailable - a.quantityAvailable);
  out.elsewhere.sort((a, b) => b.quantityAvailable - a.quantityAvailable);
  return out;
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
  // The style named Buyer Style Code first: 'DYEING job work — DJ-EBWW-021-001 · SP27DR27 (EBWW-021)'.
  const styleLabel = styleCodeLabel(jwo.style, null, '');
  const description = `${jwo.processType} job work — ${jwo.jobWorkNumber}${styleLabel ? ` · ${styleLabel}` : ''}`;

  if (laceLots.length > 0) {
    // laceStockId is set for the trail, NOT for deduction: the challan is created DRAFT and
    // flipped to ISSUED here, so the challan page's own lace deduction never runs on it. The
    // consume below is the one and only writer. Lace already at the processor does not travel.
    return laceLots
      .filter((l) => !l.heldHere)
      .map(({ row, qty }) => ({
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
      // ACTUAL metres the lot gives up (the named rolls' when picked); its fold rides along for the counted figure
      quantity: fabricLotRow ? fabricLotRow.issueQty : Number(jwo.qtySentMeters),
      ...(fabricLotRow && hasFold(fabricLotRow.foldLengthCm)
        ? { foldLengthCm: Number(fabricLotRow.foldLengthCm) }
        : {}),
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
  /** Named thans per greige lot id — see IssueJwoOptions.thanPicks */
  thanPicks?: Record<string, IssueDetailInput[]>;
  /** See IssueJwoOptions.takeHeld */
  takeHeld?: boolean;
}

/** The challan shape both callers hand down — whatever createChallan returned. */
type IssuedChallan = {
  id: string;
  challanNumber: string;
  items: Array<{
    id: string;
    greigeStockId: string | null;
    laceStockId: string | null;
    fabricStockId: string | null;
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

  // 3-0. GOODS HELD FOR OTHER ORDERS (D10) — read again here, before any lot is consumed: holds may have moved
  // since validateIssue. Without takeHeld the issue is refused as the dialog would have been; with it the goods
  // are taken at 5a, once the job's own holds are used up.
  const heldNow = await heldShortOnLots(tx, jwo, pickedLotsOf(v));
  if (heldNow.length > 0 && !opts.takeHeld) {
    throw heldStockConflict(
      heldShortMessage(jwo, heldNow),
      heldNow.flatMap((s) => s.held)
    );
  }

  // 3a. CONSUME LACE — guarded, per lot. Store lace is ledgered against the challan it travels on;
  // lace already at this processor (delivered straight there) is DRAWN where it lies, ledgered
  // against the job, under the challan that already covers it.
  for (const { row, qty, heldHere, coveringChallanNumber } of laceLots) {
    if (heldHere) {
      await consumeLaceStock(row.id, qty, opts.userId, tx, {
        referenceType: 'JOB_WORK_ORDER',
        referenceId: jwo.id,
        notes:
          `Allocated at ${jwo.processor?.name ?? 'processor'} — ${jwo.jobWorkNumber}` +
          (coveringChallanNumber ? ` under ${coveringChallanNumber}` : '') +
          ' (no dispatch)',
      });
      continue;
    }
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
      // Held by this processor: DRAWN where it lies — the same guarded consume as a store lot (so the
      // same metres can never be allocated twice), ledgered against the job, no new challan. The lot's
      // own challan (a direct-supply or Stock-Out challan) already covers the goods. Until 2026-09-25
      // this branch skipped the consume, so a held lot stayed AVAILABLE in full after every allocation.
      if (atProcessor) {
        const drawNotes =
          `Allocated at ${jwo.processor?.name ?? 'processor'} — ${jwo.jobWorkNumber}` +
          (row.sourceChallan?.challanNumber ? ` under ${row.sourceChallan.challanNumber}` : '') +
          ' (no dispatch)';
        const drawPicks = opts.thanPicks?.[row.id];
        if (drawPicks && drawPicks.length > 0) {
          await greigeStockService.consumeWithDetails(row.id, drawPicks, opts.userId, tx, {
            referenceType: 'JOB_WORK_ORDER',
            referenceId: jwo.id,
            notes: drawNotes,
            jobWorkOrderId: jwo.id,
            challanId: row.sourceChallanId ?? undefined,
          });
        } else {
          await greigeStockService.consumeGreigeStock(row.id, qty, opts.userId, tx, {
            referenceType: 'JOB_WORK_ORDER',
            referenceId: jwo.id,
            notes: drawNotes,
          });
        }
        continue;
      }
      if (!challan) {
        // This shouldn't happen — main warehouse lots should always have a challan
        throw new JobWorkOrderError('INTERNAL', 'Challan required for main warehouse lot consumption');
      }
      const notes = `Issued to ${jwo.processor?.name ?? 'processor'} — ${jwo.jobWorkNumber} / ${challan.challanNumber}`;
      const picks = opts.thanPicks?.[row.id];
      if (picks && picks.length > 0) {
        // Named thans: each than is marked issued to this job and challan, then the lot moves
        await greigeStockService.consumeWithDetails(row.id, picks, opts.userId, tx, {
          referenceType: 'CHALLAN',
          referenceId: challan.id,
          notes,
          jobWorkOrderId: jwo.id,
          challanId: challan.id,
        });
      } else {
        await greigeStockService.consumeGreigeStock(row.id, qty, opts.userId, tx, {
          referenceType: 'CHALLAN',
          referenceId: challan.id,
          notes,
        });
      }
    }
  }
  if (lots.length === 0 && fabricLotRow) {
    // Phase 5b fabric-roll source (EMBROIDERY) — guarded decrement + ledger + sync. The metres are the named
    // rolls' / thans' (validateIssue took them from pickActualQty), else the order's quantity.
    const qty = fabricLotRow.issueQty;
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
        notes: fabricLotRow.heldHere
          ? `Allocated at ${jwo.processor?.name ?? 'processor'} — ${jwo.jobWorkNumber}` +
            (fabricLotRow.coveringChallanNumber ? ` under ${fabricLotRow.coveringChallanNumber}` : '') +
            ' (no dispatch)'
          : `Issued for ${jwo.processType} — ${jwo.jobWorkNumber}`,
        createdById: opts.userId,
      },
    });
    if (lotRow?.fabricId) {
      const materialId = await ensureMaterialRecord(lotRow.fabricId, 'FABRIC', tx);
      await syncStockLevelQuantity(materialId, -qty, lotRow.warehouseId ?? undefined, 'METER', tx);
    }
    // The lot's rolls / thans go with its metres — to this job, on the challan it travels on (none when drawn
    // where it lies): the ones named, or, with none named, the whole list when the job empties the lot.
    await settleLotOut(tx, {
      lotId: fabricLotRow.id,
      picks: fabricLotRow.picks ?? null,
      userId: opts.userId,
      jobWorkOrderId: jwo.id,
      challanId: challan?.id ?? null,
      challanItemId:
        challan?.items.find((it) => it.fabricStockId === fabricLotRow.id && (it.jobWorkOrderId ?? jwo.id) === jwo.id)
          ?.id ?? null,
    });
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

  // 4. MULTI-LOT — components carry the per-lot trail (reconciliation + PDF prefer them). Also when a
  // single lot gave other than the planned metres (named thans within the ±1% tolerance): the cancel
  // path restores from components, and without one it would credit back the PLANNED quantity.
  const takenTotal = lots.reduce((sum, l) => sum + l.qty, 0);
  if (lots.length > 1 || (lots.length === 1 && !isQtyZero(takenTotal - Number(jwo.qtySentMeters)))) {
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
  // A dyeing/printing job is linked to the PROCESSING requirement, but MRP reserved the greige on
  // the MATERIAL requirement it came from (linkedRequirementId). Matching only the job's own links
  // never found that hold: DJ-ESSKY086LS-004 sent 1,833.25 m on 21-Sep 2026 and the lot kept
  // reading 1,833.25 m reserved against 421.5 m on the shelf — zero free greige.
  //
  // Only what was ISSUED is consumed, and each reservation gives back to the lot IT holds
  // (stock-reservation.helper): until 2026-09-26 this marked every reservation consumed even on a part
  // issue, and decremented the lots the cloth was taken from — stripping another order's hold on them and
  // leaving the real hold (on the reserved lot) in place for ever. Fabric holds were never released.
  const reqIds = jwo.requirementLinks.flatMap((l) =>
    [l.material_requirements.id, l.material_requirements.linkedRequirementId].filter((id): id is string => !!id)
  );
  if (reqIds.length > 0) {
    const fabricIssued = lots.length === 0 && fabricLotRow ? fabricLotRow.issueQty : 0;
    const issuedQty =
      lots.reduce((sum, l) => sum + l.qty, 0) + laceLots.reduce((sum, l) => sum + l.qty, 0) + fabricIssued;
    const issuedLotIds = [
      ...lots.map((l) => l.row.id),
      ...laceLots.map((l) => l.row.id),
      ...(fabricIssued > 0 && fabricLotRow ? [fabricLotRow.id] : []),
    ];
    const consumed = await consumeReservations(tx, reqIds, issuedQty, issueDate, issuedLotIds);
    if (consumed > 0) {
      logInfo(`[Issuance] Consumed ${consumed} of this order's MRP reservations with ${jwo.jobWorkNumber}`);
    }
  }

  // 5a. HELD GOODS TAKEN (the user confirmed, D10) — after step 5, so the job's own holds are spent first and never
  // counted as another's. Each losing order's need reopens to be bought again (takeHeldGoods, audit-logged).
  for (const s of heldNow) {
    const taken = await takeHeldGoods(tx, {
      materialId: s.materialId,
      lotIds: [s.lotId],
      quantity: s.short,
      takerOrderId: jwoOrderId(jwo),
      userId: opts.userId,
      reference: `Job work ${jwo.jobWorkNumber}`,
    });
    if (qtyExceeds(taken.short, 0)) {
      warnings.push(
        `${taken.short} ${unitShort(jwo.uom)} of lot ${s.lotCode} was reserved outside any order's hold — check the lot.`
      );
    }
    for (const f of taken.from) {
      logInfo(
        `[Issuance] ${jwo.jobWorkNumber} took ${f.quantity} held for ${f.orderNumber ?? f.requirementNumber}` +
          (f.balanceRequirementNumber ? ` — reopened as ${f.balanceRequirementNumber}` : ` — now ${f.status}`)
      );
    }
  }

  // 6. (challan → ISSUED is a CHALLAN-level act, so the caller does it once — see below)

  // 7. STATUTORY — set once, kept silently thereafter (R2: immutable once set)
  if (!jwo.statutoryDueDate) {
    // Goods already at the processor (held there, or a legacy lot in its unit) have been "sent" since
    // they arrived: the one-year return period counts from then (Sec 19 explanation), not from today.
    const arrivals = [
      ...lots.filter((l) => l.location?.category === 'AT_THIS_PROCESSOR' && l.row.receivedDate),
      ...laceLots.filter((l) => l.heldHere && l.row.receivedDate),
      ...(lots.length === 0 && fabricLotRow?.heldHere && fabricLotRow.receivedDate
        ? [{ row: { receivedDate: fabricLotRow.receivedDate } }]
        : []),
    ].map((l) => new Date(l.row.receivedDate));
    const clockFrom = arrivals.length > 0 ? new Date(Math.min(...arrivals.map((d) => d.getTime()))) : null;
    await jobWorkOrderService.setStatutoryDueDate(jwoId, issueDate, tx, clockFrom);
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
  // For virtual issuance (every greige lot already at the processor, nothing else sent), use
  // 'VIRTUAL-ALLOCATION' as challan number. `lots.every` alone is true for an EMPTY list, which
  // stamped fabric-roll and garment issues as virtual.
  // Ready fabric already at this processor (Phase 4a) is the job's source only when it has no greige lots
  const fabricHeld = lots.length === 0 && !!fabricLotRow?.heldHere;
  const fabricTravels = lots.length === 0 && !!fabricLotRow && !fabricLotRow.heldHere;
  const isVirtualIssuance =
    (lots.length + laceLots.length > 0 || fabricHeld) &&
    lots.every((l) => l.atProcessor) &&
    laceLots.every((l) => l.heldHere) &&
    !fabricTravels;
  // A job drawn where the cloth lies names the challan(s) that already cover it.
  const coveringChallans = [
    ...new Set(
      [
        ...lots.filter((l) => l.atProcessor).map((l) => l.row.sourceChallan?.challanNumber),
        ...laceLots.filter((l) => l.heldHere).map((l) => l.coveringChallanNumber),
        fabricHeld ? fabricLotRow?.coveringChallanNumber : null,
      ].filter(Boolean)
    ),
  ].join(', ');
  await setJwoStatus(tx, jwoId, 'ISSUED', {
    challanNumber:
      opts.challanNumber ||
      challan?.challanNumber ||
      (isVirtualIssuance ? coveringChallans || 'VIRTUAL-ALLOCATION' : ''),
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
    throw issueRefusal(v.blockers, v.heldShort);
  }
  const { jwo, lots, laceLots, fabricLotRow } = v;
  const issueDate = opts.sentDate ?? new Date();

  // Separate lots: mainWarehouseLots need challan + consumption, processorLots are virtual issuance
  const mainWarehouseLots = lots.filter((l) => !l.atProcessor);
  const processorLots = lots.filter((l) => l.atProcessor);
  const storeLaceLots = laceLots.filter((l) => !l.heldHere);
  const heldLaceLots = laceLots.filter((l) => l.heldHere);
  // Virtual ONLY when there are greige lots and every one of them is already at this processor.
  // Lace always travels (every lace lot is in our own store), and so does a fabric roll or a
  // garment / service job. Until 2026-09-25 the challan was raised only for store greige or lace
  // (4805cf8b, 29-Aug): fabric-roll embroidery and garment jobs went to the job worker with no
  // challan at all. Before that commit every issue raised one — this restores that rule.
  // Ready fabric already at this processor (Phase 4a) is drawn where it lies too; a store fabric roll
  // travels. The fabric roll is the job's source only when it has no greige lots.
  const heldFabric = lots.length === 0 && !!fabricLotRow?.heldHere;
  const storeFabric = lots.length === 0 && !!fabricLotRow && !fabricLotRow.heldHere;
  const isVirtualIssuance =
    processorLots.length + heldLaceLots.length + (heldFabric ? 1 : 0) > 0 &&
    mainWarehouseLots.length === 0 &&
    storeLaceLots.length === 0 &&
    !storeFabric;
  const needsChallan = !isVirtualIssuance;

  const result = await prisma.$transaction(
    async (tx) => {
      // 1. MUTEX — claim the order before anything is created or consumed
      await acquireIssueMutex(tx, jwo, issueDate);

      let challan: IssuedChallan | null = null;

      // 2. CHALLAN — only needed if dispatching from main warehouse
      if (needsChallan) {
        // Build challan items only for main warehouse lots
        const challanV = { ...v, lots: mainWarehouseLots, laceLots: storeLaceLots };
        // The store(s) the goods actually leave — never a made-up "Main Warehouse".
        const origin = await challanOrigin(tx, [
          ...mainWarehouseLots.map((l) => l.row.warehouseId),
          ...storeLaceLots.map((l) => l.row.warehouseId),
          fabricLotRow?.warehouseId,
        ]);
        challan = await createChallan(
          {
            challanType: 'OUTWARD',
            challanDate: issueDate,
            ...origin,
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
        drawnAt:
          processorLots.length + heldLaceLots.length > 0 || heldFabric
            ? (jwo.processor?.name ?? 'the processor')
            : null,
        coveringChallans: [
          ...new Set(
            [
              ...processorLots.map((l) => l.row.sourceChallan?.challanNumber),
              ...heldLaceLots.map((l) => l.coveringChallanNumber),
              heldFabric ? fabricLotRow?.coveringChallanNumber : null,
            ].filter((n): n is string => !!n)
          ),
        ].join(', '),
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
  /** A greige lot may name the thans that leave (COUNTED metres); its qty is then derived from them. */
  lots?: Array<IssueLotInput & { details?: IssueDetailInput[] }>;
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
  /** See IssueJwoOptions.takeHeld — for every order on the truck */
  takeHeld?: boolean;
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
/**
 * A dispatch lot that names thans takes its quantity from them (ACTUAL = picks at the lot's fold
 * length), so the order total is checked against what really leaves. Idempotent.
 */
async function withThanQuantities(input: DispatchInput): Promise<DispatchInput> {
  const orders = await Promise.all(
    input.orders.map(async (order) => ({
      ...order,
      lots: order.lots
        ? await Promise.all(
            order.lots.map(async (l) =>
              l.greigeStockLotId && l.details && l.details.length > 0
                ? { ...l, qty: (await greigeStockService.thanPickActualQty(l.greigeStockLotId, l.details)).actual }
                : l
            )
          )
        : order.lots,
    }))
  );
  return { ...input, orders };
}

/** The named thans an order carries, per greige lot id. */
function thanPicksOf(order: DispatchOrderInput): Record<string, IssueDetailInput[]> {
  const picks: Record<string, IssueDetailInput[]> = {};
  for (const l of order.lots ?? []) {
    if (l.greigeStockLotId && l.details && l.details.length > 0) picks[l.greigeStockLotId] = l.details;
  }
  return picks;
}

export async function validateDispatch(rawInput: DispatchInput): Promise<ValidateDispatchResult> {
  const input = await withThanQuantities(rawInput);
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
      thanPicks: thanPicksOf(order),
      greigeStockLotId: order.greigeStockLotId,
      fabricStockLotId: order.fabricStockLotId,
      acknowledgeWidthMismatch: input.acknowledgeWidthMismatch,
      sentDate: input.sentDate,
      takeHeld: input.takeHeld,
    });
    validations.push(v);
    // Cloth already at the processor does not travel on this truck: its job is allocated where it
    // lies, from the job's own page (Phase 2). That includes a lot that only sits in the processor's
    // unit, not yet booked there — it is already there, so no vehicle carries it.
    const heldLace = v.laceLots.find((l) => l.location?.category === 'AT_THIS_PROCESSOR');
    if (heldLace) {
      v.blockers.push({
        code: ISSUE_ERROR_CODES.LOT_NOT_ON_TRUCK,
        message:
          `Lace lot ${heldLace.row.laceMaster?.laceCode ?? heldLace.row.id.slice(0, 8)} is already at ` +
          `${heldLace.location?.holderName ?? 'the processor'} — it does not go on this truck. Issue ${v.jwo.jobWorkNumber} from its own page.`,
      });
    }
    if (v.lots.length === 0 && v.fabricLotRow?.heldHere) {
      v.blockers.push({
        code: ISSUE_ERROR_CODES.LOT_NOT_ON_TRUCK,
        message: `The fabric lot is already at ${v.jwo.processor?.name ?? 'the processor'} — it does not go on this truck. Issue ${v.jwo.jobWorkNumber} from its own page.`,
      });
    }
    const held = v.lots.filter((l) => l.location?.category === 'AT_THIS_PROCESSOR');
    if (held.length > 0) {
      v.blockers.push({
        code: ISSUE_ERROR_CODES.LOT_NOT_ON_TRUCK,
        message:
          `Lot ${held[0].row.greige?.greigeCode ?? held[0].row.id.slice(0, 8)} is already at ` +
          `${held[0].location?.holderName ?? 'the processor'} — it does not go on this truck. Issue ${v.jwo.jobWorkNumber} ` +
          `from its own page.`,
      });
    }
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
      // Two orders may share a lot when each names its own thans and none is on both — the thans
      // say exactly which cloth goes to which job. Without thans a shared lot stays refused.
      const ownerOrder = firstOwner && input.orders.find((o) => o.jwoId === firstOwner.jwoId);
      const thisOrder = input.orders.find((o) => o.jwoId === v.jwo.id);
      const ownerPicks = ownerOrder ? thanPicksOf(ownerOrder)[row.id] : undefined;
      const thisPicks = thisOrder ? thanPicksOf(thisOrder)[row.id] : undefined;
      const disjointThans =
        !!ownerPicks?.length &&
        !!thisPicks?.length &&
        !thisPicks.some((p) => ownerPicks.some((q) => q.greigeStockDetailId === p.greigeStockDetailId));
      if (firstOwner && firstOwner.jwoId !== v.jwo.id && !disjointThans) {
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
export async function dispatchJobWorkOrders(rawInput: DispatchInput): Promise<DispatchResult> {
  const input = await withThanQuantities(rawInput);
  const v = await validateDispatch(input);
  if (v.dispatchBlockers.length > 0) {
    throw new JobWorkOrderError(v.dispatchBlockers[0].code, v.dispatchBlockers[0].message);
  }
  if (v.orderBlockers.length > 0) {
    // A blocker to fix on any order comes first; goods held for other orders, alone, are the "take them anyway" 409
    const first =
      v.orderBlockers.find((o) => o.blockers.some((b) => b.code !== ISSUE_ERROR_CODES.STOCK_HELD_FOR_ORDER)) ??
      v.orderBlockers[0];
    throw issueRefusal(
      first.blockers,
      v.validations.flatMap((one) => one.heldShort),
      `${first.jobWorkNumber}: `
    );
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
      // The store(s) the truck is loaded from — every order's lots, never "Main Warehouse".
      const origin = await challanOrigin(
        tx,
        v.validations.flatMap((one) => [
          ...one.lots.filter((l) => !l.atProcessor).map((l) => l.row.warehouseId),
          ...one.laceLots.filter((l) => !l.heldHere).map((l) => l.row.warehouseId),
          one.fabricLotRow?.warehouseId,
        ])
      );
      const challan = await createChallan(
        {
          challanType: 'OUTWARD',
          challanDate: issueDate,
          ...origin,
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
          {
            userId: input.userId,
            challanNumber: input.challanNumber,
            vehicleNumber: input.vehicleNumber,
            thanPicks: thanPicksOf(input.orders.find((o) => o.jwoId === one.jwo.id) ?? { jwoId: one.jwo.id }),
            takeHeld: input.takeHeld,
          },
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

/** The requirements whose holds a job's issue used: its own links, and the MATERIAL rows they came from */
function jobRequirementIds(
  links: Array<{ material_requirements: { id: string; linkedRequirementId: string | null } }>
): string[] {
  return [
    ...new Set(
      links.flatMap((l) =>
        [l.material_requirements.id, l.material_requirements.linkedRequirementId].filter((id): id is string => !!id)
      )
    ),
  ];
}

/** The audit event a cancel notes its job's requirements under (read back by unissueForCancel) */
const JOB_CANCEL_REQUIREMENTS_EVENT = 'JOB_WORK_CANCELLED_REQUIREMENTS';

/**
 * Cancelling a job deletes its requirement links, but the cloth — and with it the order's hold — comes back only at
 * the disposition (unissueForCancel), a later request. Call this in the cancel's transaction BEFORE the links are
 * deleted: it notes which requirements the issue took holds from, so the disposition can give them back (C9).
 */
export async function noteCancelledJobRequirements(tx: Tx, jwoId: string, userId: string): Promise<string[]> {
  const links = await tx.requirement_jwo_links.findMany({
    where: { jobWorkOrderId: jwoId },
    select: { material_requirements: { select: { id: true, linkedRequirementId: true } } },
  });
  const requirementIds = jobRequirementIds(links);
  if (requirementIds.length === 0) return [];
  await tx.audit_logs.create({
    data: {
      id: randomUUID(),
      userId,
      action: 'UPDATE',
      entityType: 'job_work_order',
      entityId: jwoId,
      newValues: { event: JOB_CANCEL_REQUIREMENTS_EVENT, requirementIds },
    },
  });
  return requirementIds;
}

/** The job's requirements: its links while it has them, else what its cancel noted */
async function cancelledJobRequirementIds(tx: Tx, jwoId: string): Promise<string[]> {
  const links = await tx.requirement_jwo_links.findMany({
    where: { jobWorkOrderId: jwoId },
    select: { material_requirements: { select: { id: true, linkedRequirementId: true } } },
  });
  if (links.length > 0) return jobRequirementIds(links);
  const notes = await tx.audit_logs.findMany({
    where: { entityType: 'job_work_order', entityId: jwoId },
    orderBy: { timestamp: 'desc' },
    select: { newValues: true },
  });
  for (const note of notes) {
    const values = note.newValues as { event?: unknown; requirementIds?: unknown } | null;
    if (values?.event === JOB_CANCEL_REQUIREMENTS_EVENT && Array.isArray(values.requirementIds)) {
      return values.requirementIds.filter((id): id is string => typeof id === 'string');
    }
  }
  return [];
}

/**
 * Reverse an issue as part of JWO cancellation — runs inside the CALLER's transaction.
 * Restores every consumed lot (guarded — never drives quantityConsumed negative),
 * writes RETURN ledger rows, syncs stock_levels (the piece the old cancel path missed),
 * and cancels the outward challan so ITC-04 stops declaring the movement.
 *
 * The greige / lace that comes back is held for its order again (C9): the issue consumed the order's holds, and
 * without this the returned cloth came back free for any order to take. Goods the issue took from ANOTHER order's
 * hold (takeHeld) come back free — that order's need was already reopened to be bought again.
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

  // Named thans go back to the godown list too — before 2026-09-24 a cancelled job left its thans
  // marked issued while the lot quantity came back, so the than list and the lot disagreed.
  await greigeStockService.restoreThansForJob(jwo.id, tx);

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
      select: {
        greigeId: true,
        warehouseId: true,
        quantityAvailable: true,
        purchaseCost: true,
        weightedAvgCost: true,
        sourceType: true,
      },
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
    // Fabric-roll source (EMBROIDERY) — credit back, ledger, sync (moved from the controller). Exactly what the
    // issue took off the lot (its ledger row): with named rolls / thans that is their metres, which may differ
    // from the order's quantity by up to 1%.
    const sentRow = await tx.fabric_stock_transaction.findFirst({
      where: {
        stockId: jwo.fabricStockLotId,
        transactionType: 'EMBROIDERY_SEND_OUT',
        referenceType: 'JOB_WORK_ORDER',
        referenceId: jwo.id,
      },
      select: { quantity: true },
      orderBy: { transactionDate: 'desc' },
    });
    const fabricQty = sentRow ? Number(sentRow.quantity) : totalQty;
    await tx.fabric_stock.update({
      where: { id: jwo.fabricStockLotId },
      data: {
        quantityAvailable: { increment: fabricQty },
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
        quantity: new Prisma.Decimal(fabricQty),
        referenceType: 'JOB_WORK_ORDER',
        referenceId: jwo.id,
        costPerUnit: new Prisma.Decimal(wac),
        weightedAvgCost: new Prisma.Decimal(wac),
        totalValue: new Prisma.Decimal(toNumber(roundToCent(multiplyCurrency(fabricQty, wac)))),
        balanceAfter: new Prisma.Decimal(balanceAfter),
        valueAfter: new Prisma.Decimal(toNumber(roundToCent(multiplyCurrency(balanceAfter, wac)))),
        notes: `Job work cancelled — ${jwo.jobWorkNumber}`,
        createdById: userId,
      },
    });
    if (lotRow?.fabricId) {
      const materialId = await ensureMaterialRecord(lotRow.fabricId, 'FABRIC', tx);
      await syncStockLevelQuantity(materialId, fabricQty, lotRow.warehouseId ?? undefined, 'METER', tx);
    }
    // The rolls / thans the job took come back as they went (the rows are stamped, never deleted)
    await settleLotBack(tx, { lotId: jwo.fabricStockLotId, scope: { jobWorkOrderId: jwo.id }, mode: 'ALL' });
  }

  // C9: the greige / lace is back on its lots, so the order's hold is too — rows on the returned lots first. Only a
  // requirement that may still hold goods gets it (not a cancelled one, nor one of a finished or cancelled order).
  const returnedQty =
    laceComponents.reduce((sum, c) => sum + Number(c.qtySent), 0) + greigeLots.reduce((sum, l) => sum + l.qty, 0);
  if (qtyExceeds(returnedQty, 0)) {
    const requirementIds = await cancelledJobRequirementIds(tx, jwo.id);
    const restored = await unconsumeReservations(tx, requirementIds, returnedQty, [
      ...laceComponents.map((c) => c.laceStockId as string),
      ...greigeLots.map((l) => l.id),
    ]);
    if (restored > 0) logInfo(`[Issuance] ${jwo.jobWorkNumber} cancelled — ${restored} held for its order again`);
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
  /** See IssueJwoOptions.takeHeld */
  takeHeld?: boolean;
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
  // Than rows carry the COUNTED tag figure; the lot and the job are ACTUAL metres, so each pick is
  // converted once at the lot's fold length (thanPickActualQty). Than selection is optional per lot
  // (owner, 2026-09-24): a lot without picks goes by its plain quantity.
  //
  // This used to re-implement the issue (its own mutex, challan and consume), so it never learned
  // what issueJobWorkOrder knows — a lot already at the processor is a virtual issue, no challan.
  // It now hands the named thans to the one issue path.
  const thanPicks: Record<string, IssueDetailInput[]> = {};
  const lots: IssueLotInput[] = await Promise.all(
    opts.lotsWithDetails.map(async (l) => {
      if (l.details && l.details.length > 0) {
        thanPicks[l.greigeStockLotId] = l.details;
        const { actual } = await greigeStockService.thanPickActualQty(l.greigeStockLotId, l.details);
        return { greigeStockLotId: l.greigeStockLotId, qty: actual };
      }
      return { greigeStockLotId: l.greigeStockLotId, qty: l.qty ?? 0 };
    })
  );

  const result = await issueJobWorkOrder(jwoId, {
    userId: opts.userId,
    sentDate: opts.sentDate,
    lots,
    challanNumber: opts.challanNumber,
    vehicleNumber: opts.vehicleNumber,
    finishedFabricId: opts.finishedFabricId,
    acknowledgeWidthMismatch: opts.acknowledgeWidthMismatch,
    thanPicks,
    takeHeld: opts.takeHeld,
  });
  logInfo(
    `[Issuance] ${Object.keys(thanPicks).length} lot(s) issued than by than (` +
      `${Object.values(thanPicks).reduce((n, d) => n + d.length, 0)} thans) — challan ${result.challanNumber}`
  );
  return result;
}

/**
 * "Send to Mill" (Dyeing / Printing / Processing lists): one lot, the whole job. With named pieces it
 * takes the Issue dialog's own path (fold conversion, ±1%, a lot already at the mill drawn where it lies);
 * without, it is the plain quantity issue it always was.
 */
export async function issueForSendToMill(
  jwoId: string,
  opts: Omit<IssueJwoOptions, 'lots' | 'thanPicks'> & { details?: IssueDetailInput[] }
): Promise<IssueJwoResult> {
  const { details, ...plain } = opts;
  if (!details || details.length === 0) return issueJobWorkOrder(jwoId, plain);
  const lotId =
    plain.greigeStockLotId ??
    (await prisma.job_work_orders.findUnique({ where: { id: jwoId }, select: { greigeStockLotId: true } }))
      ?.greigeStockLotId;
  if (!lotId) {
    throw new JobWorkOrderError(ISSUE_ERROR_CODES.NO_GREIGE_LOT, 'Pick the greige lot the pieces come from.');
  }
  return issueJobWorkOrderWithDetails(jwoId, {
    userId: plain.userId,
    sentDate: plain.sentDate,
    lotsWithDetails: [{ greigeStockLotId: lotId, details }],
    challanNumber: plain.challanNumber,
    vehicleNumber: plain.vehicleNumber,
    finishedFabricId: plain.finishedFabricId,
    acknowledgeWidthMismatch: plain.acknowledgeWidthMismatch,
    takeHeld: plain.takeHeld,
  });
}

// ============================================================================
// Record thans on a job that was issued by quantity (2026-09-24)
// ============================================================================
// Than selection is optional (owner decision), so a job can leave by plain quantity: the lot's
// metres move but its thans all still read AVAILABLE. These let the operator name, afterwards, which
// thans went — marking them issued to the job and its challan without moving lot stock again.

/** Statuses in which a job has already taken its cloth out of the lot. */
const ISSUED_JOB_STATUSES = [
  'ISSUED',
  'IN_TRANSIT',
  'AT_PROCESSOR',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'QUALITY_CHECKED',
  'STOCK_UPDATED',
  'CLOSED',
] as const;

export interface ThanRecordLotStatus {
  greigeStockLotId: string;
  greigeCode: string | null;
  foldLengthCm: number | null;
  /** ACTUAL metres the job took from this lot */
  takenActual: number;
  /** Thans already named against this job, COUNTED and converted to ACTUAL */
  recordedCounted: number;
  recordedActual: number;
  /**
   * Did the lot list pieces WHEN THE JOB TOOK ITS CLOTH. Pieces counted later ("Record bales & thans")
   * were on the rack after the job left — they can never be the ones it took, so they do not count.
   */
  lotHasThans: boolean;
  /** When the job took its cloth from this lot (its CONSUMPTION on the lot's ledger) */
  takenAt: Date;
  /** THAN / ROLL / MIXED among the pieces listed by then — wording only */
  pieceKind: GreigePieceKind;
}

/**
 * When a job took its cloth from a lot: its first CONSUMPTION on the lot's ledger — the outward challan
 * for a store lot, the job itself for cloth drawn where it lies. Falls back to the challan's / job's
 * creation, both no later than the real take, so a piece listed afterwards is never let in.
 */
async function jobTookLotAt(
  client: Tx | typeof prisma,
  jwo: { id: string; outwardChallanId: string | null; createdAt: Date },
  lotId: string
): Promise<Date> {
  const took = await client.greige_stock_transaction.findFirst({
    where: {
      stockId: lotId,
      transactionType: 'CONSUMPTION',
      OR: [
        { referenceType: 'JOB_WORK_ORDER', referenceId: jwo.id },
        ...(jwo.outwardChallanId ? [{ referenceType: 'CHALLAN' as const, referenceId: jwo.outwardChallanId }] : []),
      ],
    },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  });
  if (took) return took.createdAt;
  const challan = jwo.outwardChallanId
    ? await client.challans.findUnique({ where: { id: jwo.outwardChallanId }, select: { createdAt: true } })
    : null;
  return challan?.createdAt ?? jwo.createdAt;
}

/** The greige lots a job took, and how much of each is already named by than. */
export async function getThanRecordStatus(
  jwoId: string,
  client: Tx | typeof prisma = prisma
): Promise<{ jobWorkNumber: string; jwoStatus: string; lots: ThanRecordLotStatus[] }> {
  const jwo = await client.job_work_orders.findUnique({
    where: { id: jwoId },
    select: {
      id: true,
      jobWorkNumber: true,
      jwoStatus: true,
      qtySentMeters: true,
      greigeStockLotId: true,
      outwardChallanId: true,
      createdAt: true,
    },
  });
  if (!jwo) throw new JobWorkOrderError('NOT_FOUND', `Job work order ${jwoId} not found`);

  // What the job took: same source as the cancel path — per-lot components, else the header lot
  const components = await client.job_work_order_components.findMany({
    where: { jobWorkOrderId: jwo.id, materialType: 'GREIGE', greigeStockId: { not: null } },
    select: { greigeStockId: true, qtySent: true },
  });
  const taken =
    components.length > 0
      ? components.map((c) => ({ id: c.greigeStockId as string, qty: Number(c.qtySent) }))
      : jwo.greigeStockLotId
        ? [{ id: jwo.greigeStockLotId, qty: Number(jwo.qtySentMeters) }]
        : [];

  const lots: ThanRecordLotStatus[] = [];
  for (const t of taken) {
    const lot = await client.greige_stock.findUnique({
      where: { id: t.id },
      select: { foldLengthCm: true, greige: { select: { greigeCode: true } } },
    });
    const takenAt = await jobTookLotAt(client, jwo, t.id);
    // Only pieces listed by the time the job took its cloth can be the ones it took
    const listedThen = await client.greige_stock_details.groupBy({
      by: ['detailType'],
      where: { greigeStockId: t.id, createdAt: { lte: takenAt } },
      _count: { _all: true },
    });
    const recorded = await client.greige_issue_details.aggregate({
      where: { jobWorkOrderId: jwo.id, greigeStockDetail: { greigeStockId: t.id } },
      _sum: { metersIssued: true },
    });
    const recordedCounted = Number(recorded._sum.metersIssued ?? 0);
    lots.push({
      greigeStockLotId: t.id,
      greigeCode: lot?.greige?.greigeCode ?? null,
      foldLengthCm: lot?.foldLengthCm != null ? Number(lot.foldLengthCm) : null,
      takenActual: t.qty,
      recordedCounted,
      recordedActual: foldActual(recordedCounted, lot?.foldLengthCm ?? null).toNumber(),
      lotHasThans: listedThen.length > 0,
      takenAt,
      pieceKind: pieceKindOf(listedThen.map((g) => g.detailType)),
    });
  }
  return { jobWorkNumber: jwo.jobWorkNumber, jwoStatus: jwo.jwoStatus, lots };
}

/**
 * Name the thans that left on an already-issued job. Each than is marked issued (remaining metres
 * down, status, a greige_issue_details row naming the job and its outward challan); the lot's
 * quantity is NOT touched — it moved when the job was issued.
 */
export async function recordThansForJob(
  jwoId: string,
  lots: Array<{ greigeStockLotId: string; details: IssueDetailInput[] }>,
  userId: string
): Promise<{ jobWorkNumber: string; lots: ThanRecordLotStatus[] }> {
  return prisma.$transaction((tx) => recordThansWithinTx(tx, jwoId, lots, userId), {
    timeout: 15000,
    maxWait: 5000,
  });
}

/**
 * Several jobs that went to one processor together, recorded in ONE transaction — the thans were
 * fitted on their total ("Best fit for all jobs"), so recording half of them would leave the godown
 * list wrong. A than named on two jobs is refused by markThansIssued (it is no longer available).
 */
export async function recordThansForJobs(
  jobs: Array<{ jwoId: string; lots: Array<{ greigeStockLotId: string; details: IssueDetailInput[] }> }>,
  userId: string
): Promise<Array<{ jobWorkNumber: string; lots: ThanRecordLotStatus[] }>> {
  return prisma.$transaction(
    async (tx) => {
      const out: Array<{ jobWorkNumber: string; lots: ThanRecordLotStatus[] }> = [];
      for (const job of jobs) out.push(await recordThansWithinTx(tx, job.jwoId, job.lots, userId));
      return out;
    },
    { timeout: 30000, maxWait: 5000 }
  );
}

/**
 * Other issued jobs that went to the SAME processor on the SAME day (IST) and took from one of this
 * job's lots with thans still unnamed — the jobs "Best fit for all jobs" fits together with this one.
 */
export async function getSameTripThanSiblings(
  jwoId: string
): Promise<Array<{ jwoId: string; jobWorkNumber: string; lots: ThanRecordLotStatus[] }>> {
  const jwo = await prisma.job_work_orders.findUnique({
    where: { id: jwoId },
    select: { processorId: true, sentDate: true },
  });
  if (!jwo?.sentDate) return [];
  const day = toDateInputValue(jwo.sentDate);
  const from = new Date(`${day}T00:00:00+05:30`);
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  const own = await getThanRecordStatus(jwoId);
  const ownLots = new Set(own.lots.filter((l) => l.lotHasThans).map((l) => l.greigeStockLotId));
  if (ownLots.size === 0) return [];

  const candidates = await prisma.job_work_orders.findMany({
    where: {
      id: { not: jwoId },
      processorId: jwo.processorId,
      fabricType: 'GREIGE',
      jwoStatus: { in: [...ISSUED_JOB_STATUSES] },
      sentDate: { gte: from, lt: to },
    },
    select: { id: true },
    orderBy: { jobWorkNumber: 'asc' },
  });
  const siblings: Array<{ jwoId: string; jobWorkNumber: string; lots: ThanRecordLotStatus[] }> = [];
  for (const c of candidates) {
    const status = await getThanRecordStatus(c.id);
    const pending = status.lots.filter(
      (l) => ownLots.has(l.greigeStockLotId) && l.lotHasThans && qtyExceeds(l.takenActual, l.recordedActual)
    );
    if (pending.length > 0) siblings.push({ jwoId: c.id, jobWorkNumber: status.jobWorkNumber, lots: pending });
  }
  return siblings;
}

async function recordThansWithinTx(
  tx: Tx,
  jwoId: string,
  lots: Array<{ greigeStockLotId: string; details: IssueDetailInput[] }>,
  userId: string
): Promise<{ jobWorkNumber: string; lots: ThanRecordLotStatus[] }> {
  const status = await getThanRecordStatus(jwoId, tx);
  if (!(ISSUED_JOB_STATUSES as readonly string[]).includes(status.jwoStatus)) {
    throw new JobWorkOrderError(
      'JOB_NOT_ISSUED',
      `${status.jobWorkNumber} has not been issued yet — pick the thans on the Issue dialog instead.`
    );
  }
  const jwo = await tx.job_work_orders.findUnique({
    where: { id: jwoId },
    select: { outwardChallanId: true },
  });

  for (const lot of lots) {
    const s = status.lots.find((l) => l.greigeStockLotId === lot.greigeStockLotId);
    if (!s) {
      throw new JobWorkOrderError(
        'THAN_RECORD_INVALID',
        `${status.jobWorkNumber} did not take cloth from that lot — only its own lots can be recorded.`
      );
    }
    // Pieces counted after the job left were still on the rack — they cannot be what it took
    if (!s.lotHasThans) {
      throw new JobWorkOrderError(
        'THAN_RECORD_INVALID',
        `${s.greigeCode ?? 'This lot'} had no bale / than / roll list when ${status.jobWorkNumber} took its cloth — ` +
          `there is nothing to record against this job.`
      );
    }
    const late = await tx.greige_stock_details.findFirst({
      where: { id: { in: lot.details.map((d) => d.greigeStockDetailId) }, createdAt: { gt: s.takenAt } },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true, detailType: true, baleNumber: true, baleNo: true, thanNo: true, sequenceNo: true },
    });
    if (late) {
      const piece =
        late.detailType === 'ROLL'
          ? `Roll ${late.thanNo ?? late.sequenceNo}`
          : late.baleNumber != null
            ? `Bale ${late.baleNo ?? late.baleNumber} · than ${late.thanNo ?? late.sequenceNo}`
            : `Than ${late.thanNo ?? late.sequenceNo}`;
      throw new JobWorkOrderError(
        'THAN_RECORD_INVALID',
        `${piece} was put on ${s.greigeCode ?? 'the lot'}'s list on ${formatDateTime(late.createdAt)}, after ` +
          `${status.jobWorkNumber} took its cloth (${formatDateTime(s.takenAt)}) — it was still on the rack, so it ` +
          `cannot have gone on this job.`
      );
    }
    const pickedCounted = lot.details.reduce((sum, d) => sum + d.metersToIssue, 0);
    const afterActual = foldActual(s.recordedCounted + pickedCounted, s.foldLengthCm).toNumber();
    if (qtyExceeds(afterActual, (s.takenActual * (100 + THAN_PICK_TOLERANCE_PCT)) / 100)) {
      throw new JobWorkOrderError(
        'THAN_RECORD_INVALID',
        `These thans come to ${afterActual} m actual with what is already recorded, but ` +
          `${status.jobWorkNumber} took only ${s.takenActual} m from ${s.greigeCode ?? 'this lot'}.`
      );
    }
    try {
      await greigeStockService.markThansIssued(lot.greigeStockLotId, lot.details, userId, tx, {
        jobWorkOrderId: jwoId,
        challanId: jwo?.outwardChallanId ?? undefined,
      });
    } catch (error) {
      // A than already sent (or named twice across jobs in one batch) — the user's to fix, not a 500
      throw new JobWorkOrderError(
        'THAN_RECORD_INVALID',
        `${status.jobWorkNumber}: ${error instanceof Error ? error.message : 'a than could not be recorded'}`
      );
    }
  }

  const after = await getThanRecordStatus(jwoId, tx);
  logInfo(`[Issuance] Recorded ${lots.reduce((n, l) => n + l.details.length, 0)} than(s) on ${after.jobWorkNumber}`);
  return { jobWorkNumber: after.jobWorkNumber, lots: after.lots };
}

// ============================================================================
// Record rolls / thans on a FABRIC-lot job issued by quantity (2026-09-28)
// ============================================================================
// A job that draws a finished-fabric lot (embroidery on a dyed roll) may leave by plain quantity: the lot's
// metres move but its rolls / thans still read on the rack, so the list goes out of step. These name,
// afterwards, which pieces went — marking them issued to the job and its challan without moving the lot again.

export interface FabricPieceRecordStatus {
  jobWorkNumber: string;
  jwoStatus: string;
  /** Null when the job takes no fabric lot, or has not taken its cloth yet */
  lot: {
    fabricStockLotId: string;
    lotLabel: string;
    foldLengthCm: number | null;
    /** ACTUAL metres the job took from the lot */
    takenActual: number;
    /** Pieces already named against the job, COUNTED and ACTUAL */
    recordedCounted: number;
    recordedActual: number;
    /** Did the lot list pieces WHEN THE JOB TOOK ITS CLOTH — pieces counted later were still on the rack */
    lotHasPieces: boolean;
    /** Of those, how many still read on the rack — 0 = nothing left to name (the job took them all by name) */
    piecesLeft: number;
    /** When the job took its cloth: its ledger row on the lot, else its challan, else its send date */
    takenAt: Date;
    pieceKind: GreigePieceKind;
  } | null;
}

export async function getFabricPieceRecordStatus(
  jwoId: string,
  client: Tx | typeof prisma = prisma
): Promise<FabricPieceRecordStatus> {
  const jwo = await client.job_work_orders.findUnique({
    where: { id: jwoId },
    select: {
      jobWorkNumber: true,
      jwoStatus: true,
      fabricStockLotId: true,
      qtySentMeters: true,
      sentDate: true,
      createdAt: true,
      outwardChallan: { select: { createdAt: true } },
    },
  });
  if (!jwo) throw new JobWorkOrderError('NOT_FOUND', `Job work order ${jwoId} not found`);
  const base = { jobWorkNumber: jwo.jobWorkNumber, jwoStatus: jwo.jwoStatus };
  if (!jwo.fabricStockLotId || !(ISSUED_JOB_STATUSES as readonly string[]).includes(jwo.jwoStatus)) {
    return { ...base, lot: null };
  }
  const lotId = jwo.fabricStockLotId;
  const [lot, sent, listedThen, recorded] = await Promise.all([
    client.fabric_stock.findUnique({
      where: { id: lotId },
      select: {
        id: true,
        foldLengthCm: true,
        fabricMaster: { select: { fabricCode: true } },
        grnItem: { select: { goods_receiving_notes: { select: { grnNumber: true } } } },
        processResultOf: { select: { batchNumber: true, processType: true } },
      },
    }),
    client.fabric_stock_transaction.findFirst({
      where: {
        stockId: lotId,
        transactionType: 'EMBROIDERY_SEND_OUT',
        referenceType: 'JOB_WORK_ORDER',
        referenceId: jwoId,
      },
      orderBy: { transactionDate: 'asc' },
      select: { transactionDate: true, quantity: true },
    }),
    // takenAt is only known after `sent` — listed-by is filtered below
    client.fabric_stock_details.findMany({
      where: { fabricStockId: lotId },
      select: { createdAt: true, detailType: true, metersRemaining: true },
    }),
    client.fabric_issue_details.aggregate({
      where: { jobWorkOrderId: jwoId, piece: { fabricStockId: lotId } },
      _sum: { metersIssued: true },
    }),
  ]);
  if (!lot) return { ...base, lot: null };
  const takenAt = sent?.transactionDate ?? jwo.outwardChallan?.createdAt ?? jwo.sentDate ?? jwo.createdAt;
  const piecesThen = listedThen.filter((p) => p.createdAt <= takenAt);
  const recordedCounted = Number(recorded._sum.metersIssued ?? 0);
  return {
    ...base,
    lot: {
      fabricStockLotId: lotId,
      lotLabel: fabricLotLabel(lot),
      foldLengthCm: lot.foldLengthCm != null ? Number(lot.foldLengthCm) : null,
      takenActual: sent ? Number(sent.quantity) : Number(jwo.qtySentMeters),
      recordedCounted,
      recordedActual: foldActual(recordedCounted, lot.foldLengthCm).toNumber(),
      lotHasPieces: piecesThen.length > 0,
      piecesLeft: piecesThen.filter((p) => !isQtyZero(Number(p.metersRemaining))).length,
      takenAt,
      pieceKind: pieceKindOf(piecesThen.map((p) => p.detailType)),
    },
  };
}

/**
 * Name the rolls / thans that left on a fabric-lot job issued by quantity. Marks them issued to the job and
 * its outward challan (dated when the job took its cloth); the lot's metres are NOT moved again. Refused for a
 * piece listed after the job took its cloth, or when the pieces named would come to more than it took (+1%).
 */
export async function recordFabricPiecesForJob(
  jwoId: string,
  details: FabricPiecePick[],
  userId: string
): Promise<FabricPieceRecordStatus> {
  return prisma.$transaction(
    async (tx) => {
      const status = await getFabricPieceRecordStatus(jwoId, tx);
      const s = status.lot;
      if (!s) {
        throw new JobWorkOrderError(
          'JOB_NOT_ISSUED',
          `${status.jobWorkNumber} has not taken cloth from a fabric lot yet — pick the rolls on the Issue dialog instead.`
        );
      }
      if (!s.lotHasPieces) {
        throw new JobWorkOrderError(
          'THAN_RECORD_INVALID',
          `${s.lotLabel} had no roll / than list when ${status.jobWorkNumber} took its cloth — there is nothing to record against this job.`
        );
      }
      const late = await tx.fabric_stock_details.findFirst({
        where: { id: { in: details.map((d) => d.fabricStockDetailId) }, createdAt: { gt: s.takenAt } },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true, detailType: true, thanNo: true, sequenceNo: true },
      });
      if (late) {
        throw new JobWorkOrderError(
          'THAN_RECORD_INVALID',
          `${late.detailType === 'ROLL' ? 'Roll' : 'Than'} ${late.thanNo ?? late.sequenceNo} was put on ${s.lotLabel}'s ` +
            `list on ${formatDateTime(late.createdAt)}, after ${status.jobWorkNumber} took its cloth ` +
            `(${formatDateTime(s.takenAt)}) — it was still on the rack, so it cannot have gone on this job.`
        );
      }
      const pickedCounted = details.reduce((sum, d) => sum + d.metersToIssue, 0);
      const afterActual = foldActual(s.recordedCounted + pickedCounted, s.foldLengthCm).toNumber();
      if (qtyExceeds(afterActual, (s.takenActual * (100 + THAN_PICK_TOLERANCE_PCT)) / 100)) {
        throw new JobWorkOrderError(
          'THAN_RECORD_INVALID',
          `These pieces come to ${afterActual} m actual with what is already recorded, but ${status.jobWorkNumber} ` +
            `took only ${s.takenActual} m from ${s.lotLabel}.`
        );
      }
      const jwo = await tx.job_work_orders.findUnique({ where: { id: jwoId }, select: { outwardChallanId: true } });
      try {
        await markPiecesOut(tx, {
          lotId: s.fabricStockLotId,
          picks: details,
          userId,
          jobWorkOrderId: jwoId,
          challanId: jwo?.outwardChallanId ?? null,
          issuedAt: s.takenAt,
        });
      } catch (error) {
        // A piece already gone, named twice or not on the lot — the user's to fix, not a 500
        if (error instanceof BusinessError) {
          throw new JobWorkOrderError('THAN_RECORD_INVALID', `${status.jobWorkNumber}: ${error.message}`);
        }
        throw error;
      }
      const after = await getFabricPieceRecordStatus(jwoId, tx);
      logInfo(`[Issuance] Recorded ${details.length} roll(s) / than(s) on ${after.jobWorkNumber}`);
      return after;
    },
    { timeout: 15000, maxWait: 5000 }
  );
}
