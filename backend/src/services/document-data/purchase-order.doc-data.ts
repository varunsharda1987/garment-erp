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

const poDocInclude = {
  suppliers: {
    include: {
      billing_city: { select: { cityName: true } },
      billing_state: { select: { stateName: true } },
      gst_numbers: { where: { isPrimary: true }, select: { gstNumber: true }, take: 1 },
    },
  },
  deliveryWarehouse: {
    select: { warehouseName: true, address: true, city: true, pincode: true },
  },
  purchase_order_items: {
    include: {
      materials: { select: { name: true, code: true, hsnCode: true } },
    },
  },
} satisfies Prisma.purchase_ordersInclude;

type PoWithDetails = Prisma.purchase_ordersGetPayload<{ include: typeof poDocInclude }>;
type PoItem = PoWithDetails['purchase_order_items'][number];

export interface PurchaseOrderDocItem {
  sn: number;
  name: string;
  code: string | null; // muted material code next to the name
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

  // Deliver To — delivery warehouse if set, else the company's own address
  const wh = po.deliveryWarehouse;
  const whBits = wh ? [wh.address, wh.city, wh.pincode].map((b) => (b ?? '').trim()).filter((b) => b.length > 0) : [];
  const deliverTo = wh
    ? `${wh.warehouseName}${whBits.length > 0 ? ` — ${whBits.join(', ')}` : ''}`
    : `${company.name} — ${company.addressLine}`;

  const paymentTerms = po.paymentTerms ?? s.paymentTerms ?? null;

  // ── 02 — items & totals (all money via decimal.js) ───────────────────────
  let taxableSum = toCurrency(0);
  let taxSum = toCurrency(0);
  let igstSum = toCurrency(0);
  let cgstSum = toCurrency(0);
  let sgstSum = toCurrency(0);

  const items: PurchaseOrderDocItem[] = po.purchase_order_items.map((item, idx) => {
    taxableSum = addCurrency(taxableSum, Number(item.totalPrice));
    if (item.taxAmount != null) taxSum = addCurrency(taxSum, Number(item.taxAmount));
    if (item.igstAmount != null) igstSum = addCurrency(igstSum, Number(item.igstAmount));
    if (item.cgstAmount != null) cgstSum = addCurrency(cgstSum, Number(item.cgstAmount));
    if (item.sgstAmount != null) sgstSum = addCurrency(sgstSum, Number(item.sgstAmount));
    return {
      sn: idx + 1,
      name: itemName(item),
      code: item.materials?.code ?? null,
      hsn: item.hsnCode ?? item.materials?.hsnCode ?? EM_DASH,
      uom: item.unit,
      qty: fmtQty(Number(item.orderedQuantity), item.unit),
      rate: fmtMoney(Number(item.unitPrice)),
      taxable: fmtMoney(Number(item.totalPrice)),
      gstPct: fmtPct(item.gstRate != null ? Number(item.gstRate) : null),
      igst: fmtMoney(item.igstAmount != null ? Number(item.igstAmount) : null),
      cgst: fmtMoney(item.cgstAmount != null ? Number(item.cgstAmount) : null),
      sgst: fmtMoney(item.sgstAmount != null ? Number(item.sgstAmount) : null),
    };
  });

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
    deliveryPlaceName: wh?.warehouseName ?? 'our factory',
    payment: paymentTerms ?? EM_DASH,
    paymentClause: paymentTerms ?? 'as agreed',
    items,
    subtotal: fmtMoney(subtotalNum),
    igstTotal: fmtMoney(roundToCent(igstSum).toNumber()),
    cgstTotal: fmtMoney(roundToCent(cgstSum).toNumber()),
    sgstTotal: fmtMoney(roundToCent(sgstSum).toNumber()),
    grandTotal: fmtMoney(grandNum),
    amountWords: inrWords(grandNum),
  };
}
