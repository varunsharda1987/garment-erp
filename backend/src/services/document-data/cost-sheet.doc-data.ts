/**
 * Cost Sheet — data adapter for the kf cost-sheet template.
 * Fetches style_costing with all related items and transforms for PDF display.
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
    },
  },
  users_style_costing_createdByIdTousers: {
    select: {
      firstName: true,
      lastName: true,
    },
  },
  users_style_costing_approvedByIdTousers: {
    select: {
      firstName: true,
      lastName: true,
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

/** Up to 2dp, trailing zeros dropped: 3 → "3", 0.5 → "0.5", 52 → "52" (never rounds a fractional pcs qty to an integer) */
function fmtQtyTrim(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return EM_DASH;
  const n = Number(value);
  if (Number.isNaN(n)) return EM_DASH;
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export interface CostSheetFabricLine {
  sn: number;
  name: string;
  width: string;
  average: string;
  rate: string;
  total: string;
  isNA: boolean;
}

export interface CostSheetTrimLine {
  sn: number;
  name: string;
  qty: string;
  unit: string;
  rate: string;
  total: string;
  isNA: boolean;
}

export interface CostSheetLaceLine {
  sn: number;
  name: string;
  color: string;
  qty: string;
  wastage: string;
  rate: string;
  total: string;
  isNA: boolean;
}

export interface CostSheetEmbroideryLine {
  sn: number;
  name: string;
  average: string;
  rate: string;
  total: string;
  isNA: boolean;
}

export interface CostSheetAccessoryLine {
  sn: number;
  name: string;
  qty: string;
  rate: string;
  total: string;
  isNA: boolean;
}

export interface CostSheetCmt {
  cutting: string;
  stitching: string;
  finishing: string;
  buttonAttachment: string;
  handwork: string;
  smocking: string;
}

export interface CostSheetDocData {
  company: CompanyBlock;
  docNo: string;
  version: number;
  /** Computed: empty Lace/Embroidery sections are omitted, so numbering can't be static in the template */
  sec: {
    style: string;
    fabric: string;
    trims: string;
    lace: string;
    cmt: string;
    embroidery: string;
    accessories: string;
    summary: string;
  };
  style: {
    code: string;
    name: string;
    buyerRef: string | null;
  };
  category: string;
  purpose: string;
  purposeLabel: string;
  status: string;
  statusLabel: string;
  createdBy: string;
  approvedBy: string | null;
  createdAt: string;
  approvedAt: string | null;

  // Sections
  fabrics: CostSheetFabricLine[];
  fabricTotal: string;
  hasFabrics: boolean;

  trims: CostSheetTrimLine[];
  trimsTotal: string;
  hasTrims: boolean;

  laces: CostSheetLaceLine[];
  laceTotal: string;
  hasLaces: boolean;

  cmt: CostSheetCmt;
  cmtTotal: string;

  embroideries: CostSheetEmbroideryLine[];
  embroideryTotal: string;
  hasEmbroideries: boolean;

  accessories: CostSheetAccessoryLine[];
  accessoriesTotal: string;
  hasAccessories: boolean;

  // Summary
  subtotal: string;
  valueLossPercent: string;
  valueLossAmount: string;
  markupPercent: string;
  markupAmount: string;
  totalCostPerPiece: string;

  closedCost: string | null;
  closedCostNotes: string | null;
  hasClosedCost: boolean;
  notes: string | null;
  hasNotes: boolean;
}

function formatUserName(user: { firstName: string | null; lastName: string | null } | null): string {
  if (!user) return EM_DASH;
  const parts = [user.firstName, user.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : EM_DASH;
}

export function formatPurpose(purpose: string | null): string {
  switch (purpose) {
    case 'COSTING':
      return 'Costing';
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
}

interface TrimDetailJson {
  trimName?: string;
  trimQuantity?: number;
  unit?: string;
  trimRate?: number;
  trimTotal?: number;
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
  accessoryQuantity?: number;
  accessoryRate?: number;
  accessoryTotal?: number;
  isNotApplicable?: boolean;
}

function buildFabricLines(costSheet: CostSheetWithDetails): CostSheetFabricLine[] {
  // Try relational items first, then fall back to JSON column
  if (costSheet.fabricItems && costSheet.fabricItems.length > 0) {
    return costSheet.fabricItems.map((item, idx) => ({
      sn: idx + 1,
      name: item.fabricName || EM_DASH,
      width: item.width ? `${fmtQtyTrim(Number(item.width))}"` : EM_DASH,
      average: fmtQty(Number(item.cadMeters || 0), 'MTR'),
      rate: fmtMoney(Number(item.costPerMeter || 0)),
      total: fmtMoney(Number(item.totalCost || 0)),
      isNA: false, // fabric items don't have isNotApplicable
    }));
  }

  // Fall back to JSON column
  const details = (costSheet.fabricDetails as FabricDetailJson[] | null) || [];
  return details.map((f, idx) => ({
    sn: idx + 1,
    name: f.fabricName || EM_DASH,
    width: f.fabricWidth || f.width ? `${fmtQtyTrim(Number(f.fabricWidth || f.width))}"` : EM_DASH,
    average: fmtQty(Number(f.fabricAverage || f.cadMeters || 0), 'MTR'),
    rate: fmtMoney(Number(f.fabricRate || f.costPerMeter || 0)),
    total: fmtMoney(Number(f.fabricTotal || f.totalCost || 0)),
    isNA: f.isNotApplicable || false,
  }));
}

function buildTrimLines(costSheet: CostSheetWithDetails): CostSheetTrimLine[] {
  if (costSheet.trimItems && costSheet.trimItems.length > 0) {
    return costSheet.trimItems.map((item, idx) => ({
      sn: idx + 1,
      name: item.trimName || EM_DASH,
      qty: fmtQtyTrim(Number(item.trimQuantity || 0)),
      unit: item.unit || EM_DASH,
      rate: fmtMoney(Number(item.trimRate || 0)),
      total: fmtMoney(Number(item.trimTotal || 0)),
      isNA: item.isNotApplicable || false,
    }));
  }

  const details = (costSheet.trimsDetails as TrimDetailJson[] | null) || [];
  return details.map((t, idx) => ({
    sn: idx + 1,
    name: t.trimName || EM_DASH,
    qty: fmtQtyTrim(Number(t.trimQuantity || 0)),
    unit: t.unit || EM_DASH,
    rate: fmtMoney(Number(t.trimRate || 0)),
    total: fmtMoney(Number(t.trimTotal || 0)),
    isNA: t.isNotApplicable || false,
  }));
}

function buildLaceLines(costSheet: CostSheetWithDetails): CostSheetLaceLine[] {
  if (!costSheet.laceItems || costSheet.laceItems.length === 0) return [];

  return costSheet.laceItems.map((item, idx) => ({
    sn: idx + 1,
    name: item.laceName || EM_DASH,
    color: item.colorName || EM_DASH,
    qty: fmtQty(Number(item.quantityPerGarment || 0), 'MTR'),
    wastage: fmtPct(Number(item.wastagePercent || 0)),
    rate: fmtMoney(Number(item.costPerMeter || 0)),
    total: fmtMoney(Number(item.totalCost || 0)),
    isNA: item.isNotApplicable || false,
  }));
}

function buildEmbroideryLines(costSheet: CostSheetWithDetails): CostSheetEmbroideryLine[] {
  // Embroidery is stored only in JSON column (no relational table)
  const details = (costSheet.embroideryDetails as EmbroideryDetailJson[] | null) || [];
  return details.map((e, idx) => ({
    sn: idx + 1,
    name: e.embroideryName || EM_DASH,
    average: fmtQty(Number(e.embroideryAverage || 0), 'MTR'),
    rate: fmtMoney(Number(e.embroideryRate || 0)),
    total: fmtMoney(Number(e.embroideryTotal || 0)),
    isNA: e.isNotApplicable || false,
  }));
}

function buildAccessoryLines(costSheet: CostSheetWithDetails): CostSheetAccessoryLine[] {
  if (costSheet.accessoryItems && costSheet.accessoryItems.length > 0) {
    return costSheet.accessoryItems.map((item, idx) => ({
      sn: idx + 1,
      name: item.accessoryName || EM_DASH,
      qty: fmtQtyTrim(Number(item.accessoryQuantity || 0)),
      rate: fmtMoney(Number(item.accessoryRate || 0)),
      total: fmtMoney(Number(item.accessoryTotal || 0)),
      isNA: item.isNotApplicable || false,
    }));
  }

  const details = (costSheet.accessoriesDetails as AccessoryDetailJson[] | null) || [];
  return details.map((a, idx) => ({
    sn: idx + 1,
    name: a.accessoryName || EM_DASH,
    qty: fmtQtyTrim(Number(a.accessoryQuantity || 0)),
    rate: fmtMoney(Number(a.accessoryRate || 0)),
    total: fmtMoney(Number(a.accessoryTotal || 0)),
    isNA: a.isNotApplicable || false,
  }));
}

export async function buildCostSheetDocData(costingId: string): Promise<CostSheetDocData> {
  const [company, costSheet] = await Promise.all([
    buildCompanyBlock(),
    prisma.style_costing.findUnique({ where: { id: costingId }, include: costSheetDocInclude }),
  ]);

  if (!costSheet) throw new NotFoundError('Cost sheet', costingId);

  const style = costSheet.styles;
  const fabrics = buildFabricLines(costSheet);
  const trims = buildTrimLines(costSheet);
  const laces = buildLaceLines(costSheet);
  const embroideries = buildEmbroideryLines(costSheet);
  const accessories = buildAccessoryLines(costSheet);

  const closedCostValue = costSheet.closedCost ? Number(costSheet.closedCost) : null;

  let secCount = 0;
  const nextSec = (): string => String(++secCount).padStart(2, '0');
  const sec = {
    style: nextSec(),
    fabric: fabrics.length > 0 ? nextSec() : '',
    trims: trims.length > 0 ? nextSec() : '',
    lace: laces.length > 0 ? nextSec() : '',
    cmt: nextSec(),
    embroidery: embroideries.length > 0 ? nextSec() : '',
    accessories: accessories.length > 0 ? nextSec() : '',
    summary: nextSec(),
  };

  return {
    company,
    docNo: costSheet.id,
    version: costSheet.version || 1,
    sec,
    style: {
      code: style?.styleCode || EM_DASH,
      name: style?.styleName || EM_DASH,
      buyerRef: style?.buyerStyleRef || null,
    },
    category: costSheet.category || EM_DASH,
    purpose: costSheet.purpose || 'COSTING',
    purposeLabel: formatPurpose(costSheet.purpose),
    status: costSheet.approvalStatus || 'PENDING',
    statusLabel: formatStatus(costSheet.approvalStatus),
    createdBy: formatUserName(costSheet.users_style_costing_createdByIdTousers),
    approvedBy: costSheet.users_style_costing_approvedByIdTousers
      ? formatUserName(costSheet.users_style_costing_approvedByIdTousers)
      : null,
    createdAt: fmtDate(costSheet.createdAt),
    approvedAt: costSheet.approvedAt ? fmtDate(costSheet.approvedAt) : null,

    fabrics,
    fabricTotal: fmtMoney(Number(costSheet.fabricTotal || 0)),
    hasFabrics: fabrics.length > 0,

    trims,
    trimsTotal: fmtMoney(Number(costSheet.trimsTotal || 0)),
    hasTrims: trims.length > 0,

    laces,
    laceTotal: fmtMoney(Number(costSheet.laceTotal || 0)),
    hasLaces: laces.length > 0,

    cmt: {
      cutting: fmtMoney(Number(costSheet.cuttingCost || 0)),
      stitching: fmtMoney(Number(costSheet.stitchingCost || 0)),
      finishing: fmtMoney(Number(costSheet.finishingCost || 0)),
      buttonAttachment: fmtMoney(Number(costSheet.buttonAttachmentCost || 0)),
      handwork: fmtMoney(Number(costSheet.handworkCmtCost || 0)),
      smocking: fmtMoney(Number(costSheet.smockingCost || 0)),
    },
    cmtTotal: fmtMoney(Number(costSheet.cmtTotal || 0)),

    embroideries,
    embroideryTotal: fmtMoney(Number(costSheet.embroideryTotal || 0)),
    hasEmbroideries: embroideries.length > 0,

    accessories,
    accessoriesTotal: fmtMoney(Number(costSheet.accessoriesTotal || 0)),
    hasAccessories: accessories.length > 0,

    subtotal: fmtMoney(Number(costSheet.subtotal || 0)),
    valueLossPercent: fmtPct(Number(costSheet.valueLossPercent || 0)),
    valueLossAmount: fmtMoney(Number(costSheet.valueLossAmount || 0)),
    markupPercent: fmtPct(Number(costSheet.markupPercent || 0)),
    markupAmount: fmtMoney(Number(costSheet.markupAmount || 0)),
    totalCostPerPiece: fmtMoney(Number(costSheet.totalCostPerPiece || costSheet.totalProductCost || 0)),

    closedCost: closedCostValue !== null ? fmtMoney(closedCostValue) : null,
    closedCostNotes: costSheet.closedCostNotes || null,
    hasClosedCost: closedCostValue !== null,
    notes: costSheet.notes || null,
    hasNotes: !!costSheet.notes,
  };
}
