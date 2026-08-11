/**
 * Process PO ↔ JWO compatibility envelope (Consolidation Phase 4c-final).
 *
 * The dyeing/printing "process PO" surfaces are re-keyed on job_work_orders (the JWO
 * is the commercial + operational document; the purchase order is a legacy shadow that
 * exists only on pre-4c records). This helper renders a JWO in the exact wire shape the
 * existing frontend consumes, so legacy PO-paired records and new JWO-only records look
 * identical to the UI.
 *
 * IMPORTANT: the envelope emits RAW prisma-style keys (`suppliers`,
 * `purchase_order_items`) — the response serializer maps them to `supplier` / `items`.
 * Never emit pre-camelized relation keys here.
 */
import { Prisma } from '@prisma/client';
import prisma from '../../config/database';

export const processLabDipInclude = {
  style: {
    select: { id: true, styleCode: true, buyerStyleRef: true, styleName: true },
  },
  fabric: {
    select: {
      id: true,
      fabricCode: true,
      fabricName: true,
      finishType: true,
      printDesign: true,
      colorName: true,
      greigeId: true,
      greige: {
        select: {
          id: true,
          greigeCode: true,
          greigeName: true,
          genericGreigeName: true,
          composition: true,
          yarnCount: true,
        },
      },
    },
  },
  targetColor: {
    select: { id: true, colorName: true, colorCode: true },
  },
  processor: {
    select: { id: true, name: true, code: true },
  },
  approvedBy: {
    select: { id: true, firstName: true, lastName: true },
  },
  createdBy: {
    select: { id: true, firstName: true, lastName: true },
  },
};

export const processJwoInclude = {
  labDip: { include: processLabDipInclude },
  style: {
    select: { id: true, styleCode: true, buyerStyleRef: true, styleName: true },
  },
  fabric: {
    select: { id: true, fabricCode: true, fabricName: true },
  },
  processor: {
    select: { id: true, name: true, code: true },
  },
  greigeStockLot: {
    select: {
      id: true,
      quantityAvailable: true,
      quantityConsumed: true,
      purchaseCost: true,
      greigeWidth: true,
      greige: {
        select: {
          id: true,
          greigeCode: true,
          greigeName: true,
          genericGreigeName: true,
          composition: true,
          yarnCount: true,
        },
      },
    },
  },
  finishedFabric: {
    select: { id: true, fabricCode: true, fabricName: true, actualWidth: true },
  },
  fabricStockLot: {
    select: { id: true, quantityAvailable: true, purchaseCost: true },
  },
  outwardChallan: {
    select: { id: true, challanNumber: true, challanDate: true },
  },
  inwardChallan: {
    select: { id: true, challanNumber: true, challanDate: true },
  },
  createdBy: {
    select: { id: true, firstName: true, lastName: true },
  },
  // Legacy shadow PO (pre-4c records only)
  purchaseOrder: {
    include: {
      purchase_order_items: true,
      suppliers: { select: { id: true, name: true, code: true } },
    },
  },
};

export type ProcessJwo = Prisma.job_work_ordersGetPayload<{ include: typeof processJwoInclude }>;

/**
 * Unified process status — same ladder the old PO-based computeProcessPOStatus used
 * (derived entirely from the JWO's legacy status), with cancellation from either the
 * shadow PO or the JWO's universal status (legacy JobWorkStatus has no CANCELLED).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const computeProcessPOStatusFromJwo = (jwo: any): string => {
  if (jwo.purchaseOrder?.status === 'CANCELLED' || jwo.jwoStatus === 'CANCELLED') return 'CANCELLED';

  const jobStatus = (jwo.status as string) || '';
  if (jobStatus === 'STOCK_UPDATED') return 'STOCK_UPDATED';
  if (jobStatus === 'QUALITY_CHECKED') return 'QUALITY_CHECKED';
  if (jobStatus === 'RECEIVED') return 'RECEIVED';
  if (jobStatus === 'AT_MILL' || jobStatus === 'SENT_TO_MILL') return 'AT_MILL';
  if (jobStatus === 'READY_TO_SEND') return 'DRAFT';
  if (jobStatus.includes('RETURNED')) return 'RETURNED';
  return 'DRAFT';
};

/**
 * Render a JWO in the legacy process-PO wire shape. `id` is the JWO id — all
 * process-PO actions are keyed on it (with a PO-id fallback in resolveProcessJwo).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const toProcessPOEnvelope = (jwo: ProcessJwo): any => {
  const { purchaseOrder, ...jwoRest } = jwo;

  // PO-status analog for JWO-only records (type parity; UI derives from processPOStatus)
  const derivedPoStatus = (() => {
    if (jwo.jwoStatus === 'CANCELLED') return 'CANCELLED';
    switch (jwo.status) {
      case 'STOCK_UPDATED':
      case 'QUALITY_CHECKED':
      case 'RECEIVED':
        return 'RECEIVED';
      case 'AT_MILL':
      case 'SENT_TO_MILL':
        return 'SENT';
      default:
        return 'DRAFT';
    }
  })();

  return {
    id: jwo.id,
    poNumber: purchaseOrder?.poNumber ?? jwo.jobWorkNumber,
    poDate: purchaseOrder?.poDate ?? jwo.createdAt,
    expectedDeliveryDate: purchaseOrder?.expectedDeliveryDate ?? jwo.expectedReturnDate,
    status: purchaseOrder?.status ?? derivedPoStatus,
    totalAmount: purchaseOrder?.totalAmount ?? jwo.totalAmount ?? jwo.subtotal,
    subtotal: purchaseOrder?.subtotal ?? jwo.subtotal,
    agreedRatePerMeter: jwo.agreedRatePerMeter,
    labDip: jwo.labDip
      ? { id: jwo.labDip.id, labDipNumber: (jwo.labDip as { labDipNumber?: string }).labDipNumber }
      : null,
    remarks: purchaseOrder?.remarks ?? jwo.remarks,
    supplierId: jwo.processorId,
    poCategory: 'PROCESSING',
    poSource: purchaseOrder?.poSource ?? 'MANUAL',
    createdAt: jwo.createdAt,
    updatedAt: jwo.updatedAt,
    isActive: jwo.isActive,
    // Raw keys — serializer maps suppliers → supplier, purchase_order_items → items
    suppliers: jwo.processor,
    purchase_order_items: purchaseOrder?.purchase_order_items ?? [],
    jobWorkOrder: jwoRest,
    purchaseOrder: purchaseOrder
      ? { id: purchaseOrder.id, poNumber: purchaseOrder.poNumber, status: purchaseOrder.status }
      : null,
    processPOStatus: computeProcessPOStatusFromJwo(jwo),
  };
};

/**
 * Dual-lookup: `:id` may be a JWO id (new) or a legacy purchase-order id (old
 * bookmarks/links). The processType predicate is MANDATORY — the unified detail page
 * probes dyeing then printing and relies on a 404 for the wrong process type.
 */
export async function resolveProcessJwo(id: string, processType: 'DYEING' | 'PRINTING'): Promise<ProcessJwo | null> {
  let jwo = await prisma.job_work_orders.findFirst({
    where: { id, processType },
    include: processJwoInclude,
  });
  if (!jwo) {
    jwo = await prisma.job_work_orders.findFirst({
      where: { purchaseOrderId: id, processType },
      include: processJwoInclude,
    });
  }
  return jwo;
}
