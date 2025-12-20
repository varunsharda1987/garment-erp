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
      <h4 className="text-sm font-semibold text-gray-700">Status Flow</h4>
      <div className="flex flex-wrap items-center gap-2">
        {statusFlow.map((transition, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
              {transition.from}
            </span>
            <ArrowRight className="h-3 w-3 text-gray-400" />
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
              {transition.to}
            </span>
            {index < statusFlow.length - 1 && (
              <span className="text-gray-300 mx-1">|</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
