/**
 * Delivery Challan (Rule 55) — data adapter for the kf challan template.
 * One root Prisma query; one sanctioned aux query for the polymorphic
 * counter-party (challans.fromId/toId carry no FK).
 */
import prisma from '../../config/database';
import { Prisma } from '@prisma/client';
import { NotFoundError } from '../../errors';
import { addCurrency, roundToCent, multiplyCurrency, toCurrency } from '../../utils/currency';
import { buildCompanyBlock, CompanyBlock } from './company-block';
import { EM_DASH, fmtDate, fmtMoney, fmtQty, gstinState } from './format';

const challanDocInclude = {
  items: {
    include: {
      // statutoryDueDate on the LINE's order matters for a consolidated dispatch, where the
      // header names no order and would otherwise fall back to arithmetic (see returnBy below).
      jobWorkOrder: { select: { jobWorkNumber: true, statutoryDueDate: true } },
      jobWorkOrderComponent: { select: { hsnCode: true } },
      greigeStock: { select: { id: true, greige: { select: { greigeCode: true, greigeName: true } } } },
      fabricStock: { select: { id: true, fabricMaster: { select: { fabricCode: true, fabricName: true } } } },
    },
  },
  jobWorkOrder: {
    select: { jobWorkNumber: true, statutoryDueDate: true },
  },
} satisfies Prisma.challansInclude;

type ChallanWithDetails = Prisma.challansGetPayload<{ include: typeof challanDocInclude }>;

export interface ChallanDocItem {
  sn: number;
  description: string;
  subline: string | null;
  hsn: string;
  uom: string;
  qty: string;
  value: string; // — for free issue
  orderRef: string;
}

export interface ChallanDocData {
  company: CompanyBlock;
  docNo: string;
  docPill: string;
  movementLabel: string;
  showGst: boolean;
  consignorName: string;
  consignorGstin: string | null;
  consigneeName: string;
  consigneeAddress: string | null;
  consigneeGstin: string | null;
  placeOfSupply: string | null;
  supplyKind: string;
  challanDate: string;
  reason: string;
  againstOrders: string | null;
  ewayBill: string | null;
  vehicleLr: string | null;
  goodsBanner: string;
  items: ChallanDocItem[];
  totalValue: string;
  returnByDate: string;
}

interface PartyDetails {
  address: string | null;
  gstin: string | null;
  stateCode: string | null;
  stateName: string | null;
}

async function loadVendorParty(partyId: string | null): Promise<PartyDetails> {
  if (!partyId) return { address: null, gstin: null, stateCode: null, stateName: null };
  const supplier = await prisma.suppliers.findUnique({
    where: { id: partyId },
    select: {
      address: true,
      billingPincode: true,
      billing_city: { select: { cityName: true } },
      billing_state: { select: { stateName: true } },
      gst_numbers: { where: { isPrimary: true }, select: { gstNumber: true }, take: 1 },
    },
  });
  if (!supplier) return { address: null, gstin: null, stateCode: null, stateName: null };
  const gstin = supplier.gst_numbers[0]?.gstNumber ?? null;
  const address = [supplier.address, supplier.billing_city?.cityName, supplier.billingPincode]
    .filter(Boolean)
    .join(', ');
  return {
    address: address.length > 0 ? address : null,
    gstin,
    stateCode: gstinState(gstin),
    stateName: supplier.billing_state?.stateName ?? null,
  };
}

function itemHsn(item: ChallanWithDetails['items'][number]): string {
  return item.jobWorkOrderComponent?.hsnCode ?? EM_DASH;
}

function itemSubline(item: ChallanWithDetails['items'][number]): string | null {
  const bits: string[] = [];
  if (item.componentName) bits.push(item.componentName);
  if (item.colorName) bits.push(item.colorName);
  if (item.greigeStock?.greige)
    bits.push(`Lot ${item.greigeStock.greige.greigeCode ?? item.greigeStock.id.slice(0, 8)}`);
  else if (item.fabricStock?.fabricMaster)
    bits.push(`Lot ${item.fabricStock.fabricMaster.fabricCode ?? item.fabricStock.id.slice(0, 8)}`);
  const isFreeIssue = item.rate == null && item.declaredValue == null;
  if (isFreeIssue) bits.push('Free issue');
  return bits.length > 0 ? bits.join(' · ') : null;
}

export async function buildChallanDocData(challanId: string): Promise<ChallanDocData> {
  const [company, challan] = await Promise.all([
    buildCompanyBlock(),
    prisma.challans.findUnique({ where: { id: challanId }, include: challanDocInclude }),
  ]);
  if (!challan) throw new NotFoundError('Challan', challanId);

  const isInternal = challan.fromType !== 'VENDOR' && challan.toType !== 'VENDOR';
  const isInward = challan.challanType === 'INWARD';
  const vendorPartyId = isInward ? challan.fromId : challan.toId;
  const vendorIsParty = (isInward ? challan.fromType : challan.toType) === 'VENDOR';
  const party = vendorIsParty
    ? await loadVendorParty(vendorPartyId)
    : { address: null, gstin: null, stateCode: null, stateName: null };

  // Direction: OUTWARD — company is consignor; INWARD — vendor is consignor
  const consignorName = isInward
    ? challan.fromName
    : `${company.name}, ${company.addressLine.split(',').slice(-2)[0]?.trim() ?? ''}`.replace(/,\s*$/, '');
  const consignorGstin = isInward ? party.gstin : company.gstin;
  const consigneeName = isInward ? challan.toName : challan.toName;
  const consigneeGstin = isInward ? company.gstin : party.gstin;
  const consigneeAddress = isInward ? company.addressLine : party.address;

  // Place of supply from the vendor party's GSTIN state (falls back to their billing state)
  const partyStateCode = party.stateCode;
  const partyStateName = party.stateName;
  const placeOfSupply =
    !isInternal && (partyStateName || partyStateCode)
      ? `${partyStateName ?? 'State'}${partyStateCode ? ` (${partyStateCode})` : ''}`
      : null;
  const supplyKind = partyStateCode
    ? partyStateCode === company.stateCode
      ? 'intra-state'
      : 'inter-state'
    : 'intra-state';

  // Order refs: line-level JWOs, else header JWO
  const lineOrderNumbers = [
    ...new Set(challan.items.map((i) => i.jobWorkOrder?.jobWorkNumber).filter((n): n is string => !!n)),
  ];
  if (lineOrderNumbers.length === 0 && challan.jobWorkOrder?.jobWorkNumber) {
    lineOrderNumbers.push(challan.jobWorkOrder.jobWorkNumber);
  }
  /** A consolidated dispatch: one vehicle, one processor, several job work orders. */
  const spansManyOrders = lineOrderNumbers.length > 1;

  // Items — value = declaredValue ?? qty × rate; free issue renders an em-dash.
  let runningTotal = toCurrency(0);
  const items: ChallanDocItem[] = challan.items.map((item, idx) => {
    let valueStr = EM_DASH;
    if (item.declaredValue != null) {
      runningTotal = addCurrency(runningTotal, Number(item.declaredValue));
      valueStr = fmtMoney(Number(item.declaredValue));
    } else if (item.rate != null) {
      const lineValue = roundToCent(multiplyCurrency(Number(item.quantity), Number(item.rate))).toNumber();
      runningTotal = addCurrency(runningTotal, lineValue);
      valueStr = fmtMoney(lineValue);
    }
    const orderNumber = item.jobWorkOrder?.jobWorkNumber ?? challan.jobWorkOrder?.jobWorkNumber ?? null;
    return {
      sn: idx + 1,
      description: item.description,
      subline: itemSubline(item),
      hsn: itemHsn(item),
      uom: item.unit,
      qty: fmtQty(Number(item.quantity), item.unit),
      value: valueStr,
      // The trailing sequence alone is enough when the whole challan is one order. On a
      // consolidated dispatch it is not: DJ-EBEW-003-001 and DJ-LNG226-001 would BOTH print
      // "001", so the per-line attribution the shared header depends on would be unreadable.
      orderRef: orderNumber ? (spansManyOrders ? orderNumber : (orderNumber.split('-').pop() ?? orderNumber)) : EM_DASH,
    };
  });

  const totalDeclared =
    challan.totalDeclaredValue != null ? Number(challan.totalDeclaredValue) : roundToCent(runningTotal).toNumber();

  // Sec 143 return-by: the date the SYSTEM actually tracks, not a re-derivation of it.
  // A consolidated dispatch leaves the header order null, so without the line fallback this
  // printed challanDate + 1 year − 1 day while every order on it recorded issueDate + 1 year —
  // paperwork disagreeing with the record it is evidence for. Orders dispatched together share
  // one issue date, so any line's date is the whole challan's date.
  const returnBy =
    challan.jobWorkOrder?.statutoryDueDate ??
    challan.items.find((i) => i.jobWorkOrder?.statutoryDueDate)?.jobWorkOrder?.statutoryDueDate ??
    (() => {
      const d = new Date(challan.challanDate);
      d.setFullYear(d.getFullYear() + 1);
      d.setDate(d.getDate() - 1);
      return d;
    })();

  const movementLabel = isInternal ? 'Internal Transfer' : isInward ? 'Inward · Job Work Return' : 'Outward · Job Work';

  return {
    company,
    docNo: challan.challanNumber,
    docPill: isInternal ? 'Internal movement' : 'Rule 55 · Not a tax invoice',
    movementLabel,
    showGst: !isInternal,
    consignorName,
    consignorGstin: consignorGstin ?? null,
    consigneeName,
    consigneeAddress,
    consigneeGstin: consigneeGstin ?? null,
    placeOfSupply,
    supplyKind,
    challanDate: fmtDate(challan.challanDate),
    reason: challan.reasonForTransport ?? (isInternal ? 'Internal transfer' : 'Job work — not a supply'),
    againstOrders: lineOrderNumbers.length > 0 ? lineOrderNumbers.join(', ') : null,
    ewayBill: challan.ewayBillNumber
      ? `${challan.ewayBillNumber}${challan.ewayBillDate ? ` · ${fmtDate(challan.ewayBillDate)}` : ''}`
      : null,
    vehicleLr:
      challan.vehicleNumber || challan.lrNumber
        ? [challan.vehicleNumber, challan.lrNumber ? `LR ${challan.lrNumber}` : null].filter(Boolean).join(' · ')
        : null,
    goodsBanner: isInward ? 'Returned to consignor' : 'Title retained by consignor',
    items,
    totalValue: fmtMoney(totalDeclared),
    returnByDate: fmtDate(returnBy),
  };
}

export const CHALLAN_COPY_MARKS = ['Original for Consignee', 'Duplicate for Transporter', 'Triplicate for Consignor'];
