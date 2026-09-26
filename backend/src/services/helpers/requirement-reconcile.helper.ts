/**
 * Requirement reconcile — when MRP recalculates an order, each BOM line's requirements are carried over
 * instead of being cancelled and created again (2026-09-26).
 *
 * Every BOM rebuild gives each line a new id, and MRP matched requirements by that id, so after a rebuild:
 *   - open requirements were cancelled and re-created under new numbers, stranding their reservations;
 *   - requirements already on a PO / job work were kept, and a FULL new requirement was created beside
 *     them — ordering the cloth twice.
 * Now each line knows the line it replaces (order_bom_items.previousItemId, bom-lineage.helper). Before
 * MRP's cancel pass runs, every calculated requirement is reconciled with its FAMILY — the rows of the
 * same material / type / colour on its own line and its ancestor lines:
 *
 *   nothing committed → the oldest open row is updated in place (keeps its number); it keeps its own
 *                       reservation, and gives back what the new need no longer uses.
 *   something committed (on a PO / job work, received, converted, split, on a challan, or greige already
 *                       sent to the processor) → it is never grown or re-pointed. Open "extra" rows shrink
 *                       to fit; more still needed becomes ONE `DECISION_PENDING` row (the team chooses
 *                       Order the extra / Don't order more); less needed is recorded as `surplusQty` on the
 *                       committed row — the PO is never touched.
 *
 * Earlier "Don't order more" decisions (CANCELLED + shortCloseReason NOT_ORDERED) count as covered, so a
 * recalculation never asks twice. A line the matcher could not pair with the line it replaces takes the
 * unclaimed rows of its material on a replaced BOM (so a PO row is still found); a committed row whose
 * material the current BOM no longer uses (greige changed, line dropped) is marked all surplus. Rows the reconcile owns are returned in `handledIds` — the cancel pass
 * must leave them alone.
 */

import { MaterialRequirementStatus, Prisma, Unit } from '@prisma/client';
import type { CalculatedRequirement } from '../../types/mrp.types';
import { isQtyZero, qtyRemaining } from '../../utils/quantity';
import { heldForRequirement, releaseReservations } from './stock-reservation.helper';

type Tx = Prisma.TransactionClient;

export const NOT_ORDERED = 'NOT_ORDERED';
const LOCKED_STATUSES = new Set(['PO_GENERATED', 'PO_SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CONVERTED']);
const round3 = (n: number) => Math.round(n * 1000) / 1000;

export interface ReconcileOutcome {
  /** Rows the reconcile owns — MRP's cancel pass must not cancel them */
  handledIds: Set<string>;
  /** A calculated requirement → the row that now stands for it (null when nothing is left to order) */
  savedFor: Map<CalculatedRequirement, string | null>;
  created: number;
  updated: number;
}

/** Each line id → its ancestor line ids, nearest first (previousItemId chain) */
async function ancestorsOf(tx: Tx, lineIds: string[]): Promise<Map<string, string[]>> {
  const parentOf = new Map<string, string | null>();
  let toLoad = [...new Set(lineIds)];
  while (toLoad.length > 0) {
    const rows = await tx.order_bom_items.findMany({
      where: { id: { in: toLoad } },
      select: { id: true, previousItemId: true },
    });
    toLoad = [];
    for (const r of rows) {
      parentOf.set(r.id, r.previousItemId);
      if (r.previousItemId && !parentOf.has(r.previousItemId)) toLoad.push(r.previousItemId);
    }
  }
  const result = new Map<string, string[]>();
  for (const id of lineIds) {
    const chain: string[] = [];
    let cur = parentOf.get(id) ?? null;
    while (cur && chain.length < 50 && !chain.includes(cur)) {
      chain.push(cur);
      cur = parentOf.get(cur) ?? null;
    }
    result.set(id, chain);
  }
  return result;
}

const FAMILY_INCLUDE = {
  requirement_po_links: {
    where: { purchase_orders: { status: { notIn: ['CANCELLED'] } } },
    select: { id: true },
  },
  requirement_jwo_links: { select: { id: true } },
  _count: { select: { challanItems: true } },
} satisfies Prisma.material_requirementsInclude;

type FamilyRow = Prisma.material_requirementsGetPayload<{ include: typeof FAMILY_INCLUDE }>;

async function cancelRows(tx: Tx, ids: string[]) {
  if (ids.length === 0) return;
  await tx.material_requirements.updateMany({ where: { id: { in: ids } }, data: { status: 'CANCELLED' } });
  await releaseReservations(tx, ids);
}

/** The fields a reconciled / decision row takes from today's calculation */
function lineFields(req: CalculatedRequirement) {
  return {
    orderQuantity: req.orderQuantity,
    quantityPerUnit: req.quantityPerUnit,
    wastagePercent: req.wastagePercent,
    fabricWidth: req.fabricWidth,
    cadId: req.cadId,
    unit: req.unit as Unit,
    calculatedAt: new Date(),
    orderBomId: req.orderBomId,
    orderBomItemId: req.orderBomItemId,
    shrinkagePercentUsed: req.shrinkagePercentUsed ?? null,
    shrinkageSource: req.shrinkageSourceUsed ?? null,
    unitPrice: req.unitPrice,
    rateSource: req.rateSource,
    ...(req.requirementType === 'PROCESSING'
      ? { processorId: req.processorId ?? null, processingCost: req.processingCost ?? null }
      : {}),
  };
}

export async function reconcileRequirementLineage(
  tx: Tx,
  args: {
    materialReqs: CalculatedRequirement[];
    processingReqs: CalculatedRequirement[];
    requiredDate: Date;
    userId: string;
    nextNumber: () => Promise<string>;
    /** MRP's own "greige already sent to the processor" rule — such a row is committed */
    settledWhere: Prisma.material_requirementsWhereInput;
  }
): Promise<ReconcileOutcome> {
  const outcome: ReconcileOutcome = { handledIds: new Set(), savedFor: new Map(), created: 0, updated: 0 };
  const all = [...args.materialReqs, ...args.processingReqs];
  const lineIds = [...new Set(all.map((r) => r.orderBomItemId).filter((id): id is string => !!id))];
  if (lineIds.length === 0) return outcome;
  const ancestors = await ancestorsOf(tx, lineIds);

  // The greige MATERIAL row that now stands for a line — a new PROCESSING decision row links to it
  const greigeFor = new Map<string, string>();
  const greigeKey = (r: CalculatedRequirement, materialId: string) =>
    `${r.orderItemId}-${materialId}-${r.colorName || ''}-${r.orderBomItemId || ''}`;

  // Pass 1 — each line's own family: rows on the line and the lines it replaces (previousItemId).
  // Pass 2 — a line with none (the matcher could not pair it with the line it replaces) takes the rows of the
  // same material / type / colour left on a replaced BOM that no family claimed; without this such a line
  // planned a FULL new requirement beside a PO-linked one, as before lineage existed.
  const claimed = new Set<string>();
  const sameStream = (req: CalculatedRequirement): Prisma.material_requirementsWhereInput => ({
    orderId: req.orderId,
    orderItemId: req.orderItemId,
    materialId: req.materialId,
    requirementType: req.requirementType || 'MATERIAL',
    colorName: req.colorName || null,
  });
  const loadFamily = async (where: Prisma.material_requirementsWhereInput) =>
    (await tx.material_requirements.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: FAMILY_INCLUDE,
    })) as FamilyRow[];
  const plans: Array<{
    req: CalculatedRequirement;
    familyWhere: Prisma.material_requirementsWhereInput;
    family: FamilyRow[];
  }> = [];
  const unpaired: CalculatedRequirement[] = [];
  for (const req of all) {
    if (!req.orderBomItemId) continue;
    const lines = [req.orderBomItemId, ...(ancestors.get(req.orderBomItemId) ?? [])];
    const familyWhere = { ...sameStream(req), orderBomItemId: { in: lines } };
    const family = await loadFamily(familyWhere);
    if (family.length === 0) {
      unpaired.push(req);
      continue;
    }
    family.forEach((r) => claimed.add(r.id));
    plans.push({ req, familyWhere, family });
  }
  for (const req of unpaired) {
    const familyWhere: Prisma.material_requirementsWhereInput = {
      ...sameStream(req),
      orderBomItem: { orderBom: { isActive: false } },
      id: { notIn: [...claimed] },
    };
    const family = await loadFamily(familyWhere);
    if (family.length === 0) continue;
    family.forEach((r) => claimed.add(r.id));
    plans.push({ req, familyWhere, family });
  }
  // Greige MATERIAL rows before the PROCESSING rows that link to them, as calculated
  plans.sort((a, b) => all.indexOf(a.req) - all.indexOf(b.req));

  for (const { req, familyWhere, family } of plans) {
    const type = req.requirementType || 'MATERIAL';
    const settled = new Set(
      type === 'MATERIAL'
        ? (
            await tx.material_requirements.findMany({
              where: { AND: [familyWhere, args.settledWhere] },
              select: { id: true },
            })
          ).map((r) => r.id)
        : []
    );

    const declined = family
      .filter((r) => r.status === 'CANCELLED' && r.shortCloseReason === NOT_ORDERED)
      .reduce((sum, r) => sum + Number(r.shortQuantity ?? 0), 0);
    const active = family.filter((r) => r.status !== 'CANCELLED');
    if (active.length === 0 && declined === 0) continue; // only cancelled rows — MRP revives one as before

    const ownLocked = (r: FamilyRow) =>
      LOCKED_STATUSES.has(String(r.status)) ||
      r.requirement_po_links.length > 0 ||
      r.requirement_jwo_links.length > 0 ||
      r._count.challanItems > 0 ||
      settled.has(r.id);

    // Split trees: a remainder belongs to its root; a tree is committed when any row of it is, or split at all
    const rootOf = (r: FamilyRow): string => {
      let cur: FamilyRow | undefined = r;
      for (let guard = 0; cur?.splitFromId && guard < 20; guard++) {
        const parent = active.find((a) => a.id === cur!.splitFromId);
        if (!parent) break;
        cur = parent;
      }
      return cur!.id;
    };
    const treeLocked = new Map<string, boolean>();
    for (const r of active) {
      const root = rootOf(r);
      const locked = ownLocked(r) || r.splitFromId !== null || active.some((a) => a.splitFromId === r.id);
      treeLocked.set(root, (treeLocked.get(root) ?? false) || locked);
    }
    const roots = active.filter((r) => rootOf(r) === r.id);
    const lockedRoots = roots.filter((r) => treeLocked.get(r.id));
    const openRoots = roots.filter((r) => !treeLocked.get(r.id));
    const decisionRows = openRoots.filter((r) => r.status === MaterialRequirementStatus.DECISION_PENDING);
    const extras = openRoots.filter((r) => r.status !== MaterialRequirementStatus.DECISION_PENDING);
    const need = Number(req.totalRequired);

    // ---- Nothing committed: carry the oldest open row over, in place ----
    if (lockedRoots.length === 0 && isQtyZero(declined)) {
      await cancelRows(
        tx,
        decisionRows.map((r) => r.id)
      );
      const keep = extras[0];
      if (!keep) continue; // only decision rows (now cancelled) — the normal path creates the new row
      let held = await heldForRequirement(tx, keep.id);
      if (held > need && !isQtyZero(held - need)) {
        held -= await releaseReservations(tx, [keep.id], round3(held - need));
      }
      // A row holding a real reservation keeps it (and shows what is still short); a row that never reserved
      // is PO Required — MRP suggests stock, only Use Stock claims it (owner decision 26-Sep-2026)
      const holds = held > 0 && !isQtyZero(held);
      const allocated = holds ? Math.min(held, need) : req.allocatedFromStock;
      const shortfall = holds ? qtyRemaining(need, allocated) : req.shortfall;
      const status = holds
        ? isQtyZero(shortfall)
          ? MaterialRequirementStatus.FULFILLED_STOCK
          : MaterialRequirementStatus.PARTIAL_STOCK
        : req.status;
      await tx.material_requirements.update({
        where: { id: keep.id },
        data: {
          ...lineFields(req),
          totalRequired: need,
          availableStock: req.availableStock,
          allocatedFromStock: allocated,
          shortfall,
          status,
          surplusQty: null,
          ...(type === 'PROCESSING' && req.linkedGreigeMaterialId
            ? {
                linkedRequirementId:
                  greigeFor.get(greigeKey(req, req.linkedGreigeMaterialId)) ?? keep.linkedRequirementId,
              }
            : {}),
        },
      });
      outcome.handledIds.add(keep.id);
      outcome.savedFor.set(req, keep.id);
      outcome.updated++;
      if (req.isGreigeRequirement) greigeFor.set(greigeKey(req, req.materialId), keep.id);
      continue;
    }

    // ---- Something committed: never grow it; decide the difference ----
    for (const r of active) {
      if (treeLocked.get(rootOf(r))) outcome.handledIds.add(r.id);
    }
    const committed = lockedRoots.reduce((sum, r) => sum + Number(r.totalRequired), 0);
    const room = need - committed - declined; // what open rows may still cover

    // Open extras shrink to fit the room (newest first); a row shrunk to nothing is cancelled
    let extrasTotal = extras.reduce((sum, r) => sum + Number(r.totalRequired), 0);
    const survivors = new Set(extras.map((r) => r.id));
    for (const r of [...extras].reverse()) {
      const over = extrasTotal - Math.max(0, room);
      if (over <= 0 || isQtyZero(over)) break;
      const total = Number(r.totalRequired);
      if (over >= total || isQtyZero(total - over)) {
        await cancelRows(tx, [r.id]);
        survivors.delete(r.id);
        extrasTotal -= total;
      } else {
        const next = round3(total - over);
        const held = await heldForRequirement(tx, r.id);
        if (held > next) await releaseReservations(tx, [r.id], round3(held - next));
        const allocated = Math.min(Number(r.allocatedFromStock), next);
        await tx.material_requirements.update({
          where: { id: r.id },
          data: { totalRequired: next, allocatedFromStock: allocated, shortfall: qtyRemaining(next, allocated) },
        });
        extrasTotal -= over;
      }
    }
    // The extras that survived stay orderable and move to the current line
    for (const id of survivors) {
      outcome.handledIds.add(id);
      await tx.material_requirements.update({ where: { id }, data: lineFields(req) });
    }

    const delta = round3(room - extrasTotal);
    let decisionId: string | null = null;
    if (delta > 0 && !isQtyZero(delta)) {
      const [reuse, ...others] = decisionRows;
      await cancelRows(
        tx,
        others.map((r) => r.id)
      );
      if (reuse) {
        await tx.material_requirements.update({
          where: { id: reuse.id },
          data: {
            ...lineFields(req),
            totalRequired: delta,
            availableStock: 0,
            allocatedFromStock: 0,
            shortfall: delta,
            status: MaterialRequirementStatus.DECISION_PENDING,
          },
        });
        decisionId = reuse.id;
        outcome.updated++;
      } else {
        const created = await tx.material_requirements.create({
          data: {
            requirementNumber: await args.nextNumber(),
            source: 'SALES_ORDER',
            orderId: req.orderId,
            orderItemId: req.orderItemId,
            materialId: req.materialId,
            requirementType: type,
            colorName: req.colorName || null,
            componentName: req.componentName || null,
            requiredDate: args.requiredDate,
            createdById: args.userId,
            preferredSupplierId: type === 'PROCESSING' ? (req.processorId ?? null) : (req.preferredSupplierId ?? null),
            printingType: type === 'PROCESSING' ? (req.printingType ?? null) : null,
            linkedRequirementId:
              type === 'PROCESSING' && req.linkedGreigeMaterialId
                ? (greigeFor.get(greigeKey(req, req.linkedGreigeMaterialId)) ?? null)
                : null,
            ...lineFields(req),
            totalRequired: delta,
            availableStock: 0,
            allocatedFromStock: 0,
            shortfall: delta,
            status: MaterialRequirementStatus.DECISION_PENDING,
          },
        });
        decisionId = created.id;
        outcome.created++;
      }
      outcome.handledIds.add(decisionId);
    } else {
      await cancelRows(
        tx,
        decisionRows.map((r) => r.id)
      );
    }

    // Less needed than already committed: record it on the committed row (declined metres are not on
    // any PO, so they never count here)
    const over = committed - need;
    const surplus = over > 0 && !isQtyZero(over) ? round3(over) : null;
    for (const [i, r] of lockedRoots.entries()) {
      const value = i === 0 ? surplus : null;
      if (Number(r.surplusQty ?? 0) !== Number(value ?? 0)) {
        await tx.material_requirements.update({ where: { id: r.id }, data: { surplusQty: value } });
      }
    }

    outcome.savedFor.set(req, decisionId ?? lockedRoots[0]?.id ?? [...survivors][0] ?? null);
    if (req.isGreigeRequirement && lockedRoots[0]) greigeFor.set(greigeKey(req, req.materialId), lockedRoots[0].id);
  }

  await markUnneededCommitted(tx, {
    orders: [...new Set(all.map((r) => r.orderId))],
    orderItems: [...new Set(all.map((r) => r.orderItemId))],
    claimed,
    settledWhere: args.settledWhere,
    outcome,
  });
  return outcome;
}

/**
 * A committed row (on a PO / job work, received, greige sent) on a REPLACED BOM that no line of the current
 * version claimed — its greige was changed, or its line dropped — is all surplus: the current BOM needs none
 * of it. It is never cancelled (the PO stands); surplusQty says so. Conversion chains are left alone: a
 * CONVERTED fabric row's greige / processing children carry its plan under other materials.
 */
async function markUnneededCommitted(
  tx: Tx,
  args: {
    orders: string[];
    orderItems: string[];
    claimed: Set<string>;
    settledWhere: Prisma.material_requirementsWhereInput;
    outcome: ReconcileOutcome;
  }
): Promise<void> {
  const base: Prisma.material_requirementsWhereInput = {
    orderId: { in: args.orders },
    orderItemId: { in: args.orderItems },
    status: { notIn: ['CANCELLED', 'CONVERTED'] },
    orderBomItem: { orderBom: { isActive: false } },
    id: { notIn: [...args.claimed] },
  };
  const rows = await tx.material_requirements.findMany({
    where: base,
    select: {
      id: true,
      status: true,
      totalRequired: true,
      surplusQty: true,
      linkedRequirement: { select: { status: true, linkedRequirement: { select: { status: true } } } },
      requirement_po_links: {
        where: { purchase_orders: { status: { notIn: ['CANCELLED'] } } },
        select: { id: true },
      },
      _count: { select: { requirement_jwo_links: true } },
    },
  });
  if (rows.length === 0) return;
  const settled = new Set(
    (await tx.material_requirements.findMany({ where: { AND: [base, args.settledWhere] }, select: { id: true } })).map(
      (r) => r.id
    )
  );
  for (const r of rows) {
    const inConversion =
      r.linkedRequirement?.status === 'CONVERTED' || r.linkedRequirement?.linkedRequirement?.status === 'CONVERTED';
    const committed =
      LOCKED_STATUSES.has(String(r.status)) ||
      r.requirement_po_links.length > 0 ||
      r._count.requirement_jwo_links > 0 ||
      settled.has(r.id);
    if (inConversion || !committed) continue;
    args.outcome.handledIds.add(r.id);
    const all = round3(Number(r.totalRequired));
    if (Number(r.surplusQty ?? 0) !== all) {
      await tx.material_requirements.update({ where: { id: r.id }, data: { surplusQty: all } });
    }
  }
}
