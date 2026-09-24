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
import { unitHeader } from '../../utils/units';
import { foldActual, foldCounted, hasFold } from '../../utils/fold-length';

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
  // Bale/than-level issue details when issued with detail selection
  greigeIssueDetails: {
    include: {
      greigeStockDetail: {
        select: {
          id: true,
          greigeStockId: true,
          baleNumber: true,
          sequenceNo: true,
          meters: true,
          baleNo: true,
          thanNo: true,
        },
      },
    },
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

/** Bale/than detail issued as part of this challan (for bale/than-level issuance) */
export interface ChallanIssueDetail {
  baleNumber: number | null;
  sequenceNo: number;
  meters: string;
  metersIssued: string;
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
  /** Bale/than-level issue details when issued with detail selection */
  issueDetails: ChallanIssueDetail[] | null;
  /**
   * Packing list: the thans that left, one line per bale (printed bale / than numbers where known).
   * Than metres are the COUNTED tag figures; the goods table above is in ACTUAL metres.
   */
  thanList: Array<{ bale: string; baleNote: string; thans: string; count: number; metres: string }> | null;
  thanListTotal: { count: number; metres: string; actualNote: string | null } | null;
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

/**
 * A line's quantity is ACTUAL metres; a line moved at fold L also prints the counted figure. When the
 * challan carries than tags (one folded line), their sum IS the counted figure — deriving it back from
 * the rounded actual could print a figure 0.01 off the tags printed below it.
 */
function itemSubline(item: ChallanWithDetails['items'][number], countedTagSum: number | null): string | null {
  const bits: string[] = [];
  if (hasFold(item.foldLengthCm)) {
    // With a packing list the tag total is printed there, beside the thans it adds up
    if (countedTagSum == null) {
      const counted = foldCounted(item.quantity, item.foldLengthCm).toNumber();
      bits.push(`${fmtQty(counted, item.unit)} m on the than tags (fold ${Number(item.foldLengthCm)} cm)`);
    } else bits.push('thans listed below');
  }
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
  const foldedLines = challan.items.filter((i) => hasFold(i.foldLengthCm)).length;
  const countedTagSum =
    foldedLines === 1 && challan.greigeIssueDetails && challan.greigeIssueDetails.length > 0
      ? addCurrency(...challan.greigeIssueDetails.map((d) => Number(d.metersIssued))).toNumber()
      : null;
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
      subline: itemSubline(item, hasFold(item.foldLengthCm) ? countedTagSum : null),
      hsn: itemHsn(item),
      uom: unitHeader(item.unit),
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
    // Bale/than-level issue details when issued with detail selection
    issueDetails:
      challan.greigeIssueDetails && challan.greigeIssueDetails.length > 0
        ? challan.greigeIssueDetails.map((d) => ({
            baleNumber: d.greigeStockDetail?.baleNumber ?? null,
            sequenceNo: d.greigeStockDetail?.sequenceNo ?? 0,
            meters: fmtQty(Number(d.greigeStockDetail?.meters ?? 0), 'MTR'),
            metersIssued: fmtQty(Number(d.metersIssued), 'MTR'),
          }))
        : null,
    ...(await thanPackingList(
      challan.id,
      challan.greigeIssueDetails ?? [],
      foldedLines === 1 ? Number(challan.items.find((i) => hasFold(i.foldLengthCm))?.foldLengthCm) : null,
      foldedLines === 1 ? Number(challan.items.find((i) => hasFold(i.foldLengthCm))?.quantity) : null
    )),
  };
}

/**
 * The packing list: the thans on this challan, one line per bale, thans in number order (2026-09-24).
 * Each bale says whether it went WHOLE or in part — and, for a part bale, where its other thans went
 * (another job's challan on the same trip, or still in the godown), so a bale split between two jobs
 * does not read as a broken bale. Than metres are the TAG figures; the total line converts them once
 * at the lot's fold length, in words, to the ACTUAL metres the goods table is in.
 */
async function thanPackingList(
  challanId: string,
  rows: ChallanWithDetails['greigeIssueDetails'],
  foldLengthCm: number | null,
  lineQty: number | null
): Promise<Pick<ChallanDocData, 'thanList' | 'thanListTotal'>> {
  if (rows.length === 0) return { thanList: null, thanListTotal: null };

  type Bale = {
    lotId: string;
    baleNumber: number | null;
    label: string;
    thans: Array<{ seq: number; text: string }>;
    metres: number;
  };
  const bales = new Map<string, Bale>();
  for (const r of rows) {
    const d = r.greigeStockDetail;
    const key = d.baleNumber != null ? `${d.greigeStockId}:${d.baleNumber}` : `loose:${d.id}`;
    const bale = bales.get(key) ?? {
      lotId: d.greigeStockId,
      baleNumber: d.baleNumber,
      label: d.baleNo ?? (d.baleNumber != null ? String(d.baleNumber) : 'Loose'),
      thans: [],
      metres: 0,
    };
    const tag = d.thanNo ?? `T${d.sequenceNo}`;
    bale.thans.push({ seq: d.sequenceNo, text: `${tag} (${fmtQty(Number(r.metersIssued), 'MTR')})` });
    bale.metres += Number(r.metersIssued);
    bales.set(key, bale);
  }

  // Where the rest of each bale is: the bale's size, and its thans issued on OTHER challans
  const baled = [...bales.values()].filter((b) => b.baleNumber != null);
  const pairs = baled.map((b) => ({ greigeStockId: b.lotId, baleNumber: b.baleNumber as number }));
  const [sizes, elsewhere] =
    pairs.length > 0
      ? await Promise.all([
          prisma.greige_stock_details.groupBy({
            by: ['greigeStockId', 'baleNumber'],
            where: { OR: pairs },
            _count: { _all: true },
          }),
          prisma.greige_issue_details.findMany({
            where: { challanId: { not: challanId }, greigeStockDetail: { OR: pairs } },
            select: {
              greigeStockDetail: { select: { greigeStockId: true, baleNumber: true } },
              challan: { select: { challanNumber: true } },
              jobWorkOrder: { select: { jobWorkNumber: true } },
            },
          }),
        ])
      : [[], []];

  const note = (b: Bale): string => {
    if (b.baleNumber == null) return 'Loose than';
    const size = sizes.find((x) => x.greigeStockId === b.lotId && x.baleNumber === b.baleNumber)?._count._all ?? 0;
    if (b.thans.length >= size) return 'Full bale';
    const others = elsewhere.filter(
      (e) => e.greigeStockDetail.greigeStockId === b.lotId && e.greigeStockDetail.baleNumber === b.baleNumber
    );
    const byDoc = new Map<string, number>();
    for (const e of others) {
      const doc =
        [e.challan?.challanNumber, e.jobWorkOrder?.jobWorkNumber].filter(Boolean).join(' · ') || 'another issue';
      byDoc.set(doc, (byDoc.get(doc) ?? 0) + 1);
    }
    const parts = [...byDoc.entries()].map(([doc, n]) => `${n} on ${doc}`);
    const left = size - b.thans.length - others.length;
    if (left > 0) parts.push(`${left} still in godown`);
    return `Part bale — ${b.thans.length} of ${size} thans; ${parts.join(', ')}`;
  };

  const list = [...bales.values()].sort(
    (a, b) => (a.baleNumber ?? Number.MAX_SAFE_INTEGER) - (b.baleNumber ?? Number.MAX_SAFE_INTEGER)
  );
  const totalTag = addCurrency(...rows.map((r) => Number(r.metersIssued))).toNumber();
  let actualNote: string | null = null;
  if (foldLengthCm != null && hasFold(foldLengthCm)) {
    const actual = foldActual(totalTag, foldLengthCm).toNumber();
    actualNote = `At fold ${foldLengthCm} cm, ${fmtQty(totalTag, 'MTR')} tag metres × ${foldLengthCm}/100 = ${fmtQty(actual, 'MTR')} m actual`; // allow-fold-math (printed wording; the figure is foldActual)
    if (lineQty != null && Math.abs(actual - lineQty) >= 0.005) {
      actualNote += ` (the order is ${fmtQty(lineQty, 'MTR')} m — whole thans, none cut)`;
    }
  }
  return {
    thanList: list.map((b) => ({
      bale: b.label,
      baleNote: note(b),
      thans: b.thans
        .sort((x, y) => x.seq - y.seq)
        .map((t) => t.text)
        .join(', '),
      count: b.thans.length,
      metres: fmtQty(b.metres, 'MTR'),
    })),
    thanListTotal: { count: rows.length, metres: fmtQty(totalTag, 'MTR'), actualNote },
  };
}

export const CHALLAN_COPY_MARKS = ['Original for Consignee', 'Duplicate for Transporter', 'Triplicate for Consignor'];
