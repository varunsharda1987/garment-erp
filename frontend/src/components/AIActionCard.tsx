/**
 * AIActionCard
 *
 * Confirmation card shown under an assistant message when the AI proposes an
 * action (e.g. create a greige/lace master). The action executes ONLY when the
 * user presses Confirm; Cancel marks it rejected.
 */

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, Zap } from 'lucide-react';

/**
 * Backend-resolved display strings ("Customer: House of Kasya (CUST-001)") ride inside the
 * payload under this key. They are rendered as their own block, never as a field row.
 */
const DISPLAY_KEY = 'displayLines';

// greigeName → "Greige Name" — also the fallback label for actions saved before the
// backend started sending one (create_greige → "Create Greige")
function humanizeKey(key: string): string {
  const spaced = key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

interface AIActionCardProps {
  actionType: string;
  label?: string;
  payload: Record<string, unknown>;
  status: string;
  busy?: boolean;
  onConfirm: () => void;
  onReject: () => void;
}

export function AIActionCard({ actionType, label, payload, status, busy, onConfirm, onReject }: AIActionCardProps) {
  const heading = label || humanizeKey(actionType);
  const displayLines = Array.isArray(payload[DISPLAY_KEY]) ? (payload[DISPLAY_KEY] as string[]) : [];
  const entries = Object.entries(payload).filter(
    ([k, v]) => k !== DISPLAY_KEY && v !== null && v !== undefined && v !== ''
  );

  return (
    <div className="mt-2 border rounded-xl overflow-hidden bg-card shadow-sm">
      <div className="flex items-center gap-2 px-4 py-2 bg-muted border-b">
        <Zap className="h-4 w-4 text-amber-500" />
        <span className="text-sm font-semibold">{heading}</span>
        {status === 'EXECUTED' && (
          <Badge variant="outline" className="ml-auto bg-green-100 text-green-800 border-green-200">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Done
          </Badge>
        )}
        {status === 'REJECTED' && (
          <Badge variant="outline" className="ml-auto bg-gray-100 text-gray-600 border-gray-200">
            <XCircle className="h-3 w-3 mr-1" />
            Cancelled
          </Badge>
        )}
      </div>

      <div className="px-4 py-3">
        {/* Resolved references, e.g. "Customer: House of Kasya (CUST-001)" */}
        {displayLines.length > 0 && (
          <div className="mb-2 pb-2 border-b space-y-0.5">
            {displayLines.map((line, index) => (
              <p key={index} className="text-sm">
                {line}
              </p>
            ))}
          </div>
        )}

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {entries.map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="text-muted-foreground whitespace-nowrap">{humanizeKey(key)}</dt>
              <dd className="font-medium break-words">{formatValue(value)}</dd>
            </div>
          ))}
        </dl>
      </div>

      {status === 'PENDING' && (
        <div className="flex justify-end gap-2 px-4 py-2.5 border-t bg-muted/50">
          <Button variant="outline" size="sm" onClick={onReject} disabled={busy}>
            Cancel
          </Button>
          <Button size="sm" onClick={onConfirm} disabled={busy}>
            {busy ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
            )}
            Confirm & Create
          </Button>
        </div>
      )}
    </div>
  );
}
