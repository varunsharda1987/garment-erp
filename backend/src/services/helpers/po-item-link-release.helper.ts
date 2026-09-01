/**
 * Releasing the demand behind purchase-order items.
 *
 * Four tables point at `purchase_order_items`, and ALL FOUR are `onDelete: Cascade`:
 *   requirement_po_links, service_requirement_po_links, po_source_links, grn_items
 * plus `order_thread_requirements.poItemId`, which is SET NULL.
 *
 * That cascade is the trap. Deleting a PO item makes the LINK disappear while the demand row it
 * pointed at keeps its "already ordered" status — PO_GENERATED for a material requirement,
 * PO_GENERATED/IN_PROGRESS for a service requirement, PO_GENERATED for a thread requirement. A
 * requirement in that state is invisible to every re-order path: PO generation only accepts
 * PO_REQUIRED/PARTIAL_STOCK, the duplicate guard skips anything already ordered, the recalc
 * supersede pass excludes PO_GENERATED, and `scripts/recompute-requirement-statuses.ts` explicitly
 * declines to touch "no links but has PO status". The material is then simply never bought, and
 * nothing anywhere says so.
 *
 * So: whenever PO items go away, the demand behind them must be handed back in the SAME
 * transaction. This helper is that single implementation — `updatePurchaseOrder` (items removed by
 * an edit) and `deletePurchaseOrder` (every item) both call it.
 *
 * It deliberately does NOT carry a partial receipt forward the way PO cancellation does. It is only
 * ever called for items that have received nothing — it refuses outright otherwise, because a
 * received line must not be edited away at all.
 */

import { Prisma, MaterialRequirementStatus } from '@prisma/client';
import { BusinessError } from '../../errors';
import { logWarn } from '../../utils/logger';

/** Statuses that mean "this demand is already on a PO" and must be handed back. */
const MATERIAL_ORDERED_STATUSES: MaterialRequirementStatus[] = [
  MaterialRequirementStatus.PO_GENERATED,
  MaterialRequirementStatus.PO_SENT,
  MaterialRequirementStatus.PARTIALLY_RECEIVED,
];

export interface ReleasedLinkSummary {
  materialRequirements: number;
  serviceRequirements: number;
  threadRequirements: number;
}

/**
 * Hand back the demand behind the given PO items, then drop their links.
 *
 * @param tx     MUST be a transaction client — the revert and the item delete have to commit together.
 * @param itemIds PO item ids about to be deleted (or replaced). An empty array is a no-op.
 * @param poNumber For the log line only.
 * @throws BusinessError if any of the items has already received goods.
 */
export async function releasePurchaseOrderItemLinks(
  tx: Prisma.TransactionClient,
  itemIds: string[],
  poNumber: string
): Promise<ReleasedLinkSummary> {
  const summary: ReleasedLinkSummary = {
    materialRequirements: 0,
    serviceRequirements: 0,
    threadRequirements: 0,
  };

  if (itemIds.length === 0) return summary;

  // ---- Material requirements -------------------------------------------------------------
  const materialLinks = await tx.requirement_po_links.findMany({
    where: { purchaseOrderItemId: { in: itemIds } },
    select: { requirementId: true, receivedQuantity: true },
  });

  const received = materialLinks.filter((l) => Number(l.receivedQuantity) > 0);
  if (received.length > 0) {
    // Reverting a link that already delivered would erase a real receipt from the plan. The caller
    // must not be removing this line at all.
    throw new BusinessError(
      `Cannot change or remove purchase order lines on ${poNumber} that have already received goods ` +
        `(${received.length} line(s) affected). Reverse the receipt first, or close the order short.`
    );
  }

  if (materialLinks.length > 0) {
    const requirementIds = [...new Set(materialLinks.map((l) => l.requirementId))];
    const reverted = await tx.material_requirements.updateMany({
      where: { id: { in: requirementIds }, status: { in: MATERIAL_ORDERED_STATUSES } },
      data: { status: MaterialRequirementStatus.PO_REQUIRED },
    });
    summary.materialRequirements = reverted.count;
    if (reverted.count !== requirementIds.length) {
      // Never fatal — a requirement already CANCELLED or RECEIVED by another path is legitimately
      // skipped — but it must be visible, because updateMany's count is otherwise indistinguishable
      // from success and that blindness is exactly how the PO-cancel bug survived.
      logWarn(
        `[PO ${poNumber}] released ${reverted.count} of ${requirementIds.length} material requirement(s); ` +
          `the rest were in a status that is not re-orderable and may need manual re-planning`
      );
    }

    // The link rows must go too, not just the status: MRP's duplicate guard skips any requirement
    // that still holds a link, so a reverted requirement with a stale link is still unbuyable.
    await tx.requirement_po_links.deleteMany({ where: { purchaseOrderItemId: { in: itemIds } } });
  }

  // ---- Service requirements --------------------------------------------------------------
  const serviceLinks = await tx.service_requirement_po_links.findMany({
    where: { purchaseOrderItemId: { in: itemIds } },
    select: { serviceRequirementId: true },
  });
  if (serviceLinks.length > 0) {
    const serviceIds = [...new Set(serviceLinks.map((l) => l.serviceRequirementId))];
    const revertedServices = await tx.work_order_service_requirements.updateMany({
      where: { id: { in: serviceIds }, status: { in: ['PO_GENERATED', 'IN_PROGRESS'] } },
      data: { status: 'PENDING', purchaseOrderId: null },
    });
    summary.serviceRequirements = revertedServices.count;
    if (revertedServices.count !== serviceIds.length) {
      logWarn(
        `[PO ${poNumber}] released ${revertedServices.count} of ${serviceIds.length} service requirement(s); ` +
          `the rest were in an unexpected status and may need manual re-planning`
      );
    }
    await tx.service_requirement_po_links.deleteMany({ where: { purchaseOrderItemId: { in: itemIds } } });
  }

  // ---- Thread requirements ---------------------------------------------------------------
  // poItemId is SET NULL by the FK, but the STATUS is what makes the row re-orderable, and nothing
  // resets it. Clear both explicitly so this works for an in-place replace as well as a delete.
  const revertedThreads = await tx.order_thread_requirements.updateMany({
    where: { poItemId: { in: itemIds }, status: { in: ['PO_GENERATED', 'PARTIALLY_RECEIVED'] } },
    data: { status: 'PENDING', poItemId: null, supplierId: null },
  });
  summary.threadRequirements = revertedThreads.count;

  // po_source_links carry no status of their own — they are pure provenance and cascade away with
  // the item, which is correct. Nothing to hand back there.

  if (summary.materialRequirements || summary.serviceRequirements || summary.threadRequirements) {
    logWarn(
      `[PO ${poNumber}] returned demand to the plan: ${summary.materialRequirements} material, ` +
        `${summary.serviceRequirements} service, ${summary.threadRequirements} thread requirement(s)`
    );
  }

  return summary;
}
