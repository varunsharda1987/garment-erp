import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Clock, CheckCircle, AlertCircle } from 'lucide-react';

type SLAStatus = 'ON_TIME' | 'APPROACHING' | 'DELAYED' | 'COMPLETED';

interface SampleSLABadgeProps {
  slaStatus?: SLAStatus;
  daysUntilDue?: number | null;
  className?: string;
  showDays?: boolean;
}

const statusConfig: Record<SLAStatus, { label: string; color: string; icon: typeof Clock }> = {
  ON_TIME: {
    label: 'On Time',
    color: 'bg-green-100 text-green-700 border-green-200',
    icon: CheckCircle,
  },
  APPROACHING: {
    label: 'Due Soon',
    color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    icon: Clock,
  },
  DELAYED: {
    label: 'Overdue',
    color: 'bg-red-100 text-red-700 border-red-200',
    icon: AlertCircle,
  },
  COMPLETED: {
    label: 'Done',
    color: 'bg-gray-100 text-gray-600 border-gray-200',
    icon: CheckCircle,
  },
};

export function SampleSLABadge({ slaStatus, daysUntilDue, className, showDays = true }: SampleSLABadgeProps) {
  if (!slaStatus) return null;

  const config = statusConfig[slaStatus];
  const Icon = config.icon;

  const daysText =
    showDays && daysUntilDue !== null && daysUntilDue !== undefined && slaStatus !== 'COMPLETED'
      ? daysUntilDue < 0
        ? ` (${Math.abs(daysUntilDue)}d late)`
        : daysUntilDue === 0
          ? ' (today)'
          : ` (${daysUntilDue}d)`
      : '';

  return (
    <Badge variant="outline" className={cn('flex items-center gap-1 text-xs', config.color, className)}>
      <Icon className="h-3 w-3" />
      {config.label}
      {daysText}
    </Badge>
  );
}
