/**
 * Material Ledger → the printed copy.
 *
 * Unlike the processor statement this is an internal document, so nothing is withheld: the point
 * of printing it is to take a material's whole history into a stock-check or an audit, including
 * the places where the books and the shelf disagree.
 *
 * Every field is a pre-formatted string; the template does no arithmetic.
 */
import { getMaterialLedger, type LedgerQuery, type LedgerRow } from '../material-ledger.service';
import { buildCompanyBlock } from './company-block';
import { EM_DASH, fmtDate, fmtQty } from './format';
import { unitShort } from '../../utils/units';

export interface MaterialLedgerDocRow {
  date: string;
  kindLabel: string;
  docType: string;
  docNumber: string;
  party: string;
  lot: string;
  inQty: string;
  outQty: string;
  balance: string;
  negative: boolean;
  remarks: string | null;
  flags: string[];
}

export interface MaterialLedgerDocData {
  companyName: string;
  companyGstin: string;
  materialCode: string;
  materialName: string;
  materialType: string;
  unitLabel: string;
  periodLabel: string;
  warehouseLabel: string;
  hasOpening: boolean;
  opening: string;
  kpiIn: string;
  kpiOut: string;
  kpiClosing: string;
  onHandStockLevels: string;
  onHandLots: string;
  driftLabel: string | null;
  rows: MaterialLedgerDocRow[];
  totalIn: string;
  totalOut: string;
  isEmpty: boolean;
  warnings: string[];
  generatedOn: string;
}

const EN_DASH = '–';

const KIND_LABEL: Record<string, string> = {
  RECEIPT: 'Received',
  ISSUE: 'Issued',
  RETURN: 'Returned',
  TRANSFER: 'Transfer',
  ADJUSTMENT: 'Adjustment',
  RESERVE: 'Reserved',
  RELEASE: 'Released',
};

const SOURCE_LABEL: Record<string, string> = {
  GRN: 'GRN',
  PO: 'Purchase order',
  JOB_WORK_ORDER: 'Job work',
  CHALLAN: 'Challan',
  EXTERNAL_PROCESS: 'Send-out',
  ISSUE_NOTE: 'Issue note',
  PROCESSING_BATCH: 'Batch',
  CUTTING: 'Cutting',
  ORDER: 'Order',
  PROCUREMENT: 'Purchase',
  EMBROIDERY: 'Embroidery',
  TRANSFER: 'Transfer',
  ADJUSTMENT: 'Adjustment',
  STOCK_IN: 'Stock In',
  MANUAL: 'Manual',
};

function qty(value: number, unit: string): string {
  return `${fmtQty(value, unit)} ${unitShort(unit)}`;
}

function mapRow(row: LedgerRow, unit: string): MaterialLedgerDocRow {
  return {
    date: fmtDate(row.date),
    kindLabel: KIND_LABEL[row.kind] ?? row.kind,
    docType: SOURCE_LABEL[row.source.type] ?? row.source.type,
    docNumber: row.source.number ?? EM_DASH,
    party: row.source.party ?? row.source.destination ?? EM_DASH,
    lot: row.lot?.label ?? (row.lot ? row.lot.id.slice(0, 8) : EM_DASH),
    inQty: row.direction === 'IN' ? qty(row.qty, row.unit || unit) : EM_DASH,
    outQty: row.direction === 'OUT' ? qty(row.qty, row.unit || unit) : EM_DASH,
    balance: qty(row.balance, unit),
    negative: row.balance < -0.005,
    remarks: row.remarks,
    flags: row.flags,
  };
}

export async function buildMaterialLedgerDocData(
  materialId: string,
  query: LedgerQuery
): Promise<MaterialLedgerDocData> {
  const [company, ledger] = await Promise.all([buildCompanyBlock(), getMaterialLedger(materialId, query)]);
  const unit = ledger.material.unit;

  const periodLabel =
    query.from && query.to
      ? `${fmtDate(query.from)} ${EN_DASH} ${fmtDate(query.to)}`
      : query.from
        ? `from ${fmtDate(query.from)}`
        : query.to
          ? `up to ${fmtDate(query.to)}`
          : 'all time';

  // The whole reason the page shows on-hand next to the ledger: if these disagree, the ledger is
  // missing a movement and the reader needs to know before they act on either number.
  const driftLabel = ledger.onHand.drift
    ? `Ledger closes at ${qty(ledger.onHand.ledgerClosingAllTime, unit)} but stock shows ${
        ledger.onHand.stockLevels != null ? qty(ledger.onHand.stockLevels, unit) : EM_DASH
      }${ledger.onHand.lotsAvailable != null ? ` (lots ${qty(ledger.onHand.lotsAvailable, unit)})` : ''} — the books and the shelf disagree`
    : null;

  return {
    companyName: company.name,
    companyGstin: company.gstin,
    materialCode: ledger.material.code,
    materialName: ledger.material.name,
    materialType: ledger.material.materialType.replace(/_/g, ' ').toLowerCase(),
    unitLabel: unitShort(unit),
    periodLabel,
    warehouseLabel: ledger.filters.warehouseName ?? 'All warehouses',
    hasOpening: ledger.opening != null,
    opening: qty(ledger.opening ?? 0, unit),
    kpiIn: qty(ledger.totals.in, unit),
    kpiOut: qty(ledger.totals.out, unit),
    kpiClosing: qty(ledger.totals.closing, unit),
    onHandStockLevels: ledger.onHand.stockLevels != null ? qty(ledger.onHand.stockLevels, unit) : EM_DASH,
    onHandLots: ledger.onHand.lotsAvailable != null ? qty(ledger.onHand.lotsAvailable, unit) : EM_DASH,
    driftLabel,
    rows: ledger.rows.map((r) => mapRow(r, unit)),
    totalIn: qty(ledger.totals.in, unit),
    totalOut: qty(ledger.totals.out, unit),
    isEmpty: ledger.rows.length === 0,
    warnings: ledger.warnings,
    generatedOn: fmtDate(new Date()),
  };
}
