// Material Ledger — mirrors backend/src/services/material-ledger.service.ts.
// Quantities are plain numbers; dates arrive as ISO strings through JSON.

export type MaterialLedgerKind = 'GREIGE' | 'FABRIC' | 'LACE' | 'THREAD' | 'GENERIC';
export type LedgerEntryKind = 'RECEIPT' | 'ISSUE' | 'RETURN' | 'TRANSFER' | 'ADJUSTMENT' | 'RESERVE' | 'RELEASE';
export type LedgerDirection = 'IN' | 'OUT';

export interface LedgerSource {
  type: string;
  number: string | null;
  id: string | null;
  /** Frontend path to the source document, or null when no page shows it. */
  route: string | null;
  party: string | null;
  destination: string | null;
}

export interface LedgerRow {
  id: string;
  date: string;
  seq: number;
  direction: LedgerDirection;
  kind: LedgerEntryKind;
  qty: number;
  unit: string;
  warehouse: { id: string; name: string } | null;
  lot: { id: string; label: string | null } | null;
  source: LedgerSource;
  remarks: string | null;
  performedBy: string | null;
  flags: string[];
  balance: number;
}

export interface MaterialLedger {
  material: {
    id: string;
    code: string;
    name: string;
    unit: string;
    materialType: string;
    kind: MaterialLedgerKind;
    sizeVariant: string | null;
  };
  filters: { from: string | null; to: string | null; warehouseId: string | null; warehouseName: string | null };
  opening: number | null;
  rows: LedgerRow[];
  totals: { in: number; out: number; closing: number };
  onHand: {
    stockLevels: number | null;
    lotsAvailable: number | null;
    lotsReserved: number | null;
    ledgerClosingAllTime: number;
    drift: boolean;
  };
  warnings: string[];
}

export interface MaterialLedgerParams {
  from?: string;
  to?: string;
  warehouseId?: string;
}
