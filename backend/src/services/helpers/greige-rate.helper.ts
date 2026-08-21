/**
 * Keeps `greige_master.lastPurchaseRate` / `lastPurchaseAt` in step with the newest greige receipt.
 *
 * Why a separate column instead of writing `costPerMeter`:
 * `costPerMeter` is the hand-set planning rate AND what the Purchase Order form pre-fills a greige
 * line with. Letting receipts write it would close a loop — master rate seeds the PO price, the PO
 * price becomes the GRN price, the GRN price rewrites the master rate — in which one unrepresentative
 * receipt silently becomes the default for every future PO, re-confirming itself each cycle.
 *
 * Call ONLY from a genuine purchase receipt. Warehouse transfers carry a copied valuation rate and
 * stock adjustments carry no rate at all; both would corrupt the figure. That is also why this is
 * not wired into greigeStockService.createGreigeStock, which all of those paths share.
 */

import { Prisma } from '@prisma/client';
import { logInfo } from '../../utils/logger';

interface UpdateLastPurchaseRateArgs {
  greigeId: string;
  /** The purchase rate per metre. Values <= 0 are ignored — see below. */
  rate: number;
  purchasedAt: Date;
  /** For the log line, e.g. a GRN number. */
  sourceRef?: string;
}

export async function updateGreigeLastPurchaseRate(
  tx: Prisma.TransactionClient,
  { greigeId, rate, purchasedAt, sourceRef }: UpdateLastPurchaseRateArgs
): Promise<void> {
  // A GRN item with no linked PO line yields a rate of 0 (grn.service.ts). Writing that would
  // erase a good figure with no audit trail, and every reader treats 0 as "no rate" anyway.
  if (!(rate > 0)) return;

  await tx.greige_master.update({
    where: { id: greigeId },
    data: {
      lastPurchaseRate: new Prisma.Decimal(rate),
      lastPurchaseAt: purchasedAt,
    },
  });

  logInfo(`Greige last-purchase rate updated: ${greigeId} = ${rate}/m${sourceRef ? ` (${sourceRef})` : ''}`);
}
