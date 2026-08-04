import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CheckCircle2, AlertCircle, XCircle, Loader2, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { getStockPreview } from '@/services/saleOrder.service';
import type { StockPreviewItem, StockStatus } from '@/types/saleOrder.types';

interface SmartConfirmDialogProps {
  saleOrderId: string;
  saleOrderNumber: string;
  totalAmount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isConfirming: boolean;
}

const STATUS_CONFIG: Record<StockStatus, { icon: React.ReactNode; color: string; label: string }> = {
  FULL: {
    icon: <CheckCircle2 className="h-4 w-4 text-success" />,
    color: 'bg-success-muted text-success',
    label: 'In Stock',
  },
  PARTIAL: {
    icon: <AlertCircle className="h-4 w-4 text-warning" />,
    color: 'bg-warning/10 text-warning',
    label: 'Partial',
  },
  NONE: {
    icon: <XCircle className="h-4 w-4 text-destructive" />,
    color: 'bg-destructive/10 text-destructive',
    label: 'No Stock',
  },
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
}

function StyleReadinessChecklist({ item }: { item: StockPreviewItem }) {
  if (!item.styleReadiness || item.status === 'FULL') return null;

  const { styleReadiness } = item;
  const checks = [
    {
      key: 'status',
      label: styleReadiness.status === 'ACTIVE' ? 'Style is ACTIVE' : `Style is ${styleReadiness.status}`,
      passed: styleReadiness.status === 'ACTIVE',
      action: 'Activate Style',
    },
    {
      key: 'components',
      label: styleReadiness.hasComponents ? 'Components defined' : 'No components',
      passed: styleReadiness.hasComponents,
      action: 'Add Components',
    },
    {
      key: 'fabrics',
      label: styleReadiness.hasFabrics ? 'Fabrics assigned' : 'No fabrics',
      passed: styleReadiness.hasFabrics,
      action: 'Add Fabrics',
    },
    {
      key: 'sizes',
      label: styleReadiness.hasSizes ? 'Sizes defined' : 'No sizes',
      passed: styleReadiness.hasSizes,
      action: 'Add Sizes',
    },
    {
      key: 'variants',
      label: styleReadiness.hasVariants ? 'SKU variants created' : 'No variants',
      passed: styleReadiness.hasVariants,
      action: 'Add Variants',
    },
  ];

  return (
    <div className="mt-2 space-y-1 text-xs">
      {checks.map((check) => (
        <div key={check.key} className="flex items-center gap-2">
          {check.passed ? (
            <CheckCircle2 className="h-3 w-3 text-success" />
          ) : (
            <XCircle className="h-3 w-3 text-destructive" />
          )}
          <span className={check.passed ? 'text-muted-foreground' : 'text-destructive'}>{check.label}</span>
          {!check.passed && item.style && (
            <Link
              to={`/styles/${item.style.id}`}
              className="ml-auto text-primary hover:underline flex items-center gap-1"
            >
              {check.action}
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
      ))}
      {styleReadiness.isReady ? (
        <div className="flex items-center gap-2 mt-2 text-success font-medium">
          <CheckCircle2 className="h-3 w-3" />
          Ready for production
        </div>
      ) : (
        <div className="flex items-center gap-2 mt-2 text-warning font-medium">
          <AlertCircle className="h-3 w-3" />
          Complete style setup first
        </div>
      )}
    </div>
  );
}

export function SmartConfirmDialog({
  saleOrderId,
  saleOrderNumber,
  totalAmount,
  open,
  onOpenChange,
  onConfirm,
  isConfirming,
}: SmartConfirmDialogProps) {
  const {
    data: preview,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['stock-preview', saleOrderId],
    queryFn: () => getStockPreview(saleOrderId),
    enabled: open,
    staleTime: 0,
  });

  const getActionGuidance = () => {
    if (!preview) return '';
    switch (preview.recommendedAction) {
      case 'ALLOCATE_ALL':
        return 'All items can be allocated from finished goods stock.';
      case 'START_PRODUCTION':
        return 'No items have stock. Complete style setup (if needed), then create Work Orders.';
      case 'MIXED':
        return 'Some items can be allocated from stock; others need production.';
      default:
        return '';
    }
  };

  // Group items by status for display
  const groupedItems = preview
    ? {
        full: preview.items.filter((i) => i.status === 'FULL'),
        partial: preview.items.filter((i) => i.status === 'PARTIAL'),
        none: preview.items.filter((i) => i.status === 'NONE'),
      }
    : { full: [], partial: [], none: [] };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Confirm Sale Order {saleOrderNumber}?</DialogTitle>
          <DialogDescription>
            Review stock availability before confirming this order for {formatCurrency(totalAmount)}.
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Checking stock availability...</span>
          </div>
        )}

        {error && (
          <div className="py-4 text-center text-destructive">Failed to check stock availability. Please try again.</div>
        )}

        {preview && (
          <>
            {/* Summary Banner */}
            <div className="space-y-2 rounded-lg border p-4 bg-muted/30">
              {preview.summary.itemsWithStock > 0 && (
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="font-medium">
                    {preview.summary.itemsWithStock} item{preview.summary.itemsWithStock > 1 ? 's' : ''} ready
                  </span>
                  <span className="text-muted-foreground">
                    ({preview.summary.quantityAvailable} pcs) - can allocate from stock
                  </span>
                </div>
              )}
              {preview.summary.itemsPartialStock > 0 && (
                <div className="flex items-center gap-2 text-warning">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">
                    {preview.summary.itemsPartialStock} item{preview.summary.itemsPartialStock > 1 ? 's' : ''} partial
                  </span>
                  <span className="text-muted-foreground">- some stock available</span>
                </div>
              )}
              {preview.summary.itemsNoStock > 0 && (
                <div className="flex items-center gap-2 text-destructive">
                  <XCircle className="h-4 w-4" />
                  <span className="font-medium">
                    {preview.summary.itemsNoStock} item{preview.summary.itemsNoStock > 1 ? 's' : ''} need production
                  </span>
                  <span className="text-muted-foreground">({preview.summary.quantityNeedsProduction} pcs)</span>
                </div>
              )}
            </div>

            {/* Items needing attention (PARTIAL or NONE) */}
            {(groupedItems.partial.length > 0 || groupedItems.none.length > 0) && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-medium mb-2">Items needing production:</h4>
                  <ScrollArea className="max-h-[280px] pr-4">
                    <div className="space-y-3">
                      {[...groupedItems.partial, ...groupedItems.none].map((item) => {
                        // buyerStyleRef arrives with the saleOrder stock-preview fix;
                        // StockPreviewItem.style does not declare it yet, so read it defensively.
                        const buyerRef = (item.style as { buyerStyleRef?: string | null } | null)?.buyerStyleRef;
                        return (
                          <div key={item.id} className="rounded-lg border p-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="font-mono text-sm font-medium">
                                  {item.style?.styleCode || 'Unknown'}
                                  {buyerRef && (
                                    <span className="ml-1 font-sans text-xs text-muted-foreground">({buyerRef})</span>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground">{item.style?.styleName}</div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {item.color?.colorName || 'No color'} / {item.size?.sizeName || 'No size'}
                                </div>
                              </div>
                              <div className="text-right">
                                <Badge className={STATUS_CONFIG[item.status].color} variant="secondary">
                                  {STATUS_CONFIG[item.status].label}
                                </Badge>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {item.availableQty} / {item.orderedQty} pcs
                                </div>
                                {item.shortfall > 0 && (
                                  <div className="text-xs text-destructive font-medium">
                                    Shortfall: {item.shortfall} pcs
                                  </div>
                                )}
                              </div>
                            </div>
                            <StyleReadinessChecklist item={item} />
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              </>
            )}

            {/* Items with full stock (collapsible/summary) */}
            {groupedItems.full.length > 0 && (
              <>
                <Separator />
                <div className="text-sm text-muted-foreground">
                  <span className="text-success font-medium">
                    {groupedItems.full.length} item{groupedItems.full.length > 1 ? 's' : ''}
                  </span>{' '}
                  fully available in stock and ready to allocate.
                </div>
              </>
            )}

            {/* Action Guidance */}
            <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
              <strong>Next steps:</strong> {getActionGuidance()}
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isConfirming}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isConfirming || isLoading}>
            {isConfirming ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Confirming...
              </>
            ) : (
              `Confirm ${formatCurrency(totalAmount)}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
