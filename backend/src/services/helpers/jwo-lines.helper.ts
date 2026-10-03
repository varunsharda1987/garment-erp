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
  /** How the line closed — a RETURNED (came back undyed) or DROPPED (never sent) line is out of the job's work */
  closedHow?: string | null;
  /** Greige of this line that came back undyed */
  qtyReturned?: Num;
}

/** A line the job no longer works on: its greige came back undyed, or it was dropped before it was sent */
export const isLineOut = (line: { closedHow?: string | null }) =>
  line.closedHow === 'RETURNED' || line.closedHow === 'DROPPED';

/**
 * What the job really sent and expects back (2026-10-03): a DROPPED line never went out; a RETURNED line went out
 * but its greige came back undyed — neither counts toward the fabric expected, the bill or the dyer's loss. The
 * loss split, Close short and the receipt's short-close question all read these, never the planned header.
 */
export function effectiveJobTotals(lines: readonly JwoLineShape[]): { sent: number; expected: number | null } {
  const working = lines.filter((l) => l.closedHow !== 'DROPPED');
  const sent = toNumber(
    roundToCent(addCurrency(0, ...working.map((l) => toCurrency(num(l.qtySent) ?? 0).minus(num(l.qtyReturned) ?? 0))))
  );
  const live = lines.filter((l) => !isLineOut(l));
  const expected = live.map((l) => num(l.qtyExpected));
  return {
    sent,
    expected: expected.every((e) => e != null)
      ? toNumber(roundToCent(addCurrency(0, ...(expected as number[]))))
      : null,
  };
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
  // Greige SENT is what physically went out (a dropped line never did; a returned one did — its return is on its
  // own inward challan, which the processor statement and ITC-04 read). The fabric expected back / billed leaves
  // out every line that is out of the job's work.
  const sent = lines.filter((l) => l.closedHow !== 'DROPPED').map((l) => num(l.qtySent) ?? 0);
  const live = lines.filter((l) => !isLineOut(l));
  const expected = live.map((l) => num(l.qtyExpected));
  const qtySentMeters = toNumber(roundToCent(addCurrency(0, ...sent)));
  const qtyBillable = expected.every((e) => e != null)
    ? toNumber(roundToCent(addCurrency(0, ...(expected as number[]))))
    : null;
  // Style, colour, fabric and width: what the lines still worked on share (all of them when every line is out)
  const named = live.length > 0 ? live : lines;

  const text = (pick: (l: JwoLineShape) => string | null | undefined) =>
    shared(
      named.map((l) => pick(l)?.trim() || null),
      (a, b) => a === b
    );
  const number = (pick: (l: JwoLineShape) => Num) =>
    shared(
      named.map((l) => num(pick(l))),
      (a, b) => Math.abs(a - b) < 0.005
    );

  const sharedShrinkage = number((l) => l.expectedShrinkage);
  const effective = effectiveJobTotals(lines);
  const impliedShrinkage = impliedShrinkagePercent(effective.sent, effective.expected);

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

/** A job's lines in brief — what a list row needs to name each fabric when a job brings back several */
export const JWO_LINES_BRIEF = {
  orderBy: { lineNo: 'asc' as const },
  select: {
    id: true,
    lineNo: true,
    colorName: true,
    sentWidthInches: true,
    closedAt: true,
    closedHow: true,
    style: { select: { id: true, styleCode: true, buyerStyleRef: true, styleName: true } },
    colorMaster: { select: { colorName: true, hexCode: true } },
    finishedFabric: { select: { id: true, fabricCode: true, fabricName: true, colorName: true } },
    finishedLace: { select: { id: true, laceCode: true, laceName: true, color: true } },
  },
};

/** The select that feeds lineReceivedQty: a line's ACCEPTED receipt rows */
export const LINE_RECEIPTS_SELECT = {
  where: { goods_receiving_notes: { status: 'ACCEPTED' as const } },
  select: { acceptedQuantity: true, foldLengthCm: true },
};

/** What has come back on a line — never stored: its ACCEPTED receipt rows at their actual (fold-adjusted) metres */
export function lineReceivedQty(receiptRows: readonly GrnLineQtyInput[]): number {
  return toNumber(roundToCent(addCurrency(0, ...receiptRows.map((row) => grnLineActualQty(row)))));
}

type JwoLineRow = Awaited<ReturnType<typeof jobLines>>[number];

/** How a line is named to the person receiving it: "ESSKY092LS Red" (line 2 when it has neither) */
export async function lineLabel(tx: Tx, line: Pick<JwoLineRow, 'lineNo' | 'styleId' | 'colorName'>): Promise<string> {
  const style = line.styleId
    ? await tx.styles.findUnique({ where: { id: line.styleId }, select: { styleCode: true, buyerStyleRef: true } })
    : null;
  const label = [style ? style.buyerStyleRef?.trim() || style.styleCode : null, line.colorName?.trim() || null]
    .filter(Boolean)
    .join(' ');
  return label || `line ${line.lineNo}`;
}

/**
 * The line a receipt brings back (2026-10-02): the one the dialog named, else the job's only line. A job with
 * several lines must be told which — each comes back as its own fabric and credits only its own orders. A closed
 * line takes no more receipts.
 */
export async function pickReceiptLine(
  tx: Tx,
  job: { id: string; jobWorkNumber: string },
  lineId?: string | null
): Promise<{ line: JwoLineRow; lines: JwoLineRow[]; label: string }> {
  const lines = await jobLines(tx, job.id);
  if (lines.length === 0) throw new BusinessError(`${job.jobWorkNumber} has no lines`);
  let line: JwoLineRow | undefined;
  if (lineId) {
    line = lines.find((l) => l.id === lineId);
    if (!line) {
      throw new BusinessError(
        `That colour / order is not on ${job.jobWorkNumber} — close the dialog and open it again.`
      );
    }
  } else if (lines.length === 1) {
    line = lines[0];
  } else {
    throw new BusinessError(
      `${job.jobWorkNumber} brings back ${lines.length} different fabrics — choose which one this receipt is ` +
        `(the colour / order).`,
      { reason: 'JWO_LINE_REQUIRED', lines: lines.length }
    );
  }
  const label = await lineLabel(tx, line);
  if (isLineOut(line)) {
    throw new BusinessError(
      `${label} on ${job.jobWorkNumber} ${line.closedHow === 'RETURNED' ? 'came back unprocessed' : 'was dropped from the job'} — ` +
        `nothing more comes back on it.`,
      { reason: 'JWO_LINE_OUT', lineId: line.id }
    );
  }
  // Greige sent colour by colour: a colour not yet sent has nothing at the processor to come back
  if (line.sentDate == null && lines.some((l) => l.sentDate != null)) {
    throw new BusinessError(
      `${label}'s greige has not been sent to the processor yet on ${job.jobWorkNumber} — send it first.`,
      { reason: 'JWO_LINE_NOT_SENT', lineId: line.id }
    );
  }
  if (line.closedAt) {
    throw new BusinessError(
      `${label} on ${job.jobWorkNumber} is already closed — its final delivery is in. Reverse that receipt to ` +
        `receive more of it.`,
      { reason: 'JWO_LINE_CLOSED', lineId: line.id }
    );
  }
  return { line, lines, label };
}

/** What has come back on a line so far — its ACCEPTED receipt rows (never stored) */
export async function lineReceivedSoFar(tx: Tx, lineId: string): Promise<number> {
  const rows = await tx.grn_items.findMany({
    where: { jobWorkOrderLineId: lineId, ...LINE_RECEIPTS_SELECT.where },
    select: LINE_RECEIPTS_SELECT.select,
  });
  return lineReceivedQty(rows);
}

/**
 * Close a line: its final delivery is in (FINAL, by that receipt row) or nothing more is coming (SHORT, Close
 * short). Returns whether every line of the job is now closed — the job closes only then.
 */
export async function closeLine(
  tx: Tx,
  line: { id: string; jobWorkOrderId: string },
  how: 'FINAL' | 'SHORT',
  closedAt: Date,
  closingGrnItemId: string | null
): Promise<{ jobClosed: boolean }> {
  await tx.job_work_order_lines.update({
    where: { id: line.id },
    data: { closedAt, closedHow: how, closingGrnItemId },
  });
  const open = await tx.job_work_order_lines.count({ where: { jobWorkOrderId: line.jobWorkOrderId, closedAt: null } });
  return { jobClosed: open === 0 };
}

/** Close every open line of a job short (Close short — nothing more is coming on any colour) */
export async function closeOpenLinesShort(tx: Tx, jobWorkOrderId: string, closedAt: Date): Promise<number> {
  const { count } = await tx.job_work_order_lines.updateMany({
    where: { jobWorkOrderId, closedAt: null },
    data: { closedAt, closedHow: 'SHORT', closingGrnItemId: null },
  });
  return count;
}

/**
 * A receipt is reversed: the line its row closed is open again, and so is a line closed SHORT that it was part
 * of (the short close was confirmed on a total that no longer holds). A line a LATER receipt closed stays closed.
 * Returns whether every line of the job is still closed afterwards (the job stays finished only then).
 */
export async function reopenLinesClosedBy(
  tx: Tx,
  jobWorkOrderId: string,
  receiptRows: ReadonlyArray<{ id: string; jobWorkOrderLineId?: string | null }>
): Promise<{ reopened: number; allClosed: boolean }> {
  const itemIds = receiptRows.map((r) => r.id);
  const lineIds = receiptRows.map((r) => r.jobWorkOrderLineId).filter((id): id is string => !!id);
  const { count } = itemIds.length
    ? await tx.job_work_order_lines.updateMany({
        where: {
          jobWorkOrderId,
          // A line that came back undyed or was dropped is never reopened by a receipt's reversal
          OR: [{ closingGrnItemId: { in: itemIds } }, { id: { in: lineIds }, closedHow: 'SHORT' }],
          closedHow: { notIn: ['RETURNED', 'DROPPED'] },
        },
        data: { closedAt: null, closedHow: null, closingGrnItemId: null },
      })
    : { count: 0 };
  const open = await tx.job_work_order_lines.count({ where: { jobWorkOrderId, closedAt: null } });
  return { reopened: count, allClosed: open === 0 };
}

/** Every receipt of the job is gone: every line is open again, as before anything came back */
export async function reopenAllLines(tx: Tx, jobWorkOrderId: string): Promise<void> {
  await tx.job_work_order_lines.updateMany({
    where: { jobWorkOrderId, closedAt: { not: null }, closedHow: { notIn: ['RETURNED', 'DROPPED'] } },
    data: { closedAt: null, closedHow: null, closingGrnItemId: null },
  });
}

/**
 * Take a line out of the job's work (2026-10-03): its greige came back undyed (RETURNED, with the metres) or it was
 * never sent (DROPPED). Its orders go back to "needs processing" — their links on this job are removed and their
 * processing requirements return to PO_REQUIRED, so a new job can be raised — and the header follows. Returns the
 * requirement ids released (and their greige requirements), so the caller can hold returned greige for them again.
 */
export async function takeLineOut(
  tx: Tx,
  line: { id: string; jobWorkOrderId: string },
  how: 'RETURNED' | 'DROPPED',
  closedAt: Date,
  qtyReturned: number | null
): Promise<{ released: string[]; jobClosed: boolean }> {
  await tx.job_work_order_lines.update({
    where: { id: line.id },
    data: { closedAt, closedHow: how, closingGrnItemId: null, qtyReturned: how === 'RETURNED' ? qtyReturned : null },
  });
  const links = await tx.requirement_jwo_links.findMany({
    where: { lineId: line.id },
    select: { id: true, requirementId: true, material_requirements: { select: { linkedRequirementId: true } } },
  });
  const requirementIds = links.map((l) => l.requirementId);
  if (requirementIds.length > 0) {
    await tx.material_requirements.updateMany({
      where: { id: { in: requirementIds }, status: { in: ['PO_GENERATED', 'PO_SENT'] } },
      data: { status: 'PO_REQUIRED' },
    });
    await tx.requirement_jwo_links.deleteMany({ where: { id: { in: links.map((l) => l.id) } } });
  }
  await syncJwoHeaderFromLines(tx, line.jobWorkOrderId);
  const open = await tx.job_work_order_lines.count({ where: { jobWorkOrderId: line.jobWorkOrderId, closedAt: null } });
  const released = [
    ...new Set(links.flatMap((l) => [l.requirementId, l.material_requirements.linkedRequirementId]).filter(Boolean)),
  ] as string[];
  return { released, jobClosed: open === 0 };
}

/**
 * Has this line's greige gone to the processor (2026-10-03, greige sent colour by colour)? Its own send date when it
 * has one; a job sent whole before lines kept theirs (no line has a date) counts every line sent with the job.
 */
export const lineIsSent = (
  line: { sentDate?: Date | null },
  job: { sentDate?: Date | null; jwoStatus?: string | null },
  lines: ReadonlyArray<{ sentDate?: Date | null }>
) => line.sentDate != null || (jobWentOut(job) && lines.every((l) => l.sentDate == null));

/** Statuses of a job whose goods have not left yet */
const NOT_YET_SENT_STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'];

/** The job's goods went out: it has a send date, or its status is past approval (an old path that kept no date) */
const jobWentOut = (job: { sentDate?: Date | null; jwoStatus?: string | null }) =>
  job.sentDate != null ||
  (job.jwoStatus != null && job.jwoStatus !== 'CANCELLED' && !NOT_YET_SENT_STATUSES.includes(job.jwoStatus));

/** The job's greige goes out colour by colour: some line has a send date of its own while another has none */
export const sentColourByColour = (lines: ReadonlyArray<{ sentDate?: Date | null; closedHow?: string | null }>) =>
  lines.some((l) => l.sentDate != null) && lines.some((l) => l.sentDate == null && !isLineOut(l));

/**
 * Claim lines for an issue — the claim IS the mutex: each must still be unsent and open, or the whole issue is
 * refused (a second press, or another user sending the same colour). Returns whether every line was claimed.
 */
export async function claimLinesForIssue(
  tx: Tx,
  jobWorkOrderId: string,
  lineIds: readonly string[],
  sentDate: Date
): Promise<boolean> {
  const { count } = await tx.job_work_order_lines.updateMany({
    where: { id: { in: [...lineIds] }, jobWorkOrderId, sentDate: null, closedAt: null },
    data: { sentDate },
  });
  return count === lineIds.length;
}

/** What an issue sent its lines on: the outward challan (none when drawn where it lay) and their §143 return date */
export async function stampLinesSent(
  tx: Tx,
  lineIds: readonly string[],
  data: { outwardChallanId: string | null; statutoryDueDate: Date }
) {
  await tx.job_work_order_lines.updateMany({ where: { id: { in: [...lineIds] } }, data });
}

/** Tie a requirement to the line that brings back its fabric */
export function linkRequirementToLine(
  tx: Tx,
  link: { jobWorkOrderId: string; lineId: string; requirementId: string; allocatedQuantity: number }
) {
  return tx.requirement_jwo_links.create({ data: link });
}

/**
 * The greige the processor really worked on: the job's greige sent less every line that came back undyed. The loss
 * split, Close short and the receipt's short-close question read this — counting a returned colour's greige would
 * charge the dyer for cloth that is back on our rack. (The fabric expected back is the header's qtyBillable, which
 * already leaves that colour out.)
 */
export async function jobSentForLoss(tx: Tx, jobWorkOrderId: string, headerSent: Num): Promise<number> {
  const returned = await tx.job_work_order_lines.aggregate({
    where: { jobWorkOrderId, closedHow: 'RETURNED' },
    _sum: { qtyReturned: true },
  });
  return toNumber(roundToCent(toCurrency(num(headerSent) ?? 0).minus(num(returned._sum.qtyReturned) ?? 0)));
}
