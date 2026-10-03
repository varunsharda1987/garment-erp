/**
 * Goods held for an order never leave on a path that does not ask (2026-10-03).
 *
 * Issue screens (challan, job-work issue, work-order trim issue) already refuse goods held for OTHER orders with
 * `heldStockConflict` and take them only when the user confirms (po-allocation D10). The generic stock paths did
 * not ask at all: a Stock-Out or a stock adjustment drew lots oldest first and could empty a lot another order's
 * goods were held on (live: GRG-0038 holds 10,736 m for two requirements), leaving the hold on nothing and the
 * order's need never reopened. This is the one check those paths share.
 *
 *   ask (default)  goods held for other orders are refused with STOCK_HELD_FOR_ORDER (409) unless `takeHeld`;
 *                  taken goods reopen the loser's need (`takeHeldGoods`).
 *   take           taken without asking — the goods are physically gone (stock-count variance).
 *   refuse         never taken — goods held for an order are not moved (transfer); free stock only.
 *
 * Lot materials (greige, fabric, lace) are checked on the lots the stock-out may draw; trims on their lot-less
 * holds. The draw itself takes free stock first (`drawPlan`, stock-routing.helper). Thread is not checked:
 * thread consumption is not designed yet (owner).
 */
import { Prisma } from '@prisma/client';
import { BusinessError } from '../../errors';
import { qtyExceeds } from '../../utils/quantity';
import { unitShort } from '../../utils/units';
import { getDerivedOnHandMap } from './derived-stock.helper';
import { untrackedHeldByMaterial } from './stock-reservation.helper';
import { heldForOtherOrders, heldStockConflict, takeHeldGoods } from './po-allocation.helper';

type Tx = Prisma.TransactionClient;

export interface HeldGate {
  mode?: 'ask' | 'take' | 'refuse';
  /** The user confirmed "take them anyway" (mode ask) */
  takeHeld?: boolean;
  /** The order the goods go to — its own holds are never "other orders'" */
  takerOrderId?: string | null;
  userId: string;
  /** Where the goods went, for the record: "Stock-Out", "Adjustment (Damaged)" */
  reference: string;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Check (and, when allowed, take) what a stock-out of `quantity` of a material in a warehouse needs of goods
 * held for other orders. Call inside the stock-out's transaction, BEFORE the lots are drawn. Returns how much of
 * other orders' holds was taken.
 */
export async function gateHeldStockOut(
  tx: Tx,
  args: { materialId: string; warehouseId?: string | null; quantity: number; unit?: string | null; gate: HeldGate }
): Promise<number> {
  const { materialId, quantity, gate } = args;
  const mode = gate.mode ?? 'ask';
  const material = await tx.materials.findUnique({
    where: { id: materialId },
    select: { name: true, greigeId: true, fabricId: true, laceId: true, threadId: true },
  });
  if (!material || material.threadId) return 0;

  let lotIds: string[] | undefined;
  let short: number;
  const inWarehouse = args.warehouseId ? { warehouseId: args.warehouseId } : {};
  if (material.greigeId || material.fabricId || material.laceId) {
    const lots = material.greigeId
      ? await tx.greige_stock.findMany({
          where: { greigeId: material.greigeId, quantityAvailable: { gt: 0 }, ...inWarehouse },
          select: { id: true, quantityAvailable: true },
        })
      : material.fabricId
        ? await tx.fabric_stock.findMany({
            where: { fabricId: material.fabricId, quantityAvailable: { gt: 0 }, ...inWarehouse },
            select: { id: true, quantityAvailable: true },
          })
        : await tx.lace_stock.findMany({
            where: { laceId: material.laceId!, quantityAvailable: { gt: 0 }, ...inWarehouse },
            select: { id: true, quantityAvailable: true },
          });
    if (lots.length === 0) return 0;
    lotIds = lots.map((l) => l.id);
    const onLots = lots.reduce((sum, l) => sum + Number(l.quantityAvailable), 0);
    if (qtyExceeds(quantity, onLots)) return 0; // more than is there at all: the stock-out's own refusal
    const held = await heldForOtherOrders(tx, { materialId, lotIds, excludeOrderId: gate.takerOrderId });
    short = round3(quantity - (onLots - held.reduce((sum, h) => sum + h.qty, 0)));
  } else {
    const onHand = (await getDerivedOnHandMap([materialId], tx)).get(materialId) ?? 0;
    if (qtyExceeds(quantity, onHand)) return 0;
    const othersHeld =
      (await untrackedHeldByMaterial(tx, [materialId], { excludeOrderId: gate.takerOrderId ?? undefined })).get(
        materialId
      ) ?? 0;
    short = round3(quantity - (onHand - othersHeld));
  }
  if (!qtyExceeds(short, 0)) return 0;

  const unit = unitShort(args.unit ?? undefined);
  if (mode === 'refuse') {
    throw new BusinessError(
      `${short} ${unit} of ${material.name} is held for orders and cannot be moved. Move only the free stock, ` +
        `or release the hold first.`,
      { code: 'STOCK_HELD_NOT_MOVABLE', short }
    );
  }
  if (mode === 'ask' && !gate.takeHeld) {
    throw heldStockConflict(
      `${short} ${unit} of ${material.name} is held for other orders. Take it anyway, or take out less.`,
      await heldForOtherOrders(tx, { materialId, lotIds, excludeOrderId: gate.takerOrderId })
    );
  }
  const result = await takeHeldGoods(tx, {
    materialId,
    lotIds,
    quantity: short,
    takerOrderId: gate.takerOrderId ?? null,
    userId: gate.userId,
    reference: gate.reference,
  });
  return result.taken;
}
