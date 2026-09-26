import { AlertTriangle, PencilLine } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { CadInUseEntry } from '@/services/cad-planning.service';

const PURPOSE_LABEL: Record<string, string> = {
  COSTING: 'Costing',
  RAW_MATERIAL_CALCULATION: 'Raw material',
};

/**
 * Why a Reject was refused: approved cost sheets / order BOMs are built on the CAD (409 CAD_IN_USE), and a
 * reject would leave them on the old figures. The change goes through Correct instead, which carries it to
 * them. `onCorrect` shows a "Correct instead" button (row Reject); the plan-level Reject has none.
 */
export function CadInUseNotice({ inUse, onCorrect }: { inUse: CadInUseEntry[]; onCorrect?: () => void }) {
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
      <AlertTitle>This CAD is already in use — it cannot be rejected</AlertTitle>
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
          Rejecting would leave these on the old figures. Use <strong>Correct</strong> instead (row menu → Correct…): it
          carries the change to them.
        </p>
        {onCorrect && (
          <Button size="sm" variant="outline" onClick={onCorrect}>
            <PencilLine className="h-4 w-4 mr-2" />
            Correct instead
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
