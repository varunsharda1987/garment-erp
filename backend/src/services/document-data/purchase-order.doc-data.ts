/**
 * Purchase Order (goods purchase) — data adapter for the kf purchase-order
 * template. One root Prisma query. POs are material-only after the Job Work
 * Consolidation: legacy PROCESSING shadow POs are blocked from printing here
 * (they print as Job Work Orders instead).
 *
 * Tax column switch: any line-level IGST → single IGST column (interstate);
 * otherwise CGST + SGST columns.
 */
import prisma from '../../config/database';
import { Prisma } from '@prisma/client';
import { BusinessError, NotFoundError } from '../../errors';
import { addCurrency, roundToCent, toCurrency } from '../../utils/currency';
import { buildCompanyBlock, CompanyBlock } from './company-block';
import { EM_DASH, fmtDate, fmtMoney, fmtPct, fmtQty, gstinState, inrWords } from './format';
import { unitHeader } from '../../utils/units';
import { resolvePoDeliverTo } from './po-deliver-to';
import { JOB_WORK_SHIP_TO_NOTE, loadPoShipToPlan, ONE_INVOICE_PER_DELIVERY, PoShipTo } from './po-ship-to';
import { LABEL_LINE_MATERIAL_SELECT, labelLineKeyOf, PO_LINE_ORDER } from '../helpers/label-line.helper';
import { groupLabelLines, sumRows } from '../../utils/label-lines';

const poDocInclude = {
  suppliers: {
    include: {
      billing_city: { select: { cityName: true } },
      billing_state: { select: { stateName: true } },
      gst_numbers: { where: { isPrimary: true }, select: { gstNumber: true }, take: 1 },
    },
  },
  deliveryWarehouse: {
    select: { warehouseName: true, warehouseType: true, address: true, city: true, pincode: true },
  },
  purchase_order_items: {
    orderBy: PO_LINE_ORDER,
    include: {
      // + which label and size a line is: a label's sizes print under one heading (utils/label-lines)
      materials: { select: { name: true, code: true, hsnCode: true, ...LABEL_LINE_MATERIAL_SELECT } },
      weaver: { select: { name: true } }, // Phase 1b: printed under the line when known
    },
  },
} satisfies Prisma.purchase_ordersInclude;

type PoWithDetails = Prisma.purchase_ordersGetPayload<{ include: typeof poDocInclude }>;
type PoItem = PoWithDetails['purchase_order_items'][number];

export interface PurchaseOrderDocItem {
  /** Serial number; null on a label's size rows (the label's heading row carries it) */
  sn: number | null;
  /** A label's heading row: its sizes follow as `isSize` rows; figures are the sizes' totals */
  isGroup?: boolean;
  /** One size of the label above */
  isSize?: boolean;
  name: string;
  code: string | null; // muted material code next to the name
  weaver: string | null; // "Weaver: …" under the line, when the PO names one
  hsn: string;
  uom: string;
  qty: string;
  rate: string;
  taxable: string;
  gstPct: string;
  igst: string;
  cgst: string;
  sgst: string;
}

export interface PurchaseOrderDocData {
  company: CompanyBlock;
  docNo: string;
  docPill: string;
  isIgst: boolean;
  taxRegimeLabel: string; // sec-h right label: "Interstate — IGST applies" | "Intra-state — CGST + SGST"
  // 01 — supplier & delivery
  supplierName: string;
  supplierAddress: string | null;
  supplierGstin: string | null;
  supplierStateLabel: string | null; // "Punjab (03)"
  supplierContact: string | null;
  poDate: string;
  requiredBy: string;
  deliverTo: string;
  deliveryPlaceName: string; // short name used inside term 2
  payment: string;
  paymentClause: string; // used inside term 4 ("30 days from GRN" | "as agreed")
  // 02 — items
  items: PurchaseOrderDocItem[];
  subtotal: string;
  igstTotal: string;
  cgstTotal: string;
  sgstTotal: string;
  grandTotal: string;
  amountWords: string;
  // 03 — delivery points (split delivery, or a processor's unit): bill to us, ship to each place
  showDeliveryPoints: boolean;
  isSplit: boolean;
  shipTos: PoShipTo[];
  jobWorkNote: string;
  oneInvoiceNote: string;
  termsSectionNo: string; // "03", or "04" when the delivery points take 03
  deliveryTerm: string; // term 2
  /** "Amendment 2 · 26-Sep-2026 — supersedes earlier copies", or null for the original. */
  amendmentLine: string | null;
}

function itemName(item: PoItem): string {
  return item.materials?.name ?? item.serviceDescription ?? item.remarks ?? EM_DASH;
}

export async function buildPurchaseOrderDocData(poId: string): Promise<PurchaseOrderDocData> {
  const [company, po] = await Promise.all([
    buildCompanyBlock(),
    prisma.purchase_orders.findUnique({ where: { id: poId }, include: poDocInclude }),
  ]);
  if (!po) throw new NotFoundError('Purchase order', poId);

  // POs are material-only; legacy PROCESSING shadow POs print as JWOs.
  if (po.poCategory === 'PROCESSING') {
    throw new BusinessError('This is a legacy processing order — print the Job Work Order instead');
  }

  // ── 01 — supplier block ──────────────────────────────────────────────────
  const s = po.suppliers;
  const addressBits = [s.address, s.billing_city?.cityName, s.billingPincode]
    .map((b) => (b ?? '').trim())
    .filter((b) => b.length > 0);
  const contactBits = [s.contactPerson?.trim(), s.phone?.trim()].filter((b): b is string => !!b && b.length > 0);
  const gstin = s.gst_numbers[0]?.gstNumber ?? null;
  const stateCode = gstinState(gstin);
  const stateName = s.billing_state?.stateName ?? null;
  const supplierStateLabel = stateName
    ? `${stateName}${stateCode ? ` (${stateCode})` : ''}`
    : stateCode
      ? `(${stateCode})`
      : null;

  // Deliver To — the place, "to be advised" when none is set, our Company Profile address for an
  // own store that has none of its own (po-deliver-to.ts). A split lists every place in 03.
  const deliver = resolvePoDeliverTo(po.deliveryWarehouse, company.addressLine);
  const plan = await loadPoShipToPlan(poId, { addressLine: company.addressLine, gstin: company.gstin ?? null });
  const isSplit = plan.mode === 'SPLIT';
  const showDeliveryPoints = isSplit || plan.shipTos.some((t) => t.isProcessor);
  const deliverTo = isSplit ? `Split across ${plan.shipTos.length} places — see 03 Delivery Points` : deliver.oneLine;
  const deliveryTerm = isSplit
    ? 'Delivery to each place in 03 in the quantities shown, during working hours, each against its own tax invoice and e-way bill.'
    : `Delivery to ${deliver.placeName} during working hours, against a valid tax invoice and e-way bill.`;

  const paymentTerms = po.paymentTerms ?? s.paymentTerms ?? null;

  // ── 02 — items & totals (all money via decimal.js) ───────────────────────
  let taxableSum = toCurrency(0);
  let taxSum = toCurrency(0);
  let igstSum = toCurrency(0);
  let cgstSum = toCurrency(0);
  let sgstSum = toCurrency(0);

  // Totals add up the real lines only — never the label heading rows below
  for (const item of po.purchase_order_items) {
    taxableSum = addCurrency(taxableSum, Number(item.totalPrice));
    if (item.taxAmount != null) taxSum = addCurrency(taxSum, Number(item.taxAmount));
    if (item.igstAmount != null) igstSum = addCurrency(igstSum, Number(item.igstAmount));
    if (item.cgstAmount != null) cgstSum = addCurrency(cgstSum, Number(item.cgstAmount));
    if (item.sgstAmount != null) sgstSum = addCurrency(sgstSum, Number(item.sgstAmount));
  }
  const lineRow = (item: PoItem, sn: number | null): PurchaseOrderDocItem => ({
    sn,
    name: itemName(item),
    code: item.materials?.code ?? null,
    weaver: item.weaver?.name ?? null,
    hsn: item.hsnCode ?? item.materials?.hsnCode ?? EM_DASH,
    uom: unitHeader(item.unit),
    qty: fmtQty(Number(item.orderedQuantity), item.unit),
    rate: fmtMoney(Number(item.unitPrice)),
    taxable: fmtMoney(Number(item.totalPrice)),
    gstPct: fmtPct(item.gstRate != null ? Number(item.gstRate) : null),
    igst: fmtMoney(item.igstAmount != null ? Number(item.igstAmount) : null),
    cgst: fmtMoney(item.cgstAmount != null ? Number(item.cgstAmount) : null),
    sgst: fmtMoney(item.sgstAmount != null ? Number(item.sgstAmount) : null),
  });

  // A label bought in sizes prints as one heading (its totals) with one row per size beneath, in size order
  const items: PurchaseOrderDocItem[] = [];
  let sn = 0;
  for (const g of groupLabelLines(po.purchase_order_items, (item) => labelLineKeyOf(item.materials))) {
    if (g.kind === 'single') {
      items.push(lineRow(g.line, ++sn));
      continue;
    }
    const lines = g.rows.map((r) => r.line);
    const same = <T>(pick: (l: PoItem) => T): T | null =>
      lines.every((l) => pick(l) === pick(lines[0])) ? pick(lines[0]) : null;
    const money = (pick: (l: PoItem) => unknown) =>
      fmtMoney(lines.every((l) => pick(l) == null) ? null : sumRows(g.rows, (l) => Number(pick(l) ?? 0)));
    const unit = same((l) => l.unit);
    const rate = same((l) => Number(l.unitPrice));
    const gst = same((l) => (l.gstRate != null ? Number(l.gstRate) : null));
    items.push({
      sn: ++sn,
      isGroup: true,
      name: g.name,
      code: `${g.code} · ${g.rows.length} ${g.rows.length === 1 ? 'size' : 'sizes'}`,
      weaver: null,
      hsn: same((l) => l.hsnCode ?? l.materials?.hsnCode ?? null) ?? EM_DASH,
      uom: unit ? unitHeader(unit) : EM_DASH,
      qty: unit
        ? fmtQty(
            sumRows(g.rows, (l) => Number(l.orderedQuantity)),
            unit
          )
        : EM_DASH,
      rate: rate != null ? fmtMoney(rate) : EM_DASH,
      taxable: money((l) => l.totalPrice),
      gstPct: fmtPct(gst),
      igst: money((l) => l.igstAmount),
      cgst: money((l) => l.cgstAmount),
      sgst: money((l) => l.sgstAmount),
    });
    for (const r of g.rows) {
      items.push({ ...lineRow(r.line, null), isSize: true, name: r.size ? `Size ${r.size}` : 'All sizes', code: null });
    }
  }

  const isIgst = igstSum.greaterThan(0);
  const subtotalNum = po.subtotal != null ? Number(po.subtotal) : roundToCent(taxableSum).toNumber();
  const taxNum = roundToCent(taxSum).toNumber();
  const grandNum =
    po.totalAmount != null
      ? Number(po.totalAmount)
      : roundToCent(addCurrency(toCurrency(subtotalNum), taxNum)).toNumber();

  return {
    company,
    docNo: po.poNumber,
    docPill: 'Goods purchase · Title passes on GRN',
    isIgst,
    taxRegimeLabel: isIgst ? 'Interstate — IGST applies' : 'Intra-state — CGST + SGST',
    supplierName: s.name,
    supplierAddress: addressBits.length > 0 ? addressBits.join(', ') : null,
    supplierGstin: gstin,
    supplierStateLabel,
    supplierContact: contactBits.length > 0 ? contactBits.join(' · ') : null,
    poDate: fmtDate(po.poDate),
    requiredBy: fmtDate(po.expectedDeliveryDate),
    deliverTo,
    deliveryPlaceName: deliver.placeName,
    payment: paymentTerms ?? EM_DASH,
    paymentClause: paymentTerms ?? 'as agreed',
    items,
    subtotal: fmtMoney(subtotalNum),
    igstTotal: fmtMoney(roundToCent(igstSum).toNumber()),
    cgstTotal: fmtMoney(roundToCent(cgstSum).toNumber()),
    sgstTotal: fmtMoney(roundToCent(sgstSum).toNumber()),
    grandTotal: fmtMoney(grandNum),
    amountWords: inrWords(grandNum),
    showDeliveryPoints,
    isSplit,
    shipTos: plan.shipTos,
    jobWorkNote: JOB_WORK_SHIP_TO_NOTE,
    oneInvoiceNote: ONE_INVOICE_PER_DELIVERY,
    termsSectionNo: showDeliveryPoints ? '04' : '03',
    deliveryTerm,
    amendmentLine:
      plan.amendmentNo > 0 ? `Amendment ${plan.amendmentNo} · ${plan.amendmentDate} — supersedes earlier copies` : null,
  };
}
