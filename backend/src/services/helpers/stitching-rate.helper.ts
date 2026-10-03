/**
 * What a stitching contractor is paid — ONE rule (owner, 2026-10-03).
 *
 * A stitching issue carries the rate the OPERATORS get per piece, typed when the style is issued: what was
 * taken in costing is often not what the contractor actually agreed. The contractor earns a commission on
 * top of it — one company-wide %, the setting STITCHING_CONTRACTOR_COMMISSION_PERCENT (10%), frozen on each
 * issue the day it is made.
 *
 *   per piece   = operator rate + commission % of it
 *   owed        = GOOD pieces stitched × operator rate, + commission % of that   (defects are not paid)
 *
 * The cost sheet's stitching cost INCLUDES the commission (owner): its operator share is cost ÷ (1 + %).
 * The issue form shows three rates side by side: the last one given for this style, the costing one, and the
 * one being given now (`stitchingRateGuide`).
 *
 * Nothing owed is stored — it is computed from the issue's rate and its recorded output, so a correction of
 * either shows at once.
 */
import { Prisma, PrismaClient } from '@prisma/client';
import {
  addCurrency,
  divideCurrency,
  multiplyCurrency,
  percentOf,
  roundToCent,
  subtractCurrency,
  toCurrency,
  toNumber,
} from '../../utils/currency';
import { systemSettingsService } from '../system-settings.service';

type Db = PrismaClient | Prisma.TransactionClient;
type Num = Prisma.Decimal | number | string | null | undefined;

const PURPOSE_LABEL: Record<string, string> = {
  COSTING: 'Costing',
  RAW_MATERIAL_CALCULATION: 'Raw Mat',
  PROCUREMENT_PRODUCTION: 'Raw Mat',
  PRODUCTION: 'Production',
};

/** A cost sheet named as people know it: "Raw Mat v3" */
export function costSheetLabel(sheet: { purpose: string; version: number }): string {
  return `${PURPOSE_LABEL[sheet.purpose] ?? sheet.purpose} v${sheet.version}`;
}

/**
 * An issue's rates and what it owes, from its saved rate and its recorded output. `outputs` = every
 * stitching_output_skus row of the issue (or of the period being stated).
 */
export function stitchingIssuePayment(
  issue: { operatorRatePerPiece: Num; commissionPercent: Num; costingRatePerPiece: Num },
  outputs: Array<{ goodQty: number; defectQty: number }>
) {
  const goodPieces = outputs.reduce((sum, o) => sum + o.goodQty, 0);
  const defectPieces = outputs.reduce((sum, o) => sum + o.defectQty, 0);
  const hasRate = issue.operatorRatePerPiece != null;
  const perPiece = hasRate ? perPieceWithCommission(issue.operatorRatePerPiece, issue.commissionPercent) : null;
  return {
    goodPieces,
    defectPieces,
    operatorRatePerPiece: perPiece?.operatorRatePerPiece ?? null,
    commissionPercent: issue.commissionPercent == null ? null : Number(issue.commissionPercent),
    commissionPerPiece: perPiece?.commissionPerPiece ?? null,
    totalPerPiece: perPiece?.totalPerPiece ?? null,
    costingRatePerPiece: issue.costingRatePerPiece == null ? null : Number(issue.costingRatePerPiece),
    differencePerPiece: differenceFromCosting(perPiece?.totalPerPiece, issue.costingRatePerPiece),
    owed: stitchingAmountOwed(issue, goodPieces),
  };
}

/** The contractor commission % in force today */
export async function contractorCommissionPercent(): Promise<number> {
  return systemSettingsService.getNumberDefault('STITCHING_CONTRACTOR_COMMISSION_PERCENT');
}

/** Commission on top of an operator rate, per piece */
export function perPieceWithCommission(operatorRate: Num, commissionPercent: Num) {
  const rate = roundToCent(toCurrency(operatorRate ?? 0));
  const commission = roundToCent(percentOf(rate, commissionPercent ?? 0));
  return {
    operatorRatePerPiece: toNumber(rate),
    commissionPerPiece: toNumber(commission),
    totalPerPiece: toNumber(addCurrency(rate, commission)),
  };
}

/** The operator share of a rate that includes the commission (a cost sheet's stitching cost) */
export function operatorShareOf(totalPerPiece: Num, commissionPercent: Num): number {
  const factor = addCurrency(1, divideCurrency(commissionPercent ?? 0, 100));
  return toNumber(roundToCent(divideCurrency(totalPerPiece ?? 0, factor)));
}

/** What an issue owes for its good pieces; null when the issue has no rate (made before 2026-10-03) */
export function stitchingAmountOwed(
  issue: { operatorRatePerPiece: Num; commissionPercent: Num },
  goodPieces: number
): { operatorAmount: number; commissionAmount: number; totalAmount: number } | null {
  if (issue.operatorRatePerPiece == null) return null;
  const operatorAmount = roundToCent(multiplyCurrency(issue.operatorRatePerPiece, goodPieces));
  const commissionAmount = roundToCent(percentOf(operatorAmount, issue.commissionPercent ?? 0));
  return {
    operatorAmount: toNumber(operatorAmount),
    commissionAmount: toNumber(commissionAmount),
    totalAmount: toNumber(addCurrency(operatorAmount, commissionAmount)),
  };
}

export interface StitchingCostingRate {
  costSheetId: string;
  /** e.g. "Raw Mat v3" */
  label: string;
  /** The cost sheet's stitching cost per piece — includes the commission */
  totalPerPiece: number;
}

const SHEET_SELECT = { id: true, purpose: true, version: true, stitchingCost: true } as const;

/**
 * The stitching cost the run was costed at: the cost sheet its order's BOM was made from, else the style's
 * latest approved, current Raw Mat sheet, else its latest approved Costing sheet. Null when none has a
 * stitching cost.
 */
export async function stitchingCostingRate(db: Db, workOrderId: string): Promise<StitchingCostingRate | null> {
  const run = await db.work_orders.findUnique({
    where: { id: workOrderId },
    select: { styleId: true, orderId: true, orderItemId: true },
  });
  if (!run) return null;

  type Sheet = { id: string; purpose: string; version: number; stitchingCost: Prisma.Decimal };
  let sheet: Sheet | null = null;
  if (run.orderId) {
    const boms = await db.order_bom.findMany({
      where: { orderId: run.orderId, styleId: run.styleId, isActive: true, sourceCostSheetId: { not: null } },
      orderBy: { version: 'desc' },
      select: { orderItemId: true, sourceCostSheet: { select: SHEET_SELECT } },
    });
    const bom = boms.find((b) => run.orderItemId && b.orderItemId === run.orderItemId) ?? boms[0];
    sheet = bom?.sourceCostSheet ?? null;
  }
  if (!sheet || Number(sheet.stitchingCost) <= 0) {
    const sheets = await db.style_costing.findMany({
      where: {
        styleId: run.styleId,
        isApproved: true,
        supersededById: null,
        purpose: { in: ['RAW_MATERIAL_CALCULATION', 'COSTING'] },
        stitchingCost: { gt: 0 },
      },
      orderBy: { version: 'desc' },
      select: SHEET_SELECT,
    });
    sheet = sheets.find((s) => s.purpose === 'RAW_MATERIAL_CALCULATION') ?? sheets[0] ?? null;
  }
  if (!sheet || Number(sheet.stitchingCost) <= 0) return null;
  return {
    costSheetId: sheet.id,
    label: costSheetLabel(sheet),
    totalPerPiece: Number(sheet.stitchingCost),
  };
}

export interface LastStitchingRate {
  issueId: string;
  issueNumber: string;
  issueDate: Date;
  contractorName: string | null;
  operatorRatePerPiece: number;
  commissionPercent: number;
  totalPerPiece: number;
}

/** The rate given on the latest earlier issue of this style (any contractor) */
export async function lastStitchingRate(
  db: Db,
  styleId: string,
  excludeIssueId?: string
): Promise<LastStitchingRate | null> {
  const last = await db.stitching_issues.findFirst({
    where: {
      workOrder: { styleId },
      operatorRatePerPiece: { not: null },
      ...(excludeIssueId ? { id: { not: excludeIssueId } } : {}),
    },
    orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      issueNumber: true,
      issueDate: true,
      operatorRatePerPiece: true,
      commissionPercent: true,
      contractor: { select: { name: true } },
    },
  });
  if (!last || last.operatorRatePerPiece == null) return null;
  const commissionPercent = Number(last.commissionPercent ?? 0);
  return {
    issueId: last.id,
    issueNumber: last.issueNumber,
    issueDate: last.issueDate,
    contractorName: last.contractor?.name ?? null,
    commissionPercent,
    ...perPieceWithCommission(last.operatorRatePerPiece, commissionPercent),
  };
}

/** The three rates the issue form shows: last given, as per costing, and the commission in force */
export async function stitchingRateGuide(db: Db, workOrderId: string) {
  const run = await db.work_orders.findUnique({ where: { id: workOrderId }, select: { styleId: true } });
  if (!run) return null;
  const [commissionPercent, costing, lastGiven] = await Promise.all([
    contractorCommissionPercent(),
    stitchingCostingRate(db, workOrderId),
    lastStitchingRate(db, run.styleId),
  ]);
  return {
    commissionPercent,
    costing: costing
      ? { ...costing, operatorRatePerPiece: operatorShareOf(costing.totalPerPiece, commissionPercent) }
      : null,
    lastGiven,
  };
}

/** Given total per piece vs costing total per piece (positive = paying more than costed) */
export function differenceFromCosting(totalPerPiece: Num, costingPerPiece: Num): number | null {
  if (costingPerPiece == null || totalPerPiece == null) return null;
  return toNumber(roundToCent(subtractCurrency(totalPerPiece, costingPerPiece)));
}
