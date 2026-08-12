/**
 * Proforma Invoice — data adapter for the kf proforma-invoice template.
 *
 * Source record is a `quotations` row: a proforma is the quotation printed in
 * invoice form so the buyer can approve it / remit an advance. It is NOT a
 * Section 31 tax invoice — no GST is charged on it and it confers no input
 * credit. The template states that in a callout and in the masthead pill.
 *
 * Root query copies the include shape of document-generator.service's
 * getQuotationWithDetails (the field authority). Sanctioned aux queries:
 * the company block and the primary bank account (mirrors
 * getCompanyBankDetails, including its fallback).
 *
 * GST rate (BH-0071): the printed per-line "%" is `quotation_items.gstRate` —
 * the value gstService.calculateLineItemGST actually wrote against that line's
 * HSN and per-piece slab. The header `quotations.taxRate` is a stale flat base
 * rate and is NEVER printed, and no rate is derived by dividing a tax amount by
 * a taxable base. Header totals are printed as amounts only.
 *
 * Tax column switch: IGST present → single IGST column; CGST/SGST present →
 * two columns (same amounts-first approach as purchase-order.doc-data). Only
 * when a quotation carries no tax estimate at all does it fall back to
 * place-of-supply vs the company state code (what the pdfkit generator used).
 */
import prisma from '../../config/database';
import { Prisma } from '@prisma/client';
import { NotFoundError } from '../../errors';
import { addCurrency, roundToCent, toCurrency } from '../../utils/currency';
import { COMPANY_CONFIG, DEFAULT_HSN_CODES } from '../../config/company.config';
import { formatStyleCodeWithRef } from '../../utils/style-ref-format';
import { buildCompanyBlock, CompanyBlock } from './company-block';
import { EM_DASH, fmtDate, fmtMoney, fmtQty, inrWords } from './format';

const proformaDocInclude = {
  customers: {
    include: {
      billingState: { select: { stateName: true, stateCode: true } },
      shippingState: { select: { stateName: true, stateCode: true } },
      payment_terms: { select: { termName: true, daysCount: true } },
    },
  },
  quotation_items: {
    include: {
      styles: {
        select: { id: true, styleCode: true, buyerStyleRef: true, styleName: true, hsnCode: true },
      },
    },
    orderBy: { id: 'asc' as const },
  },
  placeOfSupply: { select: { stateName: true, stateCode: true } },
} satisfies Prisma.quotationsInclude;

export type ProformaQuotationWithDetails = Prisma.quotationsGetPayload<{ include: typeof proformaDocInclude }>;

export interface ProformaInvoiceDocLine {
  sn: number;
  description: string;
  subline: string | null; // "EBEW-001 (ESSKA241CK)"
  hsn: string;
  qty: string;
  rate: string;
  taxable: string;
  ratePct: string; // bare number for the "%" column — quotation_items.gstRate
  cgst: string;
  sgst: string;
  igst: string;
}

export interface ProformaInvoiceBank {
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  branchName: string;
}

export interface ProformaInvoiceDocData {
  company: CompanyBlock;
  docNo: string;
  docPill: string;
  supplyBanner: string; // "Inter-state · IGST (estimated)" | "Intra-state · CGST + SGST (estimated)"
  isInterstate: boolean;
  // 01 — buyer & validity
  billToName: string;
  billToAddress: string | null;
  billToGstin: string; // "URP" when unregistered
  billToState: string | null; // "Rajasthan (08)"
  billToContact: string | null; // "8890729433 · buyer@example.com"
  shipTo: string;
  quotationDate: string;
  validUntil: string;
  validityNote: string | null; // "Lapsed — reconfirm before acting on these prices"
  placeOfSupply: string;
  statusLabel: string; // QuotationStatus
  // 02 — goods quoted
  lines: ProformaInvoiceDocLine[];
  totalQty: string;
  subtotal: string;
  cgstTotal: string;
  sgstTotal: string;
  igstTotal: string;
  grandTotal: string;
  amountWords: string;
  showRateCallout: boolean; // mixed per-piece GST rates on one proforma
  // 03 — payment & bank
  bank: ProformaInvoiceBank;
  payment: string;
  paymentClause: string; // reused inside the terms list
  deliveryLead: string; // "Within 45 days of confirmation" | em-dash
  remarks: string | null;
  extraTerms: string | null; // quotations.termsAndConditions, verbatim
}

/** Mirrors document-generator.getCompanyBankDetails, including its fallback */
async function loadPrimaryBank(): Promise<ProformaInvoiceBank> {
  const account = await prisma.bank_accounts.findFirst({
    where: { isPrimaryAccount: true, isActive: true },
  });
  if (account) {
    return {
      bankName: account.bankName,
      accountHolderName: account.accountHolderName,
      accountNumber: account.accountNumber,
      ifscCode: account.ifscCode ?? EM_DASH,
      branchName: account.branchName,
    };
  }
  return {
    bankName: 'ICICI Bank',
    accountHolderName: COMPANY_CONFIG.name,
    accountNumber: '532505000026',
    ifscCode: 'ICIC0005325',
    branchName: 'Mansarovar',
  };
}

/** Live customer rows carry empty strings ("") in billingName/gstNumber/address — treat blank as absent (strings only; never money). */
function nonBlank(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function fmtRatePct(value: number | null): string {
  if (value === null) return EM_DASH;
  return value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export async function buildProformaInvoiceDocData(quotationId: string): Promise<ProformaInvoiceDocData> {
  const [company, quotation, bank] = await Promise.all([
    buildCompanyBlock(),
    prisma.quotations.findUnique({ where: { id: quotationId }, include: proformaDocInclude }),
    loadPrimaryBank(),
  ]);
  if (!quotation) throw new NotFoundError('Quotation', quotationId);

  const customer = quotation.customers;

  // ── 02 — lines (all money through decimal.js) ────────────────────────────
  let taxableSum = toCurrency(0);
  let qtySum = 0;
  let lineCgst = toCurrency(0);
  let lineSgst = toCurrency(0);
  let lineIgst = toCurrency(0);
  const distinctRates = new Set<number>();

  const lines: ProformaInvoiceDocLine[] = quotation.quotation_items.map((item, idx) => {
    const style = item.styles;
    const taxable = Number(item.totalPrice);
    taxableSum = addCurrency(taxableSum, taxable);
    qtySum += item.totalQuantity;
    if (item.cgstAmount != null) lineCgst = addCurrency(lineCgst, Number(item.cgstAmount));
    if (item.sgstAmount != null) lineSgst = addCurrency(lineSgst, Number(item.sgstAmount));
    if (item.igstAmount != null) lineIgst = addCurrency(lineIgst, Number(item.igstAmount));
    const ratePct = item.gstRate != null ? Number(item.gstRate) : null;
    if (ratePct !== null) distinctRates.add(ratePct);
    return {
      sn: idx + 1,
      description: nonBlank(item.description) ?? nonBlank(style?.styleName) ?? EM_DASH,
      subline: style ? formatStyleCodeWithRef(style.styleCode, style.buyerStyleRef) : null,
      hsn: item.hsnCode ?? style?.hsnCode ?? DEFAULT_HSN_CODES.GARMENTS,
      qty: fmtQty(item.totalQuantity, 'PCS'),
      rate: fmtMoney(Number(item.unitPrice)),
      taxable: fmtMoney(taxable),
      ratePct: fmtRatePct(ratePct),
      cgst: fmtMoney(item.cgstAmount != null ? Number(item.cgstAmount) : null),
      sgst: fmtMoney(item.sgstAmount != null ? Number(item.sgstAmount) : null),
      igst: fmtMoney(item.igstAmount != null ? Number(item.igstAmount) : null),
    };
  });

  // Header estimates are the authority — quotation.service recomputes them by
  // summing the per-line GST it just wrote (`estimatedCGST/SGST/IGST`).
  const cgstNum = roundToCent(toCurrency(quotation.estimatedCGST)).toNumber();
  const sgstNum = roundToCent(toCurrency(quotation.estimatedSGST)).toNumber();
  const igstNum = roundToCent(toCurrency(quotation.estimatedIGST)).toNumber();
  const taxNum = roundToCent(addCurrency(cgstNum, sgstNum, igstNum)).toNumber();

  const subtotalNum =
    quotation.totalAmount != null ? Number(quotation.totalAmount) : roundToCent(taxableSum).toNumber();
  const grandNum =
    quotation.totalWithTax != null
      ? Number(quotation.totalWithTax)
      : roundToCent(addCurrency(subtotalNum, taxNum)).toNumber();

  // Column switch: amounts first (purchase-order approach), place of supply only
  // as the tie-breaker when the quotation carries no tax estimate at all.
  const igstPresent = igstNum > 0 || lineIgst.greaterThan(0);
  const intraPresent = cgstNum > 0 || sgstNum > 0 || lineCgst.greaterThan(0) || lineSgst.greaterThan(0);
  const posStateCode = quotation.placeOfSupply?.stateCode ?? customer.billingState?.stateCode ?? null;
  const isInterstate = igstPresent
    ? true
    : intraPresent
      ? false
      : posStateCode !== null && posStateCode !== company.stateCode;

  // ── 01 — buyer & validity ────────────────────────────────────────────────
  const posState = quotation.placeOfSupply ?? customer.billingState ?? null;
  const contactBits = [nonBlank(customer.phone), nonBlank(customer.email)].filter((b): b is string => b !== null);
  const lapsed = quotation.validUntil.getTime() < Date.now();

  // ── 03 — payment & delivery ──────────────────────────────────────────────
  const creditDays = customer.creditDays;
  const paymentTerms =
    nonBlank(customer.payment_terms?.termName) ?? (creditDays != null ? `Net ${creditDays} days` : null);
  const deliveryDays = quotation.quotation_items
    .map((i) => i.deliveryDays)
    .filter((d): d is number => d != null && d > 0);
  const maxDeliveryDays = deliveryDays.length > 0 ? Math.max(...deliveryDays) : null;

  return {
    company,
    docNo: quotation.quotationNumber,
    docPill: 'Not a tax invoice · No input credit',
    supplyBanner: isInterstate ? 'Inter-state · IGST (estimated)' : 'Intra-state · CGST + SGST (estimated)',
    isInterstate,
    billToName: nonBlank(customer.billingName) ?? customer.name,
    billToAddress: nonBlank(customer.billingAddress),
    billToGstin: nonBlank(customer.gstNumber) ?? 'URP',
    billToState: customer.billingState
      ? `${customer.billingState.stateName} (${customer.billingState.stateCode})`
      : null,
    billToContact: contactBits.length > 0 ? contactBits.join(' · ') : null,
    shipTo: nonBlank(customer.shippingAddress) ?? 'Same as billing',
    quotationDate: fmtDate(quotation.quotationDate),
    validUntil: fmtDate(quotation.validUntil),
    validityNote: lapsed ? 'Lapsed — reconfirm prices before acting on this document' : null,
    placeOfSupply: posState ? `${posState.stateName} (${posState.stateCode})` : EM_DASH,
    statusLabel: quotation.status,
    lines,
    totalQty: fmtQty(qtySum, 'PCS'),
    subtotal: fmtMoney(subtotalNum),
    cgstTotal: fmtMoney(cgstNum),
    sgstTotal: fmtMoney(sgstNum),
    igstTotal: fmtMoney(igstNum),
    grandTotal: fmtMoney(grandNum),
    amountWords: inrWords(grandNum),
    showRateCallout: distinctRates.size > 1,
    bank,
    payment: paymentTerms ?? EM_DASH,
    paymentClause: paymentTerms ?? 'as agreed in writing',
    deliveryLead: maxDeliveryDays !== null ? `Within ${maxDeliveryDays} days of order confirmation` : EM_DASH,
    remarks: nonBlank(quotation.remarks),
    extraTerms: nonBlank(quotation.termsAndConditions),
  };
}
