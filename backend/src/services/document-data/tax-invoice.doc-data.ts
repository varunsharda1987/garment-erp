/**
 * Tax Invoice (Section 31) — data adapter for the kf tax-invoice template.
 * Root query copies the include shape of document-generator.service's
 * getInvoiceWithDetails (the field authority). Sanctioned aux queries:
 * primary bank account (mirrors getCompanyBankDetails) and the e-invoice
 * QR data URI.
 */
import prisma from '../../config/database';
import { Prisma } from '@prisma/client';
import QRCode from 'qrcode';
import { NotFoundError } from '../../errors';
import { addCurrency, percentOf, roundToCent } from '../../utils/currency';
import { DEFAULT_HSN_CODES } from '../../config/company.config';
import { formatStyleCodeWithRef } from '../../utils/style-ref-format';
import { buildCompanyBlock, CompanyBlock } from './company-block';
import { EM_DASH, fmtDate, fmtMoney, fmtQty, inrWords } from './format';

const taxInvoiceDocInclude = {
  customers: {
    include: {
      billingState: true,
      shippingState: true,
    },
  },
  orders: {
    include: {
      order_items: {
        include: {
          styles: true,
          order_item_breakup: {
            include: {
              size_options: true,
              color_options: true,
            },
          },
        },
      },
    },
  },
  placeOfSupply: true,
  delivery_note: { select: { deliveryNumber: true } },
  invoice_items: {
    include: {
      style: {
        select: { id: true, styleCode: true, buyerStyleRef: true, styleName: true, hsnCode: true },
      },
    },
    orderBy: { id: 'asc' as const },
  },
} satisfies Prisma.invoicesInclude;

type InvoiceWithDetails = Prisma.invoicesGetPayload<{ include: typeof taxInvoiceDocInclude }>;

export interface TaxInvoiceDocLine {
  sn: number;
  description: string;
  subline: string | null;
  hsn: string;
  qty: string;
  rate: string;
  taxable: string;
  ratePct: string; // bare number for the "%" column, e.g. "5" / "18"
  cgst: string;
  sgst: string;
  igst: string;
}

export interface TaxInvoiceHsnRow {
  hsn: string;
  taxable: string;
  cgst: string;
  sgst: string;
  igst: string;
  totalTax: string;
}

export interface TaxInvoiceEInvoice {
  irn: string;
  ackNo: string;
  ackDate: string;
  cancelled: boolean;
  cancelledBand: string; // "E-INVOICE CANCELLED on 07 Aug 2026"
  qrDataUri: string | null; // only when status GENERATED and a signed QR exists
}

export interface TaxInvoiceBank {
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  branchName: string;
}

export interface TaxInvoiceDocData {
  company: CompanyBlock;
  docNo: string;
  docPill: string;
  supplyBanner: string; // "Intra-state · CGST + SGST" | "Inter-state · IGST"
  isInterstate: boolean;
  billToName: string;
  billToAddress: string | null;
  billToGstin: string; // "URP" when unregistered
  billToState: string | null; // "Rajasthan (08)"
  shipTo: string;
  invoiceDate: string;
  dueDate: string;
  placeOfSupply: string;
  deliveryNote: string | null;
  legacyLines: boolean; // true when synthesized from orders.order_items
  lines: TaxInvoiceDocLine[];
  subtotal: string;
  cgstTotal: string;
  sgstTotal: string;
  igstTotal: string;
  totalAmount: string;
  amountWords: string;
  showRateCallout: boolean; // mixed per-piece GST rates on one invoice
  hsnRows: TaxInvoiceHsnRow[];
  eInvoice: TaxInvoiceEInvoice | null;
  bank: TaxInvoiceBank;
}

/** Internal numeric line used for HSN/SAC grouping (mirrors drawHSNSummary) */
interface NumericLine {
  hsn: string;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  ratePct: number | null;
}

/** Mirrors document-generator.getCompanyBankDetails, including its fallback */
async function loadPrimaryBank(): Promise<TaxInvoiceBank> {
  const account = await prisma.bank_accounts.findFirst({
    where: { isPrimaryAccount: true, isActive: true },
  });
  if (account) {
    return {
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      ifscCode: account.ifscCode ?? EM_DASH,
      branchName: account.branchName,
    };
  }
  return { bankName: 'ICICI Bank', accountNumber: '532505000026', ifscCode: 'ICIC0005325', branchName: 'Mansarovar' };
}

function fmtRatePct(value: number | null): string {
  if (value === null) return EM_DASH;
  return value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

/** Live customer rows carry empty strings ("") in billingName/gstNumber/address — treat blank as absent (strings only; never money). */
function nonBlank(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function buildLines(invoice: InvoiceWithDetails): {
  lines: TaxInvoiceDocLine[];
  numeric: NumericLine[];
  legacyLines: boolean;
} {
  const isInterstate = invoice.isInterstate;
  const lines: TaxInvoiceDocLine[] = [];
  const numeric: NumericLine[] = [];
  const legacyLines = invoice.invoice_items.length === 0;

  if (!legacyLines) {
    // Per-line GST as stored on invoice_items
    invoice.invoice_items.forEach((item, idx) => {
      const taxable = Number(item.totalPrice);
      const cgst = item.cgstAmount != null ? Number(item.cgstAmount) : 0;
      const sgst = item.sgstAmount != null ? Number(item.sgstAmount) : 0;
      const igst = item.igstAmount != null ? Number(item.igstAmount) : 0;
      const totalTax =
        item.taxAmount != null ? Number(item.taxAmount) : roundToCent(addCurrency(cgst, sgst, igst)).toNumber();
      const ratePct = item.gstRate != null ? Number(item.gstRate) : null;
      const hsn = item.hsnCode ?? item.style?.hsnCode ?? EM_DASH;
      lines.push({
        sn: idx + 1,
        description: item.description,
        subline: item.style ? formatStyleCodeWithRef(item.style.styleCode, item.style.buyerStyleRef) : null,
        hsn,
        qty: fmtQty(item.quantity, 'PCS'),
        rate: fmtMoney(Number(item.unitPrice)),
        taxable: fmtMoney(taxable),
        ratePct: fmtRatePct(ratePct),
        cgst: fmtMoney(cgst),
        sgst: fmtMoney(sgst),
        igst: fmtMoney(igst),
      });
      numeric.push({ hsn, taxable, cgst, sgst, igst, totalTax, ratePct });
    });
  } else {
    // Legacy path (mirrors document-generator ~438-490): synthesize lines from
    // orders.order_items with header-level GST rates.
    const cgstRate = Number(invoice.cgstRate ?? 0);
    const sgstRate = Number(invoice.sgstRate ?? 0);
    const igstRate = Number(invoice.igstRate ?? 0);
    const headerRate = isInterstate ? igstRate : cgstRate + sgstRate;
    const orderItems = invoice.orders?.order_items ?? [];
    orderItems.forEach((item, idx) => {
      const style = item.styles;
      const taxable = Number(item.totalPrice);
      const cgst = isInterstate ? 0 : roundToCent(percentOf(taxable, cgstRate)).toNumber();
      const sgst = isInterstate ? 0 : roundToCent(percentOf(taxable, sgstRate)).toNumber();
      const igst = isInterstate ? roundToCent(percentOf(taxable, igstRate)).toNumber() : 0;
      const totalTax = roundToCent(addCurrency(cgst, sgst, igst)).toNumber();
      const hsn = style?.hsnCode ?? DEFAULT_HSN_CODES.GARMENTS;
      lines.push({
        sn: idx + 1,
        description: item.itemDescription ?? style?.styleName ?? EM_DASH,
        subline: style ? formatStyleCodeWithRef(style.styleCode, style.buyerStyleRef) : null,
        hsn,
        qty: fmtQty(item.totalQuantity, 'PCS'),
        rate: fmtMoney(Number(item.unitPrice)),
        taxable: fmtMoney(taxable),
        ratePct: fmtRatePct(headerRate),
        cgst: fmtMoney(cgst),
        sgst: fmtMoney(sgst),
        igst: fmtMoney(igst),
      });
      numeric.push({ hsn, taxable, cgst, sgst, igst, totalTax, ratePct: headerRate });
    });
  }

  return { lines, numeric, legacyLines };
}

/** Group by HSN code — taxable value + tax amounts (GSTR-1, mirrors drawHSNSummary) */
function buildHsnRows(numeric: NumericLine[]): TaxInvoiceHsnRow[] {
  const agg = new Map<string, { taxable: number; cgst: number; sgst: number; igst: number; totalTax: number }>();
  for (const line of numeric) {
    const cur = agg.get(line.hsn) ?? { taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 };
    cur.taxable = addCurrency(cur.taxable, line.taxable).toNumber();
    cur.cgst = addCurrency(cur.cgst, line.cgst).toNumber();
    cur.sgst = addCurrency(cur.sgst, line.sgst).toNumber();
    cur.igst = addCurrency(cur.igst, line.igst).toNumber();
    cur.totalTax = addCurrency(cur.totalTax, line.totalTax).toNumber();
    agg.set(line.hsn, cur);
  }
  return [...agg.entries()].map(([hsn, v]) => ({
    hsn,
    taxable: fmtMoney(v.taxable),
    cgst: fmtMoney(v.cgst),
    sgst: fmtMoney(v.sgst),
    igst: fmtMoney(v.igst),
    totalTax: fmtMoney(v.totalTax),
  }));
}

async function buildEInvoiceBlock(invoice: InvoiceWithDetails): Promise<TaxInvoiceEInvoice | null> {
  if (!invoice.eInvoiceIrn) return null;
  let qrDataUri: string | null = null;
  if (invoice.eInvoiceStatus === 'GENERATED' && invoice.eInvoiceQrCode) {
    try {
      qrDataUri = await QRCode.toDataURL(invoice.eInvoiceQrCode, {
        errorCorrectionLevel: 'M',
        margin: 0,
        width: 256,
      });
    } catch {
      qrDataUri = null; // QR failure must never block the invoice render
    }
  }
  return {
    irn: invoice.eInvoiceIrn,
    ackNo: invoice.eInvoiceAckNo ?? EM_DASH,
    ackDate: fmtDate(invoice.eInvoiceAckDate),
    cancelled: invoice.eInvoiceStatus === 'CANCELLED',
    cancelledBand: `E-INVOICE CANCELLED${
      invoice.eInvoiceCancelledAt ? ` on ${fmtDate(invoice.eInvoiceCancelledAt)}` : ''
    }`,
    qrDataUri,
  };
}

export async function buildTaxInvoiceDocData(invoiceId: string): Promise<TaxInvoiceDocData> {
  const [company, invoice, bank] = await Promise.all([
    buildCompanyBlock(),
    prisma.invoices.findUnique({ where: { id: invoiceId }, include: taxInvoiceDocInclude }),
    loadPrimaryBank(),
  ]);
  if (!invoice) throw new NotFoundError('Invoice', invoiceId);

  const customer = invoice.customers;
  const { lines, numeric, legacyLines } = buildLines(invoice);
  const eInvoice = await buildEInvoiceBlock(invoice);

  // Place of supply: explicit relation, else customer's billing state
  const posState = invoice.placeOfSupply ?? customer.billingState ?? null;
  const placeOfSupply = posState ? `${posState.stateName} (${posState.stateCode})` : EM_DASH;
  const billToState = customer.billingState
    ? `${customer.billingState.stateName} (${customer.billingState.stateCode})`
    : null;

  // Callout only earns its place when the invoice actually mixes per-piece rates
  const distinctRates = new Set(numeric.map((l) => l.ratePct).filter((r): r is number => r !== null));

  return {
    company,
    docNo: invoice.invoiceNumber,
    docPill: 'Section 31 · CGST Act 2017',
    supplyBanner: invoice.isInterstate ? 'Inter-state · IGST' : 'Intra-state · CGST + SGST',
    isInterstate: invoice.isInterstate,
    billToName: nonBlank(customer.billingName) ?? customer.name,
    billToAddress: nonBlank(customer.billingAddress),
    billToGstin: nonBlank(customer.gstNumber) ?? 'URP',
    billToState,
    shipTo: nonBlank(customer.shippingAddress) ?? 'Same as billing',
    invoiceDate: fmtDate(invoice.invoiceDate),
    dueDate: fmtDate(invoice.dueDate),
    placeOfSupply,
    deliveryNote: invoice.delivery_note?.deliveryNumber ?? null,
    legacyLines,
    lines,
    subtotal: fmtMoney(Number(invoice.subtotal)),
    cgstTotal: fmtMoney(Number(invoice.cgstAmount)),
    sgstTotal: fmtMoney(Number(invoice.sgstAmount)),
    igstTotal: fmtMoney(Number(invoice.igstAmount)),
    totalAmount: fmtMoney(Number(invoice.totalAmount)),
    amountWords: inrWords(Number(invoice.totalAmount)),
    showRateCallout: distinctRates.size > 1,
    hsnRows: buildHsnRows(numeric),
    eInvoice,
    bank,
  };
}
