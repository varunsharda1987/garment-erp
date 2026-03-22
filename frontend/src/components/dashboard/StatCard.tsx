/**
 * StatCard Component
 * Displays a statistic with optional trend indicator
 */

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { LucideProps } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number | string;
  description?: string;
  icon: React.ComponentType<LucideProps>;
  iconColor?: string;
  iconBgColor?: string;
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'neutral';
    label?: string;
  };
  onClick?: () => void;
  className?: string;
}

/**
 * Stat card for displaying KPIs
 *
 * @example
 * <StatCard
 *   title="Orders in Production"
 *   value={42}
 *   icon={Factory}
 *   trend={{ value: 12, direction: 'up', label: 'vs last week' }}
 * />
 */
export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  iconColor = 'text-indigo-600',
  iconBgColor = 'bg-indigo-100',
  trend,
  onClick,
  className,
}: StatCardProps) {
  const TrendIcon = trend?.direction === 'up' ? TrendingUp : trend?.direction === 'down' ? TrendingDown : Minus;

  const trendColor =
    trend?.direction === 'up' ? 'text-green-600' : trend?.direction === 'down' ? 'text-red-600' : 'text-gray-500';

  return (
    <Card className={cn('transition-shadow', onClick && 'cursor-pointer hover:shadow-md', className)} onClick={onClick}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
            {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
            {trend && (
              <div className={cn('flex items-center gap-1 mt-2', trendColor)}>
                <TrendIcon className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {trend.direction !== 'neutral' && (trend.direction === 'up' ? '+' : '-')}
                  {trend.value}%
                </span>
                {trend.label && <span className="text-xs text-gray-500 ml-1">{trend.label}</span>}
              </div>
            )}
          </div>
          <div className={cn('p-3 rounded-lg', iconBgColor)}>
            <Icon className={cn('h-6 w-6', iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Compact stat card variant
 */
export function StatCardCompact({
  title,
  value,
  icon: Icon,
  iconColor = 'text-indigo-600',
  onClick,
}: Pick<StatCardProps, 'title' | 'value' | 'icon' | 'iconColor' | 'onClick'>) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 p-4 bg-white rounded-lg border',
        onClick && 'cursor-pointer hover:bg-gray-50'
      )}
      onClick={onClick}
    >
      <Icon className={cn('h-5 w-5', iconColor)} />
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-lg font-semibold">{value}</p>
      </div>
    </div>
  );
}

export default StatCard;
