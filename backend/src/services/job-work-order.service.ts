/**
 * Job Work Order Service
 * Phase 6 of Job Work Consolidation
 *
 * Unified service for all job work order operations:
 * - Calculate tolerance/loss split (normal vs abnormal)
 * - Compute GST amounts
 * - Set statutory due date
 * - Manage approval workflow
 *
 * Rules enforced:
 * - R1: GST rate must be resolved before document generation (NULL = blocked)
 * - R2: statutoryDueDate is IMMUTABLE after ISSUED
 */

import { Prisma, job_work_orders } from '@prisma/client';
import prisma from '../config/database';
import {
  toCurrency,
  multiplyCurrency,
  divideCurrency,
  percentOf,
  roundToCent,
  isZero,
  applyShrinkageLoss,
  Decimal,
} from '../utils/currency';

/**
 * Error codes for R1-R7 rule violations (machine-readable 422s)
 */
export const JWO_ERROR_CODES = {
  GST_RATE_UNRESOLVED: 'GST_RATE_UNRESOLVED',
  STATUTORY_DATE_IMMUTABLE: 'STATUTORY_DATE_IMMUTABLE',
  DIVIDE_BY_ZERO: 'DIVIDE_BY_ZERO',
} as const;

export class JobWorkOrderError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'JobWorkOrderError';
  }
}

/**
 * Input for the tolerance/loss calculation.
 * Loss accountability is measured against the CONTRACTED EXPECTED OUTPUT
 * (qtyBillable = sent × (1 − rate-card shrinkage)), never against the greige sent —
 * expected process shrinkage is not "loss", it is the contract.
 */
export interface LossSplitInput {
  /** Greige meters issued to the processor. */
  qtySent: Decimal | number;
  /** Finished goods received back (fabric basis). */
  qtyReceived: Decimal | number;
  /** Contracted output (jwo.qtyBillable). Null → derived from expectedShrinkagePercent, else = qtySent. */
  qtyExpected?: Decimal | number | null;
  /** Rate-card shrinkage %, used only when qtyExpected is null (legacy rows). */
  expectedShrinkagePercent?: Decimal | number | null;
  /** Allowed EXTRA shortfall beyond expected output (0 = strict). */
  tolerancePercent: Decimal | number;
  /** For the debit-note amount on abnormal loss. */
  ratePerMeter?: Decimal | number;
}

/**
 * Result of tolerance/loss calculation
 */
export interface LossSplitResult {
  qtySent: Decimal;
  qtyReceived: Decimal;
  /** Effective contracted output the split was measured against. */
  qtyExpected: Decimal;
  /** sent − expected: the shrinkage the contract already accounts for (never "loss"). */
  expectedShrinkageLoss: Decimal;
  /** max(0, expected − received): deficit vs the contract. */
  shortfall: Decimal;
  /** max(0, sent − received): physical loss (statistic; meaning unchanged). */
  totalLoss: Decimal;
  tolerancePercent: Decimal;
  /** percentOf(expected, tolerance): allowed extra shortfall beyond expected output. */
  allowedLoss: Decimal;
  /** ALL commercially accepted loss = expected shrinkage incurred + tolerance consumed (= totalLoss − abnormal). */
  qtyNormalLoss: Decimal;
  /** Shortfall beyond (expected − allowance) → debit-note gate at close. */
  qtyAbnormalLoss: Decimal;
  isOverTolerance: boolean;
  debitNoteRequired: boolean;
  debitNoteAmount: Decimal | null;
}

/**
 * GST calculation result
 */
interface GSTCalculationResult {
  subtotal: Decimal;
  gstRate: Decimal;
  cgstAmount: Decimal;
  sgstAmount: Decimal;
  igstAmount: Decimal;
  totalTaxAmount: Decimal;
  totalAmount: Decimal;
  isInterstate: boolean;
}

class JobWorkOrderService {
  /**
   * Calculate normal vs abnormal loss when material returns.
   *
   * Basis fix (2026-08-18): loss accountability is measured against the CONTRACTED
   * EXPECTED OUTPUT (qtyBillable / shrinkage-derived), NOT the greige sent. The old
   * formula charged the processor for the expected shrinkage itself: returning exactly
   * the contracted 1686.59 m against 1833.25 m greige @8% recorded 91.66 m "abnormal
   * loss" and demanded a ₹916.63 debit note — for meeting the contract.
   *
   * Tolerance allowance basis = EXPECTED OUTPUT (percentOf(expected, tol)) — a
   * deliberate business choice: tolerance covers extra shortfall on the deliverable;
   * sent-basis would credit the shrinkage portion twice. When expected == sent
   * (PCS jobs, legacy rows without shrinkage) this degrades to the old formula exactly.
   *
   * Identity: when received ≤ sent, qtyNormalLoss + qtyAbnormalLoss == totalLoss, and
   * qtyNormalLoss = expectedShrinkageLoss + min(shortfall, allowedLoss).
   */
  calculateLossSplit(input: LossSplitInput): LossSplitResult {
    const sent = toCurrency(input.qtySent);
    const received = toCurrency(input.qtyReceived);
    const tolerance = toCurrency(input.tolerancePercent);
    const rate = toCurrency(input.ratePerMeter);

    // Guard: qtySent must be positive for meaningful calculation
    if (sent.lte(0)) {
      throw new JobWorkOrderError(
        JWO_ERROR_CODES.DIVIDE_BY_ZERO,
        'qtySent must be greater than 0 for loss calculation'
      );
    }

    // Effective contracted output. Clamped to sent: after close, qtyBillable is settled
    // to the received qty which can legitimately exceed sent (stenter growth) — the
    // contract can never expect more back than was issued.
    const shrink = input.expectedShrinkagePercent != null ? toCurrency(input.expectedShrinkagePercent) : new Decimal(0);
    const rawExpected =
      input.qtyExpected != null
        ? toCurrency(input.qtyExpected)
        : shrink.gt(0) && shrink.lt(100)
          ? applyShrinkageLoss(sent, shrink)
          : sent;
    const expected = Decimal.min(rawExpected, sent);

    const expectedShrinkageLoss = sent.minus(expected); // >= 0 by the clamp
    const totalLoss = Decimal.max(new Decimal(0), sent.minus(received)); // physical
    const shortfall = Decimal.max(new Decimal(0), expected.minus(received)); // vs contract
    const allowedLoss = percentOf(expected, tolerance); // allowance on the deliverable
    const qtyAbnormalLoss = Decimal.max(new Decimal(0), shortfall.minus(allowedLoss));
    const qtyNormalLoss = Decimal.max(new Decimal(0), totalLoss.minus(qtyAbnormalLoss));
    const isOverTolerance = qtyAbnormalLoss.gt(0);

    let debitNoteAmount: Decimal | null = null;
    if (isOverTolerance && rate.gt(0)) {
      debitNoteAmount = roundToCent(multiplyCurrency(qtyAbnormalLoss, rate));
    }

    return {
      qtySent: sent,
      qtyReceived: received,
      qtyExpected: expected,
      expectedShrinkageLoss,
      shortfall,
      totalLoss,
      tolerancePercent: tolerance,
      allowedLoss,
      qtyNormalLoss,
      qtyAbnormalLoss,
      isOverTolerance,
      debitNoteRequired: isOverTolerance,
      debitNoteAmount,
    };
  }

  /**
   * Calculate GST amounts for a job work order
   * Derives interstate from processor state vs company state
   *
   * @throws JobWorkOrderError with GST_RATE_UNRESOLVED if gstRate is null/0 (R1)
   */
  async calculateGST(
    processorId: string,
    subtotal: Decimal | number,
    gstRate: Decimal | number | null
  ): Promise<GSTCalculationResult> {
    const sub = toCurrency(subtotal);
    const rate = toCurrency(gstRate);

    // R1: Block if GST rate is unresolved (null or explicitly 0 without TBD flag)
    if (gstRate === null) {
      throw new JobWorkOrderError(
        JWO_ERROR_CODES.GST_RATE_UNRESOLVED,
        'GST rate is unresolved (NULL). Cannot compute commercial totals until CA confirms rate.'
      );
    }

    // Get company profile for state comparison
    const company = await prisma.company_profile.findFirst({
      where: { isActive: true },
      select: { stateCode: true },
    });

    // Get processor's primary GST state
    const processor = await prisma.suppliers.findUnique({
      where: { id: processorId },
      select: {
        gst_numbers: {
          where: { isPrimary: true },
          select: { gstNumber: true },
        },
      },
    });

    // Extract state code from GSTIN (first 2 digits)
    const processorGstin = processor?.gst_numbers[0]?.gstNumber || '';
    const processorStateCode = processorGstin.substring(0, 2);
    const companyStateCode = company?.stateCode || '';

    const isInterstate = processorStateCode !== companyStateCode && processorStateCode !== '';

    const totalTaxAmount = percentOf(sub, rate);
    let cgstAmount = new Decimal(0);
    let sgstAmount = new Decimal(0);
    let igstAmount = new Decimal(0);

    if (isInterstate) {
      igstAmount = totalTaxAmount;
    } else {
      cgstAmount = divideCurrency(totalTaxAmount, 2);
      sgstAmount = divideCurrency(totalTaxAmount, 2);
    }

    return {
      subtotal: sub,
      gstRate: rate,
      cgstAmount: roundToCent(cgstAmount),
      sgstAmount: roundToCent(sgstAmount),
      igstAmount: roundToCent(igstAmount),
      totalTaxAmount: roundToCent(totalTaxAmount),
      totalAmount: roundToCent(sub.plus(totalTaxAmount)),
      isInterstate,
    };
  }

  /**
   * Set statutory due date (1 year from sent date)
   * Rule: IMMUTABLE after ISSUED status
   */
  calculateStatutoryDueDate(sentDate: Date): Date {
    const dueDate = new Date(sentDate);
    dueDate.setFullYear(dueDate.getFullYear() + 1);
    return dueDate;
  }

  /**
   * Calculate actual shrinkage percentage safely
   * Guards against divide-by-zero when qtySent is 0
   */
  calculateShrinkagePercent(qtySent: Decimal, qtyReceived: Decimal): Decimal {
    if (qtySent.lte(0)) {
      return new Decimal(0);
    }
    const loss = qtySent.minus(qtyReceived);
    return roundToCent(divideCurrency(loss, qtySent).times(100));
  }

  /**
   * Update job work order with loss split after receiving
   * Phase 6: Apply tolerance/loss split to JWO record
   */
  async applyLossSplit(jwoId: string, qtyReceived: number, tx?: Prisma.TransactionClient): Promise<job_work_orders> {
    const client = tx || prisma;

    const jwo = await client.job_work_orders.findUnique({
      where: { id: jwoId },
      include: {
        processTypeMaster: {
          select: { tolerancePercent: true },
        },
      },
    });

    if (!jwo) {
      throw new Error(`Job work order ${jwoId} not found`);
    }

    const qtySent = toCurrency(jwo.qtySentMeters);

    // Guard: qtySent must be positive
    if (qtySent.lte(0)) {
      throw new JobWorkOrderError(
        JWO_ERROR_CODES.DIVIDE_BY_ZERO,
        `Job work order ${jwo.jobWorkNumber} has qtySent <= 0, cannot calculate loss split`
      );
    }

    // Tolerance: use JWO override, then process type default, then 0 (strict, all loss is abnormal)
    // NOTE: We do NOT default to 3% — a missing tolerance means strict (0%)
    const tolerancePercent =
      jwo.tolerancePercent !== null
        ? toCurrency(jwo.tolerancePercent)
        : jwo.processTypeMaster?.tolerancePercent !== null
          ? toCurrency(jwo.processTypeMaster?.tolerancePercent)
          : new Decimal(0);

    const ratePerMeter = toCurrency(jwo.agreedRatePerMeter);
    const received = toCurrency(qtyReceived);

    // Ordering contract: runs at RECEIVE, before close's settle-on-actuals overwrites
    // qtyBillable with the received qty. Never re-run after CLOSED — the contracted
    // expected qty is gone from the row by then (deliberate settlement behaviour).
    const lossSplit = this.calculateLossSplit({
      qtySent,
      qtyReceived: received,
      qtyExpected: jwo.qtyBillable,
      expectedShrinkagePercent: jwo.expectedShrinkage,
      tolerancePercent,
      ratePerMeter,
    });

    const actualShrinkage = this.calculateShrinkagePercent(qtySent, received);

    const updated = await client.job_work_orders.update({
      where: { id: jwoId },
      data: {
        qtyReceivedMeters: received.toNumber(),
        qtyNormalLoss: lossSplit.qtyNormalLoss.toNumber(),
        qtyAbnormalLoss: lossSplit.qtyAbnormalLoss.toNumber(),
        tolerancePercent: tolerancePercent.toNumber(),
        actualShrinkage: actualShrinkage.toNumber(),
      },
    });

    return updated;
  }

  /**
   * Compute commercial totals for a JWO (subtotal, GST, total)
   * Call this when creating or updating a JWO
   *
   * @throws JobWorkOrderError with GST_RATE_UNRESOLVED if GST rate is NULL (R1)
   */
  async computeCommercialTotals(jwoId: string, tx?: Prisma.TransactionClient): Promise<job_work_orders> {
    const client = tx || prisma;

    const jwo = await client.job_work_orders.findUnique({
      where: { id: jwoId },
      include: {
        processTypeMaster: {
          select: { sacCode: true, gstRate: true },
        },
      },
    });

    if (!jwo) {
      throw new Error(`Job work order ${jwoId} not found`);
    }

    // Billing basis: the processor charges for the finished goods returned (qtyBillable),
    // not the greige issued (qtySentMeters). NULL qtyBillable = legacy/piece-based jobs.
    const qtyMeters = toCurrency(jwo.qtyBillable ?? jwo.qtySentMeters);
    const ratePerMeter = toCurrency(jwo.agreedRatePerMeter);
    const subtotal = multiplyCurrency(qtyMeters, ratePerMeter);

    // R1: Do NOT fall back to a default rate — throw if unresolved
    const gstRate = jwo.gstRate ?? jwo.processTypeMaster?.gstRate ?? null;

    if (gstRate === null) {
      throw new JobWorkOrderError(
        JWO_ERROR_CODES.GST_RATE_UNRESOLVED,
        `Cannot compute commercial totals for JWO ${jwo.jobWorkNumber}: GST rate is unresolved. ` +
          `Process type ${jwo.processType} requires CA confirmation before document generation.`
      );
    }

    const gstCalc = await this.calculateGST(jwo.processorId, subtotal, gstRate);

    const updated = await client.job_work_orders.update({
      where: { id: jwoId },
      data: {
        subtotal: gstCalc.subtotal.toNumber(),
        gstRate: gstCalc.gstRate.toNumber(),
        cgstAmount: gstCalc.cgstAmount.toNumber(),
        sgstAmount: gstCalc.sgstAmount.toNumber(),
        igstAmount: gstCalc.igstAmount.toNumber(),
        totalTaxAmount: gstCalc.totalTaxAmount.toNumber(),
        totalAmount: gstCalc.totalAmount.toNumber(),
        isInterstate: gstCalc.isInterstate,
      },
    });

    return updated;
  }

  /**
   * Set statutory due date when JWO moves to ISSUED status
   * Rule R2: Must be called when sentDate is set, immutable afterward
   *
   * @throws JobWorkOrderError with STATUTORY_DATE_IMMUTABLE if already set
   */
  async setStatutoryDueDate(jwoId: string, sentDate: Date, tx?: Prisma.TransactionClient): Promise<job_work_orders> {
    const client = tx || prisma;

    const jwo = await client.job_work_orders.findUnique({
      where: { id: jwoId },
    });

    if (!jwo) {
      throw new Error(`Job work order ${jwoId} not found`);
    }

    // R2: statutoryDueDate is IMMUTABLE after set
    if (jwo.statutoryDueDate) {
      throw new JobWorkOrderError(
        JWO_ERROR_CODES.STATUTORY_DATE_IMMUTABLE,
        `Statutory due date already set for JWO ${jwo.jobWorkNumber} (${jwo.statutoryDueDate.toISOString()}). ` +
          `It is immutable after issue per Section 143 compliance.`
      );
    }

    const dueDate = this.calculateStatutoryDueDate(sentDate);

    const updated = await client.job_work_orders.update({
      where: { id: jwoId },
      data: {
        sentDate,
        statutoryDueDate: dueDate,
      },
    });

    return updated;
  }

  /**
   * Approve a job work order
   */
  async approve(jwoId: string, approverId: string, tx?: Prisma.TransactionClient): Promise<job_work_orders> {
    const client = tx || prisma;

    const updated = await client.job_work_orders.update({
      where: { id: jwoId },
      data: {
        approvedById: approverId,
        approvedAt: new Date(),
      },
    });

    return updated;
  }

  /**
   * Get JWOs that are over tolerance (for debit note processing)
   */
  async getOverToleranceOrders(): Promise<job_work_orders[]> {
    return prisma.job_work_orders.findMany({
      where: {
        qtyAbnormalLoss: { gt: 0 },
        isActive: true,
      },
      include: {
        processor: {
          select: { id: true, name: true, code: true },
        },
        processTypeMaster: {
          select: { name: true, tolerancePercent: true },
        },
      },
      orderBy: { receivedDate: 'desc' },
    });
  }
}

export const jobWorkOrderService = new JobWorkOrderService();
export default jobWorkOrderService;
