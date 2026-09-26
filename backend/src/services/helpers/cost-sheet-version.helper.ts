/**
 * Cost-sheet versions — cloning an approved sheet into a new PENDING version, inside the caller's
 * transaction (2026-09-26: moved out of style-costing-approval.controller so the Correct CAD flow can make
 * a version server-side, in the same transaction as the rest of a correction).
 */

import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import { BusinessError, NotFoundError } from '../../errors';

/**
 * Copy the four relational item tables (fabric/trim/accessory/lace) from one cost
 * sheet to another. Order-BOM generation reads ONLY these tables (the JSON detail
 * columns are a display snapshot) — a copied sheet without its item rows produces
 * an empty/broken BOM, so every flow that clones a style_costing row must call this
 * inside the same transaction as the clone.
 */
export async function copyCostSheetItemTables(
  tx: Prisma.TransactionClient,
  sourceCostingId: string,
  targetCostingId: string
): Promise<void> {
  const [fabricItems, trimItems, accessoryItems, laceItems] = await Promise.all([
    tx.style_costing_fabric_items.findMany({ where: { costingId: sourceCostingId } }),
    tx.style_costing_trim_items.findMany({ where: { costingId: sourceCostingId } }),
    tx.style_costing_accessory_items.findMany({ where: { costingId: sourceCostingId } }),
    tx.style_costing_lace_items.findMany({ where: { costingId: sourceCostingId } }),
  ]);

  const reKey = <T extends { id: string; costingId: string; createdAt: Date; updatedAt: Date }>(rows: T[]) =>
    rows.map(({ id: _id, costingId: _costingId, createdAt: _c, updatedAt: _u, ...rest }) => ({
      ...rest,
      id: randomUUID(),
      costingId: targetCostingId,
    }));

  if (fabricItems.length > 0) {
    await tx.style_costing_fabric_items.createMany({ data: reKey(fabricItems) as any });
  }
  if (trimItems.length > 0) {
    await tx.style_costing_trim_items.createMany({ data: reKey(trimItems) as any });
  }
  if (accessoryItems.length > 0) {
    await tx.style_costing_accessory_items.createMany({ data: reKey(accessoryItems) as any });
  }
  if (laceItems.length > 0) {
    await tx.style_costing_lace_items.createMany({ data: reKey(laceItems) as any });
  }
}

/**
 * Clone an APPROVED cost sheet into a new PENDING version and supersede the source, in the caller's
 * transaction. The new version keeps the source's purpose, closed cost and budgets (ESSKY091LS v2,
 * 2026-08-25); its approvals start empty.
 */
export async function createCostSheetVersionTx(
  tx: Prisma.TransactionClient,
  sourceId: string,
  args: { userId: string; reason: string }
) {
  const sourceCostSheet = await tx.style_costing.findUnique({ where: { id: sourceId } });
  if (!sourceCostSheet) {
    throw new NotFoundError('Cost sheet', sourceId);
  }
  // Only approved cost sheets can be versioned
  const isApproved = sourceCostSheet.approvalStatus === 'APPROVED' || sourceCostSheet.isApproved;
  if (!isApproved) {
    throw new BusinessError(
      'Only approved cost sheets can be versioned. Please approve the current version first or update it directly.'
    );
  }
  const versionReason = args.reason.trim();

  // Generate new version ID
  const newVersionId = `CS-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  // Versions are unique per (styleId, purpose, version) and a style can hold several width
  // combinations in one purpose, so source.version + 1 may already be taken — use the next free one.
  const latestInPurpose = await tx.style_costing.findFirst({
    where: { styleId: sourceCostSheet.styleId, purpose: sourceCostSheet.purpose },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  const newVersionNumber = Math.max(sourceCostSheet.version, latestInPurpose?.version ?? 0) + 1;

  const created = await tx.style_costing.create({
    data: {
      id: newVersionId,
      styleId: sourceCostSheet.styleId,

      // Versioning fields
      version: newVersionNumber,
      versionDate: new Date(),
      versionReason,
      costVariancePercent: 0, // Will be calculated when values are changed

      // Copy all cost data from source
      numberOfComponents: sourceCostSheet.numberOfComponents,
      category: sourceCostSheet.category,
      subCategory: sourceCostSheet.subCategory,
      fabricDetails: sourceCostSheet.fabricDetails || undefined,
      fabricTotal: sourceCostSheet.fabricTotal,
      trimsDetails: sourceCostSheet.trimsDetails || undefined,
      trimsTotal: sourceCostSheet.trimsTotal,
      cuttingCost: sourceCostSheet.cuttingCost,
      stitchingCost: sourceCostSheet.stitchingCost,
      finishingCost: sourceCostSheet.finishingCost,
      buttonAttachmentCost: sourceCostSheet.buttonAttachmentCost,
      handworkCmtCost: sourceCostSheet.handworkCmtCost,
      cmtTotal: sourceCostSheet.cmtTotal,
      embroideryDetails: sourceCostSheet.embroideryDetails || undefined,
      embroideryTotal: sourceCostSheet.embroideryTotal,
      accessoriesDetails: sourceCostSheet.accessoriesDetails || undefined,
      accessoriesTotal: sourceCostSheet.accessoriesTotal,
      // Lace items are cloned relationally by copyCostSheetItemTables; without this the
      // column stays at its 0 default while the copied subtotal already includes lace
      laceTotal: sourceCostSheet.laceTotal,
      valueLossPercent: sourceCostSheet.valueLossPercent,
      valueLossAmount: sourceCostSheet.valueLossAmount,
      markupPercent: sourceCostSheet.markupPercent,
      markupAmount: sourceCostSheet.markupAmount,
      subtotal: sourceCostSheet.subtotal,
      totalProductCost: sourceCostSheet.totalProductCost,

      // Additional fields
      totalMaterialCost: sourceCostSheet.totalMaterialCost,
      printingCost: sourceCostSheet.printingCost,
      totalProcessingCost: sourceCostSheet.totalProcessingCost,
      checkingCost: sourceCostSheet.checkingCost,
      totalProductionCost: sourceCostSheet.totalProductionCost,
      profitMargin: sourceCostSheet.profitMargin,
      totalCostPerPiece: sourceCostSheet.totalCostPerPiece,
      sellingPricePerPiece: sourceCostSheet.sellingPricePerPiece,
      cmtCost: sourceCostSheet.cmtCost,
      fabricCost: sourceCostSheet.fabricCost,
      trimsCost: sourceCostSheet.trimsCost,
      embroideryWork: sourceCostSheet.embroideryWork,
      handWork: sourceCostSheet.handWork,
      dyeingCost: sourceCostSheet.dyeingCost,
      washingCost: sourceCostSheet.washingCost,
      otherProcessingCost: sourceCostSheet.otherProcessingCost,
      packagingCost: sourceCostSheet.packagingCost,
      accessoriesCost: sourceCostSheet.accessoriesCost,
      otherMaterialCost: sourceCostSheet.otherMaterialCost,
      factoryOverhead: sourceCostSheet.factoryOverhead,
      adminOverhead: sourceCostSheet.adminOverhead,
      transportCost: sourceCostSheet.transportCost,
      otherOverheads: sourceCostSheet.otherOverheads,
      profitAmount: sourceCostSheet.profitAmount,
      cadFabricConsumption: sourceCostSheet.cadFabricConsumption,
      cadUnit: sourceCostSheet.cadUnit,
      cadWastagePercent: sourceCostSheet.cadWastagePercent,
      smockingCost: sourceCostSheet.smockingCost,

      // A version is the same sheet re-issued: it keeps its mode, its agreed customer price and
      // its budgets. Leaving these out made every new version a COSTING sheet with no closed
      // cost (ESSKY091LS v2, 2026-08-25: RAW_MATERIAL_CALCULATION → COSTING, ₹290 dropped).
      // Approvals (closedCostApprovedAt/ById) are deliberately NOT copied — v2 starts PENDING.
      purpose: sourceCostSheet.purpose,
      closedCost: sourceCostSheet.closedCost,
      closedCostCurrency: sourceCostSheet.closedCostCurrency,
      closedCostNotes: sourceCostSheet.closedCostNotes,
      fabricBudget: sourceCostSheet.fabricBudget,
      trimsBudget: sourceCostSheet.trimsBudget,
      cmtBudget: sourceCostSheet.cmtBudget,
      embroideryBudget: sourceCostSheet.embroideryBudget,
      accessoriesBudget: sourceCostSheet.accessoriesBudget,
      totalBudget: sourceCostSheet.totalBudget,
      fabricBufferPercent: sourceCostSheet.fabricBufferPercent,
      trimsBufferPercent: sourceCostSheet.trimsBufferPercent,
      cmtBufferPercent: sourceCostSheet.cmtBufferPercent,
      embroideryBufferPercent: sourceCostSheet.embroideryBufferPercent,
      accessoriesBufferPercent: sourceCostSheet.accessoriesBufferPercent,
      orderId: sourceCostSheet.orderId,
      orderItemId: sourceCostSheet.orderItemId,

      // Note: widthCombinationHash and widthCombinationDescription are copied if they exist
      // These fields use @map in Prisma schema, so we access them conditionally
      ...((sourceCostSheet as any).widthCombinationHash && {
        widthCombinationHash: (sourceCostSheet as any).widthCombinationHash,
      }),
      ...((sourceCostSheet as any).widthCombinationDescription && {
        widthCombinationDescription: (sourceCostSheet as any).widthCombinationDescription,
      }),
      notes: `Versioned from v${sourceCostSheet.version}. Reason: ${versionReason}`,

      // New version starts as PENDING
      approvalStatus: 'PENDING',
      isApproved: false,
      createdById: args.userId,
    },
    include: {
      styles: {
        select: {
          id: true,
          styleCode: true,
          styleName: true,
        },
      },
      users_style_costing_createdByIdTousers: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  // Copy the relational item tables — the JSON columns copied above are only a
  // display snapshot; Order-BOM generation reads these tables.
  await copyCostSheetItemTables(tx, sourceCostSheet.id, created.id);

  // Link the old version to this new version (supersededBy relation)
  await tx.style_costing.update({
    where: { id: sourceCostSheet.id },
    data: {
      supersededById: created.id,
      lockedForOrders: true, // Lock the old version
    },
  });

  return { created, source: sourceCostSheet, newVersionNumber };
}
