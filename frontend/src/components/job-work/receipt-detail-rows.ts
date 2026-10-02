// Kept out of ReceiptDetailRows.tsx: a component file exports only components (Vite fast refresh).
import type { ReceiptDetailRow } from './ReceiptDetailRows';

export const sumDetailRows = (rows: ReceiptDetailRow[]) => rows.reduce((s, r) => s + (r.meters > 0 ? r.meters : 0), 0);
