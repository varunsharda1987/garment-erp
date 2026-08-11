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
 * Result of tolerance/loss calculation
 */
interface LossSplitResult {
  qtySent: Decimal;
  qtyReceived: Decimal;
  totalLoss: Decimal;
  tolerancePercent: Decimal;
  allowedLoss: Decimal;
  qtyNormalLoss: Decimal;
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
   * Calculate normal vs abnormal loss when material returns
   * Phase 6: Tolerance/loss split logic
   *
   * Rule: Loss within tolerance = normal (no debit), beyond = abnormal (debit note)
   *
   * @param qtySent - Meters sent to processor
   * @param qtyReceived - Meters received back
   * @param tolerancePercent - Allowed shrinkage/loss percentage (can be 0 for strict)
   * @param ratePerMeter - Rate per meter (for debit note calculation)
   */
  calculateLossSplit(
    qtySent: Decimal | number,
    qtyReceived: Decimal | number,
    tolerancePercent: Decimal | number,
    ratePerMeter?: Decimal | number
  ): LossSplitResult {
    const sent = toCurrency(qtySent);
    const received = toCurrency(qtyReceived);
    const tolerance = toCurrency(tolerancePercent);
    const rate = toCurrency(ratePerMeter);

    // Guard: qtySent must be positive for meaningful calculation
    if (sent.lte(0)) {
      throw new JobWorkOrderError(
        JWO_ERROR_CODES.DIVIDE_BY_ZERO,
        'qtySent must be greater than 0 for loss calculation'
      );
    }

    const totalLoss = Decimal.max(new Decimal(0), sent.minus(received));
    const allowedLoss = percentOf(sent, tolerance);
    const qtyNormalLoss = Decimal.min(totalLoss, allowedLoss);
    const qtyAbnormalLoss = Decimal.max(new Decimal(0), totalLoss.minus(allowedLoss));
    const isOverTolerance = qtyAbnormalLoss.gt(0);

    let debitNoteAmount: Decimal | null = null;
    if (isOverTolerance && rate.gt(0)) {
      debitNoteAmount = roundToCent(multiplyCurrency(qtyAbnormalLoss, rate));
    }

    return {
      qtySent: sent,
      qtyReceived: received,
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

    const lossSplit = this.calculateLossSplit(qtySent, received, tolerancePercent, ratePerMeter);

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

    const qtyMeters = toCurrency(jwo.qtySentMeters);
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
