/**
 * Job Work Statutory Reports Service
 * Phase 5 of Job Work Consolidation
 *
 * Generates statutory reports for GST compliance:
 * 1. Section 143 Ageing - Material outstanding with processors (1-year rule)
 * 2. ITC-04 Extract - Goods sent to/received from job workers (quarterly filing)
 * 3. Vendor Performance - Loss against tolerance analysis
 */

import prisma from '../config/database';
import { Decimal } from '@prisma/client/runtime/library';
import { applyShrinkageLoss, multiplyCurrency, roundToCent, toNumber } from '../utils/currency';
import { companyProfileService } from './company-profile.service';
import { JWO_RECEIVED_STATUSES } from './helpers/jwo-status.helper';
import {
  daysSince,
  section143ClockStart,
  section143Severity,
  SECTION_143_YEAR_DAYS,
} from './helpers/section143.helper';
import { coveringChallanWhere } from './helpers/lot-location.helper';

// ============================================
// Section 143 Ageing Report
// ============================================

export interface Section143AgeingItem {
  jobWorkOrderId: string;
  jobWorkNumber: string;
  processorId: string;
  processorName: string;
  processorGstin: string | null;
  processType: string;
  sentDate: Date;
  /**
   * The day the one-year period started: the sent date, or — for cloth the job took where it already
   * lay at the processor — the day the processor received it (statutoryDueDate less a year).
   */
  clockFrom: Date;
  balanceQty: number;
  balanceValue: number;
  unit: string;
  daysOutstanding: number;
  daysRemaining: number; // 365 - daysOutstanding
  severity: 'OK' | 'WARNING' | 'CRITICAL' | 'BREACHED';
}

export interface Section143AgeingSummary {
  asOfDate: Date;
  totalOrdersOutstanding: number;
  totalValueAtProcessors: number;
  ordersOK: number;
  ordersWarning: number; // 270-300 days
  ordersCritical: number; // 300-365 days
  ordersBreached: number; // >365 days
  items: Section143AgeingItem[];
  /**
   * Our goods sitting at a processor on NO job yet — delivered straight there, parked by a Stock-Out,
   * or left there by a cancelled job. The one-year period runs from the day the processor got them,
   * job or no job, so they age here too. A lot with no challan covering it is flagged: goods at a job
   * worker must travel under one (Rule 45).
   */
  held: {
    items: HeldAtProcessorItem[];
    totalQty: number;
    totalValue: number;
    withoutChallan: number;
  };
}

export interface HeldAtProcessorItem {
  greigeStockId: string;
  greigeCode: string | null;
  greigeName: string | null;
  processorId: string | null;
  processorName: string;
  receivedDate: Date;
  quantity: number;
  value: number;
  unit: string;
  daysHeld: number;
  daysRemaining: number;
  severity: Section143AgeingItem['severity'];
  /** The challan the goods are with the processor under, or null when none covers them */
  coveringChallanNumber: string | null;
}

// ============================================
// ITC-04 Extract
// ============================================

export interface ITC04Item {
  challanId: string;
  challanNumber: string;
  challanDate: Date;
  challanType: 'OUTWARD' | 'INWARD';
  processorGstin: string | null;
  processorName: string;
  isUnregistered: boolean;
  description: string;
  hsnSac: string;
  uqc: string; // Unit Quantity Code (MTR, PCS, etc.)
  quantity: number;
  taxableValue: number;
  inputType: 'Inputs' | 'Capital Goods';
  linkedChallanNumber?: string; // For INWARD: reference to original OUTWARD challan
}

export interface ITC04Summary {
  periodStart: Date;
  periodEnd: Date;
  companyGstin: string;
  companyName: string;
  tableA: {
    items: ITC04Item[];
    totalChallans: number;
    totalQuantity: number;
    totalTaxableValue: number;
  };
  tableB: {
    items: ITC04Item[];
    totalChallans: number;
    totalQuantity: number;
    totalTaxableValue: number;
  };
  jobWorkerCount: number;
  unregisteredCount: number;
}

// ============================================
// Vendor Performance Report
// ============================================

export interface VendorPerformanceItem {
  processorId: string;
  processorName: string;
  processType: string;
  ordersCompleted: number;
  totalIssued: number;
  /** Contracted output due back: Σ sent × (1 − expected shrinkage) — the accountability basis. */
  totalExpected: number;
  tolerancePercent: number;
  /** Shortfall vs the contracted output (%) — what tolerance is measured against. */
  shortfallPercent: number;
  /** Physical (issued − received)/issued (%) — includes expected shrinkage; informational only. */
  physicalLossPercent: number;
  /** Back-compat alias of shortfallPercent (pre-2026-08-19 this was the physical loss —
   *  grading every shrinkage-bearing processor "OVER" for meeting the contract). */
  actualLossPercent: number;
  isOverTolerance: boolean;
  debitedAmount: number;
  status: 'WITHIN' | 'AT_LIMIT' | 'OVER';
}

export interface VendorPerformanceSummary {
  periodStart: Date;
  periodEnd: Date;
  totalProcessors: number;
  totalOrdersClosed: number;
  processorsOverTolerance: number;
  totalRecovered: number;
  items: VendorPerformanceItem[];
}

class JobWorkStatutoryService {
  /**
   * Section 143 Ageing Report
   * Tracks material outstanding with processors
   * Flags items approaching or past the 1-year deadline
   */
  async getSection143Ageing(asOfDate?: Date): Promise<Section143AgeingSummary> {
    const reportDate = asOfDate || new Date();

    // Get all JWOs that have been sent but not fully received
    const outstandingOrders = await prisma.job_work_orders.findMany({
      where: {
        sentDate: { not: null },
        isActive: true,
        // Cancelled orders had their stock credited back and their challan cancelled — they must not
        // age toward the 365-day breach. Nor must a settled order (received in full, or closed short):
        // the gap between what was sent and what came back is processing loss, split and settled on
        // the job, not inputs still lying with the processor. Until 2026-09-26 a finished dyeing job
        // stayed "outstanding" for ever on its normal shrinkage (DJ-ESSKY085LS-002: 129.25 m).
        jwoStatus: { notIn: ['CANCELLED', 'CLOSED', ...JWO_RECEIVED_STATUSES] },
        // Not fully received: either no receivedDate or qty mismatch
        OR: [
          { receivedDate: null },
          {
            AND: [
              { qtyReceivedMeters: { not: null } },
              // We'll filter in code for partial receipts
            ],
          },
        ],
      },
      include: {
        processor: {
          select: {
            id: true,
            name: true,
            gst_numbers: {
              where: { isPrimary: true },
              select: { gstNumber: true },
            },
          },
        },
        processTypeMaster: {
          select: { tolerancePercent: true },
        },
      },
      orderBy: { sentDate: 'asc' },
    });

    const items: Section143AgeingItem[] = [];
    let ordersOK = 0;
    let ordersWarning = 0;
    let ordersCritical = 0;
    let ordersBreached = 0;
    let totalValue = 0;

    for (const order of outstandingOrders) {
      if (!order.sentDate) continue;

      const sentQty = Number(order.qtySentMeters);
      const receivedQty = Number(order.qtyReceivedMeters || 0);
      const balanceQty = sentQty - receivedQty;

      // Skip if fully received
      if (balanceQty <= 0) continue;

      // From the day the processor got the goods — for cloth drawn where it lay, that is before the job
      const clockFrom = section143ClockStart(order) ?? order.sentDate;
      const daysOutstanding = daysSince(clockFrom, reportDate);
      const daysRemaining = SECTION_143_YEAR_DAYS - daysOutstanding;

      const severity = section143Severity(daysOutstanding);
      if (severity === 'BREACHED') ordersBreached++;
      else if (severity === 'CRITICAL') ordersCritical++;
      else if (severity === 'WARNING') ordersWarning++;
      else ordersOK++;

      // Material value at risk with the processor — declaredValue (stamped at issue from
      // the lot purchase costs) per metre; job-work rate only as a legacy fallback so old
      // rows don't zero out. The old rate-only basis reported ₹87,920 for ~₹4.48L of greige.
      const unitValue =
        order.declaredValue != null && sentQty > 0
          ? Number(order.declaredValue) / sentQty
          : Number(order.agreedRatePerMeter || 0);
      const balanceValue = balanceQty * unitValue;
      totalValue += balanceValue;

      items.push({
        jobWorkOrderId: order.id,
        jobWorkNumber: order.jobWorkNumber,
        processorId: order.processorId,
        processorName: order.processor.name,
        processorGstin: order.processor.gst_numbers[0]?.gstNumber || null,
        processType: order.processType,
        sentDate: order.sentDate,
        clockFrom,
        balanceQty,
        balanceValue,
        unit: order.uom,
        daysOutstanding,
        daysRemaining,
        severity,
      });
    }

    const held = await this.getHeldAtProcessors(reportDate);
    items.sort((a, b) => a.clockFrom.getTime() - b.clockFrom.getTime());

    return {
      asOfDate: reportDate,
      totalOrdersOutstanding: items.length,
      totalValueAtProcessors: totalValue,
      ordersOK,
      ordersWarning,
      ordersCritical,
      ordersBreached,
      items,
      held,
    };
  }

  /**
   * Greige of ours at a processor and on no job: held there (processorId — delivered straight there,
   * or parked by a Stock-Out) or sitting in the processor's unit before such deliveries were booked as
   * held (the Aug-2026 lots, until scripts/backfill-direct-delivery.ts converts them).
   */
  private async getHeldAtProcessors(reportDate: Date): Promise<Section143AgeingSummary['held']> {
    const lots = await prisma.greige_stock.findMany({
      where: {
        status: 'AVAILABLE',
        quantityAvailable: { gt: 0 },
        OR: [{ processorId: { not: null } }, { warehouse: { warehouseType: 'JOB_WORK' } }],
      },
      select: {
        id: true,
        quantityAvailable: true,
        receivedDate: true,
        purchaseCost: true,
        weightedAvgCost: true,
        processorId: true,
        processor: { select: { name: true } },
        warehouse: { select: { warehouseName: true, supplierId: true, supplier: { select: { name: true } } } },
        greige: { select: { greigeCode: true, greigeName: true } },
        sourceChallan: { select: { challanNumber: true, status: true } },
      },
      orderBy: { receivedDate: 'asc' },
    });

    const items: HeldAtProcessorItem[] = lots.map((lot) => {
      const daysHeld = daysSince(lot.receivedDate, reportDate);
      const rate = Number(lot.purchaseCost ?? lot.weightedAvgCost ?? 0);
      const covering = lot.sourceChallan && lot.sourceChallan.status !== 'CANCELLED' ? lot.sourceChallan : null;
      return {
        greigeStockId: lot.id,
        greigeCode: lot.greige?.greigeCode ?? null,
        greigeName: lot.greige?.greigeName ?? null,
        processorId: lot.processorId ?? lot.warehouse?.supplierId ?? null,
        processorName:
          lot.processor?.name ?? lot.warehouse?.supplier?.name ?? lot.warehouse?.warehouseName ?? 'Processor',
        receivedDate: lot.receivedDate,
        quantity: Number(lot.quantityAvailable),
        value: toNumber(multiplyCurrency(Number(lot.quantityAvailable), rate)),
        unit: 'METER',
        daysHeld,
        daysRemaining: SECTION_143_YEAR_DAYS - daysHeld,
        severity: section143Severity(daysHeld),
        coveringChallanNumber: covering?.challanNumber ?? null,
      };
    });

    return {
      items,
      totalQty: items.reduce((sum, i) => sum + i.quantity, 0),
      totalValue: items.reduce((sum, i) => sum + i.value, 0),
      withoutChallan: items.filter((i) => !i.coveringChallanNumber).length,
    };
  }

  /**
   * ITC-04 Extract
   * Goods sent to and received from job workers
   * Required for quarterly GST filing
   */
  async getITC04Extract(periodStart: Date, periodEnd: Date): Promise<ITC04Summary> {
    // The DEFAULT entity — an ITC-04 return is filed under ONE GSTIN, so picking "any active
    // row" would file a quarterly statutory return under an arbitrary entity once a second one
    // exists. getDefault() throws a NotFoundError with the same meaning as the old guard.
    const company = await companyProfileService.getDefault();

    // Table A: Goods sent to job worker (OUTWARD challans)
    const outwardChallans = await prisma.challans.findMany({
      where: {
        challanType: 'OUTWARD',
        challanDate: {
          gte: periodStart,
          lte: periodEnd,
        },
        status: { not: 'CANCELLED' },
        // Goods sent to a job worker: job-work challans (toType VENDOR — issues, dispatches, and the
        // Rule 45 challans for goods a supplier delivered straight to the processor) AND Stock-Out
        // challans that parked greige at a processor (toType SUPPLIER, recognisable by the TRANSFER
        // lot they created there). A plain return to a supplier creates no such lot and stays out.
        OR: [{ toType: 'VENDOR' }, { toType: 'SUPPLIER', greigeStockTransfers: { some: { sourceType: 'TRANSFER' } } }],
      },
      include: {
        items: {
          include: {
            jobWorkOrder: {
              include: {
                processTypeMaster: true,
              },
            },
            // A Stock-Out line carries no value of its own — the lot's purchase rate values it
            greigeStock: { select: { purchaseCost: true, weightedAvgCost: true } },
          },
        },
      },
      orderBy: { challanDate: 'asc' },
    });

    // Table B: Goods received back from job worker (INWARD challans)
    const inwardChallans = await prisma.challans.findMany({
      where: {
        challanType: 'INWARD',
        challanDate: {
          gte: periodStart,
          lte: periodEnd,
        },
        status: { not: 'CANCELLED' },
        fromType: 'VENDOR',
      },
      include: {
        items: {
          include: {
            // Goods brought back with no job (Bring to store): the line names the held lot, whose
            // covering challan is the one they went out under
            greigeStock: { select: { sourceChallan: { select: { challanNumber: true } } } },
            jobWorkOrder: {
              select: {
                outwardChallan: { select: { challanNumber: true } },
                // A job that took cloth where it lay went out on no challan of its own: the one that
                // covers its lot (direct supply / Stock-Out) is the outward challan Table B links to
                greigeStockLot: { select: { sourceChallan: { select: { challanNumber: true } } } },
              },
            },
          },
        },
        jobWorkOrder: {
          select: {
            outwardChallan: { select: { challanNumber: true } },
            greigeStockLot: { select: { sourceChallan: { select: { challanNumber: true } } } },
          },
        },
      },
      orderBy: { challanDate: 'asc' },
    });

    // Lace / fabric brought back with no job: the direct-supply challan naming the held lot
    const heldLotIds = inwardChallans
      .flatMap((c) => c.items)
      .filter((i) => !i.jobWorkOrderId)
      .map((i) => i.laceStockId ?? i.fabricStockId)
      .filter((id): id is string => !!id);
    const heldCovering = new Map<string, string>();
    if (heldLotIds.length > 0) {
      const coveringLines = await prisma.challan_items.findMany({
        where: {
          OR: [{ laceStockId: { in: heldLotIds } }, { fabricStockId: { in: heldLotIds } }],
          challan: coveringChallanWhere(),
        },
        select: { laceStockId: true, fabricStockId: true, challan: { select: { challanNumber: true } } },
      });
      for (const l of coveringLines) heldCovering.set((l.laceStockId ?? l.fabricStockId)!, l.challan.challanNumber);
    }

    // Get unique processors for GSTIN lookup
    const processorIds = new Set<string>();
    outwardChallans.forEach((c) => c.toId && processorIds.add(c.toId));
    inwardChallans.forEach((c) => c.fromId && processorIds.add(c.fromId));

    const processors = await prisma.suppliers.findMany({
      where: { id: { in: Array.from(processorIds) } },
      include: {
        gst_numbers: {
          where: { isPrimary: true },
          select: { gstNumber: true },
        },
      },
    });

    const processorMap = new Map(
      processors.map((p) => [
        p.id,
        {
          name: p.name,
          gstin: p.gst_numbers[0]?.gstNumber || null,
        },
      ])
    );

    // Build Table A items
    const tableAItems: ITC04Item[] = [];
    for (const challan of outwardChallans) {
      const processor = processorMap.get(challan.toId || '') || {
        name: challan.toName,
        gstin: null,
      };

      for (const item of challan.items) {
        // taxableValue: use declaredValue if present, otherwise quantity × rate
        // BUG FIX: declaredValue is already a monetary value, don't multiply by rate again
        const rate = Number(item.rate ?? item.greigeStock?.purchaseCost ?? item.greigeStock?.weightedAvgCost ?? 0);
        const taxableValue =
          item.declaredValue !== null
            ? Number(item.declaredValue)
            : toNumber(roundToCent(multiplyCurrency(Number(item.quantity), rate)));

        tableAItems.push({
          challanId: challan.id,
          challanNumber: challan.challanNumber,
          challanDate: challan.challanDate,
          challanType: 'OUTWARD',
          processorGstin: processor.gstin,
          processorName: processor.name,
          isUnregistered: !processor.gstin,
          description: item.description,
          hsnSac: item.jobWorkOrder?.processTypeMaster?.sacCode || '998821',
          uqc: item.unit,
          quantity: Number(item.quantity),
          taxableValue,
          inputType: 'Inputs',
        });
      }
    }

    // Build Table B items
    const tableBItems: ITC04Item[] = [];
    for (const challan of inwardChallans) {
      const processor = processorMap.get(challan.fromId || '') || {
        name: challan.fromName,
        gstin: null,
      };

      for (const item of challan.items) {
        tableBItems.push({
          challanId: challan.id,
          challanNumber: challan.challanNumber,
          challanDate: challan.challanDate,
          challanType: 'INWARD',
          processorGstin: processor.gstin,
          processorName: processor.name,
          isUnregistered: !processor.gstin,
          description: item.description,
          hsnSac: '998821',
          uqc: item.unit,
          quantity: Number(item.receivedQty || item.quantity),
          taxableValue: Number(item.declaredValue || 0),
          inputType: 'Inputs',
          // The outward challan the goods went out under (ITC-04 Table B's "original challan")
          linkedChallanNumber:
            item.jobWorkOrder?.outwardChallan?.challanNumber ??
            item.jobWorkOrder?.greigeStockLot?.sourceChallan?.challanNumber ??
            challan.jobWorkOrder?.outwardChallan?.challanNumber ??
            challan.jobWorkOrder?.greigeStockLot?.sourceChallan?.challanNumber ??
            item.greigeStock?.sourceChallan?.challanNumber ??
            heldCovering.get(item.laceStockId ?? item.fabricStockId ?? '') ??
            undefined,
        });
      }
    }

    // Count unique job workers
    const uniqueProcessors = new Set([
      ...tableAItems.map((i) => i.processorName),
      ...tableBItems.map((i) => i.processorName),
    ]);
    const unregisteredProcessors = new Set(
      [...tableAItems, ...tableBItems].filter((i) => i.isUnregistered).map((i) => i.processorName)
    );

    return {
      periodStart,
      periodEnd,
      companyGstin: company.gstin,
      companyName: company.name,
      tableA: {
        items: tableAItems,
        totalChallans: outwardChallans.length,
        totalQuantity: tableAItems.reduce((sum, i) => sum + i.quantity, 0),
        totalTaxableValue: tableAItems.reduce((sum, i) => sum + i.taxableValue, 0),
      },
      tableB: {
        items: tableBItems,
        totalChallans: inwardChallans.length,
        totalQuantity: tableBItems.reduce((sum, i) => sum + i.quantity, 0),
        totalTaxableValue: tableBItems.reduce((sum, i) => sum + i.taxableValue, 0),
      },
      jobWorkerCount: uniqueProcessors.size,
      unregisteredCount: unregisteredProcessors.size,
    };
  }

  /**
   * Vendor Performance Report
   * Tracks processor loss against tolerance
   */
  async getVendorPerformance(periodStart: Date, periodEnd: Date): Promise<VendorPerformanceSummary> {
    // Get completed JWOs in the period
    const completedOrders = await prisma.job_work_orders.findMany({
      where: {
        receivedDate: {
          gte: periodStart,
          lte: periodEnd,
        },
        isActive: true,
        qtyReceivedMeters: { not: null },
      },
      include: {
        processor: {
          select: {
            id: true,
            name: true,
          },
        },
        processTypeMaster: {
          select: { tolerancePercent: true },
        },
      },
    });

    // Group by processor + process type
    const processorStats = new Map<
      string,
      {
        processorId: string;
        processorName: string;
        processType: string;
        orders: number;
        totalIssued: number;
        totalExpected: number;
        totalReceived: number;
        tolerancePercent: number;
        debitedAmount: number;
      }
    >();

    for (const order of completedOrders) {
      const key = `${order.processorId}:${order.processType}`;
      const existing = processorStats.get(key) || {
        processorId: order.processorId,
        processorName: order.processor.name,
        processType: order.processType,
        orders: 0,
        totalIssued: 0,
        totalExpected: 0,
        totalReceived: 0,
        // ?? not ||: a configured 0% tolerance is STRICT, not "use 3%"; missing = strict too
        tolerancePercent: Number(order.processTypeMaster?.tolerancePercent ?? 0),
        debitedAmount: 0,
      };

      const sent = Number(order.qtySentMeters);
      // Contracted expected output — SAME basis as calculateLossSplit. Shrinkage-derived
      // first: expectedShrinkage survives close's settle-on-actuals overwrite of
      // qtyBillable, so the report stays stable after settlement. Never above sent.
      const shrink = order.expectedShrinkage != null ? Number(order.expectedShrinkage) : 0;
      const rawExpected =
        shrink > 0 && shrink < 100
          ? toNumber(applyShrinkageLoss(sent, shrink))
          : order.qtyBillable != null
            ? Number(order.qtyBillable)
            : sent;
      const expected = Math.min(rawExpected, sent);

      existing.orders++;
      existing.totalIssued += sent;
      existing.totalExpected += expected;
      existing.totalReceived += Number(order.qtyReceivedMeters || 0);

      // BUG FIX: Use per-order qtyAbnormalLoss (Phase 6 field) instead of recalculating from cumulative
      // This avoids the double-counting bug where cumulative loss was multiplied by per-order rate
      const orderAbnormalLoss = Number(order.qtyAbnormalLoss || 0);
      const rate = Number(order.agreedRatePerMeter || 0);
      existing.debitedAmount += orderAbnormalLoss * rate;

      processorStats.set(key, existing);
    }

    // Build items
    const items: VendorPerformanceItem[] = [];
    let processorsOverTolerance = 0;
    let totalRecovered = 0;

    for (const stats of processorStats.values()) {
      // Physical loss (incl. expected shrinkage) — informational only. Grading against it
      // branded every shrinkage-bearing processor OVER for meeting the contract.
      const physicalLossPercent =
        stats.totalIssued > 0 ? ((stats.totalIssued - stats.totalReceived) / stats.totalIssued) * 100 : 0;
      // Accountability figure: shortfall vs the contracted output — what tolerance means.
      const shortfallPercent =
        stats.totalExpected > 0
          ? (Math.max(0, stats.totalExpected - stats.totalReceived) / stats.totalExpected) * 100
          : 0;

      let status: VendorPerformanceItem['status'];
      if (shortfallPercent > stats.tolerancePercent) {
        status = 'OVER';
      } else if (stats.tolerancePercent > 0 && shortfallPercent >= stats.tolerancePercent * 0.9) {
        status = 'AT_LIMIT';
      } else {
        status = 'WITHIN';
      }
      const isOverTolerance = status === 'OVER';
      if (isOverTolerance) processorsOverTolerance++;
      totalRecovered += stats.debitedAmount;

      items.push({
        processorId: stats.processorId,
        processorName: stats.processorName,
        processType: stats.processType,
        ordersCompleted: stats.orders,
        totalIssued: stats.totalIssued,
        totalExpected: Math.round(stats.totalExpected * 100) / 100,
        tolerancePercent: stats.tolerancePercent,
        shortfallPercent: Math.round(shortfallPercent * 100) / 100,
        physicalLossPercent: Math.round(physicalLossPercent * 100) / 100,
        actualLossPercent: Math.round(shortfallPercent * 100) / 100,
        isOverTolerance,
        debitedAmount: Math.round(stats.debitedAmount * 100) / 100,
        status,
      });
    }

    // Sort by shortfall (accountability) descending
    items.sort((a, b) => b.shortfallPercent - a.shortfallPercent);

    return {
      periodStart,
      periodEnd,
      totalProcessors: processorStats.size,
      totalOrdersClosed: completedOrders.length,
      processorsOverTolerance,
      totalRecovered,
      items,
    };
  }
}

export const jobWorkStatutoryService = new JobWorkStatutoryService();
export default jobWorkStatutoryService;
