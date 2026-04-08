import { ArrowRight } from 'lucide-react';
import type { StatusTransition } from '@/types/processGuide.types';

interface StageStatusFlowProps {
  statusFlow: StatusTransition[];
}

export default function StageStatusFlow({ statusFlow }: StageStatusFlowProps) {
  if (statusFlow.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-foreground">Status Flow</h4>
      <div className="flex flex-wrap items-center gap-2">
        {statusFlow.map((transition, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-muted text-foreground">
              {transition.from}
            </span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-muted text-foreground">
              {transition.to}
            </span>
            {index < statusFlow.length - 1 && <span className="text-gray-300 mx-1">|</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
