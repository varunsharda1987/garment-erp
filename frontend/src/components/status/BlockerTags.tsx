import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import type { BlockerInfo } from '@/types/productionStatus.types';

interface BlockerTagsProps {
  blockers: BlockerInfo[];
}

export default function BlockerTags({ blockers }: BlockerTagsProps) {
  if (blockers.length === 0) {
    return null;
  }

  const getSeverityConfig = (severity: 'HIGH' | 'MEDIUM' | 'LOW') => {
    switch (severity) {
      case 'HIGH':
        return {
          bg: 'bg-red-50',
          border: 'border-red-300',
          text: 'text-red-800',
          icon: AlertTriangle,
          iconColor: 'text-red-600',
        };
      case 'MEDIUM':
        return {
          bg: 'bg-amber-50',
          border: 'border-amber-300',
          text: 'text-amber-800',
          icon: AlertCircle,
          iconColor: 'text-amber-600',
        };
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-300',
          text: 'text-gray-800',
          icon: Info,
          iconColor: 'text-gray-600',
        };
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <span className="text-xs font-semibold text-gray-600 self-center">BLOCKERS:</span>
      {blockers.map((blocker, index) => {
        const config = getSeverityConfig(blocker.severity);
        const Icon = config.icon;

        return (
          <div
            key={index}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${config.bg} ${config.border}`}
          >
            <Icon className={`h-3.5 w-3.5 ${config.iconColor}`} />
            <span className={`text-xs font-medium ${config.text}`}>
              {blocker.message}
              {blocker.daysStuck !== null && blocker.daysStuck > 0 && (
                <span className="ml-1 opacity-75">({blocker.daysStuck}d)</span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
