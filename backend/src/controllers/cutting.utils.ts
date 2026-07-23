import prisma from '../config/database';

// ============================================
// Shared Helper Functions for Cutting Controllers
// ============================================

export const transformCuttingBatch = (batch: any) => ({
  ...batch,
  actualFabricWidth: batch.actualFabricWidth ? Number(batch.actualFabricWidth) : null,
  cadAverageUsed: batch.cadAverageUsed ? Number(batch.cadAverageUsed) : null,
  cadWidthUsed: batch.cadWidthUsed ? Number(batch.cadWidthUsed) : null,
  fabricConsumed: batch.fabricConsumed ? Number(batch.fabricConsumed) : null,
  actualAverage: batch.actualAverage ? Number(batch.actualAverage) : null,
  varianceFromCad: batch.varianceFromCad ? Number(batch.varianceFromCad) : null,
  variancePercent: batch.variancePercent ? Number(batch.variancePercent) : null,
  wastageMeters: batch.wastageMeters ? Number(batch.wastageMeters) : null,
  wastagePercent: batch.wastagePercent ? Number(batch.wastagePercent) : null,
  fabricIssued: batch.fabricIssued ? Number(batch.fabricIssued) : null,
  fabricReturned: batch.fabricReturned ? Number(batch.fabricReturned) : null,
  actualConsumption: batch.actualConsumption ? Number(batch.actualConsumption) : null,
  returnChallanId: batch.returnChallanId || null,
  workOrder: batch.workOrder
    ? {
        id: batch.workOrder.id,
        workOrderNumber: batch.workOrder.workOrderNumber,
        styleId: batch.workOrder.styleId,
        orderId: batch.workOrder.orderId,
        style: batch.workOrder.styles
          ? {
              id: batch.workOrder.styles.id,
              styleCode: batch.workOrder.styles.styleCode,
              styleName: batch.workOrder.styles.styleName,
            }
          : null,
        order: batch.workOrder.orders
          ? {
              id: batch.workOrder.orders.id,
              orderNumber: batch.workOrder.orders.orderNumber,
              customer: batch.workOrder.orders.customers
                ? {
                    id: batch.workOrder.orders.customers.id,
                    name: batch.workOrder.orders.customers.name,
                  }
                : null,
            }
          : null,
      }
    : null,
  component: batch.component
    ? {
        id: batch.component.id,
        componentName: batch.component.componentName,
        componentType: batch.component.componentType,
      }
    : null,
  fabricStock: batch.fabricStock
    ? {
        id: batch.fabricStock.id,
        rollNumbers: batch.fabricStock.rollNumbers || '',
        quantityAvailable: Number(batch.fabricStock.quantityAvailable),
        finishedWidth: Number(batch.fabricStock.finishedWidth),
        cutableWidth: Number(batch.fabricStock.cutableWidth),
        fabric: batch.fabricStock.fabricMaster
          ? {
              id: batch.fabricStock.fabricMaster.id,
              fabricCode: batch.fabricStock.fabricMaster.fabricCode,
              fabricName: batch.fabricStock.fabricMaster.fabricName,
            }
          : null,
      }
    : null,
  cuttingOperator: batch.cuttingOperator
    ? {
        id: batch.cuttingOperator.id,
        name: `${batch.cuttingOperator.firstName} ${batch.cuttingOperator.lastName}`,
      }
    : null,
  createdBy: batch.createdBy
    ? {
        id: batch.createdBy.id,
        name: `${batch.createdBy.firstName} ${batch.createdBy.lastName}`,
      }
    : null,
  skuOutputs: batch.skuOutputs?.map((sku: any) => ({
    ...sku,
    color: sku.color
      ? {
          id: sku.color.id,
          colorName: sku.color.colorName,
          colorCode: sku.color.colorCode,
        }
      : null,
    size: sku.size
      ? {
          id: sku.size.id,
          sizeName: sku.size.sizeName,
          sortOrder: sku.size.sortOrder,
        }
      : null,
  })),
  defects: batch.defects || [],
});

export const generateBatchNumber = async (workOrderNumber: string, componentName?: string): Promise<string> => {
  const prefix = `CB-${workOrderNumber}`;
  const componentPart = componentName ? `-${componentName.substring(0, 3).toUpperCase()}` : '';

  // Max-based (not count-based) so a deleted batch never causes its number to be reused
  // (bug-hunt production-17)
  const existing = await prisma.cutting_batches.findMany({
    where: {
      batchNumber: {
        startsWith: prefix,
      },
    },
    select: { batchNumber: true },
  });
  const maxSeq = existing.reduce((max, b) => {
    const m = b.batchNumber.match(/-(\d+)$/);
    return m ? Math.max(max, parseInt(m[1], 10)) : max;
  }, 0);

  const seq = (maxSeq + 1).toString().padStart(3, '0');
  return `${prefix}${componentPart}-${seq}`;
};

/**
 * Merge duplicate (colorId, sizeId) rows by summing the given numeric fields.
 * Postgres treats NULL colorIds as DISTINCT in the @@unique indexes on cutting_batch_skus /
 * stitching_issue_skus / transfer_slip_skus, so size-only duplicate rows insert freely and
 * double-count every downstream total (bug-hunt production-18). Dedupe server-side before create.
 */
export function dedupeSkuRows<T extends { colorId?: string | null; sizeId: string }>(
  rows: T[],
  sumFields: string[]
): T[] {
  const map = new Map<string, T>();
  for (const row of rows) {
    const key = `${row.colorId ?? ''}|${row.sizeId}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...row });
    } else {
      for (const f of sumFields) {
        const prev = Number((existing as any)[f]);
        const next = Number((row as any)[f]);
        if (!isNaN(next)) {
          (existing as any)[f] = (isNaN(prev) ? 0 : prev) + next;
        }
      }
    }
  }
  return Array.from(map.values());
}

// Include options for cutting batch queries
export const batchIncludeOptions = {
  workOrder: {
    include: {
      styles: true,
      orders: {
        include: {
          customers: true,
        },
      },
    },
  },
  component: true,
  fabricStock: {
    include: {
      fabricMaster: true,
    },
  },
  cuttingOperator: true,
  createdBy: true,
  skuOutputs: {
    include: {
      color: true,
      size: true,
    },
  },
  defects: true,
  additionalFabrics: {
    include: {
      fabricStock: {
        include: {
          fabricMaster: true,
        },
      },
    },
  },
};

// Helper: recalculate batch totals from all lays
export async function recalculateBatchTotals(tx: any, batchId: string) {
  // Fetch all lays with their SKUs and per-fabric records
  const lays = await tx.cutting_lays.findMany({
    where: { cuttingBatchId: batchId },
    select: {
      id: true,
      numberOfLayers: true,
      layerLength: true,
      cuttingBatchFabricId: true,
      skuOutputs: { select: { colorId: true, sizeId: true, pieces: true } },
      layFabrics: { select: { cuttingBatchFabricId: true, layerLength: true } },
    },
  });

  // cutQty per size = SUM(piecesPerLayer * numberOfLayers) across all lays
  // "pieces" in cutting_lay_skus now represents piecesPerLayer
  const skuTotals = new Map<string, number>();
  for (const lay of lays) {
    const layers = lay.numberOfLayers || 1;
    for (const sku of lay.skuOutputs) {
      const key = `${sku.colorId}|${sku.sizeId}`;
      const totalForSize = sku.pieces * layers;
      skuTotals.set(key, (skuTotals.get(key) || 0) + totalForSize);
    }
  }

  // Update each cutting_batch_skus record
  const batchSkus = await tx.cutting_batch_skus.findMany({
    where: { cuttingBatchId: batchId },
  });

  for (const sku of batchSkus) {
    const key = `${sku.colorId}|${sku.sizeId}`;
    const cutQty = skuTotals.get(key) || 0;
    await tx.cutting_batch_skus.update({
      where: { id: sku.id },
      data: {
        cutQty,
        goodPcs: cutQty - sku.rejectedQty,
      },
    });
  }

  // Fabric consumption: use cutting_lay_fabrics if available, fallback to lay.layerLength
  let totalFabricConsumed = 0;
  const perFabricConsumed = new Map<string, number>();

  for (const lay of lays) {
    const layers = lay.numberOfLayers || 1;

    if (lay.layFabrics && lay.layFabrics.length > 0) {
      // New structure: per-fabric layer lengths
      for (const lf of lay.layFabrics) {
        const consumed = Number(lf.layerLength) * layers;
        totalFabricConsumed += consumed;
        const prev = perFabricConsumed.get(lf.cuttingBatchFabricId) || 0;
        perFabricConsumed.set(lf.cuttingBatchFabricId, prev + consumed);
      }
    } else {
      // Legacy: single layerLength on lay
      const consumed = Number(lay.layerLength) * layers;
      totalFabricConsumed += consumed;
      if (lay.cuttingBatchFabricId) {
        const prev = perFabricConsumed.get(lay.cuttingBatchFabricId) || 0;
        perFabricConsumed.set(lay.cuttingBatchFabricId, prev + consumed);
      }
    }
  }

  await tx.cutting_batches.update({
    where: { id: batchId },
    data: { fabricConsumed: totalFabricConsumed },
  });

  // Update per-fabric consumption on cutting_batch_fabrics
  const allFabrics = await tx.cutting_batch_fabrics.findMany({
    where: { batchId },
    select: { id: true },
  });
  for (const fabric of allFabrics) {
    await tx.cutting_batch_fabrics.update({
      where: { id: fabric.id },
      data: { fabricConsumed: perFabricConsumed.get(fabric.id) || 0 },
    });
  }
}
