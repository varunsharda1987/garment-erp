/**
 * PO Status Manager Service — what REMAINS after the 2026-08-24 dead-code removal:
 *
 * - checkProcessingPOReadiness: when a GREIGE/GREIGE_LACE PO is fully received, trims the
 *   linked Processing POs to the received quantity and flips them PENDING_GREIGE →
 *   READY_FOR_PROCESSING (called from grn.service.ts post-commit).
 * - getPOsBySource / getPOSourceStats: the PO list page's tab counts and stat cards.
 *
 * Everything else this file once held was an unreachable SECOND implementation of the PO
 * workflow (see the removal notes inline). The live PO workflow is purchaseOrder.service.ts
 * + utils/stateMachine.ts — new PO status logic belongs THERE, never here.
 */

import { PurchaseOrderStatus, Prisma } from '@prisma/client';
import prisma from '../config/database';
import { logWarn } from '../utils/logger';
import { roundToCent } from '../utils/currency';
import { MATERIAL_PO_CATEGORIES } from '../types/purchaseOrder.types';

// ============================================
// Types & Interfaces
// ============================================

export interface GRNItemUpdate {
  grnId: string;
  grnItemId: string;
  poItemId: string;
  receivedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
}

export interface StatusUpdateResult {
  poId: string;
  poNumber: string;
  previousStatus: PurchaseOrderStatus;
  newStatus: PurchaseOrderStatus;
  linkedUpdates: {
    processingPOsReadied: string[];
    mrpRequirementsUpdated: string[];
    serviceRequirementsUpdated: string[];
  };
}

// ============================================
// Main Status Update Functions
// ============================================

/*
 * MRP-45: `handleGRNItemReceipt` and its private helper `updateLinkedMRPRequirements` were
 * removed here.
 *
 * They were a second, unreferenced implementation of the receipt path — a near-copy of
 * mrp.service.updateReceivedQuantity that incremented the SAME requirement_po_links rows and
 * derived the same statuses. Nothing called it (verified repo-wide), so it caused no harm; the
 * hazard was that wiring it in beside the live path in grn.service.ts would have double-counted
 * every received quantity, and it could never join a caller's transaction because it always used
 * the bare client. It also lacked the zero/negative branch, so it never downgraded a requirement
 * back to PO_SENT on a GRN reversal.
 *
 * The single receipt track is: grn.service.ts → mrpService.updateReceivedQuantity /
 * updateJwoReceivedQuantity (both tx-aware, both atomic increments).
 */

/*
 * Landmine №7 dead-code removal (2026-08-24, owner-approved): `updatePOReceivingStatus`
 * was removed here. It was an unreachable second copy of purchaseOrder.service.ts's
 * updateReceivingStatus with WORSE rules: aggregate totals instead of per-item (an
 * over-receipt on one item masked a shortfall on another) and a never-downgrade ladder
 * that would have lost the deliberate QC-rejection re-open behavior. Zero callers
 * outside its own test (verified in the 2026-08-24 adversarial study).
 */

// Phase 5a: updateLinkedServiceRequirements deleted — service requirements are fulfilled by
// Job Work Orders (service_requirement_jwo_links + updateWosrReceivedQuantity), never POs.

/**
 * Check and update linked Processing POs when Greige PO is received.
 * Handles BOTH GREIGE and GREIGE_LACE categories.
 * Exported for use in grn.service.ts post-commit.
 *
 * P2.6: Also reconciles processing PO quantities to match received greige.
 */
export async function checkProcessingPOReadiness(greigePOId: string): Promise<string[]> {
  const readiedPOs: string[] = [];

  // Check if this is a Greige PO and get its items
  const greigePO = await prisma.purchase_orders.findUnique({
    where: { id: greigePOId },
    select: {
      status: true,
      poCategory: true,
      purchase_order_items: {
        select: {
          id: true,
          orderedQuantity: true,
          receivedQuantity: true,
          materialId: true,
        },
      },
    },
  });

  // Only proceed if this is a GREIGE or GREIGE_LACE PO
  if (!greigePO?.poCategory || !['GREIGE', 'GREIGE_LACE'].includes(greigePO.poCategory)) {
    return readiedPOs;
  }

  // Trigger when the greige PO is DONE — fully received, or deliberately closed short.
  // SHORT_CLOSED counts: the greige that arrived is all that is ever going to arrive, so the
  // downstream processing PO must be reconciled to it and released. Gating on RECEIVED alone
  // left those processing POs waiting in PENDING_GREIGE forever for cloth that is not coming.
  if (greigePO.status !== 'RECEIVED' && greigePO.status !== 'SHORT_CLOSED') {
    return readiedPOs;
  }

  // Build a map of received qty per material for reconciliation.
  // ACCUMULATE, never overwrite: a greige PO routinely carries several lines for the SAME greige
  // (different colour/component). Last-wins would let a zero-receipt line erase the meters that
  // physically arrived on its sibling, and the processing PO would be trimmed to nothing.
  const receivedByMaterial = new Map<string, number>();
  for (const item of greigePO.purchase_order_items) {
    if (item.materialId) {
      const prev = receivedByMaterial.get(item.materialId) ?? 0;
      receivedByMaterial.set(item.materialId, prev + Number(item.receivedQuantity));
    }
  }

  // Find all Processing POs linked to this Greige PO
  const processingPOs = await prisma.purchase_orders.findMany({
    where: {
      linkedGreigePOId: greigePOId,
      status: 'PENDING_GREIGE',
    },
    include: {
      purchase_order_items: {
        select: {
          id: true,
          orderedQuantity: true,
          unitPrice: true,
          materialId: true,
          cgstAmount: true,
          sgstAmount: true,
          igstAmount: true,
          taxAmount: true,
        },
      },
    },
  });

  // Update each Processing PO to READY_FOR_PROCESSING with qty reconciliation
  for (const po of processingPOs) {
    // P2.6: Reconcile item quantities to received greige qty
    // Note: Processing PO items typically reference the same materialId as greige
    // or have a linked reference. For now, we match by materialId.
    let trimmedToZero = 0;
    let reconciled = false;
    for (const item of po.purchase_order_items) {
      if (!item.materialId) continue;
      const receivedQty = receivedByMaterial.get(item.materialId);
      if (receivedQty !== undefined && receivedQty < Number(item.orderedQuantity)) {
        if (receivedQty <= 0) trimmedToZero++;
        reconciled = true;
        // GST is ad-valorem at an unchanged rate, so every tax amount scales with the line base.
        // Leaving them at the ORIGINAL ordered value (as this did before short-close made the
        // trim routinely large) sends the processor a PO whose tax does not match its own lines.
        const ratio = Number(item.orderedQuantity) > 0 ? receivedQty / Number(item.orderedQuantity) : 0;
        const scale = (v: Prisma.Decimal | null) => (v == null ? null : roundToCent(Number(v) * ratio));
        await prisma.purchase_order_items.update({
          where: { id: item.id },
          data: {
            orderedQuantity: receivedQty,
            // Recalc line total with same rate
            totalPrice: roundToCent(receivedQty * Number(item.unitPrice)),
            cgstAmount: scale(item.cgstAmount),
            sgstAmount: scale(item.sgstAmount),
            igstAmount: scale(item.igstAmount),
            taxAmount: scale(item.taxAmount),
          },
        });
      }
    }

    // The header carried the ORIGINAL ordered value. Once a line is trimmed it is simply wrong,
    // and the PO page, approvals and any spend report read it.
    if (reconciled) {
      await recalculatePOHeaderFromItems(po.id);
    }

    // Every line trimmed to nothing means no greige arrived for anything this PO was to process.
    // Releasing it would send the processor a zero-quantity order. Leave it PENDING_GREIGE and say
    // so — a human decides whether to cancel it or wait for a replacement greige PO.
    if (trimmedToZero > 0 && trimmedToZero === po.purchase_order_items.filter((i) => i.materialId).length) {
      logWarn(
        `[PO ${po.poNumber}] not released: every line reconciled to zero because no greige arrived ` +
          `for its material(s). Cancel it or link it to a replacement greige PO.`
      );
      continue;
    }
    if (trimmedToZero > 0) {
      logWarn(`[PO ${po.poNumber}] released with ${trimmedToZero} zero-quantity line(s) — review before sending.`);
    }

    // Update PO status
    await prisma.purchase_orders.update({
      where: { id: po.id },
      data: { status: 'READY_FOR_PROCESSING' },
    });
    readiedPOs.push(po.poNumber);
  }

  return readiedPOs;
}

/**
 * Re-sum a PO header from its own item rows. Local to this file on purpose: importing
 * purchaseOrder.service here would close an import cycle (that service imports this one).
 */
async function recalculatePOHeaderFromItems(poId: string): Promise<void> {
  const agg = await prisma.purchase_order_items.aggregate({
    where: { poId },
    _sum: { totalPrice: true, cgstAmount: true, sgstAmount: true, igstAmount: true },
  });
  const subtotal = Number(agg._sum.totalPrice ?? 0);
  const totalCgst = Number(agg._sum.cgstAmount ?? 0);
  const totalSgst = Number(agg._sum.sgstAmount ?? 0);
  const totalIgst = Number(agg._sum.igstAmount ?? 0);
  const totalTax = totalCgst + totalSgst + totalIgst;

  await prisma.purchase_orders.update({
    where: { id: poId },
    data: {
      subtotal: roundToCent(subtotal),
      totalCgst: roundToCent(totalCgst),
      totalSgst: roundToCent(totalSgst),
      totalIgst: roundToCent(totalIgst),
      totalTax: roundToCent(totalTax),
      // A DERIVED total re-summed from the PO's own item rows immediately above, not a
      // read-modify-write of the header. `increment` would be actively wrong: it would add the
      // whole recomputed total to whatever the header already held.
      totalAmount: roundToCent(subtotal + totalTax), // allow-assign
    },
  });
}

/*
 * Landmine №7 dead-code removal (2026-08-24, owner-approved): `sendPO`, `acknowledgePO`
 * and `cancelPO` were removed here — an unreachable second copy of the PO workflow
 * (their duplicate routes lost the mount-order race from day one, BUG-DASH2). Each
 * skipped a guard the live path has:
 *   - cancelPO reset material_requirements to PO_REQUIRED with NO status filter — a
 *     RECEIVED requirement would be re-ordered by MRP (the MRP-24 class);
 *   - it OVERWROTE remarks and ran two unwrapped writes (torn state on failure);
 *   - it stamped the actor into `userId` while the live path uses approvedById;
 *   - none of them called validateTransition.
 * The live workflow is purchaseOrder.service.ts sendPurchaseOrder / acknowledgePurchaseOrder /
 * cancelPurchaseOrder — the only sanctioned PO status writers.
 */

// ============================================
// Query Functions
// ============================================

/**
 * Get POs by source type
 */
export async function getPOsBySource(
  source: 'MANUAL' | 'COST_SHEET' | 'MRP' | 'SERVICE_REQUIREMENT' | 'PRODUCTION_RUN',
  filters?: {
    status?: PurchaseOrderStatus;
    supplierId?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
  }
): Promise<{
  items: Array<{
    id: string;
    poNumber: string;
    status: PurchaseOrderStatus;
    totalAmount: number | null;
    supplierName: string;
    createdAt: Date;
  }>;
  total: number;
}> {
  const where: any = {
    poSource: source,
  };

  if (filters?.status) {
    where.status = filters.status;
  }
  if (filters?.supplierId) {
    where.supplierId = filters.supplierId;
  }
  if (filters?.fromDate || filters?.toDate) {
    where.createdAt = {};
    if (filters.fromDate) {
      where.createdAt.gte = filters.fromDate;
    }
    if (filters.toDate) {
      where.createdAt.lte = filters.toDate;
    }
  }

  const [items, total] = await Promise.all([
    prisma.purchase_orders.findMany({
      where,
      select: {
        id: true,
        poNumber: true,
        status: true,
        totalAmount: true,
        createdAt: true,
        suppliers: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 50,
      skip: filters?.offset || 0,
    }),
    prisma.purchase_orders.count({ where }),
  ]);

  return {
    items: items.map((po) => ({
      id: po.id,
      poNumber: po.poNumber,
      status: po.status,
      totalAmount: po.totalAmount ? Number(po.totalAmount) : null,
      supplierName: po.suppliers.name,
      createdAt: po.createdAt,
    })),
    total,
  };
}

/**
 * Get PO source statistics
 */
export async function getPOSourceStats(): Promise<{
  bySource: Record<string, number>;
  byCategory: Record<string, number>;
  byStatus: Record<string, number>;
  totalValue: number;
}> {
  // BUG-JWC2: material-only, so the PO page's stat cards/tab counts/Total Value agree with
  // its (material-only) table. Processing/service work is counted in Job Work Orders instead.
  // Sole consumer of this endpoint is PurchaseOrderList.tsx.
  const materialOnly = { poCategory: { in: MATERIAL_PO_CATEGORIES } };
  const [bySource, byCategory, byStatus, totalValueResult] = await Promise.all([
    prisma.purchase_orders.groupBy({
      by: ['poSource'],
      _count: { id: true },
      where: materialOnly,
    }),
    prisma.purchase_orders.groupBy({
      by: ['poCategory'],
      _count: { id: true },
      where: materialOnly,
    }),
    prisma.purchase_orders.groupBy({
      by: ['status'],
      _count: { id: true },
      where: materialOnly,
    }),
    prisma.purchase_orders.aggregate({
      _sum: { totalAmount: true },
      where: { status: { not: 'CANCELLED' }, ...materialOnly },
    }),
  ]);

  return {
    bySource: Object.fromEntries(bySource.map((s) => [s.poSource || 'MANUAL', s._count.id])),
    byCategory: Object.fromEntries(byCategory.map((c) => [c.poCategory || 'GENERAL', c._count.id])),
    byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count.id])),
    totalValue: totalValueResult._sum.totalAmount ? Number(totalValueResult._sum.totalAmount) : 0,
  };
}

// Export default for convenience
export default {
  checkProcessingPOReadiness,
  getPOsBySource,
  getPOSourceStats,
};
