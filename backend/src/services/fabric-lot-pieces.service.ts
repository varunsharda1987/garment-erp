/**
 * Finished-fabric lot pieces — the rolls and thans of a dyed or printed fabric lot (2026-09-28,
 * plans/fabric-lot-rolls-thans.md).
 *
 * The processor's than list typed at "Receive from processor" used to stay on the receipt
 * (grn_item_details) while the lot it booked kept no list, so cutting took whole lots blind and nobody
 * could tell which thans were at cutting and which came back. Now:
 *   - a lot made from a receipt line copies that line's pieces (copyReceiptPieces);
 *   - every door that takes metres off a lot tells this service which pieces went (settleLotOut) — the
 *     ones it names, or, when a door empties the lot without naming any, every piece left ("a whole lot
 *     takes its whole list" — exact, not a guess). A door that takes PART of a lot without naming pieces
 *     leaves the list out of step, and the Fabric Stock page says so (listStateOf);
 *   - every door that puts metres back restores the pieces that went (settleLotBack);
 *   - "Record / Check rolls & thans" (recordLotPieces) lists or re-checks what is on the rack.
 *
 * Piece metres are COUNTED at fabric_stock.foldLengthCm; the lot's quantities stay ACTUAL. A piece never
 * moves stock by itself: this service changes no lot quantity, no ledger row and no stock_levels — every
 * caller that does already syncs them. (That is also why the file name has no "stock" in it: the
 * material-sync pre-commit rule targets *stock*.service.ts.)
 *
 * Every function except recordLotPieces runs inside the caller's transaction and rethrows (CLAUDE.md stock
 * rule 5): a lot write and its pieces commit together or not at all.
 */
import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { BusinessError, NotFoundError } from '../errors';
import { addCurrency, toCurrency } from '../utils/currency';
import { formatDate } from '../utils/date';
import { foldActual, foldCounted, hasFold } from '../utils/fold-length';
import { logInfo } from '../utils/logger';
import { isQtyZero, qtyAtLeast, qtyExceeds, qtyRemaining } from '../utils/quantity';
import { createAuditLog } from './audit.service';
import { fmtQty } from './document-data/format';
import {
  THAN_PICK_TOLERANCE_PCT,
  THAN_ROUNDING_SLACK_M,
  listStateOf,
  pieceKindOf,
  pieceWord,
  snapWholeList,
  type LotListState,
  type LotPieceKind,
  type LotPieceType,
} from './helpers/lot-pieces.helper';

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

/** One picked piece: which roll / than, and how many COUNTED metres of it leave (a part piece is allowed). */
export interface FabricPiecePick {
  fabricStockDetailId: string;
  metersToIssue: number;
}

/** What a movement of pieces is FOR — written on every issue row. */
export interface PieceMoveRefs {
  userId?: string | null;
  challanId?: string | null;
  challanItemId?: string | null;
  cuttingBatchId?: string | null;
  jobWorkOrderId?: string | null;
  issuedAt?: Date;
}

/** The issue rows a return restores: those of one cutting batch, one job, or one challan (a send-out). */
export type PieceReturnScope = { cuttingBatchId: string } | { jobWorkOrderId: string } | { challanId: string };

/** A piece as the issue screens and the picker read it — the same shape as a greige lot's than. */
export interface FabricPieceView {
  id: string;
  baleNumber: number | null;
  sequenceNo: number;
  /** COUNTED metres the piece was listed with */
  meters: number;
  /** COUNTED metres still on the rack */
  metersRemaining: number;
  status: string;
  baleNo: string | null;
  thanNo: string | null;
  remarks: string | null;
  /** The piece's bale has been opened — some of its thans left or one was cut */
  baleOpen: boolean;
  /** THAN or ROLL — wording only */
  detailType: string;
  /** RECEIPT | COUNT | END */
  source: string;
  createdAt: Date;
}

/** Where a piece went: one issue row, and its return when it came back. */
export interface FabricPieceMove {
  challanNumber: string | null;
  batchNumber: string | null;
  batchStatus: string | null;
  jobWorkNumber: string | null;
  /** COUNTED metres */
  metersIssued: number;
  metersReturned: number | null;
  issuedAt: Date;
  returnedAt: Date | null;
  returnChallanNumber: string | null;
}

/** GET /api/stock/:id/pieces — the lot's list for the picker, the stock page and "View rolls & thans". */
export interface FabricLotPiecesView {
  stockId: string;
  /** "FAB-ESSKY075LS-001 · GRN2609-1228" — what the screens call the lot */
  lotLabel: string;
  fabricCode: string | null;
  /** GRN when the lot came on a receipt line, else null */
  sourceType: string | null;
  /** Bales still holding pieces (null when none) */
  baleCount: number | null;
  /** Pieces still on the rack (null when none) */
  thanCount: number | null;
  /** ACTUAL metres the lot holds */
  totalAvailable: number;
  foldLengthCm: number | null;
  /** Every piece ever listed, any status — 0 = the lot never had a list */
  piecesRecorded: number;
  pieceKind: LotPieceKind;
  receipt: { grnNumber: string | null; entryMode: string | null } | null;
  /** The pieces still on the rack, bale / sequence order — what can be picked */
  details: FabricPieceView[];
  /** ACTUAL metres the pieces left on the list come to */
  listActual: number;
  listState: LotListState;
  /** Every piece ever listed with where it went (read-only "View rolls & thans") */
  allPieces: Array<FabricPieceView & { moves: FabricPieceMove[] }>;
}

/** A lot's list at a glance, for list pages (three grouped reads for the whole page). */
export interface FabricLotPiecesSummary {
  total: number;
  left: number;
  bales: number;
  kind: LotPieceKind;
  /** ACTUAL metres of the pieces left */
  listActual: number;
  state: LotListState;
}

const EMPTY_SUMMARY = (onHand: number): FabricLotPiecesSummary => ({
  total: 0,
  left: 0,
  bales: 0,
  kind: null,
  listActual: 0,
  state: listStateOf({ piecesRecorded: 0, listActual: 0, onHand }),
});

/** AVAILABLE (whole), PARTIAL (some left) or CONSUMED (nothing left) — from what is left of a piece. */
function pieceStatus(remaining: number, meters: Prisma.Decimal | number): string {
  if (isQtyZero(remaining)) return 'CONSUMED';
  return qtyAtLeast(remaining, meters) ? 'AVAILABLE' : 'PARTIAL';
}

/** "Than T-27" / "Roll R-4" / "Bale 417 · T-27" — a piece's name in a message. */
function pieceName(p: {
  detailType: string;
  baleNumber: number | null;
  baleNo: string | null;
  thanNo: string | null;
  sequenceNo: number;
}): string {
  if (p.detailType === 'ROLL') return `Roll ${p.thanNo ?? p.sequenceNo}`;
  if (p.baleNumber == null) return `Than ${p.thanNo ?? p.sequenceNo}`;
  return `Bale ${p.baleNo ?? p.baleNumber} · ${p.thanNo ?? `T${p.sequenceNo}`}`;
}

export function fabricLotLabel(lot: {
  id: string;
  fabricMaster?: { fabricCode: string | null } | null;
  grnItem?: { goods_receiving_notes?: { grnNumber: string | null } | null } | null;
}): string {
  const code = lot.fabricMaster?.fabricCode ?? 'Fabric lot';
  const grnNumber = lot.grnItem?.goods_receiving_notes?.grnNumber;
  return `${code} · ${grnNumber ?? `lot ${lot.id.slice(0, 8)}`}`;
}

const LOT_LABEL_SELECT = {
  id: true,
  fabricMaster: { select: { fabricCode: true } },
  grnItem: { select: { goods_receiving_notes: { select: { grnNumber: true } } } },
} satisfies Prisma.fabric_stockSelect;

// ------------------------------------------------------------------------------------------------
// Copy — a lot made from a receipt line keeps the line's pieces
// ------------------------------------------------------------------------------------------------

/**
 * Give a lot booked from a receipt line that line's pieces (grn_item_details), in bale / sequence order,
 * each AVAILABLE and linked to the receipt piece it came from. The caller creates the lot with the line's
 * fold length (fabric_stock.foldLengthCm) — the pieces are counted at it. A line with no pieces (Total
 * Meters) copies none: the lot has no list. Returns how many pieces were copied.
 */
export async function copyReceiptPieces(tx: Tx, p: { lotId: string; grnItemId: string }): Promise<number> {
  const rows = await tx.grn_item_details.findMany({
    where: { grnItemId: p.grnItemId },
    orderBy: [{ baleNumber: 'asc' }, { sequenceNo: 'asc' }],
  });
  if (rows.length === 0) return 0;
  await tx.fabric_stock_details.createMany({
    data: rows.map((d) => ({
      fabricStockId: p.lotId,
      grnItemDetailId: d.id,
      baleNumber: d.baleNumber,
      sequenceNo: d.sequenceNo,
      meters: d.meters,
      metersRemaining: d.meters,
      status: 'AVAILABLE',
      // A roll-wise line's pieces are rolls — the issue screens and the challan say so
      detailType: d.detailType === 'ROLL' ? 'ROLL' : 'THAN',
      source: 'RECEIPT',
      baleNo: d.baleNo ?? null,
      thanNo: d.thanNo ?? null,
      remarks: d.remarks ?? null,
    })),
  });
  return rows.length;
}

// ------------------------------------------------------------------------------------------------
// Read
// ------------------------------------------------------------------------------------------------

/** The lot's list for the picker, the stock page and "View rolls & thans". */
export async function getLotPieces(lotId: string, db: Db = prisma): Promise<FabricLotPiecesView> {
  const lot = await db.fabric_stock.findUnique({
    where: { id: lotId },
    select: {
      ...LOT_LABEL_SELECT,
      quantityAvailable: true,
      foldLengthCm: true,
      grnItemId: true,
      grnItem: { select: { entryMode: true, goods_receiving_notes: { select: { grnNumber: true } } } },
      pieces: {
        orderBy: [{ baleNumber: 'asc' }, { sequenceNo: 'asc' }],
        include: {
          issues: {
            orderBy: { issuedAt: 'asc' },
            select: {
              metersIssued: true,
              metersReturned: true,
              issuedAt: true,
              returnedAt: true,
              challan: { select: { challanNumber: true } },
              returnChallan: { select: { challanNumber: true } },
              cuttingBatch: { select: { batchNumber: true, status: true } },
              jobWorkOrder: { select: { jobWorkNumber: true } },
            },
          },
        },
      },
    },
  });
  if (!lot) throw new NotFoundError('Fabric lot', lotId);

  const openBales = new Set(
    lot.pieces.filter((d) => d.baleNumber != null && d.status !== 'AVAILABLE').map((d) => d.baleNumber)
  );
  const view = (d: (typeof lot.pieces)[number]): FabricPieceView => ({
    id: d.id,
    baleNumber: d.baleNumber,
    sequenceNo: d.sequenceNo,
    meters: Number(d.meters),
    metersRemaining: Number(d.metersRemaining),
    status: d.status,
    baleNo: d.baleNo,
    thanNo: d.thanNo,
    remarks: d.remarks,
    baleOpen: d.baleNumber != null && openBales.has(d.baleNumber),
    detailType: d.detailType,
    source: d.source,
    createdAt: d.createdAt,
  });
  const left = lot.pieces.filter((d) => d.status !== 'CONSUMED' && !isQtyZero(d.metersRemaining));
  const listCounted = addCurrency(...left.map((d) => Number(d.metersRemaining)));
  const listActual = foldActual(listCounted, lot.foldLengthCm).toNumber();
  const onHand = Number(lot.quantityAvailable);
  const liveBales = new Set(left.filter((d) => d.baleNumber != null).map((d) => d.baleNumber));

  return {
    stockId: lot.id,
    lotLabel: fabricLotLabel(lot),
    fabricCode: lot.fabricMaster?.fabricCode ?? null,
    sourceType: lot.grnItemId ? 'GRN' : null,
    baleCount: liveBales.size > 0 ? liveBales.size : null,
    thanCount: left.length > 0 ? left.length : null,
    totalAvailable: onHand,
    foldLengthCm: lot.foldLengthCm != null ? Number(lot.foldLengthCm) : null,
    piecesRecorded: lot.pieces.length,
    pieceKind: pieceKindOf(lot.pieces.map((d) => d.detailType)),
    receipt: lot.grnItem
      ? { grnNumber: lot.grnItem.goods_receiving_notes?.grnNumber ?? null, entryMode: lot.grnItem.entryMode }
      : null,
    details: left.map(view),
    listActual,
    listState: listStateOf({ piecesRecorded: lot.pieces.length, listActual, onHand }),
    allPieces: lot.pieces.map((d) => ({
      ...view(d),
      moves: d.issues.map((m) => ({
        challanNumber: m.challan?.challanNumber ?? null,
        batchNumber: m.cuttingBatch?.batchNumber ?? null,
        batchStatus: m.cuttingBatch?.status ?? null,
        jobWorkNumber: m.jobWorkOrder?.jobWorkNumber ?? null,
        metersIssued: Number(m.metersIssued),
        metersReturned: m.metersReturned != null ? Number(m.metersReturned) : null,
        issuedAt: m.issuedAt,
        returnedAt: m.returnedAt,
        returnChallanNumber: m.returnChallan?.challanNumber ?? null,
      })),
    })),
  };
}

/**
 * Each lot's list at a glance — pieces ever listed, pieces left, live bales, kind, and whether the list
 * still matches the lot's metres. Three grouped reads for the whole page, never one query per lot.
 */
export async function lotPiecesSummary(
  lots: Array<{ id: string; quantityAvailable: Prisma.Decimal | number; foldLengthCm: Prisma.Decimal | number | null }>,
  db: Db = prisma
): Promise<Map<string, FabricLotPiecesSummary>> {
  const out = new Map<string, FabricLotPiecesSummary>();
  if (lots.length === 0) return out;
  const ids = lots.map((l) => l.id);
  const [byType, leftByLot, liveBales] = await Promise.all([
    db.fabric_stock_details.groupBy({
      by: ['fabricStockId', 'detailType'],
      where: { fabricStockId: { in: ids } },
      _count: { _all: true },
    }),
    db.fabric_stock_details.groupBy({
      by: ['fabricStockId'],
      where: { fabricStockId: { in: ids }, metersRemaining: { gt: 0 }, status: { not: 'CONSUMED' } },
      _count: { _all: true },
      _sum: { metersRemaining: true },
    }),
    db.fabric_stock_details.groupBy({
      by: ['fabricStockId', 'baleNumber'],
      where: {
        fabricStockId: { in: ids },
        metersRemaining: { gt: 0 },
        status: { not: 'CONSUMED' },
        baleNumber: { not: null },
      },
      _count: { _all: true },
    }),
  ]);
  const totals = new Map<string, number>();
  const types = new Map<string, string[]>();
  for (const g of byType) {
    totals.set(g.fabricStockId, (totals.get(g.fabricStockId) ?? 0) + g._count._all);
    types.set(g.fabricStockId, [...(types.get(g.fabricStockId) ?? []), g.detailType]);
  }
  const leftOf = new Map(leftByLot.map((g) => [g.fabricStockId, g]));
  const balesOf = new Map<string, number>();
  for (const g of liveBales) balesOf.set(g.fabricStockId, (balesOf.get(g.fabricStockId) ?? 0) + 1);

  for (const lot of lots) {
    const onHand = Number(lot.quantityAvailable);
    const total = totals.get(lot.id) ?? 0;
    if (total === 0) {
      out.set(lot.id, EMPTY_SUMMARY(onHand));
      continue;
    }
    const leftRow = leftOf.get(lot.id);
    const listActual = foldActual(Number(leftRow?._sum.metersRemaining ?? 0), lot.foldLengthCm).toNumber();
    out.set(lot.id, {
      total,
      left: leftRow?._count._all ?? 0,
      bales: balesOf.get(lot.id) ?? 0,
      kind: pieceKindOf(types.get(lot.id) ?? []),
      listActual,
      state: listStateOf({ piecesRecorded: total, listActual, onHand }),
    });
  }
  return out;
}

// ------------------------------------------------------------------------------------------------
// Out — pieces leave with the lot's metres
// ------------------------------------------------------------------------------------------------

/**
 * The ACTUAL metres a pick of named pieces takes out of its lot: the picks' COUNTED total converted once
 * at the lot's fold length; taking every piece left takes the whole lot (snapWholeList). Refuses a pick of
 * a piece that is not on this lot's list any more, a piece picked twice, or more metres than a piece has.
 */
export async function pickActualQty(
  db: Db,
  lotId: string,
  picks: FabricPiecePick[]
): Promise<{ counted: number; actual: number; takesEveryPiece: boolean; onHand: number; lotLabel: string }> {
  const lot = await db.fabric_stock.findUnique({
    where: { id: lotId },
    select: {
      ...LOT_LABEL_SELECT,
      foldLengthCm: true,
      quantityAvailable: true,
      pieces: {
        where: { metersRemaining: { gt: 0 }, status: { not: 'CONSUMED' } },
        select: {
          id: true,
          metersRemaining: true,
          detailType: true,
          baleNumber: true,
          baleNo: true,
          thanNo: true,
          sequenceNo: true,
        },
      },
    },
  });
  if (!lot) throw new NotFoundError('Fabric lot', lotId);
  const label = fabricLotLabel(lot);
  const onList = new Map(lot.pieces.map((d) => [d.id, d]));
  const seen = new Set<string>();
  for (const pick of picks) {
    if (seen.has(pick.fabricStockDetailId)) {
      throw new BusinessError(`A roll / than of ${label} is picked twice.`, { reason: 'PIECE_PICKED_TWICE' });
    }
    seen.add(pick.fabricStockDetailId);
    const piece = onList.get(pick.fabricStockDetailId);
    if (!piece) {
      throw new BusinessError(
        `A picked roll / than is no longer on ${label}'s list — it has already gone. Reload the screen and pick again.`,
        { reason: 'PIECE_NOT_ON_LOT', fabricStockDetailId: pick.fabricStockDetailId }
      );
    }
    if (qtyExceeds(pick.metersToIssue, piece.metersRemaining)) {
      throw new BusinessError(
        `${pieceName(piece)} of ${label} has ${fmtQty(Number(piece.metersRemaining), 'METER')} m left, not ` +
          `${fmtQty(pick.metersToIssue, 'METER')} m.`,
        { reason: 'PIECE_OVER_PICKED', fabricStockDetailId: piece.id }
      );
    }
  }
  const counted = addCurrency(...picks.map((p) => p.metersToIssue));
  const picked = new Map(picks.map((p) => [p.fabricStockDetailId, p.metersToIssue]));
  const takesEveryPiece =
    lot.pieces.length > 0 &&
    lot.pieces.every((d) => {
      const qty = picked.get(d.id);
      return qty != null && qtyAtLeast(qty, d.metersRemaining);
    });
  const onHand = Number(lot.quantityAvailable);
  const actual = snapWholeList(foldActual(counted, lot.foldLengthCm).toNumber(), { takesEveryPiece, onHand });
  return { counted: counted.toNumber(), actual, takesEveryPiece, onHand, lotLabel: label };
}

/**
 * Mark picked pieces as gone: lower each piece's remaining COUNTED metres, set its status, and write one
 * issue row naming the challan and the batch or job. Moves no lot stock — the caller did. Each piece is
 * written only if nobody changed it since it was read, so two issues can never take the same metres.
 */
export async function markPiecesOut(
  tx: Tx,
  p: { lotId: string; picks: FabricPiecePick[] } & PieceMoveRefs
): Promise<number> {
  const picks = p.picks.filter((pk) => !isQtyZero(pk.metersToIssue));
  if (picks.length === 0) return 0;
  const ids = picks.map((pk) => pk.fabricStockDetailId);
  if (new Set(ids).size !== ids.length) {
    throw new BusinessError('A roll / than is picked twice.', { reason: 'PIECE_PICKED_TWICE' });
  }
  const rows = await tx.fabric_stock_details.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      fabricStockId: true,
      meters: true,
      metersRemaining: true,
      detailType: true,
      baleNumber: true,
      baleNo: true,
      thanNo: true,
      sequenceNo: true,
    },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const pick of picks) {
    const piece = byId.get(pick.fabricStockDetailId);
    if (!piece || piece.fabricStockId !== p.lotId) {
      throw new BusinessError('A picked roll / than does not belong to this fabric lot.', {
        reason: 'PIECE_NOT_ON_LOT',
        fabricStockDetailId: pick.fabricStockDetailId,
      });
    }
    if (qtyExceeds(pick.metersToIssue, piece.metersRemaining)) {
      throw new BusinessError(
        `${pieceName(piece)} has ${fmtQty(Number(piece.metersRemaining), 'METER')} m left, not ` +
          `${fmtQty(pick.metersToIssue, 'METER')} m.`,
        { reason: 'PIECE_OVER_PICKED', fabricStockDetailId: piece.id }
      );
    }
    const remaining = qtyRemaining(piece.metersRemaining, pick.metersToIssue);
    const written = await tx.fabric_stock_details.updateMany({
      where: { id: piece.id, metersRemaining: piece.metersRemaining },
      data: { metersRemaining: new Prisma.Decimal(remaining), status: pieceStatus(remaining, piece.meters) },
    });
    if (written.count !== 1) {
      throw new BusinessError(
        `${pieceName(piece)} changed while this was being saved (another issue took it). Reload and try again.`,
        { reason: 'PIECE_CHANGED', fabricStockDetailId: piece.id }
      );
    }
  }
  await tx.fabric_issue_details.createMany({
    data: picks.map((pk) => ({
      fabricStockDetailId: pk.fabricStockDetailId,
      challanId: p.challanId ?? null,
      challanItemId: p.challanItemId ?? null,
      cuttingBatchId: p.cuttingBatchId ?? null,
      jobWorkOrderId: p.jobWorkOrderId ?? null,
      metersIssued: new Prisma.Decimal(pk.metersToIssue),
      issuedById: p.userId ?? null,
      ...(p.issuedAt ? { issuedAt: p.issuedAt } : {}),
    })),
  });
  return picks.length;
}

/**
 * The ONE call every fabric decrement makes right after its guarded lot update:
 *   - with picks, those pieces go (the caller took the quantity from pickActualQty);
 *   - with no picks and the lot now empty, every piece still listed goes, whole — a whole lot takes its
 *     whole list, which is exact, not a guess;
 *   - with no picks and metres still on the lot, nothing is marked: the list is then out of step and the
 *     Fabric Stock page says so (Check rolls & thans puts it right).
 * Returns how many pieces were marked.
 */
export async function settleLotOut(
  tx: Tx,
  p: { lotId: string; picks?: FabricPiecePick[] | null } & PieceMoveRefs
): Promise<number> {
  if (p.picks && p.picks.length > 0) return markPiecesOut(tx, { ...p, picks: p.picks });
  const lot = await tx.fabric_stock.findUnique({ where: { id: p.lotId }, select: { quantityAvailable: true } });
  if (!lot) return 0;
  const onHand = Number(lot.quantityAvailable);
  if (!isQtyZero(onHand) && onHand > 0) return 0;
  const left = await tx.fabric_stock_details.findMany({
    where: { fabricStockId: p.lotId, metersRemaining: { gt: 0 }, status: { not: 'CONSUMED' } },
    select: { id: true, metersRemaining: true },
  });
  if (left.length === 0) return 0;
  return markPiecesOut(tx, {
    ...p,
    picks: left.map((d) => ({ fabricStockDetailId: d.id, metersToIssue: Number(d.metersRemaining) })),
  });
}

// ------------------------------------------------------------------------------------------------
// Back — pieces return with the lot's metres
// ------------------------------------------------------------------------------------------------

function scopeWhere(scope: PieceReturnScope): Prisma.fabric_issue_detailsWhereInput {
  if ('cuttingBatchId' in scope) return { cuttingBatchId: scope.cuttingBatchId };
  if ('jobWorkOrderId' in scope) return { jobWorkOrderId: scope.jobWorkOrderId };
  return { challanId: scope.challanId };
}

/** Put issued metres back on their pieces (never past what a piece was listed with) and stamp the rows. */
async function restoreIssueRows(
  tx: Tx,
  rows: Array<{
    id: string;
    metersIssued: Prisma.Decimal;
    piece: { id: string; meters: Prisma.Decimal; metersRemaining: Prisma.Decimal };
  }>,
  returnChallanId: string | null,
  returnedAt: Date
): Promise<number> {
  const byPiece = new Map<string, { piece: (typeof rows)[number]['piece']; back: number }>();
  for (const r of rows) {
    const entry = byPiece.get(r.piece.id) ?? { piece: r.piece, back: 0 };
    entry.back = addCurrency(entry.back, Number(r.metersIssued)).toNumber();
    byPiece.set(r.piece.id, entry);
  }
  for (const { piece, back } of byPiece.values()) {
    const remaining = Math.min(Number(piece.meters), addCurrency(Number(piece.metersRemaining), back).toNumber());
    const written = await tx.fabric_stock_details.updateMany({
      where: { id: piece.id, metersRemaining: piece.metersRemaining },
      data: { metersRemaining: new Prisma.Decimal(remaining), status: pieceStatus(remaining, piece.meters) },
    });
    if (written.count !== 1) {
      throw new BusinessError('A roll / than changed while it was being returned. Reload and try again.', {
        reason: 'PIECE_CHANGED',
        fabricStockDetailId: piece.id,
      });
    }
  }
  for (const r of rows) {
    await tx.fabric_issue_details.update({
      where: { id: r.id },
      data: { metersReturned: r.metersIssued, returnedAt, returnChallanId },
    });
  }
  return byPiece.size;
}

const ISSUE_ROW_SELECT = {
  id: true,
  metersIssued: true,
  piece: {
    select: {
      id: true,
      meters: true,
      metersRemaining: true,
      detailType: true,
      baleNumber: true,
      baleNo: true,
      thanNo: true,
      sequenceNo: true,
    },
  },
} satisfies Prisma.fabric_issue_detailsSelect;

/**
 * Pieces back with metres that came back to a lot. Only ever RESTORES pieces — never takes any.
 *
 * mode 'ALL' (a cutting batch deleted or cancelled; a job cancelled or returned unprocessed; a send-out
 * cancelled): every piece of this lot that went for `scope` and has not come back comes back whole — the
 * metres it went with. The issue row is stamped (metersReturned, returnedAt, returnChallanId), never deleted.
 *
 * mode { wholePieceIds, returnedActual } (cutting completion — owner, 2026-09-28: "rarely rolls or thans come
 * back, so it should be optional, but we can write meters"): the pieces ticked as back whole come back whole;
 * the rest of the typed ACTUAL metres comes back as ONE new END piece (counted at the lot's fold). Refused when
 * the ticked pieces come to more than the metres returned.
 *
 * A lot this scope took without a list has no issue rows: nothing happens — its metres come back unlisted,
 * exactly as they went.
 */
export async function settleLotBack(
  tx: Tx,
  p: {
    lotId: string;
    scope: PieceReturnScope;
    returnChallanId?: string | null;
    returnedAt?: Date;
    mode: 'ALL' | { wholePieceIds?: string[] | null; returnedActual: number; endRemarks: string };
  }
): Promise<{ restored: number; endPieceId: string | null }> {
  const returnedAt = p.returnedAt ?? new Date();
  const open = await tx.fabric_issue_details.findMany({
    where: { ...scopeWhere(p.scope), returnedAt: null, piece: { fabricStockId: p.lotId } },
    select: ISSUE_ROW_SELECT,
  });
  if (open.length === 0) {
    if (p.mode !== 'ALL' && (p.mode.wholePieceIds?.length ?? 0) > 0) {
      throw new BusinessError('The rolls / thans ticked as back whole did not go out for this batch.', {
        reason: 'PIECE_NOT_ISSUED_HERE',
      });
    }
    return { restored: 0, endPieceId: null };
  }

  if (p.mode === 'ALL') {
    const restored = await restoreIssueRows(tx, open, p.returnChallanId ?? null, returnedAt);
    return { restored, endPieceId: null };
  }

  const { returnedActual, endRemarks } = p.mode;
  const wholeIds = [...new Set(p.mode.wholePieceIds ?? [])];
  const lot = await tx.fabric_stock.findUnique({ where: { id: p.lotId }, select: { foldLengthCm: true } });
  const fold = lot?.foldLengthCm ?? null;

  // Pieces back whole: each must have gone for this scope, whole (its open rows cover what it was listed with)
  const wholeRows = open.filter((r) => wholeIds.includes(r.piece.id));
  let wholeCounted = toCurrency(0);
  for (const id of wholeIds) {
    const rows = wholeRows.filter((r) => r.piece.id === id);
    const issued = addCurrency(...rows.map((r) => Number(r.metersIssued)));
    if (rows.length === 0 || !qtyAtLeast(issued.toNumber(), rows[0].piece.meters)) {
      const name = rows[0] ? pieceName(rows[0].piece) : 'A ticked roll / than';
      throw new BusinessError(`${name} did not go out whole for this batch, so it cannot come back whole.`, {
        reason: 'PIECE_NOT_WHOLE',
        fabricStockDetailId: id,
      });
    }
    wholeCounted = addCurrency(wholeCounted, Number(rows[0].piece.meters));
  }
  const wholeActual = foldActual(wholeCounted, fold).toNumber();
  if (qtyExceeds(wholeActual, returnedActual + THAN_ROUNDING_SLACK_M)) {
    throw new BusinessError(
      `The rolls / thans ticked as back whole come to ${fmtQty(wholeActual, 'METER')} m — more than the ` +
        `${fmtQty(returnedActual, 'METER')} m being returned.`,
      { reason: 'PIECES_EXCEED_RETURN', wholeActual, returnedActual }
    );
  }
  const restored =
    wholeRows.length > 0 ? await restoreIssueRows(tx, wholeRows, p.returnChallanId ?? null, returnedAt) : 0;

  // The rest of the metres: one end piece, counted at the lot's fold
  const endActual = qtyRemaining(returnedActual, wholeActual);
  if (isQtyZero(endActual)) return { restored, endPieceId: null };
  const [kinds, maxSeq] = await Promise.all([
    tx.fabric_stock_details.findMany({
      where: { fabricStockId: p.lotId },
      select: { detailType: true },
      distinct: ['detailType'],
    }),
    tx.fabric_stock_details.aggregate({ where: { fabricStockId: p.lotId }, _max: { sequenceNo: true } }),
  ]);
  const kind = pieceKindOf(kinds.map((k) => k.detailType));
  const endCounted = foldCounted(endActual, fold);
  const end = await tx.fabric_stock_details.create({
    data: {
      fabricStockId: p.lotId,
      baleNumber: null,
      sequenceNo: (maxSeq._max.sequenceNo ?? 0) + 1,
      meters: new Prisma.Decimal(endCounted.toString()),
      metersRemaining: new Prisma.Decimal(endCounted.toString()),
      status: 'AVAILABLE',
      detailType: kind === 'ROLL' ? 'ROLL' : 'THAN',
      source: 'END',
      remarks: endRemarks,
    },
    select: { id: true },
  });
  return { restored, endPieceId: end.id };
}

// ------------------------------------------------------------------------------------------------
// Moves — a whole held lot moved to a new lot takes its list along
// ------------------------------------------------------------------------------------------------

/**
 * Every piece still listed on `fromLotId` now belongs to `toLotId` (a held lot moved WHOLE into a new lot:
 * bringHeldLotToStore, which creates the new lot with the old lot's fold). Pieces that already went stay
 * with their history on the old lot. Returns how many moved.
 */
export async function movePiecesToLot(tx: Tx, fromLotId: string, toLotId: string): Promise<number> {
  const moved = await tx.fabric_stock_details.updateMany({
    where: { fabricStockId: fromLotId, metersRemaining: { gt: 0 }, status: { not: 'CONSUMED' } },
    data: { fabricStockId: toLotId },
  });
  return moved.count;
}

/** Has any piece of this lot ever left it? (A receipt whose lot's pieces went cannot be reversed.) */
export async function lotPiecesEverIssued(db: Db, lotId: string): Promise<number> {
  return db.fabric_issue_details.count({ where: { piece: { fabricStockId: lotId } } });
}

// ------------------------------------------------------------------------------------------------
// Record / Check rolls & thans
// ------------------------------------------------------------------------------------------------

export interface RecordFabricPiecesInput {
  entryMode: 'THAN_WISE' | 'BALE_WISE' | 'ROLL_WISE';
  /** The pieces on the list that are really on the rack (Check). Every other listed piece is dropped. */
  keepPieceIds?: string[];
  /** New pieces, COUNTED metres at the lot's fold */
  pieces: Array<{ baleNumber?: number | null; baleNo?: string | null; thanNo?: string | null; meters: number }>;
  remarks?: string | null;
}

export interface RecordFabricPiecesResult {
  stockId: string;
  lotLabel: string;
  /** The lot had pieces on its list before — this was a Check, not a first count */
  wasCheck: boolean;
  recorded: number;
  kept: number;
  dropped: number;
  bales: number;
  detailType: LotPieceType;
  countedTotal: number;
  actualTotal: number;
  onHand: number;
  foldLengthCm: number | null;
}

/**
 * "Record rolls & thans" (a lot with no list, or none left while metres are on hand) and "Check rolls &
 * thans" (tick what is really on the rack, add what is not listed). The store counts what is on the rack
 * NOW; the kept pieces plus the new ones must land within ±1% of the lot's on-hand metres.
 *
 * Moves NO stock: the lot's metres, its ledger and stock_levels stay as they are, so there is nothing to
 * sync (CLAUDE.md stock rule 5 governs quantity writes). Unlike the greige count, a lot that still lists
 * pieces is not refused: the dialog sends which listed pieces are really there, so a count can never
 * double a list. Listed pieces not kept are dropped (CONSUMED, "Not on the rack at the count of …") with
 * no issue row — they left through a door that did not name them.
 */
export async function recordLotPieces(
  lotId: string,
  input: RecordFabricPiecesInput,
  userId: string
): Promise<RecordFabricPiecesResult> {
  const exists = await prisma.fabric_stock.findUnique({ where: { id: lotId }, select: { id: true } });
  if (!exists) throw new NotFoundError('Fabric lot', lotId);

  const detailType: LotPieceType = input.entryMode === 'ROLL_WISE' ? 'ROLL' : 'THAN';
  const baled = input.entryMode === 'BALE_WISE';
  const cleanLabel = (value?: string | null) => value?.trim() || null;
  const keepIds = [...new Set(input.keepPieceIds ?? [])];
  const inputBales = baled ? [...new Set(input.pieces.map((pc) => Number(pc.baleNumber)))] : [];
  const countedAt = new Date();

  const result = await prisma.$transaction(
    async (tx) => {
      // Lock the lot first: an issue's lot update or a second count waits for this transaction, so every
      // read below is current. Fabric has no than count to update, so the lock is taken explicitly.
      await tx.$queryRaw`SELECT "id" FROM "fabric_stock" WHERE "id" = ${lotId} FOR UPDATE`;
      const lot = await tx.fabric_stock.findUniqueOrThrow({
        where: { id: lotId },
        select: { ...LOT_LABEL_SELECT, quantityAvailable: true, foldLengthCm: true },
      });
      const label = fabricLotLabel(lot);
      const onHand = Number(lot.quantityAvailable);
      const foldLengthCm = lot.foldLengthCm != null ? Number(lot.foldLengthCm) : null;
      if (isQtyZero(onHand) || onHand < 0) {
        throw new BusinessError(`${label} has nothing on hand to count.`, { reason: 'LOT_EMPTY' });
      }

      const listed = await tx.fabric_stock_details.findMany({
        where: { fabricStockId: lotId, metersRemaining: { gt: 0 }, status: { not: 'CONSUMED' } },
        select: { id: true, metersRemaining: true },
      });
      const listedIds = new Set(listed.map((d) => d.id));
      const stranger = keepIds.find((id) => !listedIds.has(id));
      if (stranger) {
        throw new BusinessError(
          `A roll / than ticked as on the rack is no longer on ${label}'s list. Reload and count again.`,
          { reason: 'PIECE_NOT_ON_LOT', fabricStockDetailId: stranger }
        );
      }
      const kept = listed.filter((d) => keepIds.includes(d.id));
      const dropped = listed.filter((d) => !keepIds.includes(d.id));
      if (kept.length === 0 && input.pieces.length === 0) {
        throw new BusinessError('Tick at least one roll / than on the rack, or add one.', {
          reason: 'NOTHING_COUNTED',
        });
      }

      const keptCounted = addCurrency(...kept.map((d) => Number(d.metersRemaining)));
      const newCounted = addCurrency(...input.pieces.map((pc) => pc.meters));
      const countedTotal = addCurrency(keptCounted, newCounted).toNumber();
      const actualTotal = foldActual(countedTotal, foldLengthCm).toNumber();
      const allowed = (onHand * THAN_PICK_TOLERANCE_PCT) / 100;
      const pieceCount = kept.length + input.pieces.length;
      if (qtyExceeds(Math.abs(actualTotal - onHand), allowed)) {
        throw new BusinessError(
          `These ${pieceCount} ${pieceWord(detailType, pieceCount)} come to ${fmtQty(actualTotal, 'METER')} m actual` +
            (hasFold(foldLengthCm) ? ` (${fmtQty(countedTotal, 'METER')} m counted at fold ${foldLengthCm} cm)` : '') +
            `, but ${label} holds ${fmtQty(onHand, 'METER')} m — more than ${THAN_PICK_TOLERANCE_PCT}% apart. ` +
            `Check the count, or correct the lot's quantity first with Adjust Stock on the Fabric Stock page.`,
          { reason: 'PIECES_OFF_LOT', countedTotal, actualTotal, onHand, tolerancePercent: THAN_PICK_TOLERANCE_PCT }
        );
      }

      // Listed pieces that are not on the rack leave the list — no issue row: no door named them
      if (dropped.length > 0) {
        await tx.fabric_stock_details.updateMany({
          where: { id: { in: dropped.map((d) => d.id) } },
          data: {
            metersRemaining: new Prisma.Decimal(0),
            status: 'CONSUMED',
            remarks: `Not on the rack at the count of ${formatDate(countedAt)}`,
          },
        });
      }

      // New pieces are numbered past every number the lot has used
      const [{ _max: baleMax }, { _max: seqMax }] = await Promise.all([
        tx.fabric_stock_details.aggregate({ where: { fabricStockId: lotId }, _max: { baleNumber: true } }),
        tx.fabric_stock_details.aggregate({ where: { fabricStockId: lotId }, _max: { sequenceNo: true } }),
      ]);
      const baleOffset = baleMax.baleNumber ?? 0;
      let looseSeq = seqMax.sequenceNo ?? 0;
      const seqInBale = new Map<number, number>();
      // A bale's printed number belongs to the bale: the first one typed in it labels all its thans
      const baleNoOf = new Map<number, string | null>();
      for (const pc of input.pieces) {
        const bale = Number(pc.baleNumber);
        if (baled && !baleNoOf.get(bale)) baleNoOf.set(bale, cleanLabel(pc.baleNo));
      }
      const rows = input.pieces.map((pc) => {
        const meters = new Prisma.Decimal(pc.meters);
        const common = {
          fabricStockId: lotId,
          meters,
          metersRemaining: meters,
          status: 'AVAILABLE',
          thanNo: cleanLabel(pc.thanNo),
          detailType,
          source: 'COUNT',
          remarks: cleanLabel(input.remarks),
        };
        if (!baled) return { ...common, baleNumber: null, sequenceNo: ++looseSeq, baleNo: null };
        const inputBale = Number(pc.baleNumber);
        const seq = (seqInBale.get(inputBale) ?? 0) + 1;
        seqInBale.set(inputBale, seq);
        return {
          ...common,
          baleNumber: baleOffset + inputBales.indexOf(inputBale) + 1,
          sequenceNo: seq,
          baleNo: baleNoOf.get(inputBale) ?? null,
        };
      });
      if (rows.length > 0) await tx.fabric_stock_details.createMany({ data: rows });

      return {
        stockId: lotId,
        lotLabel: label,
        wasCheck: listed.length > 0,
        recorded: rows.length,
        kept: kept.length,
        dropped: dropped.length,
        bales: inputBales.length,
        detailType,
        countedTotal,
        actualTotal,
        onHand,
        foldLengthCm,
      };
    },
    { timeout: 15000, maxWait: 5000 }
  );

  // Outside the transaction (the audit writer never throws); each piece's createdAt is the lasting record
  await createAuditLog({
    userId,
    action: 'UPDATE',
    entityType: 'STOCK',
    entityId: lotId,
    newValues: {
      event: result.wasCheck ? 'FABRIC_PIECES_CHECKED' : 'FABRIC_PIECES_RECORDED',
      entryMode: input.entryMode,
      piecesRecorded: result.recorded,
      piecesKept: result.kept,
      piecesDropped: result.dropped,
      detailType: result.detailType,
      bales: result.bales,
      countedTotal: result.countedTotal,
      actualTotal: result.actualTotal,
      onHand: result.onHand,
      foldLengthCm: result.foldLengthCm,
      remarks: input.remarks ?? null,
    },
  });
  logInfo(
    `${result.wasCheck ? 'Checked' : 'Recorded'} fabric lot ${lotId}: ${result.kept} kept, ${result.dropped} dropped, ` +
      `${result.recorded} added (${result.countedTotal} m counted vs ${result.onHand} m on hand)`
  );
  return result;
}
