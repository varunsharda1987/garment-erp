/**
 * Shadow-PO echo helper — the single writer for process-module echoes onto paired
 * purchase orders (data-ownership landmine №7, fixed 2026-08-24).
 *
 * Legacy dyeing/printing jobs carry a paired purchase_orders row (the "shadow PO") whose
 * status mirrors the job. The echoes used to be raw unconditional updates from six sites
 * in dyeing/printing controllers — an echo could resurrect a CANCELLED PO to SENT or
 * RECEIVED, and the JWO cancel flow forgot the echo entirely, leaving a live-looking PO
 * for a dead job that a GRN could still be booked against (double procurement: MRP
 * re-orders while the PO claims received).
 *
 * One guarded writer now: the target status is only applied from the states it may
 * legally follow (transition rules mirror utils/stateMachine.ts TRANSITIONS.purchaseOrder)
 * — a terminal PO is never resurrected, a receipt is never silently erased. Returns true
 * when the echo landed, false when it was skipped (missing PO or ineligible state).
 */

import { Prisma, PrismaClient, PurchaseOrderStatus } from '@prisma/client';
import { logInfo } from '../../utils/logger';

type DbClient = Prisma.TransactionClient | PrismaClient;

export type ShadowPoEcho = 'SENT' | 'RECEIVED' | 'CANCELLED';

const ALLOWED_FROM: Record<ShadowPoEcho, PurchaseOrderStatus[]> = {
  // Issue to processor: only a not-yet-sent PO moves to SENT
  SENT: ['DRAFT', 'PENDING_GREIGE', 'READY_FOR_PROCESSING'],
  // Receipt: only a live in-flight PO (DRAFT included — legacy pairs whose send echo
  // never fired still record the physical receipt)
  RECEIVED: ['DRAFT', 'SENT', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED', 'READY_FOR_PROCESSING'],
  // Cancel/return-unprocessed: anything that has not received material. A
  // PARTIALLY_RECEIVED shadow PO is deliberately left alone — received goods must not
  // vanish behind a CANCELLED label; that conflict needs a human.
  CANCELLED: ['DRAFT', 'SENT', 'ACKNOWLEDGED', 'PENDING_GREIGE', 'READY_FOR_PROCESSING'],
};

export async function echoShadowPoStatus(
  client: DbClient,
  purchaseOrderId: string | null | undefined,
  target: ShadowPoEcho,
  opts?: { appendRemarks?: string }
): Promise<boolean> {
  if (!purchaseOrderId) return false;

  const po = await client.purchase_orders.findUnique({
    where: { id: purchaseOrderId },
    select: { status: true, remarks: true, poNumber: true },
  });
  if (!po) return false;

  if (!ALLOWED_FROM[target].includes(po.status)) {
    logInfo(`[ShadowPO] Skipped echo ${po.poNumber}: ${po.status} may not become ${target}`);
    return false;
  }

  const data: Prisma.purchase_ordersUpdateManyMutationInput = { status: target };
  if (opts?.appendRemarks) {
    // Append, never overwrite — the old dyeing cancel echo destroyed prior remarks
    data.remarks = `${po.remarks || ''}\n${opts.appendRemarks}`.trim();
  }

  // Guarded write: the state precondition is re-checked in the WHERE (concurrency-safe)
  const result = await client.purchase_orders.updateMany({
    where: { id: purchaseOrderId, status: { in: ALLOWED_FROM[target] } },
    data,
  });
  if (result.count > 0) {
    logInfo(`[ShadowPO] ${po.poNumber} status ${po.status} -> ${target}`);
  }
  return result.count > 0;
}
