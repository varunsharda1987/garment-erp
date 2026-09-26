import { JobWorkOrderStatus, UserRole } from '@prisma/client';
import prisma from '../config/database';
import { scopeForRole, type AlertKey, type ControlCenterScope, type SectionKey } from '../config/control-center-panels';
import { JWO_AT_PROCESSOR_STATUSES, JWO_RECEIVED_STATUSES } from './helpers/jwo-status.helper';
import { systemSettingsService } from './system-settings.service';
import { UNRESOLVED_TEST_FAILURE } from './helpers/test-failure.helper';
import { toDateInputValue } from '../utils/date';
import { unitShort } from '../utils/units';
import { foldActual } from '../utils/fold-length';

/**
 * A job that can no longer bring material back. Deliberately "definitively done" rather than the
 * inverse of JWO_AT_PROCESSOR_STATUSES: a job sitting in an unexpected status should keep its
 * challan VISIBLE on the alert, not vanish from it.
 */
const SETTLED_JWO_STATUSES: JobWorkOrderStatus[] = [...JWO_RECEIVED_STATUSES, 'CANCELLED', 'CLOSED'];

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
  /**
   * Only the rows in scope for the caller's role, in that role's order. A key that is ABSENT was
   * never computed — it is not the same as a row that came back zero.
   */
  alerts: Partial<Record<AlertKey, AlertCount>>;
  /** Which blocks this role's page should render, and in what order. See control-center-panels.ts. */
  panels: ControlCenterScope;
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

/**
 * "Overdue" for a column that is allowed to be NULL.
 *
 * Prisma's `{ lt: today }` silently EXCLUDES NULLs, so a feeder keyed only on a due date reports
 * zero for every row where nobody filled one in. That is not a theoretical risk: on 2026-09-21 all
 * 8 rows in `challans` had `expectedDate` NULL, so the Control Center's Overdue Challans alert had
 * never once been able to fire — including for a challan 54 days out at a vendor.
 *
 * So a row is overdue when the due date has passed, OR there is no due date and it left longer ago
 * than the grace window. `anchors` is a fallback chain (first non-null wins) because the "when did
 * this leave" date is itself nullable — a challan may have an `issuedDate` or only a `challanDate`.
 */
function overdueOr(dueField: string, anchors: string[], today: Date, graceCutoff: Date) {
  return {
    OR: [
      { [dueField]: { lt: today } },
      // Each branch pins every earlier anchor to null so the chain reads first-non-null, which is
      // what COALESCE would do — and Prisma cannot COALESCE inside a `where`.
      ...anchors.map((anchor, i) => ({
        [dueField]: null,
        ...Object.fromEntries(anchors.slice(0, i).map((earlier) => [earlier, null])),
        [anchor]: { lt: graceCutoff },
      })),
    ],
  };
}

class ManufacturingAlertsService {
  private getDaysDiff(date: Date): number {
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Days since the oldest row in a set, taking each row's first non-null anchor.
   *
   * Not `rows[0]` after an `orderBy`: Postgres sorts NULLs LAST on ASC, so a set whose oldest row
   * has a null anchor reported `oldestDays: 0` — "overdue, by zero days".
   */
  private oldestDaysAmong<T extends Record<string, unknown>>(rows: T[], anchors: (keyof T)[]): number {
    let oldest = 0;
    for (const row of rows) {
      for (const anchor of anchors) {
        const value = row[anchor];
        if (value instanceof Date) {
          oldest = Math.max(oldest, this.getDaysDiff(value));
          break;
        }
      }
    }
    return oldest;
  }

  /**
   * @param role the caller's role. Decides which panels and alert rows are computed at all — see
   *   `control-center-panels.ts`. An out-of-scope alert is ABSENT from the response, never zero:
   *   this page was rebuilt so that a zero always means "we looked and found nothing", and a zero
   *   meaning "not your job" would put the dishonesty straight back.
   */
  async getAlerts(role?: UserRole | string): Promise<ManufacturingAlertsResponse> {
    const scope = scopeForRole(role);
    const wantsAlert = (key: AlertKey) => scope.alerts.includes(key);
    const wantsSection = (key: SectionKey) => scope.sections.includes(key);

    /** Run a query only when its alert row is in scope; otherwise skip the database entirely. */
    const ifWanted = <T>(key: AlertKey, query: () => Promise<T>): Promise<T | null> =>
      wantsAlert(key) ? query() : Promise.resolve(null);

    const today = new Date();
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);

    // Both thresholds are Settings values, not literals (defaults.registry.ts rule 1). Note the
    // settings cache is 5 minutes and per-PM2-fork, so a change can take that long to show and two
    // forks may briefly disagree — acceptable for a dashboard count, documented in the setting.
    const [stuckThresholdDays, graceDays] = await Promise.all([
      systemSettingsService.getNumberDefault('STUCK_PROCESS_THRESHOLD_DAYS'),
      systemSettingsService.getNumberDefault('OVERDUE_NO_DUE_DATE_GRACE_DAYS'),
    ]);

    const stuckThresholdDate = new Date();
    stuckThresholdDate.setDate(stuckThresholdDate.getDate() - stuckThresholdDays);

    // Anything sent this long ago with no promised return date is treated as overdue. See
    // `overdueOr` for why a nullable due-date column is otherwise unalertable.
    const graceCutoff = new Date();
    graceCutoff.setDate(graceCutoff.getDate() - graceDays);

    // Run all queries in parallel
    const [
      overdueLabDips,
      overdueProcessPOs,
      overdueExternalWork,
      stuckCutting,
      qualityFailures,
      pendingApprovals,
      overdueChallans,
      poDeliveryUndecided,
      vendorData,
      dueThisWeekCounts,
    ] = await Promise.all([
      // 1. Overdue Lab Dips - submitted but not received, past expected date (or past the grace
      //    window when no expected date was ever set — see overdueOr)
      ifWanted('overdueLabDips', () =>
        prisma.lab_dips.findMany({
          where: {
            status: 'SUBMITTED',
            receivedDate: null,
            isActive: true,
            ...overdueOr('expectedDate', ['submissionDate'], today, graceCutoff),
          },
          select: { submissionDate: true },
        })
      ),

      // 2. Overdue Process POs (job_work_orders) - at processor but not received, past expected date
      ifWanted('overdueProcessPOs', () =>
        prisma.job_work_orders.findMany({
          where: {
            jwoStatus: { in: JWO_AT_PROCESSOR_STATUSES },
            receivedDate: null,
            isActive: true,
            ...overdueOr('expectedReturnDate', ['sentDate'], today, graceCutoff),
          },
          select: { sentDate: true },
        })
      ),

      // 3. Overdue External Work - sent but not fully received, past expected date
      ifWanted('overdueExternalWork', () =>
        prisma.external_process_send_outs.findMany({
          where: {
            status: { in: ['SENT', 'PARTIALLY_RECEIVED'] },
            actualReturnDate: null,
            isActive: true,
            ...overdueOr('expectedReturnDate', ['sendDate'], today, graceCutoff),
          },
          select: { sendDate: true },
        })
      ),

      // 4. Stuck Cutting Batches - in progress but no update in X days
      ifWanted('stuckCutting', () =>
        prisma.cutting_batches.findMany({
          where: {
            status: 'IN_PROGRESS',
            updatedAt: { lt: stuckThresholdDate },
            isActive: true,
          },
          select: { updatedAt: true },
          orderBy: { updatedAt: 'asc' },
        })
      ),

      // 5. Quality Failures - failures that still need someone. See UNRESOLVED_TEST_FAILURE for why
      //    a bare `overallTestResult: 'FAIL'` made this tile permanently un-clearable.
      ifWanted('qualityFailures', () =>
        Promise.all([
          prisma.fabric_physical_tests.count({ where: UNRESOLVED_TEST_FAILURE }),
          prisma.garment_physical_tests.count({ where: UNRESOLVED_TEST_FAILURE }),
          // Oldest across BOTH kinds — this looked only at fabric, so an ageing garment failure
          // reported "0 days".
          prisma.fabric_physical_tests.findFirst({
            where: UNRESOLVED_TEST_FAILURE,
            select: { createdAt: true },
            orderBy: { createdAt: 'asc' },
          }),
          prisma.garment_physical_tests.findFirst({
            where: UNRESOLVED_TEST_FAILURE,
            select: { createdAt: true },
            orderBy: { createdAt: 'asc' },
          }),
        ])
      ),

      // 6. Pending Buyer Approvals - lab dips awaiting buyer approval
      ifWanted('pendingApprovals', () =>
        prisma.lab_dips.findMany({
          where: { buyerApprovalStatus: 'PENDING', isActive: true },
          select: { sentToBuyerDate: true },
          orderBy: { sentToBuyerDate: 'asc' },
        })
      ),

      // 7. Overdue Challans - outward challans whose goods have not come back.
      //
      // PARTIALLY_RECEIVED counts: material is still at the vendor. The job-status arm is
      // belt-and-braces behind the lifecycle writer (jwo-challan-lifecycle.helper.ts) — it hides a
      // challan whose jobs are DEFINITIVELY done rather than showing only ones we think are open,
      // so a job stuck in an unexpected status stays visible instead of vanishing.
      //
      // The `jobWorkOrderId: null` arm is load-bearing: an orphan challan with no job link is
      // exactly the row nobody can close from data alone (CH2607-0001, 500 units at Manish Textiles
      // since 2026-07-29), and it is the single most important thing this alert can surface.
      ifWanted('overdueChallans', () =>
        prisma.challans.findMany({
          where: {
            challanType: 'OUTWARD',
            status: { in: ['ISSUED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED'] },
            receivedDate: null,
            AND: [
              overdueOr('expectedDate', ['issuedDate', 'challanDate'], today, graceCutoff),
              {
                OR: [
                  // Orphan: neither a header link nor a per-job dispatch link.
                  { jobWorkOrderId: null, jobWorkOutward: { none: {} } },
                  // The header's job is still open.
                  { jobWorkOrder: { jwoStatus: { notIn: SETTLED_JWO_STATUSES } } },
                  // A consolidated dispatch leaves the header NULL and links each job through
                  // outwardChallanId instead, so ANY job on the truck still being open keeps the
                  // whole challan visible. Without this arm, one returned job would hide the rest.
                  { jobWorkOutward: { some: { jwoStatus: { notIn: SETTLED_JWO_STATUSES } } } },
                ],
              },
            ],
          },
          select: { issuedDate: true, challanDate: true },
        })
      ),

      // 7b. A sent PO due within 3 days whose delivery place is still "to be advised": the supplier is
      //     about to dispatch with nowhere to deliver. A split PO's header mirrors point 1, so an empty
      //     header IS undecided. Clears the moment a place is set (direct-to-processor plan, Phase 3).
      ifWanted('poDeliveryUndecided', () =>
        prisma.purchase_orders.findMany({
          where: {
            status: { in: ['SENT', 'ACKNOWLEDGED'] },
            deliveryLocationId: null,
            expectedDeliveryDate: { lte: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000) },
          },
          select: { poDate: true },
        })
      ),

      // 8. Vendor Summary - group external work by supplier.
      //    `unit` joins the grouping key so the row can report what it actually holds instead of
      //    the hardcoded 'pcs' this used to print over MTR work. A vendor holding both PCS and MTR
      //    work correctly splits into two rows — you cannot sum pieces and metres.
      wantsSection('vendors')
        ? prisma.external_process_send_outs.groupBy({
            by: ['supplierId', 'processType', 'unit'],
            where: {
              status: { in: ['SENT', 'PARTIALLY_RECEIVED'] },
              isActive: true,
            },
            _count: { id: true },
            _sum: { quantitySent: true },
            _min: { sendDate: true, expectedReturnDate: true },
          })
        : Promise.resolve([]),

      // 9. Due This Week — across BOTH vendor populations.
      //
      // This counted only external_process_send_outs until 2026-09-21, so job work (the flow this
      // factory actually uses, and the one the vendor table below already includes) never reached
      // the tile: it read 0 with fabric genuinely due back at a dyer. The quick stats must be
      // derived from the same population as the table they sit above.
      wantsSection('vendors')
        ? Promise.all([
            prisma.external_process_send_outs.count({
              where: {
                status: { in: ['SENT', 'PARTIALLY_RECEIVED'] },
                isActive: true,
                expectedReturnDate: { gte: today, lte: weekFromNow },
              },
            }),
            prisma.job_work_orders.count({
              where: {
                jwoStatus: { in: JWO_AT_PROCESSOR_STATUSES },
                isActive: true,
                expectedReturnDate: { gte: today, lte: weekFromNow },
              },
            }),
          ])
        : Promise.resolve([] as number[]),
    ]);

    // Process quality failures (combined FPT + GPT). Null when the row is out of scope for this
    // role — the queries above were never run.
    const [fptFailCount, gptFailCount, oldestFptFail, oldestGptFail] = qualityFailures ?? [0, 0, null, null];
    const totalQualityFailures = fptFailCount + gptFailCount;
    const oldestQualityFailDays = this.oldestDaysAmong(
      [oldestFptFail, oldestGptFail].filter((r): r is { createdAt: Date } => r != null),
      ['createdAt']
    );

    const dueThisWeek = dueThisWeekCounts.reduce((sum, n) => sum + n, 0);

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
        // external_process_send_outs.unit holds PIECE / METER (older rows PCS / MTR) — read any of them.
        unit: unitShort(v.unit),
        oldestSendoutDays: oldestDays,
        nextExpectedBack: expectedBack ? toDateInputValue(expectedBack) : null,
        status,
      };
    });

    // Also add job work orders (dyeing/printing mills) to vendor summary
    const jobWorkVendorData = await prisma.job_work_orders.groupBy({
      // `uom` joins the key for the same reason as the external-process group above.
      by: ['processorId', 'processType', 'uom'],
      where: {
        jwoStatus: { in: JWO_AT_PROCESSOR_STATUSES },
        isActive: true,
      },
      _count: { id: true },
      // qtySentMeters is the quantity whatever the uom — the column name is a legacy misnomer.
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
        // job_work_orders.uom is MTR | PCS | KG — a piece-work job used to render "500 meters".
        unit: unitShort(v.uom),
        oldestSendoutDays: oldestDays,
        nextExpectedBack: expectedBack ? toDateInputValue(expectedBack) : null,
        status,
      });
    }

    // Sort vendor summary by status (OVERDUE first, then DUE_SOON, then ON_TRACK)
    const statusOrder = { OVERDUE: 0, DUE_SOON: 1, ON_TRACK: 2 };
    vendorSummary.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

    // Calculate alert counts.
    //
    // `oldestDays` is a max over the whole set, not `rows[0]` after an `orderBy`: Postgres sorts
    // NULLs LAST on ASC, so a set whose oldest row had a null anchor reported "overdue, 0 days".
    // The anchor lists mirror the fallback chains in each query's overdueOr.
    //
    // Only in-scope rows are built. An out-of-scope key is ABSENT, never `{count: 0}` — a zero on
    // this page means "we looked and found nothing", and must not come to mean "not your job".
    const computed: Record<AlertKey, AlertCount | null> = {
      overdueLabDips: overdueLabDips && {
        count: overdueLabDips.length,
        oldestDays: this.oldestDaysAmong(overdueLabDips, ['submissionDate']),
      },
      overdueProcessPOs: overdueProcessPOs && {
        count: overdueProcessPOs.length,
        oldestDays: this.oldestDaysAmong(overdueProcessPOs, ['sentDate']),
      },
      overdueExternalWork: overdueExternalWork && {
        count: overdueExternalWork.length,
        oldestDays: this.oldestDaysAmong(overdueExternalWork, ['sendDate']),
      },
      stuckCutting: stuckCutting && {
        count: stuckCutting.length,
        oldestDays: this.oldestDaysAmong(stuckCutting, ['updatedAt']),
      },
      qualityFailures: qualityFailures && {
        count: totalQualityFailures,
        oldestDays: oldestQualityFailDays,
      },
      pendingApprovals: pendingApprovals && {
        count: pendingApprovals.length,
        oldestDays: this.oldestDaysAmong(pendingApprovals, ['sentToBuyerDate']),
      },
      overdueChallans: overdueChallans && {
        count: overdueChallans.length,
        oldestDays: this.oldestDaysAmong(overdueChallans, ['issuedDate', 'challanDate']),
      },
      poDeliveryUndecided: poDeliveryUndecided && {
        count: poDeliveryUndecided.length,
        oldestDays: this.oldestDaysAmong(poDeliveryUndecided, ['poDate']),
      },
    };

    // Built in the role's own order, so the page can render straight from it.
    const alerts: Partial<Record<AlertKey, AlertCount>> = {};
    for (const key of scope.alerts) {
      const value = computed[key];
      if (value) alerts[key] = value;
    }

    // Quick stats are derived from the IN-SCOPE population only, so the cards never total something
    // the rows beneath them cannot explain.
    const totalAlerts = Object.values(alerts).reduce((sum, a) => sum + a.count, 0);
    const itemsWithVendors = vendorSummary.reduce((sum, v) => sum + v.itemsOut, 0);
    const overdueCount = vendorSummary.filter((v) => v.status === 'OVERDUE').reduce((sum, v) => sum + v.itemsOut, 0);

    // P5.4: Fetch variance alerts
    const varianceAlerts = wantsSection('variance') ? await this.getVarianceAlerts() : [];

    return {
      alerts,
      panels: scope,
      vendorSummary,
      quickStats: {
        totalAlerts,
        itemsWithVendors,
        dueThisWeek,
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

    // 1. Cutting variance - batches with significant variance from planned.
    //
    // The threshold is in the WHERE, not applied in JS afterwards. It used to take the 50 most
    // recently-updated batches and filter those, so a 40% variance became invisible the moment 50
    // newer well-behaved batches existed — the limit silently hid exactly what the tile is for.
    const cuttingVariances = await prisma.cutting_batches.findMany({
      where: {
        status: { in: ['IN_PROGRESS', 'COMPLETED'] },
        isActive: true,
        OR: [{ variancePercent: { gt: varianceThreshold } }, { variancePercent: { lt: -varianceThreshold } }],
      },
      include: {
        workOrder: {
          select: { workOrderNumber: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
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
          date: toDateInputValue(batch.updatedAt),
        });
      }
    }

    // 2. GRN over/under receipt - GRNs with qty variance from PO.
    //
    // The variance is computed in JS from received-vs-ordered, so it cannot go into a Prisma where.
    // What can improve is the shape: a narrow `select` instead of `include` (this ran on every
    // 60-second poll and was the heaviest query on the endpoint), and a configurable lookback
    // instead of a hardcoded 30 days that silently retired unresolved over-receipts.
    const lookbackDays = await systemSettingsService.getNumberDefault('VARIANCE_LOOKBACK_DAYS');
    const recentGRNs = await prisma.goods_receiving_notes.findMany({
      where: {
        status: { in: ['ACCEPTED', 'PARTIALLY_ACCEPTED'] },
        createdAt: { gte: new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000) },
      },
      select: {
        id: true,
        grnNumber: true,
        createdAt: true,
        grn_items: {
          select: {
            acceptedQuantity: true,
            receivedQuantity: true,
            foldLengthCm: true,
            purchase_order_items: { select: { orderedQuantity: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    for (const grn of recentGRNs) {
      for (const item of grn.grn_items ?? []) {
        const ordered = Number(item.purchase_order_items?.orderedQuantity) || 0;
        // ACTUAL metres — the PO is in actual metres; a receipt counted at fold L is compared after conversion.
        const received = foldActual(item.acceptedQuantity || item.receivedQuantity || 0, item.foldLengthCm).toNumber();

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
              date: toDateInputValue(grn.createdAt),
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
              date: toDateInputValue(grn.createdAt),
            });
            break;
          }
        }
      }
    }

    // 3. Cost variance - use pre-computed costVariancePercent from order_item_costing
    const costVariances = await prisma.order_item_costing.findMany({
      where: {
        // Threshold in the query, same reason as the cutting variance above.
        OR: [{ costVariancePercent: { gt: varianceThreshold } }, { costVariancePercent: { lt: -varianceThreshold } }],
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
          date: toDateInputValue(costing.updatedAt),
        });
      }
    }

    // Sort by absolute variance (highest first), limit to top 25
    return alerts.sort((a, b) => Math.abs(b.variancePercent) - Math.abs(a.variancePercent)).slice(0, 25);
  }
}

export const manufacturingAlertsService = new ManufacturingAlertsService();
