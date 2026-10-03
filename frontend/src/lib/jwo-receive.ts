/**
 * The Receive page's rules (2026-10-02): one delivery from a processor — the truck's details once, a row per job
 * line (colour / order). Pure, so the page stays thin and the rules are tested on their own. The server is still
 * the authority (caps, short close, widths); these decide what the page shows and sends.
 */
import { foldActual } from '@/lib/fold-length';
import { qtyExceeds } from '@/lib/quantity';
import { sumDetailRows, type ReceiptDetailRow, type ReceiptEntryMode } from '@/components/job-work/ReceiptDetailRows';
import type { JobWorkOrderLine } from '@/types/jobWorkOrder.types';

export type QualityGrade = '' | 'A' | 'B' | 'Reject';

/** What is typed for one colour of the delivery */
export interface ReceiveRow {
  lineId: string;
  entryMode: ReceiptEntryMode;
  /** Total metres as the processor counted them (Total metres mode) */
  qtyMeters: number;
  thanCount: number;
  /** Than / bale / roll rows (piece modes) */
  pieces: ReceiptDetailRow[];
  foldLengthCm: number;
  widthInches: number;
  /** null = untouched: "final" follows the quantity; a click pins it */
  finalOverride: boolean | null;
  qualityGrade: QualityGrade;
  defectMeters: number;
}

export const emptyReceiveRow = (lineId: string): ReceiveRow => ({
  lineId,
  entryMode: 'TOTAL_METERS',
  qtyMeters: 0,
  thanCount: 0,
  pieces: [],
  foldLengthCm: 0,
  widthInches: 0,
  finalOverride: null,
  qualityGrade: '',
  defectMeters: 0,
});

/** The line figures a row is judged against */
export type ReceiveLine = Pick<JobWorkOrderLine, 'id' | 'lineNo' | 'qtyExpected' | 'receivedQty' | 'closedAt'>;

const piecesValid = (row: ReceiveRow) => row.pieces.length > 0 && row.pieces.every((p) => p.meters > 0);

/** The processor's counted figure: typed, or the sum of the than / bale / roll rows */
export function rowCounted(row: ReceiveRow): number {
  if (row.entryMode === 'TOTAL_METERS') return row.qtyMeters > 0 ? row.qtyMeters : 0;
  return piecesValid(row) ? sumDetailRows(row.pieces) : 0;
}

/** What enters stock: counted × L/100 at a fold under 100 cm, else the counted figure */
export const rowActual = (row: ReceiveRow) => foldActual(rowCounted(row), row.foldLengthCm);

/** A colour that came on this truck — anything typed for its quantity */
export const rowEntered = (row: ReceiveRow) =>
  row.entryMode === 'TOTAL_METERS' ? row.qtyMeters > 0 : row.pieces.length > 0;

const expectedOf = (line: ReceiveLine) => (line.qtyExpected != null ? Number(line.qtyExpected) : null);

/**
 * "Final for this colour" ticks itself once the colour's total reaches its expected quantity less the tolerance.
 * A colour with no expected quantity is never final by itself — the person ticks it (ticking it for them closed
 * such a colour, and with it the job, on its first part delivery).
 */
export function rowIsFinal(row: ReceiveRow, line: ReceiveLine, tolerancePercent: number): boolean {
  if (row.finalOverride != null) return row.finalOverride;
  const expected = expectedOf(line);
  if (expected == null || expected <= 0) return false;
  return Number(line.receivedQty ?? 0) + rowActual(row) >= expected * (1 - tolerancePercent / 100);
}

export interface RowCheck {
  /** Blocks the press */
  problems: string[];
  /** Final for this colour but short of it — fine, said out loud (the loss is judged on the whole job) */
  shortBy: number | null;
}

/** What is wrong with one entered row, in the words the page shows under it */
export function checkRow(
  row: ReceiveRow,
  line: ReceiveLine,
  opts: { isLace: boolean; maxReceivable: number | null; tolerancePercent: number; unit: string }
): RowCheck {
  const problems: string[] = [];
  if (!rowEntered(row)) return { problems, shortBy: null };
  const actual = rowActual(row);
  if (row.entryMode !== 'TOTAL_METERS' && !piecesValid(row)) problems.push('Every piece needs its metres');
  else if (!(actual > 0)) problems.push('Enter the metres that came back');
  if (!opts.isLace && !(row.widthInches > 0)) problems.push('Measure the width');
  const receivedSoFar = Number(line.receivedQty ?? 0);
  if (opts.maxReceivable != null && qtyExceeds(receivedSoFar + actual, opts.maxReceivable)) {
    problems.push(
      `More than this colour can take — at most ${Math.max(opts.maxReceivable - receivedSoFar, 0).toFixed(2)} ` +
        `${opts.unit} more`
    );
  }
  const expected = expectedOf(line);
  const shortBy =
    rowIsFinal(row, line, opts.tolerancePercent) &&
    expected != null &&
    receivedSoFar + actual < expected * (1 - opts.tolerancePercent / 100)
      ? expected - receivedSoFar - actual
      : null;
  return { problems, shortBy };
}

/**
 * The job closes with this delivery when every line still open comes on it, marked final. Only then is the loss
 * judged — on the whole job — and a short total must be confirmed.
 */
export function deliveryClosesJob(lines: ReceiveLine[], rows: ReceiveRow[], tolerancePercent: number): boolean {
  const open = lines.filter((l) => !l.closedAt);
  if (open.length === 0) return false;
  return open.every((line) => {
    const row = rows.find((r) => r.lineId === line.id);
    return !!row && rowEntered(row) && rowIsFinal(row, line, tolerancePercent);
  });
}

/** The delivery's fields typed once per truck */
export interface DeliveryHeader {
  jobWorkOrderId: string;
  receivedDate: string;
  receivedChallan: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceToFollow: boolean;
  toProcessor: boolean;
  warehouseId: string;
  vehicle: string;
  /** Anything worth keeping about this truck — stored on each colour's receipt */
  remarks?: string;
}

/** The POST /grn/jwo/receive-delivery payload — only the colours that came, in the server's shape */
export function deliveryPayload(
  header: DeliveryHeader,
  rows: ReceiveRow[],
  lines: ReceiveLine[],
  opts: { tolerancePercent: number; submissionKey: string; shortCloseConfirmed: boolean }
) {
  const lineOf = new Map(lines.map((l) => [l.id, l]));
  return {
    jobWorkOrderId: header.jobWorkOrderId,
    receivedDate: header.receivedDate,
    receivedChallan: header.receivedChallan.trim() || undefined,
    ...(header.invoiceToFollow
      ? { invoiceToFollow: true }
      : { invoiceNumber: header.invoiceNumber.trim() || undefined, invoiceDate: header.invoiceDate || undefined }),
    warehouseId: header.warehouseId,
    ...(header.toProcessor ? { deliveredToProcessor: true, vehicleNumber: header.vehicle.trim() || undefined } : {}),
    remarks: header.remarks?.trim() || undefined,
    shortCloseConfirmed: opts.shortCloseConfirmed || undefined,
    submissionKey: opts.submissionKey || undefined,
    lines: rows
      .filter((row) => rowEntered(row) && lineOf.has(row.lineId))
      .map((row) => ({
        lineId: row.lineId,
        entryMode: row.entryMode,
        ...(row.entryMode === 'TOTAL_METERS'
          ? { qtyReceivedMeters: row.qtyMeters, thanCount: row.thanCount > 0 ? row.thanCount : undefined }
          : {
              // The lot keeps these pieces (rolls are rolls), with the processor's tags when typed
              details: row.pieces.map((p, i) => ({
                detailType: row.entryMode === 'ROLL_WISE' ? ('ROLL' as const) : ('THAN' as const),
                baleNumber: row.entryMode === 'BALE_WISE' ? p.baleNumber : null,
                sequenceNo: i + 1,
                meters: p.meters,
                baleNo: row.entryMode === 'BALE_WISE' ? p.baleNo?.trim() || null : null,
                thanNo: p.thanNo?.trim() || null,
              })),
            }),
        foldLengthCm: row.foldLengthCm > 0 ? row.foldLengthCm : undefined,
        receivedWidthInches: row.widthInches > 0 ? row.widthInches : undefined,
        isFinal: rowIsFinal(row, lineOf.get(row.lineId)!, opts.tolerancePercent),
        processingQC:
          row.qualityGrade || row.defectMeters > 0
            ? {
                qualityGrade: row.qualityGrade || undefined,
                defectMeters: row.defectMeters > 0 ? row.defectMeters : undefined,
              }
            : undefined,
      })),
  };
}

export type DeliveryPayload = ReturnType<typeof deliveryPayload>;
