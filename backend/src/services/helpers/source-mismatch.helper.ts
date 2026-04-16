/**
 * Source Mismatch Helper
 *
 * Handles the "Received as Ready Fabric" scenario where a GREIGE PO
 * receives finished fabric instead of greige material.
 *
 * Key operations:
 * 1. validateSourceMismatchOverride() - Pre-flight checks before allowing override
 * 2. cancelLinkedProcessingPOs() - Cancel Processing POs linked to Greige PO
 * 3. updateLinkedMRPRequirements() - Update MRP requirement statuses
 * 4. cancelRelatedProcessingBatches() - Cancel fabric_processing records if any
 * 5. cancelRelatedOutwardChallans() - Cancel pending outward challans
 *
 * See plan: docs/plans/received-as-ready-fabric.md
 */

import prisma from '../../config/database';
import { logInfo, logWarn, logError } from '../../utils/logger';

// Type alias for Prisma transaction client
type PrismaTransaction = Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/**
 * Pre-flight validation result
 */
export interface SourceMismatchValidation {
  canOverride: boolean;
  blockReason?: string;
  warnings: string[];
  linkedProcessingPOIds: string[];
  linkedMRPRequirementIds: string[];
  linkedProcessingBatchIds: string[];
  linkedChallanIds: string[];
}

/**
 * Validates whether the source mismatch override can be applied.
 * Checks for blocking conditions before allowing greige→ready fabric override.
 *
 * Blocking conditions:
 * - Processing PO already SENT or beyond
 * - Greige already issued via OUTWARD challan to processor
 * - Fabric processing batch already SENT/IN_PROCESS
 * - Previous greige_stock already exists for this PO (can't mix stock types)
 *
 * @param greigePOId - The GREIGE PO ID being received against
 * @param tx - Optional Prisma transaction client
 */
export async function validateSourceMismatchOverride(
  greigePOId: string,
  tx?: PrismaTransaction
): Promise<SourceMismatchValidation> {
  const client = tx || prisma;
  const warnings: string[] = [];
  let blockReason: string | undefined;

  // 1. Find linked Processing POs
  const processingPOs = await client.purchase_orders.findMany({
    where: { linkedGreigePOId: greigePOId },
    select: { id: true, poNumber: true, status: true },
  });
  const linkedProcessingPOIds = processingPOs.map((po) => po.id);

  // Check if any Processing PO is already SENT or beyond
  const sentPO = processingPOs.find((po) =>
    ['SENT', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED', 'RECEIVED'].includes(po.status)
  );
  if (sentPO) {
    blockReason = `Cannot override: Processing PO ${sentPO.poNumber} already sent to processor (status: ${sentPO.status})`;
    return {
      canOverride: false,
      blockReason,
      warnings,
      linkedProcessingPOIds,
      linkedMRPRequirementIds: [],
      linkedProcessingBatchIds: [],
      linkedChallanIds: [],
    };
  }

  // 2. Check for existing greige_stock from this PO (can't mix stock types)
  const existingGreigeGRNs = await client.goods_receiving_notes.findMany({
    where: {
      poId: greigePOId,
      status: 'ACCEPTED', // GRNStatus.ACCEPTED
    },
    include: {
      grn_items: true,
    },
  });

  // Check if any previous GRN items were received as greige (not ready fabric)
  const hasGreigeReceipts = existingGreigeGRNs.some((grn) =>
    grn.grn_items.some((item: { receivedAsReadyFabric: boolean }) => !item.receivedAsReadyFabric)
  );
  if (hasGreigeReceipts) {
    blockReason =
      'Cannot override: This PO already has greige receipts. Cannot mix greige and ready fabric for the same PO.';
    return {
      canOverride: false,
      blockReason,
      warnings,
      linkedProcessingPOIds,
      linkedMRPRequirementIds: [],
      linkedProcessingBatchIds: [],
      linkedChallanIds: [],
    };
  }

  // 3. Check for OUTWARD challans to processor
  const outwardChallans = await client.challans.findMany({
    where: {
      purchaseOrderId: { in: linkedProcessingPOIds },
      challanType: 'OUTWARD',
      status: { in: ['ISSUED', 'IN_TRANSIT'] },
    },
    select: { id: true, challanNumber: true, status: true },
  });
  if (outwardChallans.length > 0) {
    blockReason = `Cannot override: Greige already issued to processor via challan(s) ${outwardChallans.map((c) => c.challanNumber).join(', ')}`;
    return {
      canOverride: false,
      blockReason,
      warnings,
      linkedProcessingPOIds,
      linkedMRPRequirementIds: [],
      linkedProcessingBatchIds: [],
      linkedChallanIds: outwardChallans.map((c) => c.id),
    };
  }

  // Find pending/draft challans that will be cancelled
  const pendingChallans = await client.challans.findMany({
    where: {
      purchaseOrderId: { in: linkedProcessingPOIds },
      challanType: 'OUTWARD',
      status: 'DRAFT',
    },
    select: { id: true, challanNumber: true },
  });
  const linkedChallanIds = pendingChallans.map((c) => c.id);
  if (pendingChallans.length > 0) {
    warnings.push(`${pendingChallans.length} draft challan(s) will be cancelled`);
  }

  // 4. Check for fabric_processing batches in progress
  // Get greige IDs from the PO items to find related processing batches
  const poItems = await client.purchase_order_items.findMany({
    where: {
      poId: greigePOId,
    },
    include: {
      materials: {
        select: { greigeId: true },
      },
    },
  });
  const greigeIds = poItems
    .map((item) => item.materials?.greigeId)
    .filter((id): id is string => id !== null && id !== undefined);

  const processingBatches = await client.fabric_processing.findMany({
    where: {
      greigeId: { in: greigeIds },
      processingStatus: { in: ['SENT', 'IN_PROCESS'] },
    },
    select: { id: true, batchNumber: true, processingStatus: true },
  });
  if (processingBatches.length > 0) {
    blockReason = `Cannot override: Fabric processing batch(es) already in progress (status: ${processingBatches[0].processingStatus})`;
    return {
      canOverride: false,
      blockReason,
      warnings,
      linkedProcessingPOIds,
      linkedMRPRequirementIds: [],
      linkedProcessingBatchIds: processingBatches.map((b) => b.id),
      linkedChallanIds,
    };
  }

  // Find pending processing batches that will be cancelled
  const pendingBatches = await client.fabric_processing.findMany({
    where: {
      greigeId: { in: greigeIds },
      processingStatus: { notIn: ['COMPLETED', 'REJECTED', 'CANCELLED'] },
    },
    select: { id: true },
  });
  const linkedProcessingBatchIds = pendingBatches.map((b) => b.id);

  // 5. Find linked MRP requirements
  const requirementLinks = await client.requirement_po_links.findMany({
    where: { purchaseOrderId: greigePOId },
    select: { requirementId: true },
  });
  const greigeRequirementIds = requirementLinks.map((link) => link.requirementId);

  // Find processing requirements linked to greige requirements
  const processingRequirements = await client.material_requirements.findMany({
    where: {
      linkedRequirementId: { in: greigeRequirementIds },
      requirementType: 'PROCESSING',
      status: { not: 'CANCELLED' },
    },
    select: { id: true },
  });
  const linkedMRPRequirementIds = [...greigeRequirementIds, ...processingRequirements.map((r) => r.id)];

  // All checks passed
  return {
    canOverride: true,
    warnings,
    linkedProcessingPOIds,
    linkedMRPRequirementIds,
    linkedProcessingBatchIds,
    linkedChallanIds,
  };
}

/**
 * Cancels Processing POs linked to a GREIGE PO.
 *
 * @param greigePOId - The GREIGE PO ID
 * @param reason - Cancellation reason
 * @param tx - Prisma transaction client
 * @returns Array of cancelled PO numbers
 */
export async function cancelLinkedProcessingPOs(
  greigePOId: string,
  reason: string,
  tx: PrismaTransaction
): Promise<string[]> {
  const processingPOs = await tx.purchase_orders.findMany({
    where: {
      linkedGreigePOId: greigePOId,
      status: { not: 'CANCELLED' },
    },
    select: { id: true, poNumber: true, remarks: true },
  });

  const cancelledPONumbers: string[] = [];

  for (const po of processingPOs) {
    await tx.purchase_orders.update({
      where: { id: po.id },
      data: {
        status: 'CANCELLED',
        remarks: `${po.remarks || ''}\n[Auto-cancelled] ${reason}`.trim(),
      },
    });
    cancelledPONumbers.push(po.poNumber);
    logInfo(`[SourceMismatch] Cancelled Processing PO ${po.poNumber}: ${reason}`);
  }

  return cancelledPONumbers;
}

/**
 * Updates MRP requirements when greige is received as ready fabric.
 * - GREIGE requirement → RECEIVED (we got the goods, just different type)
 * - PROCESSING requirement → CANCELLED (no processing needed)
 *
 * @param greigePOId - The GREIGE PO ID
 * @param tx - Prisma transaction client
 */
export async function updateLinkedMRPRequirements(greigePOId: string, tx: PrismaTransaction): Promise<void> {
  // Find greige requirements linked to this PO
  const requirementLinks = await tx.requirement_po_links.findMany({
    where: { purchaseOrderId: greigePOId },
    select: { requirementId: true },
  });
  const greigeRequirementIds = requirementLinks.map((link) => link.requirementId);

  if (greigeRequirementIds.length === 0) {
    logWarn(`[SourceMismatch] No MRP requirements linked to PO ${greigePOId}`);
    return;
  }

  // 1. Mark GREIGE requirements as RECEIVED
  await tx.material_requirements.updateMany({
    where: { id: { in: greigeRequirementIds } },
    data: {
      status: 'RECEIVED',
      // Note: remarks field doesn't exist in updateMany, handle separately if needed
    },
  });
  logInfo(`[SourceMismatch] Marked ${greigeRequirementIds.length} GREIGE requirement(s) as RECEIVED`);

  // 2. Cancel linked PROCESSING requirements
  const processingReqs = await tx.material_requirements.updateMany({
    where: {
      linkedRequirementId: { in: greigeRequirementIds },
      requirementType: 'PROCESSING',
      status: { not: 'CANCELLED' },
    },
    data: {
      status: 'CANCELLED',
    },
  });

  if (processingReqs.count > 0) {
    logInfo(`[SourceMismatch] Cancelled ${processingReqs.count} PROCESSING requirement(s)`);
  }
}

/**
 * Cancels pending fabric_processing batches when greige received as ready fabric.
 *
 * @param greigeIds - Array of greige IDs to check
 * @param tx - Prisma transaction client
 * @returns Number of batches cancelled
 */
export async function cancelRelatedProcessingBatches(greigeIds: string[], tx: PrismaTransaction): Promise<number> {
  if (greigeIds.length === 0) return 0;

  const result = await tx.fabric_processing.updateMany({
    where: {
      greigeId: { in: greigeIds },
      processingStatus: { notIn: ['COMPLETED', 'REJECTED', 'CANCELLED'] },
    },
    data: {
      processingStatus: 'CANCELLED',
      qualityNotes: 'Cancelled: Greige received as ready fabric',
    },
  });

  if (result.count > 0) {
    logInfo(`[SourceMismatch] Cancelled ${result.count} fabric processing batch(es)`);
  }

  return result.count;
}

/**
 * Cancels draft OUTWARD challans when greige received as ready fabric.
 *
 * @param processingPOIds - Array of Processing PO IDs
 * @param tx - Prisma transaction client
 * @returns Number of challans cancelled
 */
export async function cancelRelatedOutwardChallans(processingPOIds: string[], tx: PrismaTransaction): Promise<number> {
  if (processingPOIds.length === 0) return 0;

  const result = await tx.challans.updateMany({
    where: {
      purchaseOrderId: { in: processingPOIds },
      challanType: 'OUTWARD',
      status: 'DRAFT',
    },
    data: {
      status: 'CANCELLED',
      remarks: 'Cancelled: Greige received as ready fabric',
    },
  });

  if (result.count > 0) {
    logInfo(`[SourceMismatch] Cancelled ${result.count} draft challan(s)`);
  }

  return result.count;
}

/**
 * Finds the fabric_master linked to a greige.
 * Returns the first active fabric that has this greige as its source.
 *
 * @param greigeId - The greige_master ID
 * @param tx - Optional Prisma transaction client
 * @returns The linked fabric_master or null
 */
export async function findFabricForGreige(
  greigeId: string,
  tx?: PrismaTransaction
): Promise<{ id: string; fabricCode: string; fabricName: string } | null> {
  const client = tx || prisma;

  const fabric = await client.fabric_master.findFirst({
    where: {
      greigeId: greigeId,
      isActive: true,
    },
    select: {
      id: true,
      fabricCode: true,
      fabricName: true,
    },
  });

  return fabric;
}

/**
 * Updates cost sheet sourcing strategy when greige is permanently changed to ready fabric.
 * Only called when `updateFutureSourcing: true`.
 *
 * This function:
 * 1. Finds styles linked to the greige PO via MRP requirements
 * 2. Updates their cost sheet fabric items from GREIGE_PROCESSED to READY_FABRIC
 * 3. Updates the costs (readyFabricCost = actualRate, clears greigeCost/processingCost)
 *
 * @param greigePOId - The GREIGE PO ID
 * @param fabricId - The fabric_master ID (finished fabric)
 * @param actualRate - The actual rate received for ready fabric
 * @param tx - Prisma transaction client
 * @returns Number of cost sheet fabric items updated
 */
export async function updateCostSheetSourcingStrategy(
  greigePOId: string,
  fabricId: string,
  actualRate: number,
  tx: PrismaTransaction
): Promise<{ updatedItems: number; affectedStyles: string[] }> {
  // 1. Find MRP requirements linked to this PO to get style IDs via order_bom
  const requirementLinks = await tx.requirement_po_links.findMany({
    where: { purchaseOrderId: greigePOId },
    select: { requirementId: true },
  });

  const requirementIds = requirementLinks.map((link) => link.requirementId);

  // Get style IDs from material_requirements through orderBom
  const requirements = await tx.material_requirements.findMany({
    where: { id: { in: requirementIds } },
    include: {
      orderBom: {
        select: { styleId: true },
      },
    },
  });

  // Extract unique style IDs from the linked order BOMs
  const styleIds = [
    ...new Set(
      requirements.map((req) => req.orderBom?.styleId).filter((id): id is string => id !== null && id !== undefined)
    ),
  ];

  if (styleIds.length === 0) {
    logWarn(`[SourceMismatch] No styles found linked to GREIGE PO ${greigePOId} - skipping cost sheet update`);
    return { updatedItems: 0, affectedStyles: [] };
  }

  logInfo(`[SourceMismatch] Found ${styleIds.length} style(s) linked to GREIGE PO for cost sheet update`, {
    styleIds,
    greigePOId,
  });

  // 2. Find unapproved cost sheets for these styles that use this fabric with GREIGE_PROCESSED strategy
  const fabricItemsToUpdate = await tx.style_costing_fabric_items.findMany({
    where: {
      fabricId: fabricId,
      sourcingStrategy: 'GREIGE_PROCESSED',
      costing: {
        styleId: { in: styleIds },
        isApproved: false, // Only update unapproved cost sheets
      },
    },
    include: {
      costing: {
        select: { id: true, styleId: true, version: true },
      },
    },
  });

  if (fabricItemsToUpdate.length === 0) {
    logInfo(`[SourceMismatch] No unapproved cost sheet fabric items found to update for styles`, {
      styleIds,
      fabricId,
    });
    return { updatedItems: 0, affectedStyles: [] };
  }

  // 3. Update each fabric item's sourcing strategy
  for (const fabricItem of fabricItemsToUpdate) {
    await tx.style_costing_fabric_items.update({
      where: { id: fabricItem.id },
      data: {
        sourcingStrategy: 'READY_FABRIC',
        readyFabricCost: actualRate,
        greigeCost: null,
        processingCost: null,
        processorId: null,
        rateCardId: null,
        costPerMeter: actualRate,
        totalCost: Number(fabricItem.effectiveCad) * actualRate,
        notes:
          `${fabricItem.notes || ''}\n[Auto-updated] Changed from GREIGE_PROCESSED to READY_FABRIC - greige received as ready fabric`.trim(),
      },
    });

    logInfo(`[SourceMismatch] Updated cost sheet fabric item to READY_FABRIC`, {
      fabricItemId: fabricItem.id,
      costingId: fabricItem.costing?.id,
      styleId: fabricItem.costing?.styleId,
      newRate: actualRate,
    });
  }

  // 4. Recalculate affected cost sheets' fabric totals
  const affectedCostingIds = [...new Set(fabricItemsToUpdate.map((item) => item.costingId))];
  for (const costingId of affectedCostingIds) {
    // Sum all fabric item costs for this costing
    const fabricItems = await tx.style_costing_fabric_items.findMany({
      where: { costingId },
      select: { totalCost: true },
    });
    const newFabricTotal = fabricItems.reduce((sum, item) => sum + Number(item.totalCost), 0);

    await tx.style_costing.update({
      where: { id: costingId },
      data: {
        fabricTotal: newFabricTotal,
        // Note: Full recalculation of totalProductCost would require more complex logic
        // For now, just update fabricTotal - user should review the cost sheet
        notes:
          'Cost sheet updated: Sourcing strategy changed to READY_FABRIC due to greige received as ready fabric. Please review and recalculate.',
      },
    });
  }

  const affectedStyles = [
    ...new Set(fabricItemsToUpdate.map((item) => item.costing?.styleId).filter(Boolean)),
  ] as string[];

  logInfo(`[SourceMismatch] Cost sheet update complete`, {
    updatedItems: fabricItemsToUpdate.length,
    affectedCostings: affectedCostingIds.length,
    affectedStyles,
  });

  return { updatedItems: fabricItemsToUpdate.length, affectedStyles };
}

/**
 * Executes all source mismatch cleanup operations in a single transaction.
 * This is the main orchestration function to call from GRN approval.
 *
 * @param greigePOId - The GREIGE PO ID
 * @param tx - Prisma transaction client
 * @returns Summary of actions taken
 */
export async function executeSourceMismatchCleanup(
  greigePOId: string,
  tx: PrismaTransaction
): Promise<{
  cancelledPOs: string[];
  cancelledBatches: number;
  cancelledChallans: number;
}> {
  // 1. Cancel linked Processing POs
  const cancelledPOs = await cancelLinkedProcessingPOs(greigePOId, 'Received as ready fabric instead of greige', tx);

  // 2. Update MRP requirements
  await updateLinkedMRPRequirements(greigePOId, tx);

  // 3. Get greige IDs from PO items for processing batch cancellation
  const poItems = await tx.purchase_order_items.findMany({
    where: { poId: greigePOId },
    include: {
      materials: { select: { greigeId: true } },
    },
  });
  const greigeIds = poItems
    .map((item) => item.materials?.greigeId)
    .filter((id): id is string => id !== null && id !== undefined);

  // 4. Cancel related processing batches
  const cancelledBatches = await cancelRelatedProcessingBatches(greigeIds, tx);

  // 5. Get Processing PO IDs for challan cancellation
  const processingPOs = await tx.purchase_orders.findMany({
    where: { linkedGreigePOId: greigePOId },
    select: { id: true },
  });
  const processingPOIds = processingPOs.map((po) => po.id);

  // 6. Cancel related outward challans
  const cancelledChallans = await cancelRelatedOutwardChallans(processingPOIds, tx);

  return {
    cancelledPOs,
    cancelledBatches,
    cancelledChallans,
  };
}
