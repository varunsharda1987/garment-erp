/**
 * Goods-in-transit challans (2026-09-29) — the endpoints' service layer. The writing is done by the one writer,
 * helpers/direct-supply-challan.helper.ts; this file opens the transactions and records the audit trail.
 */
import prisma from '../config/database';
import { createAuditLog } from './audit.service';
import {
  cancelTransitChallanInTx,
  createTransitChallanInTx,
  listTransitChallans,
  transitUnitOf,
  type TransitChallanInput,
} from './helpers/direct-supply-challan.helper';
import { transitStateOf } from './helpers/transit-challan-state';

export async function issueTransitChallan(input: TransitChallanInput) {
  const challan = await prisma.$transaction((tx) => createTransitChallanInTx(tx, input), {
    timeout: 15000,
    maxWait: 5000,
  });
  await createAuditLog({
    userId: input.userId,
    action: 'CREATE',
    entityType: 'challans',
    entityId: challan.id,
    newValues: {
      event: 'TRANSIT_CHALLAN_ISSUED',
      challanNumber: challan.challanNumber,
      poId: input.poId,
      dispatchedOn: input.dispatchedOn,
    },
  });
  return challan;
}

export async function cancelTransitChallan(challanId: string, userId: string, reason: string) {
  const result = await prisma.$transaction((tx) => cancelTransitChallanInTx(tx, challanId, reason));
  await createAuditLog({
    userId,
    action: 'UPDATE',
    entityType: 'challans',
    entityId: challanId,
    newValues: { event: 'TRANSIT_CHALLAN_CANCELLED', challanNumber: result.challanNumber, reason },
  });
  return result;
}

/** A PO's transit challans, each with its state and the place it is headed (for the PO card and the receipt form) */
export async function getTransitChallans(poId: string) {
  const [po, challans] = await Promise.all([
    prisma.purchase_orders.findUnique({ where: { id: poId }, select: { deliveryLocationId: true } }),
    listTransitChallans(prisma, poId),
  ]);
  return challans.map((c) => ({
    ...c,
    transitState: transitStateOf(c),
    warehouseId: po ? transitUnitOf(c, po) : null,
  }));
}
