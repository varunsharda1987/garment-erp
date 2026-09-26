/**
 * GRN (Goods Receiving Notes) Service
 * Business logic for goods receiving operations with stock integration
 */

import {
  GRNStatus,
  PurchaseOrderStatus,
  Prisma,
  MovementType,
  Unit,
  ThreadPackagingType,
  ThreadPly,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  CreateGRNDTO,
  GRNFilters,
  PendingPOItem,
  ProcessingReceiveData,
  ProcessingQCData,
  GRNItemDetailDTO,
} from '../types/grn.types';
import { createChallan } from './challan.service';
import { purchaseOrderService } from './purchaseOrder.service';
import mrpService from './mrp.service';
import { updateWosrReceivedQuantity } from './work-order-service-requirement.service';
import { checkProcessingPOReadiness } from './po-status-manager.service';
import greigeStockService from './greige-stock.service';
import { systemSettingsService } from './system-settings.service';
import prisma from '../config/database'; // Use singleton to avoid connection pool leak
import { logInfo, logError, logWarn } from '../utils/logger';
import { generateAtomicGRNNumber } from '../utils/atomicCodeGenerator';
import {
  ensureMaterialRecord,
  ensureThreadPackMaterialRecord,
  syncStockLevelQuantity,
  threadLotMaterialId,
} from './helpers/material-sync.helper';
import { threadPackUnit } from './helpers/thread-pack.helper';
import threadStockService from './thread-stock.service';
import {
  setJwoStatus,
  setJwoStatusMany,
  isJwoDead,
  lockJobWorkOrder,
  JWO_ACTIVE_FILTER,
  JWO_AT_PROCESSOR_STATUSES,
  JWO_GRN_UOMS,
} from './helpers/jwo-status.helper';
import { closeOutwardChallanForJwo, resyncOutwardChallanAfterReversal } from './helpers/jwo-challan-lifecycle.helper';
import { updateGreigeLastPurchaseRate } from './helpers/greige-rate.helper';
import { determineFinishType } from './helpers/processing-fabric.helper';
import { jobWorkOrderService } from './job-work-order.service';
import {
  getOrCreateFinishedFabricV2,
  rebuildAutoFabricName,
  resolveFinishedFabricIdentity,
  resolveStockWidthInches,
  stampStyleFabricLink,
} from './helpers/fabric-identity.helper';
import {
  JWO_GRN_INCLUDE,
  isFabricLotReprocessingJwo,
  resolveOrMintJwoArrivingMaterial,
  stampJwoFinishedFabric,
} from './helpers/jwo-arriving-material.helper';
import { grnLineActualQty, grnLineRate, isKaajButtonJob, jobWorkCharges } from './helpers/grn-line-value.helper';
import { resolveReceiptDeliveryPoint } from './helpers/po-delivery-plan.helper';
import { foldActual, hasFold } from '../utils/fold-length';
import { isQtyZero, qtyExceeds } from '../utils/quantity';
import { COUNT_UNIT_FACTORS, normalizeUnit, unitShort } from '../utils/units';
import { stockRate, toStockQty } from './helpers/purchase-unit.helper';
import { routeToSpecializedStock, trimLotOf } from './helpers/stock-routing.helper';
import trimStockService from './trim-stock.service';
import { weaverOfJobSource } from './helpers/weaver-lineage.helper';
import { createDirectSupplyChallanInTx, type DirectSupplyLine } from './helpers/direct-supply-challan.helper';
import { challanDestination } from './helpers/lot-location.helper';
import { resolveNextProcessorUnit, sendReceiptOnToProcessor } from './helpers/held-stock-doors.helper';
import { formatStyleCodeWithRef } from '../utils/style-ref-format';
import { BusinessError, NotFoundError, ValidationError } from '../errors';
import {
  addCurrency,
  applyShrinkageLoss,
  divideCurrency,
  multiplyCurrency,
  roundToCent,
  subtractCurrency,
  toCurrency,
  toNumber,
} from '../utils/currency';
import {
  validateSourceMismatchOverride,
  executeSourceMismatchCleanup,
  findFabricForGreige,
  updateCostSheetSourcingStrategy,
} from './helpers/source-mismatch.helper';
// BUG-GR9 fix: Use centralized quality grade default instead of hardcoding 'A'
import { DEFAULT_QUALITY_GRADE } from '../constants/stock.constants';
import { applySearch } from '../utils/search-filter';
import { LABEL_LINE_MATERIAL_SELECT, PO_LINE_ORDER, toLabelLine } from './helpers/label-line.helper';

/**
 * Phase 1b: a greige / fabric receipt line must name its weaver or say "not known" — stock records
 * which weaver every lot came from. ON since the GRN form asks for it (2026-09-25); it was shipped OFF
 * one commit earlier so the backend could land before the form.
 */
const GRN_WEAVER_REQUIRED = true;

/**
 * Phase 2: book greige received into a processor's unit as HELD by that processor, with its Rule 45
 * challan, after the "Delivered straight to …" confirmation. ON since the GRN approval screen asks for it
 * (2026-09-25); shipped OFF one commit earlier so the backend could land first. Off = such receipts book
 * as a plain lot in the unit with no challan (the pre-Phase-2 behaviour).
 */
const DIRECT_DELIVERY_BOOKING = true;

/** Goods a supplier delivered straight to a processor: who holds them (Phase 2). */
interface DirectDelivery {
  processorId: string;
  processorName: string;
  supplierName: string;
  warehouseId: string;
}

/**
 * Categories whose receipt books its lots in its OWN branch (greige, fabric, lace, thread) or is PROCESSING.
 * Every other category — TRIMS (how MRP and the PO form file buttons and labels), GENERAL, BUTTON, LABEL … —
 * books stock_levels in the generic loop and each trim line's lot through routeToSpecializedStock. Approval
 * and reversal share this ONE predicate (2026-09-26: a TRIMS receipt used to book stock_levels only, so no
 * stock screen or MRP netting ever saw it, and its reversal never took stock_levels back).
 */
const OWN_LOT_BRANCH_CATEGORIES = new Set(['GREIGE', 'FABRIC', 'LACE', 'GREIGE_LACE', 'THREAD', 'PROCESSING']);
function receivesViaStockLevels(poCategory: string | null | undefined): boolean {
  return !OWN_LOT_BRANCH_CATEGORIES.has(poCategory ?? '');
}

/**
 * What ONE accepted GRN line puts into stock: the accepted actual quantity × the PO line's stock units per
 * unit (16 gross → 2,304 pieces), in the stock unit, at the rate per stock unit (₹18 / gross → ₹0.125 / pc).
 * The GRN line itself stays in the PO's unit — its value, GST and the PO's received counter.
 * Not `grnLineActualQty`: that one feeds GRN value and GST and must stay in the PO unit.
 */
function grnLineStock(item: {
  unit: string;
  acceptedQuantity: Prisma.Decimal | number | string;
  actualQuantity?: Prisma.Decimal | number | string | null;
  foldLengthCm?: Prisma.Decimal | number | string | null;
  purchase_order_items?: {
    unitPrice: Prisma.Decimal | number | string;
    stockUnitsPerUnit?: Prisma.Decimal | number | string | null;
    threadPackagingType?: ThreadPackagingType | null;
  } | null;
}): { qty: number; unit: Unit; rate: number } {
  const poQty = grnLineActualQty(item as Parameters<typeof grnLineActualQty>[0]).toNumber();
  const poRate = item.purchase_order_items ? Number(item.purchase_order_items.unitPrice) : 0;
  const factor =
    item.purchase_order_items?.stockUnitsPerUnit != null ? Number(item.purchase_order_items.stockUnitsPerUnit) : null;
  if (!factor || factor === 1) return { qty: poQty, unit: item.unit as Unit, rate: poRate };
  // A box of thread holds cones or tubes (its pack); a gross / dozen holds pieces
  const pack = item.purchase_order_items?.threadPackagingType;
  return {
    qty: toStockQty(poQty, factor),
    unit: pack ? threadPackUnit(pack) : (COUNT_UNIT_FACTORS[item.unit as Unit]?.of ?? (item.unit as Unit)),
    rate: stockRate(poRate, factor),
  };
}

type PackedLine = {
  purchase_order_items?: { threadPackagingType?: ThreadPackagingType | null; threadPly?: ThreadPly | null } | null;
};

/**
 * A thread line ordered in BOXES of a pack (2026-09-26 — the server writes the pack on the PO line): the pack,
 * else null. Such a line is booked on its PACK row in cones / tubes, whatever the PO's category — cones and
 * tubes are separate stock items, never added together.
 */
function threadPackOf(item: PackedLine): { packagingType: ThreadPackagingType; ply: ThreadPly | null } | null {
  const packagingType = item.purchase_order_items?.threadPackagingType;
  return packagingType ? { packagingType, ply: item.purchase_order_items?.threadPly ?? null } : null;
}

/**
 * Whether a line's stock_levels is booked in the generic loop — every trim line (receivesViaStockLevels) and
 * every packed thread line (on its pack row) — rather than by its category's own lot branch. Approval and
 * reversal share it.
 */
function lineBooksStockLevelsInLoop(poCategory: string | null | undefined, item: PackedLine): boolean {
  return !!threadPackOf(item) || receivesViaStockLevels(poCategory);
}

/** The materials row a line's stock is booked on: a packed thread line's PACK row, else the line's material. */
async function grnLineStockMaterialId(
  tx: Prisma.TransactionClient,
  item: PackedLine & { materialId: string }
): Promise<string> {
  const pack = threadPackOf(item);
  if (!pack) return item.materialId;
  const material = await tx.materials.findUnique({ where: { id: item.materialId }, select: { threadId: true } });
  if (!material?.threadId) return item.materialId;
  return ensureThreadPackMaterialRecord(material.threadId, pack.packagingType, pack.ply, tx);
}

class GRNService {
  /**
   * Generate unique GRN number - Format: GRN2511-0001
   * Uses atomic sequence generator to prevent duplicate numbers under concurrency.
   */
  private async generateGRNNumber(): Promise<string> {
    return generateAtomicGRNNumber();
  }

  /**
   * Create a new GRN
   */
  /**
   * A receipt booked at a processor's unit (warehouseType JOB_WORK) means the supplier delivered the goods
   * STRAIGHT to that job worker (direct-to-processor plan, Phase 2). Returns who holds them, or null for
   * our own stores. Refuses — before anything is written — what cannot be booked truthfully:
   *  - a unit linked to no processor;
   *  - a supplier who IS the processor (bought from and kept by the same party: Phase 4g);
   *  - a job-work return into a unit on this two-step path (processed goods going on to the next processor
   *    are received with the job's Receive from processor → "Delivered straight to another processor", 4d);
   *  - an unconfirmed delivery: implicit when the PO's Deliver To is this unit, else the approval must
   *    say so ("Delivered straight to …" → directDeliveryConfirmed).
   */
  private async resolveDirectDelivery(
    grn: { poId: string | null; jobWorkOrderId: string | null; supplierId: string | null; grnNumber: string },
    warehouse: { id: string; warehouseType: string; warehouseName: string; supplierId: string | null },
    confirmed: boolean
  ): Promise<DirectDelivery | null> {
    if (!DIRECT_DELIVERY_BOOKING || warehouse.warehouseType !== 'JOB_WORK') return null;
    if (!warehouse.supplierId) {
      throw new BusinessError(
        `${warehouse.warehouseName} is not linked to a processor, so goods cannot be booked there. Pick our store, or link the unit to its processor first.`,
        { reason: 'DIRECT_DELIVERY_UNIT_UNLINKED', warehouseId: warehouse.id }
      );
    }
    if (!grn.poId) {
      throw new BusinessError(
        `Processed goods going straight on to ${warehouse.warehouseName} are received from the job itself: ` +
          `Receive from processor → tick "Delivered straight to another processor". Here, approve into our store.`,
        { reason: 'DIRECT_DELIVERY_JOB_RETURN', warehouseId: warehouse.id }
      );
    }
    const [po, processor, supplier] = await Promise.all([
      prisma.purchase_orders.findUnique({
        where: { id: grn.poId },
        select: { deliveryLocationId: true, deliveryPoints: { select: { warehouseId: true } } },
      }),
      prisma.suppliers.findUnique({ where: { id: warehouse.supplierId }, select: { id: true, name: true } }),
      grn.supplierId ? prisma.suppliers.findUnique({ where: { id: grn.supplierId }, select: { name: true } }) : null,
    ]);
    if (!processor) {
      throw new BusinessError(`The processor behind ${warehouse.warehouseName} no longer exists.`, {
        reason: 'DIRECT_DELIVERY_UNIT_UNLINKED',
      });
    }
    if (grn.supplierId && grn.supplierId === processor.id) {
      throw new BusinessError(
        `${processor.name} is both the supplier and the processor on ${grn.grnNumber}. Booking goods a processor sold us and keeps is not supported yet — receive them into our store.`,
        { reason: 'DIRECT_DELIVERY_SELF_SUPPLY' }
      );
    }
    // Implicit when the PO's plan delivers here: its one place, or one of its split places (Phase 3)
    const implicit =
      po?.deliveryLocationId === warehouse.id || !!po?.deliveryPoints.some((p) => p.warehouseId === warehouse.id);
    if (!implicit && !confirmed) {
      throw new BusinessError(
        `${grn.grnNumber} books the goods at ${warehouse.warehouseName}. Confirm the supplier delivered them straight to ${processor.name} (tick "Delivered straight to ${processor.name}"), or approve into our store.`,
        { reason: 'DIRECT_DELIVERY_UNCONFIRMED', processorName: processor.name, warehouseName: warehouse.warehouseName }
      );
    }
    return {
      processorId: processor.id,
      processorName: processor.name,
      supplierName: supplier?.name ?? 'the supplier',
      warehouseId: warehouse.id,
    };
  }

  /**
   * The weaver of every line of a new receipt (Phase 1b). Greige and ready fabric are woven cloth, and
   * the weaver we buy from keeps changing, so the LOT carries it — never the greige master. A line
   * names its weaver, else inherits the PO line's; a greige / fabric line with neither must say
   * "Weaver not known" out loud, or the receipt is refused. Other categories carry none.
   */
  private async resolveGrnLineWeavers(
    po: {
      poCategory: string | null;
      purchase_order_items: Array<{ id: string; weaverId: string | null; materials: { code: string } | null }>;
    },
    items: CreateGRNDTO['items']
  ): Promise<Map<string, { weaverId: string | null; notKnown: boolean }>> {
    const woven = po.poCategory === 'GREIGE' || po.poCategory === 'FABRIC';
    const out = new Map<string, { weaverId: string | null; notKnown: boolean }>();
    for (const item of items) {
      const poItem = po.purchase_order_items.find((pi) => pi.id === item.poItemId);
      const notKnown = item.weaverNotKnown === true && !item.weaverId;
      const weaverId = item.weaverId ?? (notKnown ? null : (poItem?.weaverId ?? null));
      if (GRN_WEAVER_REQUIRED && woven && !weaverId && !notKnown && !isQtyZero(item.receivedQuantity)) {
        throw new BusinessError(
          `Name the weaver of ${poItem?.materials?.code ?? 'this line'} — or tick "Weaver not known". ` +
            `Stock records which weaver every lot came from.`,
          { reason: 'GRN_WEAVER_REQUIRED', poItemId: item.poItemId }
        );
      }
      out.set(item.poItemId, { weaverId: woven ? weaverId : null, notKnown: woven ? notKnown : false });
    }
    const ids = [...new Set([...out.values()].map((v) => v.weaverId).filter((id): id is string => !!id))];
    if (ids.length > 0) {
      const found = await prisma.weavers.count({ where: { id: { in: ids } } });
      if (found !== ids.length) throw new BusinessError('A weaver on this receipt no longer exists — pick it again.');
    }
    return out;
  }

  async createGRN(data: CreateGRNDTO, userId: string) {
    // Validate PO exists and is in receivable status
    const po = await prisma.purchase_orders.findUnique({
      where: { id: data.poId },
      include: {
        purchase_order_items: {
          include: { materials: { select: { id: true, code: true, name: true } } },
        },
        suppliers: { select: { id: true, name: true, code: true } },
      },
    });

    if (!po) {
      throw new Error('Purchase order not found');
    }

    const receivableStatuses: PurchaseOrderStatus[] = [
      PurchaseOrderStatus.SENT,
      PurchaseOrderStatus.ACKNOWLEDGED,
      PurchaseOrderStatus.PARTIALLY_RECEIVED,
    ];

    if (!receivableStatuses.includes(po.status)) {
      throw new Error(`Cannot receive goods for PO in ${po.status} status`);
    }

    // Fetch over-receipt tolerance from system settings
    const tolerancePercent = await systemSettingsService.getNumberDefault('GRN_OVER_RECEIPT_TOLERANCE_PERCENT');

    // Weaver per line (Phase 1b, 2026-09-25): the weaver whose cloth ACTUALLY arrived — named on the
    // line, else the PO line's weaver. A greige / fabric line must name one or say "not known".
    const weaverByPoItem = await this.resolveGrnLineWeavers(po, data.items);

    // Validate items
    for (const item of data.items) {
      const poItem = po.purchase_order_items.find((pi) => pi.id === item.poItemId);
      if (!poItem) {
        throw new Error(`PO item ${item.poItemId} not found`);
      }

      // Check if receiving more than allowed (ordered + tolerance). PO quantities are ACTUAL metres, so a
      // receipt counted at fold L is compared after conversion.
      const orderedQty = Number(poItem.orderedQuantity);
      const alreadyReceived = Number(poItem.receivedQuantity);
      const maxAllowed = orderedQty * (1 + tolerancePercent / 100) - alreadyReceived;
      const actualReceived = foldActual(item.receivedQuantity, item.foldLengthCm).toNumber();
      // Quantity rule (utils/quantity): over the cap by rounding dust is not over — at a 0% tolerance
      // a 2-decimal receipt against a 3-decimal line must not trip on 0.002.
      if (qtyExceeds(actualReceived, maxAllowed)) {
        const materialCode = poItem.materials?.code || item.materialId;
        const counted = hasFold(item.foldLengthCm)
          ? `${item.receivedQuantity} counted @ L=${item.foldLengthCm} (= ${actualReceived})`
          : `${item.receivedQuantity}`;
        throw new Error(
          `Cannot receive ${counted} units of ${materialCode}. ` +
            `Maximum allowed (with ${tolerancePercent}% tolerance) is ${maxAllowed.toFixed(3)}. ` +
            `Ordered: ${orderedQty}, Already received: ${alreadyReceived}.`
        );
      }

      // Validate accepted + rejected = received (epsilon compare — bug-hunt procurement-8:
      // strict float equality rejected legitimate decimal receipts like 10.1 + 0.2 vs 10.3)
      if (Math.abs(item.acceptedQuantity + item.rejectedQuantity - item.receivedQuantity) > 0.001) {
        throw new Error(
          `Accepted (${item.acceptedQuantity}) + Rejected (${item.rejectedQuantity}) must equal Received (${item.receivedQuantity})`
        );
      }

      // Validate material matches PO item material (prevent cross-linking)
      if (item.materialId && poItem.materialId && item.materialId !== poItem.materialId) {
        throw new Error(
          `GRN material (${item.materialId}) does not match PO item material (${poItem.materialId}). ` +
            `Cannot receive a different material than what was ordered.`
        );
      }
    }

    // Split delivery (2026-09-26): which planned place this delivery is against (required on a split
    // PO, the warehouse defaulting from it); over-plan or a different warehouse only warns.
    const delivery = await resolveReceiptDeliveryPoint(prisma, data.poId, {
      poDeliveryPointId: data.poDeliveryPointId,
      warehouseId: data.warehouseId,
      items: data.items.map((i) => ({
        poItemId: i.poItemId,
        receivedQuantity: Number(i.receivedQuantity),
        foldLengthCm: i.foldLengthCm != null ? Number(i.foldLengthCm) : null,
      })),
    });

    const grnNumber = await this.generateGRNNumber();

    // PROCESSING PO: validate the linked job work order BEFORE booking anything (bug-hunt
    // procurement-5: these user-facing rejections used to fire AFTER the GRN + PO received-quantity
    // increments had already committed — the receipt existed even though the user saw an error).
    let processingJob: Prisma.job_work_ordersGetPayload<{
      include: { style: { select: { id: true; styleCode: true; buyerStyleRef: true } } };
    }> | null = null;
    // Phase 4a: resolve the JWO for ANY PROCESSING PO (not just when processingData is
    // supplied) so the GRN can be stamped with jobWorkOrderId — 4b groundwork for
    // PO-less receiving. The receive-state validations stay gated on processingData
    // exactly as before.
    if (po.poCategory === 'PROCESSING') {
      processingJob = await prisma.job_work_orders.findFirst({
        where: { purchaseOrderId: po.id },
        include: { style: { select: { id: true, styleCode: true, buyerStyleRef: true } } },
      });
      // Landmine №1 fix: a cancelled job's material was already credited back to stock —
      // receiving its physical return through a GRN would double-count it. Checked OUTSIDE
      // the processingData gate: a cancelled JWO must not get a GRN stamped with its id at all.
      if (processingJob && isJwoDead(processingJob.jwoStatus)) {
        throw new Error(
          `${processingJob.jobWorkNumber} is ${processingJob.jwoStatus?.toLowerCase()} — its stock was already ` +
            `credited back. If the mill physically returned material, contact the office to re-open the job first.`
        );
      }
      if (data.processingData) {
        if (!processingJob) {
          logError('No job work order linked to PROCESSING PO', { poId: po.id });
        } else if (processingJob.receivedDate) {
          throw new Error('This processing PO has already been received via the Printing/Dyeing module');
        } else if (!JWO_AT_PROCESSOR_STATUSES.includes(processingJob.jwoStatus!)) {
          throw new Error(`Cannot receive. Job status is ${processingJob.jwoStatus}, expected at-processor`);
        }
      }
    }

    // Create GRN with items in transaction
    const grn = await prisma.$transaction(
      async (tx) => {
        // Create GRN
        const newGRN = await tx.goods_receiving_notes.create({
          data: {
            id: randomUUID(),
            grnNumber,
            poId: data.poId,
            jobWorkOrderId: processingJob?.id ?? null, // Phase 4a: GRN→JWO at creation
            supplierId: po.supplierId,
            warehouseId: delivery.warehouseId, // Target warehouse for received goods (the ACTUAL place)
            poDeliveryPointId: delivery.poDeliveryPointId, // the PLANNED place on a split PO
            receivingDate: data.receivingDate ? new Date(data.receivingDate) : new Date(),
            invoiceNumber: data.invoiceNumber || null,
            invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : null,
            status: GRNStatus.PENDING_QC,
            remarks: data.remarks || null,
            receivedById: userId,
            grn_items: {
              create: data.items.map((item) => {
                const poItem = po.purchase_order_items.find((pi) => pi.id === item.poItemId);
                const orderedQty = Number(poItem?.orderedQuantity || 0);
                const alreadyReceived = Number(poItem?.receivedQuantity || 0);
                const pendingQty = orderedQty - alreadyReceived;
                const actualReceived = foldActual(item.receivedQuantity, item.foldLengthCm).toNumber();
                const isOverReceipt = actualReceived > pendingQty;
                const overReceiptQty = isOverReceipt ? toNumber(subtractCurrency(actualReceived, pendingQty)) : null;

                // Compute counts from details if provided
                let baleCount: number | null = null;
                let thanCount: number | null = null;
                let rollCount: number | null = null;
                let totalMeters: number | null = null;

                if (item.details && item.details.length > 0) {
                  const thans = item.details.filter((d) => d.detailType === 'THAN');
                  const rolls = item.details.filter((d) => d.detailType === 'ROLL');
                  thanCount = thans.length || null;
                  rollCount = rolls.length || null;
                  totalMeters = item.details.reduce((sum, d) => sum + d.meters, 0);
                  // Count distinct bale numbers for bale count
                  const baleNumbers = new Set(thans.filter((d) => d.baleNumber).map((d) => d.baleNumber));
                  baleCount = baleNumbers.size > 0 ? baleNumbers.size : null;
                }

                return {
                  id: randomUUID(),
                  poItemId: item.poItemId,
                  materialId: item.materialId,
                  orderedQuantity: poItem?.orderedQuantity || 0,
                  receivedQuantity: item.receivedQuantity,
                  acceptedQuantity: item.acceptedQuantity,
                  rejectedQuantity: item.rejectedQuantity,
                  // Counted figures stay as the supplier's paper has them; this is what enters stock.
                  actualQuantity: hasFold(item.foldLengthCm)
                    ? foldActual(item.acceptedQuantity, item.foldLengthCm).toNumber()
                    : null,
                  unit: item.unit,
                  remarks: item.remarks || null,
                  componentName: (poItem as any)?.componentName || null,
                  colorName: (poItem as any)?.colorName || null,
                  // Measurement fields
                  foldLengthCm: item.foldLengthCm || null,
                  receivedWidthInches: item.receivedWidthInches || null,
                  entryMode: item.entryMode || null,
                  baleCount,
                  thanCount,
                  rollCount,
                  totalMeters: totalMeters ?? (item.receivedQuantity || null),
                  isOverReceipt,
                  overReceiptQty,
                  // Source mismatch override fields
                  receivedAsReadyFabric: item.receivedAsReadyFabric || false,
                  actualRatePerUnit: item.actualRatePerUnit || null,
                  updateFutureSourcing: item.updateFutureSourcing || false,
                  weaverId: weaverByPoItem.get(item.poItemId)?.weaverId ?? null,
                  weaverNotKnown: weaverByPoItem.get(item.poItemId)?.notKnown ?? false,
                };
              }),
            },
          },
          include: this.getFullInclude(),
        });

        // Create grn_item_details for items with breakdown data
        for (const item of data.items) {
          if (item.details && item.details.length > 0) {
            // Find the created grn_item by poItemId match
            const createdItem = (newGRN as any).grn_items?.find((gi: any) => gi.poItemId === item.poItemId);
            if (createdItem) {
              await tx.grn_item_details.createMany({
                data: item.details.map((detail: GRNItemDetailDTO) => ({
                  id: randomUUID(),
                  grnItemId: createdItem.id,
                  detailType: detail.detailType,
                  baleNumber: detail.baleNumber || null,
                  sequenceNo: detail.sequenceNo,
                  meters: detail.meters,
                  remarks: detail.remarks || null,
                  baleNo: detail.baleNo || null,
                  thanNo: detail.thanNo || null,
                })),
              });
            }
          }
        }

        // Update PO item received quantities (ACTUAL — the PO is in actual metres)
        for (const item of data.items) {
          const poItem = po.purchase_order_items.find((pi) => pi.id === item.poItemId);
          if (poItem) {
            await tx.purchase_order_items.update({
              where: { id: item.poItemId },
              data: {
                receivedQuantity: {
                  increment: foldActual(item.receivedQuantity, item.foldLengthCm).toNumber(),
                },
              },
            });
          }
        }

        // PROCESSING PO: the processing writes (fabric width, inward challan, job receive) are part of
        // THIS transaction (bug-hunt procurement-5: they used to run post-commit on the global client as
        // three separate writes, with the inward-challan failure silently swallowed — a failed challan
        // left the job RECEIVED with no inward document).
        if (processingJob && data.processingData) {
          const { qtyReceivedMeters, receivedWidthInches, thanCount, foldLengthCm, receivedChallan } =
            data.processingData;

          // qtyReceivedMeters is the processor's COUNTED figure; at fold L the actual is counted × L/100.
          const actualMeters = foldActual(qtyReceivedMeters || 0, foldLengthCm).toNumber();
          const calculatedActualMeters: number | null = foldLengthCm ? actualMeters : null;

          // Calculate shrinkage and width variance
          const sentMeters = Number(processingJob.qtySentMeters);
          const actualShrinkage = sentMeters > 0 ? ((sentMeters - actualMeters) / sentMeters) * 100 : 0;
          const widthVariance = receivedWidthInches - Number(processingJob.sentWidthInches);

          // Update fabric_master actual width if finished fabric exists
          if (processingJob.finishedFabricId && receivedWidthInches) {
            const widthDeduction = await systemSettingsService.getCutableWidthDeductionInches();
            await tx.fabric_master.update({
              where: { id: processingJob.finishedFabricId },
              data: {
                actualWidth: receivedWidthInches,
                cutableWidth:
                  receivedWidthInches > widthDeduction ? receivedWidthInches - widthDeduction : receivedWidthInches,
              },
            });
          }

          // Create INWARD challan in the same tx — a failure now ABORTS the whole receive instead of
          // being swallowed.
          const challan = await createChallan(
            {
              challanType: 'INWARD',
              challanDate: data.receivingDate ? new Date(data.receivingDate as string) : new Date(),
              fromType: 'VENDOR',
              fromId: po.supplierId,
              fromName: po.suppliers?.name || 'Mill',
              // The store the goods came back into — never the made-up "Main Warehouse"
              ...(await challanDestination(tx, [data.warehouseId])),
              purchaseOrderId: po.id,
              jobWorkOrderId: processingJob.id,
              issuedById: userId,
              unit: Unit.METER,
              remarks: receivedChallan ? `Vendor challan ref: ${receivedChallan}` : undefined,
              // Goods in hand — this transaction books the lot. See the PO-less branch for why
              // filing arrival documents as DRAFT broke the Control Center's vendor signals.
              status: 'RECEIVED',
              receivedDate: data.receivingDate ? new Date(data.receivingDate as string) : new Date(),
              receivedById: userId,
              items: [
                {
                  itemType: 'FABRIC',
                  fabricId: processingJob.finishedFabricId || processingJob.fabricId || undefined,
                  description: `Processed fabric received via GRN - ${formatStyleCodeWithRef(processingJob.style?.styleCode || '', processingJob.style?.buyerStyleRef)}`,
                  quantity: actualMeters,
                  unit: Unit.METER,
                },
              ],
            },
            tx
          );

          // Guarded receive (receivedDate still null) — a concurrent receive that won the race makes
          // count 0 and aborts this one instead of double-receiving.
          const jobUpdate = await setJwoStatusMany(
            tx,
            // Re-check state too (not just receivedDate): a job cancelled between the pre-tx
            // validation and this write must not be force-received. jwoStatus check excludes
            // CANCELLED/CLOSED (they're not in JWO_AT_PROCESSOR_STATUSES).
            {
              id: processingJob.id,
              receivedDate: null,
              jwoStatus: { in: JWO_AT_PROCESSOR_STATUSES },
            },
            'RECEIVED',
            {
              qtyReceivedMeters: actualMeters,
              receivedWidthInches: receivedWidthInches,
              receivedDate: data.receivingDate ? new Date(data.receivingDate as string) : new Date(),
              receivedChallan: receivedChallan || null,
              invoiceNumber: data.invoiceNumber || null,
              actualShrinkage: actualShrinkage,
              widthVariance: widthVariance,
              thanCount: thanCount || null,
              foldLengthCm: foldLengthCm || null,
              calculatedActualMeters: calculatedActualMeters,
              inwardChallanId: challan.id,
              grnId: newGRN.id,
            }
          );
          if (jobUpdate.count === 0) {
            throw new Error('This processing PO has already been received via the Printing/Dyeing module');
          }

          // Close the OUTWARD challan the greige went out on. This PO-backed path is a whole
          // receive (no parts), so isFinal is always true here. After setJwoStatusMany, so the
          // "every job on this challan settled?" check sees RECEIVED.
          try {
            const outwardStatus = await closeOutwardChallanForJwo(tx, processingJob.id, {
              isFinal: true,
              receivedById: userId,
              receivedAt: data.receivingDate ? new Date(data.receivingDate as string) : new Date(),
            });
            if (outwardStatus) {
              logInfo('[GRN] Outward challan advanced on PO-backed processing receipt', {
                jobWorkOrderId: processingJob.id,
                status: outwardStatus,
              });
            }
          } catch (challanError) {
            logWarn('[GRN] Could not advance outward challan on PO-backed processing receipt', {
              jobWorkOrderId: processingJob.id,
              error: challanError instanceof Error ? challanError.message : challanError,
            });
          }

          // Loss split (expected-output basis). GRN receives previously skipped this
          // entirely, so loss fields stayed null and the close-time debit gate never
          // fired for GRN-received orders. Best-effort like the module receive paths.
          try {
            await jobWorkOrderService.applyLossSplit(processingJob.id, actualMeters, tx);
          } catch (lossSplitError) {
            logWarn('[GRN] Loss split failed for processing receive', {
              jobId: processingJob.id,
              error: lossSplitError instanceof Error ? lossSplitError.message : lossSplitError,
            });
          }

          logInfo(`Processing PO received via GRN ${newGRN.grnNumber}`, {
            poId: po.id,
            jobId: processingJob.id,
            actualMeters,
            shrinkage: actualShrinkage,
          });
        }

        return newGRN;
      },
      { timeout: 15000, maxWait: 5000 }
    ); // headroom over the 5s default: PROCESSING receives create a challan in-tx and lock-waits count against the clock

    // Update PO status based on receiving
    await purchaseOrderService.updateReceivingStatus(data.poId);

    // Soft split-delivery warnings ride on the response; they never block a receipt
    return Object.assign(grn, { deliveryWarnings: delivery.warnings });
  }

  /**
   * Get all GRNs with filters and pagination
   */
  async getAllGRNs(filters?: GRNFilters) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.goods_receiving_notesWhereInput = {};

    if (filters?.poId) {
      where.poId = filters.poId;
    }

    if (filters?.supplierId) {
      where.supplierId = filters.supplierId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    // The list shows a PO / JWO column and a Warehouse column; only the PO half was searchable, so
    // a receipt booked against a job work order could not be found by its JWO number.
    applySearch(where as Record<string, unknown>, filters?.search, [
      'grnNumber',
      'invoiceNumber',
      'purchase_orders.poNumber',
      'jobWorkOrder.jobWorkNumber',
      'suppliers.name',
      'suppliers.code',
      'warehouses.warehouseName',
      // A GRN has no style of its own, but the document it was booked against does — so a receipt
      // is findable by the buyer's style code like everything else.
      'purchase_orders.style.styleCode',
      'purchase_orders.style.buyerStyleRef',
      'purchase_orders.style.styleName',
      'jobWorkOrder.style.styleCode',
      'jobWorkOrder.style.buyerStyleRef',
      'jobWorkOrder.style.styleName',
      // The list names what came in, so what came in must find the receipt.
      'grn_items[].materials.name',
      'grn_items[].materials.code',
      'remarks',
    ]);

    if (filters?.startDate || filters?.endDate) {
      where.receivingDate = {};
      if (filters?.startDate) {
        where.receivingDate.gte = new Date(filters.startDate);
      }
      if (filters?.endDate) {
        where.receivingDate.lte = new Date(filters.endDate);
      }
    }

    const sortBy = filters?.sortBy || 'createdAt';
    const sortOrder = filters?.sortOrder || 'desc';

    const [grns, total] = await Promise.all([
      prisma.goods_receiving_notes.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          purchase_orders: {
            select: {
              id: true,
              poNumber: true,
              poDate: true,
              expectedDeliveryDate: true,
              status: true,
            },
          },
          suppliers: {
            select: {
              id: true,
              code: true,
              name: true,
              contactPerson: true,
            },
          },
          // Phase 4b: PO-less GRNs identify by their Job Work Order
          jobWorkOrder: {
            select: {
              id: true,
              jobWorkNumber: true,
              processType: true,
              sentDate: true,
              uom: true,
              agreedRatePerMeter: true,
              buttonholeCount: true,
              buttonCount: true,
              buttonholeRatePerUnit: true,
              buttonRatePerUnit: true,
              processTypeMaster: { select: { name: true, code: true } },
            },
          },
          warehouses: {
            select: { id: true, warehouseCode: true, warehouseName: true },
          },
          grn_items: {
            include: {
              materials: { select: { code: true, name: true, materialType: true } },
              purchase_order_items: { select: { unitPrice: true } },
            },
          },
        },
      }),
      prisma.goods_receiving_notes.count({ where }),
    ]);

    return {
      data: grns.map((grn) => {
        // A PO-backed receipt is priced by its PO line; only a PO-less job-work return falls to
        // the processor's charge (grn-line-value.helper).
        const jwo = !grn.poId ? grn.jobWorkOrder : null;
        // The PO line is read for its price only. Left on the item, the serializer would rename
        // purchaseOrderItems → `items` and nest an `items` key inside every item.
        const items = grn.grn_items.map(({ purchase_order_items, ...item }) => {
          const rate = grnLineRate({ ...item, purchase_order_items }, jwo);
          const actualQty = grnLineActualQty(item);
          const value = rate != null ? roundToCent(multiplyCurrency(actualQty, rate)) : null;
          return { ...item, rate, value, actualQuantity: actualQty };
        });

        // null = unpriced: a line with no rate leaves the total unknown rather than silently short.
        let totalValue: ReturnType<typeof toCurrency> | null;
        if (jwo && isKaajButtonJob(jwo)) {
          // Kaaj-button has no per-unit rate — the processor bills buttonholes + buttons.
          const accepted = addCurrency(...grn.grn_items.map((i) => i.acceptedQuantity));
          totalValue = roundToCent(jobWorkCharges(jwo, accepted).amount);
        } else {
          totalValue = items.every((i) => i.value != null) ? addCurrency(...items.map((i) => i.value)) : null;
        }

        return {
          ...grn,
          grn_items: items.map((i) => ({
            ...i,
            actualQuantity: i.actualQuantity.toNumber(),
            rate: i.rate?.toNumber() ?? null,
            value: i.value?.toNumber() ?? null,
          })),
          itemCount: items.length,
          totalValue: totalValue?.toNumber() ?? null,
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single GRN by ID with all relations
   */
  /**
   * Label a received line's bales and thans with the numbers printed on them — the supplier's
   * bale number and each than's tag. Until 2026-09-24 GRN could only number bales 1, 2, 3 and
   * thans by position, so what the godown holds could not be matched to what the system lists.
   * Labels only: quantities, grouping (baleNumber) and order (sequenceNo) never change. The
   * greige lot's than rows (same GRN line → lot, same bale + position) are relabelled too.
   */
  async updateDetailLabels(
    grnItemId: string,
    details: Array<{ id: string; baleNo?: string | null; thanNo?: string | null }>
  ) {
    const rows = await prisma.grn_item_details.findMany({ where: { grnItemId } });
    if (rows.length === 0) throw new NotFoundError('GRN line with than/bale details', grnItemId);
    const byId = new Map(rows.map((r) => [r.id, r]));
    const unknown = details.filter((d) => !byId.has(d.id));
    if (unknown.length > 0) {
      throw new ValidationError(`${unknown.length} detail row(s) do not belong to this GRN line`);
    }
    const lots = await prisma.greige_stock.findMany({ where: { grnItemId }, select: { id: true } });
    const clean = (v: string | null | undefined) => (v == null ? undefined : v.trim() || null);

    await prisma.$transaction(async (tx) => {
      for (const d of details) {
        const row = byId.get(d.id)!;
        const data = { baleNo: clean(d.baleNo), thanNo: clean(d.thanNo) };
        await tx.grn_item_details.update({ where: { id: d.id }, data });
        if (lots.length > 0) {
          await tx.greige_stock_details.updateMany({
            where: {
              greigeStockId: { in: lots.map((l) => l.id) },
              baleNumber: row.baleNumber,
              sequenceNo: row.sequenceNo,
            },
            data,
          });
        }
      }
    });
    return prisma.grn_item_details.findMany({
      where: { grnItemId },
      orderBy: [{ baleNumber: 'asc' }, { sequenceNo: 'asc' }],
    });
  }

  async getGRNById(id: string) {
    const grn = await prisma.goods_receiving_notes.findUnique({
      where: { id },
      include: this.getFullInclude(),
    });

    if (!grn) {
      throw new Error('GRN not found');
    }

    // Same rate/value rule as the list (grn-line-value.helper): ACTUAL accepted metres × rate.
    const jwo =
      !grn.poId && grn.jobWorkOrderId
        ? await prisma.job_work_orders.findUnique({
            where: { id: grn.jobWorkOrderId },
            select: {
              processType: true,
              agreedRatePerMeter: true,
              processTypeMaster: { select: { code: true } },
            },
          })
        : null;
    return {
      ...grn,
      grn_items: grn.grn_items.map((item) => {
        const actual = grnLineActualQty(item);
        const rate = grnLineRate(item, jwo);
        return {
          ...item,
          actualQuantity: actual.toNumber(),
          rate: rate?.toNumber() ?? null,
          value: rate != null ? roundToCent(multiplyCurrency(actual, rate)).toNumber() : null,
        };
      }),
    };
  }

  /**
   * Get all GRNs for a specific PO
   */
  async getGRNsByPO(poId: string) {
    const grns = await prisma.goods_receiving_notes.findMany({
      where: { poId },
      include: {
        grn_items: {
          include: {
            materials: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
        users_goods_receiving_notes_receivedByIdTousers: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { receivingDate: 'desc' },
    });

    return grns;
  }

  /**
   * Get pending items for a PO (for GRN form)
   */
  async getPendingItemsForPO(poId: string): Promise<PendingPOItem[]> {
    const po = await prisma.purchase_orders.findUnique({
      where: { id: poId },
      include: {
        purchase_order_items: {
          orderBy: PO_LINE_ORDER,
          include: {
            materials: {
              select: {
                id: true,
                code: true,
                name: true,
                // Which label and size a line is — the GRN form groups a label's sizes
                ...LABEL_LINE_MATERIAL_SELECT,
              },
            },
            weaver: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!po) {
      throw new Error('Purchase order not found');
    }

    // Greige and ready fabric are woven: the receipt must say which weaver's cloth came (Phase 1b).
    const needsWeaver = po.poCategory === 'GREIGE' || po.poCategory === 'FABRIC';
    return po.purchase_order_items
      .filter((item) => item.materialId !== null)
      .map((item) => ({
        poItemId: item.id,
        materialId: item.materialId as string,
        materialCode: item.materials?.code || '',
        materialName: item.materials?.name || '',
        unit: item.unit,
        orderedQuantity: Number(item.orderedQuantity),
        totalReceivedQuantity: Number(item.receivedQuantity),
        pendingQuantity: Number(item.orderedQuantity) - Number(item.receivedQuantity),
        unitPrice: Number(item.unitPrice),
        foldLengthCm: item.foldLengthCm != null ? Number(item.foldLengthCm) : null,
        weaverId: item.weaverId,
        weaverName: item.weaver?.name ?? null,
        needsWeaver,
        componentName: item.componentName ?? null,
        ...(({ label, size }) => ({
          labelId: label?.id ?? null,
          labelCode: label?.code ?? null,
          labelName: label?.name ?? null,
          size,
        }))(toLabelLine(item.materials)),
      }));
  }

  /**
   * Approve a GRN and create stock movements
   */
  async approveGRN(
    id: string,
    userId: string,
    warehouseId?: string,
    processingQC?: ProcessingQCData,
    opts?: { directDeliveryConfirmed?: boolean }
  ) {
    const grn = await prisma.goods_receiving_notes.findUnique({
      where: { id },
      include: {
        grn_items: {
          include: {
            purchase_order_items: true,
            grn_item_details: true,
          },
        },
      },
    });

    if (!grn) {
      throw new Error('GRN not found');
    }

    if (grn.status !== GRNStatus.PENDING_QC) {
      throw new Error(`Cannot approve GRN in ${grn.status} status`);
    }

    // Determine target warehouse
    const targetWarehouseId = warehouseId || grn.warehouseId;
    if (!targetWarehouseId) {
      throw new Error('Warehouse ID is required for GRN approval. Please specify a target warehouse.');
    }

    // Verify warehouse exists and is active
    const warehouse = await prisma.warehouses.findUnique({
      where: { id: targetWarehouseId },
    });
    if (!warehouse || !warehouse.isActive) {
      throw new Error('Invalid or inactive warehouse');
    }

    // Goods booked at a processor's unit were delivered STRAIGHT to that job worker (Phase 2): decide
    // it — and refuse what we cannot book truthfully — before anything is written.
    const direct = await this.resolveDirectDelivery(grn, warehouse, opts?.directDeliveryConfirmed === true);

    // Collector for non-critical, best-effort work that must run AFTER the transaction commits — its
    // failure must not roll back a valid receipt, and it must never open a nested tx inside ours.
    (grn as any).__postCommit = {
      updateProcessingPOStatus: false,
      sourcingUpdates: [] as Array<{ poId: string; fabricId: string; actualRate: number }>,
    };

    // Update GRN status in transaction with stock movements
    const updatedGRN = await prisma.$transaction(
      async (tx) => {
        // GUARDED status flip (PENDING_QC only): the pre-tx status check races with a concurrent
        // approve/reject — without this guard both could commit, double-netting the PO counters
        // (potentially negative) and double-writing stock (review catch).
        const flip = await tx.goods_receiving_notes.updateMany({
          where: { id, status: GRNStatus.PENDING_QC },
          data: {
            status: GRNStatus.ACCEPTED,
            approvedById: userId,
            warehouseId: targetWarehouseId,
          },
        });
        if (flip.count === 0) {
          throw new Error('GRN is no longer PENDING_QC — it was already approved or rejected');
        }
        const approved = await tx.goods_receiving_notes.findUniqueOrThrow({
          where: { id },
          include: this.getFullInclude(),
        });

        // Check PO category for processing-specific handling (Phase 4b: poId is nullable)
        const po = grn.poId
          ? await tx.purchase_orders.findUnique({
              where: { id: grn.poId },
              select: { id: true, poCategory: true, supplierId: true },
            })
          : null;

        // Phase 4b: PO-less receipt — the GRN keys on jobWorkOrderId alone
        if (!po && grn.jobWorkOrderId) {
          await this.approvePolessJwoGrnInTx(tx, grn, processingQC, targetWarehouseId, userId, id);
          return approved;
        }

        if (po?.poCategory === 'PROCESSING') {
          // For PROCESSING POs: create fabric_stock instead of stock_movements/stock_levels
          const jobWorkOrder = await tx.job_work_orders.findFirst({
            where: { purchaseOrderId: po.id },
            include: {
              greigeStockLot: { select: { id: true, purchaseCost: true } },
              fabricStockLot: { select: { id: true, purchaseCost: true } },
              style: { select: { id: true, styleCode: true } },
            },
          });

          if (jobWorkOrder && jobWorkOrder.finishedFabricId) {
            // Apply QC data if provided
            if (processingQC) {
              await setJwoStatus(tx, jobWorkOrder.id, 'QUALITY_CHECKED', {
                qualityGrade: processingQC.qualityGrade,
                colorMatchStatus: processingQC.colorMatchStatus || null,
                defectMeters: processingQC.defectMeters || null,
                defectType: processingQC.defectType || null,
                actualRate: processingQC.actualRate || null,
                remarks: processingQC.remarks
                  ? `${jobWorkOrder.remarks || ''}\n[QC via GRN] ${processingQC.remarks}`.trim()
                  : jobWorkOrder.remarks,
              });
            }

            // Create fabric_stock
            const qtyReceived = Number(jobWorkOrder.qtyReceivedMeters || 0);
            const defectMetersNum = Number(processingQC?.defectMeters || jobWorkOrder.defectMeters || 0);
            const goodQty = qtyReceived - defectMetersNum;
            const receivedWidth = Number(jobWorkOrder.receivedWidthInches || jobWorkOrder.sentWidthInches);
            const cutableWidth = receivedWidth > 2 ? receivedWidth - 2 : receivedWidth;
            const processingRate = Number(
              processingQC?.actualRate || jobWorkOrder.actualRate || jobWorkOrder.agreedRatePerMeter
            );
            const sourceCost = jobWorkOrder.greigeStockLot?.purchaseCost
              ? Number(jobWorkOrder.greigeStockLot.purchaseCost)
              : jobWorkOrder.fabricStockLot?.purchaseCost
                ? Number(jobWorkOrder.fabricStockLot.purchaseCost)
                : 0;
            // Decimal math for stock valuation (bug-hunt procurement-22)
            const totalCostPerMeter = roundToCent(addCurrency(processingRate, sourceCost)).toNumber();
            const qualityGrade = processingQC?.qualityGrade || jobWorkOrder.qualityGrade || 'A';
            const processType = jobWorkOrder.processType;
            const fabricFinishType = processType === 'PRINTING' ? 'PRINTED' : 'DYED';

            // Check if origin style requires embroidery for this fabric
            let styleNeedsEmbroidery = false;
            if (jobWorkOrder.styleId) {
              const embFabric = await tx.style_fabrics.findFirst({
                where: {
                  style_components: { styleId: jobWorkOrder.styleId },
                  hasEmbroidery: true,
                },
              });
              styleNeedsEmbroidery = !!embFabric;
            }

            // Good quality fabric_stock
            if (goodQty > 0) {
              await tx.fabric_stock.create({
                data: {
                  id: randomUUID(),
                  fabricId: jobWorkOrder.finishedFabricId,
                  finishedWidth: receivedWidth,
                  cutableWidth: cutableWidth,
                  quantityAvailable: goodQty,
                  quantityReserved: 0,
                  quantityConsumed: 0,
                  unit: 'meters',
                  originStyleId: jobWorkOrder.styleId,
                  status: 'AVAILABLE',
                  stockType: 'PLANNED_STOCK',
                  fabricFinishType: fabricFinishType,
                  weightedAvgCost: totalCostPerMeter,
                  purchaseCost: totalCostPerMeter,
                  qualityGrade: qualityGrade === 'Reject' ? 'B' : qualityGrade,
                  defectMeters: defectMetersNum,
                  receivedDate: jobWorkOrder.receivedDate || new Date(),
                  agingAlertSent: false,
                  agingDays: 0,
                  needsEmbroidery: styleNeedsEmbroidery,
                  createdById: userId,
                },
              });

              // Sync to stock_levels for unified inventory view
              await ensureMaterialRecord(jobWorkOrder.finishedFabricId, 'FABRIC', tx);
              await syncStockLevelQuantity(jobWorkOrder.finishedFabricId, goodQty, undefined, 'METER', tx);
            }

            // Defect fabric_stock at 50% cost
            if (defectMetersNum > 0 && qualityGrade !== 'B') {
              await tx.fabric_stock.create({
                data: {
                  id: randomUUID(),
                  fabricId: jobWorkOrder.finishedFabricId,
                  finishedWidth: receivedWidth,
                  cutableWidth: cutableWidth,
                  quantityAvailable: defectMetersNum,
                  quantityReserved: 0,
                  quantityConsumed: 0,
                  unit: 'meters',
                  originStyleId: jobWorkOrder.styleId,
                  status: 'AVAILABLE',
                  stockType: 'PLANNED_STOCK',
                  fabricFinishType: fabricFinishType,
                  weightedAvgCost: roundToCent(multiplyCurrency(totalCostPerMeter, 0.5)).toNumber(),
                  purchaseCost: roundToCent(multiplyCurrency(totalCostPerMeter, 0.5)).toNumber(),
                  qualityGrade: 'B',
                  defectMeters: defectMetersNum,
                  receivedDate: jobWorkOrder.receivedDate || new Date(),
                  agingAlertSent: false,
                  agingDays: 0,
                  needsEmbroidery: styleNeedsEmbroidery,
                  createdById: userId,
                },
              });

              // Sync defect fabric to stock_levels
              await ensureMaterialRecord(jobWorkOrder.finishedFabricId, 'FABRIC', tx);
              await syncStockLevelQuantity(jobWorkOrder.finishedFabricId, defectMetersNum, undefined, 'METER', tx);
            }

            // Consume from processor's greige_stock (created when outward challan was issued).
            // Only a lot that challan PARKED at this processor (Stock-Out TRANSFER) — matching on the
            // challan id alone could pick up any lot that happens to carry it.
            if (jobWorkOrder.outwardChallanId) {
              const processorGreigeStock = await tx.greige_stock.findFirst({
                where: {
                  sourceChallanId: jobWorkOrder.outwardChallanId,
                  processorId: jobWorkOrder.processorId,
                  sourceType: 'TRANSFER',
                },
              });

              if (processorGreigeStock) {
                const processorAvailable = Number(processorGreigeStock.quantityAvailable);
                const qtyToConsume = Math.min(qtyReceived, processorAvailable);

                if (qtyToConsume > 0) {
                  const newAvailable = processorAvailable - qtyToConsume;
                  await tx.greige_stock.update({
                    where: { id: processorGreigeStock.id },
                    data: {
                      quantityAvailable: newAvailable,
                      quantityConsumed: { increment: qtyToConsume },
                      lastConsumedDate: new Date(),
                      status: newAvailable <= 0 ? 'EXHAUSTED' : 'AVAILABLE',
                    },
                  });

                  // Create transaction record for audit trail
                  await tx.greige_stock_transaction.create({
                    data: {
                      stockId: processorGreigeStock.id,
                      transactionType: 'RECEIPT', // Receiving goods returned from processor
                      quantity: -qtyToConsume,
                      balanceAfter: newAvailable,
                      referenceType: 'GRN',
                      referenceId: id,
                      notes: `Consumed via GRN ${grn.grnNumber} - goods returned from processor`,
                      performedById: userId,
                    },
                  });

                  // The parked lot is on hand at the processor's unit (Phase 4e): the unit gives it up
                  if (processorGreigeStock.warehouseId) {
                    const greigeMaterialId = await ensureMaterialRecord(processorGreigeStock.greigeId, 'GREIGE', tx);
                    await syncStockLevelQuantity(
                      greigeMaterialId,
                      -qtyToConsume,
                      processorGreigeStock.warehouseId,
                      'METER',
                      tx
                    );
                  }

                  logInfo(`Consumed ${qtyToConsume}m from processor greige_stock`, {
                    grnId: id,
                    processorStockId: processorGreigeStock.id,
                    remaining: newAvailable,
                  });
                }
              }
            }

            // Update job status to STOCK_UPDATED and stamp the GRN link (BUG-JWC3: grnId was
            // never written anywhere, so reverseProcessingGRNInTx could never find the JWO)
            await setJwoStatus(tx, jobWorkOrder.id, 'STOCK_UPDATED', { grnId: id });

            // Flip the PO to RECEIVED via a guarded updateMany (bug-hunt procurement-20).
            // RECEIVED-with-shrinkage is intentional for PROCESSING POs (received meters < ordered
            // is normal mill shrinkage), but only flip from receivable statuses.
            await tx.purchase_orders.updateMany({
              where: {
                id: po.id,
                status: {
                  in: [
                    PurchaseOrderStatus.SENT,
                    PurchaseOrderStatus.ACKNOWLEDGED,
                    PurchaseOrderStatus.PARTIALLY_RECEIVED,
                  ],
                },
              },
              data: { status: PurchaseOrderStatus.RECEIVED },
            });

            // Per-item receivedQuantity was already incremented by poItemId at createGRN (bug-hunt
            // procurement-20: this branch used to ASSIGN the job's total meters onto poItems[0]
            // only, clobbering those increments and ignoring any other PO items). Only the
            // degenerate case of a processing GRN created with no item rows still records here.
            if (!grn.grn_items || grn.grn_items.length === 0) {
              const firstPoItem = await tx.purchase_order_items.findFirst({
                where: { poId: po.id },
              });
              if (firstPoItem) {
                await tx.purchase_order_items.update({
                  where: { id: firstPoItem.id },
                  data: { receivedQuantity: { increment: qtyReceived } },
                });
              }
            }

            logInfo(`PROCESSING PO approved via GRN - fabric_stock created`, {
              grnId: id,
              poId: po.id,
              goodQty,
              defectQty: defectMetersNum,
              costPerMeter: totalCostPerMeter,
            });
          } else {
            // P2.8: MRP-generated PROCESSING POs historically have no job_work_orders.
            // BUG-JWC4: also land here when a JWO exists but has no finishedFabricId yet
            // (JWC-bridged JWO received via GRN before the send flow ran) — previously that
            // combination fell through BOTH branches and approved with NO stock created.
            logInfo('PROCESSING PO fallback path (no JWO, or JWO without finishedFabricId)', {
              poId: po.id,
              hasJobWorkOrder: !!jobWorkOrder,
            });

            // Get the linked PROCESSING requirement via requirement_po_links
            const poLink = await tx.requirement_po_links.findFirst({
              where: { purchaseOrderId: po.id },
              include: {
                material_requirements: {
                  include: {
                    materials: {
                      select: { id: true, greigeId: true, materialType: true },
                    },
                    orders: { select: { id: true } },
                    order_items: {
                      select: {
                        styleId: true,
                        styles: { select: { id: true, styleCode: true, buyerStyleRef: true } },
                      },
                    },
                    processor: { select: { id: true, supplierCategories: true } },
                    // Fabric-naming: BOM → CAD → styleFabric/pattern-part chain
                    orderBomItem: {
                      select: {
                        id: true,
                        colorName: true,
                        greigeId: true,
                        fabricId: true,
                        selectedCad: {
                          select: {
                            id: true,
                            styleFabricId: true,
                            isCombinedCutting: true,
                            patternPart: { select: { id: true, name: true } },
                            cadPatternParts: {
                              select: {
                                patternPart: { select: { id: true, name: true, sortOrder: true } },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            });

            if (poLink?.material_requirements) {
              const req = poLink.material_requirements;
              const greigeId = req.materials?.greigeId;

              if (greigeId) {
                // Get GRN item quantities
                const grnItem = grn.grn_items?.[0];
                const qtyReceived = grnItem ? Number(grnItem.acceptedQuantity || grnItem.receivedQuantity || 0) : 0;
                const measuredWidth = grnItem?.receivedWidthInches != null ? Number(grnItem.receivedWidthInches) : null;
                const receivedWidth = await resolveStockWidthInches(
                  { sentWidthInches: null, fabric: { greigeId } },
                  measuredWidth,
                  tx
                );

                if (qtyReceived > 0) {
                  // Determine finish type from processor category or requirement printingType
                  // supplierCategories is an array; check if DYEING_PRINTING is included
                  const processorCategory = req.processor?.supplierCategories?.includes('DYEING_PRINTING')
                    ? 'DYEING_PRINTING'
                    : null;
                  const finishType = determineFinishType(processorCategory, req.printingType);

                  // Fabric-naming: full identity from the requirement chain (colour, CAD
                  // pattern part, styleFabric anchor) — never a 'Natural' placeholder
                  const identity = await resolveFinishedFabricIdentity({
                    requirement: req,
                    jwo: { receivedWidthInches: measuredWidth, sentWidthInches: null },
                    finishType,
                    tx,
                  });
                  if (!identity) {
                    // Unreachable: greigeId is verified above, so identity always resolves.
                    // Throw (fails the approval tx) rather than silently approving with no stock.
                    throw new Error(`PROCESSING PO GRN ${id}: finished fabric identity unresolvable for PO ${po.id}`);
                  }
                  const fabricResult = await getOrCreateFinishedFabricV2(identity, userId, 'AUTO_FROM_MRP_GRN', tx);

                  // Get processing cost from requirement
                  const processingRate = req.processingCost ? Number(req.processingCost) : 0;
                  // TODO: Get source greige cost from linked greige requirement's GRN
                  const sourceCost = 0; // For now, just use processing cost
                  const totalCostPerMeter = roundToCent(addCurrency(processingRate, sourceCost)).toNumber();

                  const processingWidthDeduction = await systemSettingsService.getCutableWidthDeductionInches();
                  const cutableWidth =
                    receivedWidth > processingWidthDeduction ? receivedWidth - processingWidthDeduction : receivedWidth;
                  const fabricFinishType = finishType === 'PRINTED' ? 'PRINTED' : 'DYED';
                  // One timestamp shared by fabric_stock and the JWO stamp — GRN reversal
                  // matches fabric_stock rows by exact receivedDate equality
                  const receivedAt = new Date();

                  // Create fabric_stock
                  await tx.fabric_stock.create({
                    data: {
                      id: randomUUID(),
                      fabricId: fabricResult.fabricId,
                      finishedWidth: receivedWidth,
                      cutableWidth: cutableWidth,
                      quantityAvailable: qtyReceived,
                      quantityReserved: 0,
                      quantityConsumed: 0,
                      unit: 'meters',
                      originStyleId: req.order_items?.styleId || null,
                      // Fabric-naming: pattern part from the BOM→CAD chain
                      patternPartId: identity.patternPartId,
                      status: 'AVAILABLE',
                      stockType: 'PLANNED_STOCK',
                      fabricFinishType: fabricFinishType,
                      weightedAvgCost: totalCostPerMeter,
                      purchaseCost: totalCostPerMeter,
                      qualityGrade: processingQC?.qualityGrade || DEFAULT_QUALITY_GRADE,
                      defectMeters: processingQC?.defectMeters || 0,
                      receivedDate: receivedAt,
                      agingAlertSent: false,
                      agingDays: 0,
                      needsEmbroidery: false,
                      createdById: userId,
                      warehouseId: targetWarehouseId,
                    },
                  });

                  // Sync to stock_levels (ensure materials record exists for matched fabrics)
                  await ensureMaterialRecord(fabricResult.fabricId, 'FABRIC', tx);
                  await syncStockLevelQuantity(fabricResult.fabricId, qtyReceived, targetWarehouseId, 'METER', tx);

                  // Update PO status to RECEIVED
                  await tx.purchase_orders.updateMany({
                    where: {
                      id: po.id,
                      status: {
                        in: [
                          PurchaseOrderStatus.SENT,
                          PurchaseOrderStatus.ACKNOWLEDGED,
                          PurchaseOrderStatus.PARTIALLY_RECEIVED,
                          PurchaseOrderStatus.READY_FOR_PROCESSING,
                        ],
                      },
                    },
                    data: { status: PurchaseOrderStatus.RECEIVED },
                  });

                  // BUG-JWC4: if a (bridged) JWO exists, stamp it so the job-work views and
                  // GRN reversal see the receipt — previously this case created no stock at all
                  if (jobWorkOrder) {
                    await setJwoStatus(tx, jobWorkOrder.id, 'STOCK_UPDATED', {
                      finishedFabricId: fabricResult.fabricId,
                      qtyReceivedMeters: qtyReceived,
                      receivedDate: receivedAt,
                      grnId: id,
                    });
                  }

                  logInfo(`MRP PROCESSING PO approved via GRN - fabric_stock created`, {
                    grnId: id,
                    poId: po.id,
                    fabricId: fabricResult.fabricId,
                    fabricCode: fabricResult.fabricCode,
                    isNewFabric: fabricResult.isNew,
                    qtyReceived,
                    costPerMeter: totalCostPerMeter,
                    jwoStamped: !!jobWorkOrder,
                  });
                }
              } else {
                logWarn('PROCESSING requirement has no greigeId - cannot create fabric_stock', {
                  poId: po.id,
                  requirementId: req.id,
                });
              }
            } else {
              logWarn('No requirement linked to PROCESSING PO - cannot create fabric_stock', {
                poId: po.id,
              });
            }
          }

          // BUG-JWC7 (Phase 4a): mirror of the generic loop's MRP bridge below — the PROCESSING
          // branch early-returns before it, so requirements never advanced past PO_GENERATED
          // while reverseGRN still decremented (a reversal could push a never-incremented
          // requirement to PO_SENT). acceptedQuantity only: createGRN enforces
          // accepted+rejected=received and reversal decrements acceptedQuantity — symmetric.
          for (const item of grn.grn_items || []) {
            const acceptedQty = grnLineActualQty(item).toNumber();
            if (acceptedQty > 0 && item.poItemId) {
              await mrpService.updateReceivedQuantity(item.poItemId, acceptedQty, tx);
            }
          }

          return approved; // Skip normal stock_movements/stock_levels
        }

        // Categories with their own lot branch (greige, fabric, lace, unpacked thread) sync stock_levels there;
        // every other line — trims, and thread ordered in a pack (on its PACK row) — books stock_levels HERE,
        // once, and its lot in createSpecializedStockInTx.
        // Create stock movements and update stock levels for accepted items
        for (const item of grn.grn_items) {
          const bookStockLevelsHere = lineBooksStockLevelsInLoop(po?.poCategory, item);
          // A packed thread line's stock is its pack row (Cone 3-ply…), in cones / tubes; every other line's, its own
          const stockMaterialId = await grnLineStockMaterialId(tx, item);
          // ACTUAL metres (counted × L/100 when the line has a fold length) — the PO unit; value and GST.
          const acceptedQty = grnLineActualQty(item).toNumber();
          const folded = hasFold(item.foldLengthCm);
          if (acceptedQty > 0) {
            // Get unit price from PO item for stock valuation
            const unitPrice = item.purchase_order_items ? Number(item.purchase_order_items.unitPrice) : 0;
            // Value is what was bought: PO quantity × PO rate (16 gross × ₹18), never stock qty × stock rate
            const totalValue = roundToCent(multiplyCurrency(acceptedQty, unitPrice)).toNumber();
            // What enters STOCK: 16 gross → 2,304 pieces at ₹0.125 (a line bought in its own unit: unchanged)
            const stock = grnLineStock(item);
            const inPurchaseUnit = stock.unit !== item.unit;

            // Recorded on the line so a reversal takes back exactly this, never a recomputation
            await tx.grn_items.update({ where: { id: item.id }, data: { stockQuantity: stock.qty } });

            // Create stock movement record (audit trail - always created)
            await tx.stock_movements.create({
              data: {
                id: randomUUID(),
                movementType: MovementType.STOCK_IN,
                materialId: stockMaterialId,
                warehouseId: targetWarehouseId,
                supplierId: grn.supplierId, // Direct supplier reference
                quantity: stock.qty,
                unit: stock.unit,
                referenceType: 'GRN',
                referenceId: grn.id,
                referenceNumber: grn.grnNumber,
                rate: stock.rate,
                value: totalValue,
                foldLengthCm: folded ? item.foldLengthCm : null,
                remarks: folded
                  ? `Stock received from GRN ${grn.grnNumber} — counted ${Number(item.acceptedQuantity)} @ L=${Number(item.foldLengthCm)}`
                  : inPurchaseUnit
                    ? `Stock received from GRN ${grn.grnNumber} — ${acceptedQty} ${unitShort(item.unit)} = ${stock.qty} ${unitShort(stock.unit)}`
                    : `Stock received from GRN ${grn.grnNumber}`,
                performedById: userId,
                movementDate: new Date(),
              },
            });

            // Inline, not syncStockLevelQuantity: that helper swallows errors, and a receipt must not approve
            // with its stock_levels write lost
            if (bookStockLevelsHere) {
              await tx.stock_levels.upsert({
                where: { materialId_warehouseId: { materialId: stockMaterialId, warehouseId: targetWarehouseId } },
                create: {
                  id: randomUUID(),
                  materialId: stockMaterialId,
                  warehouseId: targetWarehouseId,
                  quantity: stock.qty,
                  unit: stock.unit,
                  minLevel: 0,
                  reorderLevel: 0,
                },
                update: { quantity: { increment: stock.qty }, lastUpdated: new Date() },
              });
            }

            // MRP received-qty update, now ATOMIC with the approval — updateReceivedQuantity is tx-aware and
            // no longer opens a nested tx, so running it on `tx` closes the over-procurement gap (a committed
            // receipt MRP never saw → duplicate PO) without the second-connection/deadlock risk (F4 #12).
            // In STOCK units: requirement links count pieces even when the PO line is in gross.
            if (item.poItemId) {
              await mrpService.updateReceivedQuantity(item.poItemId, stock.qty, tx);
            }
          }

          // Track rejected quantities as audit trail — and NET THEM OUT of the PO's received counter
          // (bug-hunt procurement-7: createGRN increments receivedQuantity by the GROSS receipt pre-QC;
          // without this decrement, QC-rejected quantity stayed counted as "received" forever, the PO
          // closed as RECEIVED, and the rejected goods were never re-procured. This also makes the PO
          // counter agree with the MRP link, which was already updated with ACCEPTED qty only).
          // Actual rejected = actual received − actual accepted, so the PO counter nets to exactly the
          // actual accepted quantity (createGRN incremented it by the actual received).
          const rejectedQty = folded
            ? toNumber(subtractCurrency(foldActual(item.receivedQuantity, item.foldLengthCm), acceptedQty))
            : Number(item.rejectedQuantity || 0);
          if (rejectedQty > 0) {
            // The PO's counter is in the PO unit (gross); the movement is in stock units like every movement
            if (item.poItemId) {
              await tx.purchase_order_items.update({
                where: { id: item.poItemId },
                data: { receivedQuantity: { decrement: rejectedQty } },
              });
            }
            const rejectedStock = grnLineStock({ ...item, acceptedQuantity: rejectedQty, foldLengthCm: null });
            await tx.stock_movements.create({
              data: {
                id: randomUUID(),
                movementType: MovementType.ADJUSTMENT_OUT,
                materialId: stockMaterialId,
                warehouseId: targetWarehouseId,
                supplierId: grn.supplierId, // Direct supplier reference
                quantity: rejectedStock.qty,
                unit: rejectedStock.unit,
                referenceType: 'GRN_REJECTION',
                referenceId: grn.id,
                referenceNumber: grn.grnNumber,
                rate: rejectedStock.rate,
                value: roundToCent(
                  multiplyCurrency(
                    rejectedQty,
                    item.purchase_order_items ? Number(item.purchase_order_items.unitPrice) : 0
                  )
                ).toNumber(),
                remarks: `Rejected during GRN ${grn.grnNumber} — pending supplier return/credit`,
                performedById: userId,
                movementDate: new Date(),
              },
            });
          }
        }

        // Create the ACTUAL specialized per-lot stock records INSIDE this transaction, so that any
        // stock-write failure rolls back the whole approval (bug-hunt T1-1/F4). Previously these ran
        // AFTER commit with per-category error swallowing, which could leave an ACCEPTED GRN with no
        // stock ("books say received, shelf says empty").
        if (po) {
          await this.createSpecializedStockInTx(tx, grn, po, userId, targetWarehouseId, direct);
        }

        return approved;
      },
      { timeout: 30000, maxWait: 10000 }
    );

    // Best-effort downstream cascades — run AFTER the transaction commits. These are genuinely
    // non-critical (PO status recompute + future-sourcing cost-sheet update); their failure must
    // NOT roll back a valid receipt, so they only log.
    const postCommit = (grn as any).__postCommit as
      | {
          updateProcessingPOStatus?: boolean;
          sourcingUpdates?: Array<{ poId: string; fabricId: string; actualRate: number }>;
        }
      | undefined;

    // BUG-PROC4 fix: Collect warnings from post-commit operations to notify frontend
    const postCommitWarnings: string[] = [];

    // P2: Recompute PO receiving status FIRST, before processing activation.
    // checkProcessingPOReadiness relies on PO status being RECEIVED, so this must run first.
    // SKIPPED for PROCESSING POs: their approval branch sets RECEIVED itself with shrinkage
    // semantics — received < ordered is NORMAL there, and a naive recompute would wrongly
    // demote every shrinkage-bearing processing PO to PARTIALLY_RECEIVED.
    let poCategory: string | null = null;
    // Phase 4b: PO-less (JWO-keyed) GRNs have no PO status to recompute
    if (grn.poId) {
      try {
        const poCat = await prisma.purchase_orders.findUnique({
          where: { id: grn.poId },
          select: { poCategory: true },
        });
        poCategory = poCat?.poCategory || null;
        if (poCategory !== 'PROCESSING') {
          await purchaseOrderService.updateReceivingStatus(grn.poId);
        }
      } catch (statusErr) {
        const errMsg = 'Failed to recompute PO receiving status';
        logError(errMsg, statusErr);
        postCommitWarnings.push(errMsg);
      }
    }

    // P2: Processing activation — checkProcessingPOReadiness handles BOTH GREIGE and GREIGE_LACE
    // categories, and relies on PO status being RECEIVED.
    if (grn.poId && (postCommit?.updateProcessingPOStatus || poCategory === 'GREIGE' || poCategory === 'GREIGE_LACE')) {
      try {
        const readiedPOs = await checkProcessingPOReadiness(grn.poId);
        if (readiedPOs.length > 0) {
          logInfo(`Processing POs readied after greige receipt: ${readiedPOs.join(', ')}`, {
            grnId: id,
            greigePOId: grn.poId,
            readiedPOs,
          });
        }
      } catch (error) {
        const errMsg = 'Failed to auto-update Processing PO status';
        logError(errMsg, error);
        postCommitWarnings.push(errMsg);
      }
    }

    for (const su of postCommit?.sourcingUpdates ?? []) {
      try {
        const costSheetResult = await updateCostSheetSourcingStrategy(su.poId, su.fabricId, su.actualRate, prisma);
        if (costSheetResult.updatedItems > 0) {
          logInfo(`Updated cost sheet sourcing strategy for ${costSheetResult.affectedStyles.length} style(s)`, {
            grnId: id,
            fabricId: su.fabricId,
            updatedItems: costSheetResult.updatedItems,
            affectedStyles: costSheetResult.affectedStyles,
          });
        }
      } catch (costSheetErr) {
        const errMsg = `Failed to update cost sheet sourcing strategy for fabric ${su.fabricId}`;
        logError(errMsg, costSheetErr);
        postCommitWarnings.push(errMsg);
      }
    }

    // BUG-PROC4 fix: Return warnings with the GRN so frontend can notify user
    return {
      ...updatedGRN,
      _warnings: postCommitWarnings.length > 0 ? postCommitWarnings : undefined,
    };
  }

  /**
   * Create the ACTUAL specialized per-lot stock records for a GRN receipt, INSIDE the approval
   * transaction. Every write uses the passed transaction client (`tx`) so a failure in any category
   * rolls back the entire GRN approval (bug-hunt T1-1/F4) rather than committing an ACCEPTED GRN with
   * no stock behind it.
   *
   * Non-critical downstream cascades (updateProcessingPOStatusOnGreigeGRN + updateCostSheetSourcingStrategy)
   * are NOT executed here — they are collected onto `grn.__postCommit` and run best-effort AFTER commit.
   *
   * `warehouseId` is the validated, non-null target warehouse — every specialized stock row and its
   * stock_levels sync is written against it (Rule A: every stock row has a warehouse).
   */
  private async createSpecializedStockInTx(
    tx: Prisma.TransactionClient,
    grn: any,
    po: { id: string; poCategory: string | null; supplierId: string | null },
    userId: string,
    warehouseId: string,
    direct: DirectDelivery | null = null
  ): Promise<void> {
    // Goods delivered straight to a processor: every lot this receipt books there — greige, fabric, lace
    // or trims (owner, 2026-09-25: all materials to a dyer travel under a challan) — for its ONE Rule 45
    // challan, raised at the end of this method in the same transaction.
    const directLines: DirectSupplyLine[] = [];
    const postCommit = (grn.__postCommit = grn.__postCommit || {
      updateProcessingPOStatus: false,
      sourcingUpdates: [] as Array<{ poId: string; fabricId: string; actualRate: number }>,
    });

    // ===== GREIGE (with receivedAsReadyFabric override support) =====
    if (po.poCategory === 'GREIGE') {
      const overrideItems = grn.grn_items.filter((item: any) => item.receivedAsReadyFabric);
      const normalItems = grn.grn_items.filter((item: any) => !item.receivedAsReadyFabric);

      // Handle receivedAsReadyFabric override items
      if (overrideItems.length > 0) {
        logInfo(`GRN ${grn.grnNumber}: ${overrideItems.length} item(s) received as ready fabric`, {
          grnId: grn.id,
          greigePOId: po.id,
        });

        // Validate the override can be applied (pre-flight checks)
        const validation = await validateSourceMismatchOverride(po.id, tx);
        if (!validation.canOverride) {
          // Log but don't fail - items fall back to the normal greige flow
          logError(`Source mismatch override blocked: ${validation.blockReason}`, {
            grnId: grn.id,
            greigePOId: po.id,
          });
          normalItems.push(...overrideItems);
          overrideItems.length = 0;
        } else {
          // Validation passed - run cleanup on the SAME transaction (no separate inner $transaction)
          const cleanupResult = await executeSourceMismatchCleanup(po.id, tx);
          logInfo(`Source mismatch cleanup completed`, {
            grnId: grn.id,
            greigePOId: po.id,
            cancelledPOs: cleanupResult.cancelledPOs,
            cancelledBatches: cleanupResult.cancelledBatches,
            cancelledChallans: cleanupResult.cancelledChallans,
          });

          // Create fabric_stock for override items
          for (const item of overrideItems) {
            const acceptedQty = grnLineActualQty(item).toNumber();
            if (acceptedQty <= 0) continue;

            // Get material to find greigeId, then find linked fabric
            const material = await tx.materials.findUnique({
              where: { id: item.materialId },
              include: { greige_master: true },
            });

            if (!material?.greigeId || !material.greige_master) {
              logError(
                `GRN item ${item.id}: material ${item.materialId} has no greige link, cannot create fabric_stock`,
                { itemId: item.id }
              );
              continue;
            }

            const greige = material.greige_master;

            // Find the fabric_master linked to this greige
            const fabric = await findFabricForGreige(greige.id, tx);
            if (!fabric) {
              logError(`No fabric_master linked to greige ${greige.greigeCode}. Cannot create fabric_stock.`, {
                grnId: grn.id,
                greigeId: greige.id,
                itemId: item.id,
              });
              continue;
            }

            // Determine the rate: use actualRatePerUnit if provided, otherwise PO rate
            const actualRate = item.actualRatePerUnit
              ? Number(item.actualRatePerUnit)
              : item.purchase_order_items
                ? Number(item.purchase_order_items.unitPrice)
                : 0;

            // Use per-item received width if available, otherwise default
            const finishedWidth = item.receivedWidthInches ? Number(item.receivedWidthInches) : 44;
            const cutableWidth = finishedWidth > 2 ? finishedWidth - 2 : finishedWidth;

            // Ensure material record exists for this fabric
            await ensureMaterialRecord(fabric.id, 'FABRIC', tx);

            // Create fabric_stock instead of greige_stock
            const overrideFabricLot = await tx.fabric_stock.create({
              data: {
                fabricId: fabric.id,
                finishedWidth: finishedWidth,
                cutableWidth: cutableWidth,
                quantityAvailable: acceptedQty,
                quantityReserved: 0,
                quantityConsumed: 0,
                unit: 'meters',
                status: 'AVAILABLE',
                stockType: 'PLANNED_STOCK',
                qualityGrade: DEFAULT_QUALITY_GRADE, // BUG-GR9 fix
                weightedAvgCost: actualRate,
                purchaseCost: actualRate,
                receivedDate: grn.receivingDate || new Date(),
                warehouseId: warehouseId,
                createdById: userId,
                weaverId: item.weaverId ?? null, // the weaver whose cloth arrived (Phase 1b)
              },
            });

            // Sync stock_levels for the fabric
            await syncStockLevelQuantity(fabric.id, acceptedQty, warehouseId, undefined, tx);
            if (direct) {
              directLines.push({
                itemType: 'FABRIC',
                fabricStockId: overrideFabricLot.id,
                quantity: acceptedQty,
                unit: Unit.METER,
                rate: actualRate,
                description: `${fabric.fabricCode ?? 'Fabric'} — received as ready fabric against ${greige.greigeCode}`,
              });
            }

            // Create fabric_procurement record for audit trail
            await tx.fabric_procurement.create({
              data: {
                fabricId: fabric.id,
                procurementType: 'FINISHED',
                supplierId: grn.supplierId,
                ratePerUnit: actualRate,
                quantityPurchased: acceptedQty,
                width: finishedWidth,
                totalCost: roundToCent(multiplyCurrency(acceptedQty, actualRate)).toNumber(),
                receivedDate: grn.receivingDate || new Date(),
                status: 'COMPLETED',
                createdById: userId,
              },
            });

            logInfo(
              `Created fabric_stock (override): GRN ${grn.grnNumber}, ${acceptedQty}m of ${fabric.fabricCode} at ₹${actualRate}/m`,
              {
                grnId: grn.id,
                fabricId: fabric.id,
                greigeId: greige.id,
                quantity: acceptedQty,
                rate: actualRate,
                wasOverride: true,
              }
            );

            // Defer the cost-sheet sourcing-strategy update (non-critical cascade) to post-commit
            if (item.updateFutureSourcing) {
              postCommit.sourcingUpdates.push({ poId: po.id, fabricId: fabric.id, actualRate });
            }
          }
        }
      }

      // Handle normal greige items (not overridden)
      if (normalItems.length > 0) {
        // Defer Processing PO status recompute (non-critical cascade) to post-commit
        postCommit.updateProcessingPOStatus = true;

        // Auto-create greige_stock entries for accepted greige items
        for (const item of normalItems) {
          const acceptedQty = Number(item.acceptedQuantity);
          if (acceptedQty <= 0) continue;

          // Get material to find greigeId
          const material = await tx.materials.findUnique({
            where: { id: item.materialId },
            include: { greige_master: true },
          });

          if (!material?.greigeId || !material.greige_master) {
            logInfo(
              `GRN item ${item.id}: material ${item.materialId} has no greige link, skipping greige_stock creation`
            );
            continue;
          }

          const greige = material.greige_master;
          const unitPrice = item.purchase_order_items ? Number(item.purchase_order_items.unitPrice) : 0;

          // Use per-item received width if available, otherwise fall back to greige master width
          const greigeWidth = item.receivedWidthInches
            ? Number(item.receivedWidthInches)
            : Number(greige.greigeWidth || 44);

          // skipMaterialSync so createGreigeStock does NOT run its own ensureMaterialRecord /
          // syncStockLevelQuantity on the GLOBAL prisma client (that stock_levels increment would commit
          // OUTSIDE this transaction and survive a rollback). We sync below on `tx` using the actual
          // (fold-length-adjusted) quantity the service computed, so stock_levels rolls back with the
          // receipt like every other category (bug-hunt T1-1).
          const createdGreige = await greigeStockService.createGreigeStock(
            {
              greigeId: greige.id,
              quantity: acceptedQty, // COUNTED — createGreigeStock converts it once at foldLengthCm
              width: greigeWidth,
              purchaseCost: unitPrice,
              supplierId: grn.supplierId,
              receivedDate: grn.receivingDate,
              warehouseId: warehouseId,
              qualityGrade: DEFAULT_QUALITY_GRADE, // BUG-GR9 fix
              // GRN, or DIRECT when the supplier delivered it straight to a processor: ours, held there
              sourceType: direct ? 'DIRECT' : 'GRN',
              processorId: direct?.processorId ?? null,
              // Pass fold length for actual quantity calculation
              foldLengthCm: item.foldLengthCm ? Number(item.foldLengthCm) : undefined,
              thanCount: item.thanCount || undefined,
              tx,
              skipMaterialSync: true,
              // P2: Identity-based reversal
              grnItemId: item.id,
              weaverId: item.weaverId ?? null,
            },
            userId
          );
          if (direct) {
            directLines.push({
              itemType: 'GREIGE',
              greigeStockId: createdGreige.id,
              quantity: Number(createdGreige.quantityAvailable),
              unit: Unit.METER,
              rate: unitPrice,
              ...(hasFold(item.foldLengthCm) ? { foldLengthCm: Number(item.foldLengthCm) } : {}),
              description: `${greige.greigeCode} — ${greige.greigeName ?? 'greige'}`,
            });
          }

          // P2: Store actualQuantity on the grn_item (physical qty after fold adjustment)
          // Documents stay NOMINAL (receivedQuantity), stock is ACTUAL (quantityAvailable)
          const actualQty = Number(createdGreige.quantityAvailable);
          await tx.grn_items.update({
            where: { id: item.id },
            data: { actualQuantity: new Prisma.Decimal(actualQty) },
          });

          await ensureMaterialRecord(greige.id, 'GREIGE', tx);
          await syncStockLevelQuantity(greige.id, actualQty, warehouseId, undefined, tx);

          // Record what this greige was last actually bought for. On `tx`, so it rolls back with
          // the receipt. Guarded inside the helper: a GRN item with no PO line gives unitPrice 0.
          await updateGreigeLastPurchaseRate(tx, {
            greigeId: greige.id,
            rate: unitPrice,
            purchasedAt: grn.receivingDate || new Date(),
            sourceRef: grn.grnNumber,
          });

          logInfo(`Auto-created greige_stock from GRN ${grn.grnNumber}: ${acceptedQty}m of ${greige.greigeCode}`, {
            grnId: grn.id,
            greigeId: greige.id,
            quantity: acceptedQty,
          });

          // Propagate GRN item details (individual thans/bales) to greige_stock_details
          // This preserves granular bale/than tracking for issuance selection
          const grnDetails = (item as any).grn_item_details;
          if (grnDetails && grnDetails.length > 0) {
            // Count unique bale numbers for baleCount
            const uniqueBales = new Set(grnDetails.map((d: any) => d.baleNumber).filter(Boolean));
            if (uniqueBales.size > 0) {
              await tx.greige_stock.update({
                where: { id: createdGreige.id },
                data: { baleCount: uniqueBales.size },
              });
            }

            // Create greige_stock_details records for each than/roll
            await tx.greige_stock_details.createMany({
              data: grnDetails.map((detail: any) => ({
                greigeStockId: createdGreige.id,
                baleNumber: detail.baleNumber,
                sequenceNo: detail.sequenceNo,
                meters: detail.meters,
                metersRemaining: detail.meters, // Initially full
                status: 'AVAILABLE',
                remarks: detail.remarks,
                baleNo: detail.baleNo ?? null,
                thanNo: detail.thanNo ?? null,
              })),
            });

            logInfo(`Propagated ${grnDetails.length} than/roll records to greige_stock_details`, {
              greigeStockId: createdGreige.id,
              baleCount: uniqueBales.size,
            });
          }
        }
      }
    }

    // ===== FABRIC =====
    if (po.poCategory === 'FABRIC') {
      for (const item of grn.grn_items) {
        const acceptedQty = grnLineActualQty(item).toNumber();
        if (acceptedQty <= 0) continue;

        const material = await tx.materials.findUnique({
          where: { id: item.materialId },
          select: {
            fabricId: true,
            fabric_master: {
              select: { id: true, actualWidth: true, cutableWidth: true },
            },
          },
        });

        if (!material?.fabricId || !material.fabric_master) {
          logInfo(
            `GRN item ${item.id}: material ${item.materialId} has no fabric link, skipping fabric_stock creation`
          );
          continue;
        }

        const fabric = material.fabric_master;
        const unitPrice = item.purchase_order_items ? Number(item.purchase_order_items.unitPrice) : 0;
        // Use per-item received width if available, otherwise fall back to fabric master width
        const actualWidth = item.receivedWidthInches
          ? Number(item.receivedWidthInches)
          : Number(fabric.actualWidth || 0);
        const cutableWidth = Number(fabric.cutableWidth || (actualWidth > 2 ? actualWidth - 2 : actualWidth));

        const fabricLot = await tx.fabric_stock.create({
          data: {
            fabricId: fabric.id,
            finishedWidth: actualWidth,
            cutableWidth: cutableWidth,
            quantityAvailable: acceptedQty,
            quantityReserved: 0,
            quantityConsumed: 0,
            unit: 'meters',
            status: 'AVAILABLE',
            stockType: 'GENERIC',
            qualityGrade: DEFAULT_QUALITY_GRADE, // BUG-GR9 fix
            weightedAvgCost: unitPrice,
            purchaseCost: unitPrice,
            receivedDate: grn.receivingDate || new Date(),
            warehouseId: warehouseId,
            createdById: userId,
            weaverId: item.weaverId ?? null, // the weaver whose cloth arrived (Phase 1b)
          },
        });

        // Ensure materials record + sync stock_levels
        await ensureMaterialRecord(fabric.id, 'FABRIC', tx);
        await syncStockLevelQuantity(fabric.id, acceptedQty, warehouseId, undefined, tx);
        if (direct) {
          directLines.push({
            itemType: 'FABRIC',
            fabricStockId: fabricLot.id,
            quantity: acceptedQty,
            unit: Unit.METER,
            rate: unitPrice,
            description: `${item.materials?.name ?? 'Fabric'}`,
          });
        }

        logInfo(
          `Auto-created fabric_stock from FABRIC GRN ${grn.grnNumber}: ${acceptedQty}m of fabricId=${fabric.id}`,
          {
            grnId: grn.id,
            fabricId: fabric.id,
            quantity: acceptedQty,
          }
        );
      }
    }

    // ===== LACE / GREIGE_LACE =====
    if (po.poCategory === 'LACE' || po.poCategory === 'GREIGE_LACE') {
      for (const item of grn.grn_items) {
        const acceptedQty = Number(item.acceptedQuantity);
        if (acceptedQty <= 0) continue;

        const material = await tx.materials.findUnique({
          where: { id: item.materialId },
          select: {
            laceId: true,
            lace_master: {
              select: { id: true, laceCode: true },
            },
          },
        });

        if (!material?.laceId || !material.lace_master) {
          logInfo(`GRN item ${item.id}: material ${item.materialId} has no lace link, skipping lace_stock creation`);
          continue;
        }

        const unitPrice = item.purchase_order_items ? Number(item.purchase_order_items.unitPrice) : 0;

        const laceLot = await tx.lace_stock.create({
          data: {
            laceId: material.lace_master.id,
            quantityAvailable: acceptedQty,
            quantityReserved: 0,
            quantityConsumed: 0,
            unit: 'meters',
            status: 'AVAILABLE',
            stockType: 'PLANNED_STOCK',
            qualityGrade: DEFAULT_QUALITY_GRADE, // BUG-GR9 fix
            weightedAvgCost: unitPrice,
            purchaseCost: unitPrice,
            receivedDate: grn.receivingDate || new Date(),
            warehouseId: warehouseId,
            procurementId: grn.poId || undefined,
            // The receipt line that booked this lot — reversal finds it exactly (never by quantity)
            grnItemId: item.id,
            createdById: userId,
          },
        });

        // Ensure materials record + sync stock_levels
        await ensureMaterialRecord(material.lace_master.id, 'LACE', tx);
        await syncStockLevelQuantity(material.lace_master.id, acceptedQty, warehouseId, undefined, tx);
        if (direct) {
          directLines.push({
            itemType: 'LACE',
            laceStockId: laceLot.id,
            quantity: acceptedQty,
            unit: Unit.METER,
            rate: unitPrice,
            description: `${material.lace_master.laceCode} — lace`,
          });
        }

        logInfo(
          `Auto-created lace_stock from LACE GRN ${grn.grnNumber}: ${acceptedQty}m of laceId=${material.lace_master.id}`,
          { grnId: grn.id, laceId: material.lace_master.id, quantity: acceptedQty }
        );
      }
    }

    // ===== THREAD — one lot per receipt line =====
    // A line ordered in boxes of a pack (2026-09-26) becomes a lot of THAT pack — packing and ply from the PO
    // LINE, never the thread master — in cones / tubes (boxes × box size), on any PO category; its stock_levels
    // was booked on the pack row in the generic loop. An unpacked line on a THREAD PO (none since the PO
    // writers require a pack) makes an unpacked lot on the thread's base row. One lot per GRN line (grnItemId):
    // the old (thread, PO, packing, ply) key made a second receipt on the same PO line fail.
    for (const item of grn.grn_items) {
      const pack = threadPackOf(item);
      if (!pack && po.poCategory !== 'THREAD') continue;
      const stock = grnLineStock(item);
      if (!(stock.qty > 0)) continue;

      const material = await tx.materials.findUnique({
        where: { id: item.materialId },
        select: { threadId: true },
      });
      if (!material?.threadId) {
        logInfo(`GRN item ${item.id}: material ${item.materialId} has no thread link, skipping thread_stock creation`);
        continue;
      }

      const lot = await threadStockService.createThreadStock(
        {
          threadId: material.threadId,
          pack: pack ?? { packagingType: null, ply: null },
          quantity: stock.qty,
          purchaseCost: stock.rate,
          warehouseId,
          sourceType: 'GRN',
          grnItemId: item.id,
          grnId: grn.id,
          procurementId: grn.poId ?? undefined,
          receivedDate: grn.receivingDate ? new Date(grn.receivingDate) : new Date(),
          skipMaterialSync: lineBooksStockLevelsInLoop(po.poCategory, item),
          tx,
        },
        userId
      );

      logInfo(`Thread lot from GRN ${grn.grnNumber}: ${stock.qty} ${stock.unit} of threadId=${material.threadId}`, {
        grnId: grn.id,
        lotId: lot.id,
        packagingType: pack?.packagingType ?? null,
        ply: pack?.ply ?? null,
      });
    }

    // ===== TRIMS — every category without its own lot branch (TRIMS, GENERAL, BUTTON, LABEL …) =====
    // One path for all seven trim lot tables: each line routes by ITS material (a sized label lands on its
    // size), in stock units (16 gross → 2,304 pcs). stock_levels was booked once in the generic loop. Before
    // 2026-09-26 seven hand-written branches keyed on the PO CATEGORY, and MRP and the PO form file buttons
    // and labels as TRIMS — so no trim receipt ever reached a lot table, a stock screen or MRP netting.
    if (receivesViaStockLevels(po.poCategory)) {
      for (const item of grn.grn_items) {
        // A packed thread line got its lot in the thread block above
        if (!item.materialId || threadPackOf(item)) continue;
        const stock = grnLineStock(item);
        if (!(stock.qty > 0)) continue;
        await routeToSpecializedStock(
          {
            materialId: item.materialId,
            quantity: stock.qty,
            unit: stock.unit,
            rate: stock.rate,
            warehouseId,
            supplierId: grn.supplierId ?? undefined,
            procurementId: grn.poId ?? undefined,
            receivedDate: grn.receivingDate ?? undefined,
            sourceType: 'GRN',
            performedById: userId,
          },
          tx,
          { strict: true, trimsOnly: true }
        );
      }
    }

    if (!direct) return;

    // Trims (thread, buttons, zippers, elastic, labels, packaging, parts, other): each has its own stock
    // table above; the challan names them by material, one line per receipt line.
    const LOT_CATEGORIES = new Set(['GREIGE', 'FABRIC', 'LACE', 'GREIGE_LACE']);
    if (!LOT_CATEGORIES.has(po.poCategory ?? '')) {
      for (const item of grn.grn_items) {
        // The challan moves STOCK: 16 gross of buttons travel as 2,304 pieces at the per-piece rate
        const stock = grnLineStock(item);
        if (!(stock.qty > 0)) continue;
        directLines.push({
          itemType: 'TRIM',
          materialId: item.materialId,
          quantity: stock.qty,
          unit: normalizeUnit(stock.unit) ?? Unit.PIECE,
          rate: stock.rate,
          description: item.materials?.name ?? 'Trim',
        });
      }
    }

    // Rule 45: ONE challan for everything the supplier delivered straight to the processor — same tx,
    // dated the day the processor got it (the receipt date).
    if (directLines.length > 0) {
      const receivedOn = grn.receivingDate ? new Date(grn.receivingDate) : new Date();
      const challan = await createDirectSupplyChallanInTx(tx, {
        grnId: grn.id,
        grnNumber: grn.grnNumber,
        supplierId: grn.supplierId ?? null,
        supplierName: direct.supplierName,
        processorId: direct.processorId,
        processorName: direct.processorName,
        invoiceNumber: grn.invoiceNumber ?? null,
        invoiceDate: grn.invoiceDate ? new Date(grn.invoiceDate) : null,
        receivedOn,
        challanDate: receivedOn,
        lines: directLines,
        userId,
      });
      logInfo(
        `GRN ${grn.grnNumber}: goods delivered straight to ${direct.processorName} — challan ${challan.challanNumber}`,
        {
          grnId: grn.id,
          challanId: challan.id,
          lines: directLines.length,
        }
      );
    }
  }

  /**
   * Reject a GRN
   */
  async rejectGRN(id: string, userId: string, reason: string) {
    const grn = await prisma.goods_receiving_notes.findUnique({
      where: { id },
    });

    if (!grn) {
      throw new Error('GRN not found');
    }

    if (grn.status !== GRNStatus.PENDING_QC) {
      throw new Error(`Cannot reject GRN in ${grn.status} status`);
    }

    // Revert PO item received quantities
    const grnItems = await prisma.grn_items.findMany({
      where: { grnId: id },
    });

    const updatedGRN = await prisma.$transaction(async (tx) => {
      // GUARDED status flip (PENDING_QC only) — same guard as approveGRN: a concurrent approve/reject
      // pair could otherwise both commit and double-decrement the PO counters (potentially negative).
      const flip = await tx.goods_receiving_notes.updateMany({
        where: { id, status: GRNStatus.PENDING_QC },
        data: {
          status: GRNStatus.REJECTED,
          approvedById: userId,
          remarks: reason ? `${grn.remarks || ''}\n\nRejection reason: ${reason}`.trim() : grn.remarks,
        },
      });
      if (flip.count === 0) {
        throw new Error('GRN is no longer PENDING_QC — it was already approved or rejected');
      }
      const rejected = await tx.goods_receiving_notes.findUniqueOrThrow({
        where: { id },
        include: this.getFullInclude(),
      });

      // Revert PO item received quantities (Phase 4b: PO-less GRN items have no poItemId). Same ACTUAL
      // figure createGRN added.
      for (const item of grnItems) {
        if (!item.poItemId) continue;
        await tx.purchase_order_items.update({
          where: { id: item.poItemId },
          data: {
            receivedQuantity: {
              decrement: foldActual(item.receivedQuantity, item.foldLengthCm).toNumber(),
            },
          },
        });
      }

      return rejected;
    });

    // Update PO status (skip for PO-less JWO GRNs)
    if (grn.poId) {
      await purchaseOrderService.updateReceivingStatus(grn.poId);
    }

    return updatedGRN;
  }

  /**
   * Get receiving summary by warehouse for a PO
   */
  async getReceivingSummaryByPO(poId: string) {
    // Note: Full implementation requires warehouseId on GRN
    // For now, return basic summary without warehouse breakdown
    const grns = await prisma.goods_receiving_notes.findMany({
      where: {
        poId,
        status: GRNStatus.ACCEPTED,
      },
      include: {
        grn_items: true,
      },
    });

    let totalReceived = 0;
    for (const grn of grns) {
      for (const item of grn.grn_items) {
        totalReceived += grnLineActualQty(item).toNumber();
      }
    }

    return {
      totalReceived,
      grnCount: grns.length,
      byWarehouse: [], // To be implemented when warehouseId is added to GRN schema
    };
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Get full include for GRN queries
   */
  private getFullInclude() {
    return {
      purchase_orders: {
        select: {
          id: true,
          poNumber: true,
          supplierId: true,
          expectedDeliveryDate: true,
          status: true,
          poCategory: true,
        },
      },
      // Where it was booked (the ACTUAL place)
      warehouses: { select: { id: true, warehouseCode: true, warehouseName: true } },
      // Split delivery: the PO's planned place this receipt delivered against
      deliveryPoint: {
        select: { id: true, sequence: true, warehouse: { select: { id: true, warehouseName: true } } },
      },
      // Goods booked at a processor's unit: the Rule 45 challan raised for them (Phase 2)
      directSupplyChallans: {
        select: { id: true, challanNumber: true, status: true, issuedDate: true, toName: true },
      },
      // Phase 4b: PO-less GRNs identify by their Job Work Order
      jobWorkOrder: {
        select: {
          id: true,
          jobWorkNumber: true,
          processType: true,
        },
      },
      suppliers: {
        select: {
          id: true,
          code: true,
          name: true,
          contactPerson: true,
          email: true,
          phone: true,
        },
      },
      grn_items: {
        include: {
          materials: {
            select: {
              id: true,
              code: true,
              name: true,
              materialType: true,
              unit: true,
            },
          },
          purchase_order_items: {
            select: {
              id: true,
              orderedQuantity: true,
              receivedQuantity: true,
              unit: true,
              unitPrice: true,
            },
          },
          grn_item_details: {
            orderBy: [{ baleNumber: Prisma.SortOrder.asc }, { sequenceNo: Prisma.SortOrder.asc }],
          },
        },
      },
      users_goods_receiving_notes_receivedByIdTousers: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      users_goods_receiving_notes_approvedByIdTousers: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    };
  }
  /**
   * Get processing context for a PROCESSING PO (for GRN form pre-population)
   */
  async getProcessingContext(poId: string) {
    const po = await prisma.purchase_orders.findUnique({
      where: { id: poId },
      select: { id: true, poCategory: true },
    });

    if (!po || po.poCategory !== 'PROCESSING') {
      throw new Error('Not a PROCESSING PO');
    }

    const job = await prisma.job_work_orders.findFirst({
      where: { purchaseOrderId: poId },
      include: {
        style: { select: { id: true, styleCode: true, buyerStyleRef: true, styleName: true } },
        fabric: { select: { id: true, fabricCode: true, fabricName: true } },
        processor: { select: { id: true, name: true, code: true } },
        greigeStockLot: { select: { id: true, quantityAvailable: true, purchaseCost: true } },
      },
    });

    if (!job) {
      throw new Error('No job work order linked to this PROCESSING PO');
    }

    return {
      jobId: job.id,
      processType: job.processType,
      qtySentMeters: Number(job.qtySentMeters),
      sentWidthInches: Number(job.sentWidthInches),
      sentDate: job.sentDate,
      expectedReturnDate: job.expectedReturnDate,
      styleName: job.style?.styleName || '',
      styleCode: job.style?.styleCode || '',
      buyerStyleRef: job.style?.buyerStyleRef ?? null,
      fabricName: job.fabric?.fabricName || '',
      fabricCode: job.fabric?.fabricCode || '',
      processorName: job.processor?.name || '',
      agreedRate: Number(job.agreedRatePerMeter),
      greigeStockLotId: job.greigeStockLotId,
      jwoStatus: job.jwoStatus,
      receivedDate: job.receivedDate,
    };
  }

  // BUG-GRN6 fix: Comprehensive GRN reversal for ACCEPTED GRNs
  /**
   * Reverse an accepted GRN - fully reverses all stock and transaction entries
   * Only works for ACCEPTED or PARTIALLY_ACCEPTED GRNs
   *
   * Reverses:
   * - GRN status -> REVERSED
   * - PO item received quantities (decremented)
   * - Stock movements (creates reverse STOCK_OUT movements)
   * - Stock levels (decremented)
   * - Specialized stock tables (greige_stock, fabric_stock, etc.)
   * - MRP received quantities
   * - Processing PO specific: job_work_orders, challans, processor greige_stock
   * - Ledger/transaction entries for audit trail
   */
  async reverseGRN(id: string, userId: string, reason: string) {
    const grn = await prisma.goods_receiving_notes.findUnique({
      where: { id },
      include: {
        grn_items: {
          include: {
            purchase_order_items: true,
            materials: {
              include: {
                greige_master: true,
                fabric_master: true,
                lace_master: true,
                thread_master: true,
                button_master: true,
                zipper_master: true,
                elastic_master: true,
                label_master: true,
                packaging_master: true,
                machine_part_master: true,
                other_material_master: true,
              },
            },
          },
        },
        purchase_orders: {
          select: { id: true, poNumber: true, poCategory: true, supplierId: true, status: true },
        },
      },
    });

    if (!grn) {
      throw new Error('GRN not found');
    }

    // Only ACCEPTED or PARTIALLY_ACCEPTED GRNs can be reversed
    // BUG-GRN6 fix: Use string literals for status check (works before/after migration)
    const reversibleStatuses = ['ACCEPTED', 'PARTIALLY_ACCEPTED'] as const;
    if (!reversibleStatuses.includes(grn.status as (typeof reversibleStatuses)[number])) {
      throw new Error(
        `Cannot reverse GRN in ${grn.status} status. Only ACCEPTED or PARTIALLY_ACCEPTED GRNs can be reversed.`
      );
    }

    const warehouseId = grn.warehouseId;
    if (!warehouseId) {
      throw new Error('GRN has no warehouse assigned - cannot determine which stock to reverse');
    }

    const po = grn.purchase_orders;

    // A short-closed PO is a settled answer: "this is all that ever arrived". Reversing a receipt
    // under it would re-open receipt history and contradict the shortQuantity already recorded on
    // its requirements. Re-opening the PO is a deliberate decision, never a side effect.
    if (po?.status === 'SHORT_CLOSED') {
      throw new BusinessError(
        `Cannot reverse GRN ${grn.grnNumber}: purchase order ${po.poNumber} is closed short, so its ` +
          `delivered quantity is already settled and the shortfall recorded against the requirements. ` +
          `Undoing this receipt is an administrator correction, not a screen action.`
      );
    }

    // Execute reversal in a transaction
    const reversedGRN = await prisma.$transaction(
      async (tx) => {
        // 1. GUARDED status flip - prevent concurrent reversal
        // BUG-GRN6 fix: Use string literal for REVERSED status (works before/after migration)
        const flip = await tx.goods_receiving_notes.updateMany({
          where: { id, status: { in: reversibleStatuses as unknown as GRNStatus[] } },
          data: {
            status: 'REVERSED' as GRNStatus, // Type assertion for pre-migration compatibility
            remarks: grn.remarks
              ? `${grn.remarks}\n\n[REVERSED ${new Date().toISOString()}] Reason: ${reason}`
              : `[REVERSED ${new Date().toISOString()}] Reason: ${reason}`,
          },
        });
        if (flip.count === 0) {
          throw new Error('GRN is no longer in reversible status - it was already reversed or modified');
        }

        const reversed = await tx.goods_receiving_notes.findUniqueOrThrow({
          where: { id },
          include: this.getFullInclude(),
        });

        // 2. Process each GRN item for reversal
        for (const item of grn.grn_items) {
          const acceptedQty = grnLineActualQty(item).toNumber();
          // What approval booked into stock — recorded on the line since 2026-09-26; older lines recompute
          const stock = grnLineStock(item);
          const stockQty = item.stockQuantity != null ? Number(item.stockQuantity) : stock.qty;

          // 2a. Revert PO item received quantities (the PO unit — gross)
          if (item.poItemId && acceptedQty > 0) {
            await tx.purchase_order_items.update({
              where: { id: item.poItemId },
              data: {
                receivedQuantity: { decrement: acceptedQty },
              },
            });

            // 2b. Revert MRP received quantity (stock units — requirement links count pieces)
            await mrpService.updateReceivedQuantity(item.poItemId, -stockQty, tx);
          }

          // 2c. Create reverse stock movement for audit trail. Not for a job-work return: it wrote no
          // STOCK_IN — its lot row IS the receipt, and step 4 deletes that lot. An out-row here has no
          // in-row to cancel, and the fabric Material Ledger folds it into the oldest surviving lot as a
          // phantom "adjustment out" (found reversing DJ-ESSKY076LS-001's duplicates, 2026-09-25).
          const isJobWorkReturn = !grn.poId && !!grn.jobWorkOrderId;
          if (acceptedQty > 0 && !isJobWorkReturn) {
            const unitPrice = item.purchase_order_items ? Number(item.purchase_order_items.unitPrice) : 0;
            const totalValue = roundToCent(multiplyCurrency(acceptedQty, unitPrice)).toNumber();

            await tx.stock_movements.create({
              data: {
                id: randomUUID(),
                movementType: MovementType.STOCK_OUT,
                // The row approval booked it on — a packed thread line's pack row
                materialId: await grnLineStockMaterialId(tx, item),
                warehouseId: warehouseId,
                supplierId: grn.supplierId,
                quantity: stockQty,
                unit: stock.unit,
                referenceType: 'MANUAL_ADJUSTMENT', // GRN reversal adjustment
                referenceId: grn.id,
                referenceNumber: grn.grnNumber,
                rate: stock.rate,
                value: totalValue,
                remarks: `Stock reversed from GRN ${grn.grnNumber} - Reason: ${reason}`,
                performedById: userId,
                movementDate: new Date(),
              },
            });
          }
        }

        // 3. Reverse specialized stock based on PO category
        await this.reverseSpecializedStockInTx(tx, grn, po, userId, warehouseId, reason);

        // 4. Handle Processing PO specific reversal (Phase 4b: also PO-less JWO GRNs)
        if (po?.poCategory === 'PROCESSING' || (!grn.poId && grn.jobWorkOrderId)) {
          await this.reverseProcessingGRNInTx(tx, grn, po ?? null, userId, reason);
          // Phase 4b: mirror the MRP receipt decrement for JWO-keyed GRNs
          if (!grn.poId && grn.jobWorkOrderId) {
            const totalAccepted = (grn.grn_items || []).reduce(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (sum: number, i: any) => sum + grnLineActualQty(i).toNumber(),
              0
            );
            if (totalAccepted > 0) {
              await mrpService.updateJwoReceivedQuantity(grn.jobWorkOrderId, -totalAccepted, tx);
              // Phase 5a: symmetric reversal for service-requirement links (no-op without links)
              await updateWosrReceivedQuantity(grn.jobWorkOrderId, -totalAccepted, tx);
            }
          }
        }

        return reversed;
      },
      { timeout: 30000, maxWait: 10000 }
    );

    // Recompute PO receiving status (best-effort post-commit; PO-less GRNs have none)
    if (grn.poId) {
      try {
        await purchaseOrderService.updateReceivingStatus(grn.poId);
      } catch (statusErr) {
        logError('Failed to recompute PO receiving status after GRN reversal', statusErr);
      }
    }

    logInfo(`GRN reversed: ${grn.grnNumber}`, {
      grnId: id,
      reason,
      reversedBy: userId,
      itemCount: grn.grn_items.length,
    });

    return reversedGRN;
  }

  /**
   * Phase 4b: create a GRN against a Job Work Order with no purchase order.
   * Only for PO-less JWOs (wizard-created / post-4c) — PO-backed JWOs must go
   * through the normal PO receiving flow to keep a single receipt path per order.
   */
  async createGRNFromJWO(
    data: {
      jobWorkOrderId: string;
      qtyReceivedMeters?: number;
      receivedWidthInches?: number;
      thanCount?: number;
      foldLengthCm?: number;
      receivedChallan?: string;
      /** The date the goods came back — becomes the GRN date, the job's receivedDate and the inward challan date. */
      receivedDate?: string | null;
      invoiceNumber?: string;
      invoiceDate?: string;
      warehouseId?: string;
      /**
       * false = one delivery of several: the job goes PARTIALLY_RECEIVED and stays receivable.
       * true (default) = the last delivery: the job closes on the cumulative total. A lone full
       * receipt posts nothing and behaves exactly as before parts existed (2026-09-19).
       */
      isFinal?: boolean;
      /**
       * A closing receipt that leaves the total short beyond the tolerance is a SHORT CLOSE and is
       * refused unless this is true — the caller has asked "nothing more is coming?" and been told yes.
       */
      shortCloseConfirmed?: boolean;
      remarks?: string;
      // Entry mode for bale/than tracking
      entryMode?: 'TOTAL_METERS' | 'THAN_WISE' | 'BALE_WISE' | 'ROLL_WISE';
      details?: Array<{
        detailType: 'THAN' | 'ROLL';
        baleNumber?: number | null;
        sequenceNo: number;
        meters: number;
        remarks?: string | null;
      }>;
      /** The Receive dialog's per-opening key, stored on the receipt (unique) — see receiveJwoToStock. */
      submissionKey?: string | null;
    },
    userId: string,
    // `tx`: join a caller's transaction (receiveJwoToStock). `acceptedBy`: file the row ACCEPTED at
    // birth — the one-action receipt never has a PENDING_QC moment a user could leave it in.
    opts?: { tx?: Prisma.TransactionClient; acceptedBy?: string }
  ) {
    // Every read and write below goes through the caller's transaction. receiveJwoToStock row-locks
    // the job first: a read on the global client would see figures the lock was taken to protect,
    // and a write on it (the finished-fabric stamp) would wait on that lock until the transaction
    // timed out.
    const client = opts?.tx ?? prisma;
    // Same include as approval (JWO_GRN_INCLUDE) so creation can see every lineage rung approval
    // will — the two sites must never load different views of the job.
    const jwo = await client.job_work_orders.findUnique({
      where: { id: data.jobWorkOrderId },
      include: JWO_GRN_INCLUDE,
    });
    // Every refusal below is something the person at the door can act on, so each is a
    // BusinessError (422, message shown). As plain Errors they surfaced as a masked 500 —
    // "An unexpected error occurred" — which told the user nothing (2026-09-19).
    if (!jwo) {
      throw new BusinessError('Job work order not found');
    }
    if (jwo.purchaseOrderId) {
      throw new BusinessError(
        `${jwo.jobWorkNumber} is linked to a purchase order — receive it through the normal PO GRN flow`
      );
    }
    // Landmine №1 fix: a cancelled job's material was already credited back to stock —
    // receiving its physical return would double-count it (policy: block, office re-opens
    // the job if the return is genuine).
    if (isJwoDead(jwo.jwoStatus)) {
      throw new BusinessError(
        `${jwo.jobWorkNumber} is ${jwo.jwoStatus?.toLowerCase()} — its stock was already credited back. ` +
          `If the mill physically returned material, contact the office to re-open the job first.`
      );
    }
    if (jwo.receivedDate) {
      throw new BusinessError(`${jwo.jobWorkNumber} has already been received`);
    }
    if (!JWO_AT_PROCESSOR_STATUSES.includes(jwo.jwoStatus!)) {
      throw new BusinessError(`Cannot receive ${jwo.jobWorkNumber}: status is ${jwo.jwoStatus}, expected at-processor`);
    }
    // Phase 5a (D6): GRN receiving is fabric/meters-shaped; piece-based job work
    // (embroidery/handwork/smocking/kaaj) is received on the JWO itself.
    if (!JWO_GRN_UOMS.includes(jwo.uom)) {
      throw new BusinessError(
        `${jwo.jobWorkNumber} is piece-based (${jwo.uom}) — receive it from the Job Work Order's Receive action, not a GRN`
      );
    }

    // A return cannot be dated before the day the greige went out (the owner's first receipt was
    // dated 27-Aug on a job sent 19-Sep — nothing refused it). Calendar-day compare, UTC.
    if (data.receivedDate && jwo.sentDate) {
      const day = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      const received = new Date(data.receivedDate);
      if (!Number.isNaN(received.getTime()) && day(received) < day(new Date(jwo.sentDate))) {
        const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const fmtDay = (d: Date) =>
          `${String(d.getUTCDate()).padStart(2, '0')}-${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
        throw new BusinessError(
          `Date received ${fmtDay(received)} is before the day the greige was sent (${fmtDay(new Date(jwo.sentDate))})`
        );
      }
    }

    // Quantity: the processor's COUNTED figure — from the than/bale rows, or typed. At fold L the
    // ACTUAL metres (what enters stock and every counter below) are counted × L/100.
    const entryMode = data.entryMode ?? 'TOTAL_METERS';
    const hasDetails = data.details && data.details.length > 0;
    let qtyReceived = data.qtyReceivedMeters || 0;
    let thanCount = data.thanCount ?? null;

    if (hasDetails && (entryMode === 'THAN_WISE' || entryMode === 'BALE_WISE')) {
      // Sum meters from detail rows
      qtyReceived = data.details!.reduce((sum, d) => sum + (d.meters || 0), 0);
      thanCount = data.details!.length;
    }
    if (qtyReceived <= 0) {
      throw new BusinessError('Received quantity must be greater than 0');
    }
    const folded = hasFold(data.foldLengthCm);
    const actualReceived = foldActual(qtyReceived, data.foldLengthCm).toNumber();
    const receivedText = folded
      ? `${qtyReceived} MTR counted @ L=${data.foldLengthCm} (= ${actualReceived.toFixed(2)} MTR)`
      : `${qtyReceived} MTR`;

    // Expected FABRIC due back (billable = sent × (1 − shrinkage)) — the GRN's
    // "ordered" basis. The greige sent is NOT the expectation: measuring receipts
    // against it hid over-receipts up to sent × (1 + tolerance).
    const expectedFabricMeters =
      jwo.qtyBillable != null
        ? Number(jwo.qtyBillable)
        : toNumber(roundToCent(applyShrinkageLoss(jwo.qtySentMeters, jwo.expectedShrinkage ?? 0)));

    // Over-receipt cap (this path previously had NONE — the PO path caps at :86). CUMULATIVE: a
    // return may come in parts, and the cap is on everything received against the job, so the
    // message names what is already in when there is any.
    const overReceiptTolerance = await systemSettingsService.getNumberDefault('GRN_OVER_RECEIPT_TOLERANCE_PERCENT');
    const maxReceivable = toNumber(roundToCent(multiplyCurrency(expectedFabricMeters, 1 + overReceiptTolerance / 100)));
    const receivedSoFar = Number(jwo.qtyReceivedMeters ?? 0);
    // Quantity rule (utils/quantity): over the cap by rounding dust is not over (0% tolerance setting).
    if (qtyExceeds(receivedSoFar + actualReceived, maxReceivable)) {
      throw new BusinessError(
        (receivedSoFar > 0
          ? `Received ${receivedText} on top of the ${receivedSoFar.toFixed(2)} MTR already received `
          : `Received ${receivedText} `) +
          `exceeds the expected fabric ${expectedFabricMeters.toFixed(2)} MTR ` +
          `plus ${overReceiptTolerance}% over-receipt tolerance (max ${maxReceivable.toFixed(2)} MTR)`
      );
    }

    // A receipt that CLOSES the job while the total is short beyond the tolerance is a SHORT CLOSE,
    // and a short close must be said out loud. The owner's first real receipt (852.10 of 1,686.59 m)
    // went in as final by an unintended tick and locked the second delivery out (2026-09-19); the
    // same rule refuses a stale client that posts no isFinal at all. Same pure function and the same
    // tolerance precedence (job → process type → 0) as the preview and applyLossSplit — nothing is
    // re-derived here. Sits before the mint below so a refusal writes nothing.
    if ((data.isFinal ?? true) && !data.shortCloseConfirmed) {
      const cumulative = toNumber(roundToCent(addCurrency(receivedSoFar, actualReceived)));
      let split: ReturnType<typeof jobWorkOrderService.calculateLossSplit>;
      try {
        split = jobWorkOrderService.calculateLossSplit({
          qtySent: jwo.qtySentMeters,
          qtyReceived: cumulative,
          qtyExpected: jwo.qtyBillable,
          expectedShrinkagePercent: jwo.expectedShrinkage,
          tolerancePercent: Number(jwo.tolerancePercent ?? jwo.processTypeMaster?.tolerancePercent ?? 0),
          ratePerMeter: jwo.agreedRatePerMeter,
        });
      } catch (splitError) {
        throw new BusinessError(
          splitError instanceof Error ? splitError.message : 'Could not work out the loss split for this receipt'
        );
      }
      if (split.isOverTolerance) {
        const uom = jwo.uom;
        const processorName = jwo.processor?.name ?? 'the processor';
        const expected = split.qtyExpected.toNumber();
        const shortfall = split.shortfall.toNumber();
        const beyondAllowance = split.qtyAbnormalLoss.toNumber();
        const tolerancePercent = split.tolerancePercent.toNumber();
        throw new BusinessError(
          `This would close ${jwo.jobWorkNumber} short: ${cumulative.toFixed(2)} ${uom} received in total against ` +
            `${expected.toFixed(2)} ${uom} expected back from ${processorName} — ${shortfall.toFixed(2)} ${uom} short, ` +
            `${beyondAllowance.toFixed(2)} ${uom} beyond the ${tolerancePercent}% allowance. ` +
            `If more is still to come, receive this as a part (untick "This is the final delivery"). ` +
            `If nothing more is expected, confirm the short close.`,
          {
            reason: 'SHORT_CLOSE_UNCONFIRMED',
            qtyThisReceipt: actualReceived,
            cumulative,
            expected,
            shortfall,
            beyondAllowance,
            tolerancePercent,
            debitNoteAmount: split.debitNoteAmount ? split.debitNoteAmount.toNumber() : null,
          }
        );
      }
    }

    // grn_items.materialId is required, and it must name the material ARRIVING — the dyed lace
    // variant, or the finished fabric — never the greige or fabric that was SENT (the sent material
    // already left stock at issue). resolveOrMintJwoArrivingMaterial is the same authority approval
    // uses, so creation can no longer refuse a job approval would have received (2026-09-15, T0-A).
    // For a greige job whose mint was deferred (MRP does this when lineage is missing at creation)
    // it mints here and stamps it on the job so approval and every later reader find the same
    // master — inside the caller's transaction, so a receipt that fails leaves no half-stamped job.
    const arriving = await resolveOrMintJwoArrivingMaterial(jwo, {
      userId,
      source: 'AUTO_FROM_MRP_GRN',
      receivedWidthInches: data.receivedWidthInches ?? null,
      tx: opts?.tx,
    });
    if (arriving.minted) {
      await stampJwoFinishedFabric(jwo.id, arriving.id, opts?.tx);
    }
    const materialId = await ensureMaterialRecord(arriving.id, arriving.kind, opts?.tx);

    const grnNumber = await this.generateGRNNumber();
    const grn = await client.goods_receiving_notes.create({
      data: {
        id: randomUUID(),
        grnNumber,
        submissionKey: data.submissionKey ?? null,
        poId: null,
        jobWorkOrderId: jwo.id,
        supplierId: jwo.processorId,
        warehouseId: data.warehouseId || null,
        receivingDate: data.receivedDate ? new Date(data.receivedDate) : new Date(),
        invoiceNumber: data.invoiceNumber || null,
        invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : null,
        status: opts?.acceptedBy ? GRNStatus.ACCEPTED : GRNStatus.PENDING_QC,
        approvedById: opts?.acceptedBy ?? null,
        remarks:
          [data.remarks, data.receivedChallan ? `Vendor challan ref: ${data.receivedChallan}` : null]
            .filter(Boolean)
            .join('\n') || null,
        receivedById: userId,
        grn_items: {
          create: [
            {
              id: randomUUID(),
              poItemId: null,
              materialId,
              // Expected fabric due back (billable basis), not the greige sent
              orderedQuantity: expectedFabricMeters,
              // Counted figures as the processor's paper has them; actualQuantity is what enters stock.
              receivedQuantity: qtyReceived,
              acceptedQuantity: qtyReceived,
              rejectedQuantity: 0,
              actualQuantity: folded ? actualReceived : null,
              unit: Unit.METER,
              receivedWidthInches: data.receivedWidthInches ?? null,
              thanCount,
              foldLengthCm: data.foldLengthCm ?? null,
              totalMeters: qtyReceived,
              entryMode,
              // Detail rows for THAN_WISE / BALE_WISE entry
              ...(hasDetails
                ? {
                    grn_item_details: {
                      create: data.details!.map((d, idx) => ({
                        id: randomUUID(),
                        detailType: d.detailType,
                        baleNumber: d.baleNumber ?? null,
                        sequenceNo: d.sequenceNo ?? idx + 1,
                        meters: new Prisma.Decimal(d.meters),
                        remarks: d.remarks ?? null,
                      })),
                    },
                  }
                : {}),
            },
          ],
        },
      },
      include: this.getFullInclude(),
    });

    logInfo('PO-less JWO GRN created', {
      grnId: grn.id,
      grnNumber,
      jobWorkOrderId: jwo.id,
      jobWorkNumber: jwo.jobWorkNumber,
      qtyReceived,
      actualReceived,
    });
    return grn;
  }

  /**
   * One action: receive processed material against a job work order and book it (2026-09-19).
   *
   * The receipt row is filed ALREADY ACCEPTED, and the stock lot, the inward challan, the loss
   * split and the MRP advance are written in the same transaction. There is no PENDING_QC moment,
   * which is how "saved but not in stock" used to happen. The receipt row stays because the GST
   * input-credit report and the printed "Job work return" read it — not because stock needs it.
   *
   * createGRNFromJWO runs its own guards, quantity derivation, over-receipt cap and the
   * finished-fabric mint before the create: a refusal leaves no row, and a minted master is the
   * same harmless catalog row the two-step path already tolerated.
   *
   * One delivery, one receipt — however many times it is sent (2026-09-25: a stalled server answered
   * the first press "Response timeout" while still working, the user pressed again, and six receipts
   * were filed for DJ-ESSKY076LS-001 — each had read "0 received so far"). Two guards:
   *   - the job row is locked first, so receipts for one job run one at a time and each reads the
   *     totals the previous one committed — the over-receipt cap, the "already received" guard and
   *     the running total are never stale;
   *   - `submissionKey` (the dialog's per-opening key, unique on the receipt): the same submission
   *     arriving again returns the receipt it already filed, `replayed: true`, and books nothing. Only
   *     the key tells a repeated PART from a genuine second part — two parts can both fit the cap.
   */
  async receiveJwoToStock(
    data: Parameters<typeof grnService.createGRNFromJWO>[0] & {
      warehouseId: string;
      processingQC?: ProcessingQCData;
      /** Phase 4d: the processor delivered the finished goods straight to the processor whose unit this is */
      deliveredToProcessor?: boolean;
      vehicleNumber?: string | null;
    },
    userId: string
  ) {
    const warehouse = await prisma.warehouses.findUnique({
      where: { id: data.warehouseId },
      select: {
        id: true,
        isActive: true,
        warehouseType: true,
        warehouseName: true,
        supplierId: true,
        supplier: { select: { name: true } },
      },
    });
    if (!warehouse || !warehouse.isActive) {
      throw new BusinessError('Invalid or inactive warehouse');
    }
    // Delivered straight to the next processor (Phase 4d): the lot is booked at B's unit and A → B is
    // challaned below, in the same transaction. Refused before anything is written when it cannot be.
    const job = await prisma.job_work_orders.findUnique({
      where: { id: data.jobWorkOrderId },
      select: { processorId: true, jobWorkNumber: true, fabricType: true, processor: { select: { name: true } } },
    });
    const nextProcessor = job
      ? resolveNextProcessorUnit(
          warehouse,
          { processorId: job.processorId, processorName: job.processor?.name ?? 'the processor' },
          data.deliveredToProcessor === true
        )
      : null;

    const submissionKey = data.submissionKey || null;
    const alreadyFiled = async (client: Prisma.TransactionClient | typeof prisma) => {
      if (!submissionKey) return null;
      const existing = await client.goods_receiving_notes.findUnique({
        where: { submissionKey },
        include: this.getFullInclude(),
      });
      if (existing && existing.jobWorkOrderId !== data.jobWorkOrderId) {
        // A key is minted per dialog opening, so this is never a retry — refuse rather than answer
        // with another job's receipt.
        throw new BusinessError(
          'This submission was already used for a different job. Close the dialog and open it again.'
        );
      }
      return existing;
    };

    let result: { grn: Awaited<ReturnType<GRNService['createGRNFromJWO']>>; replayed: boolean };
    try {
      result = await prisma.$transaction(
        async (tx) => {
          // FIRST: a second submit for this job waits here until the first commits.
          await lockJobWorkOrder(tx, data.jobWorkOrderId);
          const existing = await alreadyFiled(tx);
          if (existing) return { grn: existing, replayed: true };

          const created = await this.createGRNFromJWO(data, userId, { tx, acceptedBy: userId });
          await this.approvePolessJwoGrnInTx(tx, created, data.processingQC, data.warehouseId, userId, created.id, {
            isFinal: data.isFinal ?? true,
          });
          if (nextProcessor && job?.processorId && created.grn_items?.[0]?.id) {
            await sendReceiptOnToProcessor(tx, {
              grnId: created.id,
              grnNumber: created.grnNumber,
              grnItemId: created.grn_items[0].id,
              lotType: job.fabricType === 'LACE' ? 'LACE' : 'FABRIC',
              fromProcessorId: job.processorId,
              fromName: job.processor?.name ?? 'the processor',
              jobWorkNumber: job.jobWorkNumber,
              to: nextProcessor,
              receivedAt: created.receivingDate ? new Date(created.receivingDate) : new Date(),
              userId,
              vehicleNumber: data.vehicleNumber ?? null,
            });
          }
          return { grn: created, replayed: false };
        },
        { timeout: 30000, maxWait: 10000 }
      );
    } catch (err) {
      // Belt and braces: the lock already serialises one job's submits, so a clash on the unique key
      // means a twin committed first. Answer with its receipt instead of an error.
      const existing =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002' ? await alreadyFiled(prisma) : null;
      if (!existing) throw err;
      result = { grn: existing, replayed: true };
    }
    const { grn, replayed } = result;

    // The split applyLossSplit wrote inside the transaction — returned so the dialog can say
    // "abnormal loss, debit note needed" the moment it commits, as the piece-work receive does.
    const jwo = await prisma.job_work_orders.findUniqueOrThrow({
      where: { id: data.jobWorkOrderId },
      select: {
        jobWorkNumber: true,
        qtyNormalLoss: true,
        qtyAbnormalLoss: true,
        tolerancePercent: true,
        actualShrinkage: true,
      },
    });

    // Delivered straight to the next processor: the A → B challan filed with this receipt (a replay
    // answers with the one the first submission filed)
    const onwardChallan = await prisma.challans.findFirst({
      where: { grnId: grn.id, challanType: 'OUTWARD', status: { not: 'CANCELLED' } },
      select: { id: true, challanNumber: true, toName: true },
    });

    logInfo(
      replayed
        ? 'Job-work receipt submitted again — answered with the receipt already filed, nothing booked'
        : onwardChallan
          ? 'Job-work receipt delivered straight to the next processor — booked there and challaned in one action'
          : 'Job-work receipt booked to stock in one action',
      {
        grnId: grn.id,
        grnNumber: grn.grnNumber,
        jobWorkNumber: jwo.jobWorkNumber,
        ...(onwardChallan ? { onwardChallan: onwardChallan.challanNumber } : {}),
      }
    );
    return { grn, jwo, replayed, onwardChallan };
  }

  /**
   * Phase 4b: approve a PO-less GRN keyed on a Job Work Order.
   * Mirrors the PROCESSING approval semantics: derive/reuse the finished fabric,
   * create fabric_stock at (processing rate + source greige cost), stamp the JWO,
   * and advance MRP requirements through requirement_jwo_links.
   */
  private async approvePolessJwoGrnInTx(
    tx: Prisma.TransactionClient,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    grn: any,
    processingQC: ProcessingQCData | undefined,
    targetWarehouseId: string | null,
    userId: string,
    grnId: string,
    // Parts (2026-09-19): every receipt books its own lot and inward challan; only the FINAL one
    // closes the job. The two-step approve path passes nothing and gets the closing behaviour.
    opts: { isFinal: boolean } = { isFinal: true }
  ): Promise<void> {
    // Same include as creation (JWO_GRN_INCLUDE): identity lineage + cost basis in one view.
    const jobWorkOrder = await tx.job_work_orders.findUnique({
      where: { id: grn.jobWorkOrderId },
      include: JWO_GRN_INCLUDE,
    });
    if (!jobWorkOrder) {
      throw new Error(`Job work order ${grn.jobWorkOrderId} not found for PO-less GRN approval`);
    }
    // Landmine №1 fix: re-check on the freshly-read row — a JWO cancelled between GRN
    // creation and approval must not sail through and mint stock that was already
    // credited back at cancel time.
    if (isJwoDead(jobWorkOrder.jwoStatus)) {
      throw new Error(
        `${jobWorkOrder.jobWorkNumber} was ${jobWorkOrder.jwoStatus?.toLowerCase()} after this GRN was created — ` +
          `its stock was already credited back. Reject this GRN, or re-open the job first.`
      );
    }

    const grnItem = grn.grn_items?.[0];
    // ACTUAL metres (the counted figure converted at the line's fold length) — what enters stock.
    const qtyReceived = grnItem
      ? grnLineActualQty({
          acceptedQuantity: grnItem.acceptedQuantity || grnItem.receivedQuantity || 0,
          foldLengthCm: grnItem.foldLengthCm,
        }).toNumber()
      : 0;
    // Measured finished width from the GRN item. Stock falls back measured → asked →
    // greige band; only the measured value is stamped onto the JWO / baked into the name.
    const receivedWidthProvided = grnItem?.receivedWidthInches != null ? Number(grnItem.receivedWidthInches) : null;
    if (qtyReceived <= 0) {
      // Never return quietly here: the caller would commit the GRN as ACCEPTED with no stock lot,
      // no JWO status change and no MRP callback — a receipt the user is told succeeded while
      // fabric_stock stays empty. That is the failure 623b42cf removed from the rest of this path.
      throw new BusinessError(
        `${jobWorkOrder.jobWorkNumber} cannot be approved: this receipt records no quantity, so there ` +
          `is nothing to book into stock. Reject this GRN and create a new one with the metres actually received.`
      );
    }
    // ---- LACE: the dyed variant arrives as lace_stock, and no fabric is minted -----------------
    if (jobWorkOrder.fabricType === 'LACE') {
      await this.approveLaceJwoGrnInTx(tx, jobWorkOrder, processingQC, targetWarehouseId, userId, grnId, qtyReceived, {
        grnItemId: grnItem?.id ?? null,
        receivedAt: grn.receivingDate ? new Date(grn.receivingDate) : new Date(),
        isFinal: opts.isFinal,
      });
      return;
    }

    const receivedWidth = await resolveStockWidthInches(jobWorkOrder, receivedWidthProvided, tx);

    // Phase 5b: fabric-lot JWOs (embroidery on a finished roll) keep the SAME fabric master —
    // the result lot is differentiated by embroideryId, not a new fabric (legacy parity).
    const isFabricLotJwo = isFabricLotReprocessingJwo(jobWorkOrder);

    // Finished fabric: the same authority creation used. It reuses the JWO's, mints from greige
    // lineage when the JWO carries none, and THROWS when nothing is resolvable. Until 2026-09-15
    // this site logged a warning and returned — leaving the GRN ACCEPTED with no fabric_stock, no
    // status update and no MRP callback, which the user saw as a successful receipt (T0-B).
    const arriving = await resolveOrMintJwoArrivingMaterial(jobWorkOrder, {
      userId,
      source: 'AUTO_FROM_MRP_GRN',
      receivedWidthInches: receivedWidthProvided,
      tx,
    });
    const identity = arriving.identity;
    const finishedFabricId = arriving.id;
    if (!arriving.minted && !isFabricLotJwo) {
      // Master minted at JWO creation: follow the measured width (columns + AUTO name)
      // and make sure the style link exists even when the mint predates it
      if (receivedWidthProvided != null) {
        await rebuildAutoFabricName(finishedFabricId, receivedWidthProvided, tx);
      }
      await stampStyleFabricLink(identity?.styleFabricId, finishedFabricId, tx);
    }

    // Cost: processing rate + source cost per meter (greige purchase cost, or the
    // fabric lot's WAC for fabric-roll embroidery — legacy embroidery-receive parity)
    const processingRate = Number(
      processingQC?.actualRate ?? jobWorkOrder.actualRate ?? jobWorkOrder.agreedRatePerMeter ?? 0
    );
    // Multi-lot issues record their split on components — source cost is then the
    // qty-weighted average of the component lots' purchase costs
    const greigeComponents = await tx.job_work_order_components.findMany({
      where: { jobWorkOrderId: jobWorkOrder.id, materialType: 'GREIGE', greigeStockId: { not: null } },
      select: { qtySent: true, rateAtIssue: true, rate: true },
    });
    let weightedGreigeCost: number | null = null;
    if (greigeComponents.length > 0) {
      let valueSum = toCurrency(0);
      let qtySum = toCurrency(0);
      for (const c of greigeComponents) {
        const rate = c.rateAtIssue ?? c.rate;
        if (rate == null) continue;
        valueSum = addCurrency(valueSum, multiplyCurrency(Number(c.qtySent), Number(rate)));
        qtySum = addCurrency(qtySum, Number(c.qtySent));
      }
      if (toNumber(qtySum) > 0) {
        weightedGreigeCost = toNumber(roundToCent(divideCurrency(valueSum, qtySum)));
      }
    }
    const sourceCost = isFabricLotJwo
      ? Number(jobWorkOrder.fabricStockLot?.weightedAvgCost ?? 0)
      : (weightedGreigeCost ??
        (jobWorkOrder.greigeStockLot?.purchaseCost ? Number(jobWorkOrder.greigeStockLot.purchaseCost) : 0));
    const totalCostPerMeter = roundToCent(addCurrency(processingRate, sourceCost)).toNumber();
    const widthDeduction = await systemSettingsService.getCutableWidthDeductionInches();
    const cutableWidth = receivedWidth > widthDeduction ? receivedWidth - widthDeduction : receivedWidth;
    // The date the user gave at creation (the GRN header), not the moment of approval. Reversal
    // finds the lot by grnItemId; the date match is only the fallback for lots booked before
    // that column existed.
    const receivedAt = grn.receivingDate ? new Date(grn.receivingDate) : new Date();
    // Dyed / printed fabric is the same cloth: it keeps the weaver of the greige lot(s) the job drew.
    const weaverLineage = await weaverOfJobSource(
      tx,
      {
        id: jobWorkOrder.id,
        greigeStockLotId: jobWorkOrder.greigeStockLotId ?? null,
        fabricStockLotId: jobWorkOrder.fabricStockLotId ?? null,
      },
      isFabricLotJwo
    );

    await tx.fabric_stock.create({
      data: {
        id: randomUUID(),
        fabricId: finishedFabricId,
        finishedWidth: receivedWidth,
        cutableWidth,
        quantityAvailable: qtyReceived,
        quantityReserved: 0,
        quantityConsumed: 0,
        unit: 'meters',
        originStyleId: jobWorkOrder.style?.id || null,
        // Fabric-naming: pattern part from the BOM→CAD chain (feeds part display + needsEmbroidery)
        patternPartId: identity?.patternPartId ?? null,
        status: 'AVAILABLE',
        stockType: 'PLANNED_STOCK',
        fabricFinishType: isFabricLotJwo
          ? (jobWorkOrder.fabricStockLot?.fabricFinishType ?? 'DYED')
          : jobWorkOrder.processType === 'PRINTING'
            ? 'PRINTED'
            : 'DYED',
        // Phase 5b: the embroidered result lot carries the design id (legacy receive parity)
        embroideryId: isFabricLotJwo ? (jobWorkOrder.embroideryId ?? null) : null,
        weightedAvgCost: totalCostPerMeter,
        purchaseCost: totalCostPerMeter,
        qualityGrade: processingQC?.qualityGrade || DEFAULT_QUALITY_GRADE,
        defectMeters: processingQC?.defectMeters || 0,
        receivedDate: receivedAt,
        agingAlertSent: false,
        agingDays: 0,
        needsEmbroidery: false,
        createdById: userId,
        warehouseId: targetWarehouseId,
        // The receipt line this lot came from: reversal takes back THIS lot, never a sibling part's.
        grnItemId: grnItem?.id ?? null,
        weaverId: weaverLineage.weaverId,
        weaverMix: (weaverLineage.weaverMix as unknown as Prisma.InputJsonValue) ?? Prisma.DbNull,
      },
    });
    // Ensure materials record exists for pre-existing fabrics before syncing stock_levels
    await ensureMaterialRecord(finishedFabricId, 'FABRIC', tx);
    await syncStockLevelQuantity(finishedFabricId, qtyReceived, targetWarehouseId ?? undefined, 'METER', tx);

    // The PO-backed receive (~:305-395) records four things this path never did (2026-09-15):
    // actual shrinkage, than/fold on the job, and an INWARD challan — the GST document for goods
    // returning from a job worker. Created in-tx so a challan failure aborts the receive instead of
    // being swallowed. Reversal (reverseProcessingGRNInTx) cancels the challan by its grnId.
    //
    // A return may come in parts (2026-09-19). Every part books its own lot and challan, and the
    // job's figures are CUMULATIVE. Only the final part closes the job: shrinkage, the loss split
    // and receivedDate are computed once, on the total — a short first delivery is not a loss
    // until the last one is in.
    const receivedSoFar = Number(jobWorkOrder.qtyReceivedMeters ?? 0);
    const cumulativeReceived = toNumber(roundToCent(addCurrency(receivedSoFar, qtyReceived)));
    const sentMeters = Number(jobWorkOrder.qtySentMeters ?? 0);
    const actualShrinkage = sentMeters > 0 ? ((sentMeters - cumulativeReceived) / sentMeters) * 100 : 0;
    const partThanCount: number | null = grnItem?.thanCount ?? null;
    const thanCount: number | null =
      partThanCount != null || jobWorkOrder.thanCount != null
        ? (jobWorkOrder.thanCount ?? 0) + (partThanCount ?? 0)
        : null;
    const foldLengthCm: number | null =
      grnItem?.foldLengthCm != null
        ? Number(grnItem.foldLengthCm)
        : jobWorkOrder.foldLengthCm != null
          ? Number(jobWorkOrder.foldLengthCm)
          : null;
    // qtyReceived is already actual (converted at the part's own L), so the running total is too.
    // Recorded whenever a fold length is (L=100 included); null when none was given.
    const calculatedActualMeters = foldLengthCm ? cumulativeReceived : null;
    const inwardChallan = await createChallan(
      {
        challanType: 'INWARD',
        challanDate: receivedAt,
        fromType: 'VENDOR',
        fromId: jobWorkOrder.processorId,
        fromName: jobWorkOrder.processor?.name || 'Processor',
        // The store the processed goods came back into — never the made-up "Main Warehouse"
        ...(await challanDestination(tx, [targetWarehouseId])),
        jobWorkOrderId: jobWorkOrder.id,
        grnId,
        issuedById: userId,
        unit: Unit.METER,
        remarks: grn.remarks || undefined,
        // The goods are in hand — this very transaction books the stock lot. Filing the arrival
        // document as DRAFT (as this did until 2026-09-21) left every completed return looking like
        // an unfinished one, which is what broke the Control Center's vendor and challan signals.
        status: 'RECEIVED',
        receivedDate: receivedAt,
        receivedById: userId,
        items: [
          {
            itemType: 'FABRIC',
            fabricId: finishedFabricId,
            description: `Processed fabric received via GRN ${grn.grnNumber} - ${formatStyleCodeWithRef(jobWorkOrder.style?.styleCode || '', jobWorkOrder.style?.buyerStyleRef)}`,
            quantity: qtyReceived,
            unit: Unit.METER,
            ...(hasFold(grnItem?.foldLengthCm) ? { foldLengthCm: Number(grnItem.foldLengthCm) } : {}),
          },
        ],
      },
      tx
    );

    // What every part writes on the job: the running total, the latest receipt and its challan.
    const receiptFields: Prisma.job_work_ordersUncheckedUpdateInput = {
      finishedFabricId,
      qtyReceivedMeters: cumulativeReceived,
      grnId,
      thanCount,
      foldLengthCm,
      calculatedActualMeters,
      inwardChallanId: inwardChallan.id,
      // Measured finished width + variance vs the asked finished width (sentWidthInches)
      ...(receivedWidthProvided != null
        ? {
            receivedWidthInches: receivedWidthProvided,
            ...(jobWorkOrder.sentWidthInches != null
              ? { widthVariance: receivedWidthProvided - Number(jobWorkOrder.sentWidthInches) }
              : {}),
          }
        : {}),
      ...(processingQC
        ? {
            qualityGrade: processingQC.qualityGrade,
            colorMatchStatus: processingQC.colorMatchStatus || null,
            defectMeters: processingQC.defectMeters ?? null,
            defectType: processingQC.defectType || null,
            actualRate: processingQC.actualRate ?? null,
          }
        : {}),
    };

    if (opts.isFinal) {
      await setJwoStatus(tx, jobWorkOrder.id, 'STOCK_UPDATED', {
        ...receiptFields,
        receivedDate: jobWorkOrder.receivedDate ?? receivedAt,
        actualShrinkage,
      });

      // Loss split (expected-output basis) on the TOTAL. This PO-less path previously skipped it,
      // so the close-time debit gate never fired for GRN-received JWOs. Best-effort.
      try {
        await jobWorkOrderService.applyLossSplit(jobWorkOrder.id, cumulativeReceived, tx);
      } catch (lossSplitError) {
        logWarn('[GRN] Loss split failed for PO-less JWO receive', {
          jobWorkOrderId: jobWorkOrder.id,
          error: lossSplitError instanceof Error ? lossSplitError.message : lossSplitError,
        });
      }
    } else {
      // More to come: no receivedDate, no shrinkage, no loss split — the job stays receivable.
      await setJwoStatus(tx, jobWorkOrder.id, 'PARTIALLY_RECEIVED', receiptFields);
    }

    // Close (or part-close) the OUTWARD challan the goods went out on. Runs AFTER setJwoStatus so
    // the job's cumulative qtyReceivedMeters is already written — the helper reconciles the challan
    // against it. Best-effort by design: a stale challan status is a reporting defect, and failing a
    // stock-booking receipt over one would be the worse outcome.
    try {
      const outwardStatus = await closeOutwardChallanForJwo(tx, jobWorkOrder.id, {
        isFinal: !!opts.isFinal,
        receivedById: userId,
        receivedAt,
      });
      if (outwardStatus) {
        logInfo('[GRN] Outward challan advanced on job-work receipt', {
          jobWorkOrderId: jobWorkOrder.id,
          status: outwardStatus,
        });
      }
    } catch (challanError) {
      logWarn('[GRN] Could not advance outward challan on job-work receipt', {
        jobWorkOrderId: jobWorkOrder.id,
        error: challanError instanceof Error ? challanError.message : challanError,
      });
    }

    // Phase 4b receipt bridge: advance MRP requirements via requirement_jwo_links
    await mrpService.updateJwoReceivedQuantity(jobWorkOrder.id, qtyReceived, tx);
    // Phase 5a: same hook for service requirements (no-ops when no links exist)
    await updateWosrReceivedQuantity(jobWorkOrder.id, qtyReceived, tx);

    logInfo('PO-less JWO GRN approved — fabric_stock created', {
      grnId,
      jobWorkOrderId: jobWorkOrder.id,
      jobWorkNumber: jobWorkOrder.jobWorkNumber,
      fabricId: finishedFabricId,
      qtyReceived,
      costPerMeter: totalCostPerMeter,
    });
  }

  /**
   * Dyed lace coming back from the dyer (2026-09-08).
   *
   * The lace twin of the fabric branch above, and deliberately much shorter: there is no width to
   * resolve, no finished master to mint or name (the dyed variant was chosen when the job was
   * raised), and no CAD/pattern-part chain. What is left is the cost of the goods and the lot.
   *
   * COST differs from the fabric path on purpose. Fabric adds processing rate to the greige rate
   * per metre, which quietly under-values cloth that shrank: you paid for every greige metre sent
   * but only got the shrunk quantity back. Lace values the lot the way the cost sheet quotes it —
   * all the greige money plus all the dyeing money, spread over what actually arrived:
   *
   *     (greige metres issued x greige cost/m + metres received x dyeing rate) / metres received
   *
   * On the canonical numbers (1,000 m greige at ₹40 dyed at ₹20, 900 m back) that is ₹64.44/m,
   * which is exactly the cost sheet's all-in — greige/(1−s) + dyeing.
   */
  private async approveLaceJwoGrnInTx(
    tx: Prisma.TransactionClient,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jobWorkOrder: any,
    processingQC: ProcessingQCData | undefined,
    targetWarehouseId: string | null,
    userId: string,
    grnId: string,
    qtyReceived: number,
    receipt: { grnItemId: string | null; receivedAt: Date; isFinal: boolean }
  ): Promise<void> {
    if (!jobWorkOrder.finishedLaceId) {
      throw new Error(
        `${jobWorkOrder.jobWorkNumber} is a lace job with no dyed variant — nothing to receive into stock`
      );
    }

    const processingRate = Number(
      processingQC?.actualRate ?? jobWorkOrder.actualRate ?? jobWorkOrder.agreedRatePerMeter ?? 0
    );

    // The LACE components are the record of what was issued and at what cost — a lace job always
    // writes them, single lot included.
    const laceComponents = await tx.job_work_order_components.findMany({
      where: { jobWorkOrderId: jobWorkOrder.id, materialType: 'LACE', laceStockId: { not: null } },
      select: { qtySent: true, rateAtIssue: true, rate: true },
    });
    let issuedValue = toCurrency(0);
    let issuedQty = toCurrency(0);
    for (const c of laceComponents) {
      const rate = c.rateAtIssue ?? c.rate;
      if (rate == null) continue;
      issuedValue = addCurrency(issuedValue, multiplyCurrency(Number(c.qtySent), Number(rate)));
      issuedQty = addCurrency(issuedQty, Number(c.qtySent));
    }
    // No priced components (a job issued outside this flow) leaves the dyeing rate as the whole
    // cost — understated, but honest about what we actually know.
    //
    // Parts (2026-09-19): a single whole receipt spreads the greige money over what arrived, as
    // above. A PART cannot — it would carry all the greige money on its own metres and the next
    // part would carry it again — so parts spread it over the metres EXPECTED back instead.
    const receivedSoFar = Number(jobWorkOrder.qtyReceivedMeters ?? 0);
    const wholeReceipt = receivedSoFar === 0 && receipt.isFinal;
    const expectedBack = Number(jobWorkOrder.qtyBillable ?? 0);
    const spreadOver = wholeReceipt || expectedBack <= 0 ? qtyReceived : expectedBack;
    const costPerMeter = toNumber(roundToCent(addCurrency(divideCurrency(issuedValue, spreadOver), processingRate)));

    // The user's receipt date (the GRN header), not the moment of the click — parts carry their
    // own dates. Reversal finds the lot by grnItemId.
    const receivedAt = receipt.receivedAt;
    const lot = await tx.lace_stock.create({
      data: {
        laceId: jobWorkOrder.finishedLaceId,
        grnItemId: receipt.grnItemId,
        originStyleId: jobWorkOrder.styleId ?? null,
        originStyleCode: jobWorkOrder.style?.styleCode ?? null,
        quantityAvailable: new Prisma.Decimal(qtyReceived),
        quantityReserved: 0,
        quantityConsumed: 0,
        unit: 'meters',
        weightedAvgCost: new Prisma.Decimal(costPerMeter),
        purchaseCost: new Prisma.Decimal(costPerMeter),
        qualityGrade: processingQC?.qualityGrade || DEFAULT_QUALITY_GRADE,
        status: 'AVAILABLE',
        stockType: 'PLANNED_STOCK',
        shadeNote: jobWorkOrder.colorName ?? null,
        receivedDate: receivedAt,
        warehouseId: targetWarehouseId,
        createdById: userId,
      },
    });
    await tx.lace_stock_transaction.create({
      data: {
        stockId: lot.id,
        transactionType: 'STOCK_IN',
        quantity: new Prisma.Decimal(qtyReceived),
        balanceAfter: new Prisma.Decimal(qtyReceived),
        referenceType: 'GRN',
        referenceId: grnId,
        notes: `Dyed lace received — ${jobWorkOrder.jobWorkNumber}`,
        performedById: userId,
      },
    });
    await ensureMaterialRecord(jobWorkOrder.finishedLaceId, 'LACE', tx);
    await syncStockLevelQuantity(jobWorkOrder.finishedLaceId, qtyReceived, targetWarehouseId ?? undefined, 'METER', tx);

    // No finishedFabricId: a lace job mints no fabric master, and writing one would put a
    // phantom cloth on the order. The job's total is cumulative across parts; only the final
    // part dates the job and runs the loss split (same rule as the fabric branch).
    const cumulativeReceived = toNumber(roundToCent(addCurrency(receivedSoFar, qtyReceived)));
    const receiptFields: Prisma.job_work_ordersUncheckedUpdateInput = {
      qtyReceivedMeters: cumulativeReceived,
      grnId,
      ...(processingQC
        ? {
            qualityGrade: processingQC.qualityGrade,
            colorMatchStatus: processingQC.colorMatchStatus || null,
            defectMeters: processingQC.defectMeters ?? null,
            defectType: processingQC.defectType || null,
            actualRate: processingQC.actualRate ?? null,
          }
        : {}),
    };

    if (receipt.isFinal) {
      await setJwoStatus(tx, jobWorkOrder.id, 'STOCK_UPDATED', {
        ...receiptFields,
        receivedDate: jobWorkOrder.receivedDate ?? receivedAt,
      });

      try {
        await jobWorkOrderService.applyLossSplit(jobWorkOrder.id, cumulativeReceived, tx);
      } catch (lossSplitError) {
        logWarn('[GRN] Loss split failed for lace JWO receive', {
          jobWorkOrderId: jobWorkOrder.id,
          error: lossSplitError instanceof Error ? lossSplitError.message : lossSplitError,
        });
      }
    } else {
      await setJwoStatus(tx, jobWorkOrder.id, 'PARTIALLY_RECEIVED', receiptFields);
    }

    // Same outward-challan close as the fabric branch. The lace path files no INWARD challan, but
    // the goods still went out on an OUTWARD one and it must stop reading as "at the dyer".
    try {
      const outwardStatus = await closeOutwardChallanForJwo(tx, jobWorkOrder.id, {
        isFinal: !!receipt.isFinal,
        receivedById: userId,
        receivedAt,
      });
      if (outwardStatus) {
        logInfo('[GRN] Outward challan advanced on lace job-work receipt', {
          jobWorkOrderId: jobWorkOrder.id,
          status: outwardStatus,
        });
      }
    } catch (challanError) {
      logWarn('[GRN] Could not advance outward challan on lace job-work receipt', {
        jobWorkOrderId: jobWorkOrder.id,
        error: challanError instanceof Error ? challanError.message : challanError,
      });
    }

    await mrpService.updateJwoReceivedQuantity(jobWorkOrder.id, qtyReceived, tx);
    await updateWosrReceivedQuantity(jobWorkOrder.id, qtyReceived, tx);

    logInfo('Lace JWO GRN approved — lace_stock created', {
      grnId,
      jobWorkOrderId: jobWorkOrder.id,
      jobWorkNumber: jobWorkOrder.jobWorkNumber,
      laceId: jobWorkOrder.finishedLaceId,
      issuedQty: toNumber(issuedQty),
      qtyReceived,
      costPerMeter,
    });
  }

  // BUG-GRN6 fix: Reverse specialized stock records created during GRN approval
  private async reverseSpecializedStockInTx(
    tx: Prisma.TransactionClient,
    grn: any,
    po: { id: string; poCategory: string | null; supplierId: string | null } | null,
    userId: string,
    warehouseId: string,
    reason: string
  ): Promise<void> {
    if (!po) return;

    // Goods delivered straight to a processor carry a Rule 45 challan filed with this receipt: reversing
    // the receipt cancels it (same transaction — a refusal below rolls this back too). Phase 2.
    await tx.challans.updateMany({
      where: { directSupplyGrnId: grn.id, status: { not: 'CANCELLED' } },
      data: { status: 'CANCELLED', remarks: `Cancelled: GRN ${grn.grnNumber} reversed — ${reason}` },
    });

    const poCategory = po.poCategory;

    // Thread — every packed line (any category) and every line of a THREAD PO: its own lot, found by grnItemId
    for (const item of grn.grn_items) {
      if (threadPackOf(item) || (poCategory === 'THREAD' && item.materials?.threadId)) {
        await this.reverseThreadLotInTx(tx, grn, item, userId, warehouseId, reason);
      }
    }
    if (poCategory === 'THREAD') return;

    // Every category approval booked through the generic loop (the SAME predicate): take back each trim line's
    // lot — refused once any of it has been issued — then its stock_levels, in the stock units approval booked.
    // TRIMS was missing here before 2026-09-26, so reversing a trims receipt never took stock_levels back.
    if (receivesViaStockLevels(poCategory)) {
      for (const item of grn.grn_items) {
        if (threadPackOf(item)) continue; // reversed above, on its pack row
        const stockQty = item.stockQuantity != null ? Number(item.stockQuantity) : grnLineStock(item).qty;
        if (!(stockQty > 0)) continue;
        const lot = item.materials ? trimLotOf(item.materials) : null;
        if (lot) {
          await trimStockService.reverseGrnReceiptLot(
            {
              trimType: lot.trimType,
              masterId: lot.masterId,
              sizeVariantId: lot.sizeVariantId,
              warehouseId,
              procurementId: grn.poId ?? null,
              quantity: stockQty,
              grnNumber: grn.grnNumber,
            },
            tx
          );
        }
        await syncStockLevelQuantity(item.materialId, -stockQty, warehouseId, undefined, tx);
      }
      return;
    }

    // Handle specialized categories (ACTUAL metres — what approval booked)
    for (const item of grn.grn_items) {
      const acceptedQty = grnLineActualQty(item).toNumber();
      if (acceptedQty <= 0) continue;

      const material = item.materials;

      // GREIGE - reverse greige_stock
      if (poCategory === 'GREIGE' && material?.greige_master) {
        const greigeId = material.greige_master.id;

        // P2: Identity-based lookup by grnItemId (preferred)
        let greigeStock = await tx.greige_stock.findFirst({
          where: { grnItemId: item.id },
        });

        // P2: Fallback for legacy lots (null grnItemId) — log warning
        if (!greigeStock) {
          greigeStock = await tx.greige_stock.findFirst({
            where: {
              greigeId,
              warehouseId,
              sourceType: 'GRN',
              grnItemId: null, // Only match legacy lots
              quantityAvailable: { gte: 0 }, // Any available qty
            },
            orderBy: { receivedDate: 'desc' },
          });
          if (greigeStock) {
            logInfo(
              `WARNING: GRN reversal using heuristic fallback for legacy lot (no grnItemId). ` +
                `Lot ${greigeStock.id} may not be the exact lot from this GRN item.`,
              { grnId: grn.id, grnItemId: item.id, stockId: greigeStock.id }
            );
          }
        }

        if (greigeStock) {
          // A lot some of which has already gone out (issued to a job, a challan, cutting) cannot be
          // un-received: reversing only the remainder claimed the used metres were never bought.
          if (greigeStock.grnItemId && !isQtyZero(greigeStock.quantityConsumed)) {
            throw new BusinessError(
              `Cannot reverse GRN ${grn.grnNumber}: ${Number(greigeStock.quantityConsumed)} m of its greige lot has ` +
                `already been used. Take those metres back first (cancel or return the issue), then reverse.`,
              { reason: 'GRN_LOT_ALREADY_USED', lotId: greigeStock.id, used: Number(greigeStock.quantityConsumed) }
            );
          }
          // P2: Reverse by ACTUAL quantity stored in the lot, not NOMINAL acceptedQty
          // For lots with grnItemId, we reverse the full quantityAvailable
          // For legacy lots, we use actualQuantity from grn_item if available, else acceptedQty
          const actualQty = item.actualQuantity ? Number(item.actualQuantity) : Number(greigeStock.quantityAvailable);
          const reverseQty = greigeStock.grnItemId ? Number(greigeStock.quantityAvailable) : actualQty;

          const newAvailable = Math.max(0, Number(greigeStock.quantityAvailable) - reverseQty);
          // Zero the lot, never delete it: approval's STOCK_IN row and the reversal row below both
          // point at it (greige_stock_transaction_stockId_fkey), so a delete failed EVERY greige GRN
          // reversal (2026-09-25, grn-greige-reversal.test.ts).
          await tx.greige_stock.update({
            where: { id: greigeStock.id },
            data: {
              quantityAvailable: newAvailable,
              ...(isQtyZero(newAvailable) ? { status: 'EXHAUSTED' as const } : {}),
            },
          });

          // Create reversal transaction
          await tx.greige_stock_transaction.create({
            data: {
              stockId: greigeStock.id,
              transactionType: 'ADJUSTMENT_OUT',
              quantity: -reverseQty,
              balanceAfter: newAvailable,
              referenceType: 'MANUAL_ADJUSTMENT', // GRN reversal adjustment
              referenceId: grn.id,
              notes: `GRN ${grn.grnNumber} reversed - ${reason}`,
              performedById: userId,
            },
          });

          // Sync stock_levels with the ACTUAL quantity being reversed
          await syncStockLevelQuantity(greigeId, -reverseQty, warehouseId, undefined, tx);

          logInfo(`Reversed greige_stock from GRN ${grn.grnNumber}: ${reverseQty}m (actual)`, {
            grnId: grn.id,
            greigeId,
            stockId: greigeStock.id,
            nominal: acceptedQty,
            actual: reverseQty,
          });
        } else {
          logInfo(
            `WARNING: No greige_stock found to reverse for GRN item ${item.id}. ` +
              `Stock may have been manually consumed or already reversed.`,
            { grnId: grn.id, grnItemId: item.id, greigeId }
          );
        }
      }

      // FABRIC - reverse fabric_stock
      if (poCategory === 'FABRIC' && material?.fabric_master) {
        const fabricId = material.fabric_master.id;
        const fabricStock = await tx.fabric_stock.findFirst({
          where: {
            fabricId,
            warehouseId,
            quantityAvailable: { gte: acceptedQty },
          },
          orderBy: { receivedDate: 'desc' },
        });

        if (fabricStock) {
          const newAvailable = Number(fabricStock.quantityAvailable) - acceptedQty;
          if (newAvailable <= 0) {
            await tx.fabric_stock.delete({ where: { id: fabricStock.id } });
          } else {
            await tx.fabric_stock.update({
              where: { id: fabricStock.id },
              data: { quantityAvailable: newAvailable },
            });
          }

          await syncStockLevelQuantity(fabricId, -acceptedQty, warehouseId, undefined, tx);

          logInfo(`Reversed fabric_stock from GRN ${grn.grnNumber}: ${acceptedQty}m`, {
            grnId: grn.id,
            fabricId,
          });
        }
      }

      // LACE / GREIGE_LACE - reverse lace_stock
      if ((poCategory === 'LACE' || poCategory === 'GREIGE_LACE') && material?.lace_master) {
        const laceId = material.lace_master.id;
        // The lot this receipt line booked (grnItemId, since 2026-09-26); older lots by the heuristic
        const linkedLace = await tx.lace_stock.findFirst({ where: { grnItemId: item.id } });
        const laceStock =
          linkedLace ??
          (await tx.lace_stock.findFirst({
            where: {
              laceId,
              warehouseId,
              procurementId: grn.poId,
              quantityAvailable: { gte: acceptedQty },
            },
            orderBy: { receivedDate: 'desc' },
          }));

        if (laceStock) {
          // Lace some of which has already gone out (to a job, or drawn at the dyer) cannot be un-received
          if (linkedLace && !isQtyZero(Number(linkedLace.quantityConsumed))) {
            throw new BusinessError(
              `Cannot reverse GRN ${grn.grnNumber}: ${Number(linkedLace.quantityConsumed)} m of its lace lot has ` +
                `already been used. Take those metres back first (cancel or return the issue), then reverse.`,
              { reason: 'GRN_LOT_ALREADY_USED', lotId: linkedLace.id, used: Number(linkedLace.quantityConsumed) }
            );
          }
          const reverseQty = linkedLace ? Number(linkedLace.quantityAvailable) : acceptedQty;
          const newAvailable = Math.max(0, Number(laceStock.quantityAvailable) - reverseQty);
          // A lot a challan names (lace delivered straight to a processor) cannot be deleted — zero it
          const namedOnChallan = await tx.challan_items.count({ where: { laceStockId: laceStock.id } });
          if (isQtyZero(newAvailable) && namedOnChallan === 0) {
            await tx.lace_stock.delete({ where: { id: laceStock.id } });
          } else {
            await tx.lace_stock.update({
              where: { id: laceStock.id },
              data: {
                quantityAvailable: newAvailable,
                ...(isQtyZero(newAvailable) ? { status: 'EXHAUSTED' as const } : {}),
              },
            });
          }

          await syncStockLevelQuantity(laceId, -reverseQty, warehouseId, undefined, tx);

          logInfo(`Reversed lace_stock from GRN ${grn.grnNumber}: ${acceptedQty}m`, {
            grnId: grn.id,
            laceId,
          });
        }
      }
    }
  }

  /**
   * Take back the thread lot ONE receipt line made (grnItemId, since 2026-09-26; an older lot by the PO / warehouse
   * heuristic) and its stock_levels on the lot's own row — its pack row, or the base row when unpacked. Refused
   * once any of the lot has been used: those cones / tubes must come back first.
   */
  private async reverseThreadLotInTx(
    tx: Prisma.TransactionClient,
    grn: any,
    item: any,
    userId: string,
    warehouseId: string,
    reason: string
  ): Promise<void> {
    const stockQty = item.stockQuantity != null ? Number(item.stockQuantity) : grnLineStock(item).qty;
    if (!(stockQty > 0)) return;
    const linked = await tx.thread_stock.findUnique({ where: { grnItemId: item.id } });
    const lot =
      linked ??
      (item.materials?.threadId
        ? await tx.thread_stock.findFirst({
            where: {
              threadId: item.materials.threadId,
              grnItemId: null,
              warehouseId,
              procurementId: grn.poId,
              quantityAvailable: { gte: stockQty },
            },
            orderBy: { receivedDate: 'desc' },
          })
        : null);
    if (!lot) {
      logWarn(`GRN ${grn.grnNumber} reversal: no thread lot found for line ${item.id} — nothing to take back`);
      return;
    }
    if (linked && !isQtyZero(Number(linked.quantityConsumed))) {
      throw new BusinessError(
        `Cannot reverse GRN ${grn.grnNumber}: ${Number(linked.quantityConsumed)} of its thread lot has already been ` +
          `used. Take those back first, then reverse.`,
        { reason: 'GRN_LOT_ALREADY_USED', lotId: linked.id, used: Number(linked.quantityConsumed) }
      );
    }

    const reverseQty = linked ? Number(linked.quantityAvailable) : stockQty;
    const remaining = Math.max(0, Number(lot.quantityAvailable) - reverseQty);
    const newAvailable = isQtyZero(remaining) ? 0 : remaining;
    // Zeroed, not deleted: its transactions (and any challan naming it) keep pointing at it
    await tx.thread_stock.update({
      where: { id: lot.id },
      data: { quantityAvailable: newAvailable, ...(newAvailable === 0 ? { status: 'EXHAUSTED' as const } : {}) },
    });
    await tx.thread_stock_transaction.create({
      data: {
        stockId: lot.id,
        transactionType: 'ADJUSTMENT_OUT',
        quantity: -reverseQty,
        balanceAfter: newAvailable,
        referenceType: 'MANUAL_ADJUSTMENT', // GRN reversal adjustment
        referenceId: grn.id,
        notes: `GRN ${grn.grnNumber} reversed - ${reason}`,
        performedById: userId,
      },
    });
    await syncStockLevelQuantity(await threadLotMaterialId(lot, tx), -reverseQty, warehouseId, undefined, tx);

    logInfo(`Reversed thread lot from GRN ${grn.grnNumber}: ${reverseQty}`, { grnId: grn.id, lotId: lot.id });
  }

  // BUG-GRN6 fix: Reverse Processing PO specific records
  // Phase 4b: also handles PO-less JWO GRNs (po = null, lookup via grn.jobWorkOrderId)
  private async reverseProcessingGRNInTx(
    tx: Prisma.TransactionClient,
    grn: any,
    po: { id: string; poCategory: string | null; supplierId: string | null } | null,
    userId: string,
    reason: string
  ): Promise<void> {
    // Find the job work order — by the receipt's own link (PO-less) or via the shadow PO. Never by
    // the job's `grnId` on the PO-less path: that names only the LATEST receipt, so reversing an
    // earlier part of a return received in parts silently did nothing (2026-09-19).
    const jobWorkOrder = await tx.job_work_orders.findFirst({
      where: grn.jobWorkOrderId ? { id: grn.jobWorkOrderId } : { purchaseOrderId: po!.id, grnId: grn.id },
      include: {
        greigeStockLot: true,
        fabricStockLot: true,
      },
    });

    if (!jobWorkOrder) {
      logInfo(`No job work order found for GRN ${grn.grnNumber} reversal - may have been created via different path`);
      return;
    }

    const receivedMeters = Number(jobWorkOrder.qtyReceivedMeters || 0);
    // THIS receipt's quantity and lines. A return received in parts has one lot and one challan per
    // receipt, each linked by id (grnItemId / challans.grnId). Lots booked before those columns
    // existed are found the old way — the job's receipt date — but only when this receipt IS the
    // job's receipt, so a job received in parts never takes back a sibling part's lot.
    const receiptItemIds: string[] = (grn.grn_items ?? []).map((i: { id: string }) => i.id);
    const receiptQty: number = (grn.grn_items ?? []).reduce(
      (s: number, i: { acceptedQuantity: number; foldLengthCm?: number | null }) => s + grnLineActualQty(i).toNumber(),
      0
    );
    const partQty = receiptQty > 0 ? receiptQty : receivedMeters;
    const legacyDateMatch =
      jobWorkOrder.grnId === grn.id && jobWorkOrder.receivedDate ? { receivedDate: jobWorkOrder.receivedDate } : null;

    // 0. Reverse the dyed-lace lot this receipt minted. Matched the same way as fabric — the
    // material plus the receipt's exact timestamp — so an earlier lot of the same dyed lace is
    // never taken back.
    if (jobWorkOrder.fabricType === 'LACE' && jobWorkOrder.finishedLaceId) {
      let laceLots = await tx.lace_stock.findMany({
        where: { laceId: jobWorkOrder.finishedLaceId, grnItemId: { in: receiptItemIds } },
      });
      if (laceLots.length === 0 && legacyDateMatch) {
        laceLots = await tx.lace_stock.findMany({
          where: { laceId: jobWorkOrder.finishedLaceId, grnItemId: null, ...legacyDateMatch },
        });
      }
      for (const lot of laceLots) {
        const qty = Number(lot.quantityAvailable);
        // Consumed metres cannot be un-received — the lace has already gone into a garment.
        if (Number(lot.quantityConsumed) > 0 || Number(lot.quantityReserved) > 0) {
          throw new Error(
            `Cannot reverse GRN ${grn.grnNumber}: dyed lace lot ${lot.id.slice(0, 8)} has already been used ` +
              `(${Number(lot.quantityConsumed)}m consumed, ${Number(lot.quantityReserved)}m reserved).`
          );
        }
        await tx.lace_stock_transaction.deleteMany({ where: { stockId: lot.id } });
        await tx.lace_stock.delete({ where: { id: lot.id } });
        await syncStockLevelQuantity(jobWorkOrder.finishedLaceId, -qty, lot.warehouseId ?? undefined, 'METER', tx);

        logInfo(`Reversed dyed lace_stock: ${qty}m`, {
          grnId: grn.id,
          laceStockId: lot.id,
          laceId: jobWorkOrder.finishedLaceId,
        });
      }
    }

    // 1. Reverse fabric_stock created from this job
    if (jobWorkOrder.finishedFabricId) {
      // The lot(s) this receipt booked — by the receipt line; date match only for pre-link lots.
      let fabricStocks = await tx.fabric_stock.findMany({
        where: { fabricId: jobWorkOrder.finishedFabricId, grnItemId: { in: receiptItemIds } },
      });
      if (fabricStocks.length === 0 && legacyDateMatch) {
        fabricStocks = await tx.fabric_stock.findMany({
          where: {
            fabricId: jobWorkOrder.finishedFabricId,
            originStyleId: jobWorkOrder.styleId,
            grnItemId: null,
            ...legacyDateMatch,
          },
        });
      }

      for (const stock of fabricStocks) {
        const qty = Number(stock.quantityAvailable);
        await tx.fabric_stock.delete({ where: { id: stock.id } });
        await syncStockLevelQuantity(jobWorkOrder.finishedFabricId, -qty, stock.warehouseId ?? undefined, 'METER', tx);

        logInfo(`Reversed processing fabric_stock: ${qty}m`, {
          grnId: grn.id,
          fabricStockId: stock.id,
          fabricId: jobWorkOrder.finishedFabricId,
        });
      }
    }

    // 2. Restore processor's greige_stock — ONLY on the PO-backed path, the one place a receipt
    //    consumed it (approval, "Consume from processor's greige_stock"). The one-action
    //    Receive from processor (PO-less, receiveJwoToStock) never takes metres off a processor lot,
    //    so reversing it must never add any back — doing so minted greige out of nothing whenever a
    //    TRANSFER lot sat on the job's outward challan (2026-09-25).
    if (po && jobWorkOrder.outwardChallanId) {
      const processorGreigeStock = await tx.greige_stock.findFirst({
        where: {
          sourceChallanId: jobWorkOrder.outwardChallanId,
          processorId: jobWorkOrder.processorId,
          sourceType: 'TRANSFER',
        },
      });

      if (processorGreigeStock) {
        // Restore THIS receipt's quantity — not the job's running total, which spans every part.
        await tx.greige_stock.update({
          where: { id: processorGreigeStock.id },
          data: {
            quantityAvailable: { increment: partQty },
            quantityConsumed: { decrement: partQty },
            status: 'AVAILABLE',
          },
        });

        // Create restoration transaction
        await tx.greige_stock_transaction.create({
          data: {
            stockId: processorGreigeStock.id,
            transactionType: 'ADJUSTMENT_OUT',
            quantity: partQty,
            balanceAfter: Number(processorGreigeStock.quantityAvailable) + partQty,
            referenceType: 'MANUAL_ADJUSTMENT', // GRN reversal adjustment
            referenceId: grn.id,
            notes: `GRN ${grn.grnNumber} reversed - restored greige at processor`,
            performedById: userId,
          },
        });
        if (processorGreigeStock.warehouseId) {
          const greigeMaterialId = await ensureMaterialRecord(processorGreigeStock.greigeId, 'GREIGE', tx);
          await syncStockLevelQuantity(greigeMaterialId, partQty, processorGreigeStock.warehouseId, 'METER', tx);
        }

        logInfo(`Restored processor greige_stock: ${partQty}m`, {
          grnId: grn.id,
          processorStockId: processorGreigeStock.id,
        });
      }
    }

    // 3. Cancel THIS receipt's inward challan — by its grnId; the job's inwardChallanId only when
    //    this receipt is the job's latest and the challan predates the link.
    const inwardChallan =
      (await tx.challans.findFirst({ where: { grnId: grn.id, challanType: 'INWARD' }, select: { id: true } })) ??
      (jobWorkOrder.grnId === grn.id && jobWorkOrder.inwardChallanId ? { id: jobWorkOrder.inwardChallanId } : null);
    if (inwardChallan) {
      await tx.challans.update({
        where: { id: inwardChallan.id },
        data: {
          status: 'CANCELLED',
          remarks: `Cancelled due to GRN ${grn.grnNumber} reversal - ${reason}`,
        },
      });

      logInfo(`Cancelled inward challan for GRN reversal`, {
        grnId: grn.id,
        challanId: inwardChallan.id,
      });
    }
    // Delivered straight to the next processor (Phase 4d): the A → B challan filed with this receipt
    // goes with it — the lot it named was taken back in step 1
    const onward = await tx.challans.updateMany({
      where: { grnId: grn.id, challanType: 'OUTWARD', status: { not: 'CANCELLED' } },
      data: { status: 'CANCELLED', remarks: `Cancelled due to GRN ${grn.grnNumber} reversal - ${reason}` },
    });
    if (onward.count > 0) {
      logInfo('Cancelled the onward challan to the next processor for GRN reversal', { grnId: grn.id });
    }

    // 4. Recompute the job from the receipts that remain ACCEPTED (the caller has already flipped
    //    this one to REVERSED). None left → the full pre-receive reset. Some left → the job's total
    //    is their sum; if the reversed receipt was the FINAL one the job is partial again
    //    (receivedDate, shrinkage and the loss split belong to the final delivery, so they clear);
    //    if a middle part went, the job stays final and the split is re-run on the reduced total.
    const reversalNote = `[GRN REVERSED ${new Date().toISOString()}] ${reason}`;
    const remarks = jobWorkOrder.remarks ? `${jobWorkOrder.remarks}\n${reversalNote}` : reversalNote;
    const remaining = grn.jobWorkOrderId
      ? await tx.goods_receiving_notes.findMany({
          where: { jobWorkOrderId: jobWorkOrder.id, status: 'ACCEPTED', id: { not: grn.id } },
          select: { id: true, grn_items: { select: { acceptedQuantity: true, thanCount: true, foldLengthCm: true } } },
          orderBy: { receivingDate: 'asc' },
        })
      : [];

    if (remaining.length === 0) {
      // Reset job work order to pre-receive state (ISSUED maps legacy back to AT_MILL)
      await setJwoStatus(tx, jobWorkOrder.id, 'ISSUED', {
        qtyReceivedMeters: null,
        receivedWidthInches: null,
        receivedDate: null,
        receivedChallan: null,
        actualShrinkage: null,
        // Loss split is a receive-time computation — clear it with the receive
        qtyNormalLoss: null,
        qtyAbnormalLoss: null,
        widthVariance: null,
        thanCount: null,
        foldLengthCm: null,
        calculatedActualMeters: null,
        inwardChallanId: null,
        grnId: null,
        qualityGrade: null,
        colorMatchStatus: null,
        defectMeters: null,
        defectType: null,
        actualRate: null,
        remarks,
      });
    } else {
      const total = toNumber(addCurrency(...remaining.flatMap((r) => r.grn_items.map((i) => grnLineActualQty(i)))));
      const anyFolded = remaining.some((r) => r.grn_items.some((i) => Number(i.foldLengthCm ?? 0) > 0));
      const thanCounts = remaining
        .flatMap((r) => r.grn_items.map((i) => i.thanCount))
        .filter((n): n is number => n != null);
      const thanCount = thanCounts.length ? thanCounts.reduce((a, b) => a + b, 0) : null;
      const sentMeters = Number(jobWorkOrder.qtySentMeters ?? 0);
      const stillFinal = !!jobWorkOrder.receivedDate && jobWorkOrder.grnId !== grn.id;
      const latest = remaining[remaining.length - 1];
      const latestChallan = await tx.challans.findFirst({
        where: { grnId: latest.id, challanType: 'INWARD' },
        select: { id: true },
      });

      await setJwoStatus(
        tx,
        jobWorkOrder.id,
        stillFinal ? (jobWorkOrder.jwoStatus ?? 'STOCK_UPDATED') : 'PARTIALLY_RECEIVED',
        {
          qtyReceivedMeters: total,
          thanCount,
          calculatedActualMeters: anyFolded ? total : null,
          remarks,
          ...(stillFinal
            ? { actualShrinkage: sentMeters > 0 ? ((sentMeters - total) / sentMeters) * 100 : 0 }
            : {
                receivedDate: null,
                actualShrinkage: null,
                qtyNormalLoss: null,
                qtyAbnormalLoss: null,
                grnId: latest.id,
                inwardChallanId: latestChallan?.id ?? null,
              }),
        }
      );

      if (stillFinal) {
        try {
          await jobWorkOrderService.applyLossSplit(jobWorkOrder.id, total, tx);
        } catch (lossSplitError) {
          logWarn('[GRN] Loss split re-run failed after reversing a part', {
            jobWorkOrderId: jobWorkOrder.id,
            error: lossSplitError instanceof Error ? lossSplitError.message : lossSplitError,
          });
        }
      }

      logInfo(`Job recomputed from ${remaining.length} remaining receipt(s) after reversal`, {
        grnId: grn.id,
        jobId: jobWorkOrder.id,
        total,
        stillFinal,
      });
    }

    // Mirror the receive side: put the OUTWARD challan back to what the surviving receipts say.
    // Runs after the job's status has been recomputed above, for the same reason the close does.
    try {
      const outwardStatus = await resyncOutwardChallanAfterReversal(tx, jobWorkOrder.id, {
        remainingReceipts: remaining.length,
        stillFinal: remaining.length > 0 && !!jobWorkOrder.receivedDate && jobWorkOrder.grnId !== grn.id,
      });
      if (outwardStatus) {
        logInfo('[GRN] Outward challan reopened after reversal', {
          jobWorkOrderId: jobWorkOrder.id,
          status: outwardStatus,
        });
      }
    } catch (challanError) {
      logWarn('[GRN] Could not resync outward challan after reversal', {
        jobWorkOrderId: jobWorkOrder.id,
        error: challanError instanceof Error ? challanError.message : challanError,
      });
    }

    // 5. Reset PO status to allow re-receiving (Phase 4b: PO-less GRNs have no PO)
    if (po) {
      await tx.purchase_orders.updateMany({
        where: { id: po.id, status: 'RECEIVED' },
        data: { status: 'ACKNOWLEDGED' },
      });
    }

    logInfo(`Reset job work order${po ? ' and PO' : ''} for GRN reversal`, {
      grnId: grn.id,
      jobId: jobWorkOrder.id,
      poId: po?.id ?? null,
    });
  }
}

export const grnService = new GRNService();
export default grnService;
