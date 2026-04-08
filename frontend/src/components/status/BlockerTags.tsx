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
          bg: 'bg-destructive/10',
          border: 'border-destructive/25',
          text: 'text-destructive',
          icon: AlertTriangle,
          iconColor: 'text-destructive',
        };
      case 'MEDIUM':
        return {
          bg: 'bg-warning-muted',
          border: 'border-warning/25',
          text: 'text-warning',
          icon: AlertCircle,
          iconColor: 'text-warning',
        };
      default:
        return {
          bg: 'bg-muted',
          border: 'border-border',
          text: 'text-foreground',
          icon: Info,
          iconColor: 'text-muted-foreground',
        };
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <span className="text-xs font-semibold text-muted-foreground self-center">BLOCKERS:</span>
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
