import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { AlertCircle, Package, Calendar, TrendingUp } from 'lucide-react';
import type { OrderStatusItem } from '@/types/orderProductionStatus.types';
import type { ProductionStage } from '@/types/style.types';
import { cn } from '@/lib/utils';

interface ProductionKanbanProps {
  items: OrderStatusItem[];
  onCardClick?: (item: OrderStatusItem) => void;
}

interface KanbanColumn {
  key: string;
  title: string;
  stages: ProductionStage[];
  color: string;
  bgColor: string;
  borderColor: string;
}

const KANBAN_COLUMNS: KanbanColumn[] = [
  {
    key: 'preProduction',
    title: 'Pre-Production',
    stages: ['ORDER_RECEIVED', 'PENDING_COSTING', 'PENDING_GREIGE_ORDER', 'TRIMS_NOT_ORDERED'],
    color: 'text-warning',
    bgColor: 'bg-warning/5',
    borderColor: 'border-warning/30',
  },
  {
    key: 'processing',
    title: 'Processing',
    stages: ['IN_PRINTING', 'IN_DYING'],
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 dark:bg-purple-950/20',
    borderColor: 'border-purple-200 dark:border-purple-800',
  },
  {
    key: 'manufacturing',
    title: 'Manufacturing',
    stages: ['IN_CUTTING', 'IN_EMBROIDERY', 'IN_SMOCKING', 'IN_STITCHING', 'IN_HANDWORK'],
    color: 'text-info',
    bgColor: 'bg-info/5',
    borderColor: 'border-info/30',
  },
  {
    key: 'finishing',
    title: 'Finishing',
    stages: ['IN_FINISHING'],
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 dark:bg-orange-950/20',
    borderColor: 'border-orange-200 dark:border-orange-800',
  },
  {
    key: 'dispatch',
    title: 'Ready / Shipped',
    stages: ['READY_TO_SHIP', 'SHIPPED', 'COMPLETED'],
    color: 'text-success',
    bgColor: 'bg-success/5',
    borderColor: 'border-success/30',
  },
];

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

function KanbanCard({ item, onClick }: { item: OrderStatusItem; onClick?: () => void }) {
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

  return (
    <Card
      className={cn(
        'p-3 cursor-pointer transition-all hover:shadow-md',
        item.isDelayed && 'border-l-4 border-l-destructive bg-destructive/5'
      )}
      onClick={() => {
        if (onClick) onClick();
        else navigate(`/styles/${item.styleId}`);
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-sm text-primary truncate">{item.orderNumber}</span>
            {item.isDelayed && <AlertCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />}
          </div>
          <p className="text-xs text-muted-foreground truncate">{item.customerName}</p>
        </div>
        <Badge
          variant="outline"
          className={cn(
            'text-[10px] px-1.5 py-0 flex-shrink-0',
            item.currentStage.includes('PENDING') || item.currentStage.includes('NOT_ORDERED')
              ? 'border-warning text-warning'
              : item.currentStage === 'COMPLETED' || item.currentStage === 'SHIPPED'
                ? 'border-success text-success'
                : 'border-info text-info'
          )}
        >
          {STAGE_SHORT_LABELS[item.currentStage] || item.currentStage}
        </Badge>
      </div>

      {/* Style Info */}
      <div className="mb-2">
        <p className="font-medium text-sm truncate">{item.styleCode}</p>
        {item.brandName && <span className="text-xs text-muted-foreground">{item.brandName}</span>}
      </div>

      {/* Metrics Row */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Package className="h-3 w-3" />
          <span>{item.quantity.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />
          <span>{formatCurrency(item.totalPrice)}</span>
        </div>
      </div>

      {/* Due Date */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
        <div className="flex items-center gap-1 text-xs">
          <Calendar className="h-3 w-3 text-muted-foreground" />
          <span className={item.isDelayed ? 'text-destructive font-medium' : 'text-muted-foreground'}>
            Due {formatDate(item.deliveryDate)}
          </span>
        </div>
        {item.blockers.length > 0 && (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
            {item.blockers.length} blocker{item.blockers.length > 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mt-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full',
                item.isDelayed
                  ? 'bg-destructive'
                  : item.overallProgress >= 80
                    ? 'bg-success'
                    : item.overallProgress >= 50
                      ? 'bg-info'
                      : 'bg-warning'
              )}
              style={{ width: `${item.overallProgress}%` }}
            />
          </div>
          <span className="text-[10px] font-medium text-muted-foreground">{item.overallProgress}%</span>
        </div>
      </div>
    </Card>
  );
}

export default function ProductionKanban({ items, onCardClick }: ProductionKanbanProps) {
  const getItemsForColumn = (column: KanbanColumn): OrderStatusItem[] => {
    return items.filter((item) => column.stages.includes(item.currentStage));
  };

  const getTotalValue = (columnItems: OrderStatusItem[]): string => {
    const total = columnItems.reduce((sum, item) => sum + item.totalPrice, 0);
    if (total >= 10000000) return `₹${(total / 10000000).toFixed(1)}Cr`;
    if (total >= 100000) return `₹${(total / 100000).toFixed(1)}L`;
    return `₹${Math.round(total / 1000)}K`;
  };

  const getTotalPieces = (columnItems: OrderStatusItem[]): number => {
    return columnItems.reduce((sum, item) => sum + item.quantity, 0);
  };

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-4 pb-4 min-w-max">
        {KANBAN_COLUMNS.map((column) => {
          const columnItems = getItemsForColumn(column);
          const delayedCount = columnItems.filter((i) => i.isDelayed).length;

          return (
            <div
              key={column.key}
              className={cn('flex flex-col w-[300px] rounded-lg border-2', column.borderColor, column.bgColor)}
            >
              {/* Column Header */}
              <div className="p-3 border-b border-border">
                <div className="flex items-center justify-between mb-1">
                  <h3 className={cn('font-semibold text-sm', column.color)}>{column.title}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {columnItems.length}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{getTotalPieces(columnItems).toLocaleString()} pcs</span>
                  <span>{getTotalValue(columnItems)}</span>
                  {delayedCount > 0 && <span className="text-destructive font-medium">{delayedCount} delayed</span>}
                </div>
              </div>

              {/* Cards */}
              <ScrollArea className="flex-1 max-h-[calc(100vh-400px)]">
                <div className="p-2 space-y-2">
                  {columnItems.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">No orders in this stage</div>
                  ) : (
                    columnItems.map((item) => (
                      <KanbanCard
                        key={item.orderItemId}
                        item={item}
                        onClick={onCardClick ? () => onCardClick(item) : undefined}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
