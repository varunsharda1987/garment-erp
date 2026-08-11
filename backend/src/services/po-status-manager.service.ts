/**
 * PO Status Manager Service
 *
 * Handles PO status transitions and linked updates:
 * - GRN received quantity updates
 * - Processing PO auto-ready when Greige received
 * - MRP requirement received quantity updates
 * - Service requirement status updates
 *
 * This service extends the linked PO status pattern from Cost Sheet
 * to all PO sources (MRP, Service Requirements).
 */

import { PurchaseOrderStatus } from '@prisma/client';
import prisma from '../config/database';
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

/**
 * Handle GRN item receipt - updates PO item, PO status, and all linked records
 *
 * Call this when a GRN item is received/updated
 */
export async function handleGRNItemReceipt(update: GRNItemUpdate): Promise<StatusUpdateResult> {
  const poItem = await prisma.purchase_order_items.findUnique({
    where: { id: update.poItemId },
    include: {
      purchase_orders: true,
    },
  });

  if (!poItem) {
    throw new Error(`PO Item not found: ${update.poItemId}`);
  }

  const previousStatus = poItem.purchase_orders.status;

  // 1. Update PO item received quantity
  await prisma.purchase_order_items.update({
    where: { id: update.poItemId },
    data: {
      receivedQuantity: {
        increment: update.acceptedQuantity,
      },
    },
  });

  // 2. Update PO receiving status
  const newStatus = await updatePOReceivingStatus(poItem.poId);

  // 3. Update linked MRP requirements
  const mrpRequirementsUpdated = await updateLinkedMRPRequirements(update.poItemId, update.acceptedQuantity);

  // 4. Service requirements: Phase 5a — fulfilled by Job Work Orders, never POs;
  //    updateWosrReceivedQuantity (WOSR service) is the single receipt track.
  const serviceRequirementsUpdated: string[] = [];

  // 5. Check for linked Processing POs (Greige -> Processing chain)
  const processingPOsReadied = await checkProcessingPOReadiness(poItem.poId);

  return {
    poId: poItem.poId,
    poNumber: poItem.purchase_orders.poNumber,
    previousStatus,
    newStatus,
    linkedUpdates: {
      processingPOsReadied,
      mrpRequirementsUpdated,
      serviceRequirementsUpdated,
    },
  };
}

/**
 * Update PO status based on receiving progress
 */
export async function updatePOReceivingStatus(poId: string): Promise<PurchaseOrderStatus> {
  // Get all PO items with their quantities
  const poItems = await prisma.purchase_order_items.findMany({
    where: { poId },
    select: {
      orderedQuantity: true,
      receivedQuantity: true,
    },
  });

  if (poItems.length === 0) {
    return 'DRAFT';
  }

  // Calculate totals
  const totalOrdered = poItems.reduce((sum, item) => sum + Number(item.orderedQuantity), 0);
  const totalReceived = poItems.reduce((sum, item) => sum + Number(item.receivedQuantity), 0);

  // Determine new status
  let newStatus: PurchaseOrderStatus;

  if (totalReceived === 0) {
    // No change to status if nothing received yet
    const po = await prisma.purchase_orders.findUnique({
      where: { id: poId },
      select: { status: true },
    });
    return po?.status || 'DRAFT';
  } else if (totalReceived >= totalOrdered) {
    newStatus = 'RECEIVED';
  } else {
    newStatus = 'PARTIALLY_RECEIVED';
  }

  // Update PO status (only if it should change)
  const po = await prisma.purchase_orders.findUnique({
    where: { id: poId },
    select: { status: true },
  });

  // Don't downgrade status
  const statusOrder: PurchaseOrderStatus[] = [
    'DRAFT',
    'PENDING_GREIGE',
    'READY_FOR_PROCESSING',
    'SENT',
    'ACKNOWLEDGED',
    'PARTIALLY_RECEIVED',
    'RECEIVED',
    'CANCELLED',
  ];

  const currentIndex = statusOrder.indexOf(po?.status || 'DRAFT');
  const newIndex = statusOrder.indexOf(newStatus);

  // Only update if moving forward (or to RECEIVED which is always allowed)
  if (newIndex > currentIndex || newStatus === 'RECEIVED') {
    await prisma.purchase_orders.update({
      where: { id: poId },
      data: { status: newStatus },
    });
    return newStatus;
  }

  return po?.status || 'DRAFT';
}

/**
 * Update linked MRP requirements when PO items are received
 */
async function updateLinkedMRPRequirements(poItemId: string, receivedQuantity: number): Promise<string[]> {
  const updatedIds: string[] = [];

  // Find all linked MRP requirements via requirement_po_links
  const links = await prisma.requirement_po_links.findMany({
    where: { purchaseOrderItemId: poItemId },
    select: {
      id: true,
      requirementId: true,
      allocatedQuantity: true,
    },
  });

  for (const link of links) {
    // Update received quantity on the link
    await prisma.requirement_po_links.update({
      where: { id: link.id },
      data: {
        receivedQuantity: {
          increment: receivedQuantity,
        },
      },
    });

    // Check if requirement is fully fulfilled
    const allLinks = await prisma.requirement_po_links.findMany({
      where: { requirementId: link.requirementId },
      select: {
        allocatedQuantity: true,
        receivedQuantity: true,
      },
    });

    const totalAllocated = allLinks.reduce((sum, l) => sum + Number(l.allocatedQuantity), 0);
    const totalReceived = allLinks.reduce((sum, l) => sum + Number(l.receivedQuantity), 0);

    // Update requirement status
    if (totalReceived >= totalAllocated) {
      await prisma.material_requirements.update({
        where: { id: link.requirementId },
        data: { status: 'RECEIVED' },
      });
    } else if (totalReceived > 0) {
      await prisma.material_requirements.update({
        where: { id: link.requirementId },
        data: { status: 'PARTIALLY_RECEIVED' },
      });
    }

    updatedIds.push(link.requirementId);
  }

  // Also update via po_source_links for new unified tracking
  const sourceLinks = await prisma.po_source_links.findMany({
    where: {
      purchaseOrderItemId: poItemId,
      sourceType: 'MRP',
      materialRequirementId: { not: null },
    },
    select: { materialRequirementId: true },
  });

  for (const link of sourceLinks) {
    if (link.materialRequirementId && !updatedIds.includes(link.materialRequirementId)) {
      updatedIds.push(link.materialRequirementId);
    }
  }

  return updatedIds;
}

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

  // Only trigger when fully received
  if (greigePO.status !== 'RECEIVED') {
    return readiedPOs;
  }

  // Build a map of received qty per material for reconciliation
  const receivedByMaterial = new Map<string, number>();
  for (const item of greigePO.purchase_order_items) {
    if (item.materialId) {
      receivedByMaterial.set(item.materialId, Number(item.receivedQuantity));
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
        },
      },
    },
  });

  // Update each Processing PO to READY_FOR_PROCESSING with qty reconciliation
  for (const po of processingPOs) {
    // P2.6: Reconcile item quantities to received greige qty
    // Note: Processing PO items typically reference the same materialId as greige
    // or have a linked reference. For now, we match by materialId.
    for (const item of po.purchase_order_items) {
      if (!item.materialId) continue;
      const receivedQty = receivedByMaterial.get(item.materialId);
      if (receivedQty !== undefined && receivedQty < Number(item.orderedQuantity)) {
        // Update orderedQuantity to match received greige
        // Note: Full GST recalc is deferred to a follow-up
        await prisma.purchase_order_items.update({
          where: { id: item.id },
          data: {
            orderedQuantity: receivedQty,
            // Recalc line total with same rate
            totalPrice: receivedQty * Number(item.unitPrice),
          },
        });
      }
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

// ============================================
// Manual Status Update Functions
// ============================================

/**
 * Send PO to supplier
 */
export async function sendPO(poId: string, userId: string): Promise<{ success: boolean; poNumber: string }> {
  const po = await prisma.purchase_orders.findUnique({
    where: { id: poId },
    select: { status: true, poNumber: true },
  });

  if (!po) {
    throw new Error('PO not found');
  }

  const validStatuses: PurchaseOrderStatus[] = ['DRAFT', 'READY_FOR_PROCESSING'];
  if (!validStatuses.includes(po.status)) {
    throw new Error(`Cannot send PO with status "${po.status}". Must be DRAFT or READY_FOR_PROCESSING.`);
  }

  await prisma.purchase_orders.update({
    where: { id: poId },
    data: {
      status: 'SENT',
      userId,
    },
  });

  return { success: true, poNumber: po.poNumber };
}

/**
 * Acknowledge PO receipt by supplier
 */
export async function acknowledgePO(poId: string, userId: string): Promise<{ success: boolean; poNumber: string }> {
  const po = await prisma.purchase_orders.findUnique({
    where: { id: poId },
    select: { status: true, poNumber: true },
  });

  if (!po) {
    throw new Error('PO not found');
  }

  if (po.status !== 'SENT') {
    throw new Error(`Cannot acknowledge PO with status "${po.status}". Must be SENT.`);
  }

  await prisma.purchase_orders.update({
    where: { id: poId },
    data: {
      status: 'ACKNOWLEDGED',
      approvedById: userId,
    },
  });

  return { success: true, poNumber: po.poNumber };
}

/**
 * Cancel PO
 */
export async function cancelPO(
  poId: string,
  reason: string,
  userId: string
): Promise<{ success: boolean; poNumber: string }> {
  const po = await prisma.purchase_orders.findUnique({
    where: { id: poId },
    select: { status: true, poNumber: true },
  });

  if (!po) {
    throw new Error('PO not found');
  }

  // Cannot cancel if already received or cancelled
  if (po.status === 'RECEIVED' || po.status === 'CANCELLED') {
    throw new Error(`Cannot cancel PO with status "${po.status}".`);
  }

  // Cannot cancel if partially received
  if (po.status === 'PARTIALLY_RECEIVED') {
    throw new Error('Cannot cancel PO that has been partially received. Use GRN rejection instead.');
  }

  await prisma.purchase_orders.update({
    where: { id: poId },
    data: {
      status: 'CANCELLED',
      remarks: reason,
      userId,
    },
  });

  // Revert linked MRP requirements to PO_REQUIRED
  await prisma.requirement_po_links
    .findMany({
      where: {
        purchaseOrderId: poId,
      },
      select: { requirementId: true },
    })
    .then(async (links) => {
      const reqIds = links.map((l) => l.requirementId);
      if (reqIds.length > 0) {
        await prisma.material_requirements.updateMany({
          where: { id: { in: reqIds } },
          data: { status: 'PO_REQUIRED' },
        });
      }
    });

  // Phase 5a: no service-requirement revert — service work is never PO-backed anymore
  // (JWO deletion/cancellation handles WOSR reversion via service_requirement_jwo_links).

  return { success: true, poNumber: po.poNumber };
}

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
  handleGRNItemReceipt,
  updatePOReceivingStatus,
  sendPO,
  acknowledgePO,
  cancelPO,
  getPOsBySource,
  getPOSourceStats,
};
