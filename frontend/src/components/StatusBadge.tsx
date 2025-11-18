import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  className?: string;
}

export function StatusBadge({ status, variant, className }: StatusBadgeProps) {
  // Auto-determine variant based on status if not provided
  const getVariant = (): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (variant) return variant;

    const statusLower = status.toLowerCase();
    if (statusLower.includes('active') || statusLower.includes('approved') || statusLower.includes('completed')) {
      return 'default';
    }
    if (statusLower.includes('pending') || statusLower.includes('draft')) {
      return 'secondary';
    }
    if (statusLower.includes('cancelled') || statusLower.includes('rejected') || statusLower.includes('error')) {
      return 'destructive';
    }
    return 'outline';
  };

  return (
    <Badge variant={getVariant()} className={cn('capitalize', className)}>
      {status}
    </Badge>
  );
}

// Movement type badge with custom colors
export function MovementTypeBadge({ type }: { type: string }) {
  const colors = {
    IN: 'bg-green-100 text-green-800 hover:bg-green-100',
    OUT: 'bg-red-100 text-red-800 hover:bg-red-100',
    TRANSFER: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
    ADJUSTMENT: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100'
  };

  const colorClass = colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';

  return (
    <Badge variant="outline" className={cn('capitalize', colorClass)}>
      {type}
    </Badge>
  );
}
