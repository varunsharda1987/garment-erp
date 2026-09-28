/**
 * The buyer PO's colour/size split for a production order's SIZELESS items — what Link to Production
 * Order copies onto the order (the production order makes the PO exactly: owner decision 2026-09-24;
 * the buyer's +5 % allowance is cut via Extra % at cutting). Shared by the link and by
 * scripts/apply-sale-order-sizes.ts, which puts the split onto orders the link left sizeless.
 *
 * An item that already has sizes keeps them; a sale order line with no size is not a size and is
 * skipped. The result is applied through `applyOrderItemSizeBreakup` (order.controller.ts), which
 * settles each line's colour by the one colour rule (sku-colour.helper).
 */
import { OrderStatus, Prisma, PrismaClient } from '@prisma/client';
import { skuKey } from './sku-colour.helper';

export interface SaleOrderSizeLine {
  styleId: string;
  colorId: string | null;
  sizeId: string | null;
  quantity: number;
}

export interface SizelessOrderItem {
  id: string;
  styleId: string;
  sized: boolean;
}

export interface OrderItemSizeSplit {
  orderItemId: string;
  breakup: Array<{ colorId: string | null; sizeId: string; quantity: number }>;
}

export function saleOrderSizeSplit(
  soLines: SaleOrderSizeLine[],
  orderItems: SizelessOrderItem[]
): OrderItemSizeSplit[] {
  return orderItems
    .filter((item) => !item.sized)
    .map((item) => {
      const byKey = new Map<string, { colorId: string | null; sizeId: string; quantity: number }>();
      for (const line of soLines) {
        if (line.styleId !== item.styleId || !line.sizeId || line.quantity <= 0) continue;
        const key = skuKey(line.colorId, line.sizeId);
        const entry = byKey.get(key);
        if (entry) entry.quantity += line.quantity;
        else byKey.set(key, { colorId: line.colorId ?? null, sizeId: line.sizeId, quantity: line.quantity });
      }
      return { orderItemId: item.id, breakup: [...byKey.values()] };
    })
    .filter((split) => split.breakup.length > 0);
}

type Db = Prisma.TransactionClient | PrismaClient;

/** Order statuses a size split may still be put on (a finished, dispatched, split or cancelled order is history). */
const OPEN_ORDER = { notIn: ['CANCELLED', 'SPLIT', 'COMPLETED', 'DISPATCHED'] as OrderStatus[] };

export interface SizelessLinkedItem {
  orderId: string;
  orderNumber: string;
  saleOrderNumber: string;
  orderItemId: string;
  styleCode: string;
  orderQuantity: number;
  split: OrderItemSizeSplit['breakup'];
}

/**
 * Items of an open production order linked to a sale order that have NO sizes while the sale order
 * lists sizes for that style — the state Link to Production Order left six Easybuy orders in when it
 * refused a style with no colour (24-Sep). The invariant sweep (check-order-system-integrity D27) and
 * scripts/apply-sale-order-sizes.ts both read this; after the repair it must find nothing.
 */
export async function findSizelessLinkedItems(db: Db): Promise<SizelessLinkedItem[]> {
  const orders = await db.orders.findMany({
    where: {
      saleOrderId: { not: null },
      isActive: true,
      status: OPEN_ORDER,
      order_items: { some: { order_item_breakup: { none: {} } } },
    },
    select: {
      id: true,
      orderNumber: true,
      sale_orders: {
        select: {
          saleOrderNumber: true,
          items: { select: { styleId: true, colorId: true, sizeId: true, quantity: true } },
        },
      },
      order_items: {
        select: {
          id: true,
          styleId: true,
          totalQuantity: true,
          styles: { select: { styleCode: true } },
          _count: { select: { order_item_breakup: true } },
        },
      },
    },
    orderBy: { orderNumber: 'asc' },
  });

  const found: SizelessLinkedItem[] = [];
  for (const order of orders) {
    if (!order.sale_orders) continue;
    const splits = saleOrderSizeSplit(
      order.sale_orders.items,
      order.order_items.map((i) => ({ id: i.id, styleId: i.styleId, sized: i._count.order_item_breakup > 0 }))
    );
    for (const split of splits) {
      const item = order.order_items.find((i) => i.id === split.orderItemId)!;
      found.push({
        orderId: order.id,
        orderNumber: order.orderNumber,
        saleOrderNumber: order.sale_orders.saleOrderNumber,
        orderItemId: item.id,
        styleCode: item.styles.styleCode,
        orderQuantity: item.totalQuantity,
        split: split.breakup,
      });
    }
  }
  return found;
}
