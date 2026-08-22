import prisma from '../config/database';
import { JWO_ACTIVE_FILTER } from './helpers/jwo-status.helper';
import { systemSettingsService } from './system-settings.service';

interface AlertCount {
  count: number;
  oldestDays: number;
}

interface VendorSummary {
  vendorId: string;
  vendorName: string;
  type: string;
  itemsOut: number;
  totalQty: number;
  unit: string;
  oldestSendoutDays: number;
  nextExpectedBack: string | null;
  status: 'ON_TRACK' | 'DUE_SOON' | 'OVERDUE';
}

// P5.4: Variance alert types
interface VarianceAlert {
  id: string;
  type: 'CUTTING' | 'GRN_OVER' | 'GRN_UNDER' | 'COST';
  referenceNumber: string;
  description: string;
  variancePercent: number;
  route: string;
  date: string;
}

interface ManufacturingAlertsResponse {
  alerts: {
    overdueLabDips: AlertCount;
    overdueProcessPOs: AlertCount;
    overdueExternalWork: AlertCount;
    stuckCutting: AlertCount;
    qualityFailures: AlertCount;
    pendingApprovals: AlertCount;
    overdueChallans: AlertCount;
  };
  vendorSummary: VendorSummary[];
  quickStats: {
    totalAlerts: number;
    itemsWithVendors: number;
    dueThisWeek: number;
    overdue: number;
  };
  // P5.4: Variance watchtower
  varianceAlerts: VarianceAlert[];
}

class ManufacturingAlertsService {
  private getDaysDiff(date: Date): number {
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  async getAlerts(): Promise<ManufacturingAlertsResponse> {
    const today = new Date();
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);

    // Stuck threshold: items not updated in X days
    const stuckThresholdDays = 7;
    const stuckThresholdDate = new Date();
    stuckThresholdDate.setDate(stuckThresholdDate.getDate() - stuckThresholdDays);

    // Run all queries in parallel
    const [
      overdueLabDips,
      overdueProcessPOs,
      overdueExternalWork,
      stuckCutting,
      qualityFailures,
      pendingApprovals,
      overdueChallans,
      vendorData,
      dueThisWeekCount,
    ] = await Promise.all([
      // 1. Overdue Lab Dips - submitted but not received, past expected date
      prisma.lab_dips.findMany({
        where: {
          status: 'SUBMITTED',
          expectedDate: { lt: today },
          receivedDate: null,
        },
        select: { submissionDate: true },
        orderBy: { submissionDate: 'asc' },
      }),

      // 2. Overdue Process POs (job_work_orders) - at mill but not received, past expected date
      prisma.job_work_orders.findMany({
        where: {
          status: { in: ['SENT_TO_MILL', 'AT_MILL'] },
          // Landmine No.1: legacy status never records cancellation — exclude via jwoStatus
          AND: [JWO_ACTIVE_FILTER],
          expectedReturnDate: { lt: today },
          receivedDate: null,
        },
        select: { sentDate: true },
        orderBy: { sentDate: 'asc' },
      }),

      // 3. Overdue External Work - sent but not fully received, past expected date
      prisma.external_process_send_outs.findMany({
        where: {
          status: { in: ['SENT', 'PARTIALLY_RECEIVED'] },
          expectedReturnDate: { lt: today },
          actualReturnDate: null,
        },
        select: { sendDate: true },
        orderBy: { sendDate: 'asc' },
      }),

      // 4. Stuck Cutting Batches - in progress but no update in X days
      prisma.cutting_batches.findMany({
        where: {
          status: 'IN_PROGRESS',
          updatedAt: { lt: stuckThresholdDate },
        },
        select: { updatedAt: true },
        orderBy: { updatedAt: 'asc' },
      }),

      // 5. Quality Failures - failed tests not yet resolved
      Promise.all([
        prisma.fabric_physical_tests.count({
          where: { overallTestResult: 'FAIL' },
        }),
        prisma.garment_physical_tests.count({
          where: { overallTestResult: 'FAIL' },
        }),
        prisma.fabric_physical_tests.findFirst({
          where: { overallTestResult: 'FAIL' },
          select: { createdAt: true },
          orderBy: { createdAt: 'asc' },
        }),
      ]),

      // 6. Pending Buyer Approvals - lab dips awaiting buyer approval
      prisma.lab_dips.findMany({
        where: { buyerApprovalStatus: 'PENDING' },
        select: { sentToBuyerDate: true },
        orderBy: { sentToBuyerDate: 'asc' },
      }),

      // 7. Overdue Challans - outward challans not returned, past expected date
      prisma.challans.findMany({
        where: {
          challanType: 'OUTWARD',
          status: { in: ['ISSUED', 'IN_TRANSIT'] },
          expectedDate: { lt: today },
          receivedDate: null,
        },
        select: { issuedDate: true },
        orderBy: { issuedDate: 'asc' },
      }),

      // 8. Vendor Summary - group external work by supplier
      prisma.external_process_send_outs.groupBy({
        by: ['supplierId', 'processType'],
        where: {
          status: { in: ['SENT', 'PARTIALLY_RECEIVED'] },
        },
        _count: { id: true },
        _sum: { quantitySent: true },
        _min: { sendDate: true, expectedReturnDate: true },
      }),

      // 9. Due This Week count
      prisma.external_process_send_outs.count({
        where: {
          status: { in: ['SENT', 'PARTIALLY_RECEIVED'] },
          expectedReturnDate: {
            gte: today,
            lte: weekFromNow,
          },
        },
      }),
    ]);

    // Process quality failures (combined FPT + GPT)
    const [fptFailCount, gptFailCount, oldestFptFail] = qualityFailures;
    const totalQualityFailures = fptFailCount + gptFailCount;
    const oldestQualityFailDays = oldestFptFail?.createdAt ? this.getDaysDiff(oldestFptFail.createdAt) : 0;

    // Fetch supplier names for vendor summary
    const supplierIds = Array.from(new Set(vendorData.map((v) => v.supplierId)));
    const suppliers =
      supplierIds.length > 0
        ? await prisma.suppliers.findMany({
            where: { id: { in: supplierIds } },
            select: { id: true, name: true },
          })
        : [];
    const supplierMap = new Map(suppliers.map((v) => [v.id, v.name]));

    // Build vendor summary with status
    const vendorSummary: VendorSummary[] = vendorData.map((v) => {
      const oldestDays = v._min.sendDate ? this.getDaysDiff(v._min.sendDate) : 0;
      const expectedBack = v._min.expectedReturnDate;

      let status: 'ON_TRACK' | 'DUE_SOON' | 'OVERDUE' = 'ON_TRACK';
      if (expectedBack) {
        if (expectedBack < today) {
          status = 'OVERDUE';
        } else if (expectedBack <= weekFromNow) {
          status = 'DUE_SOON';
        }
      }

      return {
        vendorId: v.supplierId,
        vendorName: supplierMap.get(v.supplierId) || 'Unknown Vendor',
        type: v.processType,
        itemsOut: v._count.id,
        totalQty: Number(v._sum.quantitySent) || 0,
        unit: 'pcs',
        oldestSendoutDays: oldestDays,
        nextExpectedBack: expectedBack ? expectedBack.toISOString().split('T')[0] : null,
        status,
      };
    });

    // Also add job work orders (dyeing/printing mills) to vendor summary
    const jobWorkVendorData = await prisma.job_work_orders.groupBy({
      by: ['processorId', 'processType'],
      where: {
        status: { in: ['SENT_TO_MILL', 'AT_MILL'] },
        // Landmine No.1: legacy status never records cancellation — exclude via jwoStatus
        AND: [JWO_ACTIVE_FILTER],
      },
      _count: { id: true },
      _sum: { qtySentMeters: true },
      _min: { sentDate: true, expectedReturnDate: true },
    });

    // Fetch processor (supplier) names for job work
    const processorIds = Array.from(new Set(jobWorkVendorData.map((v) => v.processorId).filter(Boolean))) as string[];
    const processors =
      processorIds.length > 0
        ? await prisma.suppliers.findMany({
            where: { id: { in: processorIds } },
            select: { id: true, name: true },
          })
        : [];
    const processorMap = new Map(processors.map((v) => [v.id, v.name]));

    for (const v of jobWorkVendorData) {
      if (!v.processorId) continue;

      const oldestDays = v._min.sentDate ? this.getDaysDiff(v._min.sentDate) : 0;
      const expectedBack = v._min.expectedReturnDate;

      let status: 'ON_TRACK' | 'DUE_SOON' | 'OVERDUE' = 'ON_TRACK';
      if (expectedBack) {
        if (expectedBack < today) {
          status = 'OVERDUE';
        } else if (expectedBack <= weekFromNow) {
          status = 'DUE_SOON';
        }
      }

      vendorSummary.push({
        vendorId: v.processorId,
        vendorName: processorMap.get(v.processorId) || 'Unknown Mill',
        type: v.processType || 'PROCESSING',
        itemsOut: v._count.id,
        totalQty: Number(v._sum.qtySentMeters) || 0,
        unit: 'meters',
        oldestSendoutDays: oldestDays,
        nextExpectedBack: expectedBack ? expectedBack.toISOString().split('T')[0] : null,
        status,
      });
    }

    // Sort vendor summary by status (OVERDUE first, then DUE_SOON, then ON_TRACK)
    const statusOrder = { OVERDUE: 0, DUE_SOON: 1, ON_TRACK: 2 };
    vendorSummary.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

    // Calculate alert counts
    const alerts = {
      overdueLabDips: {
        count: overdueLabDips.length,
        oldestDays: overdueLabDips[0]?.submissionDate ? this.getDaysDiff(overdueLabDips[0].submissionDate) : 0,
      },
      overdueProcessPOs: {
        count: overdueProcessPOs.length,
        oldestDays: overdueProcessPOs[0]?.sentDate ? this.getDaysDiff(overdueProcessPOs[0].sentDate) : 0,
      },
      overdueExternalWork: {
        count: overdueExternalWork.length,
        oldestDays: overdueExternalWork[0]?.sendDate ? this.getDaysDiff(overdueExternalWork[0].sendDate) : 0,
      },
      stuckCutting: {
        count: stuckCutting.length,
        oldestDays: stuckCutting[0]?.updatedAt ? this.getDaysDiff(stuckCutting[0].updatedAt) : 0,
      },
      qualityFailures: {
        count: totalQualityFailures,
        oldestDays: oldestQualityFailDays,
      },
      pendingApprovals: {
        count: pendingApprovals.length,
        oldestDays: pendingApprovals[0]?.sentToBuyerDate ? this.getDaysDiff(pendingApprovals[0].sentToBuyerDate) : 0,
      },
      overdueChallans: {
        count: overdueChallans.length,
        oldestDays: overdueChallans[0]?.issuedDate ? this.getDaysDiff(overdueChallans[0].issuedDate) : 0,
      },
    };

    // Calculate quick stats
    const totalAlerts = Object.values(alerts).reduce((sum, a) => sum + a.count, 0);
    const itemsWithVendors = vendorSummary.reduce((sum, v) => sum + v.itemsOut, 0);
    const overdueCount = vendorSummary.filter((v) => v.status === 'OVERDUE').reduce((sum, v) => sum + v.itemsOut, 0);

    // P5.4: Fetch variance alerts
    const varianceAlerts = await this.getVarianceAlerts();

    return {
      alerts,
      vendorSummary,
      quickStats: {
        totalAlerts,
        itemsWithVendors,
        dueThisWeek: dueThisWeekCount,
        overdue: overdueCount,
      },
      varianceAlerts,
    };
  }

  /**
   * P5.4: Get variance alerts for cutting, GRN, and cost variances
   * Returns items that exceed the configured threshold (default 5%)
   */
  private async getVarianceAlerts(): Promise<VarianceAlert[]> {
    const varianceThreshold = await systemSettingsService.getNumberDefault('VARIANCE_ALERT_THRESHOLD_PERCENT');
    const alerts: VarianceAlert[] = [];

    // 1. Cutting variance - batches with significant variance from planned
    // Query batches where absolute variance exceeds threshold
    const cuttingVariances = await prisma.cutting_batches.findMany({
      where: {
        status: { in: ['IN_PROGRESS', 'COMPLETED'] },
        variancePercent: { not: null },
      },
      include: {
        workOrder: {
          select: { workOrderNumber: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50, // Fetch more and filter in code for absolute value check
    });

    for (const batch of cuttingVariances) {
      const variance = Number(batch.variancePercent) || 0;
      if (Math.abs(variance) > varianceThreshold) {
        alerts.push({
          id: batch.id,
          type: 'CUTTING',
          referenceNumber: batch.batchNumber,
          description: `WO: ${batch.workOrder?.workOrderNumber || 'N/A'} - ${variance > 0 ? 'Over' : 'Under'} by ${Math.abs(variance).toFixed(1)}%`,
          variancePercent: variance,
          route: `/manufacturing/cutting/${batch.id}`,
          date: batch.updatedAt.toISOString().split('T')[0],
        });
      }
    }

    // 2. GRN over/under receipt - GRNs with qty variance from PO
    const recentGRNs = await prisma.goods_receiving_notes.findMany({
      where: {
        status: { in: ['ACCEPTED', 'PARTIALLY_ACCEPTED'] },
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // Last 30 days
      },
      include: {
        grn_items: {
          include: {
            purchase_order_items: {
              select: { orderedQuantity: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    for (const grn of recentGRNs) {
      for (const item of grn.grn_items ?? []) {
        const ordered = Number(item.purchase_order_items?.orderedQuantity) || 0;
        const received = Number(item.acceptedQuantity || item.receivedQuantity) || 0;

        if (ordered > 0) {
          const variancePercent = ((received - ordered) / ordered) * 100;

          if (variancePercent > varianceThreshold) {
            alerts.push({
              id: grn.id,
              type: 'GRN_OVER',
              referenceNumber: grn.grnNumber,
              description: `Over-received by ${variancePercent.toFixed(1)}% (${received} vs ${ordered} ordered)`,
              variancePercent,
              route: `/procurement/grn/${grn.id}`,
              date: grn.createdAt.toISOString().split('T')[0],
            });
            break; // One alert per GRN
          } else if (variancePercent < -varianceThreshold) {
            alerts.push({
              id: grn.id,
              type: 'GRN_UNDER',
              referenceNumber: grn.grnNumber,
              description: `Under-received by ${Math.abs(variancePercent).toFixed(1)}% (${received} vs ${ordered} ordered)`,
              variancePercent,
              route: `/procurement/grn/${grn.id}`,
              date: grn.createdAt.toISOString().split('T')[0],
            });
            break;
          }
        }
      }
    }

    // 3. Cost variance - use pre-computed costVariancePercent from order_item_costing
    const costVariances = await prisma.order_item_costing.findMany({
      where: {
        costVariancePercent: { not: null },
      },
      include: {
        order_item: {
          include: {
            orders: {
              select: { id: true, orderNumber: true },
            },
            styles: {
              select: { styleCode: true },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    for (const costing of costVariances) {
      const variancePercent = Number(costing.costVariancePercent) || 0;

      if (Math.abs(variancePercent) > varianceThreshold) {
        const orderNumber = costing.order_item?.orders?.orderNumber || 'N/A';
        const orderId = costing.order_item?.orders?.id || '';
        const styleCode = costing.order_item?.styles?.styleCode || '';

        alerts.push({
          id: costing.id,
          type: 'COST',
          referenceNumber: `${orderNumber}${styleCode ? ` / ${styleCode}` : ''}`,
          description: `Cost ${variancePercent > 0 ? 'over' : 'under'} by ${Math.abs(variancePercent).toFixed(1)}%`,
          variancePercent,
          route: `/orders/${orderId}`,
          date: costing.updatedAt.toISOString().split('T')[0],
        });
      }
    }

    // Sort by absolute variance (highest first), limit to top 25
    return alerts.sort((a, b) => Math.abs(b.variancePercent) - Math.abs(a.variancePercent)).slice(0, 25);
  }
}

export const manufacturingAlertsService = new ManufacturingAlertsService();
