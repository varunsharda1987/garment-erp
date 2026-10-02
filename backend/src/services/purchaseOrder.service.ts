/**
 * Purchase Order Service
 * Business logic for purchase order operations
 */

import {
  PurchaseOrderStatus,
  Prisma,
  POSource,
  ServiceType,
  POCategory,
  MaterialRequirementStatus,
  UserRole,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { randomUUID } from 'crypto';
import prisma from '../config/database';
import { logInfo, logWarn } from '../utils/logger';
import { gstService } from './gst.service';
import {
  CreatePurchaseOrderDTO,
  UpdatePurchaseOrderDTO,
  PurchaseOrderItemDTO,
  UpdatePurchaseOrderItemDTO,
  PurchaseOrderFilters,
  isDeliveryBeforePoDate,
  isPoDateAfterToday,
} from '../types/purchaseOrder.types';
import { generateAtomicPONumberInTx } from '../utils/atomicCodeGenerator';
import { roundToCent, subtractCurrency, toNumber } from '../utils/currency';
import { formatDate } from '../utils/date';
import { validateTransition } from '../utils/stateMachine';
import { systemSettingsService } from './system-settings.service';
import { isReceiptComplete } from './helpers/receipt-split.helper';
import { BusinessError, ForbiddenError, NotFoundError, ValidationError } from '../errors';
import { checkProcessingPOReadiness } from './po-status-manager.service';
import { releasePurchaseOrderItemLinks } from './helpers/po-item-link-release.helper';
import { resolvePoLineUnits } from './helpers/purchase-unit.helper';
import { assertPoLinesFitCategory } from './helpers/po-line-category.helper';
import { defaultDeliveryLocationId, getPoDeliveryDefault } from './helpers/po-default-delivery.helper';
import { applySearch } from '../utils/search-filter';
import { LABEL_LINE_MATERIAL_SELECT, PO_LINE_ORDER } from './helpers/label-line.helper';
import {
  attachMaterialDetails,
  MATERIAL_DETAIL_SELECT,
  type MaterialDetailInput,
} from './helpers/material-detail.helper';
import { resolvePoForBuyers, type PoForBuyerInput } from './helpers/po-for-buyer.helper';
import {
  applyDeliveryPlan,
  FINISHED_STATUSES,
  loadDeliveryProgress,
  planFromItemDeliveries,
  PRE_SEND_STATUSES,
  rebalanceSplitToFirstPoint,
  type DeliveryPlanInput,
} from './helpers/po-delivery-plan.helper';
import { createAuditLog } from './audit.service';
import { freezeClosedPoLinks, mintBalanceChild, returnDemandAfterUnlink } from './helpers/po-allocation.helper';
import { PO_LINK_REQUIREMENT_STATUSES } from './helpers/receipt-allocation.helper';
import { releaseLinkHolds } from './helpers/stock-reservation.helper';
import { isQtyZero } from '../utils/quantity';
import { styleCodeLabel } from '../utils/style-code';
import { assertNoPendingTransit } from './helpers/transit-challan-state';

type Tx = Prisma.TransactionClient;

/**
 * POs as the PO page and list read them: each line's material with its `buyerBrand` / `spec` (whose label it
 * is, and what — material-detail.helper), and the PO's `forBuyer`. PO2609-0231 bought Easybuy's size labels
 * and nothing on it said so (2026-09-28). One detail lookup and one buyer lookup for the whole response.
 */
async function withLineDetails<
  M extends MaterialDetailInput,
  I extends { materials: M | null },
  P extends Omit<PoForBuyerInput, 'purchase_order_items'> & { purchase_order_items: I[] },
>(pos: P[]) {
  const materials = pos
    .flatMap((po) => po.purchase_order_items.map((item) => item.materials))
    .filter((m): m is M => !!m);
  const [detailed, forBuyers] = await Promise.all([attachMaterialDetails(materials), resolvePoForBuyers(pos)]);
  const detailOf = new Map(materials.map((m, i) => [m, detailed[i]]));
  return pos.map((po, i) => ({
    ...po,
    purchase_order_items: po.purchase_order_items.map((item) => ({
      ...item,
      materials: item.materials ? (detailOf.get(item.materials) ?? null) : null,
    })),
    forBuyer: forBuyers[i],
  }));
}

/** Refuse a PO date after today (IST) — the schema checks it too; this guards every other writer. */
function assertPoDateNotFuture(poDate: Date | string | undefined | null): void {
  if (poDate && isPoDateAfterToday(poDate)) {
    throw new BusinessError('The PO date cannot be after today.', { code: 'PO_DATE_IN_FUTURE' });
  }
}

/** Refuse goods due before the PO's own date (IST days; the same day is fine). */
function assertDeliveryNotBeforePoDate(
  expectedDeliveryDate: Date | string | undefined | null,
  poDate: Date | string | undefined | null
): void {
  if (expectedDeliveryDate && poDate && isDeliveryBeforePoDate(expectedDeliveryDate, poDate)) {
    throw new BusinessError(
      `The expected delivery date (${formatDate(expectedDeliveryDate)}) is before the PO date ` +
        `(${formatDate(poDate)}) — goods cannot be due before they are ordered.`,
      { code: 'PO_DELIVERY_BEFORE_PO_DATE' }
    );
  }
}

/**
 * A line's rate kept to paise — the column is 2 dp — and its amount worked out from THAT rate, so the
 * saved rate × quantity is the saved amount. 0.125 × 10,000 used to save rate 0.13 beside amount 1,250.
 */
function priceLine(quantity: number, unitPrice: number): { unitPrice: number; totalPrice: number } {
  const rate = roundToCent(unitPrice);
  return { unitPrice: rate.toNumber(), totalPrice: roundToCent(rate.times(quantity)).toNumber() };
}

type Money = Prisma.Decimal | number | null | undefined;

/**
 * A PO's header totals from its lines: Decimal sums of the stored (already rounded) line amounts. The one
 * way every writer adds a PO up — create summed raw floats with toFixed, edit used roundToCent, the item
 * endpoints Decimal; three ways that could disagree by a paisa.
 */
function poTotalsOf(
  lines: ReadonlyArray<{ totalPrice: Money; cgstAmount: Money; sgstAmount: Money; igstAmount: Money }>
) {
  let subtotal = new Decimal(0);
  let totalCgst = new Decimal(0);
  let totalSgst = new Decimal(0);
  let totalIgst = new Decimal(0);
  for (const line of lines) {
    subtotal = subtotal.add(line.totalPrice || 0);
    totalCgst = totalCgst.add(line.cgstAmount || 0);
    totalSgst = totalSgst.add(line.sgstAmount || 0);
    totalIgst = totalIgst.add(line.igstAmount || 0);
  }
  const totalTax = totalCgst.add(totalSgst).add(totalIgst);
  return {
    subtotal: subtotal.toDecimalPlaces(2),
    totalCgst: totalCgst.toDecimalPlaces(2),
    totalSgst: totalSgst.toDecimalPlaces(2),
    totalIgst: totalIgst.toDecimalPlaces(2),
    totalTax: totalTax.toDecimalPlaces(2),
    totalAmount: subtotal.add(totalTax).toDecimalPlaces(2),
  };
}

/**
 * A GRN still awaiting QC means the delivered quantity is NOT settled: the PO counters are incremented
 * gross at GRN creation, and the verdict can land days later. Short-closing over it would freeze
 * shortQuantity from provisional numbers; cancelling over it would hand the demand back to the plan
 * while the goods are still on their way into stock (approveGRN now refuses a cancelled PO, so the
 * receipt could never be booked either). One check, both verbs.
 */
async function assertNoGrnAwaitingQc(poId: string, poNumber: string, verb: 'short-close' | 'cancel'): Promise<void> {
  const pendingGrn = await prisma.goods_receiving_notes.findFirst({
    where: { poId, status: 'PENDING_QC' },
    select: { grnNumber: true },
  });
  if (pendingGrn) {
    throw new BusinessError(
      `Cannot ${verb} ${poNumber}: GRN ${pendingGrn.grnNumber} is still awaiting QC. ` +
        `Complete or reject it first so the delivered quantity is final.`,
      { code: 'PO_GRN_PENDING_QC', grnNumber: pendingGrn.grnNumber }
    );
  }
  // Goods on the road under our transit challan (2026-09-29): they will arrive and be received against this PO
  await assertNoPendingTransit(prisma, poId, `${verb} ${poNumber}`);
}

/** One requirement's share of a PO: all of its links to that PO, summed. */
interface RequirementShare {
  requirementId: string;
  allocated: number;
  received: number;
}

/**
 * A requirement can hold SEVERAL links to the same PO (one per PO line it was allocated across).
 * Aggregate them first — handling each link separately let the last one overwrite the earlier ones'
 * shortfall, silently losing part of the delivery (cd710041, short-close; cancel repeated the per-link
 * loop until 2026-09-27). A negative receivedQuantity (an over-shot reversal) is floored at zero so a
 * requirement can never fall between the "nothing delivered" and "part delivered" branches, and a link
 * never counts more than it was allocated: goods delivered past it (a pro-rata processing line over-credits
 * its links) are not more of THIS requirement, so the short-close shortfall can never rise above the
 * allocation (po-allocation design §6.9).
 */
async function loadRequirementShares(tx: Tx, poId: string): Promise<RequirementShare[]> {
  const rawLinks = await tx.requirement_po_links.findMany({
    where: { purchaseOrderId: poId },
    select: { requirementId: true, allocatedQuantity: true, receivedQuantity: true },
  });
  const byRequirement = new Map<string, { allocated: number; received: number }>();
  for (const l of rawLinks) {
    const agg = byRequirement.get(l.requirementId) ?? { allocated: 0, received: 0 };
    const allocated = Number(l.allocatedQuantity);
    agg.allocated += allocated;
    agg.received += Math.min(Math.max(0, Number(l.receivedQuantity)), allocated);
    byRequirement.set(l.requirementId, agg);
  }
  return [...byRequirement.entries()].map(([requirementId, agg]) => ({ requirementId, ...agg }));
}

/**
 * Nothing delivered against these requirements — the material is still genuinely needed, so drop their
 * links to this PO and hand the demand back (MRP's duplicate guard skips a requirement that still holds a
 * link, so a reverted requirement with a stale link would stay unbuyable). The link's receipt holds go
 * first: the hold's FK is SET NULL, so a hold left behind would turn into a Use Stock hold. What the row
 * goes back to is `returnDemandAfterUnlink`'s one rule — PO_REQUIRED, PARTIAL_STOCK when part came from
 * stock, CANCELLED when its order was cancelled — not a blanket PO_REQUIRED.
 */
async function freeUndeliveredRequirements(
  tx: Tx,
  poId: string,
  poNumber: string,
  verb: 'cancel' | 'short-close',
  shares: RequirementShare[],
  userId: string | undefined
): Promise<void> {
  if (shares.length === 0) return;
  const ids = shares.map((s) => s.requirementId);
  const links = await tx.requirement_po_links.findMany({
    where: { purchaseOrderId: poId, requirementId: { in: ids } },
    select: { id: true },
  });
  const linkIds = links.map((l) => l.id);
  await releaseLinkHolds(tx, linkIds);
  await tx.requirement_po_links.deleteMany({ where: { id: { in: linkIds } } });
  const outcomes = await returnDemandAfterUnlink(
    tx,
    ids.map((id) => ({ id })),
    { userId, label: `${poNumber} ${verb}` }
  );
  // A silent count:0 is exactly how the original cancel bug hid. Say so rather than assume success.
  const returned = outcomes.filter((o) => o.changed).length;
  if (returned !== ids.length) {
    logWarn(
      `[PO ${poNumber}] ${verb} returned ${returned} of ${ids.length} undelivered requirement(s) to demand — ` +
        `the rest are still on another PO or job, or were in an unexpected status and may need manual re-planning`
    );
  }
}

/**
 * Close a part-delivered requirement at what this PO delivered: RECEIVED, `shortfall` := delivered (plus the
 * short-close record when given). Guarded — only a row still in a PO status moves. Returns false when it had
 * already left one, and the caller carries no balance forward for it.
 */
async function settleAtDelivered(
  tx: Tx,
  requirementId: string,
  delivered: number,
  extra: Prisma.material_requirementsUpdateManyMutationInput = {}
): Promise<boolean> {
  const settled = await tx.material_requirements.updateMany({
    where: { id: requirementId, status: { in: [...PO_LINK_REQUIREMENT_STATUSES] } },
    data: { status: MaterialRequirementStatus.RECEIVED, shortfall: delivered, ...extra },
  });
  return settled.count > 0;
}

class PurchaseOrderService {
  /**
   * Generate unique PO number - Format: PO2511-0001
   * Uses atomic sequence generator to prevent duplicate numbers under concurrency. Taken INSIDE the
   * create transaction, after every check: a refused or failed PO rolls its number back instead of
   * burning it (the counter stood at 159 with PO2609-0009 the highest, 2026-09-28).
   */
  private async generatePONumber(tx: Prisma.TransactionClient): Promise<string> {
    return generateAtomicPONumberInTx(tx);
  }

  /**
   * Recalculate PO total from items.
   * Accepts an optional transaction client so item writes + header recompute can be atomic
   * (bug-hunt procurement-19).
   */
  private async recalculatePOTotal(poId: string, tx: Prisma.TransactionClient | typeof prisma = prisma): Promise<void> {
    const items = await tx.purchase_order_items.findMany({
      where: { poId },
    });

    for (const item of items) {
      if (!item.totalPrice || Number(item.totalPrice) === 0) {
        logWarn(`[PurchaseOrder] PO item ${item.id} has ₹0 total price — PO total will be understated.`);
      }
    }

    await tx.purchase_orders.update({
      where: { id: poId },
      data: poTotalsOf(items),
    });
  }

  /**
   * A new supplier can change the tax head — CGST + SGST in our state, IGST outside it. Re-split every line
   * at the rate and HSN it was saved with, then the header. An edit that changed only the supplier used to
   * keep the old supplier's split (PO form bug hunt #25).
   */
  private async resplitLineTax(tx: Prisma.TransactionClient, poId: string, supplierId: string): Promise<void> {
    const { isInterstate } = await gstService.isInterstatePO(supplierId);
    const lines = await tx.purchase_order_items.findMany({
      where: { poId },
      select: { id: true, materialId: true, unitPrice: true, totalPrice: true, gstRate: true, hsnCode: true },
    });
    for (const line of lines) {
      const gst = await gstService.calculateLineItemGST({
        lineTotal: Number(line.totalPrice),
        hsnSacCode: line.hsnCode,
        materialId: line.materialId,
        gstRateOverride: line.gstRate != null ? Number(line.gstRate) : null,
        isInterstate,
        unitPrice: Number(line.unitPrice),
      });
      await tx.purchase_order_items.update({
        where: { id: line.id },
        data: {
          hsnCode: gst.hsnCode,
          gstRate: gst.gstRate,
          cgstRate: gst.cgstRate,
          cgstAmount: gst.cgstAmount,
          sgstRate: gst.sgstRate,
          sgstAmount: gst.sgstAmount,
          igstRate: gst.igstRate,
          igstAmount: gst.igstAmount,
          taxAmount: gst.taxAmount,
        },
      });
    }
    await tx.purchase_orders.update({ where: { id: poId }, data: { isInterstate } });
    await this.recalculatePOTotal(poId, tx);
  }

  /**
   * Create a new purchase order with items
   */
  async createPurchaseOrder(data: CreatePurchaseOrderDTO, userId: string) {
    assertPoDateNotFuture(data.poDate);
    // Against the typed PO date, or today when none is typed (the column default)
    assertDeliveryNotBeforePoDate(data.expectedDeliveryDate, data.poDate ?? new Date());

    // Validate supplier exists
    const supplier = await prisma.suppliers.findUnique({
      where: { id: data.supplierId },
    });

    if (!supplier) {
      throw new BusinessError('Supplier not found');
    }

    // Validate items: each must have either materialId OR serviceType
    for (const item of data.items) {
      if (!item.materialId && !item.serviceType) {
        throw new ValidationError('Each item must have either a materialId or a serviceType');
      }
    }

    // Validate materials exist for material-based items (batch query to avoid N+1)
    const materialIds = data.items.filter((item) => item.materialId).map((item) => item.materialId!);
    if (materialIds.length > 0) {
      const existingMaterials = await prisma.materials.findMany({
        where: { id: { in: materialIds } },
        select: { id: true },
      });
      const existingMaterialIds = new Set(existingMaterials.map((m) => m.id));
      for (const materialId of materialIds) {
        if (!existingMaterialIds.has(materialId)) {
          throw new BusinessError(`Material with ID ${materialId} not found`);
        }
      }
    }

    // Each line's material belongs on this category — a Lace PO holding a button received it into no
    // stock at all. Omitted category = the column default, GENERAL.
    await assertPoLinesFitCategory(data.poCategory ?? POCategory.GENERAL, data.items);

    // Determine interstate status for GST calculation
    const { isInterstate } = await gstService.isInterstatePO(data.supplierId);

    // The line's unit + stock units per unit (buttons by the gross = 144) — decided here, never by the body
    const lineUnits = await resolvePoLineUnits(data.items);

    const itemsWithTotals = await Promise.all(
      data.items.map(async (item, i) => {
        const { unitPrice, totalPrice } = priceLine(item.orderedQuantity, item.unitPrice);

        // GST for this line: a typed rate IS its rate (0 included); else the material's, by its HSN.
        // unitPrice is passed for the apparel price-slab logic.
        const gst = await gstService.calculateLineItemGST({
          lineTotal: totalPrice,
          hsnSacCode: item.hsnCode || null, // blank = the material's own HSN
          materialId: item.materialId || null,
          gstRateOverride: item.gstRate ?? null,
          isInterstate,
          unitPrice,
        });

        return {
          id: randomUUID(),
          materialId: item.materialId || null,
          serviceType: (item.serviceType as ServiceType) || null,
          serviceDescription: item.serviceDescription || null,
          orderedQuantity: item.orderedQuantity,
          receivedQuantity: 0,
          unit: lineUnits[i].unit,
          stockUnitsPerUnit: lineUnits[i].stockUnitsPerUnit,
          threadPackagingType: lineUnits[i].threadPackagingType,
          threadPly: lineUnits[i].threadPly,
          unitPrice,
          totalPrice,
          hsnCode: gst.hsnCode,
          gstRate: gst.gstRate,
          cgstRate: gst.cgstRate,
          cgstAmount: gst.cgstAmount,
          sgstRate: gst.sgstRate,
          sgstAmount: gst.sgstAmount,
          igstRate: gst.igstRate,
          igstAmount: gst.igstAmount,
          taxAmount: gst.taxAmount,
          remarks: item.remarks || null,
          // bug-hunt procurement-18: create path silently dropped fold length that
          // update/add-item paths already persist
          foldLengthCm: item.foldLengthCm ?? null,
          weaverId: item.weaverId ?? null, // Phase 1b: optional at ordering; the GRN line records what came
        };
      })
    );

    const totals = poTotalsOf(itemsWithTotals);

    // Split delivery: per-line places → one plan, written by the ONE plan writer in the same transaction
    const deliveryPlan = planFromItemDeliveries(
      itemsWithTotals.map((item, i) => ({ id: item.id, deliveries: data.items[i].deliveries }))
    );

    // Where it delivers: the place sent (null = "to be advised", chosen on purpose). A place LEFT OUT is the
    // category's default — our store for everything but greige and greige lace (po-default-delivery.helper,
    // owner 2026-09-29). A split plan sets the header itself.
    const deliveryLocationId =
      data.deliveryLocationId !== undefined || deliveryPlan
        ? data.deliveryLocationId || null
        : await defaultDeliveryLocationId(prisma, data.poCategory);

    // Derive delivery location type from warehouse if provided
    let deliveryLocationType: 'WAREHOUSE' | 'PROCESSOR' | null = null;
    if (deliveryLocationId) {
      const warehouse = await prisma.warehouses.findUnique({
        where: { id: deliveryLocationId },
      });
      if (warehouse) {
        // JOB_WORK warehouses are processor locations
        deliveryLocationType = warehouse.warehouseType === 'JOB_WORK' ? 'PROCESSOR' : 'WAREHOUSE';
      }
    }

    // Create PO with items in transaction
    const poId = randomUUID();
    const purchaseOrder = await prisma.$transaction(async (tx) => {
      // Numbered only now, every check passed. The number is still today's series (PO2609-…) whatever
      // PO date is typed — the date is the document's, the number is the order it was entered in.
      const poNumber = await this.generatePONumber(tx);
      await tx.purchase_orders.create({
        data: {
          id: poId,
          poNumber,
          supplierId: data.supplierId,
          // Omitted = the column default, now()
          poDate: data.poDate ? new Date(data.poDate) : undefined,
          expectedDeliveryDate: new Date(data.expectedDeliveryDate),
          status: PurchaseOrderStatus.DRAFT,
          poSource: POSource.MANUAL,
          poCategory: (data.poCategory as POCategory | undefined) || undefined,
          ...totals,
          isInterstate,
          paymentTerms: data.paymentTerms || supplier.paymentTerms || null,
          remarks: data.remarks || null,
          createdById: userId,
          // Optional traceability links (for Manual POs)
          styleId: data.styleId || null,
          orderId: data.orderId || null,
          cadId: data.cadId || null,
          // Delivery location (type derived from warehouse)
          deliveryLocationType,
          deliveryLocationId,
          originalDeliveryLocationId: deliveryLocationId, // Same as initial
          purchase_order_items: {
            create: itemsWithTotals,
          },
        },
      });
      if (deliveryPlan) await applyDeliveryPlan(tx, poId, deliveryPlan, { userId, revision: false });
      return tx.purchase_orders.findUniqueOrThrow({ where: { id: poId }, include: this.getFullInclude() });
    });

    return purchaseOrder;
  }

  /**
   * Get all purchase orders with filters and pagination
   */
  async getAllPurchaseOrders(filters?: PurchaseOrderFilters) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.purchase_ordersWhereInput = {};
    // Conditions that must narrow ALONGSIDE the plain column filters (they share a key with one, or
    // carry their own OR). applySearch appends to the same AND below.
    const and: Prisma.purchase_ordersWhereInput[] = [];

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.supplierId) {
      where.supplierId = filters.supplierId;
    }

    // A PO buys for an order in one of two homes: its own orderId (a manual PO's traceability link)
    // or — for every MRP-generated PO, which never sets orderId — a requirement link back to that
    // order. Filtering on the column alone found none of the MRP POs.
    if (filters?.orderId) {
      and.push({
        OR: [
          { orderId: filters.orderId },
          { requirement_po_links: { some: { material_requirements: { orderId: filters.orderId } } } },
        ],
      });
    }

    if (filters?.serviceWorkOrderId) {
      where.serviceWorkOrderId = filters.serviceWorkOrderId;
    }

    if (filters?.source) {
      where.poSource = filters.source;
    }

    // No place decided yet — a split PO's header mirrors point 1, so an empty header IS "to be advised".
    // Only a PO still waiting for goods can need a place: a finished one (received, closed short,
    // cancelled) with an empty header is a legacy row, not something to advise (5 RECEIVED POs matched).
    // ANDed, so an explicit status filter still narrows rather than being overwritten.
    if (filters?.delivery === 'TO_BE_ADVISED') {
      where.deliveryLocationId = null;
      and.push({ status: { notIn: [...FINISHED_STATUSES] } });
    }

    if (filters?.poCategories && filters.poCategories.length > 0) {
      where.poCategory = { in: filters.poCategories as POCategory[] };
    }

    if (and.length > 0) {
      where.AND = and;
    }

    // What is actually ON the PO — the material and the style it is being bought for — was not
    // searchable, so finding "the PO for that elastic" meant paging through the list. The style has
    // two homes like the order does: the PO's own styleId (manual) and the requirement links (MRP).
    applySearch(where as Record<string, unknown>, filters?.search, [
      'poNumber',
      'suppliers.name',
      'suppliers.code',
      'style.styleCode',
      'style.buyerStyleRef',
      'style.styleName',
      'requirement_po_links[].material_requirements.order_items.styles.styleCode',
      'requirement_po_links[].material_requirements.order_items.styles.buyerStyleRef',
      'requirement_po_links[].material_requirements.order_items.styles.styleName',
      'purchase_order_items[].materials.name',
      'purchase_order_items[].materials.code',
      'remarks',
    ]);

    if (filters?.startDate || filters?.endDate) {
      where.poDate = {};
      if (filters?.startDate) {
        where.poDate.gte = new Date(filters.startDate);
      }
      if (filters?.endDate) {
        where.poDate.lte = new Date(filters.endDate);
      }
    }

    const sortBy = filters?.sortBy || 'createdAt';
    const sortOrder = filters?.sortOrder || 'desc';

    const [purchaseOrders, total] = await Promise.all([
      prisma.purchase_orders.findMany({
        where,
        skip,
        take: limit,
        // id breaks ties (several POs share a PO date now that it is typed) so pages never overlap
        orderBy: [{ [sortBy]: sortOrder }, { id: 'asc' }],
        include: {
          suppliers: {
            select: {
              id: true,
              code: true,
              name: true,
              contactPerson: true,
              email: true,
              phone: true,
              paymentTerms: true,
            },
          },
          // The list shows WHAT is on each PO, not only its category — in the PO page's line order,
          // with the label + size of a label size row so the list can show "Label · N sizes", and the
          // master FKs its whose-and-what detail line is read through
          purchase_order_items: {
            orderBy: PO_LINE_ORDER,
            include: {
              materials: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  unit: true,
                  ...LABEL_LINE_MATERIAL_SELECT,
                  ...MATERIAL_DETAIL_SELECT, // + materialType
                },
              },
            },
          },
        },
      }),
      prisma.purchase_orders.count({ where }),
    ]);

    return {
      data: (await withLineDetails(purchaseOrders)).map((po) => ({
        ...po,
        itemCount: po.purchase_order_items.length,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single purchase order by ID with all relations
   */
  async getPurchaseOrderById(id: string) {
    const purchaseOrder = await prisma.purchase_orders.findUnique({
      where: { id },
      include: this.getFullInclude(),
    });

    if (!purchaseOrder) {
      throw new NotFoundError('Purchase order');
    }

    const [withDetails] = await withLineDetails([purchaseOrder]);
    return withDetails;
  }

  /**
   * Get purchase orders by supplier
   */
  async getPurchaseOrdersBySupplier(supplierId: string, filters?: PurchaseOrderFilters) {
    return this.getAllPurchaseOrders({ ...filters, supplierId });
  }

  /**
   * Update a purchase order (DRAFT, PENDING_GREIGE, or READY_FOR_PROCESSING)
   * If items are provided, replaces all existing items
   */
  async updatePurchaseOrder(id: string, data: UpdatePurchaseOrderDTO) {
    const existingPO = await prisma.purchase_orders.findUnique({
      where: { id },
    });

    if (!existingPO) {
      throw new NotFoundError('Purchase order');
    }

    // Editable while it is still being composed — the same "not yet sent" set the delivery plan uses
    if (!PRE_SEND_STATUSES.includes(existingPO.status)) {
      throw new BusinessError(
        `${existingPO.poNumber} is ${existingPO.status} — a purchase order can only be edited before it is sent ` +
          `(Draft, Pending Greige or Ready for Processing).`,
        { code: 'PO_NOT_EDITABLE', status: existingPO.status }
      );
    }

    assertPoDateNotFuture(data.poDate);
    // Whichever of the two dates is sent, against the other as sent or as stored
    if (data.expectedDeliveryDate || data.poDate) {
      assertDeliveryNotBeforePoDate(
        data.expectedDeliveryDate ?? existingPO.expectedDeliveryDate,
        data.poDate ?? existingPO.poDate
      );
    }

    // Validate supplier if being changed
    const supplierChanged = !!data.supplierId && data.supplierId !== existingPO.supplierId;
    if (supplierChanged) {
      const supplier = await prisma.suppliers.findUnique({
        where: { id: data.supplierId },
      });
      if (!supplier) {
        throw new BusinessError('Supplier not found');
      }
    }

    // If items are provided, validate and replace all existing items
    if (data.items && data.items.length > 0) {
      // Validate items: each must have either materialId OR serviceType
      for (const item of data.items) {
        if (!item.materialId && !item.serviceType) {
          throw new ValidationError('Each item must have either a materialId or a serviceType');
        }
      }

      // Validate materials exist for material-based items (batch query to avoid N+1)
      const materialIds = data.items.filter((item) => item.materialId).map((item) => item.materialId!);
      if (materialIds.length > 0) {
        const existingMaterials = await prisma.materials.findMany({
          where: { id: { in: materialIds } },
          select: { id: true },
        });
        const existingMaterialIds = new Set(existingMaterials.map((m) => m.id));
        for (const materialId of materialIds) {
          if (!existingMaterialIds.has(materialId)) {
            throw new BusinessError(`Material with ID ${materialId} not found`);
          }
        }
      }

      // The category is the PO's own (an edit never changes it) — each line must belong on it
      await assertPoLinesFitCategory(existingPO.poCategory, data.items);
    }

    // The lines as saved (existing ids kept, new ids minted) — so a split's per-line places can be
    // matched to them after the reconcile
    const savedLines: Array<{ id: string; deliveries?: Array<{ warehouseId: string; quantity: number }> | null }> = [];

    // Use transaction to update PO and replace items atomically
    const purchaseOrder = await prisma.$transaction(async (tx) => {
      // Update PO header
      const updatedPO = await tx.purchase_orders.update({
        where: { id },
        data: {
          supplierId: data.supplierId,
          expectedDeliveryDate: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : undefined,
          poDate: data.poDate ? new Date(data.poDate) : undefined,
          paymentTerms: data.paymentTerms,
          // null or '' clears them; absent leaves them
          remarks: data.remarks === undefined ? undefined : data.remarks?.trim() || null,
          // Optional traceability links (for Manual POs)
          styleId: data.styleId !== undefined ? data.styleId : undefined,
          orderId: data.orderId !== undefined ? data.orderId : undefined,
          cadId: data.cadId !== undefined ? data.cadId : undefined,
        },
      });

      // If items are provided, reconcile them against what is already on the PO.
      //
      // This used to delete every item and recreate it with a fresh uuid. All four child tables
      // (requirement_po_links, service_requirement_po_links, po_source_links, grn_items) are
      // onDelete: Cascade, so the links vanished while the demand rows they pointed at kept their
      // "already ordered" status — and a requirement in that state is invisible to every re-order
      // path. Editing only the delivery date on an MRP-generated PO was enough: the material was
      // then never bought and nothing said so.
      //
      // So: keep the item ids. A line the client names by id is UPDATED in place, which leaves every
      // link untouched. Only genuinely removed lines are deleted, and their demand is handed back
      // first.
      if (data.items) {
        const existingItems = await tx.purchase_order_items.findMany({
          where: { poId: id },
          select: {
            id: true,
            materialId: true,
            serviceType: true,
            receivedQuantity: true,
            threadPackagingType: true,
            threadPly: true,
          },
        });
        const existingById = new Map(existingItems.map((i) => [i.id, i]));

        // Resolve each incoming line to an existing row. Explicit id wins. Failing that — older
        // clients send no ids — fall back to materialId, but ONLY when that material appears exactly
        // once on each side, so the match is a fact rather than a guess. Positional pairing is what
        // crossed the cost-sheet rates; it is not repeated here.
        const countBy = <T>(xs: T[], key: (x: T) => string | null | undefined) => {
          const m = new Map<string, number>();
          for (const x of xs) {
            const k = key(x);
            if (k) m.set(k, (m.get(k) ?? 0) + 1);
          }
          return m;
        };
        const existingByMaterial = countBy(existingItems, (i) => i.materialId);
        const incomingByMaterial = countBy(data.items, (i) => i.materialId);
        const claimed = new Set<string>();

        const resolved = data.items.map((item) => {
          const declared = item.id && existingById.has(item.id) && !claimed.has(item.id) ? item.id : undefined;
          if (declared) {
            claimed.add(declared);
            return { item, existingId: declared };
          }
          const mid = item.materialId;
          if (mid && existingByMaterial.get(mid) === 1 && incomingByMaterial.get(mid) === 1) {
            const match = existingItems.find((e) => e.materialId === mid && !claimed.has(e.id));
            if (match) {
              claimed.add(match.id);
              return { item, existingId: match.id };
            }
          }
          return { item, existingId: undefined as string | undefined };
        });

        const removedIds = existingItems.map((i) => i.id).filter((iid) => !claimed.has(iid));
        if (removedIds.length > 0) {
          // Hand the demand back BEFORE the cascade takes the links with it. Throws if any of these
          // lines has already received goods.
          await releasePurchaseOrderItemLinks(tx, removedIds, existingPO.poNumber);
          await tx.purchase_order_items.deleteMany({ where: { id: { in: removedIds } } });
        }

        // Write the kept and new lines with GST
        if (data.items.length > 0) {
          const supplierId = data.supplierId || existingPO.supplierId;
          const { isInterstate } = await gstService.isInterstatePO(supplierId);

          // Every kept or new line re-derives its unit + factor (a line added on edit got no factor before).
          // A kept thread line the client re-sends without its pack keeps the pack it was ordered in.
          const lineUnits = await resolvePoLineUnits(
            resolved.map(({ item, existingId }) => {
              const kept = existingId ? existingById.get(existingId) : undefined;
              return {
                ...item,
                threadPackagingType: item.threadPackagingType ?? kept?.threadPackagingType,
                threadPly: item.threadPly ?? kept?.threadPly,
              };
            }),
            tx
          );

          for (const [i, { item, existingId }] of resolved.entries()) {
            const { unitPrice, totalPrice } = priceLine(item.orderedQuantity, item.unitPrice);

            // GST: a typed rate IS the line's rate (0 included); else the material's, by its HSN — the
            // HSN sent, else the service's SAC, else the material's own
            const gst = await gstService.calculateLineItemGST({
              lineTotal: totalPrice,
              materialId: item.materialId || null,
              hsnSacCode:
                item.hsnCode ||
                (item.serviceType
                  ? (await gstService.getSACCodeForService(item.serviceType as ServiceType)).sacCode
                  : null),
              gstRateOverride: item.gstRate ?? null,
              isInterstate,
              unitPrice,
            });

            const lineData = {
              materialId: item.materialId || null,
              serviceType: (item.serviceType as ServiceType) || null,
              serviceDescription: item.serviceDescription || null,
              orderedQuantity: item.orderedQuantity,
              unit: lineUnits[i].unit,
              stockUnitsPerUnit: lineUnits[i].stockUnitsPerUnit,
              threadPackagingType: lineUnits[i].threadPackagingType,
              threadPly: lineUnits[i].threadPly,
              unitPrice,
              totalPrice,
              hsnCode: gst.hsnCode,
              gstRate: gst.gstRate,
              cgstRate: gst.cgstRate,
              cgstAmount: gst.cgstAmount,
              sgstRate: gst.sgstRate,
              sgstAmount: gst.sgstAmount,
              igstRate: gst.igstRate,
              igstAmount: gst.igstAmount,
              taxAmount: gst.taxAmount,
              remarks: item.remarks || null,
              foldLengthCm: item.foldLengthCm ?? null,
              weaverId: item.weaverId ?? null,
            };

            if (existingId) {
              // In place — the id survives, so every link pointing at this line survives with it.
              // receivedQuantity is deliberately NOT written: it is the receipt ledger's column,
              // and resetting it here is what made the old rebuild lose delivery history.
              await tx.purchase_order_items.update({ where: { id: existingId }, data: lineData });
              savedLines.push({ id: existingId, deliveries: item.deliveries });
            } else {
              const newLineId = randomUUID();
              await tx.purchase_order_items.create({
                data: { id: newLineId, poId: id, receivedQuantity: 0, ...lineData },
              });
              savedLines.push({ id: newLineId, deliveries: item.deliveries });
            }
          }

          // The header from the lines now on the PO, the one way every writer adds it up
          await tx.purchase_orders.update({ where: { id }, data: { isInterstate } });
          await this.recalculatePOTotal(id, tx);
        }
      } else if (supplierChanged) {
        await this.resplitLineTax(tx, id, data.supplierId!);
      }

      // Where it delivers (not yet sent — composing the PO, so no revision). Per-line places win; else
      // a header place is ONE_PLACE (it used to be accepted and silently dropped); else a split PO whose
      // lines changed puts each line's difference on point 1.
      const linePlan = data.items ? planFromItemDeliveries(savedLines) : null;
      if (linePlan) {
        await applyDeliveryPlan(tx, id, linePlan, { userId: updatedPO.createdById, revision: false });
      } else if (data.deliveryLocationId !== undefined) {
        const splitPoints = await tx.po_delivery_points.count({ where: { poId: id } });
        if (splitPoints > 0) {
          if (data.items) await rebalanceSplitToFirstPoint(tx, id);
        } else {
          await applyDeliveryPlan(
            tx,
            id,
            data.deliveryLocationId
              ? { mode: 'ONE_PLACE', warehouseId: data.deliveryLocationId }
              : { mode: 'TO_BE_ADVISED' },
            { userId: updatedPO.createdById, revision: false }
          );
        }
      } else if (data.items) {
        await rebalanceSplitToFirstPoint(tx, id);
      }

      // Fetch and return the updated PO with all includes
      return tx.purchase_orders.findUnique({
        where: { id },
        include: this.getFullInclude(),
      });
    });

    return purchaseOrder;
  }

  /**
   * Delete a purchase order (only in DRAFT status)
   * Handles linked records (JWO, service requirements, requirement_po_links, etc.) first
   */
  async deletePurchaseOrder(id: string) {
    const existingPO = await prisma.purchase_orders.findUnique({
      where: { id },
      include: {
        jobWorkOrder: { select: { id: true } }, // 1:1 relation
        work_order_service_requirements: { select: { id: true } },
        requirement_po_links: { select: { id: true } },
      },
    });

    if (!existingPO) {
      throw new NotFoundError('Purchase order');
    }

    if (existingPO.status !== PurchaseOrderStatus.DRAFT) {
      throw new BusinessError(
        `${existingPO.poNumber} is ${existingPO.status} — only a draft purchase order can be deleted. ` +
          `Cancel it instead (or close it short if goods have arrived).`,
        { code: 'PO_NOT_DRAFT', status: existingPO.status }
      );
    }

    // Use transaction to handle linked records
    await prisma.$transaction(async (tx) => {
      // Hand the demand back to the plan before the PO (and its cascading item links) disappear.
      // Deleting the links alone left every linked requirement sitting at PO_GENERATED with nothing
      // to point at — unbuyable for ever, the same strand that PO editing suffered.
      const items = await tx.purchase_order_items.findMany({ where: { poId: id }, select: { id: true } });
      await releasePurchaseOrderItemLinks(
        tx,
        items.map((i) => i.id),
        existingPO.poNumber
      );

      // Any links keyed on the PO rather than on one of its items (belt and braces — the helper
      // already removed the item-keyed ones).
      if (existingPO.requirement_po_links?.length > 0) {
        await tx.requirement_po_links.deleteMany({
          where: { purchaseOrderId: id },
        });
      }

      // Unlink any job_work_orders that reference this PO (1:1 relation)
      if (existingPO.jobWorkOrder) {
        await tx.job_work_orders.update({
          where: { id: existingPO.jobWorkOrder.id },
          data: { purchaseOrderId: null },
        });
      }

      // Unlink any work_order_service_requirements that reference this PO
      if (existingPO.work_order_service_requirements?.length > 0) {
        await tx.work_order_service_requirements.updateMany({
          where: { purchaseOrderId: id },
          data: { purchaseOrderId: null },
        });
      }

      // Now delete the PO (items cascade automatically)
      await tx.purchase_orders.delete({
        where: { id },
      });
    });

    return { message: 'Purchase order deleted successfully' };
  }

  // ============================================
  // Item Management
  // ============================================

  /**
   * Add an item to a purchase order
   */
  async addPurchaseOrderItem(poId: string, item: PurchaseOrderItemDTO) {
    const existingPO = await prisma.purchase_orders.findUnique({
      where: { id: poId },
    });

    if (!existingPO) {
      throw new NotFoundError('Purchase order');
    }

    if (existingPO.status !== PurchaseOrderStatus.DRAFT) {
      throw new BusinessError(`${existingPO.poNumber} is ${existingPO.status} — lines can only be added to a draft.`, {
        code: 'PO_NOT_DRAFT',
        status: existingPO.status,
      });
    }

    // Validate: either materialId OR serviceType is required
    if (!item.materialId && !item.serviceType) {
      throw new ValidationError('Either material ID or service type is required');
    }

    // Validate material exists if materialId is provided
    if (item.materialId) {
      const material = await prisma.materials.findUnique({
        where: { id: item.materialId },
      });

      if (!material) {
        throw new BusinessError('Material not found');
      }
    }

    // The new line must belong on the PO's own category
    await assertPoLinesFitCategory(existingPO.poCategory, [item]);

    const { unitPrice, totalPrice } = priceLine(item.orderedQuantity, item.unitPrice);
    const [lineUnit] = await resolvePoLineUnits([item]);

    // GST: a typed rate IS the line's rate (0 included); else the material's, by its HSN
    const { isInterstate } = await gstService.isInterstatePO(existingPO.supplierId);
    const gst = await gstService.calculateLineItemGST({
      lineTotal: totalPrice,
      hsnSacCode: item.hsnCode || null,
      materialId: item.materialId,
      gstRateOverride: item.gstRate ?? null,
      isInterstate,
      unitPrice,
    });

    // Item write + header recompute atomically (bug-hunt procurement-19)
    const newItem = await prisma.$transaction(async (tx) => {
      const created = await tx.purchase_order_items.create({
        data: {
          id: randomUUID(),
          poId,
          materialId: item.materialId || null,
          serviceType: (item.serviceType as ServiceType) || null,
          serviceDescription: item.serviceDescription || null,
          orderedQuantity: item.orderedQuantity,
          receivedQuantity: 0,
          unit: lineUnit.unit,
          stockUnitsPerUnit: lineUnit.stockUnitsPerUnit,
          threadPackagingType: lineUnit.threadPackagingType,
          threadPly: lineUnit.threadPly,
          unitPrice,
          totalPrice,
          hsnCode: gst.hsnCode,
          gstRate: gst.gstRate,
          cgstRate: gst.cgstRate,
          cgstAmount: gst.cgstAmount,
          sgstRate: gst.sgstRate,
          sgstAmount: gst.sgstAmount,
          igstRate: gst.igstRate,
          igstAmount: gst.igstAmount,
          taxAmount: gst.taxAmount,
          remarks: item.remarks || null,
          foldLengthCm: item.foldLengthCm ?? null,
          weaverId: item.weaverId ?? null,
        },
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
        },
      });

      // Recalculate PO total (now includes GST)
      await this.recalculatePOTotal(poId, tx);
      // A split PO keeps adding up: the new line goes to point 1
      await rebalanceSplitToFirstPoint(tx, poId);

      return created;
    });

    return newItem;
  }

  /**
   * Update a purchase order item
   */
  async updatePurchaseOrderItem(poId: string, itemId: string, data: UpdatePurchaseOrderItemDTO) {
    const existingPO = await prisma.purchase_orders.findUnique({
      where: { id: poId },
    });

    if (!existingPO) {
      throw new NotFoundError('Purchase order');
    }

    if (!PRE_SEND_STATUSES.includes(existingPO.status)) {
      throw new BusinessError(
        `${existingPO.poNumber} is ${existingPO.status} — its lines can only be changed before it is sent ` +
          `(Draft, Pending Greige or Ready for Processing).`,
        { code: 'PO_NOT_EDITABLE', status: existingPO.status }
      );
    }

    const existingItem = await prisma.purchase_order_items.findFirst({
      where: { id: itemId, poId },
    });

    if (!existingItem) {
      throw new NotFoundError('Purchase order item');
    }

    const orderedQuantity = data.orderedQuantity ?? Number(existingItem.orderedQuantity);
    const priced = priceLine(orderedQuantity, data.unitPrice ?? Number(existingItem.unitPrice));
    // A unit change re-derives the factor with it (the old factor must never outlive its unit)
    const [lineUnit] = await resolvePoLineUnits([
      {
        materialId: existingItem.materialId,
        unit: data.unit ?? existingItem.unit,
        threadPackagingType: data.threadPackagingType ?? existingItem.threadPackagingType,
        threadPly: data.threadPly ?? existingItem.threadPly,
      },
    ]);

    // Recalculate GST on the new amount. A line keeps the rate and HSN it was saved with unless new ones are
    // sent — re-resolving from the material would silently drop a rate typed on the form. null = the
    // material's again.
    const { isInterstate } = await gstService.isInterstatePO(existingPO.supplierId);
    const keptRate = existingItem.gstRate != null ? Number(existingItem.gstRate) : null;
    const gst = await gstService.calculateLineItemGST({
      lineTotal: priced.totalPrice,
      hsnSacCode: data.hsnCode !== undefined ? data.hsnCode || null : existingItem.hsnCode,
      materialId: existingItem.materialId || undefined,
      gstRateOverride: data.gstRate !== undefined ? data.gstRate : keptRate,
      isInterstate,
      unitPrice: priced.unitPrice,
    });

    // Item write + header recompute atomically (bug-hunt procurement-19)
    const updatedItem = await prisma.$transaction(async (tx) => {
      const updated = await tx.purchase_order_items.update({
        where: { id: itemId },
        data: {
          orderedQuantity: data.orderedQuantity,
          unit: lineUnit.unit,
          stockUnitsPerUnit: lineUnit.stockUnitsPerUnit,
          threadPackagingType: lineUnit.threadPackagingType,
          threadPly: lineUnit.threadPly,
          unitPrice: priced.unitPrice,
          totalPrice: priced.totalPrice,
          hsnCode: gst.hsnCode,
          gstRate: gst.gstRate,
          cgstRate: gst.cgstRate,
          cgstAmount: gst.cgstAmount,
          sgstRate: gst.sgstRate,
          sgstAmount: gst.sgstAmount,
          igstRate: gst.igstRate,
          igstAmount: gst.igstAmount,
          taxAmount: gst.taxAmount,
          remarks: data.remarks,
        },
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
        },
      });

      // Recalculate PO total
      await this.recalculatePOTotal(poId, tx);
      // A split PO keeps adding up: the line's difference goes to point 1
      await rebalanceSplitToFirstPoint(tx, poId);

      return updated;
    });

    return updatedItem;
  }

  /**
   * Remove an item from a purchase order
   */
  async removePurchaseOrderItem(poId: string, itemId: string) {
    const existingPO = await prisma.purchase_orders.findUnique({
      where: { id: poId },
    });

    if (!existingPO) {
      throw new NotFoundError('Purchase order');
    }

    if (existingPO.status !== PurchaseOrderStatus.DRAFT) {
      throw new BusinessError(
        `${existingPO.poNumber} is ${existingPO.status} — lines can only be removed from a draft.`,
        { code: 'PO_NOT_DRAFT', status: existingPO.status }
      );
    }

    const existingItem = await prisma.purchase_order_items.findFirst({
      where: { id: itemId, poId },
    });

    if (!existingItem) {
      throw new NotFoundError('Purchase order item');
    }

    // Item delete + header recompute atomically (bug-hunt procurement-19)
    await prisma.$transaction(async (tx) => {
      // Hand the demand back first. This delete cascades requirement_po_links,
      // service_requirement_po_links and po_source_links away, and without the revert the
      // requirement behind the line stays "already ordered" pointing at nothing — unbuyable, and
      // silent. Same strand as the PO edit and delete paths (silent-data-loss #17).
      await releasePurchaseOrderItemLinks(tx, [itemId], existingPO.poNumber);

      await tx.purchase_order_items.delete({
        where: { id: itemId },
      });

      // Recalculate PO total
      await this.recalculatePOTotal(poId, tx);
      // A split PO keeps adding up: the line's difference goes to point 1
      await rebalanceSplitToFirstPoint(tx, poId);
    });

    return { message: 'Item removed successfully' };
  }

  // ============================================
  // Status Transitions
  // ============================================

  /**
   * Send purchase order to supplier (DRAFT -> SENT or READY_FOR_PROCESSING -> SENT)
   */
  async sendPurchaseOrder(id: string, userId: string) {
    const existingPO = await prisma.purchase_orders.findUnique({
      where: { id },
      include: { purchase_order_items: true },
    });

    if (!existingPO) {
      throw new NotFoundError('Purchase order');
    }

    // Allow sending from DRAFT or READY_FOR_PROCESSING status
    if (
      existingPO.status !== PurchaseOrderStatus.DRAFT &&
      existingPO.status !== PurchaseOrderStatus.READY_FOR_PROCESSING
    ) {
      throw new BusinessError(
        `${existingPO.poNumber} is ${existingPO.status} — only a draft (or a processing PO ready for processing) can be sent.`,
        { code: 'PO_CANNOT_SEND', status: existingPO.status }
      );
    }

    if (existingPO.purchase_order_items.length === 0) {
      throw new BusinessError(`${existingPO.poNumber} has no lines — add at least one before sending it.`, {
        code: 'PO_NO_ITEMS',
      });
    }

    const purchaseOrder = await prisma.purchase_orders.update({
      where: { id },
      data: {
        status: PurchaseOrderStatus.SENT,
        // Landmine №7 note: this records WHO SENT the PO (there is no dedicated sentById
        // column). No screen currently renders it as "Approved by" — if one ever does,
        // label it "Sent by" or add a real sentById column first.
        approvedById: userId,
      },
      include: this.getFullInclude(),
    });

    return purchaseOrder;
  }

  /**
   * Acknowledge purchase order (SENT -> ACKNOWLEDGED)
   */
  async acknowledgePurchaseOrder(id: string) {
    const existingPO = await prisma.purchase_orders.findUnique({
      where: { id },
    });

    if (!existingPO) {
      throw new NotFoundError('Purchase order');
    }

    if (existingPO.status !== PurchaseOrderStatus.SENT) {
      throw new BusinessError(
        `${existingPO.poNumber} is ${existingPO.status} — only a sent purchase order can be acknowledged.`,
        { code: 'PO_CANNOT_ACKNOWLEDGE', status: existingPO.status }
      );
    }

    const purchaseOrder = await prisma.purchase_orders.update({
      where: { id },
      data: { status: PurchaseOrderStatus.ACKNOWLEDGED },
      include: this.getFullInclude(),
    });

    return purchaseOrder;
  }

  /**
   * Cancel a purchase order — the supplier will deliver nothing (more) against it.
   *
   * Refusals (422, details.code — the PO screens branch on them, contract in plan lucky-globe):
   *   PO_ALREADY_CANCELLED    a second cancel used to overwrite who/when and append a second reason
   *   PO_DRAFT_DELETE_INSTEAD a draft was never sent — delete it (owner decision 2026-09-27)
   *   PO_SHORT_CLOSED         settled at what was delivered; the short is already on the books
   *   PO_GOODS_RECEIVED       goods arrived — Close Short is the exit, unless an ADMIN passes force
   *   PO_GRN_PENDING_QC       a receipt is still being checked (every cancel, forced or not)
   *   PO_STATUS_CHANGED       the PO moved on between loading it and cancelling it
   * `force` from anyone but an ADMIN is a 403. It used to be implicit: validateTransition hands every
   * ADMIN (12 of 18 users) an override, so a stale row's Cancel cancelled a part-received PO, reset
   * requirements whose goods were still in QC, and let those goods be booked against a CANCELLED
   * PO while the material was re-ordered — a double purchase (RA-1).
   */
  async cancelPurchaseOrder(
    id: string,
    reason: string,
    userRole?: string,
    cancelledById?: string,
    opts: { force?: boolean } = {}
  ) {
    const force = opts.force === true;
    const existingPO = await prisma.purchase_orders.findUnique({
      where: { id },
    });

    if (!existingPO) {
      throw new NotFoundError('Purchase order');
    }
    const { poNumber, status } = existingPO;

    // The same hardcoded floor requireAdmin() applies — NOT requirePermissionForWrites('admin'), whose
    // key every role holds in this deployment's role_permissions.
    if (force && userRole !== UserRole.ADMIN) {
      throw new ForbiddenError('Only an administrator can force-cancel a purchase order.');
    }

    if (status === PurchaseOrderStatus.CANCELLED) {
      throw new BusinessError(`${poNumber} is already cancelled.`, { code: 'PO_ALREADY_CANCELLED' });
    }

    if (status === PurchaseOrderStatus.DRAFT) {
      throw new BusinessError(`${poNumber} is a draft that was never sent — delete it instead of cancelling it.`, {
        code: 'PO_DRAFT_DELETE_INSTEAD',
      });
    }

    // Hard precondition, NOT subject to force: a short-closed PO has already been settled at the
    // delivered quantity, and its requirements carry shortQuantity + shortCloseReason. Cancelling on
    // top would claim nothing was delivered while that evidence is still on the books, and cancel's
    // own repair logic is a no-op there (the zero-received links are already gone and the kept link
    // has no remainder), so the contradiction would simply persist.
    if (status === PurchaseOrderStatus.SHORT_CLOSED) {
      throw new BusinessError(
        `${poNumber} is closed short — it cannot also be cancelled. Goods were delivered ` +
          `against it and the shortfall is already recorded.`,
        { code: 'PO_SHORT_CLOSED' }
      );
    }

    // Goods arrived: cancelling claims they did not (the supplier ledger, payments and GST all saw a
    // real receipt). Close Short ends a part-delivered PO honestly; an ADMIN may still force a cancel
    // to correct a genuine mistake, with a typed reason, and it is logged.
    const goodsReceived = status === PurchaseOrderStatus.PARTIALLY_RECEIVED || status === PurchaseOrderStatus.RECEIVED;
    if (goodsReceived && !force) {
      throw new BusinessError(
        status === PurchaseOrderStatus.PARTIALLY_RECEIVED
          ? `Goods have been received against ${poNumber} — use Close Short to end it at what arrived.`
          : `Goods have been received against ${poNumber} — it is fully received and cannot be cancelled.`,
        { code: 'PO_GOODS_RECEIVED', status }
      );
    }

    // Strict for a plain cancel (no role → no implicit ADMIN override); the role goes in only for an
    // explicit, already-admin-checked force.
    const transition = validateTransition('purchaseOrder', status, 'CANCELLED', force ? userRole : undefined);
    if (!transition.valid) {
      throw new BusinessError(transition.message || `${poNumber} cannot be cancelled.`, {
        code: 'PO_CANNOT_CANCEL',
        status,
      });
    }

    await assertNoGrnAwaitingQc(id, poNumber, 'cancel');

    const purchaseOrder = await prisma.$transaction(async (tx) => {
      // 1. Claim the cancel with the status we checked IN the WHERE. The guards above ran outside
      // this transaction: a GRN, a send, or a second cancel (double-click, two tabs) landing in
      // between would otherwise be overwritten — a second cancel used to replace the first one's
      // who/when and append a second reason. Whoever loses the race matches zero rows.
      const claimed = await tx.purchase_orders.updateMany({
        where: { id, status },
        data: {
          status: PurchaseOrderStatus.CANCELLED,
          remarks: `${existingPO.remarks || ''}\n\n${
            transition.isAdminOverride
              ? 'Cancellation reason (forced by admin after goods were received)'
              : 'Cancellation reason'
          }: ${reason}`.trim(),
          // Who cancelled, and when (owner-approved 2026-08-24) — previously nobody was recorded
          cancelledById: cancelledById ?? null,
          cancelledAt: new Date(),
        },
      });
      if (claimed.count === 0) {
        throw new BusinessError(
          `${poNumber} changed while it was being cancelled (it is no longer ${status}) — reload it and try again.`,
          { code: 'PO_STATUS_CHANGED' }
        );
      }

      // Minimal include to avoid relation validation issues
      const po = await tx.purchase_orders.findUniqueOrThrow({ where: { id }, include: this.getMinimalInclude() });

      // 2. Free the linked MRP material requirements so the unfulfilled material can be re-ordered.
      //
      // This used to filter on `status: 'PO_GENERATED'` alone, which matched ZERO rows once the
      // PO had been sent (PO_SENT) or part-delivered (PARTIALLY_RECEIVED) — the two states a
      // cancellation actually happens in. Those requirements stayed pinned to the cancelled PO
      // forever, and the shortfall surfaced as a stock-out at production.
      //
      // Split by what actually arrived (per requirement — its links to this PO summed), mirroring
      // short-close and the job-work-order cancel path:
      //   nothing received → drop the link and hand the demand back;
      //   part received    → the requirement closes RECEIVED at what arrived, and the balance is carried
      //                      forward as its own orderable requirement (the MRP-12 split-remainder shape).
      const shares = await loadRequirementShares(tx, id);
      await freeUndeliveredRequirements(
        tx,
        id,
        poNumber,
        'cancel',
        shares.filter((s) => isQtyZero(s.received)),
        cancelledById
      );

      for (const share of shares.filter((s) => !isQtyZero(s.received))) {
        const requirement = await tx.material_requirements.findUnique({
          where: { id: share.requirementId },
          include: { orders: { select: { status: true } } },
        });
        if (!requirement) continue;

        // Link basis, not the requirement's shortfall: one consolidated PO line can serve several
        // requirements, and a requirement can be allocated across several lines (summed above).
        const balance = toNumber(subtractCurrency(share.allocated, share.received));

        // The original now represents only what was actually delivered — and all of that has arrived.
        // Left PARTIALLY_RECEIVED it waited for goods a cancelled PO will never bring.
        if (!(await settleAtDelivered(tx, requirement.id, share.received))) {
          logWarn(
            `[PO ${poNumber}] cancel: ${requirement.requirementNumber} is ${requirement.status}, not on a PO — ` +
              `left as it is, no balance carried forward`
          );
          continue;
        }

        // Below a paise of dust there is nothing worth re-ordering (same threshold and reasoning as the
        // MRP split-remainder path and short-close). A cancelled order needs nothing more.
        if (balance > 0.01 && requirement.orders?.status !== 'CANCELLED') {
          const child = await mintBalanceChild(tx, requirement, balance, cancelledById);
          logWarn(
            `[PO ${poNumber}] cancelled after ${share.received} of ${share.allocated} received ` +
              `for ${requirement.requirementNumber}; balance ${balance} carried forward as ${child.requirementNumber}`
          );
        }
        // The links are deliberately KEPT: they are the record of what this PO actually delivered.
      }

      // ...and closed at it (change C3): allocated := received on every kept link, so a later order
      // cancel can pass its goods on only as plain stock, never above the shortfall written here.
      await freezeClosedPoLinks(tx, id);

      // 3. Revert linked service requirements → PENDING and drop their links (a kept link would keep
      // the service looking ordered). IN_PROGRESS included for the same reason as above. Only a service
      // requirement still held by THIS PO is reset — one already re-ordered on another PO is not
      // this cancellation's to undo (a re-cancel of an old PO used to reset it, RA-3).
      const serviceLinks = await tx.service_requirement_po_links.findMany({
        where: { purchaseOrderItem: { poId: id } },
        select: { serviceRequirementId: true },
      });
      if (serviceLinks.length > 0) {
        const ids = [...new Set(serviceLinks.map((l) => l.serviceRequirementId))];
        const revertedServices = await tx.work_order_service_requirements.updateMany({
          where: {
            id: { in: ids },
            status: { in: ['PO_GENERATED', 'IN_PROGRESS'] },
            OR: [{ purchaseOrderId: id }, { purchaseOrderId: null }],
          },
          data: { status: 'PENDING', purchaseOrderId: null },
        });
        if (revertedServices.count !== ids.length) {
          logWarn(
            `[PO ${poNumber}] cancel reverted ${revertedServices.count} of ${ids.length} service ` +
              `requirement(s) — the rest were in an unexpected status or held by another PO and may need manual re-planning`
          );
        }
        await tx.service_requirement_po_links.deleteMany({ where: { purchaseOrderItem: { poId: id } } });
      }

      return po;
    });

    // A forced cancel overrides the rule that a PO with goods received is closed short, never
    // cancelled — record who did it and why (the order.service isAdminOverride pattern, plus a row
    // in audit_logs so it survives log rotation).
    if (transition.isAdminOverride) {
      logInfo('Admin override: purchase order force-cancelled', { id, poNumber, from: status, reason });
      await createAuditLog({
        userId: cancelledById ?? 'SYSTEM',
        action: 'UPDATE',
        entityType: 'purchase_order',
        entityId: id,
        oldValues: { status },
        newValues: { status: PurchaseOrderStatus.CANCELLED, forced: true, reason },
      });
    }

    return purchaseOrder;
  }

  /**
   * Short-close a partially-received purchase order.
   *
   * The supplier delivered less than ordered and we are ending the PO rather than chasing the
   * balance. CANCELLED would claim nothing happened (goods were delivered, invoiced, likely paid);
   * RECEIVED would claim it all arrived and corrupt any three-way match. SHORT_CLOSED is the
   * honest terminal state, and it ends the procurement DEMAND only — it moves no stock, and it is
   * not a way to erase goods. Material short-returned by a processor remains abnormal loss
   * recovered by debit note, which the JWO guard below protects.
   *
   * The undelivered balance is NOT re-planned by default; that is the point of the verb. Pass
   * reorderBalance when the balance genuinely is still needed.
   */
  async shortClosePurchaseOrder(
    id: string,
    reason: string,
    userRole?: string,
    shortClosedById?: string,
    reorderBalance = false
  ) {
    const existingPO = await prisma.purchase_orders.findUnique({ where: { id } });
    if (!existingPO) {
      throw new NotFoundError('Purchase order');
    }

    // Hard precondition, NOT subject to the ADMIN override that validateTransition applies. Every
    // other PO transition is a judgement call an admin may force; this one is a statement of fact.
    // Short-closing anything but a part-delivered order fabricates history: on DRAFT/SENT nothing
    // was delivered (that is a cancellation), and on RECEIVED everything was. Either way the
    // shortQuantity written onto the requirements below would be a lie no admin can make true.
    if (existingPO.status !== PurchaseOrderStatus.PARTIALLY_RECEIVED) {
      throw new BusinessError(
        `Only a partially-received purchase order can be closed short (${existingPO.poNumber} is ${existingPO.status}).`
      );
    }

    const transition = validateTransition('purchaseOrder', existingPO.status, 'SHORT_CLOSED', userRole);
    if (!transition.valid) {
      throw new BusinessError(transition.message || `${existingPO.poNumber} cannot be closed short.`);
    }

    // A GRN still awaiting QC means the delivered quantity is NOT settled — closing over it would
    // freeze shortQuantity from provisional numbers and let the later verdict mutate the requirements
    // this close just finalised. The same check guards cancel.
    await assertNoGrnAwaitingQc(id, existingPO.poNumber, 'short-close');

    // Short-close must never become a side door around the JWO debit-note gate: greige short-returned
    // by a processor is abnormal loss to be recovered, not demand to be closed.
    const openJwo = await prisma.job_work_orders.findFirst({
      where: { purchaseOrderId: id, jwoStatus: { notIn: ['CLOSED', 'CANCELLED'] } },
      select: { jobWorkNumber: true },
    });
    if (openJwo) {
      throw new BusinessError(
        `Cannot short-close ${existingPO.poNumber}: job work order ${openJwo.jobWorkNumber} is still open against it. ` +
          `Close that first — any short-returned material must be settled there.`
      );
    }

    const purchaseOrder = await prisma.$transaction(async (tx) => {
      // Claim the close with the precondition IN the WHERE. The guards above ran outside this
      // transaction, so two operators double-clicking (or a retry) would otherwise both pass them
      // and both run the body — minting two balance requirements for one shortfall. Whoever loses
      // the race matches zero rows and is told the order is already closed.
      const claimed = await tx.purchase_orders.updateMany({
        where: { id, status: PurchaseOrderStatus.PARTIALLY_RECEIVED },
        data: {
          status: PurchaseOrderStatus.SHORT_CLOSED,
          shortClosedById: shortClosedById ?? null,
          shortClosedAt: new Date(),
          shortCloseReason: reason,
          remarks: `${existingPO.remarks || ''}\n\nShort-closed: ${reason}`.trim(),
        },
      });
      if (claimed.count === 0) {
        throw new BusinessError(`${existingPO.poNumber} is no longer partially received — it may already be closed.`);
      }

      const po = await tx.purchase_orders.findUniqueOrThrow({
        where: { id },
        include: this.getMinimalInclude(),
      });

      // Per requirement — its links to this PO summed (one per line it was allocated across)
      const links = await loadRequirementShares(tx, id);

      // Nothing delivered on this line — the material is still genuinely needed, so free it
      // exactly as cancellation does (drop the link and hand the demand back, or MRP's duplicate
      // guard keeps skipping it).
      await freeUndeliveredRequirements(
        tx,
        id,
        existingPO.poNumber,
        'short-close',
        links.filter((l) => isQtyZero(l.received)),
        shortClosedById
      );

      // Part-delivered — close at what actually arrived and RECORD the short rather than leaving
      // it to arithmetic. The link is kept: it is the record of what this PO did deliver.
      for (const link of links.filter((l) => !isQtyZero(l.received))) {
        const requirement = await tx.material_requirements.findUnique({
          where: { id: link.requirementId },
          include: { orders: { select: { status: true } } },
        });
        if (!requirement) continue;

        // Link basis, not the PO item's: one consolidated PO line can serve several requirements.
        const received = link.received;
        const short = toNumber(subtractCurrency(link.allocated, received));

        const settled = await settleAtDelivered(tx, requirement.id, received, {
          // Same 0.01 threshold the re-order branch uses below: an allocation-split rounding
          // sliver is not a short supply, and recording it would show a phantom balance.
          shortQuantity: short > 0.01 ? short : null,
          shortCloseReason: short > 0.01 ? reason : null,
        });
        if (!settled) {
          logWarn(
            `[PO ${existingPO.poNumber}] short-close: ${requirement.requirementNumber} is ${requirement.status}, ` +
              `not on a PO — left as it is`
          );
          continue;
        }

        // A cancelled order needs nothing re-ordered
        if (reorderBalance && short > 0.01 && requirement.orders?.status !== 'CANCELLED') {
          const child = await mintBalanceChild(tx, requirement, short, shortClosedById);
          logWarn(
            `[PO ${existingPO.poNumber}] short-closed ${short} short on ${requirement.requirementNumber}; ` +
              `re-order requested, carried forward as ${child.requirementNumber}`
          );
        }
      }

      // The kept links close at what arrived (change C3): a later order cancel passes its goods on only
      // as plain stock, never pushing another link's credit above the shortfall written here.
      await freezeClosedPoLinks(tx, id);

      // Service requirements: same widened filter as cancellation — PO_GENERATED alone left an
      // in-progress service pinned to a closed PO.
      const serviceLinks = await tx.service_requirement_po_links.findMany({
        where: { purchaseOrderItem: { poId: id } },
        select: { serviceRequirementId: true },
      });
      if (serviceLinks.length > 0) {
        const ids = serviceLinks.map((l) => l.serviceRequirementId);
        const revertedServices = await tx.work_order_service_requirements.updateMany({
          where: { id: { in: ids }, status: { in: ['PO_GENERATED', 'IN_PROGRESS'] } },
          data: { status: 'PENDING', purchaseOrderId: null },
        });
        if (revertedServices.count !== ids.length) {
          logWarn(
            `[PO ${existingPO.poNumber}] short-close reverted ${revertedServices.count} of ${ids.length} service ` +
              `requirement(s) — the rest were in an unexpected status and may need manual re-planning`
          );
        }
      }

      return po;
    });

    // A greige PO that is done — short or full — must release its downstream processing POs,
    // reconciled to the greige that actually arrived. Outside the transaction: it is a follow-on
    // reconciliation, and its failure must not undo a legitimate close.
    const warnings: string[] = [];
    if (existingPO.poCategory === 'GREIGE' || existingPO.poCategory === 'GREIGE_LACE') {
      try {
        const readied = await checkProcessingPOReadiness(id);
        if (readied.length > 0) {
          logWarn(`[PO ${existingPO.poNumber}] short-close released ${readied.length} processing PO(s)`);
        }
      } catch (err) {
        // The order IS closed — a reconciliation hiccup must not undo that. But it cannot be
        // retried either: no GRN can ever reach approveGRN on a SHORT_CLOSED PO, and this routine
        // has no other caller. A log line alone would leave the operator unaware that a processing
        // PO is now stranded, so the failure travels back with the response the way grn.service
        // does with its post-commit warnings.
        logWarn(`[PO ${existingPO.poNumber}] short-close: processing-PO readiness check failed`, err);
        warnings.push(
          `${existingPO.poNumber} is closed short, but reconciling its linked processing purchase order(s) ` +
            `failed. Check them — one may still be waiting on greige that is no longer coming.`
        );
      }
    }

    return { ...purchaseOrder, warnings };
  }

  /**
   * Update PO status based on receiving (called from GRN service)
   */
  async updateReceivingStatus(poId: string) {
    const items = await prisma.purchase_order_items.findMany({
      where: { poId },
    });

    if (items.length === 0) {
      return;
    }

    // Within the under-receipt tolerance is RECEIVED — a few centimetres short is not a short-close.
    const underTolerance = await systemSettingsService.getNumberDefault('GRN_UNDER_RECEIPT_TOLERANCE_PERCENT');
    const allFullyReceived = items.every((item) =>
      isReceiptComplete(item.receivedQuantity, item.orderedQuantity, underTolerance)
    );
    const anyPartiallyReceived = items.some((item) => Number(item.receivedQuantity) > 0);

    let newStatus: PurchaseOrderStatus;
    if (allFullyReceived) {
      newStatus = PurchaseOrderStatus.RECEIVED;
    } else if (anyPartiallyReceived) {
      newStatus = PurchaseOrderStatus.PARTIALLY_RECEIVED;
    } else {
      // Nothing received. No longer always a no-op: QC rejection now NETS the received counters back
      // down (grn.service approveGRN), so a 100%-rejected PO arrives here with 0 received while still
      // marked RECEIVED/PARTIALLY_RECEIVED — it must RE-OPEN (review catch). Only the receiving pair
      // is downgraded; DRAFT/SENT/CANCELLED etc. are untouched.
      await prisma.purchase_orders.updateMany({
        where: { id: poId, status: { in: [PurchaseOrderStatus.RECEIVED, PurchaseOrderStatus.PARTIALLY_RECEIVED] } },
        data: { status: PurchaseOrderStatus.ACKNOWLEDGED },
      });
      return;
    }

    // Guarded like the downgrade branch above, and for the same reason one level stronger: this
    // runs after EVERY GRN event (create/approve/reject/reverse), and a GRN's QC verdict can land
    // days after the goods did. A raw update here silently resurrected a TERMINAL purchase order —
    // short-close or cancel a PO with a GRN still awaiting QC, and the verdict flipped it back to
    // PARTIALLY_RECEIVED/RECEIVED, erasing the audit answer and re-admitting new receipts. The
    // state machine cannot help: this path never consults it.
    await prisma.purchase_orders.updateMany({
      where: {
        id: poId,
        status: {
          in: [
            PurchaseOrderStatus.SENT,
            PurchaseOrderStatus.ACKNOWLEDGED,
            PurchaseOrderStatus.PARTIALLY_RECEIVED,
            PurchaseOrderStatus.RECEIVED,
          ],
        },
      },
      data: { status: newStatus },
    });
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Get minimal include for status update operations (cancel, acknowledge, etc.)
   * Uses fewer nested relations to avoid potential Prisma validation issues
   */
  private getMinimalInclude() {
    return {
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
      purchase_order_items: {
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
        },
      },
      users_purchase_orders_createdByIdTousers: {
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
   * Get full include for PO queries
   */
  private getFullInclude() {
    return {
      suppliers: {
        select: {
          id: true,
          code: true,
          name: true,
          contactPerson: true,
          email: true,
          phone: true,
          paymentTerms: true,
          address: true,
          billingPincode: true,
          billing_city: { select: { cityName: true } },
          // stateCode: the form reads the supplier's state as the server does (primary GSTIN → any GSTIN →
          // billing state) to say CGST + SGST or IGST before saving
          billing_state: { select: { stateName: true, stateCode: true } },
          gst_numbers: {
            select: {
              id: true,
              gstNumber: true,
              stateName: true,
              stateCode: true,
              isPrimary: true,
            },
          },
        },
      },
      purchase_order_items: {
        orderBy: PO_LINE_ORDER,
        include: {
          weaver: { select: { id: true, name: true } }, // Phase 1b
          materials: {
            select: {
              id: true,
              code: true,
              name: true,
              unit: true,
              // Width of what is being ORDERED: greige loom width for greige buys,
              // the fabric's actual width for ready-fabric buys. The item's own
              // fabricWidth column is the CAD cutable width — planning-internal,
              // never shown bare on purchase surfaces (industry model 2026-08-18).
              greige_master: { select: { greigeWidth: true } },
              fabric_master: { select: { actualWidth: true } },
              // Which label and size a label size row is — PO pages group a label's sizes
              ...LABEL_LINE_MATERIAL_SELECT,
              // materialType + the master FKs the line's whose-and-what detail is read through (getPurchaseOrderById)
              ...MATERIAL_DETAIL_SELECT,
            },
          },
        },
      },
      users_purchase_orders_createdByIdTousers: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      users_purchase_orders_approvedByIdTousers: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      goods_receiving_notes: {
        select: {
          id: true,
          grnNumber: true,
          receivingDate: true,
          status: true,
          // Where it was booked, and the planned place it delivered against (split delivery)
          warehouseId: true,
          poDeliveryPointId: true,
          warehouses: { select: { id: true, warehouseName: true, warehouseType: true } },
          grn_items: {
            select: {
              receivedQuantity: true,
              acceptedQuantity: true,
            },
          },
        },
      },
      po_source_links: {
        select: {
          id: true,
          sourceType: true,
          materialRequirement: {
            select: {
              id: true,
              requirementNumber: true,
              order_items: {
                select: {
                  styles: { select: { id: true, styleCode: true, buyerStyleRef: true } },
                },
              },
            },
          },
          serviceRequirement: {
            select: {
              id: true,
              serviceType: true,
              workOrder: {
                select: {
                  styles: {
                    select: { id: true, styleCode: true, buyerStyleRef: true },
                  },
                },
              },
            },
          },
          productionRun: {
            select: {
              id: true,
              workOrderNumber: true,
              styles: { select: { id: true, styleCode: true, buyerStyleRef: true } },
            },
          },
        },
      },
      requirement_po_links: {
        select: {
          id: true,
          requirementId: true,
          material_requirements: {
            select: {
              id: true,
              requirementNumber: true,
              order_items: {
                select: {
                  styles: { select: { id: true, styleCode: true, buyerStyleRef: true } },
                },
              },
            },
          },
        },
      },
      // Optional traceability relations (for Manual POs)
      style: {
        select: {
          id: true,
          styleCode: true,
          buyerStyleRef: true,
          styleName: true,
        },
      },
      order: {
        select: {
          id: true,
          orderNumber: true,
          customers: {
            select: { id: true, name: true },
          },
        },
      },
      cad: {
        select: {
          id: true,
          cutableWidth: true,
          cadMeters: true,
          fabric: {
            select: { id: true, fabricName: true, fabricCode: true },
          },
        },
      },
      // Delivery location
      deliveryWarehouse: {
        select: {
          id: true,
          warehouseCode: true,
          warehouseName: true,
          warehouseType: true,
          address: true,
          city: true,
          state: true,
          pincode: true,
          contactPerson: true,
          contactPhone: true,
        },
      },
      deliveryLocationAmendedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      // Split delivery: the places with their share of each line, and every change to the plan
      deliveryPoints: {
        orderBy: { sequence: 'asc' as const },
        select: {
          id: true,
          sequence: true,
          warehouseId: true,
          warehouse: {
            select: {
              id: true,
              warehouseCode: true,
              warehouseName: true,
              warehouseType: true,
              address: true,
              city: true,
              state: true,
              pincode: true,
            },
          },
          lines: { select: { id: true, poItemId: true, quantity: true } },
        },
      },
      deliveryPlanRevisions: {
        orderBy: { revisionNumber: 'desc' as const },
        select: {
          id: true,
          revisionNumber: true,
          kind: true,
          before: true,
          after: true,
          reason: true,
          poStatus: true,
          changedAt: true,
          changedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    };
  }

  /**
   * Get receivable POs for GRN creation
   * Returns POs in SENT, ACKNOWLEDGED, or PARTIALLY_RECEIVED status
   */
  async getReceivablePurchaseOrders(supplierId?: string) {
    const where: Prisma.purchase_ordersWhereInput = {
      status: {
        in: [PurchaseOrderStatus.SENT, PurchaseOrderStatus.ACKNOWLEDGED, PurchaseOrderStatus.PARTIALLY_RECEIVED],
      },
    };

    if (supplierId) {
      where.supplierId = supplierId;
    }

    const purchaseOrders = await prisma.purchase_orders.findMany({
      where,
      include: {
        suppliers: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        purchase_order_items: {
          include: {
            materials: {
              select: {
                id: true,
                code: true,
                name: true,
                unit: true,
                materialType: true,
              },
            },
            requirement_po_links: {
              select: {
                material_requirements: {
                  select: {
                    order_items: {
                      select: {
                        styles: {
                          select: { styleCode: true, styleName: true, buyerStyleRef: true },
                        },
                        orders: {
                          select: {
                            customers: {
                              select: { name: true, code: true },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { expectedDeliveryDate: 'asc' },
    });

    // Extract unique style codes and customer names per PO
    return purchaseOrders.map((po) => {
      const styleCodes = new Set<string>();
      const buyerStyleRefs = new Set<string>();
      // One screen label per style, keyed by our code: 'SP27DR27 (EBWW-021)' (utils/style-code)
      const styleLabels = new Map<string, string>();
      const customerNames = new Set<string>();

      for (const item of po.purchase_order_items) {
        for (const link of item.requirement_po_links) {
          const orderItem = link.material_requirements?.order_items;
          if (orderItem?.styles?.styleCode) {
            styleCodes.add(orderItem.styles.styleCode);
            styleLabels.set(orderItem.styles.styleCode, styleCodeLabel(orderItem.styles));
          }
          if (orderItem?.styles?.buyerStyleRef) {
            buyerStyleRefs.add(orderItem.styles.buyerStyleRef);
          }
          if (orderItem?.orders?.customers?.name) {
            customerNames.add(orderItem.orders.customers.name);
          }
        }
      }

      return {
        ...po,
        styleCodes: Array.from(styleCodes),
        buyerStyleRefs: Array.from(buyerStyleRefs),
        styleLabels: Array.from(styleLabels.values()),
        customerNames: Array.from(customerNames),
      };
    });
  }

  /**
   * Get pending quantities for PO items (for GRN form)
   */
  async getPendingItemsForPO(poId: string) {
    const po = await prisma.purchase_orders.findUnique({
      where: { id: poId },
      include: {
        purchase_order_items: {
          include: {
            materials: {
              select: {
                id: true,
                code: true,
                name: true,
                unit: true,
              },
            },
          },
        },
      },
    });

    if (!po) {
      throw new NotFoundError('Purchase order');
    }

    return po.purchase_order_items.map((item) => ({
      poItemId: item.id,
      materialId: item.materialId,
      materialCode: item.materials?.code || '',
      materialName: item.materials?.name || '',
      unit: item.unit,
      orderedQuantity: Number(item.orderedQuantity),
      receivedQuantity: Number(item.receivedQuantity),
      pendingQuantity: Number(item.orderedQuantity) - Number(item.receivedQuantity),
      unitPrice: Number(item.unitPrice),
    }));
  }

  /**
   * Amend the delivery place to ONE place (the Deliver To field). Kept for its callers; it now goes
   * through the one plan writer, so it writes a revision like every other change, refuses a split PO
   * (use the delivery plan), and needs a reason once the PO has been sent.
   */
  async amendDeliveryLocation(poId: string, deliveryLocationId: string, amendedById: string, reason?: string | null) {
    const splitPoints = await prisma.po_delivery_points.count({ where: { poId } });
    if (splitPoints > 0) {
      throw new BusinessError(
        'This PO is split across several places — change it with Change delivery on the PO page.',
        { code: 'DELIVERY_PO_IS_SPLIT' }
      );
    }
    return this.amendDeliveryPlan(poId, { mode: 'ONE_PLACE', warehouseId: deliveryLocationId }, amendedById, reason);
  }

  /**
   * Change where a PO delivers — one place, a split across places, or back to "to be advised" — with a
   * revision row (who, when, why). PUT /api/purchase-orders/:id/delivery-plan.
   */
  async amendDeliveryPlan(poId: string, plan: DeliveryPlanInput, userId: string, reason?: string | null) {
    const exists = await prisma.purchase_orders.findUnique({ where: { id: poId }, select: { id: true } });
    if (!exists) throw new NotFoundError('Purchase order');
    return prisma.$transaction(async (tx) => {
      await applyDeliveryPlan(tx, poId, plan, { userId, reason, revision: true });
      return tx.purchase_orders.findUniqueOrThrow({ where: { id: poId }, include: this.getFullInclude() });
    });
  }

  /** Planned / received / pending per delivery place (received derived from the receipts, ACTUAL units). */
  async getDeliveryProgress(poId: string) {
    const underTolerance = await systemSettingsService.getNumberDefault('GRN_UNDER_RECEIPT_TOLERANCE_PERCENT');
    return loadDeliveryProgress(prisma, poId, underTolerance);
  }

  /** Where a new PO delivers when nobody picks a place — the Create PO page shows it before the PO is saved. */
  async getDeliveryDefault() {
    return getPoDeliveryDefault(prisma);
  }
}

export const purchaseOrderService = new PurchaseOrderService();
export default purchaseOrderService;
