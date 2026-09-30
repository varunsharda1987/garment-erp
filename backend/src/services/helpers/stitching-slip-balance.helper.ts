/**
 * What is left on a transfer slip an issue draws from — ONE rule (2026-09-30), for both stages:
 *   STITCHING issues take from cutting → stitching slips   (stitching_issue_slip_skus)
 *   FINISHING issues take from stitching → finishing slips (finishing_issue_slip_skus)
 *
 * An issue may take only some sizes (or part of a size) from a slip; the New Issue pages always said
 * "Remaining pieces can be issued later". Until then a stitching issue marked every slip it drew from
 * RECEIVED however few pieces it took, and a RECEIVED slip drops out of *Incoming* and is refused by
 * the next issue — so the rest were lost: SI-WO2609-0088-001 took size S (459) from TS-20260930-0001
 * and the other 1,680 pcs showed nowhere. Finishing had the opposite hole: its issues never used a
 * slip up, so the same stitched pieces could be issued to finishing again and again.
 *
 * Each issue's taking is recorded per slip × colour × size:
 *   remaining = the slip's quantity − what issues took from it
 * A slip stays open (CREATED / PRINTED / CONFIRMED) while anything remains and turns RECEIVED only
 * when its takings cover it in full. Deleting a not-yet-received issue gives its pieces back.
 *
 * Quantities are whole pieces (Int columns), so equality is exact.
 */

import { Prisma, TransferSlipStatus } from '@prisma/client';
import { ValidationError } from '../../errors';
import { skuKey } from './sku-colour.helper';

type Db = Prisma.TransactionClient;

/** The stage an issue belongs to; its slips come from the stage before. */
export type SlipStage = 'STITCHING' | 'FINISHING';

const FROM_STAGE: Record<SlipStage, string> = { STITCHING: 'CUTTING', FINISHING: 'STITCHING' };

/** A slip with pieces still to issue. RECEIVED = fully issued. */
export const OPEN_CUTTING_SLIP_STATUSES: TransferSlipStatus[] = ['CREATED', 'PRINTED', 'CONFIRMED'];
export const OPEN_SLIP_STATUSES = OPEN_CUTTING_SLIP_STATUSES;

/** The active slips a stage's issues draw from. */
export function slipsInto(stage: SlipStage) {
  return { fromStage: FROM_STAGE[stage], toStage: stage, isActive: true } as const;
}

/** The slips stitching draws from. */
export const CUTTING_TO_STITCHING = slipsInto('STITCHING');

/** Include on a transfer_slips query so slipSkuBalances() can work out what is left (either stage). */
export const SLIP_TAKINGS_INCLUDE = {
  stitchingAllocations: { select: { colorId: true, sizeId: true, quantity: true } },
  finishingAllocations: { select: { colorId: true, sizeId: true, quantity: true } },
} as const;

interface SkuQty {
  colorId: string | null;
  sizeId: string;
  quantity: number;
}

interface SlipWithTakings {
  skuBreakdown: SkuQty[];
  stitchingAllocations?: SkuQty[];
  finishingAllocations?: SkuQty[];
}

export interface SlipSkuBalance {
  colorId: string | null;
  sizeId: string;
  /** What the previous stage put on the slip */
  sent: number;
  /** What issues took */
  taken: number;
  remaining: number;
}

/** Per colour + size: sent, taken and remaining on ONE slip (its skuBreakdown + takings). */
export function slipSkuBalances(slip: SlipWithTakings): SlipSkuBalance[] {
  // A slip feeds one stage only, so at most one of the two lists holds rows
  const takings = [...(slip.stitchingAllocations ?? []), ...(slip.finishingAllocations ?? [])];
  const taken = new Map<string, number>();
  for (const a of takings) {
    const key = skuKey(a.colorId, a.sizeId);
    taken.set(key, (taken.get(key) || 0) + a.quantity);
  }
  return slip.skuBreakdown.map((sku) => {
    const took = taken.get(skuKey(sku.colorId, sku.sizeId)) || 0;
    return {
      colorId: sku.colorId,
      sizeId: sku.sizeId,
      sent: sku.quantity,
      taken: took,
      remaining: Math.max(0, sku.quantity - took),
    };
  });
}

/** Pieces left on a slip, all sizes. */
export function slipRemaining(slip: SlipWithTakings): number {
  return slipSkuBalances(slip).reduce((sum, b) => sum + b.remaining, 0);
}

export interface IssueSkuRow {
  colorId: string | null;
  sizeId: string;
  issuedQty: number;
}

type TakingRow = { transferSlipId: string; colorId: string | null; sizeId: string; quantity: number };

async function writeTakings(tx: Db, stage: SlipStage, issueId: string, rows: TakingRow[]) {
  if (rows.length === 0) return;
  if (stage === 'STITCHING') {
    await tx.stitching_issue_slip_skus.createMany({ data: rows.map((r) => ({ ...r, stitchingIssueId: issueId })) });
  } else {
    await tx.finishing_issue_slip_skus.createMany({ data: rows.map((r) => ({ ...r, finishingIssueId: issueId })) });
  }
}

async function readTakings(tx: Db, stage: SlipStage, issueId: string) {
  const include = { transferSlip: { select: { slipNumber: true, transferDate: true } } } as const;
  return stage === 'STITCHING'
    ? tx.stitching_issue_slip_skus.findMany({ where: { stitchingIssueId: issueId }, include })
    : tx.finishing_issue_slip_skus.findMany({ where: { finishingIssueId: issueId }, include });
}

/**
 * Take an issue's pieces from its selected slips, oldest slip first, and record where each piece
 * came from. Refuses a slip of another stage or run, a closed or fully issued slip, and more of a size
 * than the slips have left. A slip whose pieces are now all taken turns RECEIVED. Runs in the caller's
 * transaction; the slip rows are locked so two issues cannot take the same pieces.
 */
export async function takeFromSlips(
  tx: Db,
  args: { stage?: SlipStage; issueId: string; workOrderId: string; slipIds: string[]; skuRows: IssueSkuRow[] }
): Promise<void> {
  const stage = args.stage ?? 'STITCHING';
  const slipIds = [...new Set(args.slipIds)];
  if (slipIds.length === 0) return;

  await tx.$queryRaw`SELECT id FROM transfer_slips WHERE id IN (${Prisma.join(slipIds)}) FOR UPDATE`;

  const slips = await tx.transfer_slips.findMany({
    where: { id: { in: slipIds } },
    include: {
      skuBreakdown: { select: { colorId: true, sizeId: true, quantity: true } },
      ...SLIP_TAKINGS_INCLUDE,
    },
    orderBy: [{ transferDate: 'asc' }, { slipNumber: 'asc' }],
  });

  if (slips.length !== slipIds.length || slips.some((s) => !s.isActive)) {
    throw new ValidationError('One or more selected transfer slips were not found or are inactive');
  }
  const from = FROM_STAGE[stage].toLowerCase();
  const to = stage.toLowerCase();
  for (const slip of slips) {
    if (slip.fromStage !== FROM_STAGE[stage] || slip.toStage !== stage) {
      throw new ValidationError(`Transfer slip ${slip.slipNumber} is not a slip from ${from} to ${to}`);
    }
    if (slip.workOrderId !== args.workOrderId) {
      throw new ValidationError(`Transfer slip ${slip.slipNumber} belongs to a different work order`);
    }
    if (!OPEN_SLIP_STATUSES.includes(slip.status)) {
      throw new ValidationError(`Transfer slip ${slip.slipNumber} has already been fully issued to ${to}`);
    }
  }

  // What is left per slip, per colour + size
  const left = new Map<string, Map<string, number>>();
  for (const slip of slips) {
    left.set(slip.id, new Map(slipSkuBalances(slip).map((b) => [skuKey(b.colorId, b.sizeId), b.remaining])));
  }

  const allocations: TakingRow[] = [];
  const short: Array<{ sizeId: string; colorId: string | null; asked: number; available: number }> = [];
  for (const row of args.skuRows) {
    const key = skuKey(row.colorId, row.sizeId);
    const available = slips.reduce((sum, s) => sum + (left.get(s.id)!.get(key) || 0), 0);
    if (row.issuedQty > available) {
      short.push({ sizeId: row.sizeId, colorId: row.colorId, asked: row.issuedQty, available });
      continue;
    }
    let need = row.issuedQty;
    for (const slip of slips) {
      if (need === 0) break;
      const onSlip = left.get(slip.id)!;
      const take = Math.min(onSlip.get(key) || 0, need);
      if (take === 0) continue;
      onSlip.set(key, (onSlip.get(key) || 0) - take);
      need -= take;
      allocations.push({ transferSlipId: slip.id, colorId: row.colorId, sizeId: row.sizeId, quantity: take });
    }
  }

  if (short.length > 0) {
    const sizes = await tx.size_options.findMany({
      where: { id: { in: short.map((s) => s.sizeId) } },
      select: { id: true, sizeName: true },
    });
    const colourIds = short.map((s) => s.colorId).filter((id): id is string => !!id);
    const colours = colourIds.length
      ? await tx.color_options.findMany({ where: { id: { in: colourIds } }, select: { id: true, colorName: true } })
      : [];
    const sizeName = new Map(sizes.map((s) => [s.id, s.sizeName]));
    const colourName = new Map(colours.map((c) => [c.id, c.colorName]));
    const lines = short.map((s) => {
      const label = [s.colorId ? colourName.get(s.colorId) : null, sizeName.get(s.sizeId) ?? s.sizeId]
        .filter(Boolean)
        .join(' / ');
      return `${label}: asked ${s.asked}, only ${s.available} left on the selected slips`;
    });
    throw new ValidationError(`Issue quantity is more than the selected slips have left — ${lines.join('; ')}`);
  }

  await writeTakings(tx, stage, args.issueId, allocations);

  // A slip whose pieces are all taken is fully issued
  const emptied = slips.filter((s) => [...left.get(s.id)!.values()].every((q) => q === 0)).map((s) => s.id);
  if (emptied.length > 0) {
    const flipped = await tx.transfer_slips.updateMany({
      where: { id: { in: emptied }, status: { in: OPEN_SLIP_STATUSES } },
      data: { status: 'RECEIVED', receivedDate: new Date() },
    });
    if (flipped.count !== emptied.length) {
      throw new ValidationError(`One or more transfer slips were issued by another ${to} issue at the same time`);
    }
  }
}

/**
 * Give an issue's pieces back to the slips they came from (before the issue is deleted): its takings
 * are removed and a slip it had fully issued opens again.
 */
export async function returnToSlips(tx: Db, issueId: string, stage: SlipStage = 'STITCHING'): Promise<void> {
  const takings = await readTakings(tx, stage, issueId);
  const slipIds = [...new Set(takings.map((t) => t.transferSlipId))];
  if (slipIds.length === 0) return;

  await tx.$queryRaw`SELECT id FROM transfer_slips WHERE id IN (${Prisma.join(slipIds)}) FOR UPDATE`;
  if (stage === 'STITCHING') await tx.stitching_issue_slip_skus.deleteMany({ where: { stitchingIssueId: issueId } });
  else await tx.finishing_issue_slip_skus.deleteMany({ where: { finishingIssueId: issueId } });
  await tx.transfer_slips.updateMany({
    where: { id: { in: slipIds }, status: 'RECEIVED' },
    data: { status: 'CREATED', receivedDate: null, receivedById: null },
  });
}

export interface IssueSlipTaking {
  transferSlipId: string;
  slipNumber: string;
  skus: SkuQty[];
}

/** What an issue took, slip by slip (oldest slip first). */
export async function issueSlipTakings(
  tx: Db,
  issueId: string,
  stage: SlipStage = 'STITCHING'
): Promise<IssueSlipTaking[]> {
  const rows = await readTakings(tx, stage, issueId);
  const bySlip = new Map<string, IssueSlipTaking & { transferDate: Date }>();
  for (const r of rows) {
    if (!bySlip.has(r.transferSlipId)) {
      bySlip.set(r.transferSlipId, {
        transferSlipId: r.transferSlipId,
        slipNumber: r.transferSlip.slipNumber,
        transferDate: r.transferSlip.transferDate,
        skus: [],
      });
    }
    bySlip.get(r.transferSlipId)!.skus.push({ colorId: r.colorId, sizeId: r.sizeId, quantity: r.quantity });
  }
  return [...bySlip.values()]
    .sort((a, b) => a.transferDate.getTime() - b.transferDate.getTime() || a.slipNumber.localeCompare(b.slipNumber))
    .map(({ transferDate: _transferDate, ...rest }) => rest);
}

/** Pieces waiting on open slips into a stage, per work order and size (Size-wise Status). */
export async function waitingBySize(
  db: Db,
  workOrderIds?: string[],
  stage: SlipStage = 'STITCHING'
): Promise<Map<string, Map<string, { sizeId: string; waiting: number }>>> {
  const slips = await db.transfer_slips.findMany({
    where: {
      ...slipsInto(stage),
      status: { in: OPEN_SLIP_STATUSES },
      ...(workOrderIds ? { workOrderId: { in: workOrderIds } } : {}),
    },
    include: {
      skuBreakdown: { select: { colorId: true, sizeId: true, quantity: true } },
      ...SLIP_TAKINGS_INCLUDE,
    },
  });
  const out = new Map<string, Map<string, { sizeId: string; waiting: number }>>();
  for (const slip of slips) {
    if (!out.has(slip.workOrderId)) out.set(slip.workOrderId, new Map());
    const bySize = out.get(slip.workOrderId)!;
    for (const b of slipSkuBalances(slip)) {
      if (b.remaining === 0) continue; // allow-exact-qty: whole pieces
      const entry = bySize.get(b.sizeId) || { sizeId: b.sizeId, waiting: 0 };
      entry.waiting += b.remaining;
      bySize.set(b.sizeId, entry);
    }
  }
  return out;
}
