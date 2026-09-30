/**
 * What is left on a cutting → stitching transfer slip — ONE rule (2026-09-30).
 *
 * A stitching issue may take only some sizes (or part of a size) from a slip; the New Issue page
 * always said "Remaining pieces can be issued later". Until now the create step marked every slip it
 * drew from RECEIVED however few pieces it took, and a RECEIVED slip drops out of *Incoming from
 * Cutting* and is refused by the next issue — so the rest were lost: SI-WO2609-0088-001 took size S
 * (459) from TS-20260930-0001 and the other 1,680 pcs showed nowhere.
 *
 * Each issue's taking is recorded per slip × colour × size in `stitching_issue_slip_skus`:
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

/** A cutting → stitching slip with pieces still to issue. RECEIVED = fully issued. */
export const OPEN_CUTTING_SLIP_STATUSES: TransferSlipStatus[] = ['CREATED', 'PRINTED', 'CONFIRMED'];

/** The slips stitching draws from. */
export const CUTTING_TO_STITCHING = { fromStage: 'CUTTING', toStage: 'STITCHING', isActive: true } as const;

/** Include on a transfer_slips query so slipSkuBalances() can work out what is left. */
export const SLIP_TAKINGS_INCLUDE = {
  stitchingAllocations: { select: { colorId: true, sizeId: true, quantity: true } },
} as const;

interface SkuQty {
  colorId: string | null;
  sizeId: string;
  quantity: number;
}

export interface SlipSkuBalance {
  colorId: string | null;
  sizeId: string;
  /** What cutting put on the slip */
  sent: number;
  /** What stitching issues took */
  taken: number;
  remaining: number;
}

/** Per colour + size: sent, taken and remaining on ONE slip (its skuBreakdown + stitchingAllocations). */
export function slipSkuBalances(slip: { skuBreakdown: SkuQty[]; stitchingAllocations: SkuQty[] }): SlipSkuBalance[] {
  const taken = new Map<string, number>();
  for (const a of slip.stitchingAllocations) {
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
export function slipRemaining(slip: { skuBreakdown: SkuQty[]; stitchingAllocations: SkuQty[] }): number {
  return slipSkuBalances(slip).reduce((sum, b) => sum + b.remaining, 0);
}

export interface IssueSkuRow {
  colorId: string | null;
  sizeId: string;
  issuedQty: number;
}

/**
 * Take an issue's pieces from its selected slips, oldest slip first, and record where each piece
 * came from. Refuses a slip of another run, a closed or fully issued slip, and more of a size than
 * the slips have left. A slip whose pieces are now all taken turns RECEIVED. Runs in the caller's
 * transaction; the slip rows are locked so two issues cannot take the same pieces.
 */
export async function takeFromSlips(
  tx: Db,
  args: { stitchingIssueId: string; workOrderId: string; slipIds: string[]; skuRows: IssueSkuRow[] }
): Promise<void> {
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
  for (const slip of slips) {
    if (slip.fromStage !== 'CUTTING' || slip.toStage !== 'STITCHING') {
      throw new ValidationError(`Transfer slip ${slip.slipNumber} is not a slip from cutting to stitching`);
    }
    if (slip.workOrderId !== args.workOrderId) {
      throw new ValidationError(`Transfer slip ${slip.slipNumber} belongs to a different work order`);
    }
    if (!OPEN_CUTTING_SLIP_STATUSES.includes(slip.status)) {
      throw new ValidationError(`Transfer slip ${slip.slipNumber} has already been fully issued to stitching`);
    }
  }

  // What is left per slip, per colour + size
  const left = new Map<string, Map<string, number>>();
  for (const slip of slips) {
    left.set(slip.id, new Map(slipSkuBalances(slip).map((b) => [skuKey(b.colorId, b.sizeId), b.remaining])));
  }

  const allocations: Prisma.stitching_issue_slip_skusCreateManyInput[] = [];
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
      allocations.push({
        stitchingIssueId: args.stitchingIssueId,
        transferSlipId: slip.id,
        colorId: row.colorId,
        sizeId: row.sizeId,
        quantity: take,
      });
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

  if (allocations.length > 0) {
    await tx.stitching_issue_slip_skus.createMany({ data: allocations });
  }

  // A slip whose pieces are all taken is fully issued
  const emptied = slips.filter((s) => [...left.get(s.id)!.values()].every((q) => q === 0)).map((s) => s.id);
  if (emptied.length > 0) {
    const flipped = await tx.transfer_slips.updateMany({
      where: { id: { in: emptied }, status: { in: OPEN_CUTTING_SLIP_STATUSES } },
      data: { status: 'RECEIVED', receivedDate: new Date() },
    });
    if (flipped.count !== emptied.length) {
      throw new ValidationError('One or more transfer slips were issued by another stitching issue at the same time');
    }
  }
}

/**
 * Give a stitching issue's pieces back to the slips they came from (before the issue is deleted):
 * its takings are removed and a slip it had fully issued opens again.
 */
export async function returnToSlips(tx: Db, stitchingIssueId: string): Promise<void> {
  const takings = await tx.stitching_issue_slip_skus.findMany({
    where: { stitchingIssueId },
    select: { transferSlipId: true },
  });
  const slipIds = [...new Set(takings.map((t) => t.transferSlipId))];
  if (slipIds.length === 0) return;

  await tx.$queryRaw`SELECT id FROM transfer_slips WHERE id IN (${Prisma.join(slipIds)}) FOR UPDATE`;
  await tx.stitching_issue_slip_skus.deleteMany({ where: { stitchingIssueId } });
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

/** What a stitching issue took, slip by slip (oldest slip first). */
export async function issueSlipTakings(tx: Db, stitchingIssueId: string): Promise<IssueSlipTaking[]> {
  const rows = await tx.stitching_issue_slip_skus.findMany({
    where: { stitchingIssueId },
    include: { transferSlip: { select: { slipNumber: true, transferDate: true } } },
  });
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

/** Pieces waiting on open cutting → stitching slips, per work order and size (Size-wise Status). */
export async function waitingBySize(
  db: Db,
  workOrderIds?: string[]
): Promise<Map<string, Map<string, { sizeId: string; waiting: number }>>> {
  const slips = await db.transfer_slips.findMany({
    where: {
      ...CUTTING_TO_STITCHING,
      status: { in: OPEN_CUTTING_SLIP_STATUSES },
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
