/**
 * CAD ↔ Costing Provenance Helper
 *
 * fabric_width_cad rows are the SOURCE that downstream money documents freeze
 * their fabric rates from (rates freeze at costing — snapshots are the contract
 * and are never rewritten):
 *   - style_costing_fabric_items.fabricCADId   (cost sheet line built from the row)
 *   - order_bom_items.selectedCadId            (order BOM line — prices MRP + POs)
 *   - order_items.selectedCadId / order_item_costing.selectedCadId
 *   - purchase_orders.cadId
 *   - material_requirements.cadId
 *
 * The ESSKY091LS incident (2026-08-25): a price-approved costing option was
 * unapproved, re-priced and re-approved AFTER an APPROVED cost sheet and an
 * APPROVED order BOM had frozen its old rate — leaving them silently pointing
 * at a source that no longer says what they say. This helper answers the two
 * questions that prevent/surface that:
 *
 *   1. getCadCostingDependents(cadId)      — who froze a rate from this row?
 *      (consulted by the unapprove guard in fabric-costing.controller.ts)
 *   2. computeCostSheetSourceDrift(sheetId) — do a sheet's snapshots still match
 *      the CAD rows they came from? (cost sheet detail response + drift sweep)
 *
 * NOTE on key naming: dependent cost sheets expose their approval under
 * `costSheetApprovalStatus` so consuming code in costing-module controllers
 * never has to touch a bare `approvalStatus` token (two-owner split ratchet).
 */

import prisma from '../../config/database';

// ---------------------------------------------------------------------------
// Dependents
// ---------------------------------------------------------------------------

export interface CadDependentCostSheet {
  costSheetId: string;
  version: number;
  purpose: string;
  costSheetApprovalStatus: string;
  styleCode: string | null;
  fabricItemIds: string[];
}

export interface CadCostingDependents {
  cadId: string;
  /** Active (non-superseded) cost sheets holding a snapshot of this CAD row. */
  costSheets: CadDependentCostSheet[];
  /** Historical sheets (supersededById set) — informational only, never block/warn. */
  supersededCostSheetCount: number;
  /** BOMs on active versions referencing this CAD (order + status for display). */
  orderBoms: Array<{
    orderBomId: string;
    bomVersion: number;
    bomStatus: string;
    orderNumber: string;
    itemCount: number;
  }>;
  inactiveOrderBomItemCount: number;
  orderItems: Array<{ orderItemId: string; orderNumber: string }>;
  orderItemCostingCount: number;
  purchaseOrders: Array<{ purchaseOrderId: string; poNumber: string; status: string }>;
  materialRequirements: Array<{ requirementId: string; requirementNumber: string; status: string }>;
  counts: {
    costSheetItems: number;
    orderBomItems: number;
    orderItems: number;
    /** NOTE: not named orderItemCostings — the serializer remaps that relation key to `costings`. */
    orderItemCostingCount: number;
    purchaseOrders: number;
    materialRequirements: number;
  };
  /** Sheets that make unapproval a hard block: APPROVED and not superseded. */
  blockingCostSheets: CadDependentCostSheet[];
  hasBlockingDependents: boolean;
  hasWarnDependents: boolean;
}

const LIST_CAP = 20; // display lists are capped; counts always hold true totals

/**
 * Collect everything downstream that froze a rate from this CAD row.
 * Read-only; safe to call from guards and detail endpoints.
 */
export async function getCadCostingDependents(
  cadId: string,
  db: typeof prisma = prisma
): Promise<CadCostingDependents> {
  const [sheetItems, bomItems, orderItems, orderItemCostingCount, pos, requirements] = await Promise.all([
    db.style_costing_fabric_items.findMany({
      where: { fabricCADId: cadId },
      select: {
        id: true,
        costing: {
          select: {
            id: true,
            version: true,
            purpose: true,
            approvalStatus: true, // style_costing's own (cost sheet) approval
            supersededById: true,
            styles: { select: { styleCode: true } },
          },
        },
      },
    }),
    db.order_bom_items.findMany({
      where: { selectedCadId: cadId },
      select: {
        id: true,
        orderBom: {
          select: {
            id: true,
            version: true,
            status: true,
            isActive: true,
            order: { select: { orderNumber: true } },
          },
        },
      },
    }),
    db.order_items.findMany({
      where: { selectedCadId: cadId },
      select: { id: true, orders: { select: { orderNumber: true } } },
    }),
    db.order_item_costing.count({ where: { selectedCadId: cadId } }),
    db.purchase_orders.findMany({
      where: { cadId },
      select: { id: true, poNumber: true, status: true },
    }),
    db.material_requirements.findMany({
      where: { cadId },
      select: { id: true, requirementNumber: true, status: true },
    }),
  ]);

  // Group cost-sheet items by parent sheet; split active vs superseded.
  const sheetMap = new Map<string, CadDependentCostSheet>();
  const supersededSheetIds = new Set<string>();
  for (const item of sheetItems) {
    const sheet = item.costing;
    if (sheet.supersededById) {
      supersededSheetIds.add(sheet.id);
      continue;
    }
    const existing = sheetMap.get(sheet.id);
    if (existing) {
      existing.fabricItemIds.push(item.id);
    } else {
      sheetMap.set(sheet.id, {
        costSheetId: sheet.id,
        version: sheet.version,
        purpose: String(sheet.purpose),
        costSheetApprovalStatus: String(sheet.approvalStatus),
        styleCode: sheet.styles?.styleCode ?? null,
        fabricItemIds: [item.id],
      });
    }
  }
  const costSheets = Array.from(sheetMap.values());
  const blockingCostSheets = costSheets.filter((s) => s.costSheetApprovalStatus === 'APPROVED');

  // Group BOM items by parent BOM; only active BOM versions warn.
  const bomMap = new Map<
    string,
    { orderBomId: string; bomVersion: number; bomStatus: string; orderNumber: string; itemCount: number }
  >();
  let inactiveOrderBomItemCount = 0;
  for (const item of bomItems) {
    const bom = item.orderBom;
    if (!bom.isActive) {
      inactiveOrderBomItemCount += 1;
      continue;
    }
    const existing = bomMap.get(bom.id);
    if (existing) {
      existing.itemCount += 1;
    } else {
      bomMap.set(bom.id, {
        orderBomId: bom.id,
        bomVersion: bom.version,
        bomStatus: String(bom.status),
        orderNumber: bom.order.orderNumber,
        itemCount: 1,
      });
    }
  }
  const orderBoms = Array.from(bomMap.values());

  const counts = {
    costSheetItems: sheetItems.length,
    orderBomItems: bomItems.length,
    orderItems: orderItems.length,
    orderItemCostingCount,
    purchaseOrders: pos.length,
    materialRequirements: requirements.length,
  };

  const hasBlockingDependents = blockingCostSheets.length > 0;
  const hasWarnDependents =
    costSheets.some((s) => s.costSheetApprovalStatus !== 'APPROVED') ||
    orderBoms.length > 0 ||
    orderItems.length > 0 ||
    orderItemCostingCount > 0 ||
    pos.length > 0 ||
    requirements.length > 0;

  return {
    cadId,
    costSheets,
    supersededCostSheetCount: supersededSheetIds.size,
    orderBoms: orderBoms.slice(0, LIST_CAP),
    inactiveOrderBomItemCount,
    orderItems: orderItems.slice(0, LIST_CAP).map((oi) => ({ orderItemId: oi.id, orderNumber: oi.orders.orderNumber })),
    orderItemCostingCount,
    purchaseOrders: pos
      .slice(0, LIST_CAP)
      .map((po) => ({ purchaseOrderId: po.id, poNumber: po.poNumber, status: String(po.status) })),
    materialRequirements: requirements
      .slice(0, LIST_CAP)
      .map((r) => ({ requirementId: r.id, requirementNumber: r.requirementNumber, status: String(r.status) })),
    counts,
    blockingCostSheets,
    hasBlockingDependents,
    hasWarnDependents,
  };
}

// ---------------------------------------------------------------------------
// Cost-sheet → order consumers (the "lockedForOrders" that actually works)
// ---------------------------------------------------------------------------

export interface CostSheetOrderDependents {
  /** Active order BOMs built from this sheet (order_bom.sourceCostSheetId). */
  activeBoms: Array<{
    orderBomId: string;
    bomVersion: number;
    bomStatus: string;
    orderNumber: string;
    orderStatus: string;
  }>;
  /** ALL BOM references incl. inactive/historical — audit lineage (delete guard). */
  anyBomCount: number;
  /** Per-item costings based on this sheet whose parent order is not cancelled. */
  liveOrderItemCostings: Array<{ orderNumber: string; orderStatus: string }>;
  /** ALL order_item_costing references, any order state (delete guard). */
  anyOrderItemCostingCount: number;
  /** A live order consumed this sheet — approval must not be pulled from under it. */
  hasLiveConsumers: boolean;
}

/**
 * Who consumed this cost sheet? `style_costing.lockedForOrders` was written but
 * never read (dead flag) — this live query is the real lock the revoke/edit/
 * delete guards consult. Sanctioned way to change a consumed sheet: create a
 * new version (old one stays APPROVED as the BOM's frozen source of record).
 */
export async function getCostSheetOrderDependents(
  costSheetId: string,
  db: typeof prisma = prisma
): Promise<CostSheetOrderDependents> {
  const [activeBomRows, anyBomCount, liveItemCostings, anyOrderItemCostingCount] = await Promise.all([
    db.order_bom.findMany({
      where: { sourceCostSheetId: costSheetId, isActive: true },
      select: {
        id: true,
        version: true,
        status: true,
        order: { select: { orderNumber: true, status: true } },
      },
    }),
    db.order_bom.count({ where: { sourceCostSheetId: costSheetId } }),
    db.order_item_costing.findMany({
      where: {
        baseCostingId: costSheetId,
        order_item: { orders: { status: { not: 'CANCELLED' } } },
      },
      select: { order_item: { select: { orders: { select: { orderNumber: true, status: true } } } } },
    }),
    db.order_item_costing.count({ where: { baseCostingId: costSheetId } }),
  ]);

  const activeBoms = activeBomRows.map((b) => ({
    orderBomId: b.id,
    bomVersion: b.version,
    bomStatus: String(b.status),
    orderNumber: b.order.orderNumber,
    orderStatus: String(b.order.status),
  }));
  const liveOrderItemCostings = liveItemCostings.map((c) => ({
    orderNumber: c.order_item.orders.orderNumber,
    orderStatus: String(c.order_item.orders.status),
  }));

  return {
    activeBoms,
    anyBomCount,
    liveOrderItemCostings,
    anyOrderItemCostingCount,
    hasLiveConsumers: activeBoms.length > 0 || liveOrderItemCostings.length > 0,
  };
}

/** Distinct order numbers across all live consumers, for human messages. */
export function consumerOrderNumbers(deps: CostSheetOrderDependents): string[] {
  return Array.from(
    new Set([...deps.activeBoms.map((b) => b.orderNumber), ...deps.liveOrderItemCostings.map((c) => c.orderNumber)])
  );
}

// ---------------------------------------------------------------------------
// Snapshot ↔ source comparison (shared by drift endpoint + sweep script)
// ---------------------------------------------------------------------------

export type SnapshotDriftFlag =
  | 'PRICE_CHANGED' // snapshot rate no longer matches the CAD row's current rate
  | 'CONSUMPTION_CHANGED' // per-piece average changed on the CAD row
  | 'SOURCE_UNAPPROVED' // the CAD row's price approval was removed
  | 'SOURCE_UNCOSTED'; // the CAD row's costing columns were cleared entirely

export interface SnapshotForDrift {
  costPerMeter: number | null;
  greigeCost: number | null;
  processingCost: number | null;
  cadMeters: number | null; // per-piece average at snapshot time
  isManualOverride: boolean;
}

export interface CadForDrift {
  totalCostPerMeter: number | null;
  greigeCostPerMeter: number | null;
  processingPricePerMeter: number | null;
  cadAverage: number | null; // per-piece average (NOT cadMeters, which is marker length)
  costingApprovalStatus: string | null;
}

/** Decimal(10,2) money columns — differences under half a paisa are storage noise. */
const PRICE_EPSILON = 0.005;
/** Decimal(10,4) consumption columns. */
const CONSUMPTION_EPSILON = 0.005;

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

const differs = (a: number | null, b: number | null, epsilon: number): boolean =>
  a !== null && b !== null && Math.abs(a - b) > epsilon;

/**
 * Pure comparison of one frozen snapshot against its source CAD row's current
 * state. Manual-override items intentionally diverge — price/consumption flags
 * are suppressed for them, but source-status flags (unapproved/uncosted) are
 * always reported.
 */
export function compareSnapshotToCad(snapshot: SnapshotForDrift, cad: CadForDrift): SnapshotDriftFlag[] {
  const flags: SnapshotDriftFlag[] = [];

  if (cad.totalCostPerMeter === null) {
    flags.push('SOURCE_UNCOSTED');
  }
  if (cad.costingApprovalStatus !== 'APPROVED' && cad.costingApprovalStatus !== 'ALTERNATE_APPROVED') {
    flags.push('SOURCE_UNAPPROVED');
  }

  if (!snapshot.isManualOverride && cad.totalCostPerMeter !== null) {
    const priceChanged =
      differs(snapshot.costPerMeter, cad.totalCostPerMeter, PRICE_EPSILON) ||
      differs(snapshot.greigeCost, cad.greigeCostPerMeter, PRICE_EPSILON) ||
      differs(snapshot.processingCost, cad.processingPricePerMeter, PRICE_EPSILON);
    if (priceChanged) flags.push('PRICE_CHANGED');

    if (differs(snapshot.cadMeters, cad.cadAverage, CONSUMPTION_EPSILON)) {
      flags.push('CONSUMPTION_CHANGED');
    }
  }

  return flags;
}

// ---------------------------------------------------------------------------
// Cost-sheet drift report
// ---------------------------------------------------------------------------

export interface CostSheetDriftItem {
  itemId: string;
  fabricName: string;
  width: number | null;
  isManualOverride: boolean;
  overrideReason: string | null;
  flags: SnapshotDriftFlag[];
  snapshot: {
    costPerMeter: number | null;
    greigeCost: number | null;
    processingCost: number | null;
    cadMeters: number | null;
  };
  current: {
    totalCostPerMeter: number | null;
    greigeCostPerMeter: number | null;
    processingPricePerMeter: number | null;
    cadAverage: number | null;
    costingApprovalStatusCurrent: string | null;
    componentName: string | null;
    cutableWidth: number | null;
    cadUpdatedAt: Date;
  };
  /** effectiveCad × (current − snapshot) rate; null when either side is uncosted. */
  estimatedImpactPerPiece: number | null;
}

export interface CostSheetSourceDrift {
  costSheetId: string;
  hasDrift: boolean;
  items: CostSheetDriftItem[];
  /** Fabric items with no fabricCADId (legacy/manual rows) — not comparable. */
  untrackedItems: number;
  summary: {
    itemsChecked: number;
    itemsWithDrift: number;
    totalEstimatedImpactPerPiece: number;
    flagCounts: Partial<Record<SnapshotDriftFlag, number>>;
  };
}

/**
 * Compare every tracked fabric item on a cost sheet against its source CAD row.
 * Returns only items that drifted; clean items are counted in the summary.
 */
export async function computeCostSheetSourceDrift(
  costSheetId: string,
  db: typeof prisma = prisma
): Promise<CostSheetSourceDrift> {
  const items = await db.style_costing_fabric_items.findMany({
    where: { costingId: costSheetId },
    select: {
      id: true,
      fabricName: true,
      width: true,
      cadMeters: true,
      effectiveCad: true,
      costPerMeter: true,
      greigeCost: true,
      processingCost: true,
      isManualOverride: true,
      overrideReason: true,
      fabricCADId: true,
      fabricCAD: {
        select: {
          totalCostPerMeter: true,
          greigeCostPerMeter: true,
          processingPricePerMeter: true,
          cadAverage: true,
          costingApprovalStatus: true,
          componentName: true,
          cutableWidth: true,
          updatedAt: true,
        },
      },
    },
  });

  const driftItems: CostSheetDriftItem[] = [];
  let untrackedItems = 0;
  let itemsChecked = 0;
  const flagCounts: Partial<Record<SnapshotDriftFlag, number>> = {};

  for (const item of items) {
    if (!item.fabricCADId || !item.fabricCAD) {
      untrackedItems += 1;
      continue;
    }
    itemsChecked += 1;

    const snapshot: SnapshotForDrift = {
      costPerMeter: num(item.costPerMeter),
      greigeCost: num(item.greigeCost),
      processingCost: num(item.processingCost),
      cadMeters: num(item.cadMeters),
      isManualOverride: item.isManualOverride,
    };
    const cad: CadForDrift = {
      totalCostPerMeter: num(item.fabricCAD.totalCostPerMeter),
      greigeCostPerMeter: num(item.fabricCAD.greigeCostPerMeter),
      processingPricePerMeter: num(item.fabricCAD.processingPricePerMeter),
      cadAverage: num(item.fabricCAD.cadAverage),
      costingApprovalStatus: item.fabricCAD.costingApprovalStatus ? String(item.fabricCAD.costingApprovalStatus) : null,
    };

    const flags = compareSnapshotToCad(snapshot, cad);
    if (flags.length === 0) continue;

    for (const flag of flags) flagCounts[flag] = (flagCounts[flag] ?? 0) + 1;

    const meters = num(item.effectiveCad) || num(item.cadMeters);
    const estimatedImpactPerPiece =
      meters !== null &&
      snapshot.costPerMeter !== null &&
      cad.totalCostPerMeter !== null &&
      flags.includes('PRICE_CHANGED')
        ? meters * (cad.totalCostPerMeter - snapshot.costPerMeter)
        : null;

    driftItems.push({
      itemId: item.id,
      fabricName: item.fabricName,
      width: num(item.width),
      isManualOverride: item.isManualOverride,
      overrideReason: item.overrideReason,
      flags,
      snapshot: {
        costPerMeter: snapshot.costPerMeter,
        greigeCost: snapshot.greigeCost,
        processingCost: snapshot.processingCost,
        cadMeters: snapshot.cadMeters,
      },
      current: {
        totalCostPerMeter: cad.totalCostPerMeter,
        greigeCostPerMeter: cad.greigeCostPerMeter,
        processingPricePerMeter: cad.processingPricePerMeter,
        cadAverage: cad.cadAverage,
        costingApprovalStatusCurrent: cad.costingApprovalStatus,
        componentName: item.fabricCAD.componentName,
        cutableWidth: num(item.fabricCAD.cutableWidth),
        cadUpdatedAt: item.fabricCAD.updatedAt,
      },
      estimatedImpactPerPiece,
    });
  }

  const totalEstimatedImpactPerPiece = driftItems.reduce((sum, d) => sum + (d.estimatedImpactPerPiece ?? 0), 0);

  return {
    costSheetId,
    hasDrift: driftItems.length > 0,
    items: driftItems,
    untrackedItems,
    summary: {
      itemsChecked,
      itemsWithDrift: driftItems.length,
      totalEstimatedImpactPerPiece,
      flagCounts,
    },
  };
}
