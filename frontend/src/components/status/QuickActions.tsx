import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ExternalLink, Zap, AlertOctagon, TrendingUp } from 'lucide-react';
import type { ActionInfo } from '@/types/productionStatus.types';

interface QuickActionsProps {
  actions: ActionInfo[];
}

export default function QuickActions({ actions }: QuickActionsProps) {
  const navigate = useNavigate();

  if (actions.length === 0) {
    return null;
  }

  const getPriorityConfig = (priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW') => {
    switch (priority) {
      case 'URGENT':
        return {
          variant: 'destructive' as const,
          icon: AlertOctagon,
          className: 'bg-red-600 hover:bg-red-700',
        };
      case 'HIGH':
        return {
          variant: 'default' as const,
          icon: Zap,
          className: 'bg-orange-600 hover:bg-orange-700',
        };
      case 'MEDIUM':
        return {
          variant: 'default' as const,
          icon: TrendingUp,
          className: 'bg-blue-600 hover:bg-blue-700',
        };
      default:
        return {
          variant: 'outline' as const,
          icon: ExternalLink,
          className: '',
        };
    }
  };

  // Sort actions by priority
  const sortedActions = [...actions].sort((a, b) => {
    const priorityOrder = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-gray-600">ACTIONS:</span>
      {sortedActions.map((action, index) => {
        const config = getPriorityConfig(action.priority);
        const Icon = config.icon;

        return (
          <Button
            key={index}
            size="sm"
            variant={config.variant}
            className={config.className}
            onClick={(e) => {
              e.stopPropagation();
              navigate(action.route);
            }}
          >
            <Icon className="h-3.5 w-3.5 mr-1.5" />
            {action.label}
          </Button>
        );
      })}
    </div>
  );
}
