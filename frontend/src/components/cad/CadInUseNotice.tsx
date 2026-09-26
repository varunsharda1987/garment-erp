import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { CadInUseEntry } from '@/services/cad-planning.service';

const PURPOSE_LABEL: Record<string, string> = {
  COSTING: 'Costing',
  RAW_MATERIAL_CALCULATION: 'Raw material',
};

/**
 * What a Reject would leave behind: the approved cost sheets and order BOMs built on the CAD keep the
 * old figures (409 CAD_IN_USE from the reject endpoints). Shown inside the Reject dialogs before the
 * user confirms.
 */
export function CadInUseNotice({ inUse }: { inUse: CadInUseEntry[] }) {
  const sheets = new Map<string, string>();
  const orders = new Set<string>();
  for (const entry of inUse) {
    for (const s of entry.costSheets) {
      sheets.set(s.costSheetId, `Cost sheet v${s.version} — ${PURPOSE_LABEL[s.purpose] ?? s.purpose}`);
    }
    for (const o of entry.orders) orders.add(o.orderNumber);
  }

  return (
    <Alert className="border-warning/40 bg-warning/10 [&>svg]:text-warning">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>This CAD is already in use</AlertTitle>
      <AlertDescription className="space-y-2">
        <ul className="list-disc pl-4 text-sm">
          {[...sheets.values()].map((label) => (
            <li key={label}>{label} (approved)</li>
          ))}
          {[...orders].map((orderNumber) => (
            <li key={orderNumber}>Order {orderNumber} — its BOM and requirements</li>
          ))}
        </ul>
        <p className="text-sm">
          Rejecting clears the fabric price approval, and these will <strong>not</strong> update — they stay on the old
          figures. Reject anyway only if you will redo them.
        </p>
      </AlertDescription>
    </Alert>
  );
}
