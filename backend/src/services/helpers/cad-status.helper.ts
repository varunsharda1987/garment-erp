/**
 * CAD status helper — the single authority for styles.cadStatus.
 *
 * styles.cadStatus is a DERIVED summary of the style's fabric_width_cad rows since the
 * 2026-08-24 fix (data-ownership landmine №3): before it, style-level and row-level
 * approval were written by different flows and drifted — ~40 styles were stamped
 * APPROVED with zero approved rows, and the cost-sheet gate accepted the stamp as a
 * bypass of the row-level "geometry + price" checks (recreating ₹0-rate cost sheets).
 *
 * Derivation rule (per style, across BOTH row→style linkages):
 *   APPROVED     — at least one CAD row has approvalStatus 'APPROVED'
 *   IN_PROGRESS  — rows exist but none is approved
 *   PENDING      — no CAD rows at all
 *
 * Call recomputeStyleCadStatus after EVERY row mutation that can change the answer
 * (approve, reject, delete, create, version). Never write styles.cadStatus directly.
 * Legacy row-less styles keep their historical stamp simply because no row mutation
 * ever fires for them — the cost-sheet bypass is closed separately, so the stamp can
 * no longer skip any gate that matters.
 */

import { Prisma, PrismaClient, CADStatus } from '@prisma/client';
import { deleteFromCache, cacheKeys } from '../../lib/cache';
import { logInfo } from '../../utils/logger';

type DbClient = Prisma.TransactionClient | PrismaClient;

/** Where-fragment matching every CAD row belonging to a style (both linkages). */
export function cadRowsOfStyle(styleId: string): Prisma.fabric_width_cadWhereInput {
  return {
    OR: [{ costingStyleId: styleId }, { styleFabric: { style_components: { styleId } } }],
  };
}

/** Pure derivation — exported for tests and the backfill script. */
export function deriveCadStatus(totalRows: number, approvedRows: number): CADStatus {
  if (totalRows === 0) return 'PENDING';
  return approvedRows > 0 ? 'APPROVED' : 'IN_PROGRESS';
}

/**
 * Recompute and persist styles.cadStatus from the style's rows. Returns the derived
 * status. Pass the caller's tx so the recompute commits atomically with the row change.
 */
export async function recomputeStyleCadStatus(client: DbClient, styleId: string): Promise<CADStatus> {
  const where = cadRowsOfStyle(styleId);
  const [totalRows, approvedRows] = await Promise.all([
    client.fabric_width_cad.count({ where }),
    client.fabric_width_cad.count({ where: { ...where, approvalStatus: 'APPROVED' } }),
  ]);
  const derived = deriveCadStatus(totalRows, approvedRows);

  const style = await client.styles.findUnique({ where: { id: styleId }, select: { cadStatus: true } });
  if (!style) return derived; // style deleted mid-flight — nothing to stamp

  if (style.cadStatus !== derived) {
    await client.styles.update({
      where: { id: styleId },
      data: {
        cadStatus: derived,
        approvedCadDate: derived === 'APPROVED' ? new Date() : null,
      },
    });
    logInfo(
      `[CADStatus] Style ${styleId} cadStatus ${style.cadStatus} -> ${derived} (rows ${approvedRows}/${totalRows})`
    );
    // The CAD Planning tab counts are cached — bust them so the tabs match the list
    await deleteFromCache(cacheKeys.cad.statusCounts);
  }
  return derived;
}
