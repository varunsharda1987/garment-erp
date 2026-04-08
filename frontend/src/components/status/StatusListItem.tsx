import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Calendar, Package, TrendingUp, AlertCircle } from 'lucide-react';
import type { ProductionStatusItem } from '@/types/productionStatus.types';
import StageProgressBar from './StageProgressBar';
import BlockerTags from './BlockerTags';
import QuickActions from './QuickActions';

interface StatusListItemProps {
  item: ProductionStatusItem;
}

export default function StatusListItem({ item }: StatusListItemProps) {
  const navigate = useNavigate();

  const getStatusColorClass = () => {
    if (item.isDelayed) {
      return 'bg-destructive/10 border-destructive hover:bg-destructive/10';
    }
    if (item.blockers.some((b) => b.severity === 'HIGH')) {
      return 'bg-primary/10 border-primary hover:bg-primary/15';
    }
    if (item.blockers.length > 0) {
      return 'bg-warning-muted border-warning hover:bg-warning/10';
    }
    if (item.currentStage === 'COMPLETED' || item.currentStage === 'SHIPPED') {
      return 'bg-success-muted border-success hover:bg-success-muted';
    }
    return 'bg-info-muted border-info hover:bg-info-muted';
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatCurrency = (value: number) => {
    if (value >= 10000000) {
      return `₹${(value / 10000000).toFixed(2)} Cr`;
    }
    if (value >= 100000) {
      return `₹${(value / 100000).toFixed(2)} L`;
    }
    return `₹${value.toLocaleString()}`;
  };

  return (
    <Card
      className={`p-5 border-2 transition-all cursor-pointer ${getStatusColorClass()}`}
      onClick={() => navigate(`/styles/${item.styleId}`)}
    >
      <div className="flex gap-6">
        {/* Image Section - 180x180px */}
        <div className="flex-shrink-0">
          {item.imageUrl ? (
            <img
              src={`http://localhost:5000${item.imageUrl}`}
              alt={item.styleName}
              className="w-[180px] h-[180px] object-cover rounded-lg border-2 border-border shadow-sm"
              loading="lazy"
            />
          ) : (
            <div className="w-[180px] h-[180px] bg-muted rounded-lg border-2 border-border flex items-center justify-center">
              <Package className="h-16 w-16 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Main Content - Single column, full flow */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Row 1: Header with Status Badge */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-2xl font-bold text-foreground">{item.styleCode}</h3>
                {item.internalCode && <span className="text-sm text-muted-foreground">• {item.internalCode}</span>}
                {item.brandName && (
                  <span className="text-base font-semibold text-info bg-info-muted px-2 py-0.5 rounded">
                    {item.brandName}
                  </span>
                )}
              </div>
              {item.customerName && <p className="text-base text-foreground font-medium mt-1">{item.customerName}</p>}
              <p className="text-lg font-medium text-foreground mt-1">{item.styleName}</p>
              {item.season && <p className="text-sm text-muted-foreground mt-0.5">{item.season}</p>}
            </div>

            {/* Status Badge */}
            <div className="flex-shrink-0">
              {item.isDelayed && (
                <div className="flex items-center gap-1.5 px-3 py-2 bg-destructive/10 border border-destructive/30 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <span className="text-sm font-bold text-destructive">
                    DELAYED {item.daysToDelivery !== null ? `${Math.abs(item.daysToDelivery)}d` : ''}
                  </span>
                </div>
              )}
              {item.daysToDelivery !== null && item.daysToDelivery > 0 && !item.isDelayed && (
                <span className="text-sm text-muted-foreground font-medium">Due in {item.daysToDelivery} days</span>
              )}
            </div>
          </div>

          {/* Row 2: Order Metrics - Horizontal */}
          <div className="flex items-center gap-8 text-base border-y border-border py-3">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-muted-foreground" />
              <span className="font-semibold text-foreground">{item.orders.totalQuantity.toLocaleString()} pcs</span>
              {item.orders.orderCount > 1 && (
                <span className="text-muted-foreground text-sm">({item.orders.orderCount} orders)</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              <span className="font-semibold text-foreground">{formatCurrency(item.orders.totalValue)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <span className="text-foreground font-medium">Due: {formatDate(item.orders.latestDeliveryDate)}</span>
            </div>
          </div>

          {/* Row 3: Stage Progress Bar with Samples and Inspections */}
          <StageProgressBar
            currentStage={item.currentStage}
            stageBreakdown={item.stageBreakdown}
            overallProgress={item.overallProgress}
            sampleStatus={item.sampleStatus}
            inspectionStatus={item.inspectionStatus}
          />

          {/* Row 4: Blockers (if any) */}
          {item.blockers.length > 0 && <BlockerTags blockers={item.blockers} />}

          {/* Row 5: Bottom Metrics Grid - Full width utilization */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t border-border">
            {/* CAD Status */}
            <div className="bg-muted rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">CAD Status</div>
              <div
                className={`text-sm font-semibold ${
                  item.cadStatus === 'APPROVED'
                    ? 'text-success'
                    : item.cadStatus === 'IN_PROGRESS'
                      ? 'text-info'
                      : 'text-warning'
                }`}
              >
                {item.cadStatus}
              </div>
              {item.approvedCadDate && (
                <div className="text-xs text-muted-foreground mt-1">Approved: {formatDate(item.approvedCadDate)}</div>
              )}
            </div>

            {/* Costing & Margin */}
            <div className="bg-muted rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Costing</div>
              {item.costing ? (
                <>
                  <div className="text-sm font-semibold text-foreground">
                    {item.costing.totalCostPerPiece !== null
                      ? `₹${item.costing.totalCostPerPiece.toFixed(2)}/pc`
                      : 'N/A'}
                  </div>
                  <div
                    className={`text-xs mt-1 ${
                      item.costing.profitMargin !== null && item.costing.profitMargin >= 15
                        ? 'text-success'
                        : item.costing.profitMargin !== null && item.costing.profitMargin >= 10
                          ? 'text-warning'
                          : 'text-destructive'
                    }`}
                  >
                    Margin: {item.costing.profitMargin !== null ? `${item.costing.profitMargin.toFixed(1)}%` : 'N/A'}
                  </div>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">Not set</div>
              )}
            </div>

            {/* Work Orders */}
            <div className="bg-muted rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Work Orders</div>
              <div className="text-sm font-semibold text-foreground">
                {item.workOrders.totalCompletedQuantity.toLocaleString()} /{' '}
                {item.workOrders.totalPlannedQuantity.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {item.workOrders.workOrderCount} order{item.workOrders.workOrderCount !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Materials Status */}
            <div className="bg-muted rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Materials</div>
              <div className="flex items-center gap-3 text-sm">
                <span className={item.materialStatus.fabricsOrdered ? 'text-success' : 'text-destructive'}>
                  {item.materialStatus.fabricsOrdered ? '✓' : '✗'} Fabric
                </span>
                <span className={item.materialStatus.trimsOrdered ? 'text-success' : 'text-destructive'}>
                  {item.materialStatus.trimsOrdered ? '✓' : '✗'} Trims
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                <span>Rcvd: {item.materialStatus.fabricsReceived ? '✓' : '✗'}</span>
                <span>Rcvd: {item.materialStatus.trimsReceived ? '✓' : '✗'}</span>
              </div>
            </div>
          </div>

          {/* Row 6: Quick Actions */}
          {item.suggestedActions.length > 0 && (
            <div className="pt-3 border-t border-border flex justify-end">
              <QuickActions actions={item.suggestedActions} />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
