/**
 * A job work order's LINES — one per output the processor sends back (a finished fabric or dyed lace at one
 * asked width), each with its share of the greige and the fabric expected (2026-09-30). MRP had bundled a Red,
 * a Black and a Teal order onto DJ-EBEW-002-001 and named the Red fabric for all 22,776 m.
 *
 * The lines are the home. The header MIRRORS them so its many totals-only readers keep working: quantities
 * are the lines' sums, and each output field (style, colour, fabric, lace, width) is the value EVERY line
 * shares, else NULL — never line 1's. Every job has at least one line, and this file is the only writer of
 * the lines and of the mirrored header fields.
 */

import { Prisma } from '@prisma/client';
import { BusinessError } from '../../errors';
import { addCurrency, divideCurrency, roundToCent, toCurrency, toNumber } from '../../utils/currency';
import { grnLineActualQty, type GrnLineQtyInput } from './grn-line-value.helper';

type Tx = Prisma.TransactionClient;

/** Header fields that mirror the lines — never written anywhere but here */
export const JWO_MIRRORED_FIELDS = [
  'qtySentMeters',
  'qtyBillable',
  'styleId',
  'colorMasterId',
  'colorName',
  'finishedFabricId',
  'finishedLaceId',
  'sentWidthInches',
  'expectedShrinkage',
] as const;
type MirroredField = (typeof JWO_MIRRORED_FIELDS)[number];

type Num = number | string | Prisma.Decimal | Prisma.DecimalJsLike | null | undefined;

/** A job's own (non-mirrored) fields, as a creator passes them */
export type JwoHeaderInput = Omit<Prisma.job_work_ordersUncheckedCreateInput, MirroredField>;

/** One line's output and quantities, as a creator states them */
export interface JwoLineShape {
  styleId?: string | null;
  colorMasterId?: string | null;
  colorName?: string | null;
  finishedFabricId?: string | null;
  finishedLaceId?: string | null;
  /** The FINISHED width asked of the processor */
  sentWidthInches?: Num;
  expectedShrinkage?: Num;
  /** This line's share of the greige sent */
  qtySent: Num;
  /** Fabric (or lace) expected back; null = piece work / not known */
  qtyExpected?: Num;
}

export interface JwoLineInput extends JwoLineShape {
  /** The requirements this output serves, each with its fabric-basis allocation */
  requirementLinks?: Array<{ requirementId: string; allocatedQuantity: number }>;
}

export interface JwoHeaderMirror {
  qtySentMeters: number;
  qtyBillable: number | null;
  styleId: string | null;
  colorMasterId: string | null;
  colorName: string | null;
  finishedFabricId: string | null;
  finishedLaceId: string | null;
  sentWidthInches: number | null;
  expectedShrinkage: number | null;
}

const num = (v: Num): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : null;
};

/** The value every line shares, else null */
function shared<T>(values: Array<T | null>, same: (a: T, b: T) => boolean): T | null {
  const [first, ...rest] = values;
  if (first == null) return null;
  return rest.every((v) => v != null && same(first, v)) ? first : null;
}

/** The shrinkage two quantities imply: 1 − expected ÷ sent, in percent (null when either is missing) */
export function impliedShrinkagePercent(qtySent: Num, qtyExpected: Num): number | null {
  const sent = num(qtySent);
  const expected = num(qtyExpected);
  if (sent == null || expected == null || sent <= 0) return null;
  return toNumber(roundToCent(toCurrency(1).minus(divideCurrency(expected, sent)).times(100)));
}

/**
 * The header a set of lines implies. Shrinkage is the lines' shared figure, else the one the totals imply
 * (1 − expected ÷ sent) — the loss split and the processor statement read the header's, so it must be a
 * number whenever the totals are.
 */
export function headerFromLines(lines: readonly JwoLineShape[]): JwoHeaderMirror {
  if (lines.length === 0) throw new BusinessError('A job work order needs at least one line');
  const sent = lines.map((l) => num(l.qtySent) ?? 0);
  const expected = lines.map((l) => num(l.qtyExpected));
  const qtySentMeters = toNumber(roundToCent(addCurrency(...sent)));
  const qtyBillable = expected.every((e) => e != null)
    ? toNumber(roundToCent(addCurrency(...(expected as number[]))))
    : null;

  const text = (pick: (l: JwoLineShape) => string | null | undefined) =>
    shared(
      lines.map((l) => pick(l)?.trim() || null),
      (a, b) => a === b
    );
  const number = (pick: (l: JwoLineShape) => Num) =>
    shared(
      lines.map((l) => num(pick(l))),
      (a, b) => Math.abs(a - b) < 0.005
    );

  const sharedShrinkage = number((l) => l.expectedShrinkage);
  const impliedShrinkage = impliedShrinkagePercent(qtySentMeters, qtyBillable);

  return {
    qtySentMeters,
    qtyBillable,
    styleId: text((l) => l.styleId),
    colorMasterId: text((l) => l.colorMasterId),
    colorName: text((l) => l.colorName),
    finishedFabricId: text((l) => l.finishedFabricId),
    finishedLaceId: text((l) => l.finishedLaceId),
    sentWidthInches: number((l) => l.sentWidthInches),
    expectedShrinkage: sharedShrinkage ?? impliedShrinkage,
  };
}

/** Piece work and lace jobs bring back exactly one thing */
function assertLineCount(job: { uom?: string | null; fabricType?: string | null }, count: number): void {
  if (count === 0) throw new BusinessError('A job work order needs at least one line');
  if (count === 1) return;
  if ((job.uom ?? 'MTR') !== 'MTR') {
    throw new BusinessError(
      `A job work order billed in ${job.uom} brings back one thing — it cannot have ${count} lines`
    );
  }
  if (job.fabricType === 'LACE') {
    throw new BusinessError(`A lace job work order brings back one dyed lace — it cannot have ${count} lines`);
  }
}

const lineColumns = (line: JwoLineShape) => ({
  styleId: line.styleId?.trim() || null,
  colorMasterId: line.colorMasterId?.trim() || null,
  colorName: line.colorName?.trim() || null,
  finishedFabricId: line.finishedFabricId?.trim() || null,
  finishedLaceId: line.finishedLaceId?.trim() || null,
  sentWidthInches: num(line.sentWidthInches),
  expectedShrinkage: num(line.expectedShrinkage),
  qtySent: num(line.qtySent) ?? 0,
  qtyExpected: num(line.qtyExpected),
});

/** Split a one-output job's full data into its own fields and its one line */
export function splitOneLine(data: Prisma.job_work_ordersUncheckedCreateInput): {
  header: JwoHeaderInput;
  line: JwoLineShape;
} {
  const {
    qtySentMeters,
    qtyBillable,
    styleId,
    colorMasterId,
    colorName,
    finishedFabricId,
    finishedLaceId,
    sentWidthInches,
    expectedShrinkage,
    ...header
  } = data;
  return {
    header,
    line: {
      qtySent: qtySentMeters,
      qtyExpected: qtyBillable,
      styleId,
      colorMasterId,
      colorName,
      finishedFabricId,
      finishedLaceId,
      sentWidthInches,
      expectedShrinkage,
    },
  };
}

/** A job that brings back one output — the data a creator always built, with its output as line 1 */
export function createOneLineJobWorkOrder(
  tx: Tx,
  data: Prisma.job_work_ordersUncheckedCreateInput,
  requirementLinks?: JwoLineInput['requirementLinks']
) {
  const { header, line } = splitOneLine(data);
  return createJobWorkOrderWithLines(tx, header, [{ ...line, requirementLinks }]);
}

/** The only way a job work order is created: the job, its lines and their requirement links, together. */
export async function createJobWorkOrderWithLines(tx: Tx, data: JwoHeaderInput, lines: readonly JwoLineInput[]) {
  assertLineCount(data, lines.length);
  const job = await tx.job_work_orders.create({ data: { ...data, ...headerFromLines(lines) } });
  for (const [index, line] of lines.entries()) {
    const created = await tx.job_work_order_lines.create({
      data: { jobWorkOrderId: job.id, lineNo: index + 1, ...lineColumns(line) },
    });
    for (const link of line.requirementLinks ?? []) {
      await tx.requirement_jwo_links.create({
        data: {
          requirementId: link.requirementId,
          jobWorkOrderId: job.id,
          lineId: created.id,
          allocatedQuantity: link.allocatedQuantity,
        },
      });
    }
  }
  return job;
}

/** A job's lines in order */
export function jobLines(tx: Tx, jobWorkOrderId: string) {
  return tx.job_work_order_lines.findMany({ where: { jobWorkOrderId }, orderBy: { lineNo: 'asc' } });
}

/**
 * The job's one line, for the paths that handle one output only (issue stamps, the one-line receipt, the
 * legacy edit). Refused on a job with several lines, naming what to do.
 */
export async function theOnlyLine(tx: Tx, jobWorkOrderId: string, action: string) {
  const lines = await jobLines(tx, jobWorkOrderId);
  if (lines.length === 1) return lines[0];
  if (lines.length === 0) throw new BusinessError(`Job work order ${jobWorkOrderId} has no lines`);
  const job = await tx.job_work_orders.findUnique({ where: { id: jobWorkOrderId }, select: { jobWorkNumber: true } });
  throw new BusinessError(
    `${job?.jobWorkNumber ?? 'This job'} brings back ${lines.length} different fabrics (one line each) — ${action} ` +
      `works on a job with one line only for now.`,
    { reason: 'JWO_SEVERAL_LINES', lines: lines.length }
  );
}

/** Rewrite the header's mirrored fields from the lines. A CLOSED job keeps its settled billable quantity. */
export async function syncJwoHeaderFromLines(tx: Tx, jobWorkOrderId: string) {
  const [job, lines] = await Promise.all([
    tx.job_work_orders.findUniqueOrThrow({ where: { id: jobWorkOrderId }, select: { jwoStatus: true } }),
    jobLines(tx, jobWorkOrderId),
  ]);
  const mirror = headerFromLines(lines);
  const { qtyBillable, ...rest } = mirror;
  return tx.job_work_orders.update({
    where: { id: jobWorkOrderId },
    data: job.jwoStatus === 'CLOSED' ? rest : mirror,
  });
}

/** Name the finished fabric a line expects (minted at issue or receipt), then mirror it to the header */
export async function stampLineFinishedFabric(tx: Tx, lineId: string, finishedFabricId: string) {
  const line = await tx.job_work_order_lines.update({ where: { id: lineId }, data: { finishedFabricId } });
  await syncJwoHeaderFromLines(tx, line.jobWorkOrderId);
  return line;
}

/** Change the one line of a one-line job (the legacy dyeing/printing edit), then mirror it to the header */
export async function updateTheOnlyLine(tx: Tx, jobWorkOrderId: string, patch: Partial<JwoLineShape>, action: string) {
  const line = await theOnlyLine(tx, jobWorkOrderId, action);
  const next: JwoLineShape = { ...line, ...patch };
  const columns = lineColumns(next);
  const data = Object.fromEntries(
    Object.keys(patch).map((key) => [key, columns[key as keyof typeof columns]])
  ) as Prisma.job_work_order_linesUpdateInput;
  await tx.job_work_order_lines.update({ where: { id: line.id }, data });
  return syncJwoHeaderFromLines(tx, jobWorkOrderId);
}

/** The select that feeds lineReceivedQty: a line's ACCEPTED receipt rows */
export const LINE_RECEIPTS_SELECT = {
  where: { goods_receiving_notes: { status: 'ACCEPTED' as const } },
  select: { acceptedQuantity: true, foldLengthCm: true },
};

/** What has come back on a line — never stored: its ACCEPTED receipt rows at their actual (fold-adjusted) metres */
export function lineReceivedQty(receiptRows: readonly GrnLineQtyInput[]): number {
  return toNumber(roundToCent(addCurrency(0, ...receiptRows.map((row) => grnLineActualQty(row)))));
}

/** Tie a requirement to the line that brings back its fabric */
export function linkRequirementToLine(
  tx: Tx,
  link: { jobWorkOrderId: string; lineId: string; requirementId: string; allocatedQuantity: number }
) {
  return tx.requirement_jwo_links.create({ data: link });
}
