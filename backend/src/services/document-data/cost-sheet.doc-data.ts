/**
 * Cost Sheet — data adapter for the kf cost-sheet template.
 * Fetches style_costing with all related items and transforms for PDF/Excel display.
 *
 * Design: this adapter is the SINGLE SOURCE for both PDF and Excel, so the two documents
 * cannot drift. Every line type exposes both formatted strings and raw numeric twins (*Num)
 * so Excel can write real numbers while PDF shows formatted text.
 */
import prisma from '../../config/database';
import { Prisma } from '@prisma/client';
import { NotFoundError } from '../../errors';
import { buildCompanyBlock, CompanyBlock } from './company-block';
import { EM_DASH, fmtDate, fmtMoney, fmtQty, fmtPct } from './format';

const costSheetDocInclude = {
  styles: {
    select: {
      id: true,
      styleCode: true,
      buyerStyleRef: true,
      styleName: true,
      customerName: true,
      numberOfComponents: true,
      brand_categories: {
        select: {
          category: true,
          subCategory: true,
        },
      },
    },
  },
  laceItems: {
    orderBy: { createdAt: 'asc' as const },
  },
  fabricItems: {
    orderBy: { createdAt: 'asc' as const },
  },
  trimItems: {
    orderBy: { createdAt: 'asc' as const },
  },
  accessoryItems: {
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.style_costingInclude;

type CostSheetWithDetails = Prisma.style_costingGetPayload<{ include: typeof costSheetDocInclude }>;

/** Up to 2dp, trailing zeros dropped: 3 → "3", 0.5 → "0.5", 52 → "52" */
function fmtQtyTrim(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return EM_DASH;
  const n = Number(value);
  if (Number.isNaN(n)) return EM_DASH;
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

/** 3dp for lace effective quantity */
function fmtQty3(value: number | null | undefined): string {
  if (value === null || value === undefined) return EM_DASH;
  const n = Number(value);
  if (Number.isNaN(n)) return EM_DASH;
  return n.toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' m';
}

// ============================================================================
// Sourcing strategy labels — match the form's exact wording
// ============================================================================

function formatFabricSourcing(strategy: string | null | undefined): string {
  switch (strategy) {
    case 'STOCK_REUSE':
      return 'Stock Reuse';
    case 'READY_FABRIC':
      return 'Ready Fabric';
    case 'GREIGE_PROCESSED':
      return 'Greige + Processing';
    default:
      return EM_DASH;
  }
}

function formatLaceSourcing(strategy: string | null | undefined): string {
  switch (strategy) {
    case 'STOCK_REUSE':
      return 'Stock Reuse';
    case 'READY_LACE':
      return 'Ready Lace';
    case 'GREIGE_PROCESSED':
      return 'Greige + Dyeing';
    default:
      return EM_DASH;
  }
}

// ============================================================================
// Line types — each carries formatted + raw numeric fields
// ============================================================================

export interface CostSheetFabricLine {
  sn: number;
  name: string;
  cad: string; // "1.60 m"
  cadNum: number;
  width: string; // "52""
  widthNum: number;
  sourcing: string;
  rate: string;
  rateNum: number;
  total: string;
  totalNum: number;
}

export interface CostSheetLaceLine {
  sn: number;
  name: string;
  colorSub: string; // "Color: Red"
  widthSub: string; // "Width: 2""
  color: string;
  colorNum: string; // for Excel (just the value)
  width: string;
  widthNum: number;
  qty: string; // "0.150 m"
  qtyNum: number;
  wastage: string; // "5%"
  wastageNum: number;
  effective: string; // "0.158 m"
  effectiveNum: number;
  sourcing: string;
  rate: string;
  rateNum: number;
  total: string;
  totalNum: number;
}

export interface CostSheetTrimLine {
  sn: number;
  type: string; // "Button", "Zipper", etc.
  name: string;
  qty: string;
  qtyNum: number;
  unit: string;
  rate: string;
  rateNum: number;
  total: string;
  totalNum: number;
}

export interface CostSheetEmbroideryLine {
  sn: number;
  name: string;
  average: string;
  averageNum: number;
  rate: string;
  rateNum: number;
  total: string;
  totalNum: number;
}

export interface CostSheetAccessoryLine {
  sn: number;
  type: string;
  name: string;
  qty: string;
  qtyNum: number;
  rate: string;
  rateNum: number;
  total: string;
  totalNum: number;
}

export interface CostSheetCmtLine {
  label: string;
  amount: string;
  amountNum: number;
}

export interface CostSheetSummaryLine {
  label: string;
  amount: string;
  amountNum: number;
  isSub?: boolean; // Subtotal / Total After Value Loss
  isTot?: boolean; // Total Product Cost
}

export interface CostSheetDocData {
  company: CompanyBlock;
  docNo: string;
  version: number;
  /** Computed section numbers — empty sections get '' so numbering stays contiguous */
  sec: {
    basic: string;
    fabric: string;
    lace: string;
    trims: string;
    cmt: string;
    embroidery: string;
    accessories: string;
    summary: string;
  };

  // Basic Information (matches form's header)
  style: {
    code: string;
    name: string;
    buyerRef: string | null;
  };
  customer: string;
  costingModeLabel: string;
  numberOfComponents: string;
  category: string;
  subCategory: string;
  status: string;
  statusLabel: string;

  // Sections — N/A rows are FILTERED OUT (not printed)
  fabrics: CostSheetFabricLine[];
  fabricTotal: string;
  fabricTotalNum: number;
  hasFabrics: boolean;

  laces: CostSheetLaceLine[];
  laceTotal: string;
  laceTotalNum: number;
  hasLaces: boolean;

  trims: CostSheetTrimLine[];
  trimsTotal: string;
  trimsTotalNum: number;
  hasTrims: boolean;

  cmt: CostSheetCmtLine[];
  cmtTotal: string;
  cmtTotalNum: number;

  embroideries: CostSheetEmbroideryLine[];
  embroideryTotal: string;
  embroideryTotalNum: number;
  hasEmbroideries: boolean;

  accessories: CostSheetAccessoryLine[];
  accessoriesTotal: string;
  accessoriesTotalNum: number;
  hasAccessories: boolean;

  // Summary — 11 rows matching the form
  summaryLines: CostSheetSummaryLine[];
  totalProductCost: string;
  totalProductCostNum: number;

  // Closed Cost with variance
  closedCost: string | null;
  closedCostNum: number | null;
  closedCostNotes: string | null;
  hasClosedCost: boolean;
  calculatedCost: string;
  calculatedCostNum: number;
  variance: string; // "+2.5%" or "-1.2%" or "0.0%"
  varianceNum: number;
  variancePositive: boolean;

  notes: string | null;
  hasNotes: boolean;
}

export function formatPurpose(purpose: string | null): string {
  switch (purpose) {
    case 'COSTING':
      return 'Costing (Buyer Quotation)';
    case 'RAW_MATERIAL_CALCULATION':
      return 'Raw Material Calculation';
    case 'PRODUCTION':
      return 'Production';
    case 'PROCUREMENT_PRODUCTION':
      return 'Procurement & Production';
    default:
      return purpose || EM_DASH;
  }
}

export function formatStatus(status: string | null): string {
  switch (status) {
    case 'PENDING':
      return 'Pending';
    case 'APPROVED':
      return 'Approved';
    case 'REJECTED':
      return 'Rejected';
    default:
      return status || EM_DASH;
  }
}

// ============================================================================
// JSON shape interfaces (from fabricDetails / trimsDetails / etc.)
// ============================================================================

interface FabricDetailJson {
  fabricName?: string;
  fabricWidth?: number;
  width?: number;
  fabricAverage?: number;
  cadMeters?: number;
  fabricRate?: number;
  costPerMeter?: number;
  fabricTotal?: number;
  totalCost?: number;
  isNotApplicable?: boolean;
  sourcingStrategy?: string;
}

interface TrimDetailJson {
  trimName?: string;
  materialType?: string;
  trimQuantity?: number;
  unit?: string;
  trimRate?: number;
  trimTotal?: number;
  isNotApplicable?: boolean;
}

interface LaceDetailJson {
  laceName?: string;
  colorName?: string;
  width?: number;
  quantityPerGarment?: number;
  wastagePercent?: number;
  effectiveQuantity?: number;
  sourcingStrategy?: string;
  costPerMeter?: number;
  totalCost?: number;
  isNotApplicable?: boolean;
}

interface EmbroideryDetailJson {
  embroideryName?: string;
  embroideryAverage?: number;
  embroideryRate?: number;
  embroideryTotal?: number;
  isNotApplicable?: boolean;
}

interface AccessoryDetailJson {
  accessoryName?: string;
  materialType?: string;
  accessoryQuantity?: number;
  accessoryRate?: number;
  accessoryTotal?: number;
  isNotApplicable?: boolean;
}

// ============================================================================
// Material type display names
// ============================================================================

const MATERIAL_TYPE_LABELS: Record<string, string> = {
  BUTTON: 'Button',
  ZIPPER: 'Zipper',
  THREAD: 'Thread',
  LABEL: 'Label',
  TAG: 'Tag',
  ELASTIC: 'Elastic',
  VELCRO: 'Velcro',
  INTERLINING: 'Interlining',
  DRAWSTRING: 'Drawstring',
  TAPE: 'Tape',
  PIPING: 'Piping',
  BEAD: 'Bead',
  SEQUIN: 'Sequin',
  HOOK_EYE: 'Hook & Eye',
  SNAP_FASTENER: 'Snap Fastener',
  BUCKLE: 'Buckle',
  RING: 'Ring',
  RIVET: 'Rivet',
  TOGGLE: 'Toggle',
  MAGNET: 'Magnet',
  PACKAGING: 'Packaging',
  OTHER: 'Other',
  // Accessory types
  HANGER: 'Hanger',
  POLYBAG: 'Polybag',
  CARTON: 'Carton',
};

function formatMaterialType(type: string | null | undefined): string {
  if (!type) return EM_DASH;
  return MATERIAL_TYPE_LABELS[type] || type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ============================================================================
// Line builders — filter N/A rows, assign sn after filtering
// ============================================================================

function buildFabricLines(costSheet: CostSheetWithDetails): CostSheetFabricLine[] {
  // JSON-first (the form's exact submission), relational fallback
  const jsonDetails = (costSheet.fabricDetails as FabricDetailJson[] | null) || [];

  let lines: CostSheetFabricLine[];

  if (jsonDetails.length > 0) {
    lines = jsonDetails
      .filter((f) => !f.isNotApplicable)
      .map((f, idx) => {
        const cadNum = Number(f.fabricAverage || f.cadMeters || 0);
        const widthNum = Number(f.fabricWidth || f.width || 0);
        const rateNum = Number(f.fabricRate || f.costPerMeter || 0);
        const totalNum = Number(f.fabricTotal || f.totalCost || 0);
        return {
          sn: idx + 1,
          name: f.fabricName || EM_DASH,
          cad: cadNum > 0 ? `${cadNum.toFixed(2)} m` : EM_DASH,
          cadNum,
          width: widthNum > 0 ? `${fmtQtyTrim(widthNum)}"` : EM_DASH,
          widthNum,
          sourcing: formatFabricSourcing(f.sourcingStrategy),
          rate: fmtMoney(rateNum),
          rateNum,
          total: fmtMoney(totalNum),
          totalNum,
        };
      });
  } else if (costSheet.fabricItems && costSheet.fabricItems.length > 0) {
    // Relational fallback — no isNotApplicable column, so no filtering
    lines = costSheet.fabricItems.map((item, idx) => {
      const cadNum = Number(item.cadMeters || 0);
      const widthNum = Number(item.width || 0);
      const rateNum = Number(item.costPerMeter || 0);
      const totalNum = Number(item.totalCost || 0);
      return {
        sn: idx + 1,
        name: item.fabricName || EM_DASH,
        cad: cadNum > 0 ? `${cadNum.toFixed(2)} m` : EM_DASH,
        cadNum,
        width: widthNum > 0 ? `${fmtQtyTrim(widthNum)}"` : EM_DASH,
        widthNum,
        sourcing: EM_DASH, // relational has no sourcingStrategy
        rate: fmtMoney(rateNum),
        rateNum,
        total: fmtMoney(totalNum),
        totalNum,
      };
    });
  } else {
    lines = [];
  }

  // Re-number after filtering
  lines.forEach((line, idx) => {
    line.sn = idx + 1;
  });

  return lines;
}

function buildLaceLines(costSheet: CostSheetWithDetails): CostSheetLaceLine[] {
  // Lace has no JSON column — relational only
  if (!costSheet.laceItems || costSheet.laceItems.length === 0) return [];

  const lines = costSheet.laceItems
    .filter((item) => !item.isNotApplicable)
    .map((item, idx) => {
      const widthNum = Number(item.width || 0);
      const qtyNum = Number(item.quantityPerGarment || 0);
      const wastageNum = Number(item.wastagePercent || 0);
      const effectiveNum = Number(item.effectiveQuantity || 0);
      const rateNum = Number(item.costPerMeter || 0);
      const totalNum = Number(item.totalCost || 0);

      return {
        sn: idx + 1,
        name: item.laceName || EM_DASH,
        colorSub: item.colorName ? `Color: ${item.colorName}` : '',
        widthSub: widthNum > 0 ? `Width: ${fmtQtyTrim(widthNum)}"` : '',
        color: item.colorName || EM_DASH,
        colorNum: item.colorName || '',
        width: widthNum > 0 ? `${fmtQtyTrim(widthNum)}"` : EM_DASH,
        widthNum,
        qty: fmtQty3(qtyNum),
        qtyNum,
        wastage: fmtPct(wastageNum),
        wastageNum,
        effective: fmtQty3(effectiveNum),
        effectiveNum,
        sourcing: formatLaceSourcing(item.sourcingStrategy),
        rate: fmtMoney(rateNum),
        rateNum,
        total: fmtMoney(totalNum),
        totalNum,
      };
    });

  // Re-number
  lines.forEach((line, idx) => {
    line.sn = idx + 1;
  });

  return lines;
}

function buildTrimLines(costSheet: CostSheetWithDetails): CostSheetTrimLine[] {
  // Relational first, JSON fallback
  let lines: CostSheetTrimLine[];

  if (costSheet.trimItems && costSheet.trimItems.length > 0) {
    lines = costSheet.trimItems
      .filter((item) => !item.isNotApplicable)
      .map((item, idx) => {
        const qtyNum = Number(item.trimQuantity || 0);
        const rateNum = Number(item.trimRate || 0);
        const totalNum = Number(item.trimTotal || 0);
        return {
          sn: idx + 1,
          type: formatMaterialType(item.materialType),
          name: item.trimName || EM_DASH,
          qty: fmtQtyTrim(qtyNum),
          qtyNum,
          unit: item.unit || EM_DASH,
          rate: fmtMoney(rateNum),
          rateNum,
          total: fmtMoney(totalNum),
          totalNum,
        };
      });
  } else {
    const details = (costSheet.trimsDetails as TrimDetailJson[] | null) || [];
    lines = details
      .filter((t) => !t.isNotApplicable)
      .map((t, idx) => {
        const qtyNum = Number(t.trimQuantity || 0);
        const rateNum = Number(t.trimRate || 0);
        const totalNum = Number(t.trimTotal || 0);
        return {
          sn: idx + 1,
          type: formatMaterialType(t.materialType),
          name: t.trimName || EM_DASH,
          qty: fmtQtyTrim(qtyNum),
          qtyNum,
          unit: t.unit || EM_DASH,
          rate: fmtMoney(rateNum),
          rateNum,
          total: fmtMoney(totalNum),
          totalNum,
        };
      });
  }

  lines.forEach((line, idx) => {
    line.sn = idx + 1;
  });

  return lines;
}

function buildEmbroideryLines(costSheet: CostSheetWithDetails): CostSheetEmbroideryLine[] {
  // Embroidery is JSON only
  const details = (costSheet.embroideryDetails as EmbroideryDetailJson[] | null) || [];

  const lines = details
    .filter((e) => !e.isNotApplicable)
    .map((e, idx) => {
      const averageNum = Number(e.embroideryAverage || 0);
      const rateNum = Number(e.embroideryRate || 0);
      const totalNum = Number(e.embroideryTotal || 0);
      return {
        sn: idx + 1,
        name: e.embroideryName || EM_DASH,
        average: fmtQty(averageNum, 'MTR'),
        averageNum,
        rate: fmtMoney(rateNum),
        rateNum,
        total: fmtMoney(totalNum),
        totalNum,
      };
    });

  lines.forEach((line, idx) => {
    line.sn = idx + 1;
  });

  return lines;
}

function buildAccessoryLines(costSheet: CostSheetWithDetails): CostSheetAccessoryLine[] {
  // Relational first, JSON fallback
  let lines: CostSheetAccessoryLine[];

  if (costSheet.accessoryItems && costSheet.accessoryItems.length > 0) {
    lines = costSheet.accessoryItems
      .filter((item) => !item.isNotApplicable)
      .map((item, idx) => {
        const qtyNum = Number(item.accessoryQuantity || 0);
        const rateNum = Number(item.accessoryRate || 0);
        const totalNum = Number(item.accessoryTotal || 0);
        return {
          sn: idx + 1,
          type: formatMaterialType(item.materialType),
          name: item.accessoryName || EM_DASH,
          qty: fmtQtyTrim(qtyNum),
          qtyNum,
          rate: fmtMoney(rateNum),
          rateNum,
          total: fmtMoney(totalNum),
          totalNum,
        };
      });
  } else {
    const details = (costSheet.accessoriesDetails as AccessoryDetailJson[] | null) || [];
    lines = details
      .filter((a) => !a.isNotApplicable)
      .map((a, idx) => {
        const qtyNum = Number(a.accessoryQuantity || 0);
        const rateNum = Number(a.accessoryRate || 0);
        const totalNum = Number(a.accessoryTotal || 0);
        return {
          sn: idx + 1,
          type: formatMaterialType(a.materialType),
          name: a.accessoryName || EM_DASH,
          qty: fmtQtyTrim(qtyNum),
          qtyNum,
          rate: fmtMoney(rateNum),
          rateNum,
          total: fmtMoney(totalNum),
          totalNum,
        };
      });
  }

  lines.forEach((line, idx) => {
    line.sn = idx + 1;
  });

  return lines;
}

function buildCmtLines(costSheet: CostSheetWithDetails): CostSheetCmtLine[] {
  const items: { label: string; value: number }[] = [
    { label: 'Cutting', value: Number(costSheet.cuttingCost || 0) },
    { label: 'Stitching', value: Number(costSheet.stitchingCost || 0) },
    { label: 'Finishing', value: Number(costSheet.finishingCost || 0) },
    { label: 'Button Attachment', value: Number(costSheet.buttonAttachmentCost || 0) },
    { label: 'Handwork', value: Number(costSheet.handworkCmtCost || 0) },
    { label: 'Smocking', value: Number(costSheet.smockingCost || 0) },
  ];

  return items.map((item) => ({
    label: item.label,
    amount: fmtMoney(item.value),
    amountNum: item.value,
  }));
}

// ============================================================================
// Main builder
// ============================================================================

export async function buildCostSheetDocData(costingId: string): Promise<CostSheetDocData> {
  const [company, costSheet] = await Promise.all([
    buildCompanyBlock(),
    prisma.style_costing.findUnique({ where: { id: costingId }, include: costSheetDocInclude }),
  ]);

  if (!costSheet) throw new NotFoundError('Cost sheet', costingId);

  const style = costSheet.styles;
  const fabrics = buildFabricLines(costSheet);
  const laces = buildLaceLines(costSheet);
  const trims = buildTrimLines(costSheet);
  const embroideries = buildEmbroideryLines(costSheet);
  const accessories = buildAccessoryLines(costSheet);
  const cmt = buildCmtLines(costSheet);

  // Section numbering — form order: Basic, Fabric, Lace, Trims, CMT, Embroidery, Accessories, Summary
  let secCount = 0;
  const nextSec = (): string => String(++secCount).padStart(2, '0');
  const sec = {
    basic: nextSec(),
    fabric: fabrics.length > 0 ? nextSec() : '',
    lace: laces.length > 0 ? nextSec() : '',
    trims: trims.length > 0 ? nextSec() : '',
    cmt: nextSec(), // CMT always shows
    embroidery: embroideries.length > 0 ? nextSec() : '',
    accessories: accessories.length > 0 ? nextSec() : '',
    summary: nextSec(),
  };

  // Totals (use stored values, not re-summed — they're the source of truth)
  const fabricTotalNum = Number(costSheet.fabricTotal || 0);
  const laceTotalNum = Number(costSheet.laceTotal || 0);
  const trimsTotalNum = Number(costSheet.trimsTotal || 0);
  const cmtTotalNum = Number(costSheet.cmtTotal || 0);
  const embroideryTotalNum = Number(costSheet.embroideryTotal || 0);
  const accessoriesTotalNum = Number(costSheet.accessoriesTotal || 0);
  const subtotalNum = Number(costSheet.subtotal || 0);
  const valueLossPercent = Number(costSheet.valueLossPercent || 0);
  const valueLossAmountNum = Number(costSheet.valueLossAmount || 0);
  const totalAfterValueLossNum = subtotalNum + valueLossAmountNum;
  const markupPercent = Number(costSheet.markupPercent || 0);
  const markupAmountNum = Number(costSheet.markupAmount || 0);
  const totalProductCostNum = Number(costSheet.totalCostPerPiece || costSheet.totalProductCost || 0);

  // Build the 11 summary lines matching the form
  const summaryLines: CostSheetSummaryLine[] = [
    { label: 'Fabric Total', amount: fmtMoney(fabricTotalNum), amountNum: fabricTotalNum },
    { label: 'Trims Total', amount: fmtMoney(trimsTotalNum), amountNum: trimsTotalNum },
    { label: 'Lace Total', amount: fmtMoney(laceTotalNum), amountNum: laceTotalNum },
    { label: 'CMT Total', amount: fmtMoney(cmtTotalNum), amountNum: cmtTotalNum },
    { label: 'Embroidery Total', amount: fmtMoney(embroideryTotalNum), amountNum: embroideryTotalNum },
    { label: 'Accessories Total', amount: fmtMoney(accessoriesTotalNum), amountNum: accessoriesTotalNum },
    { label: 'Subtotal', amount: fmtMoney(subtotalNum), amountNum: subtotalNum, isSub: true },
    {
      label: `Value Loss (${valueLossPercent}%)`,
      amount: `+ ${fmtMoney(valueLossAmountNum)}`,
      amountNum: valueLossAmountNum,
    },
    {
      label: 'Total After Value Loss',
      amount: fmtMoney(totalAfterValueLossNum),
      amountNum: totalAfterValueLossNum,
      isSub: true,
    },
    { label: `Markup (${markupPercent}%)`, amount: `+ ${fmtMoney(markupAmountNum)}`, amountNum: markupAmountNum },
    {
      label: 'Total Product Cost',
      amount: `₹ ${fmtMoney(totalProductCostNum)}`,
      amountNum: totalProductCostNum,
      isTot: true,
    },
  ];

  // Closed cost and variance
  const closedCostNum = costSheet.closedCost ? Number(costSheet.closedCost) : null;
  let varianceNum = 0;
  if (closedCostNum !== null && totalProductCostNum !== 0) {
    varianceNum = ((closedCostNum - totalProductCostNum) / totalProductCostNum) * 100;
  }
  const variancePositive = varianceNum >= 0;
  const variance = `${variancePositive ? '+' : ''}${varianceNum.toFixed(1)}%`;

  return {
    company,
    docNo: costSheet.id,
    version: costSheet.version || 1,
    sec,

    // Basic Information
    style: {
      code: style?.styleCode || EM_DASH,
      name: style?.styleName || EM_DASH,
      buyerRef: style?.buyerStyleRef || null,
    },
    customer: style?.customerName || EM_DASH,
    costingModeLabel: formatPurpose(costSheet.purpose),
    numberOfComponents: style?.numberOfComponents ? String(style.numberOfComponents) : EM_DASH,
    category: style?.brand_categories?.category || costSheet.category || EM_DASH,
    subCategory: style?.brand_categories?.subCategory || EM_DASH,
    status: costSheet.approvalStatus || 'PENDING',
    statusLabel: formatStatus(costSheet.approvalStatus),

    // Sections
    fabrics,
    fabricTotal: fmtMoney(fabricTotalNum),
    fabricTotalNum,
    hasFabrics: fabrics.length > 0,

    laces,
    laceTotal: fmtMoney(laceTotalNum),
    laceTotalNum,
    hasLaces: laces.length > 0,

    trims,
    trimsTotal: fmtMoney(trimsTotalNum),
    trimsTotalNum,
    hasTrims: trims.length > 0,

    cmt,
    cmtTotal: fmtMoney(cmtTotalNum),
    cmtTotalNum,

    embroideries,
    embroideryTotal: fmtMoney(embroideryTotalNum),
    embroideryTotalNum,
    hasEmbroideries: embroideries.length > 0,

    accessories,
    accessoriesTotal: fmtMoney(accessoriesTotalNum),
    accessoriesTotalNum,
    hasAccessories: accessories.length > 0,

    // Summary
    summaryLines,
    totalProductCost: fmtMoney(totalProductCostNum),
    totalProductCostNum,

    // Closed cost
    closedCost: closedCostNum !== null ? fmtMoney(closedCostNum) : null,
    closedCostNum,
    closedCostNotes: costSheet.closedCostNotes || null,
    hasClosedCost: closedCostNum !== null,
    calculatedCost: fmtMoney(totalProductCostNum),
    calculatedCostNum: totalProductCostNum,
    variance,
    varianceNum,
    variancePositive,

    notes: costSheet.notes || null,
    hasNotes: !!costSheet.notes,
  };
}
