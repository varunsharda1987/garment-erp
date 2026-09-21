// Processor Statement — mirrors the backend DTO (backend/src/services/processor-statement.service.ts).
// Quantities arrive as plain numbers; dates as ISO strings through JSON.

export type MaterialKind = 'GREIGE' | 'LACE' | 'FABRIC' | 'GARMENT';
export type StatementUom = 'MTR' | 'PCS' | 'KG';

export interface StatementMaterial {
  kind: MaterialKind;
  id: string;
  code: string;
  name: string;
}

export interface StatementReceipt {
  grnNumber: string;
  date: string;
  qty: number;
}

export interface StatementJobLine {
  jwoId: string;
  jobWorkNumber: string;
  processType: string;
  jwoStatus: string;
  material: StatementMaterial;
  unit: StatementUom;
  sentDate: string | null;
  sentQty: number;
  challanNumbers: string[];
  receipts: StatementReceipt[];
  returned: number;
  agreedShrinkagePct: number | null;
  dueBack: number | null;
  shrinkage: number;
  /** Positive = short of the due-back; negative = the processor returned more. */
  shortfall: number;
  balance: number;
  virtual: boolean;
  damaged: number | null;
  /** Our commercial position — shown on screen only, never on the processor's printed copy. */
  screenOnly: {
    qtyNormalLoss: number | null;
    qtyAbnormalLoss: number | null;
    tolerancePercent: number | null;
    isOverTolerance: boolean;
  };
}

export interface StatementRow {
  material: StatementMaterial;
  unit: StatementUom;
  unitMixed: boolean;
  opening: number;
  sent: number;
  received: number;
  returned: number;
  shrinkage: number;
  shortfall: number;
  closing: number;
  jobs: StatementJobLine[];
}

export interface StatementTotals {
  opening: number;
  sent: number;
  received: number;
  returned: number;
  shrinkage: number;
  shortfall: number;
  closing: number;
}

export interface StatementSection {
  kind: MaterialKind;
  title: string;
  unit: StatementUom;
  rows: StatementRow[];
  totals: StatementTotals;
}

export interface ProcessorStatement {
  processor: { id: string; code: string; name: string; gstin: string | null };
  periodStart: string;
  periodEnd: string;
  sections: StatementSection[];
  warnings: string[];
  generatedAt: string;
}

export interface ProcessorStatementParams {
  processorId: string;
  periodStart: string;
  periodEnd: string;
}
