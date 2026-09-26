import { ChallanType, ChallanStatus, Prisma, MovementType, Unit } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { randomUUID } from 'crypto';
import prisma from '../config/database';
import { generateAtomicDocNumber } from '../utils/atomicCodeGenerator';
import { logWarn } from '../utils/logger';
import greigeStockService from './greige-stock.service';
import fabricStockService from './fabric-stock.service';
import stockMovementService from './stockMovement.service';
import { ensureMaterialRecord, syncStockLevelQuantity, threadLotMaterialId } from './helpers/material-sync.helper';
// BUG-CHN5 fix: Use decimal.js for quantity calculations to avoid floating-point errors
import { toCurrency, subtractCurrency, multiplyCurrency, addCurrency, toNumber } from '../utils/currency';
import { applySearch } from '../utils/search-filter';
import { toDateInputValue } from '../utils/date';
import { normalizeUnit, unitLabel } from '../utils/units';
import { isQtyZero, qtyAtLeast, qtyExceeds, snapToLimit } from '../utils/quantity';
import { LOT_WAREHOUSE_SELECT, lotInProcessorUnit } from './helpers/lot-location.helper';

/** Rule 55 wording on a Stock-Out that sends our goods to a job worker (Phase 4e). */
export const STOCK_OUT_TO_JOB_WORKER_REASON = 'Inputs sent to a job worker for job work (CGST Rule 45) — not a supply';

/**
 * challan_items.unit is free text (schema default 'PCS'); a stock movement takes the Unit enum.
 * It used to be cast straight across, so a 'PCS' line reached Prisma as an invalid enum value.
 * Read it through the registry; a blank line counts in pieces as it always has; anything the
 * registry cannot read is refused rather than guessed.
 */
function stockUnitOf(unit: string | null | undefined): Unit {
  if (!unit) return Unit.PIECE;
  const resolved = normalizeUnit(unit);
  if (!resolved)
    throw new Error(`Challan line unit '${unitLabel(unit)}' is not a stock unit — correct the line's unit.`);
  return resolved;
}

// ============================================
// TYPES
// ============================================

export interface CreateChallanItemInput {
  itemType: string;
  materialId?: string;
  fabricId?: string;
  description: string;
  quantity: number;
  unit?: string;
  colorId?: string;
  sizeId?: string;
  rate?: number;
  remarks?: string;
  greigeStockId?: string;
  fabricStockId?: string;
  laceStockId?: string;
  threadStockId?: string;
  materialRequirementId?: string;
  serviceRequirementId?: string;
  jobWorkOrderId?: string; // Phase 4a: line-level JWO attribution (D5 reconciliation)
  jobWorkOrderComponentId?: string;
  foldLengthCm?: number;
  thanCount?: number;
  componentName?: string;
  colorName?: string;
  /** Value for the e-way bill / Rule 45 declaration (material value, never a job-work rate). */
  declaredValue?: number;
}

export interface CreateChallanInput {
  challanType: ChallanType;
  challanDate?: Date;
  orderId?: string;
  productionRunId?: string;
  /** The cutting batch an issue to Cutting is for — run-fabric.helper.ts */
  cuttingBatchId?: string;
  purchaseOrderId?: string;
  jobWorkOrderId?: string; // Phase 4a: header-level JWO attribution
  grnId?: string; // The job-work receipt an INWARD challan was filed for — one per part (2026-09-19)
  /** OUTWARD Rule 45 challan for inputs a supplier delivered STRAIGHT to the job worker: the purchase
   *  receipt it covers (Phase 2, 2026-09-25). Never the INWARD grnId. */
  directSupplyGrnId?: string;
  /** Rule 55 wording, e.g. "Job work — inputs supplied directly to the job worker … — not a supply". */
  reasonForTransport?: string;
  totalDeclaredValue?: number;
  /** When the goods are already with the recipient at filing (a direct supply): the date they got them. */
  issuedDate?: Date;
  fabricProcessingId?: string;
  fromType: string;
  fromId?: string;
  fromName: string;
  toType: string;
  toId?: string;
  toName: string;
  vehicleNumber?: string;
  driverName?: string;
  driverPhone?: string;
  lrNumber?: string;
  expectedDate?: Date;
  unit?: string;
  remarks?: string;
  issuedById: string;
  /**
   * Status to file the challan at. Defaults to DRAFT (a document being prepared).
   *
   * Pass RECEIVED when the goods are already physically in hand at creation time — a job-work
   * return books stock in the same transaction, so its INWARD challan documenting that arrival was
   * never a draft. Until 2026-09-21 every auto-created challan was left DRAFT forever, which is why
   * the Control Center's "Materials with External Vendors" and "Overdue Challans" could not be
   * trusted. `tx.challans.create` at :1265 already did this by hand for the INTERNAL return challan.
   */
  status?: ChallanStatus;
  /** Only meaningful with `status: 'RECEIVED'` / `'PARTIALLY_RECEIVED'`. */
  receivedDate?: Date;
  receivedById?: string;
  items: CreateChallanItemInput[];
}

export interface ChallanFilters {
  challanType?: ChallanType;
  status?: ChallanStatus;
  orderId?: string;
  productionRunId?: string;
  purchaseOrderId?: string;
  fromDate?: Date;
  toDate?: Date;
  search?: string;
  limit?: number;
  offset?: number;
  // New filters for greige dept register
  itemType?: string; // GREIGE, FABRIC, LACE, THREAD, etc.
  processorId?: string; // Filter by toId (vendor/mill)
  todayOnly?: boolean; // Filter to today's challans only
}

export interface ReceiveChallanInput {
  receivedById: string;
  receivedDate?: Date;
  items: {
    challanItemId: string;
    receivedQty: number;
    damagedQty?: number;
    remarks?: string;
  }[];
  remarks?: string;
}

// ============================================
// CHALLAN NUMBER GENERATION
// ============================================

async function generateChallanNumber(tx?: Prisma.TransactionClient): Promise<string> {
  // Delegates to the shared atomic sequence generator (code_sequences UPSERT, bug-hunt
  // procurement-15) under the same CH{yy}{mm} key the previous inline implementation
  // maintained, so the visible format and the running series continue unbroken.
  return generateAtomicDocNumber('CH', tx);
}

// ============================================
// CRUD OPERATIONS
// ============================================

export async function createChallan(input: CreateChallanInput, outerTx?: Prisma.TransactionClient) {
  // Join a caller's transaction when supplied (e.g. external-process send-out) so the challan commits/
  // rolls back with the caller; otherwise open our own.
  const run = async (tx: Prisma.TransactionClient) => {
    const challanNumber = await generateChallanNumber(tx);

    // BUG-CHN5 fix: Use decimal.js for safe quantity summation
    const totalQuantity = toNumber(
      input.items.reduce((sum, item) => sum.plus(toCurrency(item.quantity)), toCurrency(0))
    );

    const challan = await tx.challans.create({
      data: {
        id: randomUUID(),
        challanNumber,
        challanType: input.challanType,
        challanDate: input.challanDate || new Date(),
        orderId: input.orderId,
        productionRunId: input.productionRunId,
        cuttingBatchId: input.cuttingBatchId,
        purchaseOrderId: input.purchaseOrderId,
        jobWorkOrderId: input.jobWorkOrderId,
        grnId: input.grnId,
        directSupplyGrnId: input.directSupplyGrnId,
        reasonForTransport: input.reasonForTransport,
        totalDeclaredValue: input.totalDeclaredValue,
        issuedDate: input.issuedDate,
        fabricProcessingId: input.fabricProcessingId,
        fromType: input.fromType,
        fromId: input.fromId,
        fromName: input.fromName,
        toType: input.toType,
        toId: input.toId,
        toName: input.toName,
        vehicleNumber: input.vehicleNumber,
        driverName: input.driverName,
        driverPhone: input.driverPhone,
        lrNumber: input.lrNumber,
        status: input.status ?? 'DRAFT',
        expectedDate: input.expectedDate,
        // Goods already in hand at filing time carry their arrival facts immediately, so the row is
        // never a half-written receipt that a later reader has to guess about.
        ...(input.status === 'RECEIVED' || input.status === 'PARTIALLY_RECEIVED'
          ? {
              receivedDate: input.receivedDate ?? new Date(),
              receivedById: input.receivedById ?? input.issuedById,
              receivedQuantity: totalQuantity,
            }
          : {}),
        totalItems: input.items.length,
        totalQuantity,
        unit: input.unit || Unit.PIECE,
        remarks: input.remarks,
        issuedById: input.issuedById,
        items: {
          create: input.items.map((item) => ({
            id: randomUUID(),
            itemType: item.itemType,
            materialId: item.materialId,
            fabricId: item.fabricId,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit || Unit.PIECE,
            colorId: item.colorId,
            sizeId: item.sizeId,
            rate: item.rate,
            remarks: item.remarks,
            greigeStockId: item.greigeStockId,
            fabricStockId: item.fabricStockId,
            laceStockId: item.laceStockId,
            threadStockId: item.threadStockId,
            materialRequirementId: item.materialRequirementId,
            serviceRequirementId: item.serviceRequirementId,
            jobWorkOrderId: item.jobWorkOrderId,
            jobWorkOrderComponentId: item.jobWorkOrderComponentId,
            componentName: item.componentName || null,
            colorName: item.colorName || null,
            foldLengthCm: item.foldLengthCm,
            thanCount: item.thanCount,
            declaredValue: item.declaredValue,
          })),
        },
      },
      include: {
        items: true,
        order: { select: { id: true, orderNumber: true } },
        productionRun: { select: { id: true, workOrderNumber: true } },
        purchaseOrder: { select: { id: true, poNumber: true } },
        issuedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return challan;
  };
  return outerTx ? run(outerTx) : prisma.$transaction(run);
}

export async function issueChallan(id: string, userId?: string) {
  return prisma.$transaction(async (tx) => {
    // Fetch challan with items to check for stock links
    const existing = await tx.challans.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!existing) throw new Error('Challan not found');
    if (existing.status !== 'DRAFT') throw new Error('Only DRAFT challans can be issued');

    // Job-work challans are created ISSUED atomically with the JWO issue (stock already
    // deducted in that tx). A stray legacy DRAFT job-work challan must never be issued
    // from here — it would consume the same stock a second time.
    //
    // The header alone is not enough to detect one: a CONSOLIDATED dispatch carries several
    // orders, so it cannot name one in the header and leaves jobWorkOrderId null while every
    // LINE names its own order. Checking both is what keeps that challan out of this path.
    const linkedJwoIds = [
      ...new Set(
        [existing.jobWorkOrderId, ...existing.items.map((it) => it.jobWorkOrderId)].filter((v): v is string => !!v)
      ),
    ];
    if (linkedJwoIds.length > 0) {
      const issued = await tx.job_work_orders.findFirst({
        where: { id: { in: linkedJwoIds }, sentDate: { not: null } },
        select: { jobWorkNumber: true },
      });
      if (issued) {
        throw new Error(
          `This job-work challan belongs to ${issued.jobWorkNumber}, which was issued atomically — ` +
            `stock is already deducted. Do not issue it again from the challan page.`
        );
      }
    }

    // A Stock-Out to a processor (direct-to-processor plan, Phase 4e): the destination has a processing
    // unit, so the goods stay OURS, held there. The challan goes out as a job-work challan — toType
    // VENDOR, Rule 45 wording, one-year return — which puts it in ITC-04 Table A by construction.
    // (The Stock-Out screen posts toType SUPPLIER; before 4e the lot was parked but the challan was not.)
    const processorUnit =
      existing.challanType === 'OUTWARD' &&
      existing.fromType !== 'VENDOR' &&
      (existing.toType === 'SUPPLIER' || existing.toType === 'VENDOR') &&
      existing.toId
        ? await tx.warehouses.findFirst({
            where: { supplierId: existing.toId, warehouseType: 'JOB_WORK', isActive: true },
            select: { id: true, warehouseName: true },
          })
        : null;
    if (processorUnit && existing.items.some((it) => it.greigeStockId)) {
      const issuedOn = existing.issuedDate ?? existing.challanDate ?? new Date();
      const returnBy = new Date(issuedOn);
      returnBy.setFullYear(returnBy.getFullYear() + 1);
      await tx.challans.update({
        where: { id },
        data: {
          toType: 'VENDOR',
          reasonForTransport: existing.reasonForTransport ?? STOCK_OUT_TO_JOB_WORKER_REASON,
          expectedDate: existing.expectedDate ?? returnBy,
        },
      });
    }

    // Auto-deduct stock for OUTWARD and INTERNAL challans based on stock type
    if (existing.challanType === 'OUTWARD' || existing.challanType === 'INTERNAL') {
      const effectiveUserId = userId || existing.issuedById;

      for (const item of existing.items) {
        const qty = Number(item.quantity);

        // 1. Greige stock deduction + transfer to processor warehouse
        if (item.greigeStockId) {
          // Get original stock details before consuming
          const originalStock = await tx.greige_stock.findUnique({
            where: { id: item.greigeStockId },
            include: { greige: true },
          });
          // A lot held by a processor is not in our store: it cannot leave on a Stock-Out challan. It
          // is used by a job at that processor, or moved with its own door (direct-to-processor plan).
          if (originalStock?.processorId) {
            throw new Error(
              `Lot ${originalStock.greige?.greigeCode ?? originalStock.id.slice(0, 8)} is held at a processor, not in our store — ` +
                `it cannot go out on this challan. Use it on a job at that processor instead.`
            );
          }
          // Quantity rule (utils/quantity): a 3-decimal challan line within dust of the 2-decimal lot
          // takes exactly the lot — otherwise the guarded consume refuses 500.002 against 500.00.
          const greigeQty = originalStock ? snapToLimit(qty, originalStock.quantityAvailable) : qty;

          // Consume from source warehouse — pass the outer tx so the consumption rolls back with the
          // challan if issuance later fails (was on the global client → stock deducted with no challan; F4).
          // The challan reference is passed so this ONE ledger row fully describes the movement. It
          // used to be omitted, leaving referenceId null and forcing a second, duplicate row below.
          const isProcessorTransfer = !!processorUnit;
          await greigeStockService.consumeGreigeStock(item.greigeStockId, greigeQty, effectiveUserId, tx, {
            referenceType: 'CHALLAN',
            referenceId: existing.id,
            notes: isProcessorTransfer
              ? `Transferred to processor ${existing.toName} via challan ${existing.challanNumber}`
              : `Consumed via challan ${existing.challanNumber}`,
          });

          // If OUTWARD to a processor, the goods are held at its processing unit
          if (processorUnit && existing.toId && originalStock) {
            // Create new greige stock entry at processor's warehouse.
            // warehouseId must be the FK, not just the display name — a NULL-warehouse lot is
            // invisible to derived_stock_view, so the transferred stock vanished from every
            // stock page while the source consumption still deducted the ledger (GRG-0006 −500m).
            await tx.greige_stock.create({
              data: {
                greigeId: originalStock.greigeId,
                quantityAvailable: new Prisma.Decimal(greigeQty),
                quantityReserved: new Prisma.Decimal(0),
                quantityConsumed: new Prisma.Decimal(0),
                unit: originalStock.unit,
                greigeWidth: originalStock.greigeWidth,
                cutableWidth: originalStock.cutableWidth,
                purchaseCost: originalStock.purchaseCost,
                weightedAvgCost: originalStock.weightedAvgCost,
                supplierId: originalStock.supplierId, // Preserve original supplier (who SOLD the greige)
                processorId: existing.toId, // Track processor currently holding the stock
                procurementId: originalStock.procurementId, // Preserve procurement link
                sourceChallanId: existing.id,
                sourceType: 'TRANSFER',
                warehouseId: processorUnit.id,
                warehouseLocation: processorUnit.warehouseName,
                qualityGrade: originalStock.qualityGrade,
                // The day it reached the processor — its one-year return period runs from it
                receivedDate: existing.challanDate ?? new Date(),
                status: 'AVAILABLE',
                stockType: 'GENERIC',
                createdById: effectiveUserId,
              },
            });

            // On hand at the processor's unit (Phase 4e, like greige delivered straight there): the
            // store lot's consumption above took the metres off the store; the unit takes them on.
            // Before 4e this lot was kept off the ledger, so a Stock-Out's metres vanished from every
            // stock total while the processor held them (GRG-0006, 500 m at Manish Textiles).
            const greigeMaterialId = await ensureMaterialRecord(originalStock.greigeId, 'GREIGE', tx);
            await syncStockLevelQuantity(greigeMaterialId, greigeQty, processorUnit.id, 'METER', tx);
            //
            // A second TRANSFER_OUT row used to be written here against the SOURCE lot. It was
            // wrong twice over: the lot already had a CONSUMPTION row for the same metres (so
            // the lot read as if double the quantity had left), and its balanceAfter was
            // hard-coded to 0 with a comment claiming consumeGreigeStock would correct it —
            // which never happened, because that runs first and writes its own row. The only
            // thing it added was the challan reference, which the consumption row now carries
            // itself. Live example: GRG-0006 showed CONSUMPTION −500 (balance 4883.14) AND
            // TRANSFER_OUT −500 (balance 0) for a single 500 m challan.
          }
        }

        // 2. Fabric stock deduction
        if (item.fabricStockId) {
          const fabricStock = await tx.fabric_stock.findUnique({
            where: { id: item.fabricStockId },
            include: { warehouse: { select: LOT_WAREHOUSE_SELECT } },
          });
          if (!fabricStock) throw new Error(`Fabric stock ${item.fabricStockId} not found`);
          // Fabric lying at a processor's unit is not in our store: it cannot leave on this challan. A job
          // at that processor draws it where it lies (direct-to-processor plan, Phase 4a).
          if (lotInProcessorUnit(fabricStock)) {
            throw new Error(
              `This fabric lot is at ${fabricStock.warehouse?.supplier?.name ?? fabricStock.warehouse?.warehouseName ?? 'a processor'}, ` +
                `not in our store — it cannot go out on this challan. Use it on a job at that processor instead.`
            );
          }
          // Quantity rule (utils/quantity): the challan line is 3-decimal, the lot 2 — a line within dust
          // of the lot takes the whole lot, and the lot is left at exactly 0 (closed), not 0.002.
          if (qtyExceeds(qty, fabricStock.quantityAvailable))
            throw new Error(
              `Insufficient fabric stock. Available: ${fabricStock.quantityAvailable}, Requested: ${qty}`
            );
          const lotQty = snapToLimit(qty, fabricStock.quantityAvailable);
          // BUG-CHN5 fix: Use decimal.js for safe subtraction
          const newAvailable = toNumber(subtractCurrency(fabricStock.quantityAvailable, lotQty));

          await tx.fabric_stock.update({
            where: { id: item.fabricStockId },
            data: {
              quantityAvailable: new Prisma.Decimal(newAvailable),
              quantityConsumed: { increment: lotQty },
              lastConsumedDate: new Date(),
              status: isQtyZero(newAvailable) || newAvailable < 0 ? 'EXHAUSTED' : 'AVAILABLE',
            },
          });

          // Sync stock_levels
          const fabMaterial = await tx.materials.findFirst({
            where: { fabricId: fabricStock.fabricId },
            select: { id: true },
          });
          // At the lot's own store — it used to hit the default store whatever the lot's warehouse
          if (fabMaterial)
            await syncStockLevelQuantity(fabMaterial.id, -lotQty, fabricStock.warehouseId ?? undefined, 'METER', tx);
        }

        // 3. Lace stock deduction
        if (item.laceStockId) {
          const laceStock = await tx.lace_stock.findUnique({
            where: { id: item.laceStockId },
            include: { warehouse: { select: LOT_WAREHOUSE_SELECT } },
          });
          if (!laceStock) throw new Error(`Lace stock ${item.laceStockId} not found`);
          // Lace lying at a processor's unit is not in our store (a job there draws it where it lies)
          if (lotInProcessorUnit(laceStock)) {
            throw new Error(
              `This lace lot is at ${laceStock.warehouse?.supplier?.name ?? laceStock.warehouse?.warehouseName ?? 'a processor'}, ` +
                `not in our store — it cannot go out on this challan. Use it on a job at that processor instead.`
            );
          }
          // Quantity rule (utils/quantity): the challan line is 3-decimal, the lot 2 — a line within dust
          // of the lot takes the whole lot, and the lot is left at exactly 0 (closed), not 0.002.
          if (qtyExceeds(qty, laceStock.quantityAvailable))
            throw new Error(`Insufficient lace stock. Available: ${laceStock.quantityAvailable}, Requested: ${qty}`);
          const lotQty = snapToLimit(qty, laceStock.quantityAvailable);
          // BUG-CHN5 fix: Use decimal.js for safe subtraction
          const newAvailable = toNumber(subtractCurrency(laceStock.quantityAvailable, lotQty));

          await tx.lace_stock.update({
            where: { id: item.laceStockId },
            data: {
              quantityAvailable: new Prisma.Decimal(newAvailable),
              quantityConsumed: { increment: lotQty },
              lastConsumedDate: new Date(),
              status: isQtyZero(newAvailable) || newAvailable < 0 ? 'ISSUED' : 'AVAILABLE',
            },
          });

          // Audit trail
          await tx.lace_stock_transaction.create({
            data: {
              stockId: item.laceStockId,
              transactionType: 'CONSUMPTION',
              quantity: -lotQty,
              balanceAfter: newAvailable,
              referenceType: 'CHALLAN',
              referenceId: existing.id,
              notes: `Issued via challan ${existing.challanNumber}`,
              performedById: effectiveUserId,
            },
          });

          // BUG-INV3 fix: find materials.id instead of using laceId directly
          if (laceStock.laceId) {
            const laceMaterial = await tx.materials.findFirst({
              where: { laceId: laceStock.laceId },
              select: { id: true },
            });
            if (laceMaterial)
              await syncStockLevelQuantity(laceMaterial.id, -lotQty, laceStock.warehouseId ?? undefined, 'METER', tx);
          }
        }

        // 4. Thread stock deduction
        if (item.threadStockId) {
          const threadStock = await tx.thread_stock.findUnique({
            where: { id: item.threadStockId },
          });
          if (!threadStock) throw new Error(`Thread stock ${item.threadStockId} not found`);
          // Quantity rule (utils/quantity): the challan line is 3-decimal, the lot 2 — a line within dust
          // of the lot takes the whole lot, and the lot is left at exactly 0 (closed), not 0.002.
          if (qtyExceeds(qty, threadStock.quantityAvailable))
            throw new Error(
              `Insufficient thread stock. Available: ${threadStock.quantityAvailable}, Requested: ${qty}`
            );
          const lotQty = snapToLimit(qty, threadStock.quantityAvailable);
          // BUG-CHN5 fix: Use decimal.js for safe subtraction
          const newAvailable = toNumber(subtractCurrency(threadStock.quantityAvailable, lotQty));

          // Recalculate derived quantities from packaging specs
          const spec = await tx.thread_packaging_specs.findFirst({
            where: {
              ply: threadStock.ply || undefined,
              packagingType: threadStock.packagingType || undefined,
              isActive: true,
            },
          });
          // BUG-CHN5 fix: Use decimal.js for safe multiplication/division
          const newMeters = spec ? toNumber(multiplyCurrency(newAvailable, spec.metersPerUnit)) : null;
          const newBoxes =
            spec && spec.unitsPerBox > 0
              ? toNumber(toCurrency(newAvailable).dividedBy(toCurrency(spec.unitsPerBox)))
              : null;

          await tx.thread_stock.update({
            where: { id: item.threadStockId },
            data: {
              quantityAvailable: new Prisma.Decimal(newAvailable),
              quantityConsumed: { increment: lotQty },
              metersAvailable: newMeters !== null ? new Prisma.Decimal(newMeters) : null,
              boxesAvailable: newBoxes !== null ? new Prisma.Decimal(newBoxes) : null,
              lastConsumedDate: new Date(),
              status: isQtyZero(newAvailable) || newAvailable < 0 ? 'ISSUED' : 'AVAILABLE',
            },
          });

          // Audit trail
          await tx.thread_stock_transaction.create({
            data: {
              stockId: item.threadStockId,
              transactionType: 'CONSUMPTION',
              quantity: -lotQty,
              balanceAfter: newAvailable,
              referenceType: 'CHALLAN',
              referenceId: existing.id,
              notes: `Issued via challan ${existing.challanNumber}`,
              performedById: effectiveUserId,
            },
          });

          // The lot's own materials row — its pack row (cones / tubes) or, unpacked, the thread's base row
          if (threadStock.threadId) {
            const threadMaterialId = await threadLotMaterialId(threadStock, tx);
            await syncStockLevelQuantity(
              threadMaterialId,
              -lotQty,
              threadStock.warehouseId ?? undefined,
              undefined,
              tx
            );
          }
        }

        // 5. General material (trims/accessories) — deduct via stock_movements + stock_levels
        if (item.materialId && !item.greigeStockId && !item.fabricStockId && !item.laceStockId && !item.threadStockId) {
          // Find default warehouse
          const warehouse = await tx.warehouses.findFirst({
            where: { isActive: true },
            orderBy: { createdAt: 'asc' },
            select: { id: true },
          });

          if (warehouse) {
            try {
              await stockMovementService.createStockOut(
                {
                  movementType: 'STOCK_OUT' as MovementType,
                  materialId: item.materialId,
                  warehouseId: warehouse.id,
                  quantity: new Decimal(qty),
                  unit: stockUnitOf(item.unit),
                  referenceType: 'CHALLAN',
                  referenceId: existing.id,
                  referenceNumber: existing.challanNumber,
                  remarks: `Issued via challan ${existing.challanNumber}`,
                  performedById: effectiveUserId,
                },
                tx
              ); // pass the outer tx so the stock-out participates in the challan transaction (F4)
            } catch (err: any) {
              // Stock deduction failure must block challan issuance for ALL types
              // to prevent data inconsistency (challan ISSUED but stock not deducted)
              throw new Error(`Stock deduction failed for material ${item.materialId}: ${err.message}`);
            }
          }
        }

        // 5. Update service requirement status to IN_PROGRESS
        if (item.serviceRequirementId) {
          await tx.work_order_service_requirements.update({
            where: { id: item.serviceRequirementId },
            data: { status: 'IN_PROGRESS' },
          });
        }
      }
    }

    // Update fabric_processing status if linked
    if (existing.fabricProcessingId) {
      await tx.fabric_processing.update({
        where: { id: existing.fabricProcessingId },
        data: {
          processingStatus: 'SENT',
          sentDate: new Date(),
        },
      });
    }

    // Update challan status
    const challan = await tx.challans.update({
      where: { id },
      data: {
        status: 'ISSUED',
        issuedDate: new Date(),
      },
      include: {
        items: true,
        issuedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return challan;
  });
}

export async function getChallanById(id: string) {
  return prisma.challans.findUnique({
    where: { id },
    include: {
      items: true,
      order: {
        select: {
          id: true,
          orderNumber: true,
          totalQuantity: true,
          customers: { select: { id: true, name: true } },
        },
      },
      productionRun: {
        select: {
          id: true,
          workOrderNumber: true,
          totalQuantity: true,
          styles: { select: { id: true, styleCode: true, buyerStyleRef: true, styleName: true } },
        },
      },
      purchaseOrder: {
        select: {
          id: true,
          poNumber: true,
          suppliers: { select: { id: true, name: true } },
        },
      },
      issuedBy: { select: { id: true, firstName: true, lastName: true } },
      receivedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export async function getChallans(filters: ChallanFilters) {
  const where: Prisma.challansWhereInput = {};

  if (filters.challanType) where.challanType = filters.challanType;
  if (filters.status) where.status = filters.status;
  if (filters.orderId) where.orderId = filters.orderId;
  if (filters.productionRunId) where.productionRunId = filters.productionRunId;
  if (filters.purchaseOrderId) where.purchaseOrderId = filters.purchaseOrderId;

  // Processor/mill filter (toId)
  if (filters.processorId) where.toId = filters.processorId;

  // Item type filter (filter challans that have at least one item of this type)
  if (filters.itemType) {
    where.items = { some: { itemType: filters.itemType } };
  }

  // Today only filter
  if (filters.todayOnly) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    where.challanDate = { gte: today, lt: tomorrow };
  } else if (filters.fromDate || filters.toDate) {
    where.challanDate = {};
    if (filters.fromDate) where.challanDate.gte = filters.fromDate;
    if (filters.toDate) where.challanDate.lte = filters.toDate;
  }

  if (filters.search) {
    applySearch(where, filters.search, ['challanNumber', 'fromName', 'toName', 'remarks']);
  }

  const [challans, total] = await Promise.all([
    prisma.challans.findMany({
      where,
      include: {
        items: true,
        order: {
          select: {
            id: true,
            orderNumber: true,
            totalQuantity: true,
            customers: { select: { id: true, name: true } },
          },
        },
        productionRun: {
          select: {
            id: true,
            workOrderNumber: true,
            totalQuantity: true,
            styles: { select: { id: true, styleCode: true, buyerStyleRef: true, styleName: true } },
          },
        },
        purchaseOrder: { select: { id: true, poNumber: true } },
        issuedBy: { select: { id: true, firstName: true, lastName: true } },
        receivedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit || 50,
      skip: filters.offset || 0,
    }),
    prisma.challans.count({ where }),
  ]);

  return { challans, total };
}

/**
 * Get today's challan summary grouped by processor (for greige dept register)
 * Returns OUTWARD challans issued today, grouped by processor with totals
 */
export async function getTodaySummary() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Get all OUTWARD challans issued today to vendors
  const challans = await prisma.challans.findMany({
    where: {
      challanType: 'OUTWARD',
      challanDate: { gte: today, lt: tomorrow },
      toType: 'VENDOR',
    },
    include: {
      items: {
        select: {
          id: true,
          itemType: true,
          description: true,
          quantity: true,
          unit: true,
          rate: true,
        },
      },
    },
  });

  // Group by processor (toId + toName)
  const byProcessor: Record<
    string,
    {
      processorId: string;
      processorName: string;
      challanCount: number;
      totalQuantity: number;
      totalValue: number;
      itemTypes: Set<string>;
    }
  > = {};

  for (const challan of challans) {
    const key = challan.toId || challan.toName;
    if (!byProcessor[key]) {
      byProcessor[key] = {
        processorId: challan.toId || '',
        processorName: challan.toName,
        challanCount: 0,
        totalQuantity: 0,
        totalValue: 0,
        itemTypes: new Set(),
      };
    }
    byProcessor[key].challanCount++;
    // BUG-CHN5 fix: Use decimal.js for safe addition
    byProcessor[key].totalQuantity = toNumber(addCurrency(byProcessor[key].totalQuantity, challan.totalQuantity));

    for (const item of challan.items) {
      byProcessor[key].itemTypes.add(item.itemType);
      // BUG-CHN5 fix: Use decimal.js for safe multiplication and addition
      byProcessor[key].totalValue = toNumber(
        addCurrency(byProcessor[key].totalValue, multiplyCurrency(item.quantity, item.rate || 0))
      );
    }
  }

  // Convert to array and serialize itemTypes
  const summary = Object.values(byProcessor).map((p) => ({
    processorId: p.processorId,
    processorName: p.processorName,
    challanCount: p.challanCount,
    totalQuantity: p.totalQuantity,
    totalValue: p.totalValue,
    itemTypes: Array.from(p.itemTypes),
  }));

  return {
    date: toDateInputValue(today),
    totalChallans: challans.length,
    // BUG-CHN5 fix: Use decimal.js for safe summation
    totalQuantity: toNumber(challans.reduce((sum, c) => sum.plus(toCurrency(c.totalQuantity)), toCurrency(0))),
    byProcessor: summary,
  };
}

export async function receiveChallan(id: string, input: ReceiveChallanInput) {
  return prisma.$transaction(async (tx) => {
    // Row-lock the challan FIRST so concurrent receives serialize: without this, two double-clicked
    // receives could both snapshot the pre-receipt quantities before either committed, and the loser
    // would credit the full amount again (adversarial-review finding on the delta fix).
    await tx.$queryRaw`SELECT id FROM challans WHERE id = ${id} FOR UPDATE`;

    // Fetch challan to check status + processing link
    const existingChallan = await tx.challans.findUnique({
      where: { id },
      select: { challanType: true, fabricProcessingId: true, orderId: true, status: true, directSupplyGrnId: true },
    });

    if (!existingChallan) {
      throw new Error('Challan not found');
    }
    // The Rule 45 challan for goods a supplier delivered straight to a processor is closed by the jobs
    // that use them (Receive from processor), never received by hand here.
    if (existingChallan.directSupplyGrnId) {
      throw new Error(
        'This challan covers goods the supplier delivered straight to the processor. They come back through the job work order (Receive from processor), not from here.'
      );
    }
    // Status guard (bug-hunt procurement-4): re-receiving a RECEIVED challan used to re-credit the FULL
    // receivedQty of every item — double stock credit. PARTIALLY_RECEIVED stays receivable (progressive
    // receiving is safe because crediting below is DELTA-based).
    if (existingChallan.status === 'RECEIVED' || existingChallan.status === 'CANCELLED') {
      throw new Error(`Challan is already ${existingChallan.status} — cannot receive again`);
    }

    // Snapshot each item's PREVIOUS receivedQty BEFORE writing the new figures: stock is credited by
    // the DELTA (new − previous), so neither a repeat call nor a progressive second receipt can
    // re-credit quantity that was already credited.
    const prevItems = await tx.challan_items.findMany({
      where: { challanId: id },
      select: { id: true, receivedQty: true },
    });
    const prevQtyById = new Map(prevItems.map((p) => [p.id, p.receivedQty === null ? 0 : Number(p.receivedQty)]));

    // Every submitted item must belong to THIS challan — a foreign challanItemId would write onto
    // another challan's item (crediting nothing here but poisoning that challan's prev-snapshot so its
    // real receipt later computes delta 0 and never credits).
    for (const itemReceipt of input.items) {
      if (!prevQtyById.has(itemReceipt.challanItemId)) {
        throw new Error(`Challan item ${itemReceipt.challanItemId} does not belong to challan ${id}`);
      }
    }

    // Update each item's received quantities
    for (const itemReceipt of input.items) {
      await tx.challan_items.update({
        where: { id: itemReceipt.challanItemId },
        data: {
          receivedQty: itemReceipt.receivedQty,
          damagedQty: itemReceipt.damagedQty || 0,
          remarks: itemReceipt.remarks,
        },
      });
    }

    // Calculate total received
    const allItems = await tx.challan_items.findMany({
      where: { challanId: id },
    });

    // Warn about items with null receivedQty — these are NOT "received 0", they are "not yet entered"
    const itemsWithNullReceivedQty = allItems.filter((item) => item.receivedQty === null);
    if (itemsWithNullReceivedQty.length > 0) {
      logWarn(
        `[Challan] ${itemsWithNullReceivedQty.length} item(s) have no receivedQty entered — stock will NOT be credited for these items. This may cause stock discrepancy.`
      );
    }

    // BUG-CHN5 fix: Use decimal.js for safe summation
    const totalReceived = toNumber(
      allItems.reduce(
        (sum, item) => sum.plus(item.receivedQty !== null ? toCurrency(item.receivedQty) : toCurrency(0)),
        toCurrency(0)
      )
    );
    const totalExpected = toNumber(allItems.reduce((sum, item) => sum.plus(toCurrency(item.quantity)), toCurrency(0)));

    // Determine status. Quantity rule (utils/quantity): a line received within dust of its quantity
    // (2-decimal entry against a 3-decimal line) is fully received.
    const allReceived = allItems.every(
      (item) => item.receivedQty !== null && qtyAtLeast(item.receivedQty, item.quantity)
    );
    const someReceived = allItems.some((item) => item.receivedQty !== null && qtyExceeds(item.receivedQty, 0));

    let newStatus: ChallanStatus = 'IN_TRANSIT';
    if (allReceived) {
      newStatus = 'RECEIVED';
    } else if (someReceived) {
      newStatus = 'PARTIALLY_RECEIVED';
    }

    // Auto-credit stock for INWARD challans
    if (existingChallan?.challanType === 'INWARD') {
      // Credit fabric/lace/material stock for each received item — by DELTA (new − previously credited),
      // so repeat receives and progressive receiving never double-credit (bug-hunt procurement-4).
      for (const item of allItems) {
        if (item.receivedQty === null) {
          logWarn(
            `[Challan] Skipping stock credit for item ${item.id} — receivedQty not entered. Stock will NOT be updated.`
          );
          continue;
        }
        const receivedQty = Number(item.receivedQty) - (prevQtyById.get(item.id) ?? 0);
        if (receivedQty <= 0) continue;

        // Fabric stock credit (return to stock)
        if (item.fabricStockId) {
          const fabricStock = await tx.fabric_stock.findUnique({
            where: { id: item.fabricStockId },
            select: { fabricId: true },
          });
          await tx.fabric_stock.update({
            where: { id: item.fabricStockId },
            data: {
              quantityAvailable: { increment: receivedQty },
              status: 'AVAILABLE',
            },
          });

          // Sync stock_levels
          if (fabricStock?.fabricId) {
            const fabMat = await tx.materials.findFirst({
              where: { fabricId: fabricStock.fabricId },
              select: { id: true },
            });
            if (fabMat) await syncStockLevelQuantity(fabMat.id, receivedQty, undefined, 'METER', tx);
          }
        }

        // Lace stock credit (return to stock)
        if (item.laceStockId) {
          const laceStock = await tx.lace_stock.findUnique({
            where: { id: item.laceStockId },
            select: { laceId: true, warehouseId: true },
          });
          await tx.lace_stock.update({
            where: { id: item.laceStockId },
            data: {
              quantityAvailable: { increment: receivedQty },
              status: 'AVAILABLE',
            },
          });

          // Audit trail
          await tx.lace_stock_transaction.create({
            data: {
              stockId: item.laceStockId,
              transactionType: 'RETURN',
              quantity: receivedQty,
              balanceAfter: 0, // Will be approximate; actual balance computed at read time
              referenceType: 'CHALLAN',
              referenceId: id,
              notes: `Received via challan`,
              performedById: input.receivedById,
            },
          });

          // BUG-INV3 fix: find materials.id instead of using laceId directly
          if (laceStock?.laceId) {
            const laceMaterial = await tx.materials.findFirst({
              where: { laceId: laceStock.laceId },
              select: { id: true },
            });
            if (laceMaterial)
              await syncStockLevelQuantity(
                laceMaterial.id,
                receivedQty,
                laceStock.warehouseId ?? undefined,
                'METER',
                tx
              );
          }
        }

        // General material credit (trims/accessories) via stock_movements
        if (item.materialId && !item.fabricStockId && !item.laceStockId && !existingChallan.fabricProcessingId) {
          const warehouse = await tx.warehouses.findFirst({
            where: { isActive: true },
            orderBy: { createdAt: 'asc' },
            select: { id: true },
          });

          if (warehouse) {
            try {
              // tx passed so the credit joins THIS transaction — without it, createStockIn opened its
              // own $transaction on the global client and the stock rows survived a rolled-back
              // receive (bug-hunt procurement-3).
              await stockMovementService.createStockIn(
                {
                  movementType: 'STOCK_IN' as MovementType,
                  materialId: item.materialId,
                  warehouseId: warehouse.id,
                  quantity: new Decimal(receivedQty),
                  unit: stockUnitOf(item.unit),
                  referenceType: 'CHALLAN',
                  referenceId: id,
                  remarks: `Received via challan`,
                  performedById: input.receivedById,
                },
                tx
              );
            } catch (err: any) {
              // Stock credit failure must block challan reception
              // to prevent data inconsistency (challan RECEIVED but stock not credited)
              throw new Error(`Stock credit failed for material ${item.materialId}: ${err.message}`);
            }
          }
        }

        // Update linked material requirement status
        if (item.materialRequirementId) {
          await tx.material_requirements.update({
            where: { id: item.materialRequirementId },
            data: { status: 'FULFILLED_STOCK' },
          });
        }

        // Update linked service requirement status.
        // Phase 5b: JWO-linked requirements are advanced ONLY by updateWosrReceivedQuantity
        // (the 5a single fulfilment track) — this challan-side flip stays for legacy rows
        // that predate the JWO pointer, so there is exactly one COMPLETED writer per row.
        if (item.serviceRequirementId) {
          const serviceReq = await tx.work_order_service_requirements.findUnique({
            where: { id: item.serviceRequirementId },
            select: { quantityRequired: true, jobWorkOrderId: true },
          });
          if (serviceReq && !serviceReq.jobWorkOrderId) {
            const requiredQty = Number(serviceReq.quantityRequired);
            // CUMULATIVE received (item.receivedQty), NOT the credit delta — a progressive receive's
            // final call has a small delta but the full cumulative total (review regression catch).
            await tx.work_order_service_requirements.update({
              where: { id: item.serviceRequirementId },
              data: {
                status: qtyAtLeast(item.receivedQty, requiredQty) ? 'COMPLETED' : 'IN_PROGRESS',
              },
            });
          }
        }
      }
    }

    // Auto-credit fabric stock for INWARD challans linked to processing
    if (existingChallan?.challanType === 'INWARD' && existingChallan.fabricProcessingId) {
      const processing = await tx.fabric_processing.findUnique({
        where: { id: existingChallan.fabricProcessingId },
        select: {
          finishedFabricId: true,
          greigeId: true,
          actualFinishedWidth: true,
          greigeCost: true,
          processingCost: true,
          costPerMeter: true,
        },
      });

      if (processing) {
        // Create fabric stock for each received item with fabric — by DELTA, same as the general
        // branch above (review BLOCKER: this branch still credited the FULL cumulative receivedQty via
        // createStyleStock on every call, so a progressive 60m+100m receive booked 160m for 100m received).
        for (const item of allItems) {
          if (item.receivedQty === null) continue; // Already warned above
          const receivedQty = Number(item.receivedQty) - (prevQtyById.get(item.id) ?? 0);
          if (receivedQty > 0 && (item.fabricId || processing.finishedFabricId)) {
            // Find the order's style for stock association (style is on order_items, not orders)
            let styleId: string | null = null;
            if (existingChallan.orderId) {
              const orderItem = await tx.order_items.findFirst({
                where: { orderId: existingChallan.orderId },
                select: { styleId: true },
              });
              styleId = orderItem?.styleId || null;
            }

            if (styleId) {
              const fabricId = item.fabricId || processing.finishedFabricId!;
              if (!processing.actualFinishedWidth) {
                throw new Error(
                  `Finished width not recorded for processing (greige ${processing.greigeId}). Update the processing record before receiving.`
                );
              }
              if (!processing.costPerMeter) {
                throw new Error(
                  `Processing cost per meter not set for processing (greige ${processing.greigeId}). Update the processing record before receiving.`
                );
              }
              const finishedWidth = Number(processing.actualFinishedWidth);
              const totalCost = Number(processing.costPerMeter);

              await fabricStockService.createStyleStock(
                {
                  styleId,
                  fabricId,
                  quantity: receivedQty,
                  finishedWidth,
                  cutableWidth: finishedWidth - 2, // Standard 2-inch margin
                  purchaseCost: totalCost,
                  fabricFinishType: 'DYED',
                },
                input.receivedById,
                tx // join the receiveChallan transaction so the fabric stock rolls back with it (F4)
              );
            }
          }
        }

        // Update fabric_processing status
        await tx.fabric_processing.update({
          where: { id: existingChallan.fabricProcessingId },
          data: {
            processingStatus: newStatus === 'RECEIVED' ? 'RECEIVED' : 'PARTIALLY_RECEIVED',
            actualQuantityReceived: new Prisma.Decimal(totalReceived),
            actualReturnDate: newStatus === 'RECEIVED' ? new Date() : undefined,
          },
        });
      }
    }

    const challan = await tx.challans.update({
      where: { id },
      data: {
        status: newStatus,
        receivedQuantity: totalReceived,
        receivedDate: newStatus === 'RECEIVED' ? new Date() : undefined,
        receivedById: input.receivedById,
        remarks: input.remarks || undefined,
      },
      include: {
        items: true,
        issuedBy: { select: { id: true, firstName: true, lastName: true } },
        receivedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return challan;
  });
}

export async function cancelChallan(id: string) {
  // Guarded flip: only DRAFT challans (no stock touched yet) can be cancelled. Issuing deducts stock
  // across five paths (greige consumption + processor-warehouse transfer, fabric, lace, thread,
  // general-material stock-out) — the old unconditional cancel silently orphaned every one of those
  // deductions ("truck never left" → stock gone forever; bug-hunt procurement-13). Issued goods must
  // come back through the receive flow, which credits stock correctly.
  const flipped = await prisma.challans.updateMany({
    where: { id, status: 'DRAFT' },
    data: { status: 'CANCELLED' },
  });
  if (flipped.count === 0) {
    const existing = await prisma.challans.findUnique({ where: { id }, select: { status: true } });
    if (!existing) throw new Error('Challan not found');
    throw new Error(
      `Only DRAFT challans can be cancelled (this one is ${existing.status}). ` +
        `Stock was already deducted at issue — receive the goods back via the challan receive flow instead.`
    );
  }
  return prisma.challans.findUnique({ where: { id } });
}

// ============================================
// FABRIC RETURN CHALLAN (Cutting → Fabric Store)
// ============================================

export interface FabricReturnItem {
  fabricStockId: string;
  quantity: number;
  description: string;
}

export interface CreateFabricReturnInput {
  workOrderId: string;
  /** The cutting batch the fabric is coming back from — see run-fabric.helper.ts */
  cuttingBatchId?: string | null;
  issuedById: string;
  items: FabricReturnItem[];
  remarks?: string;
}

/**
 * Creates a return challan for fabric going back from Cutting to Fabric Store.
 * The challan is created directly as RECEIVED and fabric stock is credited back.
 */
export async function createFabricReturnChallan(input: CreateFabricReturnInput) {
  return prisma.$transaction(async (tx) => {
    // Validate each return against what was actually consumed (bug-hunt procurement-14:
    // an over-return typo could drive quantityConsumed negative).
    for (const item of input.items) {
      if (item.quantity <= 0) {
        throw new Error(`Return quantity must be positive for fabric stock ${item.fabricStockId}`);
      }
      const stock = await tx.fabric_stock.findUnique({
        where: { id: item.fabricStockId },
        select: { quantityConsumed: true },
      });
      if (!stock) {
        throw new Error(`Fabric stock ${item.fabricStockId} not found`);
      }
      if (qtyExceeds(item.quantity, stock.quantityConsumed)) {
        throw new Error(
          `Cannot return ${item.quantity}m to fabric stock ${item.fabricStockId} — only ` +
            `${Number(stock.quantityConsumed)}m was consumed`
        );
      }
      // Quantity rule (utils/quantity): returning everything consumed, typed at 2 decimals, returns
      // exactly what was consumed — the challan line and the stock credit below both read this.
      item.quantity = snapToLimit(item.quantity, stock.quantityConsumed);
    }

    const challanNumber = await generateChallanNumber(tx);
    // BUG-CHN5 fix: Use decimal.js for safe summation
    const totalQuantity = toNumber(
      input.items.reduce((sum, item) => sum.plus(toCurrency(item.quantity)), toCurrency(0))
    );

    const challan = await tx.challans.create({
      data: {
        id: randomUUID(),
        challanNumber,
        challanType: 'INTERNAL',
        challanDate: new Date(),
        productionRunId: input.workOrderId,
        cuttingBatchId: input.cuttingBatchId ?? null,
        fromType: 'DEPARTMENT',
        fromName: 'Cutting',
        toType: 'DEPARTMENT',
        toName: 'Fabric Store',
        status: 'RECEIVED',
        issuedDate: new Date(),
        receivedDate: new Date(),
        totalItems: input.items.length,
        totalQuantity,
        receivedQuantity: totalQuantity,
        unit: Unit.METER,
        remarks: input.remarks || 'Fabric return from cutting batch completion',
        issuedById: input.issuedById,
        receivedById: input.issuedById,
        items: {
          create: input.items.map((item) => ({
            id: randomUUID(),
            itemType: 'FABRIC',
            description: item.description,
            quantity: item.quantity,
            receivedQty: item.quantity,
            unit: Unit.METER,
            fabricStockId: item.fabricStockId,
          })),
        },
      },
      include: { items: true },
    });

    // Credit fabric stock for each returned item
    for (const item of input.items) {
      const updated = await tx.fabric_stock.update({
        where: { id: item.fabricStockId },
        data: {
          quantityAvailable: { increment: item.quantity },
          quantityConsumed: { decrement: item.quantity },
          status: 'AVAILABLE',
        },
        select: { fabricId: true },
      });

      // Keep the centralized stock_levels shim in sync (bug-hunt procurement-14: this credit
      // used to skip syncStockLevelQuantity while the receiveChallan fabric branch syncs).
      if (updated.fabricId) {
        const fabMat = await tx.materials.findFirst({
          where: { fabricId: updated.fabricId },
          select: { id: true },
        });
        if (fabMat) await syncStockLevelQuantity(fabMat.id, item.quantity, undefined, 'METER', tx);
      }
    }

    return challan;
  });
}

// ============================================
// QUICK ISSUE (Create + Issue in one step)
// ============================================

export async function quickIssueChallan(input: CreateChallanInput) {
  // Step 1: Create challan as DRAFT
  const challan = await createChallan(input);
  // Step 2: Immediately issue it (triggers stock deduction via issueChallan)
  const issuedChallan = await issueChallan(challan.id, input.issuedById);
  return issuedChallan;
}

// ============================================
// STATS
// ============================================

export async function getChallanStats(filters?: { orderId?: string; productionRunId?: string }) {
  const where: Prisma.challansWhereInput = {};
  if (filters?.orderId) where.orderId = filters.orderId;
  if (filters?.productionRunId) where.productionRunId = filters.productionRunId;

  const [byType, byStatus, total] = await Promise.all([
    prisma.challans.groupBy({
      by: ['challanType'],
      where,
      _count: { id: true },
    }),
    prisma.challans.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
    }),
    prisma.challans.count({ where }),
  ]);

  return {
    total,
    byType: byType.map((g) => ({ type: g.challanType, count: g._count.id })),
    byStatus: byStatus.map((g) => ({ status: g.status, count: g._count.id })),
  };
}
