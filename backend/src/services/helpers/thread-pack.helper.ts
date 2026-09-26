/**
 * Thread packs — how thread is bought and stocked (owner, 2026-09-26).
 *
 * One thread master per brand / colour. It is ordered as CONES (2-ply or 3-ply, chosen per line) or TUBES
 * (always 3-ply), counted in boxes: the box size comes from ONE table, `thread_packaging_specs`, by packing
 * and ply (cone 10 / box at 5,000 m; tube 3-ply 15 / box at 400 m). The PO line is in BOXES; stock is in
 * cones or tubes, and each pack is its OWN stock item — a `materials` row per (thread, packing, ply) —
 * so cones and tubes are never added together. Cones are priced per cone, tubes per box (the PO form turns
 * a per-cone rate into the rate per box).
 *
 * Thread CONSUMPTION per garment is not designed yet — nothing here issues or backflushes thread.
 */

import type { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { BusinessError } from '../../errors';
import type { ThreadPackagingType, ThreadPly, Unit } from '../../schemas/generated/prisma-enums';
import { normalizeUnit, unitLabel } from '../../utils/units';

/** What a PO line may order: cones in either ply, tubes in 3-ply only. */
export const ORDERABLE_THREAD_PACKS: Readonly<Record<'CONE' | 'TUBE', ReadonlyArray<ThreadPly>>> = {
  CONE: ['TWO_PLY', 'THREE_PLY'],
  TUBE: ['THREE_PLY'],
};

/** A packing's word, from the unit registry: Cone, Tube, Spool — a cone of a set length says so (Cone 5K). */
function packingWord(packing: ThreadPackagingType): string {
  const unit = threadPackUnit(packing);
  const length = packing === 'CONE_5K' ? ' 5K' : packing === 'CONE_10K' ? ' 10K' : '';
  return `${unitLabel(unit)}${length}`;
}

const PLY_WORD: Record<ThreadPly, string> = { TWO_PLY: '2-ply', THREE_PLY: '3-ply' };

/** "Cone 3-ply", "Tube 3-ply" — a pack's name everywhere it is shown. */
export function threadPackLabel(packing: ThreadPackagingType, ply: ThreadPly | null | undefined): string {
  return ply ? `${packingWord(packing)} ${PLY_WORD[ply]}` : packingWord(packing);
}

/** The pack row's code: THR-0001-CONE-3PLY. */
export function threadPackCode(threadCode: string, packing: ThreadPackagingType, ply: ThreadPly | null | undefined) {
  return `${threadCode}-${packing}${ply ? `-${ply === 'TWO_PLY' ? '2' : '3'}PLY` : ''}`;
}

/** The unit a pack is counted in: cones or tubes (a spool is a spool; a 5K / 10K cone is a cone). */
export function threadPackUnit(packing: ThreadPackagingType): Unit {
  return normalizeUnit(packing) ?? 'CONE';
}

export interface ThreadBoxSpec {
  packing: ThreadPackagingType;
  ply: ThreadPly;
  unitsPerBox: number;
  metersPerUnit: number;
}

/**
 * The box a PO line orders, checked against what may be ordered: packing CONE or TUBE, a ply the packing
 * comes in (a tube is always 3-ply, so a missing tube ply is 3-ply), and a box size in the spec table.
 */
export async function orderableThreadBox(
  threadName: string,
  packing: ThreadPackagingType | null | undefined,
  ply: ThreadPly | null | undefined,
  tx?: Prisma.TransactionClient
): Promise<ThreadBoxSpec> {
  if (packing !== 'CONE' && packing !== 'TUBE') {
    throw new BusinessError(`${threadName}: choose Cone or Tube — thread is ordered in cones or tubes.`);
  }
  const plies = ORDERABLE_THREAD_PACKS[packing];
  const resolvedPly = ply ?? (plies.length === 1 ? plies[0] : null);
  if (!resolvedPly) {
    throw new BusinessError(`${threadName}: choose 2-ply or 3-ply for the cones.`);
  }
  if (!plies.includes(resolvedPly)) {
    throw new BusinessError(
      `${threadName}: a ${packingWord(packing).toLowerCase()} comes in ${plies.map((p) => PLY_WORD[p]).join(' or ')} only.`
    );
  }
  const spec = await (tx ?? prisma).thread_packaging_specs.findUnique({
    where: { ply_packagingType: { ply: resolvedPly, packagingType: packing } },
    select: { unitsPerBox: true, metersPerUnit: true, isActive: true },
  });
  if (!spec || !spec.isActive || !(spec.unitsPerBox > 0)) {
    throw new BusinessError(
      `No box size is set for ${threadPackLabel(packing, resolvedPly)} — add it to the thread packaging table first.`
    );
  }
  return {
    packing,
    ply: resolvedPly,
    unitsPerBox: spec.unitsPerBox,
    metersPerUnit: Number(spec.metersPerUnit),
  };
}
