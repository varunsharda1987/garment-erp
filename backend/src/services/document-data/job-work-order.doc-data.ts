/**
 * Job Work Order (Sec 143 / Rule 55) — data adapter for the kf job-work-order
 * template. One root Prisma query. Variant discriminant: totalAmount == null →
 * BLOCKED_RATE (tax rows replaced by the .blocked panel, no gross figure);
 * else RESOLVED (CGST/SGST or IGST rows + gross commitment).
 */
import prisma from '../../config/database';
import { Prisma } from '@prisma/client';
import Decimal from 'decimal.js';
import { NotFoundError } from '../../errors';
import {
  addCurrency,
  applyShrinkageLoss,
  divideCurrency,
  multiplyCurrency,
  roundToCent,
  toCurrency,
} from '../../utils/currency';
import { buildCompanyBlock, CompanyBlock } from './company-block';
import { EM_DASH, fmtDate, fmtMoney, fmtPct, fmtQty } from './format';

const jwoDocInclude = {
  processor: {
    select: {
      name: true,
      address: true,
      contactPerson: true,
      phone: true,
      billingPincode: true,
      billing_city: { select: { cityName: true } },
      billing_state: { select: { stateName: true } },
      gst_numbers: { where: { isPrimary: true }, select: { gstNumber: true }, take: 1 },
    },
  },
  processTypeMaster: {
    select: {
      code: true,
      name: true,
      sacCode: true,
      gstRate: true,
      tolerancePercent: true,
      processCategory: true,
      unitOfMeasure: true,
    },
  },
  components: {
    orderBy: { sortOrder: 'asc' },
    include: {
      greige: { select: { greigeCode: true, greigeName: true } },
      fabric: { select: { fabricCode: true, fabricName: true } },
      lace: { select: { laceCode: true, laceName: true } },
    },
  },
  style: { select: { styleCode: true, buyerStyleRef: true, styleName: true } },
  fabric: { select: { fabricName: true } },
  finishedFabric: { select: { fabricName: true } },
  greigeStockLot: {
    select: {
      purchaseCost: true,
      greigeWidth: true,
      greige: { select: { greigeCode: true, greigeName: true } },
    },
  },
  fabricStockLot: {
    select: {
      weightedAvgCost: true,
      fabricMaster: { select: { fabricCode: true, fabricName: true } },
    },
  },
  labDip: { select: { labDipNumber: true, targetColor: { select: { colorName: true } } } },
  // Stock (style-less) job: without this the challan would hand the dyer a document with an
  // em-dash where the shade belongs — i.e. paperwork that does not say what colour to dye.
  colorMaster: { select: { colorName: true } },
  embroidery: { select: { embroideryCode: true, designName: true } },
  outwardChallan: { select: { challanNumber: true, challanDate: true } },
  headerChallans: {
    where: { challanType: 'OUTWARD', status: { not: 'CANCELLED' } },
    select: { challanNumber: true, challanDate: true },
    take: 1,
  },
  approvedBy: { select: { firstName: true, lastName: true } },
  // Colour + greige lineage for MRP JWOs (no lab dip; no stock lot before issue) —
  // the linked requirement carries the dye colour and the BOM greige with its snapshot cost.
  requirementLinks: {
    take: 1,
    select: {
      material_requirements: {
        select: {
          colorName: true,
          componentName: true,
          materials: { select: { name: true, code: true } },
          orderBomItem: {
            select: {
              colorName: true,
              greigeCost: true,
              greige: { select: { greigeCode: true, greigeName: true } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.job_work_ordersInclude;

type JwoWithDetails = Prisma.job_work_ordersGetPayload<{ include: typeof jwoDocInclude }>;
type JwoComponent = JwoWithDetails['components'][number];

export interface JwoMaterialRow {
  sn: number;
  item: string;
  subline: string | null;
  uom: string;
  qty: string;
  rate: string; // — for free issue / unknown
  value: string; // — for free issue / unknown
}

export interface JwoChargeRow {
  item: string;
  subline: string | null;
  spec: string;
  expQty: string;
  /** The shrinkage % that EXPLAINS Exp. Qty (sent × (1 − s)). Tolerance — the allowed
   *  extra loss — lives in Terms clause 5 and the §04 worksheet, never beside Exp. Qty
   *  where it reads as the derivation and contradicts the number. */
  shrinkage: string;
  rate: string;
  amount: string;
}

export interface JobWorkOrderDocData {
  company: CompanyBlock;
  docNo: string;
  docPill: string;
  isResolved: boolean;
  isInterstate: boolean;
  processBanner: string; // "Process: Dyeing · SAC 998821"
  processName: string;
  processCode: string;
  sacCode: string;
  /** Pre-issue draft — template shows a DRAFT pill so it can't pass for an issued order. */
  isDraft: boolean;
  // 01 — order & job worker
  jobWorkerName: string;
  jobWorkerAddress: string | null;
  jobWorkerGstin: string | null;
  jobWorkerContact: string | null;
  buyerRef: string | null;
  /** "ESSKY086LS — PERI" — the style this job work belongs to. */
  styleLine: string | null;
  /** The dye/processing colour ("Beige") — the core instruction on a dyeing order. */
  colourLine: string | null;
  orderDate: string;
  approvedByName: string | null;
  challanRef: string;
  dueBack: string;
  statutoryDue: string;
  // 02 — material issued (empty array → hatched hand-fill row)
  materialRows: JwoMaterialRow[];
  materialTotal: string;
  // 03 — output, charges & tax
  rateColLabel: string; // "Rate/Mtr" | "Rate/Pc"
  chargeRows: JwoChargeRow[];
  taxableValue: string;
  gstRatePct: string;
  halfGstRatePct: string;
  cgst: string;
  sgst: string;
  igst: string;
  gross: string;
  // costing callout
  showCostingCallout: boolean;
  fgMaterial: string;
  fgCharges: string;
  fgValue: string;
  fgRate: string;
  fgRateUnit: string; // "per metre" | "per piece"
  expQtyStr: string;
  uomShort: string; // "m" | "pcs"
  gstExcluded: string;
  // 04 — reconciliation
  toleranceStr: string;
  uomHead: string; // "Mtr" | "Pcs"
  issuedQty: string;
  issuedRemark: string;
}

function componentItemName(c: JwoComponent): string {
  return (
    c.componentName ??
    c.description ??
    c.greige?.greigeName ??
    c.fabric?.fabricName ??
    c.lace?.laceName ??
    c.materialType
  );
}

function componentSubline(c: JwoComponent): string | null {
  const bits: string[] = [];
  const lotCode = c.greige?.greigeCode ?? c.fabric?.fabricCode ?? c.lace?.laceCode ?? null;
  if (lotCode) bits.push(`Lot ${lotCode}`);
  if (c.colorName) bits.push(c.colorName);
  if (c.hsnCode) bits.push(`HSN ${c.hsnCode}`);
  if (!c.isChargeable) bits.push(c.isReturnable ? 'Free issue · returnable' : 'Free issue');
  return bits.length > 0 ? bits.join(' · ') : null;
}

export async function buildJobWorkOrderDocData(jobWorkOrderId: string): Promise<JobWorkOrderDocData> {
  const [company, jwo] = await Promise.all([
    buildCompanyBlock(),
    prisma.job_work_orders.findUnique({ where: { id: jobWorkOrderId }, include: jwoDocInclude }),
  ]);
  if (!jwo) throw new NotFoundError('Job work order', jobWorkOrderId);

  const ptm = jwo.processTypeMaster;
  const processName = ptm?.name ?? jwo.processType;
  const processCode = ptm?.code ?? jwo.processType;
  const sacCode = ptm?.sacCode ?? EM_DASH;
  const isResolved = jwo.totalAmount != null;

  // ── 01 — job worker block ────────────────────────────────────────────────
  const p = jwo.processor;
  const addressBits = [p.address, p.billing_city?.cityName, p.billingPincode]
    .map((b) => (b ?? '').trim())
    .filter((b) => b.length > 0);
  const contactBits = [p.contactPerson?.trim(), p.phone?.trim()].filter((b): b is string => !!b && b.length > 0);
  const challan = jwo.outwardChallan ?? jwo.headerChallans[0] ?? null;

  // Primary MRP requirement link — colour + greige lineage when there's no lab dip / lot yet
  const reqLink = jwo.requirementLinks[0]?.material_requirements ?? null;
  // Same ladder as the fabric-identity helper, order-linked rungs first: the two job-work
  // rungs at the bottom only ever fire on a stock job, which has no chain above them.
  const colourName =
    jwo.labDip?.targetColor?.colorName ??
    reqLink?.colorName ??
    reqLink?.orderBomItem?.colorName ??
    jwo.colorMaster?.colorName ??
    jwo.colorName ??
    null;

  // ── 02 — material issued ─────────────────────────────────────────────────
  const materialRows: JwoMaterialRow[] = [];
  let materialTotal: Decimal | null = null; // null = unknown → em-dash + no callout

  if (jwo.components.length > 0) {
    let running = toCurrency(0);
    jwo.components.forEach((c, idx) => {
      const rate = c.rateAtIssue ?? c.rate;
      let rateStr = EM_DASH;
      let valueStr = EM_DASH;
      if (c.isChargeable && rate != null) {
        const value = roundToCent(multiplyCurrency(c.qtySent, rate)).toNumber();
        running = addCurrency(running, value);
        rateStr = fmtMoney(Number(rate));
        valueStr = fmtMoney(value);
      }
      materialRows.push({
        sn: idx + 1,
        item: componentItemName(c),
        subline: componentSubline(c),
        uom: c.unit,
        qty: fmtQty(Number(c.qtySent), c.unit),
        rate: rateStr,
        value: valueStr,
      });
    });
    materialTotal = roundToCent(running);
  } else if (jwo.greigeStockLot) {
    // Synthesized single row from the source greige lot
    const lot = jwo.greigeStockLot;
    const rate = lot.purchaseCost;
    const value = rate != null ? roundToCent(multiplyCurrency(jwo.qtySentMeters, rate)).toNumber() : null;
    materialRows.push({
      sn: 1,
      item: lot.greige.greigeName,
      subline: `Lot ${lot.greige.greigeCode} · ${fmtQty(Number(lot.greigeWidth))}″ greige width`,
      uom: jwo.uom,
      qty: fmtQty(Number(jwo.qtySentMeters), jwo.uom),
      rate: rate != null ? fmtMoney(Number(rate)) : EM_DASH,
      value: value != null ? fmtMoney(value) : EM_DASH,
    });
    materialTotal = value != null ? toCurrency(value) : null; // lot without cost → total unknown
  } else if (jwo.fabricStockLot) {
    // Synthesized single row from the source fabric lot
    const lot = jwo.fabricStockLot;
    const value = roundToCent(multiplyCurrency(jwo.qtySentMeters, lot.weightedAvgCost)).toNumber();
    materialRows.push({
      sn: 1,
      item: lot.fabricMaster.fabricName,
      subline: `Lot ${lot.fabricMaster.fabricCode}`,
      uom: jwo.uom,
      qty: fmtQty(Number(jwo.qtySentMeters), jwo.uom),
      rate: fmtMoney(Number(lot.weightedAvgCost)),
      value: fmtMoney(value),
    });
    materialTotal = toCurrency(value);
  } else if (reqLink) {
    // Pre-issue MRP JWO — no lot attached yet, but the requirement chain knows the greige.
    // User rule (2026-08-18): the processor sees the material AND its value (he holds the
    // goods as bailee; wastage is debited at issued material rate per the terms).
    const greigeName = reqLink.orderBomItem?.greige?.greigeName ?? reqLink.materials?.name ?? 'Greige (per BOM)';
    const greigeCode = reqLink.orderBomItem?.greige?.greigeCode ?? reqLink.materials?.code ?? null;
    const bomGreigeRate = reqLink.orderBomItem?.greigeCost != null ? Number(reqLink.orderBomItem.greigeCost) : null;
    const value =
      bomGreigeRate != null ? roundToCent(multiplyCurrency(jwo.qtySentMeters, bomGreigeRate)).toNumber() : null;
    const sublineBits = [
      greigeCode,
      jwo.greigeWidthInches != null ? `${fmtQty(Number(jwo.greigeWidthInches))}″ greige width` : null,
      'lot assigned on despatch challan',
    ].filter((b): b is string => !!b);
    materialRows.push({
      sn: 1,
      item: greigeName,
      subline: sublineBits.join(' · '),
      uom: jwo.uom,
      qty: fmtQty(Number(jwo.qtySentMeters), jwo.uom),
      rate: bomGreigeRate != null ? fmtMoney(bomGreigeRate) : EM_DASH,
      value: value != null ? fmtMoney(value) : EM_DASH,
    });
    materialTotal = value != null ? toCurrency(value) : null;
  }
  // else: no components, no lot, no requirement link — template renders the hatched .open row

  // ── 03 — expected output, job charges & tax ──────────────────────────────
  const uomForRate = (ptm?.unitOfMeasure ?? jwo.uom).toUpperCase();
  const isMeters = uomForRate === 'MTR';
  const rateColLabel = isMeters ? 'Rate/Mtr' : 'Rate/Pc';
  const toleranceRaw = jwo.tolerancePercent ?? ptm?.tolerancePercent ?? null;
  const toleranceStr = fmtPct(toleranceRaw != null ? Number(toleranceRaw) : null);

  const qtySent = toCurrency(jwo.qtySentMeters);
  // Expected output = the billable qty when stored (billing basis: the processor charges
  // for the finished goods returned); derived from shrinkage for legacy rows without it.
  // Any shrinkage-bearing row derives — the old FABRIC-category gate printed the raw
  // sent qty as "expected" for other categories.
  let expectedQty = qtySent;
  if (jwo.qtyBillable != null) {
    expectedQty = toCurrency(jwo.qtyBillable);
  } else if (jwo.expectedShrinkage != null && Number(jwo.expectedShrinkage) > 0) {
    expectedQty = applyShrinkageLoss(qtySent, jwo.expectedShrinkage);
  }
  const expQtyStr = fmtQty(expectedQty.toNumber(), isMeters ? 'MTR' : 'PCS');
  // The % column beside Exp. Qty is the SHRINKAGE that produced it — not the loss tolerance
  const shrinkageColStr = fmtPct(jwo.expectedShrinkage != null ? Number(jwo.expectedShrinkage) : null);

  // Colour first — on a dyeing/printing order the shade IS the spec. Falls back to the
  // embroidery design, then the style code.
  const specStr =
    colourName ??
    (jwo.embroidery ? `${jwo.embroidery.embroideryCode} — ${jwo.embroidery.designName}` : null) ??
    jwo.style?.styleCode ??
    EM_DASH;

  const outputItem =
    jwo.finishedFabric?.fabricName ??
    [processName, jwo.fabric?.fabricName ?? jwo.style?.styleName ?? null].filter(Boolean).join(' — ');

  const chargeRows: JwoChargeRow[] = [];
  let chargesValue: number | null = null; // taxable value of the job work service

  if (processCode === 'KAAJ_BUTTON') {
    // TWO rows at per-unit rates; NEVER show agreedRatePerMeter (stored 0).
    let running: Decimal | null = null;
    const pushKaajRow = (label: string, count: number | null, rate: Prisma.Decimal | null, first: boolean) => {
      let amount: number | null = null;
      if (count != null && rate != null) {
        amount = roundToCent(multiplyCurrency(count, rate)).toNumber();
        running = running == null ? toCurrency(amount) : addCurrency(running, amount);
      }
      chargeRows.push({
        item: `${label} — ${count != null ? fmtQty(count, 'PCS') : EM_DASH} pcs`,
        subline: null,
        spec: first ? specStr : EM_DASH,
        expQty: count != null ? fmtQty(count, 'PCS') : EM_DASH,
        shrinkage: EM_DASH, // piece work — no shrinkage concept
        rate: rate != null ? fmtMoney(Number(rate)) : EM_DASH,
        amount: amount != null ? fmtMoney(amount) : EM_DASH,
      });
    };
    pushKaajRow('Buttonholes', jwo.buttonholeCount, jwo.buttonholeRatePerUnit, true);
    pushKaajRow('Button attachment', jwo.buttonCount, jwo.buttonRatePerUnit, false);
    const computed = running != null ? roundToCent(running).toNumber() : null;
    chargesValue = jwo.subtotal != null ? Number(jwo.subtotal) : computed;
  } else {
    // Charges are billed on the finished goods returned (qtyBillable), not the greige
    // issued — same basis as computeCommercialTotals, so document and DB always agree.
    const computed = jwo.isRateTbd
      ? null
      : roundToCent(multiplyCurrency(jwo.qtyBillable ?? jwo.qtySentMeters, jwo.agreedRatePerMeter)).toNumber();
    chargesValue = jwo.subtotal != null ? Number(jwo.subtotal) : computed;
    // Widths on the processor-facing row: the FINISHED (stenter) width he must deliver,
    // with the greige loom width for reference (also covers pre-issue orders with no lot row).
    const widthSpecParts: string[] = [];
    if (jwo.sentWidthInches != null) widthSpecParts.push(`Finish width ${fmtQty(Number(jwo.sentWidthInches))}″`);
    if (jwo.greigeWidthInches != null) widthSpecParts.push(`greige ${fmtQty(Number(jwo.greigeWidthInches))}″`);
    // Say the quantity math out loud: expected shrinkage links issued greige to fabric due back
    if (jwo.expectedShrinkage != null && Number(jwo.expectedShrinkage) > 0) {
      widthSpecParts.push(
        `expected shrinkage ${Number(jwo.expectedShrinkage)}% ` +
          `(${fmtQty(Number(jwo.qtySentMeters), jwo.uom)} → ${expQtyStr} ${jwo.uom})`
      );
    }
    chargeRows.push({
      item: outputItem,
      subline: widthSpecParts.length ? widthSpecParts.join(' · ') : null,
      spec: specStr,
      expQty: expQtyStr,
      shrinkage: shrinkageColStr,
      rate: jwo.isRateTbd ? EM_DASH : fmtMoney(Number(jwo.agreedRatePerMeter)),
      amount: chargesValue != null ? fmtMoney(chargesValue) : EM_DASH,
    });
  }

  const gstRateNum = jwo.gstRate != null ? Number(jwo.gstRate) : ptm?.gstRate != null ? Number(ptm.gstRate) : null;

  // ── costing callout — suppressed when material value is unknown ──────────
  const showCostingCallout = materialTotal != null && chargesValue != null;
  let fgMaterial = EM_DASH;
  let fgCharges = EM_DASH;
  let fgValue = EM_DASH;
  let fgRate = EM_DASH;
  if (showCostingCallout) {
    const fgVal = roundToCent(addCurrency(materialTotal as Decimal, chargesValue as number));
    fgMaterial = fmtMoney((materialTotal as Decimal).toNumber());
    fgCharges = fmtMoney(chargesValue as number);
    fgValue = fmtMoney(fgVal.toNumber());
    fgRate = expectedQty.greaterThan(0)
      ? fmtMoney(roundToCent(divideCurrency(fgVal, expectedQty)).toNumber())
      : EM_DASH;
  }

  return {
    company,
    docNo: jwo.jobWorkNumber,
    docPill: 'Material issued on challan · Not a sale',
    isDraft: !jwo.sentDate && (!jwo.jwoStatus || ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'].includes(jwo.jwoStatus)),
    isResolved,
    isInterstate: jwo.isInterstate,
    processBanner: `Process: ${processName} · SAC ${sacCode}`,
    processName,
    processCode,
    sacCode,
    jobWorkerName: p.name,
    jobWorkerAddress: addressBits.length > 0 ? addressBits.join(', ') : null,
    jobWorkerGstin: p.gst_numbers[0]?.gstNumber ?? null,
    jobWorkerContact: contactBits.length > 0 ? contactBits.join(' · ') : null,
    // Style gets its own row now — buyerRef only prints a REAL buyer reference
    buyerRef: jwo.style?.buyerStyleRef ?? null,
    styleLine: jwo.style ? [jwo.style.styleCode, jwo.style.styleName].filter(Boolean).join(' — ') : null,
    colourLine: colourName,
    orderDate: fmtDate(jwo.approvedAt ?? jwo.createdAt),
    approvedByName: jwo.approvedBy ? `${jwo.approvedBy.firstName} ${jwo.approvedBy.lastName}`.trim() : null,
    challanRef: challan ? `${challan.challanNumber} · ${fmtDate(challan.challanDate)}` : '— issued on despatch',
    dueBack: fmtDate(jwo.expectedReturnDate),
    statutoryDue: jwo.statutoryDueDate ? fmtDate(jwo.statutoryDueDate) : '— set on issue',
    materialRows,
    materialTotal: materialTotal != null ? fmtMoney(materialTotal.toNumber()) : EM_DASH,
    rateColLabel,
    chargeRows,
    taxableValue: chargesValue != null ? fmtMoney(chargesValue) : EM_DASH,
    gstRatePct: fmtPct(gstRateNum),
    halfGstRatePct: fmtPct(gstRateNum != null ? divideCurrency(gstRateNum, 2).toNumber() : null),
    cgst: fmtMoney(jwo.cgstAmount != null ? Number(jwo.cgstAmount) : null),
    sgst: fmtMoney(jwo.sgstAmount != null ? Number(jwo.sgstAmount) : null),
    igst: fmtMoney(jwo.igstAmount != null ? Number(jwo.igstAmount) : null),
    gross: fmtMoney(jwo.totalAmount != null ? Number(jwo.totalAmount) : null),
    showCostingCallout,
    fgMaterial,
    fgCharges,
    fgValue,
    fgRate,
    fgRateUnit: isMeters ? 'per metre' : 'per piece',
    expQtyStr,
    uomShort: isMeters ? 'm' : 'pcs',
    gstExcluded: fmtMoney(jwo.totalTaxAmount != null ? Number(jwo.totalTaxAmount) : null),
    toleranceStr,
    uomHead: isMeters ? 'Mtr' : 'Pcs',
    issuedQty: fmtQty(Number(jwo.qtySentMeters), jwo.uom),
    issuedRemark: challan ? `Per challan ${challan.challanNumber}` : 'Per despatch challan — to follow',
  };
}
