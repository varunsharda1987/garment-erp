/**
 * Who a PO is bought FOR — the "For: Easybuy" on the PO page, the PO list and the printed PO.
 *
 * PO2609-0231 bought Easybuy's size labels and nothing on it said Easybuy (2026-09-28). In order:
 *  1. ORDER — the order it buys for: its own `orderId` (a manual PO's link), else the orders its requirement
 *     links buy for (an MRP PO never sets `orderId` — the two homes the PO list's order filter reads).
 *     Orders of more than one buyer → nobody.
 *  2. STYLE — its own `styleId`'s customer.
 *  3. LINES — every line that names a buyer (a label / packaging master's customer, material-detail.helper)
 *     names the SAME one, compared by id. Mixed, or none → nobody: never a guess.
 *
 * Batch first: one query per source for a whole page of POs.
 */

import type { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { loadMaterialBuyers, type MaterialDetailInput } from './material-detail.helper';

export type PoForBuyerSource = 'ORDER' | 'STYLE' | 'LINES';

export interface PoForBuyer {
  name: string;
  source: PoForBuyerSource;
  /** The order it is for, when that is the source and it is ONE order */
  orderNumber: string | null;
  /** The style it is for, when that is the source */
  styleCode: string | null;
}

/** What the resolver reads from a PO — its links, and each line's material read with MATERIAL_DETAIL_SELECT */
export interface PoForBuyerInput {
  id: string;
  orderId: string | null;
  styleId: string | null;
  purchase_order_items: ReadonlyArray<{ materials: MaterialDetailInput | null }>;
}

type Db = Prisma.TransactionClient | typeof prisma;

/** Each PO's buyer, in the order given (null = nothing honest to say) */
export async function resolvePoForBuyers(
  pos: ReadonlyArray<PoForBuyerInput>,
  tx?: Prisma.TransactionClient
): Promise<Array<PoForBuyer | null>> {
  const db: Db = tx ?? prisma;
  const out: Array<PoForBuyer | null | undefined> = pos.map(() => undefined); // undefined = not decided yet

  // 1. ORDER — own link, else the requirement links' orders
  const linked = pos.filter((po) => !po.orderId).map((po) => po.id);
  const links = linked.length
    ? await db.requirement_po_links.findMany({
        where: { purchaseOrderId: { in: linked }, material_requirements: { orderId: { not: null } } },
        select: { purchaseOrderId: true, material_requirements: { select: { orderId: true } } },
      })
    : [];
  const orderIdsOf = pos.map((po) => {
    if (po.orderId) return [po.orderId];
    const ids = links
      .filter((l) => l.purchaseOrderId === po.id)
      .map((l) => l.material_requirements.orderId)
      .filter((id): id is string => !!id);
    return [...new Set(ids)];
  });
  const allOrderIds = [...new Set(orderIdsOf.flat())];
  const orders = allOrderIds.length
    ? await db.orders.findMany({
        where: { id: { in: allOrderIds } },
        select: { id: true, orderNumber: true, customerId: true, customers: { select: { name: true } } },
      })
    : [];
  const orderById = new Map(orders.map((o) => [o.id, o]));
  orderIdsOf.forEach((ids, i) => {
    const found = ids.map((id) => orderById.get(id)).filter((o): o is (typeof orders)[number] => !!o);
    if (found.length === 0) return;
    const buyers = new Set(found.map((o) => o.customerId));
    out[i] =
      buyers.size === 1
        ? {
            name: found[0].customers.name,
            source: 'ORDER',
            orderNumber: found.length === 1 ? found[0].orderNumber : null,
            styleCode: null,
          }
        : null; // bought for several buyers' orders
  });

  // 2. STYLE
  const styleIds = [
    ...new Set(pos.filter((po, i) => out[i] === undefined && po.styleId).map((po) => po.styleId as string)),
  ];
  const styles = styleIds.length
    ? await db.styles.findMany({
        where: { id: { in: styleIds } },
        select: { id: true, styleCode: true, customer: { select: { name: true } } },
      })
    : [];
  const styleById = new Map(styles.map((s) => [s.id, s]));
  pos.forEach((po, i) => {
    const style = out[i] === undefined && po.styleId ? styleById.get(po.styleId) : undefined;
    if (style?.customer) {
      out[i] = { name: style.customer.name, source: 'STYLE', orderNumber: null, styleCode: style.styleCode };
    }
  });

  // 3. LINES — one buyer lookup for every undecided PO's lines
  const undecided = pos.map((po, i) => (out[i] === undefined ? po : null));
  const lineMaterials = undecided.flatMap((po) =>
    po ? po.purchase_order_items.map((item) => item.materials).filter((m): m is MaterialDetailInput => !!m) : []
  );
  const buyers = lineMaterials.length ? await loadMaterialBuyers(lineMaterials, tx) : [];
  let cursor = 0;
  undecided.forEach((po, i) => {
    if (!po) return;
    const count = po.purchase_order_items.filter((item) => item.materials).length;
    const named = buyers.slice(cursor, cursor + count).filter((b): b is NonNullable<typeof b> => !!b);
    cursor += count;
    const ids = new Set(named.map((b) => b.id));
    out[i] = ids.size === 1 ? { name: named[0].name, source: 'LINES', orderNumber: null, styleCode: null } : null;
  });

  return out.map((r) => r ?? null);
}

/** One PO's buyer — see resolvePoForBuyers */
export async function resolvePoForBuyer(
  po: PoForBuyerInput,
  tx?: Prisma.TransactionClient
): Promise<PoForBuyer | null> {
  return (await resolvePoForBuyers([po], tx))[0];
}

/** "Easybuy", "Easybuy · Order SO2609-0012", "Easybuy · Style ESSKY082LS" — the printed PO's "For" row */
export function poForBuyerLine(forBuyer: PoForBuyer | null): string | null {
  if (!forBuyer) return null;
  if (forBuyer.source === 'ORDER' && forBuyer.orderNumber) return `${forBuyer.name} · Order ${forBuyer.orderNumber}`;
  if (forBuyer.source === 'STYLE' && forBuyer.styleCode) return `${forBuyer.name} · Style ${forBuyer.styleCode}`;
  return forBuyer.name;
}
