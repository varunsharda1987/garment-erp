import { Card } from '@/components/ui/card';
import { Package, TrendingUp, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import type { ProductionStatusSummary } from '@/types/productionStatus.types';

interface StatusSummaryCardsProps {
  summary: ProductionStatusSummary | null;
  loading: boolean;
}

export default function StatusSummaryCards({ summary, loading }: StatusSummaryCardsProps) {
  if (loading || !summary) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="p-4 animate-pulse">
            <div className="h-16 bg-gray-200 rounded"></div>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: 'Total Orders',
      icon: Package,
      value: summary.total,
      subValue: `₹${(summary.totalOrderValue / 10000000).toFixed(2)} Cr`,
      pieces: `${summary.totalPieces.toLocaleString()} pcs`,
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
      borderColor: 'border-blue-200',
    },
    {
      title: 'Running',
      icon: TrendingUp,
      value: summary.running,
      subValue: `${summary.total > 0 ? Math.round((summary.running / summary.total) * 100) : 0}% of total`,
      bgColor: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
      borderColor: 'border-indigo-200',
    },
    {
      title: 'Delayed',
      icon: AlertTriangle,
      value: summary.delayed,
      subValue: summary.delayed > 0 ? 'Requires attention' : 'All on track',
      bgColor: 'bg-red-50',
      iconColor: 'text-red-600',
      borderColor: 'border-red-200',
    },
    {
      title: 'Needs Attention',
      icon: Clock,
      value: summary.needsAttention,
      subValue: summary.needsAttention > 0 ? 'Action required' : 'No blockers',
      bgColor: 'bg-amber-50',
      iconColor: 'text-amber-600',
      borderColor: 'border-amber-200',
    },
    {
      title: 'Completed',
      icon: CheckCircle,
      value: summary.completed,
      subValue: `${summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0}% complete`,
      bgColor: 'bg-green-50',
      iconColor: 'text-green-600',
      borderColor: 'border-green-200',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card
            key={card.title}
            className={`p-4 border-2 ${card.borderColor} ${card.bgColor} transition-all hover:shadow-md`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">{card.title}</p>
                <p className="text-3xl font-bold text-gray-900 mb-1">{card.value}</p>
                <p className="text-xs text-gray-500">{card.subValue}</p>
                {card.pieces && (
                  <p className="text-xs text-gray-500 mt-1">{card.pieces}</p>
                )}
              </div>
              <div className={`p-2 rounded-lg ${card.bgColor}`}>
                <Icon className={`h-6 w-6 ${card.iconColor}`} />
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
