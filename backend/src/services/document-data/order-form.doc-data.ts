/**
 * Order Form — data adapter for the kf order-form template.
 *
 * Source record is an `orders` row. This is the internal confirmation document:
 * it authorises production (BOM → MRP → procurement → cutting) for the styles
 * and quantities listed. It is NOT a tax document — it charges no GST and is
 * not an invoice; the tax charge arises on the tax invoice raised at despatch.
 *
 * Root query copies the include shape of document-generator.service's
 * getOrderWithDetails (the field authority), plus three additions that are all
 * real columns: the customer's payment_terms row, the approver, and each
 * style's own size_options — the last is the column axis for the size grid
 * when an order has no recorded breakup and the ratio must be filled by hand.
 */
import prisma from '../../config/database';
import { Prisma } from '@prisma/client';
import { NotFoundError } from '../../errors';
import { addCurrency, roundToCent, toCurrency } from '../../utils/currency';
import { formatStyleCodeWithRef } from '../../utils/style-ref-format';
import { buildCompanyBlock, CompanyBlock } from './company-block';
import { EM_DASH, fmtDate, fmtMoney, fmtQty } from './format';

const orderFormDocInclude = {
  customers: {
    include: {
      billingState: { select: { stateName: true, stateCode: true } },
      shippingState: { select: { stateName: true, stateCode: true } },
      payment_terms: { select: { termName: true, daysCount: true } },
    },
  },
  users_orders_approvedByIdTousers: { select: { firstName: true, lastName: true } },
  order_items: {
    include: {
      styles: {
        select: {
          id: true,
          styleCode: true,
          buyerStyleRef: true,
          styleName: true,
          hsnCode: true,
          size_options: {
            where: { isActive: true },
            select: { sizeName: true, sortOrder: true },
            orderBy: { sortOrder: 'asc' as const },
          },
        },
      },
      order_item_breakup: {
        include: {
          size_options: { select: { sizeName: true, sortOrder: true } },
          color_options: { select: { colorName: true, sortOrder: true } },
        },
      },
    },
    orderBy: { id: 'asc' as const },
  },
} satisfies Prisma.ordersInclude;

type OrderWithDetails = Prisma.ordersGetPayload<{ include: typeof orderFormDocInclude }>;
type OrderItem = OrderWithDetails['order_items'][number];

export interface OrderFormDocItem {
  sn: number;
  style: string; // "EBEW-001 (ESSKA241CK)"
  styleName: string;
  hsn: string;
  delivery: string;
  status: string;
  qty: string;
  rate: string;
  value: string;
}

export interface OrderFormGridRow {
  colour: string;
  cells: string[]; // one entry per size column
  total: string;
  open: boolean; // true → hatched, filled in by hand after printing
}

export interface OrderFormSizeGrid {
  style: string; // "EBEW-001 (ESSKA241CK)"
  styleName: string;
  sizes: string[];
  rows: OrderFormGridRow[];
  colTotals: string[]; // empty when the grid is hand-filled
  gridTotal: string; // order_items.totalQuantity — the figure the grid must add to
  handFill: boolean;
  /** colspans precomputed here — the shared Handlebars helper set has no arithmetic */
  spanAll: number; // colour + every size + total
  spanLabel: number; // colour + every size
}

export interface OrderFormDocData {
  company: CompanyBlock;
  docNo: string;
  docPill: string;
  statusBanner: string; // "PENDING · MEDIUM priority"
  // 01 — buyer & delivery
  buyerName: string;
  buyerLegalName: string | null; // customers.billingName when it differs from name
  buyerGstin: string; // "URP" when unregistered
  buyerState: string | null;
  buyerContact: string | null; // "phone · email"
  shipTo: string;
  orderDate: string;
  deliveryBy: string;
  payment: string;
  paymentClause: string; // reused inside the terms list
  approvedBy: string | null;
  // 02 — styles ordered
  items: OrderFormDocItem[];
  itemsBanner: string; // "1 style · 2,400 pcs"
  lineQtyTotal: string;
  lineValueTotal: string;
  orderQtyTotal: string; // orders.totalQuantity (header authority)
  orderValueTotal: string; // orders.totalAmount (header authority)
  // 03 — size & colour breakdown
  grids: OrderFormSizeGrid[];
  anyHandFill: boolean;
  // 04 — remarks & terms
  remarks: string | null;
}

/** Live customer rows carry empty strings ("") in billingName/gstNumber/address — treat blank as absent (strings only; never money). */
function nonBlank(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Colour × size grid for one order line.
 * Recorded breakup wins. With no breakup the ratio is still undecided, so the
 * grid is emitted hatched (`.open`) against the style's own size list for the
 * merchandiser to complete by hand — never as fabricated zeroes.
 * Returns null when there is no size axis at all to print against.
 */
function buildGrid(item: OrderItem): OrderFormSizeGrid | null {
  const style = item.styles;
  const label = style ? formatStyleCodeWithRef(style.styleCode, style.buyerStyleRef) : EM_DASH;
  const styleName = nonBlank(style?.styleName) ?? nonBlank(item.itemDescription) ?? EM_DASH;
  const breakup = item.order_item_breakup;

  if (breakup.length > 0) {
    // Size axis from the recorded rows, ordered by size_options.sortOrder
    const sizeOrder = new Map<string, number>();
    for (const b of breakup) sizeOrder.set(b.size_options.sizeName, b.size_options.sortOrder);
    const sizes = [...sizeOrder.entries()]
      .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
      .map(([name]) => name);

    // Group by colour (colorId is nullable — an unrecorded colour prints as an em-dash)
    const groups = new Map<string, { colour: string; sortOrder: number; sizes: Map<string, number> }>();
    for (const b of breakup) {
      const key = b.colorId ?? '__none__';
      let group = groups.get(key);
      if (!group) {
        group = {
          colour: nonBlank(b.color_options?.colorName) ?? EM_DASH,
          // an unrecorded colour sorts last, never above a named colourway
          sortOrder: b.color_options?.sortOrder ?? Number.MAX_SAFE_INTEGER,
          sizes: new Map(),
        };
        groups.set(key, group);
      }
      const sizeName = b.size_options.sizeName;
      group.sizes.set(sizeName, (group.sizes.get(sizeName) ?? 0) + b.quantity);
    }

    const colTotals = sizes.map(() => 0);
    const rows: OrderFormGridRow[] = [...groups.values()]
      .sort((a, b) => a.sortOrder - b.sortOrder || a.colour.localeCompare(b.colour))
      .map((group) => {
        let rowTotal = 0;
        const cells = sizes.map((size, idx) => {
          const qty = group.sizes.get(size);
          if (qty === undefined) return EM_DASH;
          rowTotal += qty;
          colTotals[idx] += qty;
          return fmtQty(qty, 'PCS');
        });
        return { colour: group.colour, cells, total: fmtQty(rowTotal, 'PCS'), open: false };
      });

    return {
      style: label,
      styleName,
      sizes,
      rows,
      colTotals: colTotals.map((t) => fmtQty(t, 'PCS')),
      gridTotal: fmtQty(item.totalQuantity, 'PCS'),
      handFill: false,
      spanAll: sizes.length + 2,
      spanLabel: sizes.length + 1,
    };
  }

  // No breakup recorded — hand-fill grid against the style's own active sizes
  const sizes = style?.size_options.map((s) => s.sizeName) ?? [];
  if (sizes.length === 0) return null;
  const blank = sizes.map(() => '');
  return {
    style: label,
    styleName,
    sizes,
    rows: [0, 1, 2].map(() => ({ colour: '', cells: [...blank], total: '', open: true })),
    colTotals: [],
    gridTotal: fmtQty(item.totalQuantity, 'PCS'),
    handFill: true,
    spanAll: sizes.length + 2,
    spanLabel: sizes.length + 1,
  };
}

export async function buildOrderFormDocData(orderId: string): Promise<OrderFormDocData> {
  const [company, order] = await Promise.all([
    buildCompanyBlock(),
    prisma.orders.findUnique({ where: { id: orderId }, include: orderFormDocInclude }),
  ]);
  if (!order) throw new NotFoundError('Order', orderId);

  const customer = order.customers;

  // ── 02 — lines & totals (all money through decimal.js) ───────────────────
  let valueSum = toCurrency(0);
  let qtySum = 0;

  const items: OrderFormDocItem[] = order.order_items.map((item, idx) => {
    const style = item.styles;
    valueSum = addCurrency(valueSum, Number(item.totalPrice));
    qtySum += item.totalQuantity;
    return {
      sn: idx + 1,
      style: style ? formatStyleCodeWithRef(style.styleCode, style.buyerStyleRef) : EM_DASH,
      styleName: nonBlank(style?.styleName) ?? nonBlank(item.itemDescription) ?? EM_DASH,
      hsn: style?.hsnCode ?? EM_DASH,
      delivery: item.deliveryDate ? fmtDate(item.deliveryDate) : fmtDate(order.expectedDeliveryDate),
      status: item.status,
      qty: fmtQty(item.totalQuantity, 'PCS'),
      rate: fmtMoney(Number(item.unitPrice)),
      value: fmtMoney(Number(item.totalPrice)),
    };
  });

  const grids = order.order_items.map((item) => buildGrid(item)).filter((g): g is OrderFormSizeGrid => g !== null);

  // ── 01 — buyer, delivery, payment ────────────────────────────────────────
  const legalName = nonBlank(customer.billingName);
  const contactBits = [nonBlank(customer.phone), nonBlank(customer.email)].filter((b): b is string => b !== null);
  const creditDays = customer.creditDays;
  const paymentTerms =
    nonBlank(order.paymentTerms) ??
    nonBlank(customer.payment_terms?.termName) ??
    (creditDays != null ? `Net ${creditDays} days` : null);
  const approver = order.users_orders_approvedByIdTousers;
  const styleWord = items.length === 1 ? 'style' : 'styles';

  return {
    company,
    docNo: order.orderNumber,
    docPill: 'Production authorisation · Not a tax document',
    statusBanner: `${order.status} · ${order.priority} priority`,
    buyerName: customer.name,
    buyerLegalName: legalName && legalName !== customer.name ? legalName : null,
    buyerGstin: nonBlank(customer.gstNumber) ?? 'URP',
    buyerState: customer.billingState
      ? `${customer.billingState.stateName} (${customer.billingState.stateCode})`
      : null,
    buyerContact: contactBits.length > 0 ? contactBits.join(' · ') : null,
    shipTo: nonBlank(order.shippingAddress) ?? nonBlank(customer.shippingAddress) ?? 'Same as billing',
    orderDate: fmtDate(order.orderDate),
    deliveryBy: fmtDate(order.expectedDeliveryDate),
    payment: paymentTerms ?? EM_DASH,
    paymentClause: paymentTerms ?? 'as agreed in writing',
    approvedBy: approver ? `${approver.firstName} ${approver.lastName}`.trim() : null,
    items,
    itemsBanner: `${items.length} ${styleWord} · ${fmtQty(order.totalQuantity, 'PCS')} pcs`,
    lineQtyTotal: fmtQty(qtySum, 'PCS'),
    lineValueTotal: fmtMoney(roundToCent(valueSum).toNumber()),
    orderQtyTotal: fmtQty(order.totalQuantity, 'PCS'),
    orderValueTotal: fmtMoney(Number(order.totalAmount)),
    grids,
    anyHandFill: grids.some((g) => g.handFill),
    remarks: nonBlank(order.remarks),
  };
}
