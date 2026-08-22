/**
 * Goods Receipt Note — data adapter for the kf grn template.
 * One root Prisma query on goods_receiving_notes.
 *
 * Two shapes off one template:
 *  - Job-work return (jobWorkOrderId set): Sec 02 reconciliation against the
 *    JWO issue, Sec 03 valuation posted to stock (material at rateAtIssue +
 *    conversion charges, GST excluded).
 *  - Plain material GRN (PO receipt): Sec 02 per-line ordered/received/
 *    accepted/rejected; Sec 03 hidden.
 */
import prisma from '../../config/database';
import { Prisma } from '@prisma/client';
import { NotFoundError } from '../../errors';
import {
  addCurrency,
  divideCurrency,
  isZero,
  multiplyCurrency,
  roundToCent,
  subtractCurrency,
  toCurrency,
} from '../../utils/currency';
import { buildCompanyBlock, CompanyBlock } from './company-block';
import { EM_DASH, fmtDate, fmtMoney, fmtPct, fmtQty } from './format';

const grnDocInclude = {
  suppliers: {
    select: {
      name: true,
      gst_numbers: { where: { isPrimary: true }, select: { gstNumber: true }, take: 1 },
    },
  },
  jobWorkOrder: {
    select: {
      jobWorkNumber: true,
      processType: true,
      sentDate: true,
      challanNumber: true,
      statutoryDueDate: true,
      qtySentMeters: true,
      qtyReceivedMeters: true,
      qtyNormalLoss: true,
      qtyAbnormalLoss: true,
      tolerancePercent: true,
      agreedRatePerMeter: true,
      uom: true,
      totalTaxAmount: true,
      buttonholeCount: true,
      buttonCount: true,
      buttonholeRatePerUnit: true,
      buttonRatePerUnit: true,
      processTypeMaster: { select: { name: true, code: true, sacCode: true, tolerancePercent: true } },
      components: { select: { qtySent: true, rateAtIssue: true, rate: true, isChargeable: true } },
    },
  },
  purchase_orders: { select: { poNumber: true } },
  grn_items: {
    include: {
      materials: { select: { name: true, code: true } },
      grn_item_details: { select: { detailType: true, baleNumber: true, sequenceNo: true, meters: true } },
    },
  },
  users_goods_receiving_notes_receivedByIdTousers: { select: { firstName: true, lastName: true } },
  users_goods_receiving_notes_approvedByIdTousers: { select: { firstName: true, lastName: true } },
} satisfies Prisma.goods_receiving_notesInclude;

export type GrnWithDetails = Prisma.goods_receiving_notesGetPayload<{ include: typeof grnDocInclude }>;

export interface GrnDocLine {
  sn: number;
  material: string;
  subline: string | null;
  uom: string;
  ordered: string;
  received: string;
  accepted: string;
  rejected: string;
  /** Bale/than details when entry mode is BALE_WISE or THAN_WISE */
  details: Array<{ baleNumber: number | null; sequenceNo: number; meters: string }> | null;
  entryMode: string | null;
}

export interface GrnReconBlock {
  issuedQty: string;
  issuedPct: string;
  issuedRemark: string;
  acceptedQty: string;
  acceptedPct: string;
  rejectedQty: string;
  rejectedPct: string;
  rejectedRemark: string;
  normalLossQty: string;
  normalLossPct: string;
  abnormalLossQty: string;
  abnormalLossPct: string;
  abnormalRemark: string;
  balanceQty: string;
  balancePct: string;
  balanceRemark: string;
}

export interface GrnValuationBlock {
  materialValue: string;
  jobChargesBasis: string;
  jobCharges: string;
  fgValue: string;
  fgRateLabel: string;
  fgRate: string;
  gstExcluded: string;
  normalLossNote: string | null;
  abnormalNote: string;
}

export interface GrnDocData {
  company: CompanyBlock;
  docNo: string;
  docPill: string;
  isJobWork: boolean;
  contextBanner: string;
  partyLabel: string;
  supplierName: string;
  supplierGstin: string | null;
  processLabel: string | null;
  vendorDocLabel: string;
  vendorDocRef: string;
  receiptDate: string;
  issuedOn: string | null;
  issuedDaysOut: string | null;
  statutoryDue: string | null;
  statutoryStatus: string | null;
  inspectedBy: string;
  sec02Title: string;
  sec02Banner: string;
  uomLabel: string;
  tolerancePct: string | null;
  recon: GrnReconBlock | null;
  lines: GrnDocLine[];
  totalAccepted: string;
  totalRejected: string;
  valuation: GrnValuationBlock | null;
}

/** "PCS" → "Pcs" (column header), "piece" (prose), "pcs" (inline count) */
function uomForms(uom: string): { header: string; word: string; short: string } {
  const u = uom.toUpperCase();
  if (u === 'PCS') return { header: 'Pcs', word: 'piece', short: 'pcs' };
  if (u === 'MTR') return { header: 'Mtr', word: 'metre', short: 'mtr' };
  if (u === 'KG') return { header: 'Kg', word: 'kg', short: 'kg' };
  return { header: uom, word: uom.toLowerCase(), short: uom.toLowerCase() };
}

function userName(user: { firstName: string; lastName: string } | null | undefined): string | null {
  if (!user) return null;
  return `${user.firstName} ${user.lastName}`.trim();
}

/** share of issued, 1dp, no % suffix (column header carries it) — em-dash when issued is 0 or qty missing */
function pctOfIssued(qty: Prisma.Decimal | number | string | null, issued: ReturnType<typeof toCurrency>): string {
  if (qty === null || qty === undefined) return EM_DASH;
  if (isZero(issued)) return EM_DASH;
  const share = divideCurrency(multiplyCurrency(toCurrency(qty.toString()), 100), issued);
  return share.toNumber().toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export async function buildGrnDocData(grnId: string): Promise<GrnDocData> {
  const [company, grn] = await Promise.all([
    buildCompanyBlock(),
    prisma.goods_receiving_notes.findUnique({ where: { id: grnId }, include: grnDocInclude }),
  ]);
  if (!grn) throw new NotFoundError('GRN', grnId);
  return transformGrn(company, grn);
}

/** Pure transform — split from the loader so previews/tests can exercise it with a fixture record. */
export function transformGrn(company: CompanyBlock, grn: GrnWithDetails): GrnDocData {
  const jwo = grn.jobWorkOrder;
  const isJobWork = grn.jobWorkOrderId != null && jwo != null;

  const supplierGstin = grn.suppliers.gst_numbers[0]?.gstNumber ?? null;
  const receiver = userName(grn.users_goods_receiving_notes_receivedByIdTousers);
  const approver = userName(grn.users_goods_receiving_notes_approvedByIdTousers);

  // Vendor's own document covering the inward movement (their challan/invoice no.)
  const vendorDocRef = grn.invoiceNumber
    ? `${grn.invoiceNumber}${grn.invoiceDate ? ` · ${fmtDate(grn.invoiceDate)}` : ''}`
    : EM_DASH;

  // Item-level totals (shared by both shapes)
  let acceptedSum = toCurrency(0);
  let rejectedSum = toCurrency(0);
  let receivedSum = toCurrency(0);
  for (const item of grn.grn_items) {
    acceptedSum = addCurrency(acceptedSum, item.acceptedQuantity.toString());
    rejectedSum = addCurrency(rejectedSum, item.rejectedQuantity.toString());
    receivedSum = addCurrency(receivedSum, item.receivedQuantity.toString());
  }

  const firstUnit = grn.grn_items[0]?.unit ?? null;
  const uom = jwo?.uom ?? firstUnit ?? 'PCS';
  const forms = uomForms(uom);

  // ---- Plain material GRN lines (rendered only in the non-job-work shape) ----
  const lines: GrnDocLine[] = grn.grn_items.map((item, idx) => {
    const bits: string[] = [];
    if (item.materials.code) bits.push(item.materials.code);
    if (item.componentName) bits.push(item.componentName);
    if (item.colorName) bits.push(item.colorName);

    // Include bale/than details when entry mode is BALE_WISE or THAN_WISE
    const hasDetails = item.entryMode && ['BALE_WISE', 'THAN_WISE'].includes(item.entryMode);
    const details =
      hasDetails && item.grn_item_details && item.grn_item_details.length > 0
        ? item.grn_item_details.map((d) => ({
            baleNumber: d.baleNumber,
            sequenceNo: d.sequenceNo,
            meters: fmtQty(d.meters.toString(), 'MTR'),
          }))
        : null;

    return {
      sn: idx + 1,
      material: item.materials.name,
      subline: bits.length > 0 ? bits.join(' · ') : null,
      uom: item.unit,
      ordered: fmtQty(item.orderedQuantity.toString(), item.unit),
      received: fmtQty(item.receivedQuantity.toString(), item.unit),
      accepted: fmtQty(item.acceptedQuantity.toString(), item.unit),
      rejected: fmtQty(item.rejectedQuantity.toString(), item.unit),
      details,
      entryMode: item.entryMode,
    };
  });

  // ---- Job-work reconciliation + valuation ----
  let recon: GrnReconBlock | null = null;
  let valuation: GrnValuationBlock | null = null;
  let issuedOn: string | null = null;
  let issuedDaysOut: string | null = null;
  let statutoryDue: string | null = null;
  let statutoryStatus: string | null = null;
  let processLabel: string | null = null;
  let tolerancePctStr: string | null = null;

  if (isJobWork && jwo) {
    processLabel = jwo.processTypeMaster
      ? `${jwo.processTypeMaster.name} · SAC ${jwo.processTypeMaster.sacCode}`
      : jwo.processType;

    issuedOn = fmtDate(jwo.sentDate);
    if (jwo.sentDate) {
      const days = Math.round((grn.receivingDate.getTime() - jwo.sentDate.getTime()) / 86_400_000);
      if (days >= 0) issuedDaysOut = `${days} days out`;
    }
    statutoryDue = fmtDate(jwo.statutoryDueDate);
    if (jwo.statutoryDueDate) {
      statutoryStatus = grn.receivingDate.getTime() <= jwo.statutoryDueDate.getTime() ? 'met' : 'overdue';
    }

    const tolerance = jwo.tolerancePercent ?? jwo.processTypeMaster?.tolerancePercent ?? null;
    tolerancePctStr = tolerance != null ? fmtPct(tolerance.toString()) : null;

    // Issued = component issue lines, falling back to the header quantity
    const issued =
      jwo.components.length > 0
        ? jwo.components.reduce((acc, c) => addCurrency(acc, c.qtySent.toString()), toCurrency(0))
        : toCurrency(jwo.qtySentMeters.toString());

    const balance = subtractCurrency(issued, receivedSum);
    const abnormalQty = jwo.qtyAbnormalLoss != null ? toCurrency(jwo.qtyAbnormalLoss.toString()) : null;
    const normalQty = jwo.qtyNormalLoss != null ? toCurrency(jwo.qtyNormalLoss.toString()) : null;

    recon = {
      issuedQty: fmtQty(issued.toNumber(), uom),
      issuedPct: isZero(issued) ? EM_DASH : '100.0',
      issuedRemark: jwo.challanNumber ? `Challan ${jwo.challanNumber}` : `Against ${jwo.jobWorkNumber}`,
      acceptedQty: fmtQty(acceptedSum.toNumber(), uom),
      acceptedPct: pctOfIssued(acceptedSum.toNumber(), issued),
      rejectedQty: fmtQty(rejectedSum.toNumber(), uom),
      rejectedPct: pctOfIssued(rejectedSum.toNumber(), issued),
      rejectedRemark: rejectedSum.gt(0) ? 'Returned freight-to-pay, no charge payable' : 'None',
      normalLossQty: normalQty != null ? fmtQty(normalQty.toNumber(), uom) : EM_DASH,
      normalLossPct: normalQty != null ? pctOfIssued(normalQty.toNumber(), issued) : EM_DASH,
      abnormalLossQty: abnormalQty != null ? fmtQty(abnormalQty.toNumber(), uom) : EM_DASH,
      abnormalLossPct: abnormalQty != null ? pctOfIssued(abnormalQty.toNumber(), issued) : EM_DASH,
      abnormalRemark: abnormalQty != null && abnormalQty.gt(0) ? 'Debit note raised' : 'None — no debit note raised',
      balanceQty: fmtQty(balance.toNumber(), uom),
      balancePct: pctOfIssued(balance.toNumber(), issued),
      balanceRemark: balance.lte(0) ? 'Order may be closed' : 'Remains with job worker',
    };

    // Material issued at snapshotted rates — chargeable components only
    const chargeable = jwo.components.filter((c) => c.isChargeable);
    let materialValue: ReturnType<typeof toCurrency> | null = null;
    if (chargeable.length > 0) {
      materialValue = chargeable.reduce((acc, c) => {
        const rate = c.rateAtIssue ?? c.rate;
        if (rate == null) return acc;
        return addCurrency(acc, multiplyCurrency(c.qtySent.toString(), rate.toString()));
      }, toCurrency(0));
    }

    // Job charges — KAAJ_BUTTON prices two operations, everything else qty × rate
    const isKaaj = jwo.processType === 'KAAJ_BUTTON' || jwo.processTypeMaster?.code === 'KAAJ_BUTTON';
    let jobCharges: ReturnType<typeof toCurrency>;
    let jobChargesBasis: string;
    if (isKaaj) {
      const bhCount = jwo.buttonholeCount ?? 0;
      const bCount = jwo.buttonCount ?? 0;
      const bhRate = jwo.buttonholeRatePerUnit != null ? jwo.buttonholeRatePerUnit.toString() : '0';
      const bRate = jwo.buttonRatePerUnit != null ? jwo.buttonRatePerUnit.toString() : '0';
      jobCharges = addCurrency(multiplyCurrency(bhCount, bhRate), multiplyCurrency(bCount, bRate));
      jobChargesBasis = `${bhCount} kaaj × ₹${fmtMoney(bhRate)} + ${bCount} buttons × ₹${fmtMoney(bRate)}`;
    } else {
      jobCharges = multiplyCurrency(acceptedSum, jwo.agreedRatePerMeter.toString());
      jobChargesBasis = `${fmtQty(acceptedSum.toNumber(), uom)} accepted × ₹${fmtMoney(jwo.agreedRatePerMeter.toString())}`;
    }

    const fgValue = roundToCent(addCurrency(materialValue ?? 0, jobCharges));
    const fgRate = !isZero(acceptedSum) ? roundToCent(divideCurrency(fgValue, acceptedSum)) : null;

    valuation = {
      materialValue: materialValue != null ? fmtMoney(roundToCent(materialValue).toNumber()) : EM_DASH,
      jobChargesBasis,
      jobCharges: fmtMoney(roundToCent(jobCharges).toNumber()),
      fgValue: fmtMoney(fgValue.toNumber()),
      fgRateLabel: `FG rate per accepted ${forms.word} (${fmtQty(acceptedSum.toNumber(), uom)} ${forms.short})`,
      fgRate: fgRate != null ? fmtMoney(fgRate.toNumber()) : EM_DASH,
      gstExcluded: fmtMoney(jwo.totalTaxAmount != null ? jwo.totalTaxAmount.toString() : null),
      normalLossNote:
        normalQty != null && normalQty.gt(0)
          ? `Normal loss of ${fmtQty(normalQty.toNumber(), uom)} ${forms.short} is absorbed, which is why the per-${forms.word} rate exceeds the sum of its inputs.`
          : null,
      abnormalNote:
        abnormalQty != null && abnormalQty.gt(0)
          ? `Abnormal loss of ${fmtQty(abnormalQty.toNumber(), uom)} ${forms.short} is debited to the job worker and never loaded into inventory.`
          : 'Had abnormal loss occurred it would be debited to the job worker, never loaded here.',
    };
  }

  const contextBanner =
    isJobWork && jwo
      ? `Against ${jwo.jobWorkNumber}`
      : grn.purchase_orders?.poNumber
        ? `Against ${grn.purchase_orders.poNumber}`
        : 'Direct receipt';

  return {
    company,
    docNo: grn.grnNumber,
    docPill: isJobWork ? 'Job work return · Posts to stock' : 'Goods purchase receipt',
    isJobWork,
    contextBanner,
    partyLabel: isJobWork ? 'Job Worker' : 'Supplier',
    supplierName: grn.suppliers.name,
    supplierGstin,
    processLabel,
    vendorDocLabel: isJobWork ? 'Inward Challan' : 'Supplier Invoice',
    vendorDocRef,
    receiptDate: fmtDate(grn.receivingDate),
    issuedOn,
    issuedDaysOut,
    statutoryDue,
    statutoryStatus,
    inspectedBy: approver ?? receiver ?? EM_DASH,
    sec02Title: isJobWork ? 'Reconciliation' : 'Goods Received',
    sec02Banner: isJobWork
      ? tolerancePctStr != null
        ? `Tolerance ${tolerancePctStr}`
        : 'Against issue'
      : `${lines.length} line${lines.length === 1 ? '' : 's'}`,
    uomLabel: forms.header,
    tolerancePct: tolerancePctStr,
    recon,
    lines,
    totalAccepted: fmtQty(acceptedSum.toNumber(), firstUnit),
    totalRejected: fmtQty(rejectedSum.toNumber(), firstUnit),
    valuation,
  };
}
