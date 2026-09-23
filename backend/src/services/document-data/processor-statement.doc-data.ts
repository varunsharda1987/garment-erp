/**
 * Processor Statement → the printed copy.
 *
 * This document LEAVES THE BUILDING: it is handed to the dyer/printer to sign back. So it
 * carries only what they can verify from their own register — dated sends, dated receipts, the
 * shrinkage we agreed with them, and what is still lying with them. Deliberately absent:
 * tolerance verdicts, abnormal-loss splits and debit-note amounts. Those are our commercial
 * position, they live on the screen, and printing them turns a reconciliation into an argument
 * before anyone has agreed the quantities.
 *
 * Every field is a pre-formatted string — the template does no arithmetic, the same rule the
 * other kf report adapters follow.
 */
import { getProcessorStatement, type MaterialKind, type StatementSection } from '../processor-statement.service';
import { buildCompanyBlock } from './company-block';
import { EM_DASH, fmtDate, fmtQty } from './format';
import { unitShort } from '../../utils/units';

export interface ProcessorStatementPeriod {
  start: Date;
  end: Date;
}

export interface StatementDocJob {
  jobWorkNumber: string;
  processType: string;
  sentDate: string;
  sentQty: string;
  challanNumbers: string;
  agreedLabel: string | null;
  receipts: string[];
  receivedQty: string;
  returned: string;
  shrinkage: string;
  shortfall: string;
  balance: string;
  virtual: boolean;
  damaged: string | null;
}

export interface StatementDocRow {
  code: string;
  name: string;
  opening: string;
  sent: string;
  received: string;
  returned: string;
  shrinkage: string;
  shortfall: string;
  closing: string;
  closingNegative: boolean;
  unitMixed: boolean;
  jobs: StatementDocJob[];
}

export interface StatementDocSection {
  title: string;
  unitSuffix: string;
  rows: StatementDocRow[];
  totals: {
    opening: string;
    sent: string;
    received: string;
    returned: string;
    shrinkage: string;
    shortfall: string;
    closing: string;
  };
}

export interface ProcessorStatementDocData {
  companyName: string;
  companyGstin: string;
  processorName: string;
  processorCode: string;
  processorGstin: string | null;
  periodLabel: string;
  kpiOpening: string;
  kpiSent: string;
  kpiReceived: string;
  kpiClosing: string;
  kpiReturned: string;
  kpiShrinkage: string;
  kpiShortfall: string;
  kpiPiecesNote: string | null;
  sections: StatementDocSection[];
  isEmpty: boolean;
  generatedOn: string;
}

const EN_DASH = '–';

/** 'DYEING' → 'Dyeing' */
function titleCase(value: string): string {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/** "1,704.00 m" — a real zero prints as 0.00, only nulls become an em-dash. */
function qty(value: number, uom: string): string {
  return `${fmtQty(value, uom)} ${unitShort(uom)}`;
}

/**
 * The only column either side needs to discuss. Signed on purpose: "short" is ours to chase,
 * "over" is theirs to be credited, and a bare number would read as the same thing.
 */
function shortfallLabel(value: number, uom: string): string {
  if (Math.abs(value) <= 0.005) return EM_DASH;
  const magnitude = qty(Math.abs(value), uom);
  return value > 0 ? `${magnitude} short` : `${magnitude} over`;
}

function periodLabel(period: ProcessorStatementPeriod): string {
  return `${fmtDate(period.start)} ${EN_DASH} ${fmtDate(period.end)}`;
}

/** Pieces cannot be added to metres, so the KPI band totals cloth and footnotes the pieces. */
const CLOTH_KINDS = new Set<MaterialKind>(['GREIGE', 'LACE', 'FABRIC']);

function mapSection(section: StatementSection): StatementDocSection {
  const uom = section.unit;

  return {
    title: section.title,
    unitSuffix: unitShort(uom),
    rows: section.rows.map((row) => ({
      code: row.material.code,
      name: row.material.name,
      opening: qty(row.opening, row.unit),
      sent: qty(row.sent, row.unit),
      received: qty(row.received, row.unit),
      returned: row.returned === 0 ? EM_DASH : qty(row.returned, row.unit),
      shrinkage: row.shrinkage === 0 ? EM_DASH : qty(row.shrinkage, row.unit),
      shortfall: shortfallLabel(row.shortfall, row.unit),
      closing: qty(row.closing, row.unit),
      closingNegative: row.closing < -0.005,
      unitMixed: row.unitMixed,
      jobs: row.jobs.map((job) => ({
        jobWorkNumber: job.jobWorkNumber,
        processType: titleCase(job.processType),
        sentDate: fmtDate(job.sentDate),
        sentQty: qty(job.sentQty, job.unit),
        challanNumbers: job.challanNumbers.length ? job.challanNumbers.join(', ') : EM_DASH,
        agreedLabel:
          job.agreedShrinkagePct != null && job.dueBack != null
            ? `${job.agreedShrinkagePct.toFixed(1)}% agreed → due back ${qty(job.dueBack, job.unit)}`
            : null,
        receipts: job.receipts.map((r) => `${r.grnNumber} · ${fmtDate(r.date)} · ${qty(r.qty, job.unit)}`),
        receivedQty: job.receipts.length
          ? qty(
              job.receipts.reduce((sum, r) => sum + r.qty, 0),
              job.unit
            )
          : EM_DASH,
        returned: job.returned === 0 ? EM_DASH : qty(job.returned, job.unit),
        shrinkage: job.shrinkage === 0 ? EM_DASH : qty(job.shrinkage, job.unit),
        shortfall: shortfallLabel(job.shortfall, job.unit),
        balance: qty(job.balance, job.unit),
        virtual: job.virtual,
        damaged: job.damaged != null && job.damaged > 0 ? qty(job.damaged, job.unit) : null,
      })),
    })),
    totals: {
      opening: qty(section.totals.opening, uom),
      sent: qty(section.totals.sent, uom),
      received: qty(section.totals.received, uom),
      returned: section.totals.returned === 0 ? EM_DASH : qty(section.totals.returned, uom),
      shrinkage: section.totals.shrinkage === 0 ? EM_DASH : qty(section.totals.shrinkage, uom),
      shortfall: shortfallLabel(section.totals.shortfall, uom),
      closing: qty(section.totals.closing, uom),
    },
  };
}

export async function buildProcessorStatementDocData(
  processorId: string,
  period: ProcessorStatementPeriod
): Promise<ProcessorStatementDocData> {
  const [company, statement] = await Promise.all([
    buildCompanyBlock(),
    getProcessorStatement(processorId, period.start, period.end),
  ]);

  const cloth = statement.sections.filter((s) => CLOTH_KINDS.has(s.kind));
  const pieces = statement.sections.filter((s) => !CLOTH_KINDS.has(s.kind));

  const clothTotal = (pick: (t: StatementSection['totals']) => number): number =>
    cloth.reduce((sum, s) => sum + pick(s.totals), 0);

  const piecesSent = pieces.reduce((sum, s) => sum + s.totals.sent, 0);
  const piecesClosing = pieces.reduce((sum, s) => sum + s.totals.closing, 0);

  return {
    companyName: company.name,
    companyGstin: company.gstin,
    processorName: statement.processor.name,
    processorCode: statement.processor.code,
    processorGstin: statement.processor.gstin,
    periodLabel: periodLabel(period),
    kpiOpening: qty(
      clothTotal((t) => t.opening),
      'MTR'
    ),
    kpiSent: qty(
      clothTotal((t) => t.sent),
      'MTR'
    ),
    kpiReceived: qty(
      clothTotal((t) => t.received),
      'MTR'
    ),
    kpiClosing: qty(
      clothTotal((t) => t.closing),
      'MTR'
    ),
    kpiReturned: qty(
      clothTotal((t) => t.returned),
      'MTR'
    ),
    kpiShrinkage: qty(
      clothTotal((t) => t.shrinkage),
      'MTR'
    ),
    kpiShortfall: shortfallLabel(
      clothTotal((t) => t.shortfall),
      'MTR'
    ),
    kpiPiecesNote: pieces.length
      ? `Plus ${fmtQty(piecesSent, 'PCS')} pcs of garment work sent, ${fmtQty(piecesClosing, 'PCS')} pcs still with you`
      : null,
    sections: statement.sections.map(mapSection),
    isEmpty: statement.sections.length === 0,
    generatedOn: fmtDate(new Date()),
  };
}
