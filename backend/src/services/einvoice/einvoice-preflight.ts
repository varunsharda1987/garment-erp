/**
 * e-Invoice preflight: loads an invoice with its full party graph, resolves
 * seller/buyer details through fallback chains, validates against IRP rules,
 * and (when eligible) builds the INV-01 payload.
 *
 * Returns human-readable problems instead of failing at the IRP with cryptic
 * error codes — the weakest data (free-text buyer addresses) gets actionable
 * messages the user can fix on the customer master.
 */

import prisma from '../../config/database';
import { COMPANY_CONFIG } from '../../config/company.config';
import { einvoiceSettingsService } from '../einvoice-settings.service';
import {
  buildInv01Payload,
  Inv01Payload,
  ResolvedInvoice,
  ResolvedItem,
  ResolvedParty,
  round2,
  splitAddress,
} from './einvoice-payload.builder';

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;
const DOC_NO_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9/-]{0,15}$/;
const PIN_REGEX = /^[1-9][0-9]{5}$/;
const HSN_REGEX = /^\d{4}(\d{2})?(\d{2})?$/;
const VALID_GST_RATES = [0, 0.1, 0.25, 1, 1.5, 3, 5, 7.5, 12, 18, 28];

const SUP_TYP_MAP: Record<string, string> = {
  DOMESTIC: 'B2B',
  EXPORT_WITH_PAYMENT: 'EXPWP',
  EXPORT_WITHOUT_PAYMENT: 'EXPWOP',
  SEZ_WITH_PAYMENT: 'SEZWP',
  SEZ_WITHOUT_PAYMENT: 'SEZWOP',
  DEEMED_EXPORT: 'DEXP',
};

/** Normalize free-text units to IRP UQC codes. */
const UQC_MAP: Record<string, string> = {
  PCS: 'PCS',
  PC: 'PCS',
  PIECE: 'PCS',
  PIECES: 'PCS',
  NOS: 'NOS',
  MTR: 'MTR',
  MTRS: 'MTR',
  METER: 'MTR',
  METERS: 'MTR',
  METRE: 'MTR',
  KG: 'KGS',
  KGS: 'KGS',
  SET: 'SET',
  SETS: 'SET',
  PAIR: 'PRS',
  PAIRS: 'PRS',
  PRS: 'PRS',
  DOZ: 'DOZ',
  DOZEN: 'DOZ',
  BOX: 'BOX',
  ROLL: 'ROL',
};

export interface PreflightResult {
  eligible: boolean;
  problems: string[];
  warnings: string[];
  payload?: Inv01Payload;
}

const num = (v: unknown): number => (v == null ? 0 : Number(v));

export async function preflightInvoice(invoiceId: string): Promise<PreflightResult> {
  const problems: string[] = [];
  const warnings: string[] = [];

  const settings = await einvoiceSettingsService.get();
  if (!settings.einvEnabled) {
    problems.push('e-Invoicing is disabled. Enable it in Settings → GST e-Invoice.');
  }
  const missingCreds: string[] = [];
  if (!settings.einvClientId.trim()) missingCreds.push('Client ID');
  if (!settings.einvClientSecret.trim()) missingCreds.push('Client Secret');
  if (!settings.einvApiUsername.trim()) missingCreds.push('API Username');
  if (!settings.einvApiPassword.trim()) missingCreds.push('API Password');
  if (!settings.einvGstin.trim()) missingCreds.push('Seller GSTIN');
  if (missingCreds.length > 0) {
    problems.push(`e-Invoice credentials incomplete: ${missingCreds.join(', ')} not set.`);
  }
  if (settings.einvMode === 'PRODUCTION' && !settings.einvPublicKeyPem?.trim()) {
    warnings.push('PRODUCTION mode is on but no NIC public key is pasted — auth will fail until it is set.');
  }

  const invoice = await prisma.invoices.findUnique({
    where: { id: invoiceId },
    include: {
      customers: {
        include: {
          customer_gst_numbers: true,
          customer_addresses: { include: { state: true, city: true } },
          billingState: true,
          billingCity: true,
        },
      },
      invoice_items: true,
      placeOfSupply: true,
    },
  });

  if (!invoice) {
    return { eligible: false, problems: ['Invoice not found.'], warnings };
  }

  if (invoice.eInvoiceIrn) {
    problems.push(
      invoice.eInvoiceStatus === 'CANCELLED'
        ? 'This invoice already had an IRN which was cancelled. The same document number cannot be registered again — issue a new invoice.'
        : 'IRN already generated for this invoice.'
    );
  }

  // ── Seller ────────────────────────────────────────────────────────────────
  const profile = await prisma.company_profile.findFirst({ where: { isActive: true } });
  if (!profile) {
    warnings.push('No active Company Profile row found — using built-in company config as seller details.');
  }
  const sellerAddress = splitAddress(profile?.address ?? COMPANY_CONFIG.address);
  const seller: ResolvedParty = {
    gstin: (profile?.gstin ?? COMPANY_CONFIG.gstin).trim().toUpperCase(),
    legalName: profile?.legalName ?? COMPANY_CONFIG.name,
    tradeName: profile?.name ?? COMPANY_CONFIG.name,
    addr1: sellerAddress.addr1,
    addr2: sellerAddress.addr2,
    location: profile?.city ?? COMPANY_CONFIG.city,
    pincode: (profile?.pincode ?? COMPANY_CONFIG.pincode).trim(),
    stateCode: (profile?.stateCode ?? COMPANY_CONFIG.stateCode).trim(),
    phone: profile?.phone ?? COMPANY_CONFIG.phone,
    email: profile?.email ?? COMPANY_CONFIG.email,
  };

  if (!GSTIN_REGEX.test(seller.gstin)) {
    problems.push(`Seller GSTIN "${seller.gstin}" is not a valid GSTIN.`);
  }
  if (settings.einvGstin.trim() && settings.einvGstin.trim().toUpperCase() !== seller.gstin) {
    problems.push(
      `Settings GSTIN (${settings.einvGstin}) does not match the seller GSTIN (${seller.gstin}) — the IRP registers documents under the credentials' GSTIN.`
    );
  }
  if (!PIN_REGEX.test(seller.pincode)) {
    problems.push(`Seller pincode "${seller.pincode}" is not a valid 6-digit PIN.`);
  }

  // ── Buyer ────────────────────────────────────────────────────────────────
  const customer = invoice.customers;
  const gstRows = customer.customer_gst_numbers;
  const gstRow = gstRows.find((g) => g.isPrimary) ?? gstRows[0];
  const buyerGstin = (gstRow?.gstNumber ?? customer.gstNumber ?? '').trim().toUpperCase();

  if (!buyerGstin) {
    return {
      eligible: false,
      problems: [
        `Customer "${customer.name}" has no GSTIN — this is a B2C invoice and is not eligible for e-invoicing.`,
      ],
      warnings,
    };
  }
  if (!GSTIN_REGEX.test(buyerGstin)) {
    problems.push(`Buyer GSTIN "${buyerGstin}" is not a valid GSTIN — fix it on the customer master.`);
  }

  // Address chain: GST-row address → primary structured address → customer billing blob
  const structuredAddr =
    customer.customer_addresses.find((a) => a.isActive && a.isPrimary) ??
    customer.customer_addresses.find((a) => a.isActive && String(a.addressType) === 'BILLING') ??
    customer.customer_addresses.find((a) => a.isActive);

  let buyerAddr1 = '';
  let buyerAddr2: string | undefined;
  let buyerPincode = '';
  let buyerLocation = '';

  if (gstRow?.billingAddress?.trim()) {
    const split = splitAddress(gstRow.billingAddress);
    buyerAddr1 = split.addr1;
    buyerAddr2 = split.addr2;
    buyerPincode = gstRow.billingPincode?.trim() ?? '';
    buyerLocation = gstRow.stateName;
  } else if (structuredAddr) {
    buyerAddr1 = structuredAddr.addressLine1.trim();
    buyerAddr2 = structuredAddr.addressLine2?.trim() || undefined;
    buyerPincode = structuredAddr.pincode.trim();
    buyerLocation = structuredAddr.city?.cityName ?? structuredAddr.state?.stateName ?? '';
  } else if (customer.billingAddress?.trim()) {
    const split = splitAddress(customer.billingAddress);
    buyerAddr1 = split.addr1;
    buyerAddr2 = split.addr2;
    buyerPincode = customer.billingPincode?.trim() ?? '';
    buyerLocation = customer.billingCity?.cityName ?? customer.billingState?.stateName ?? '';
  }

  if (!buyerPincode && gstRow?.billingPincode?.trim()) buyerPincode = gstRow.billingPincode.trim();
  if (!buyerPincode && customer.billingPincode?.trim()) buyerPincode = customer.billingPincode.trim();
  if (!buyerLocation) buyerLocation = customer.billingState?.stateName ?? '';

  if (!buyerAddr1) {
    problems.push(`Customer "${customer.name}" has no billing address — add one on the customer master.`);
  }
  if (!PIN_REGEX.test(buyerPincode)) {
    problems.push(
      `Customer "${customer.name}" has no valid 6-digit billing pincode (found "${buyerPincode || 'blank'}") — add it on the customer master.`
    );
  }
  if (!buyerLocation) {
    problems.push(`Customer "${customer.name}" has no billing city/state for the IRP "Location" field.`);
  }

  const buyerStateCode = buyerGstin.slice(0, 2);
  const buyer: ResolvedParty = {
    gstin: buyerGstin,
    legalName: customer.billingName?.trim() || customer.name,
    tradeName: customer.name,
    addr1: buyerAddr1,
    addr2: buyerAddr2,
    location: buyerLocation,
    pincode: buyerPincode,
    stateCode: buyerStateCode,
    phone: customer.phone ?? undefined,
    email: customer.email ?? undefined,
  };

  // ── Place of supply ──────────────────────────────────────────────────────
  const posStateCode = invoice.placeOfSupply?.stateCode ?? buyerStateCode;
  if (!posStateCode) {
    problems.push('Place of supply could not be resolved (no place-of-supply state and no buyer GSTIN state).');
  }

  // ── Document ─────────────────────────────────────────────────────────────
  if (!DOC_NO_REGEX.test(invoice.invoiceNumber)) {
    problems.push(
      `Invoice number "${invoice.invoiceNumber}" is not IRP-compatible (max 16 chars: letters, digits, "/" and "-", must not start with 0, "/" or "-").`
    );
  }
  const invoiceDate = invoice.invoiceDate;
  const now = new Date();
  if (invoiceDate.getTime() > now.getTime() + 24 * 60 * 60 * 1000) {
    problems.push('Invoice date is in the future — the IRP rejects future-dated documents.');
  } else if (now.getTime() - invoiceDate.getTime() > 30 * 24 * 60 * 60 * 1000) {
    warnings.push('Invoice is older than 30 days — the IRP may reject it under the reporting-window rule.');
  }

  const supTyp = SUP_TYP_MAP[invoice.supplyType ?? 'DOMESTIC'] ?? 'B2B';

  // ── Items ────────────────────────────────────────────────────────────────
  if (invoice.invoice_items.length === 0) {
    problems.push('Invoice has no line items.');
  }

  const hsnCodes = [...new Set(invoice.invoice_items.map((i) => i.hsnCode?.trim()).filter(Boolean))] as string[];
  const hsnMasters = hsnCodes.length
    ? await prisma.hsn_sac_masters.findMany({ where: { code: { in: hsnCodes } }, select: { code: true, unit: true } })
    : [];
  const unitByHsn = new Map(hsnMasters.map((h) => [h.code, h.unit]));

  const items: ResolvedItem[] = [];
  invoice.invoice_items.forEach((item, index) => {
    const lineNo = index + 1;
    const hsn = item.hsnCode?.trim() ?? '';
    if (!hsn) {
      problems.push(`Line ${lineNo} ("${item.description}"): HSN code is missing.`);
    } else if (!HSN_REGEX.test(hsn)) {
      problems.push(`Line ${lineNo}: HSN code "${hsn}" must be 4, 6, or 8 digits.`);
    }
    if (item.quantity <= 0) {
      problems.push(`Line ${lineNo}: quantity must be greater than zero.`);
    }

    // Derive the total GST rate — deliberately NOT the cgstRate>=9 heuristic
    const gstRate = item.gstRate
      ? num(item.gstRate)
      : invoice.isInterstate
        ? num(item.igstRate)
        : num(item.cgstRate) * 2;
    if (!VALID_GST_RATES.includes(round2(gstRate))) {
      problems.push(`Line ${lineNo}: GST rate ${gstRate}% is not a valid IRP rate (${VALID_GST_RATES.join(', ')}).`);
    }

    const cgst = num(item.cgstAmount);
    const sgst = num(item.sgstAmount);
    const igst = num(item.igstAmount);
    if (invoice.isInterstate && igst === 0 && gstRate > 0) {
      problems.push(`Line ${lineNo}: interstate invoice but IGST amount is zero.`);
    }
    if (!invoice.isInterstate && igst > 0) {
      problems.push(`Line ${lineNo}: intra-state invoice but IGST amount is set.`);
    }

    const rawUnit = (unitByHsn.get(hsn) ?? 'PCS').trim().toUpperCase();
    items.push({
      description: item.description,
      hsnCode: hsn,
      quantity: item.quantity,
      unit: UQC_MAP[rawUnit] ?? 'PCS',
      unitPrice: num(item.unitPrice),
      totalPrice: num(item.totalPrice),
      gstRate: round2(gstRate),
      cgstAmount: cgst,
      sgstAmount: sgst,
      igstAmount: igst,
    });
  });

  // ── Totals reconciliation (±1 tolerance, matching IRP) ───────────────────
  const subtotal = num(invoice.subtotal);
  const cgstTotal = num(invoice.cgstAmount);
  const sgstTotal = num(invoice.sgstAmount);
  const igstTotal = num(invoice.igstAmount);
  const totalAmount = num(invoice.totalAmount);

  const itemAssSum = round2(items.reduce((s, i) => s + i.totalPrice, 0));
  if (Math.abs(itemAssSum - subtotal) > 1) {
    problems.push(`Line item totals (₹${itemAssSum}) do not match the invoice subtotal (₹${subtotal}).`);
  }
  const itemTaxSum = round2(items.reduce((s, i) => s + i.cgstAmount + i.sgstAmount + i.igstAmount, 0));
  const headerTaxSum = round2(cgstTotal + sgstTotal + igstTotal);
  if (Math.abs(itemTaxSum - headerTaxSum) > 1) {
    problems.push(`Line item taxes (₹${itemTaxSum}) do not match the invoice tax totals (₹${headerTaxSum}).`);
  }
  const rndOff = round2(totalAmount - (subtotal + headerTaxSum));
  if (Math.abs(rndOff) > 0.99) {
    warnings.push(`Round-off amount ₹${rndOff} is unusually large — check the invoice totals.`);
  }

  if (problems.length > 0) {
    return { eligible: false, problems, warnings };
  }

  const resolved: ResolvedInvoice = {
    docType: 'INV',
    docNo: invoice.invoiceNumber,
    docDate: invoiceDate,
    supTyp,
    isInterstate: invoice.isInterstate,
    seller,
    buyer,
    placeOfSupplyStateCode: posStateCode,
    items,
    subtotal,
    cgstAmount: cgstTotal,
    sgstAmount: sgstTotal,
    igstAmount: igstTotal,
    totalAmount,
  };

  return { eligible: true, problems, warnings, payload: buildInv01Payload(resolved) };
}
