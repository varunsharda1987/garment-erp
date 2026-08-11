/**
 * Statutory report adapters for the kf report templates:
 *   report-job-work-ageing  ← Section 143 ageing
 *   report-itc-04           ← ITC-04 extract
 *   report-vendor-performance ← processor loss vs tolerance
 *
 * The queries/aggregation live in job-work-statutory.service (reused, not
 * duplicated) — these functions only map the service DTOs to render-ready
 * strings. No period given: ITC-04 defaults to the current quarter,
 * vendor performance to a rolling 6-month window.
 */
import jobWorkStatutoryService, { Section143AgeingItem, VendorPerformanceItem } from '../job-work-statutory.service';
import { buildCompanyBlock } from './company-block';
import { EM_DASH, fmtDate, fmtDateTime, fmtMoney, fmtPct, fmtQty, lakhShort } from './format';

export interface ReportPeriod {
  start: Date;
  end: Date;
}

const EN_DASH = '–';
const MINUS = '−'; // U+2212, matches &minus; in the design package

/** 'DYEING' → 'Dyeing', 'JOB_WORK' → 'Job Work' */
function titleCase(value: string): string {
  return value
    .split(/[_\s]+/)
    .filter((w) => w.length > 0)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/** Unit suffix as the design package prints it: "210.00 m", "480 pcs" */
function unitSuffix(uom: string): string {
  const u = uom.toUpperCase();
  if (u === 'MTR' || u === 'M' || u === 'METERS') return 'm';
  if (u === 'PCS' || u === 'PIECES') return 'pcs';
  if (u === 'KG' || u === 'KGS') return 'kg';
  return uom.toLowerCase();
}

function periodLabel(period: ReportPeriod): string {
  return `${fmtDate(period.start)} ${EN_DASH} ${fmtDate(period.end)}`;
}

/** Current calendar quarter (aligns with Indian FY quarters: Apr–Jun, …) */
function defaultQuarter(): ReportPeriod {
  const now = new Date();
  const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
  return {
    start: new Date(now.getFullYear(), qStartMonth, 1),
    end: new Date(now.getFullYear(), qStartMonth + 3, 0, 23, 59, 59, 999),
  };
}

/** Rolling 6 months ending now */
function defaultRollingSixMonths(): ReportPeriod {
  const end = new Date();
  const start = new Date(end);
  start.setMonth(start.getMonth() - 6);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

// ---------------------------------------------------------------------------
// Section 143 Ageing
// ---------------------------------------------------------------------------

export interface AgeingReportRow {
  jobWorkNumber: string;
  processorName: string;
  processType: string;
  sentDate: string;
  balance: string; // "210.00 m"
  value: string; // fmtMoney
  daysOutstanding: number;
  daysRemaining: string; // "43" / "−36"
  chipClass: string;
  chipLabel: string;
  rowClass: string | null;
}

export interface AgeingReportData {
  companyName: string;
  companyGstin: string;
  asAt: string;
  kpiOrders: number;
  kpiOrdersIsOne: boolean;
  processorCount: number;
  processorCountIsOne: boolean;
  kpiValueShort: string; // lakhShort
  kpiValueFull: string; // fmtMoney
  kpiCritical: number;
  kpiBreached: number;
  rows: AgeingReportRow[];
  totalValue: string;
  generatedOn: string;
}

const AGEING_CHIP: Record<
  Section143AgeingItem['severity'],
  { chipClass: string; chipLabel: string; rowClass: string | null }
> = {
  OK: { chipClass: 'chip-ok', chipLabel: 'OK', rowClass: null },
  WARNING: { chipClass: 'chip-warning', chipLabel: 'Warning', rowClass: null },
  CRITICAL: { chipClass: 'chip-critical', chipLabel: 'Critical', rowClass: 'row-critical' },
  BREACHED: { chipClass: 'chip-breached', chipLabel: 'Breached', rowClass: 'row-breached' },
};

export async function buildAgeingReportData(asOfDate?: Date): Promise<AgeingReportData> {
  const [company, summary] = await Promise.all([
    buildCompanyBlock(),
    jobWorkStatutoryService.getSection143Ageing(asOfDate),
  ]);

  const processorCount = new Set(summary.items.map((i) => i.processorId)).size;

  const rows: AgeingReportRow[] = summary.items.map((item) => {
    const chip = AGEING_CHIP[item.severity];
    return {
      jobWorkNumber: item.jobWorkNumber,
      processorName: item.processorName,
      processType: titleCase(item.processType),
      sentDate: fmtDate(item.sentDate),
      balance: `${fmtQty(item.balanceQty, item.unit)} ${unitSuffix(item.unit)}`,
      value: fmtMoney(item.balanceValue),
      daysOutstanding: item.daysOutstanding,
      daysRemaining: item.daysRemaining < 0 ? `${MINUS}${Math.abs(item.daysRemaining)}` : String(item.daysRemaining),
      chipClass: chip.chipClass,
      chipLabel: chip.chipLabel,
      rowClass: chip.rowClass,
    };
  });

  return {
    companyName: company.name,
    companyGstin: company.gstin,
    asAt: fmtDateTime(summary.asOfDate),
    kpiOrders: summary.totalOrdersOutstanding,
    kpiOrdersIsOne: summary.totalOrdersOutstanding === 1,
    processorCount,
    processorCountIsOne: processorCount === 1,
    kpiValueShort: lakhShort(summary.totalValueAtProcessors),
    kpiValueFull: fmtMoney(summary.totalValueAtProcessors),
    kpiCritical: summary.ordersCritical,
    kpiBreached: summary.ordersBreached,
    rows,
    totalValue: fmtMoney(summary.totalValueAtProcessors),
    generatedOn: fmtDate(new Date()),
  };
}

// ---------------------------------------------------------------------------
// ITC-04 Extract
// ---------------------------------------------------------------------------

export interface Itc04ReportRow {
  gstin: string | null; // null → template renders muted "Unregistered"
  processorName: string;
  challanNumber: string;
  challanDate: string;
  description: string;
  linkedChallanNumber: string | null;
  uqc: string;
  qty: string;
  taxableValue: string;
  inputType: string;
}

export interface Itc04TableBlock {
  rows: Itc04ReportRow[];
  totalChallans: number;
  totalChallansIsOne: boolean;
  totalQty: string;
  totalTaxableValue: string;
}

export interface Itc04ReportData {
  companyName: string;
  companyGstin: string;
  periodLabel: string;
  kpiSent: number;
  kpiReceived: number;
  kpiJobWorkers: number;
  unregisteredCount: number;
  tableA: Itc04TableBlock;
  tableB: Itc04TableBlock;
  generatedOn: string;
}

export async function buildItc04ReportData(period?: ReportPeriod): Promise<Itc04ReportData> {
  const p = period ?? defaultQuarter();
  const summary = await jobWorkStatutoryService.getITC04Extract(p.start, p.end);

  const mapBlock = (block: typeof summary.tableA): Itc04TableBlock => ({
    rows: block.items.map((item) => ({
      gstin: item.processorGstin,
      processorName: item.processorName,
      challanNumber: item.challanNumber,
      challanDate: fmtDate(item.challanDate),
      description: item.description,
      linkedChallanNumber: item.linkedChallanNumber ?? null,
      uqc: item.uqc,
      qty: fmtQty(item.quantity, item.uqc),
      taxableValue: fmtMoney(item.taxableValue),
      inputType: item.inputType,
    })),
    totalChallans: block.totalChallans,
    totalChallansIsOne: block.totalChallans === 1,
    totalQty: fmtQty(block.totalQuantity),
    totalTaxableValue: fmtMoney(block.totalTaxableValue),
  });

  return {
    companyName: summary.companyName,
    companyGstin: summary.companyGstin,
    periodLabel: periodLabel({ start: summary.periodStart, end: summary.periodEnd }),
    kpiSent: summary.tableA.totalChallans,
    kpiReceived: summary.tableB.totalChallans,
    kpiJobWorkers: summary.jobWorkerCount,
    unregisteredCount: summary.unregisteredCount,
    tableA: mapBlock(summary.tableA),
    tableB: mapBlock(summary.tableB),
    generatedOn: fmtDate(new Date()),
  };
}

// ---------------------------------------------------------------------------
// Vendor (Processor) Performance
// ---------------------------------------------------------------------------

export interface VendorPerformanceReportRow {
  processorName: string;
  processType: string;
  ordersCompleted: number;
  issued: string; // "18,400.00 m"
  tolerance: string; // fmtPct
  actualLoss: string; // fmtPct
  barWidthPct: number;
  tickLeftPct: number;
  barOver: boolean;
  debited: string; // 0 → em-dash (nothing debited), else fmtMoney
  chipClass: string;
  chipLabel: string;
  rowClass: string | null;
}

export interface VendorPerformanceReportData {
  companyName: string;
  companyGstin: string;
  windowLabel: string;
  periodLabel: string;
  kpiProcessors: number;
  kpiProcessorsIsOne: boolean;
  processTypeCount: number;
  processTypeCountIsOne: boolean;
  kpiOrdersClosed: number;
  kpiOrdersClosedIsOne: boolean;
  kpiOverTolerance: number;
  kpiRecovered: string; // fmtMoney (template prefixes ₹)
  rows: VendorPerformanceReportRow[];
  totalDebited: string;
  generatedOn: string;
}

const VENDOR_CHIP: Record<
  VendorPerformanceItem['status'],
  { chipClass: string; chipLabel: string; rowClass: string | null }
> = {
  WITHIN: { chipClass: 'chip-ok', chipLabel: 'Within', rowClass: null },
  AT_LIMIT: { chipClass: 'chip-warning', chipLabel: 'At limit', rowClass: null },
  OVER: { chipClass: 'chip-critical', chipLabel: 'Over', rowClass: 'row-critical' },
};

/**
 * The service DTO carries no uom (orders are grouped per processor+process);
 * derived here from the process type — fabric processes issue meters,
 * garment processes issue pieces (simpler than extending the service DTO).
 */
const METER_PROCESSES = new Set(['DYEING', 'PRINTING', 'EMBROIDERY']);

function issuedUom(processType: string): 'MTR' | 'PCS' {
  return METER_PROCESSES.has(processType.toUpperCase()) ? 'MTR' : 'PCS';
}

export async function buildVendorPerformanceReportData(period?: ReportPeriod): Promise<VendorPerformanceReportData> {
  const p = period ?? defaultRollingSixMonths();
  const [company, summary] = await Promise.all([
    buildCompanyBlock(),
    jobWorkStatutoryService.getVendorPerformance(p.start, p.end),
  ]);

  const processTypeCount = new Set(summary.items.map((i) => i.processType)).size;

  const rows: VendorPerformanceReportRow[] = summary.items.map((item) => {
    const chip = VENDOR_CHIP[item.status];
    const uom = issuedUom(item.processType);
    // Bar geometry: tolerance tick sits at 2/3 of scale when within range
    const scale = Math.max(item.actualLossPercent, item.tolerancePercent * 1.5, 0.0001);
    const barWidthPct = Math.min(100, Math.round((item.actualLossPercent / scale) * 1000) / 10);
    const tickLeftPct = Math.min(100, Math.round((item.tolerancePercent / scale) * 1000) / 10);
    return {
      processorName: item.processorName,
      processType: titleCase(item.processType),
      ordersCompleted: item.ordersCompleted,
      issued: `${fmtQty(item.totalIssued, uom)} ${unitSuffix(uom)}`,
      tolerance: fmtPct(item.tolerancePercent),
      actualLoss: fmtPct(item.actualLossPercent),
      barWidthPct,
      tickLeftPct,
      barOver: item.status === 'OVER',
      debited: item.debitedAmount === 0 ? EM_DASH : fmtMoney(item.debitedAmount),
      chipClass: chip.chipClass,
      chipLabel: chip.chipLabel,
      rowClass: chip.rowClass,
    };
  });

  return {
    companyName: company.name,
    companyGstin: company.gstin,
    windowLabel: period ? 'selected window' : 'rolling 6 months',
    periodLabel: periodLabel({ start: summary.periodStart, end: summary.periodEnd }),
    kpiProcessors: summary.totalProcessors,
    kpiProcessorsIsOne: summary.totalProcessors === 1,
    processTypeCount,
    processTypeCountIsOne: processTypeCount === 1,
    kpiOrdersClosed: summary.totalOrdersClosed,
    kpiOrdersClosedIsOne: summary.totalOrdersClosed === 1,
    kpiOverTolerance: summary.processorsOverTolerance,
    kpiRecovered: fmtMoney(summary.totalRecovered),
    rows,
    totalDebited: fmtMoney(summary.totalRecovered),
    generatedOn: fmtDate(new Date()),
  };
}
