import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertCircle, Package, ChevronRight } from 'lucide-react';
import type { OrderStatusItem } from '@/types/orderProductionStatus.types';
import { cn } from '@/lib/utils';

interface CompactOrderRowProps {
  item: OrderStatusItem;
  onExpand?: (orderItemId: string) => void;
}

const STAGE_SHORT_LABELS: Record<string, string> = {
  ORDER_RECEIVED: 'Ordered',
  PENDING_COSTING: 'Costing',
  PENDING_GREIGE_ORDER: 'Greige',
  TRIMS_NOT_ORDERED: 'Trims',
  IN_PRINTING: 'Printing',
  IN_DYING: 'Dying',
  IN_EMBROIDERY: 'Embroidery',
  IN_SMOCKING: 'Smocking',
  IN_HANDWORK: 'Handwork',
  IN_CUTTING: 'Cutting',
  IN_STITCHING: 'Stitching',
  IN_FINISHING: 'Finishing',
  READY_TO_SHIP: 'Ready',
  SHIPPED: 'Shipped',
  COMPLETED: 'Complete',
};

export default function CompactOrderRow({ item, onExpand }: CompactOrderRowProps) {
  const navigate = useNavigate();

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
    });
  };

  const formatCurrency = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
    return `₹${Math.round(value / 1000)}K`;
  };

  const getStatusBadge = () => {
    if (item.isDelayed) {
      return (
        <Badge variant="destructive" className="text-xs px-1.5 py-0">
          Delayed {item.daysToDelivery !== null ? `${Math.abs(item.daysToDelivery)}d` : ''}
        </Badge>
      );
    }
    if (item.currentStage === 'COMPLETED' || item.currentStage === 'SHIPPED') {
      return (
        <Badge variant="outline" className="text-xs px-1.5 py-0 border-success text-success">
          {item.currentStage === 'COMPLETED' ? 'Done' : 'Shipped'}
        </Badge>
      );
    }
    if (item.blockers.length > 0) {
      return (
        <Badge variant="outline" className="text-xs px-1.5 py-0 border-warning text-warning">
          {item.blockers.length} Blocker{item.blockers.length > 1 ? 's' : ''}
        </Badge>
      );
    }
    if (item.daysToDelivery !== null && item.daysToDelivery <= 7 && item.daysToDelivery > 0) {
      return (
        <Badge variant="outline" className="text-xs px-1.5 py-0 border-info text-info">
          Due {item.daysToDelivery}d
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs px-1.5 py-0">
        On Track
      </Badge>
    );
  };

  const getProgressColor = () => {
    if (item.isDelayed) return 'bg-destructive';
    if (item.overallProgress >= 80) return 'bg-success';
    if (item.overallProgress >= 50) return 'bg-info';
    if (item.overallProgress >= 25) return 'bg-warning';
    return 'bg-muted-foreground';
  };

  return (
    <div
      className={cn(
        'grid grid-cols-[1fr_1.5fr_1fr_80px_70px_100px_120px_80px_40px] gap-3 items-center',
        'px-4 py-2.5 border-b border-border hover:bg-muted/50 transition-colors cursor-pointer',
        item.isDelayed && 'bg-destructive/5 border-l-2 border-l-destructive'
      )}
      onClick={() => navigate(`/styles/${item.styleId}`)}
    >
      {/* Order */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-semibold text-sm text-primary truncate">{item.orderNumber}</span>
        {item.isDelayed && <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />}
      </div>

      {/* Style */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{item.styleCode}</span>
          {item.brandName && (
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded truncate">
              {item.brandName}
            </span>
          )}
        </div>
        {item.customerName && <span className="text-xs text-muted-foreground truncate block">{item.customerName}</span>}
      </div>

      {/* Stage */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                'text-xs font-medium px-2 py-1 rounded truncate inline-block',
                item.currentStage.includes('PENDING') || item.currentStage.includes('NOT_ORDERED')
                  ? 'bg-warning/10 text-warning'
                  : item.currentStage === 'COMPLETED' || item.currentStage === 'SHIPPED'
                    ? 'bg-success/10 text-success'
                    : 'bg-info/10 text-info'
              )}
            >
              {STAGE_SHORT_LABELS[item.currentStage] || item.currentStage}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{item.currentStage.replace(/_/g, ' ')}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Quantity */}
      <div className="flex items-center gap-1 text-sm">
        <Package className="h-3.5 w-3.5 text-muted-foreground" />
        <span>{item.quantity.toLocaleString()}</span>
      </div>

      {/* Due Date */}
      <span className={cn('text-sm', item.isDelayed ? 'text-destructive font-medium' : 'text-muted-foreground')}>
        {formatDate(item.deliveryDate)}
      </span>

      {/* Value */}
      <span className="text-sm font-medium">{formatCurrency(item.totalPrice)}</span>

      {/* Progress */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full', getProgressColor())}
            style={{ width: `${item.overallProgress}%` }}
          />
        </div>
        <span className="text-xs font-medium text-muted-foreground w-8">{item.overallProgress}%</span>
      </div>

      {/* Status */}
      {getStatusBadge()}

      {/* Actions */}
      <div className="flex items-center justify-end gap-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onExpand) onExpand(item.orderItemId);
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>View Details</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

export function CompactOrderHeader() {
  return (
    <div className="grid grid-cols-[1fr_1.5fr_1fr_80px_70px_100px_120px_80px_40px] gap-3 items-center px-4 py-2 bg-muted/50 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
      <span>Order</span>
      <span>Style / Customer</span>
      <span>Stage</span>
      <span>Qty</span>
      <span>Due</span>
      <span>Value</span>
      <span>Progress</span>
      <span>Status</span>
      <span></span>
    </div>
  );
}
