import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status?: string | null;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info';
  className?: string;
}

export function StatusBadge({ status, variant, className }: StatusBadgeProps) {
  // Handle undefined/null status
  if (!status) {
    return (
      <Badge
        variant="outline"
        className={cn('capitalize', 'bg-muted text-muted-foreground hover:bg-muted/80', className)}
      >
        -
      </Badge>
    );
  }

  // Auto-determine variant and color based on status if not provided
  const getStatusStyle = () => {
    if (variant) {
      return getVariantClass(variant);
    }

    const statusLower = status.toLowerCase();

    // Success states
    if (
      statusLower.includes('active') ||
      statusLower.includes('approved') ||
      statusLower.includes('completed') ||
      statusLower.includes('confirmed') ||
      statusLower.includes('success')
    ) {
      return 'bg-success/10 text-success border-success/20 hover:bg-success/20';
    }

    // Pending/Draft states
    if (statusLower.includes('pending') || statusLower.includes('draft') || statusLower.includes('review')) {
      return 'bg-secondary text-secondary-foreground hover:bg-secondary/80';
    }

    // Warning states
    if (statusLower.includes('warning') || statusLower.includes('on hold') || statusLower.includes('delayed')) {
      return 'bg-warning/10 text-warning-foreground border-warning/20 hover:bg-warning/20';
    }

    // Error/Destructive states
    if (
      statusLower.includes('cancelled') ||
      statusLower.includes('rejected') ||
      statusLower.includes('error') ||
      statusLower.includes('failed')
    ) {
      return 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20';
    }

    // Info states
    if (statusLower.includes('processing') || statusLower.includes('in progress') || statusLower.includes('info')) {
      return 'bg-info/10 text-info border-info/20 hover:bg-info/20';
    }

    // Default
    return 'bg-muted text-muted-foreground hover:bg-muted/80';
  };

  const getVariantClass = (v: string) => {
    switch (v) {
      case 'success':
        return 'bg-success/10 text-success border-success/20 hover:bg-success/20';
      case 'warning':
        return 'bg-warning/10 text-warning-foreground border-warning/20 hover:bg-warning/20';
      case 'info':
        return 'bg-info/10 text-info border-info/20 hover:bg-info/20';
      case 'destructive':
        return 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20';
      case 'secondary':
        return 'bg-secondary text-secondary-foreground hover:bg-secondary/80';
      case 'outline':
        return 'border-border bg-background hover:bg-accent';
      default:
        return 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20';
    }
  };

  return (
    <Badge variant="outline" className={cn('capitalize', getStatusStyle(), className)}>
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}

// Movement type badge with custom colors
export function MovementTypeBadge({ type }: { type: string }) {
  const colors = {
    IN: 'bg-green-100 text-green-800 hover:bg-green-100',
    OUT: 'bg-red-100 text-red-800 hover:bg-red-100',
    TRANSFER: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
    ADJUSTMENT: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
  };

  const colorClass = colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';

  return (
    <Badge variant="outline" className={cn('capitalize', colorClass)}>
      {type}
    </Badge>
  );
}
