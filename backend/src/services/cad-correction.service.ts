/**
 * Correct CAD — fix an APPROVED CAD row after cost sheets and orders were built on it, and carry the fix
 * down the chain without anyone undoing anything by hand (2026-09-26, owner decisions in
 * .claude/plans/can-you-check-why-tidy-melody.md).
 *
 *   CAD → Fabric Costing (₹/m, slab, price approval) → cost sheet → Order BOM → requirements
 *
 *  - Nothing approved built on the row (no approved cost sheet, no live order BOM): the correction
 *    applies at once. The price approval stays when ₹/m did not move, otherwise it is cleared as usual.
 *  - Something is: the CAD row is NOT changed yet. Each approved cost sheet built on it gets a new PENDING
 *    version carrying the corrected line, and waits for an admin. Approving it applies the CAD change,
 *    grants the price approval (the admin saw the ₹ on the sheet), and rebuilds every live order's BOM
 *    from it — MRP then reconciles the requirements (same numbers, reservations adjusted, PO-linked
 *    lines get a "needs X more" decision). Rejecting it restores the superseded sheet; the CAD is
 *    untouched.
 *
 * Every step is recorded on the CAD row's History (cad-history.helper) and in cad_corrections.
 */

import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { BusinessError, ConflictError, NotFoundError, ValidationError } from '../errors';
import { logError, logInfo } from '../utils/logger';
import { cadAverageFromMarker } from '../controllers/cad-planning.utils';
import { getCadCostingDependents, getCostSheetOrderDependents } from './helpers/cad-costing-provenance.helper';
import { recostCadRow, type RecostResult, type RecostedCosting } from './helpers/fabric-costing-buildup.helper';
import { createCostSheetVersionTx } from './helpers/cost-sheet-version.helper';
import { recomputeStoredCostSheetTotals } from './helpers/cost-sheet-totals.helper';
import { cadSnapshot, recordCadEvent } from './helpers/cad-history.helper';
import { recomputeStyleCadStatus } from './helpers/cad-status.helper';
import { orderBomService } from './order-bom.service';

type Tx = Prisma.TransactionClient;

export interface CadCorrectionInput {
  /** New layer length (m); omitted / blank = keep */
  layerLengthMeters?: number | null;
  /** New size breakdown; omitted = keep */
  sizeBreakdowns?: Array<{ sizeName: string; quantity: number }>;
  /** New greige; omitted = keep */
  greigeId?: string | null;
  /** New cuttable width (inches); omitted / blank = keep */
  cutableWidth?: number | null;
  reason: string;
}

/** The marker + identity of a CAD row, before or after a correction */
export interface CadMarker {
  cadMeters: number | null;
  layerMarginMeters: number | null;
  piecesPerMarker: number | null;
  cadAverage: number | null;
  cutableWidth: number | null;
  greigeId: string | null;
  sizeBreakdowns: Array<{ sizeName: string; quantity: number }>;
}

/** What a correction stores as `after`: the marker and the re-costed fabric costing */
interface CorrectionAfter extends CadMarker {
  costing: RecostedCosting;
  priceChanged: boolean;
  wasCosted: boolean;
}

const num = (v: Prisma.Decimal | number | null | undefined): number | null =>
  v === null || v === undefined ? null : Number(v);
const round4 = (n: number) => Math.round(n * 10000) / 10000;
const round2 = (n: number) => Math.round(n * 100) / 100;

const CAD_INCLUDE = {
  sizeBreakdowns: { select: { sizeName: true, quantity: true } },
  greige: { select: { greigeCode: true } },
  styleFabric: { select: { style_components: { select: { styleId: true } } } },
} satisfies Prisma.fabric_width_cadInclude;

type LoadedCad = Prisma.fabric_width_cadGetPayload<{ include: typeof CAD_INCLUDE }>;

async function loadCad(db: Tx | typeof prisma, cadId: string): Promise<LoadedCad> {
  const cad = await db.fabric_width_cad.findUnique({ where: { id: cadId }, include: CAD_INCLUDE });
  if (!cad) throw new NotFoundError('CAD row', cadId);
  return cad;
}

function markerOf(cad: LoadedCad): CadMarker {
  return {
    cadMeters: num(cad.cadMeters),
    layerMarginMeters: num(cad.layerMarginMeters),
    piecesPerMarker: cad.piecesPerMarker,
    cadAverage: num(cad.cadAverage),
    cutableWidth: num(cad.cutableWidth),
    greigeId: cad.greigeId,
    sizeBreakdowns: cad.sizeBreakdowns.map((s) => ({ sizeName: s.sizeName, quantity: s.quantity })),
  };
}

/** The corrected marker — the average computed exactly as the CAD Planning save does (cadAverageFromMarker) */
function correctedMarker(cad: LoadedCad, input: CadCorrectionInput): CadMarker {
  const sizes = input.sizeBreakdowns ?? cad.sizeBreakdowns.map((s) => ({ sizeName: s.sizeName, quantity: s.quantity }));
  const layerChanged = input.layerLengthMeters != null;
  const layer = layerChanged ? input.layerLengthMeters! : num(cad.cadMeters);
  const { layerMarginMeters, piecesPerMarker, cadAverage } = cadAverageFromMarker(
    layer,
    sizes,
    layerChanged ? null : num(cad.layerMarginMeters)
  );
  return {
    cadMeters: layer,
    layerMarginMeters,
    piecesPerMarker,
    cadAverage: cadAverage === null ? null : round4(cadAverage),
    cutableWidth: input.cutableWidth ?? num(cad.cutableWidth),
    greigeId: input.greigeId !== undefined ? input.greigeId : cad.greigeId,
    sizeBreakdowns: sizes,
  };
}

const sizesKey = (s: CadMarker['sizeBreakdowns']) =>
  [...s]
    .sort((a, b) => a.sizeName.localeCompare(b.sizeName))
    .map((x) => `${x.sizeName}:${x.quantity}`)
    .join(',');

function sameMarker(a: CadMarker, b: CadMarker): boolean {
  return (
    a.cadMeters === b.cadMeters &&
    a.cadAverage === b.cadAverage &&
    a.cutableWidth === b.cutableWidth &&
    a.greigeId === b.greigeId &&
    sizesKey(a.sizeBreakdowns) === sizesKey(b.sizeBreakdowns)
  );
}

function assertCorrectable(cad: LoadedCad, styleId: string) {
  const ownerStyleId = cad.styleFabric?.style_components?.styleId ?? cad.costingStyleId;
  if (ownerStyleId !== styleId) throw new BusinessError('CAD row does not belong to this style');
  if ((cad.purposeEnum ?? cad.purpose) === 'PRODUCTION') {
    throw new BusinessError(
      'A Production CAD is the marker of one received lot — it is changed on its own row (Reject, edit, ' +
        'Approve), not with Correct.'
    );
  }
  // allow-cad-approval: Correct is the CAD-side action for an approved geometry
  if (cad.approvalStatus !== 'APPROVED') {
    throw new BusinessError('Only an approved CAD is corrected. A pending or rejected row is edited directly.');
  }
}

// ---------------------------------------------------------------------------
// Impact — what the correction touches
// ---------------------------------------------------------------------------

export interface CorrectionImpact {
  before: {
    cadAverage: number | null;
    totalCostPerMeter: number | null;
    greigeId: string | null;
    width: number | null;
  };
  after: { cadAverage: number | null; totalCostPerMeter: number | null; greigeId: string | null; width: number | null };
  costing: { slabLabel: string | null; slabMetres: number | null; priceChanged: boolean; notes: string[] };
  fabricCostPerPiece: { before: number | null; after: number | null };
  costSheets: Array<{
    costSheetId: string;
    version: number;
    purpose: string;
    approvalStatus: string;
    action: 'NEW_VERSION' | 'UPDATE';
    cadAverageOnSheet: number | null;
  }>;
  orders: Array<{
    orderNumber: string;
    orderBomId: string;
    bomVersion: number;
    bomStatus: string;
    locked: boolean;
    metresBefore: number | null;
    metresAfter: number | null;
    requirements: Array<{ requirementNumber: string; requirementType: string; status: string; state: string }>;
  }>;
  needsApproval: boolean;
  /** The CAD row already reads the corrected values; this only carries them down (e.g. ESSKY082LS) */
  carryForwardOnly: boolean;
  cuttingNote: string;
}

async function buildImpact(cad: LoadedCad, after: CadMarker, recost: RecostResult): Promise<CorrectionImpact> {
  const deps = await getCadCostingDependents(cad.id);
  const sheetLines = await prisma.style_costing_fabric_items.findMany({
    where: { fabricCADId: cad.id, costingId: { in: deps.costSheets.map((s) => s.costSheetId) } },
    select: { costingId: true, cadMeters: true },
  });
  const sheetAverage = new Map(sheetLines.map((l) => [l.costingId, num(l.cadMeters)]));

  const bomLines = await prisma.order_bom_items.findMany({
    where: { selectedCadId: cad.id, orderBom: { isActive: true } },
    select: {
      id: true,
      orderQuantity: true,
      wastagePercent: true,
      orderBom: { select: { id: true, version: true, status: true, order: { select: { orderNumber: true } } } },
      snapshotRequirements: {
        where: { status: { not: 'CANCELLED' } },
        select: {
          requirementNumber: true,
          requirementType: true,
          status: true,
          allocatedFromStock: true,
          _count: { select: { requirement_po_links: true, requirement_jwo_links: true } },
        },
      },
    },
  });

  const shrink = recost.costing.shrinkagePercent ?? num(cad.shrinkagePercent) ?? 0;
  const greigeMetres = (avg: number | null, qty: number, wastage: number) =>
    avg === null ? null : round2((qty * avg * (1 + wastage / 100)) / (1 - Math.min(shrink, 99) / 100));

  const orders: CorrectionImpact['orders'] = bomLines.map((line) => {
    const wastage = num(line.wastagePercent) ?? 0;
    return {
      orderNumber: line.orderBom.order.orderNumber,
      orderBomId: line.orderBom.id,
      bomVersion: line.orderBom.version,
      bomStatus: String(line.orderBom.status),
      locked: line.orderBom.status === 'LOCKED',
      metresBefore: greigeMetres(num(cad.cadAverage), line.orderQuantity, wastage),
      metresAfter: greigeMetres(after.cadAverage, line.orderQuantity, wastage),
      requirements: line.snapshotRequirements.map((r) => {
        const linked = r._count.requirement_po_links + r._count.requirement_jwo_links > 0;
        const reserved = Number(r.allocatedFromStock ?? 0);
        return {
          requirementNumber: r.requirementNumber,
          requirementType: r.requirementType,
          status: String(r.status),
          state: linked ? 'on a PO / job work' : reserved > 0 ? `${reserved} from stock` : 'open',
        };
      }),
    };
  });

  const approvedSheets = deps.costSheets.filter((s) => s.costSheetApprovalStatus === 'APPROVED');
  const oldRate = num(cad.totalCostPerMeter);
  const newRate = recost.costing.totalCostPerMeter;
  return {
    before: {
      cadAverage: num(cad.cadAverage),
      totalCostPerMeter: oldRate,
      greigeId: cad.greigeId,
      width: num(cad.cutableWidth),
    },
    after: {
      cadAverage: after.cadAverage,
      totalCostPerMeter: newRate,
      greigeId: after.greigeId,
      width: after.cutableWidth,
    },
    costing: {
      slabLabel: recost.slabLabel,
      slabMetres: recost.slabMetres === null ? null : round2(recost.slabMetres),
      priceChanged: recost.priceChanged,
      notes: recost.notes,
    },
    fabricCostPerPiece: {
      before: oldRate !== null && cad.cadAverage !== null ? round2(oldRate * Number(cad.cadAverage)) : null,
      after: newRate !== null && after.cadAverage !== null ? round2(newRate * after.cadAverage) : null,
    },
    costSheets: deps.costSheets.map((s) => ({
      costSheetId: s.costSheetId,
      version: s.version,
      purpose: s.purpose,
      approvalStatus: s.costSheetApprovalStatus,
      action: s.costSheetApprovalStatus === 'APPROVED' ? 'NEW_VERSION' : 'UPDATE',
      cadAverageOnSheet: sheetAverage.get(s.costSheetId) ?? null,
    })),
    orders,
    needsApproval: approvedSheets.length > 0 || orders.length > 0,
    carryForwardOnly: false,
    cuttingNote: 'Cutting is not affected: it cuts to each received lot’s own Production CAD.',
  };
}

// ---------------------------------------------------------------------------
// Writers
// ---------------------------------------------------------------------------

/** Put the corrected marker (and, if the row is costed, the re-costed price) on the CAD row */
async function writeCad(
  tx: Tx,
  cad: LoadedCad,
  after: CorrectionAfter,
  opts: { approvedBy: string; priceApproval: 'KEEP' | 'CLEAR' | { approvedBy: string } }
): Promise<void> {
  const c = after.costing;
  await tx.fabric_width_cad.update({
    where: { id: cad.id },
    data: {
      cadMeters: after.cadMeters,
      layerMarginMeters: after.layerMarginMeters,
      piecesPerMarker: after.piecesPerMarker,
      cadAverage: after.cadAverage,
      ...(after.cutableWidth !== null ? { cutableWidth: after.cutableWidth } : {}),
      greigeId: after.greigeId,
      // allow-cad-approval: the corrected geometry is approved by whoever made the correction
      approvalStatus: 'APPROVED',
      approvedBy: opts.approvedBy,
      approvedAt: new Date(),
      rejectedBy: null,
      rejectedAt: null,
      ...(after.wasCosted
        ? {
            greigeCostPerMeter: c.greigeCostPerMeter,
            processingPricePerMeter: c.processingPricePerMeter,
            rateCardId: c.rateCardId,
            shrinkagePercent: c.shrinkagePercent,
            shrinkageCostPerMeter: c.shrinkageCostPerMeter,
            screenCostPerMeter: c.screenCostPerMeter,
            totalCostPerMeter: c.totalCostPerMeter,
            costedAtQuantityMeters: c.costedAtQuantityMeters,
            ...(c.greigeProvenance ?? {}),
          }
        : {}),
      ...(opts.priceApproval === 'CLEAR'
        ? { costingApprovalStatus: null, costingApprovedBy: null, costingApprovedAt: null }
        : opts.priceApproval === 'KEEP'
          ? {}
          : {
              costingApprovalStatus: 'APPROVED',
              costingApprovedBy: opts.priceApproval.approvedBy,
              costingApprovedAt: new Date(),
            }),
    },
  });
  await tx.cad_size_breakdown.deleteMany({ where: { cadId: cad.id } });
  if (after.sizeBreakdowns.length > 0) {
    await tx.cad_size_breakdown.createMany({
      data: after.sizeBreakdowns.map((s) => ({ cadId: cad.id, sizeName: s.sizeName, quantity: s.quantity })),
    });
  }
}

interface FabricDetailJson {
  fabricCADId?: string;
  fabricName?: string;
  fabricWidth?: number;
  fabricAverage?: number;
  fabricRate?: number;
  fabricTotal?: number;
  greigeCost?: number;
  processingCost?: number;
  rateCardId?: string;
  isManualOverride?: boolean;
  [key: string]: unknown;
}

/**
 * Put the corrected average (and price) on a cost sheet's fabric line built from this CAD: the relational
 * item (what the Order BOM reads) and the JSON line (what the sheet shows), then re-total the sheet.
 * A manually overridden rate stays as the owner typed it; only the average moves.
 */
async function patchSheetFabricLine(tx: Tx, sheetId: string, cadId: string, after: CorrectionAfter): Promise<void> {
  const average = after.cadAverage ?? 0;
  const items = await tx.style_costing_fabric_items.findMany({ where: { costingId: sheetId, fabricCADId: cadId } });
  for (const item of items) {
    const rate =
      item.isManualOverride || after.costing.totalCostPerMeter === null
        ? Number(item.costPerMeter)
        : after.costing.totalCostPerMeter;
    const effective = average * (1 + Number(item.cadWastagePercent ?? 0) / 100);
    await tx.style_costing_fabric_items.update({
      where: { id: item.id },
      data: {
        cadMeters: average,
        effectiveCad: effective,
        costPerMeter: rate,
        totalCost: round2(effective * rate),
        greigeId: after.greigeId,
        ...(after.cutableWidth !== null ? { width: after.cutableWidth } : {}),
        ...(after.wasCosted && !item.isManualOverride
          ? {
              greigeCost: after.costing.greigeCostPerMeter,
              processingCost: after.costing.processingPricePerMeter,
              rateCardId: after.costing.rateCardId,
            }
          : {}),
      },
    });
  }

  const sheet = await tx.style_costing.findUniqueOrThrow({ where: { id: sheetId }, select: { fabricDetails: true } });
  const details = Array.isArray(sheet.fabricDetails) ? (sheet.fabricDetails as unknown as FabricDetailJson[]) : [];
  const matches = (d: FabricDetailJson) =>
    d.fabricCADId === cadId ||
    (!d.fabricCADId && items.some((i) => i.fabricName === d.fabricName && Number(i.width) === Number(d.fabricWidth)));
  const patched = details.map((d) => {
    if (!matches(d)) return d;
    const rate =
      d.isManualOverride || after.costing.totalCostPerMeter === null
        ? Number(d.fabricRate ?? 0)
        : after.costing.totalCostPerMeter;
    return {
      ...d,
      fabricCADId: cadId,
      fabricAverage: average,
      fabricRate: rate,
      fabricTotal: round4(average * rate),
      ...(after.cutableWidth !== null ? { fabricWidth: after.cutableWidth } : {}),
      ...(after.wasCosted && !d.isManualOverride
        ? {
            greigeCost: after.costing.greigeCostPerMeter ?? undefined,
            processingCost: after.costing.processingPricePerMeter ?? undefined,
            rateCardId: after.costing.rateCardId ?? undefined,
          }
        : {}),
    };
  });
  await tx.style_costing.update({
    where: { id: sheetId },
    data: { fabricDetails: patched as unknown as Prisma.InputJsonValue },
  });
  await recomputeStoredCostSheetTotals(tx, sheetId);
}

// ---------------------------------------------------------------------------
// Preview / submit
// ---------------------------------------------------------------------------

async function prepare(styleId: string, cadId: string, input: CadCorrectionInput, userId: string) {
  const cad = await loadCad(prisma, cadId);
  assertCorrectable(cad, styleId);
  const before = markerOf(cad);
  const marker = correctedMarker(cad, input);
  if (marker.cadAverage === null || marker.cadAverage <= 0) {
    throw new ValidationError('The corrected marker gives no CAD average — enter a layer length and a size breakdown.');
  }
  const recost = await recostCadRow(prisma, cad, { cadAverage: marker.cadAverage, greigeId: marker.greigeId }, userId);
  const impact = await buildImpact(cad, marker, recost);
  const geometryChanged = !sameMarker(before, marker);
  // The CAD already reads the corrected values but what is built on it does not (ESSKY082LS, 26-Sep):
  // a correction with no geometry change carries them down.
  const drift =
    impact.costSheets.some(
      (s) => s.cadAverageOnSheet !== null && Math.abs(s.cadAverageOnSheet - marker.cadAverage!) > 0.00005
    ) || impact.orders.some((o) => o.metresBefore !== o.metresAfter);
  impact.carryForwardOnly = !geometryChanged && drift;
  const after: CorrectionAfter = {
    ...marker,
    costing: recost.costing,
    priceChanged: recost.priceChanged,
    wasCosted: num(cad.totalCostPerMeter) !== null,
  };
  return { cad, before, after, recost, impact, geometryChanged, drift };
}

export async function previewCorrection(styleId: string, cadId: string, input: CadCorrectionInput, userId: string) {
  const { impact, geometryChanged, drift } = await prepare(styleId, cadId, input, userId);
  return { ...impact, nothingToCorrect: !geometryChanged && !drift };
}

export async function submitCorrection(styleId: string, cadId: string, input: CadCorrectionInput, userId: string) {
  const reason = input.reason?.trim();
  if (!reason || reason.length < 3) throw new ValidationError('Give a reason for the correction.');

  const pending = await prisma.cad_corrections.findFirst({ where: { cadId, status: 'PENDING_APPROVAL' } });
  if (pending) {
    throw new ConflictError('This CAD already has a correction waiting for approval. Approve or reject it first.', {
      code: 'CAD_CORRECTION_PENDING',
      correctionId: pending.id,
    });
  }

  const { cad, before, after, impact, geometryChanged, drift } = await prepare(styleId, cadId, input, userId);
  if (!geometryChanged && !drift) {
    throw new BusinessError('Nothing to correct — the CAD and everything built on it already agree.');
  }

  const beforeJson = {
    ...before,
    costing: {
      greigeCostPerMeter: num(cad.greigeCostPerMeter),
      processingPricePerMeter: num(cad.processingPricePerMeter),
      rateCardId: cad.rateCardId,
      totalCostPerMeter: num(cad.totalCostPerMeter),
      costingApprovalStatus: cad.costingApprovalStatus,
    },
  };

  if (!impact.needsApproval) {
    // Nothing approved is built on the row — correct it now
    const correction = await prisma.$transaction(async (tx) => {
      await writeCad(tx, cad, after, {
        approvedBy: userId,
        priceApproval: after.priceChanged ? 'CLEAR' : 'KEEP',
      });
      for (const sheet of impact.costSheets) await patchSheetFabricLine(tx, sheet.costSheetId, cad.id, after);
      await recomputeStyleCadStatus(tx, styleId);
      return tx.cad_corrections.create({
        data: {
          cadId,
          styleId,
          status: 'APPLIED',
          reason,
          before: beforeJson as unknown as Prisma.InputJsonValue,
          after: after as unknown as Prisma.InputJsonValue,
          impact: impact as unknown as Prisma.InputJsonValue,
          newCostSheetIds: [],
          correctedById: userId,
          decidedById: userId,
          decidedAt: new Date(),
        },
      });
    });
    await recordCadEvent({
      cadId,
      userId,
      action: 'CORRECT',
      oldValues: cadSnapshot({ ...cad, sizeBreakdowns: cad.sizeBreakdowns }) as unknown as Record<string, unknown>,
      newValues: { ...(cadSnapshot(after) as unknown as Record<string, unknown>), correctionId: correction.id },
      reason,
    });
    return { correction, impact, status: 'APPLIED' as const };
  }

  // Something approved is built on it — new cost-sheet versions wait for an admin; the CAD waits too
  const approvedSheets = impact.costSheets.filter((s) => s.action === 'NEW_VERSION');
  if (approvedSheets.length === 0) {
    throw new BusinessError(
      'An order is built on this CAD but no approved cost sheet is — approve (or discard) the pending cost ' +
        'sheet first, then correct.'
    );
  }
  const correction = await prisma.$transaction(async (tx) => {
    const newIds: string[] = [];
    for (const sheet of approvedSheets) {
      const { created } = await createCostSheetVersionTx(tx, sheet.costSheetId, {
        userId,
        reason: `CAD correction: ${reason}`,
      });
      await patchSheetFabricLine(tx, created.id, cad.id, after);
      newIds.push(created.id);
    }
    // Unapproved sheets on this CAD follow it when the admin approves (onCostSheetApproved) — not now: a
    // rejected correction must leave them as they were
    return tx.cad_corrections.create({
      data: {
        cadId,
        styleId,
        status: 'PENDING_APPROVAL',
        reason,
        before: beforeJson as unknown as Prisma.InputJsonValue,
        after: after as unknown as Prisma.InputJsonValue,
        impact: impact as unknown as Prisma.InputJsonValue,
        newCostSheetIds: newIds,
        correctedById: userId,
      },
    });
  });
  await recordCadEvent({
    cadId,
    userId,
    action: 'CORRECT',
    oldValues: cadSnapshot({ ...cad, sizeBreakdowns: cad.sizeBreakdowns }) as unknown as Record<string, unknown>,
    newValues: {
      ...(cadSnapshot(after) as unknown as Record<string, unknown>),
      correctionId: correction.id,
      outcome: 'Waiting for the admin to approve the new cost sheet version',
    },
    reason,
  });
  return { correction, impact, status: 'PENDING_APPROVAL' as const };
}

// ---------------------------------------------------------------------------
// Admin decision — hooked into the cost-sheet approve / reject
// ---------------------------------------------------------------------------

interface OrderOutcome {
  orderNumber: string;
  costSheetId: string;
  status: 'UPDATED' | 'SKIPPED' | 'FAILED';
  newBomVersion?: number;
  message?: string;
}

async function carryToOrders(newSheetId: string, adminId: string, requiredDate?: Date): Promise<OrderOutcome[]> {
  const predecessor = await prisma.style_costing.findFirst({
    where: { supersededById: newSheetId },
    select: { id: true },
  });
  if (!predecessor) return [];
  const deps = await getCostSheetOrderDependents(predecessor.id);
  const outcomes: OrderOutcome[] = [];

  for (const b of deps.activeBoms) {
    const bom = await prisma.order_bom.findUnique({
      where: { id: b.orderBomId },
      select: { orderId: true, orderItemId: true, styleId: true, status: true },
    });
    if (!bom) continue;
    if (bom.status === 'LOCKED') {
      outcomes.push({
        orderNumber: b.orderNumber,
        costSheetId: newSheetId,
        status: 'SKIPPED',
        message: 'The order BOM is locked — unlock it, then press Retry on the correction.',
      });
      continue;
    }
    try {
      const created = await orderBomService.createFromCostSheet({
        orderId: bom.orderId,
        styleId: bom.styleId,
        costSheetId: newSheetId,
        orderItemId: bom.orderItemId ?? undefined,
        createdById: adminId,
        acceptRateChanges: true,
      });
      await orderBomService.approve(created.id, { approvedById: adminId });
      const { calculateRequirementsFromOrder } = await import('./mrp.service');
      const order = await prisma.orders.findUnique({
        where: { id: bom.orderId },
        select: { expectedDeliveryDate: true },
      });
      await calculateRequirementsFromOrder(
        {
          orderId: bom.orderId,
          orderItemId: undefined,
          requiredDate: requiredDate ?? order?.expectedDeliveryDate ?? new Date(Date.now() + 30 * 86400000),
          checkStock: true,
        },
        adminId
      );
      try {
        const { calculateServicesForOrder } = await import('./work-order-service-requirement.service');
        await calculateServicesForOrder(bom.orderId, adminId);
      } catch (error) {
        // allow-swallow — services are recalculated on the next BOM action too; the order BOM is already right
        logError('[CadCorrection] service requirements recalculation failed', error);
      }
      outcomes.push({
        orderNumber: b.orderNumber,
        costSheetId: newSheetId,
        status: 'UPDATED',
        newBomVersion: created.version,
      });
    } catch (error) {
      outcomes.push({
        orderNumber: b.orderNumber,
        costSheetId: newSheetId,
        status: 'FAILED',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return outcomes;
}

/**
 * A cost sheet was approved. If it is one of a pending correction's new versions: apply the CAD change
 * (once), grant the price approval, and rebuild the live orders built on the version it supersedes.
 * No-op for any other sheet.
 */
export async function onCostSheetApproved(costSheetId: string, adminId: string): Promise<void> {
  const correction = await prisma.cad_corrections.findFirst({
    where: { status: { in: ['PENDING_APPROVAL', 'PARTIAL'] }, newCostSheetIds: { has: costSheetId } },
  });
  if (!correction) return;

  const after = correction.after as unknown as CorrectionAfter;
  const progress = (correction.appliedOrders ?? {}) as { cadApplied?: boolean; orders?: OrderOutcome[] };

  if (!progress.cadApplied) {
    const cad = await loadCad(prisma, correction.cadId);
    const impact = correction.impact as unknown as CorrectionImpact;
    const followers = (impact.costSheets ?? []).filter((s) => s.action === 'UPDATE').map((s) => s.costSheetId);
    await prisma.$transaction(async (tx) => {
      await writeCad(tx, cad, after, {
        approvedBy: correction.correctedById,
        priceApproval: after.wasCosted ? { approvedBy: adminId } : 'KEEP',
      });
      // The unapproved sheets built on the CAD follow it — unless one was approved meanwhile (it then keeps
      // what the admin approved; a new version carries the correction)
      const stillOpen = await tx.style_costing.findMany({
        where: { id: { in: followers }, approvalStatus: { not: 'APPROVED' }, isApproved: false },
        select: { id: true },
      });
      for (const sheet of stillOpen) await patchSheetFabricLine(tx, sheet.id, cad.id, after);
      await recomputeStyleCadStatus(tx, correction.styleId);
    });
    await recordCadEvent({
      cadId: correction.cadId,
      userId: adminId,
      action: 'CORRECT',
      newValues: { correctionId: correction.id, outcome: 'Approved — the CAD now reads the corrected values' },
      reason: correction.reason,
    });
    progress.cadApplied = true;
  }

  const outcomes = await carryToOrders(costSheetId, adminId);
  progress.orders = [...(progress.orders ?? []).filter((o) => o.costSheetId !== costSheetId), ...outcomes];

  const sheets = await prisma.style_costing.findMany({
    where: { id: { in: correction.newCostSheetIds } },
    select: { approvalStatus: true },
  });
  // PARTIAL = an order could not be rebuilt (Retry); another version still waiting keeps it PENDING_APPROVAL
  const stillWaiting = sheets.some((s) => s.approvalStatus === 'PENDING');
  const anyProblem = (progress.orders ?? []).some((o) => o.status !== 'UPDATED');
  await prisma.cad_corrections.update({
    where: { id: correction.id },
    data: {
      status: anyProblem ? 'PARTIAL' : stillWaiting ? 'PENDING_APPROVAL' : 'APPLIED',
      appliedOrders: progress as unknown as Prisma.InputJsonValue,
      decidedById: adminId,
      decidedAt: new Date(),
    },
  });
  logInfo('[CadCorrection] applied', { correctionId: correction.id, costSheetId, orders: outcomes });
}

/** Retry the orders of a PARTIAL correction (after unlocking a BOM, fixing a rate …) */
export async function retryCorrection(correctionId: string, adminId: string): Promise<void> {
  const correction = await prisma.cad_corrections.findUnique({ where: { id: correctionId } });
  if (!correction) throw new NotFoundError('CAD correction', correctionId);
  // PENDING_APPROVAL with an approved sheet = the approval hook failed before recording anything
  if (correction.status !== 'PARTIAL' && correction.status !== 'PENDING_APPROVAL') {
    throw new BusinessError('Only a correction still being applied can be retried.');
  }
  const approved = await prisma.style_costing.findMany({
    where: { id: { in: correction.newCostSheetIds }, approvalStatus: 'APPROVED' },
    select: { id: true },
  });
  for (const sheet of approved) await onCostSheetApproved(sheet.id, adminId);
}

/**
 * A pending correction's cost sheet was rejected: the correction is rejected, its other new versions too,
 * and every superseded sheet is restored. The CAD row was never changed.
 */
export async function onCostSheetRejected(costSheetId: string, adminId: string, notes: string | null): Promise<void> {
  const correction = await prisma.cad_corrections.findFirst({
    where: { status: { in: ['PENDING_APPROVAL', 'PARTIAL'] }, newCostSheetIds: { has: costSheetId } },
  });
  if (!correction) return;

  const progress = (correction.appliedOrders ?? {}) as { cadApplied?: boolean; orders?: OrderOutcome[] };
  if (progress.cadApplied) {
    // Another version of this correction was approved already — the CAD reads the corrected values. This
    // sheet's purpose simply stays on its previous version (restored); the rest of the correction stands.
    await prisma.$transaction(async (tx) => {
      await tx.style_costing.updateMany({
        where: { supersededById: costSheetId },
        data: { supersededById: null, lockedForOrders: false },
      });
      const sheets = await tx.style_costing.findMany({
        where: { id: { in: correction.newCostSheetIds } },
        select: { approvalStatus: true },
      });
      const stillWaiting = sheets.some((s) => s.approvalStatus === 'PENDING');
      const anyProblem = (progress.orders ?? []).some((o) => o.status !== 'UPDATED');
      await tx.cad_corrections.update({
        where: { id: correction.id },
        data: {
          status: anyProblem ? 'PARTIAL' : stillWaiting ? 'PENDING_APPROVAL' : 'APPLIED',
          decidedById: adminId,
          decidedAt: new Date(),
          decisionNotes: `One cost sheet version was rejected and stays on its previous figures${notes ? `: ${notes}` : ''}`,
        },
      });
    });
    await recordCadEvent({
      cadId: correction.cadId,
      userId: adminId,
      action: 'CORRECT',
      newValues: {
        correctionId: correction.id,
        outcome:
          'One cost sheet version rejected — that cost sheet keeps its previous figures; the CAD stays corrected',
      },
      reason: notes ?? correction.reason,
    });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.style_costing.updateMany({
      where: { id: { in: correction.newCostSheetIds }, approvalStatus: 'PENDING' },
      data: { approvalStatus: 'REJECTED', rejectionNotes: notes ?? 'CAD correction rejected' },
    });
    await tx.style_costing.updateMany({
      where: { supersededById: { in: correction.newCostSheetIds } },
      data: { supersededById: null, lockedForOrders: false },
    });
    await tx.cad_corrections.update({
      where: { id: correction.id },
      data: { status: 'REJECTED', decidedById: adminId, decidedAt: new Date(), decisionNotes: notes },
    });
  });
  await recordCadEvent({
    cadId: correction.cadId,
    userId: adminId,
    action: 'CORRECT',
    newValues: { correctionId: correction.id, outcome: 'Rejected by the admin — the CAD was not changed' },
    reason: notes ?? correction.reason,
  });
}

/** Corrections of a CAD row, newest first (History + the "pending" badge) */
export async function listCorrections(cadId: string) {
  return prisma.cad_corrections.findMany({
    where: { cadId },
    orderBy: { correctedAt: 'desc' },
    include: {
      correctedBy: { select: { firstName: true, lastName: true, email: true } },
      decidedBy: { select: { firstName: true, lastName: true, email: true } },
    },
  });
}

/** The correction a cost sheet version belongs to, if any (cost sheet banner) */
export async function correctionForCostSheet(costSheetId: string) {
  return prisma.cad_corrections.findFirst({
    where: { newCostSheetIds: { has: costSheetId } },
    include: {
      correctedBy: { select: { firstName: true, lastName: true, email: true } },
      cad: { select: { id: true, cutableWidth: true, componentName: true } },
    },
  });
}

export const cadCorrectionService = {
  previewCorrection,
  submitCorrection,
  onCostSheetApproved,
  onCostSheetRejected,
  retryCorrection,
  listCorrections,
  correctionForCostSheet,
};
