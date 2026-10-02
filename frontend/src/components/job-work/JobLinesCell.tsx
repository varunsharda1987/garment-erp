/**
 * A list cell for a job work order that may bring back several fabrics (one line each, 2026-09-30). With one line
 * the cell shows what it always showed (the job's style or fabric). With several, the job's own style / fabric is
 * blank — they differ — so the cell names each line: "SP27CK130 · Red", "SP27CK130-B · Black", …
 */
import type { ReactNode } from 'react';
import { lineName } from '@/lib/jwo-lines';
import type { JobWorkOrderLineBrief } from '@/types/jobWorkOrder.types';

interface JobLinesCellProps {
  lines?: JobWorkOrderLineBrief[] | null;
  /** What a one-line job shows here */
  fallback: ReactNode;
  /** 'style' names each line's Buyer Style Code and colour; 'fabric' names the fabric each line brings back */
  show: 'style' | 'fabric';
}

export function JobLinesCell({ lines, fallback, show }: JobLinesCellProps) {
  if (!lines || lines.length < 2) return <>{fallback}</>;
  return (
    <div className="space-y-0.5">
      {lines.map((line) => (
        <div key={line.id} className="text-sm leading-tight">
          {show === 'style'
            ? lineName(line)
            : (line.finishedFabric?.fabricName ??
              line.finishedLace?.laceName ??
              `${lineName(line)} — named when it comes back`)}
        </div>
      ))}
    </div>
  );
}
