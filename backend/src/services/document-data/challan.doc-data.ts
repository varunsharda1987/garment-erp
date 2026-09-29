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
import { isQtyZero, qtyRemaining } from '../../utils/quantity';
import { listStateOf } from '../helpers/lot-pieces.helper';

const FABRIC_PIECE_SELECT = {
  id: true,
  fabricStockId: true,
  baleNumber: true,
  sequenceNo: true,
  meters: true,
  baleNo: true,
  thanNo: true,
  detailType: true,
  source: true,
} satisfies Prisma.fabric_stock_detailsSelect;

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
          detailType: true,
        },
      },
    },
  },
  // A finished-fabric lot's rolls / thans that left on this challan (issue to cutting, a job, a send-out)…
  fabricIssueDetails: { select: { metersIssued: true, piece: { select: FABRIC_PIECE_SELECT } } },
  // …and the ones that came back on it (a return from cutting)
  fabricReturnDetails: {
    select: { metersIssued: true, metersReturned: true, piece: { select: FABRIC_PIECE_SELECT } },
  },
  // The batch a return from cutting came from — its end pieces say "End from <batch>"
  cuttingBatch: { select: { batchNumber: true } },
  cuttingBatchReturn: { select: { batchNumber: true } },
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
  /**
   * Where the goods physically left — our store, or "Supplied directly by <supplier>" for goods a
   * supplier delivered straight to the job worker. Null on old challans that still read the made-up
   * "Main Warehouse" (they reprint as they were issued).
   */
  despatchedFrom: string | null;
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
  /** The day a breach is deemed a supply from — the day the job worker received the goods */
  deemedFromDate: string;
  /** Bale/than-level issue details when issued with detail selection */
  issueDetails: ChallanIssueDetail[] | null;
  /**
   * Packing list: the thans that left, one line per bale (printed bale / than numbers where known).
   * Than metres are the COUNTED tag figures; the goods table above is in ACTUAL metres.
   */
  thanList: Array<{ bale: string; baleNote: string; thans: string; count: number; metres: string }> | null;
  thanListTotal: { count: number; metres: string; actualNote: string | null } | null;
  /** The packing list's headings — rolls are rolls (2026-09-28); the template falls back to the than words */
  thanListLabels: { group: string; pieceNo: string; count: string; total: string } | null;
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
  const packing = await packingFor(challan);
  const { countedTagSum } = packing;
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

  // Goods a supplier delivered straight to the job worker (Rule 45): the challan's expectedDate is
  // the year from the day the job worker received them — which a late challan is dated after.
  const isDirectSupply = challan.directSupplyGrnId != null;
  const receivedByJobWorker =
    isDirectSupply && challan.expectedDate
      ? (() => {
          const d = new Date(challan.expectedDate);
          d.setFullYear(d.getFullYear() - 1);
          return d;
        })()
      : null;

  // Sec 143 return-by: the date the SYSTEM actually tracks, not a re-derivation of it.
  // A consolidated dispatch leaves the header order null, so without the line fallback this
  // printed challanDate + 1 year − 1 day while every order on it recorded issueDate + 1 year —
  // paperwork disagreeing with the record it is evidence for. Orders dispatched together share
  // one issue date, so any line's date is the whole challan's date.
  const returnBy =
    (isDirectSupply ? challan.expectedDate : null) ??
    challan.jobWorkOrder?.statutoryDueDate ??
    challan.items.find((i) => i.jobWorkOrder?.statutoryDueDate)?.jobWorkOrder?.statutoryDueDate ??
    (() => {
      const d = new Date(challan.challanDate);
      d.setFullYear(d.getFullYear() + 1);
      d.setDate(d.getDate() - 1);
      return d;
    })();

  const movementLabel = isInternal
    ? 'Internal Transfer'
    : isInward
      ? 'Inward · Job Work Return'
      : isDirectSupply
        ? 'Outward · Job Work · Delivered direct'
        : 'Outward · Job Work';
  // "Main Warehouse" was a name printed on every job challan until 2026-09-25 that exists nowhere
  const despatchedFrom =
    !isInward && challan.fromName && challan.fromName !== 'Main Warehouse' ? challan.fromName : null;

  return {
    company,
    docNo: challan.challanNumber,
    docPill: isInternal ? 'Internal movement' : 'Rule 55 · Not a tax invoice',
    movementLabel,
    showGst: !isInternal,
    consignorName,
    consignorGstin: consignorGstin ?? null,
    despatchedFrom,
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
    deemedFromDate: fmtDate(receivedByJobWorker ?? challan.challanDate),
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
    ...packing.list,
  };
}

type PackingList = Pick<ChallanDocData, 'thanList' | 'thanListTotal' | 'thanListLabels'>;

/**
 * The challan's packing list, and the tag total the one folded line's subline refers to ("thans listed below")
 * — null when there is no list, or no single folded line, and the subline prints the counted figure itself.
 */
async function packingFor(challan: ChallanWithDetails): Promise<{ list: PackingList; countedTagSum: number | null }> {
  const foldedLines = challan.items.filter((i) => hasFold(i.foldLengthCm)).length;
  if (challan.directSupplyGrnId != null) {
    const arrived = await arrivedPieces(challan);
    return {
      list: await thanPackingList(challan.id, arrived.rows, arrived.foldLengthCm, null, 'OUT'),
      countedTagSum:
        foldedLines === 1 && arrived.rows.length > 0
          ? addCurrency(...arrived.rows.map((r) => r.metres)).toNumber()
          : null,
    };
  }
  return {
    list: await packingListOf(challan, foldedLines),
    countedTagSum:
      foldedLines === 1 && challan.greigeIssueDetails.length > 0
        ? addCurrency(...challan.greigeIssueDetails.map((d) => Number(d.metersIssued))).toNumber()
        : null,
  };
}

/**
 * The packing list alone — what the challan page shows under its items. The same list the print carries,
 * from the same code.
 */
export async function buildChallanPackingList(challanId: string): Promise<PackingList | null> {
  const challan = await prisma.challans.findUnique({ where: { id: challanId }, include: challanDocInclude });
  if (!challan) throw new NotFoundError('Challan', challanId);
  const { list } = await packingFor(challan);
  return list.thanList ? list : null;
}

/**
 * The pieces that ARRIVED at the processor under a direct-supply challan (goods a supplier delivered straight
 * to the job worker, Rule 45): each lot's pieces as they stood when the challan was made — the receipt's than
 * / bale / roll list for a live GRN (2026-09-29: CH2609-2129 printed 3,583 m and none of its 10 thans).
 *
 * Not the challan's greige_issue_details: those are jobs DRAWING the cloth where it lies (issuance names the
 * lot's covering challan on each than it takes), not goods that moved on it — CH2609-0996 printed the 7 rolls
 * its jobs drew as "Rolls despatched" instead of the 14 that arrived. A lot whose pieces do not agree with its
 * line (listStateOf, ±1%) prints no list rather than a wrong one: CH2609-0999 covers the 421.5 m left of a lot
 * drawn by quantity before the challan existed, and nothing says which of its 7 rolls those metres are.
 */
async function arrivedPieces(challan: ChallanWithDetails): Promise<{ rows: PackedRow[]; foldLengthCm: number | null }> {
  const madeAt = challan.createdAt;
  const lineQty = new Map<string, number>();
  for (const i of challan.items) {
    const lotId = i.greigeStockId ?? i.fabricStockId;
    if (lotId) lineQty.set(lotId, addCurrency(lineQty.get(lotId) ?? 0, Number(i.quantity)).toNumber());
  }
  const greigeIds = [...new Set(challan.items.map((i) => i.greigeStockId).filter((id): id is string => !!id))];
  const fabricIds = [...new Set(challan.items.map((i) => i.fabricStockId).filter((id): id is string => !!id))];
  if (greigeIds.length === 0 && fabricIds.length === 0) return { rows: [], foldLengthCm: null };

  const [greigeLots, greigePieces, takenBefore, fabricLots, fabricPieces] = await Promise.all([
    greigeIds.length > 0
      ? prisma.greige_stock.findMany({ where: { id: { in: greigeIds } }, select: { id: true, foldLengthCm: true } })
      : [],
    greigeIds.length > 0
      ? prisma.greige_stock_details.findMany({
          where: { greigeStockId: { in: greigeIds }, createdAt: { lte: madeAt } },
          select: {
            id: true,
            greigeStockId: true,
            baleNumber: true,
            sequenceNo: true,
            meters: true,
            baleNo: true,
            thanNo: true,
            detailType: true,
          },
        })
      : [],
    // A late challan (the one-time conversion of lots already at a dyer) covers only what was left: thans or
    // metres issued before it existed did not arrive under it
    greigeIds.length > 0
      ? prisma.greige_issue_details.groupBy({
          by: ['greigeStockDetailId'],
          where: { greigeStockDetail: { greigeStockId: { in: greigeIds } }, createdAt: { lt: madeAt } },
          _sum: { metersIssued: true },
        })
      : [],
    fabricIds.length > 0
      ? prisma.fabric_stock.findMany({ where: { id: { in: fabricIds } }, select: { id: true, foldLengthCm: true } })
      : [],
    // A direct-supply fabric lot is booked in the same transaction as its challan, so its receipt pieces are
    // all there is to list
    fabricIds.length > 0
      ? prisma.fabric_stock_details.findMany({
          where: { fabricStockId: { in: fabricIds }, source: 'RECEIPT', createdAt: { lte: madeAt } },
          select: FABRIC_PIECE_SELECT,
        })
      : [],
  ]);
  const taken = new Map(takenBefore.map((t) => [t.greigeStockDetailId, Number(t._sum.metersIssued ?? 0)]));

  const byLot = new Map<string, PackedRow[]>();
  const add = (row: PackedRow) => {
    const lotRows = byLot.get(row.lotId);
    if (lotRows) lotRows.push(row);
    else byLot.set(row.lotId, [row]);
  };
  for (const p of greigePieces) {
    const metres = qtyRemaining(Number(p.meters), taken.get(p.id) ?? 0);
    if (!isQtyZero(metres)) add({ stock: 'GREIGE', lotId: p.greigeStockId, piece: p, metres });
  }
  for (const p of fabricPieces) add({ stock: 'FABRIC', lotId: p.fabricStockId, piece: p, metres: Number(p.meters) });

  const lotFold = new Map(
    [...greigeLots, ...fabricLots].map((l) => [l.id, l.foldLengthCm != null ? Number(l.foldLengthCm) : null])
  );
  const rows: PackedRow[] = [];
  const folds = new Set<number | null>();
  for (const [lotId, lotRows] of byLot) {
    // Piece metres are the COUNTED tag figures; the line is ACTUAL metres
    const listActual = foldActual(addCurrency(...lotRows.map((r) => r.metres)), lotFold.get(lotId) ?? null);
    const state = listStateOf({
      piecesRecorded: lotRows.length,
      listActual: listActual.toNumber(),
      onHand: lineQty.get(lotId) ?? 0,
    });
    if (state !== 'IN_STEP') continue;
    rows.push(...lotRows);
    folds.add(lotFold.get(lotId) ?? null);
  }
  return { rows, foldLengthCm: folds.size === 1 ? [...folds][0] : null };
}

/** One piece on the packing list: which lot, the piece, and the COUNTED metres it moved on this challan. */
interface PackedRow {
  stock: 'GREIGE' | 'FABRIC';
  lotId: string;
  piece: {
    id: string;
    baleNumber: number | null;
    sequenceNo: number;
    baleNo: string | null;
    thanNo: string | null;
    detailType: string;
  };
  metres: number;
  /** A finished-fabric end piece — the metres a cutting batch sent back that were not whole rolls */
  isEnd?: boolean;
}

/**
 * The pieces this challan moved: a greige job's thans, or a finished-fabric lot's rolls / thans issued on it
 * (to cutting, a job, a send-out) or returned on it (from cutting — the rolls back whole plus the batch's end
 * piece, marked "(end)").
 */
async function packingListOf(
  challan: ChallanWithDetails,
  foldedLines: number
): Promise<Pick<ChallanDocData, 'thanList' | 'thanListTotal' | 'thanListLabels'>> {
  if (challan.greigeIssueDetails.length > 0) {
    const folded = challan.items.find((i) => hasFold(i.foldLengthCm));
    return thanPackingList(
      challan.id,
      challan.greigeIssueDetails.map((d) => ({
        stock: 'GREIGE' as const,
        lotId: d.greigeStockDetail.greigeStockId,
        piece: d.greigeStockDetail,
        metres: Number(d.metersIssued),
      })),
      foldedLines === 1 ? Number(folded?.foldLengthCm) : null,
      foldedLines === 1 ? Number(folded?.quantity) : null,
      'OUT'
    );
  }

  const issued: PackedRow[] = challan.fabricIssueDetails.map((r) => ({
    stock: 'FABRIC',
    lotId: r.piece.fabricStockId,
    piece: r.piece,
    metres: Number(r.metersIssued),
  }));
  const back: PackedRow[] = challan.fabricReturnDetails.map((r) => ({
    stock: 'FABRIC',
    lotId: r.piece.fabricStockId,
    piece: r.piece,
    metres: Number(r.metersReturned ?? r.metersIssued),
  }));
  // A return from cutting also brings the batch's end piece of each lot on it (settleLotBack names it
  // "End from <batch>"; a batch completes once, so there is one per lot at most)
  const batchNumber = challan.cuttingBatch?.batchNumber ?? challan.cuttingBatchReturn?.batchNumber ?? null;
  const returnLots = [...new Set(challan.items.map((i) => i.fabricStockId).filter((id): id is string => !!id))];
  if (challan.fromName === 'Cutting' && batchNumber && returnLots.length > 0) {
    const ends = await prisma.fabric_stock_details.findMany({
      where: { fabricStockId: { in: returnLots }, source: 'END', remarks: `End from ${batchNumber}` },
      select: FABRIC_PIECE_SELECT,
    });
    for (const e of ends) {
      back.push({ stock: 'FABRIC', lotId: e.fabricStockId, piece: e, metres: Number(e.meters), isEnd: true });
    }
  }
  const rows = issued.length > 0 ? issued : back;
  if (rows.length === 0) return { thanList: null, thanListTotal: null, thanListLabels: null };

  // The fold the pieces are counted at is the lot's; one fold across the list, or no conversion line
  const lots = await prisma.fabric_stock.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.lotId))] } },
    select: { foldLengthCm: true },
  });
  const folds = new Set(lots.map((l) => (l.foldLengthCm != null ? Number(l.foldLengthCm) : null)));
  const fold = folds.size === 1 ? [...folds][0] : null;
  return thanPackingList(challan.id, rows, fold, null, issued.length > 0 ? 'OUT' : 'BACK');
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
  rows: PackedRow[],
  foldLengthCm: number | null,
  lineQty: number | null,
  /** OUT: the pieces left on this challan; BACK: they came back on it (a return from cutting) */
  direction: 'OUT' | 'BACK'
): Promise<Pick<ChallanDocData, 'thanList' | 'thanListTotal' | 'thanListLabels'>> {
  if (rows.length === 0) return { thanList: null, thanListTotal: null, thanListLabels: null };
  const rolls = rows.filter((r) => r.piece.detailType === 'ROLL').length;
  const moved = direction === 'BACK' ? 'returned' : 'despatched';
  const thanListLabels =
    rolls === 0
      ? { group: 'Bale', pieceNo: 'Than no. (tag metres)', count: 'Thans', total: `Thans ${moved}` }
      : rolls === rows.length
        ? { group: 'Rolls', pieceNo: 'Roll No. (tag metres)', count: 'Rolls', total: `Rolls ${moved}` }
        : {
            group: 'Bale / Rolls',
            pieceNo: 'Than / Roll No. (tag metres)',
            count: 'Pieces',
            total: `Pieces ${moved}`,
          };

  type Bale = {
    stock: PackedRow['stock'];
    lotId: string;
    baleNumber: number | null;
    label: string;
    /** A lot's rolls, listed together (rolls are never baled) */
    isRolls: boolean;
    /** A fabric lot's end piece back from cutting */
    isEnd: boolean;
    thans: Array<{ seq: number; text: string }>;
    metres: number;
  };
  const bales = new Map<string, Bale>();
  for (const r of rows) {
    const d = r.piece;
    const isRoll = d.detailType === 'ROLL';
    // Rolls are never baled: one line per lot. A loose than keeps its own line; a baled than joins its bale; an
    // end piece stands alone.
    const key = r.isEnd
      ? `end:${d.id}`
      : isRoll
        ? `rolls:${r.lotId}`
        : d.baleNumber != null
          ? `${r.lotId}:${d.baleNumber}`
          : `loose:${d.id}`;
    const bale = bales.get(key) ?? {
      stock: r.stock,
      lotId: r.lotId,
      baleNumber: isRoll || r.isEnd ? null : d.baleNumber,
      label: r.isEnd
        ? 'End piece'
        : isRoll
          ? 'Rolls'
          : (d.baleNo ?? (d.baleNumber != null ? String(d.baleNumber) : 'Loose')),
      isRolls: isRoll,
      isEnd: !!r.isEnd,
      thans: [],
      metres: 0,
    };
    const tag = r.isEnd ? 'End' : (d.thanNo ?? `${isRoll ? 'R' : 'T'}${d.sequenceNo}`);
    bale.thans.push({
      seq: d.sequenceNo,
      text: `${tag} (${fmtQty(r.metres, 'MTR')})${r.isEnd ? ' (end)' : ''}`,
    });
    bale.metres += r.metres;
    bales.set(key, bale);
  }

  // Where the rest of each bale is: the bale's size, and its thans issued on OTHER challans — for pieces going
  // OUT only (a return lists what came back)
  const baled = direction === 'OUT' ? [...bales.values()].filter((b) => b.baleNumber != null) : [];
  const greigePairs = baled
    .filter((b) => b.stock === 'GREIGE')
    .map((b) => ({ greigeStockId: b.lotId, baleNumber: b.baleNumber as number }));
  const fabricPairs = baled
    .filter((b) => b.stock === 'FABRIC')
    .map((b) => ({ fabricStockId: b.lotId, baleNumber: b.baleNumber as number }));
  const [greigeSizes, greigeElsewhere, fabricSizes, fabricElsewhere] = await Promise.all([
    greigePairs.length > 0
      ? prisma.greige_stock_details.groupBy({
          by: ['greigeStockId', 'baleNumber'],
          where: { OR: greigePairs },
          _count: { _all: true },
        })
      : [],
    greigePairs.length > 0
      ? prisma.greige_issue_details.findMany({
          where: { challanId: { not: challanId }, greigeStockDetail: { OR: greigePairs } },
          select: {
            greigeStockDetail: { select: { greigeStockId: true, baleNumber: true } },
            challan: { select: { challanNumber: true } },
            jobWorkOrder: { select: { jobWorkNumber: true } },
          },
        })
      : [],
    fabricPairs.length > 0
      ? prisma.fabric_stock_details.groupBy({
          by: ['fabricStockId', 'baleNumber'],
          where: { OR: fabricPairs },
          _count: { _all: true },
        })
      : [],
    fabricPairs.length > 0
      ? prisma.fabric_issue_details.findMany({
          where: { challanId: { not: challanId }, piece: { OR: fabricPairs } },
          select: {
            piece: { select: { fabricStockId: true, baleNumber: true } },
            challan: { select: { challanNumber: true } },
            cuttingBatch: { select: { batchNumber: true } },
            jobWorkOrder: { select: { jobWorkNumber: true } },
          },
        })
      : [],
  ]);
  // One shape for both stocks: a bale's size, and each of its thans issued elsewhere with the document it went on
  const sizes = [
    ...greigeSizes.map((x) => ({ lotId: x.greigeStockId, baleNumber: x.baleNumber, count: x._count._all })),
    ...fabricSizes.map((x) => ({ lotId: x.fabricStockId, baleNumber: x.baleNumber, count: x._count._all })),
  ];
  const elsewhere = [
    ...greigeElsewhere.map((e) => ({
      lotId: e.greigeStockDetail.greigeStockId,
      baleNumber: e.greigeStockDetail.baleNumber,
      doc: [e.challan?.challanNumber, e.jobWorkOrder?.jobWorkNumber].filter(Boolean).join(' · '),
    })),
    ...fabricElsewhere.map((e) => ({
      lotId: e.piece.fabricStockId,
      baleNumber: e.piece.baleNumber,
      doc: [e.challan?.challanNumber, e.cuttingBatch?.batchNumber ?? e.jobWorkOrder?.jobWorkNumber]
        .filter(Boolean)
        .join(' · '),
    })),
  ];

  const note = (b: Bale): string => {
    if (b.isEnd) return direction === 'BACK' ? 'Left over from cutting' : '';
    if (b.isRolls || direction === 'BACK') return '';
    if (b.baleNumber == null) return 'Loose than';
    const size = sizes.find((x) => x.lotId === b.lotId && x.baleNumber === b.baleNumber)?.count ?? 0;
    if (b.thans.length >= size) return 'Full bale';
    const others = elsewhere.filter((e) => e.lotId === b.lotId && e.baleNumber === b.baleNumber);
    const byDoc = new Map<string, number>();
    for (const e of others) {
      const doc = e.doc || 'another issue';
      byDoc.set(doc, (byDoc.get(doc) ?? 0) + 1);
    }
    const parts = [...byDoc.entries()].map(([doc, n]) => `${n} on ${doc}`);
    const left = size - b.thans.length - others.length;
    if (left > 0) parts.push(`${left} still in godown`);
    return `Part bale — ${b.thans.length} of ${size} thans; ${parts.join(', ')}`;
  };

  // Bales in number order, then loose thans and rolls, the end piece last
  const list = [...bales.values()].sort(
    (a, b) =>
      Number(a.isEnd) - Number(b.isEnd) ||
      (a.baleNumber ?? Number.MAX_SAFE_INTEGER) - (b.baleNumber ?? Number.MAX_SAFE_INTEGER)
  );
  const totalTag = addCurrency(...rows.map((r) => r.metres)).toNumber();
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
    thanListLabels,
  };
}

export const CHALLAN_COPY_MARKS = ['Original for Consignee', 'Duplicate for Transporter', 'Triplicate for Consignor'];
