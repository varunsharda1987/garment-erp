import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Calendar,
  Package,
  TrendingUp,
  AlertCircle,
  ShoppingCart,
  RefreshCw,
  Ruler,
  Settings,
  PlayCircle,
} from 'lucide-react';
import type { OrderStatusItem } from '@/types/orderProductionStatus.types';
import StageProgressBar from './StageProgressBar';
import EnhancedBlockerCard from '../production/EnhancedBlockerCard';
import QuickActions from './QuickActions';
import ProductionTrackingInlineForm from '@/components/production/ProductionTrackingInlineForm';
import { useAuthStore } from '@/stores/auth.store';

interface OrderStatusListItemProps {
  item: OrderStatusItem;
  onSelectCad?: (orderItemId: string, cadId: string, recalculate: boolean) => void;
  onUpdateInheritance?: (
    orderItemId: string,
    data: { inheritStyleSamples?: boolean; inheritInspections?: boolean }
  ) => void;
  onRecalculateCosting?: (orderItemId: string) => void;
  onRefresh?: () => void;
  latestWorkOrderId?: string;
}

export default function OrderStatusListItem({
  item,
  onSelectCad,
  onUpdateInheritance,
  onRecalculateCosting,
  onRefresh,
  latestWorkOrderId,
}: OrderStatusListItemProps) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [showSettings, setShowSettings] = useState(false);
  const [showTrackingForm, setShowTrackingForm] = useState(false);

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

  const handleCadChange = (cadId: string) => {
    if (onSelectCad) {
      onSelectCad(item.orderItemId, cadId, true); // Auto-recalculate costing
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on interactive elements
    if ((e.target as HTMLElement).closest('button, select, [role="combobox"], [role="switch"]')) {
      return;
    }
    navigate(`/styles/${item.styleId}`);
  };

  return (
    <Card className={`p-5 border-2 transition-all cursor-pointer ${getStatusColorClass()}`} onClick={handleCardClick}>
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
          {/* Row 1: Header with Order Info */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Order Number - Prominent */}
              <div className="flex items-center gap-3 mb-2">
                <div className="flex items-center gap-2 bg-primary/10 px-3 py-1 rounded-lg">
                  <ShoppingCart className="h-4 w-4 text-primary" />
                  <span className="text-lg font-bold text-primary">{item.orderNumber}</span>
                </div>
                {item.customerName && (
                  <span className="text-base font-medium text-foreground">{item.customerName}</span>
                )}
              </div>

              {/* Style Info */}
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl font-bold text-foreground">{item.styleCode}</h3>
                {item.internalCode && <span className="text-sm text-muted-foreground">• {item.internalCode}</span>}
                {item.brandName && (
                  <span className="text-base font-semibold text-info bg-info-muted px-2 py-0.5 rounded">
                    {item.brandName}
                  </span>
                )}
              </div>
              <p className="text-lg font-medium text-foreground mt-1">{item.styleName}</p>
              {item.season && <p className="text-sm text-muted-foreground mt-0.5">{item.season}</p>}
            </div>

            {/* Status Badge & Settings Toggle */}
            <div className="flex-shrink-0 flex flex-col items-end gap-2">
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

              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSettings(!showSettings);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <Settings className="h-4 w-4 mr-1" />
                Settings
              </Button>
            </div>
          </div>

          {/* Row 2: Order Metrics - Horizontal */}
          <div className="flex items-center gap-8 text-base border-y border-border py-3">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-muted-foreground" />
              <span className="font-semibold text-foreground">{item.quantity.toLocaleString()} pcs</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              <span className="font-semibold text-foreground">{formatCurrency(item.totalPrice)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <span className="text-foreground font-medium">Order: {formatDate(item.orderDate)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <span className="text-foreground font-medium">Due: {formatDate(item.deliveryDate)}</span>
            </div>
          </div>

          {/* Row 3: CAD Selection (if available widths exist) */}
          {item.availableCadWidths.length > 0 && (
            <div className="flex items-center gap-4 bg-muted rounded-lg p-3">
              <Ruler className="h-5 w-5 text-muted-foreground" />
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-foreground">CAD Width:</span>
                <Select value={item.selectedCadId || ''} onValueChange={handleCadChange}>
                  <SelectTrigger className="w-[200px] h-8" onClick={(e) => e.stopPropagation()}>
                    <SelectValue placeholder="Select CAD width" />
                  </SelectTrigger>
                  <SelectContent>
                    {item.availableCadWidths.map((cad) => (
                      <SelectItem key={cad.id} value={cad.id}>
                        {cad.cutableWidth}" width
                        {cad.cadMeters ? ` (${cad.cadMeters.toFixed(3)}m)` : ''}
                        {cad.isPreferred && ' ★'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {item.selectedCadId && onRecalculateCosting && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRecalculateCosting(item.orderItemId);
                    }}
                    className="h-8"
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Recalculate
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Row 4: Settings Panel (collapsible) */}
          {showSettings && (
            <div className="bg-muted rounded-lg p-4 border border-border">
              <h4 className="text-sm font-semibold text-foreground mb-3">Order Settings</h4>
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-2">
                  <Switch
                    id={`sample-inherit-${item.orderItemId}`}
                    checked={item.sampleInheritance === 'STYLE'}
                    onCheckedChange={(checked) => {
                      onUpdateInheritance?.(item.orderItemId, {
                        inheritStyleSamples: checked,
                      });
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <Label htmlFor={`sample-inherit-${item.orderItemId}`} className="text-sm text-muted-foreground">
                    Inherit samples from style
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id={`inspection-inherit-${item.orderItemId}`}
                    checked={item.inspectionInheritance === 'STYLE'}
                    onCheckedChange={(checked) => {
                      onUpdateInheritance?.(item.orderItemId, {
                        inheritInspections: checked,
                      });
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <Label htmlFor={`inspection-inherit-${item.orderItemId}`} className="text-sm text-muted-foreground">
                    Inherit inspections from style
                  </Label>
                </div>
              </div>
            </div>
          )}

          {/* Row 5: Stage Progress Bar with Samples and Inspections */}
          <StageProgressBar
            currentStage={item.currentStage}
            stageBreakdown={item.stageBreakdown}
            overallProgress={item.overallProgress}
            sampleStatus={item.sampleStatus}
            inspectionStatus={item.inspectionStatus}
          />

          {/* Row 6: Blockers (if any) */}
          {item.blockers.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-destructive/100"></span>
                Production Blockers ({item.blockers.length})
              </h4>
              <div className="space-y-2">
                {item.blockers.map((blocker, index) => (
                  <EnhancedBlockerCard
                    key={`${item.orderItemId}-blocker-${index}`}
                    blocker={blocker}
                    orderItemId={item.orderItemId}
                    onResolve={() => onRefresh?.()}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Row 6.5: Production Tracking Form (if shown) */}
          {showTrackingForm && latestWorkOrderId && (
            <div className="bg-card border border-border rounded-lg p-4">
              <h4 className="text-sm font-semibold text-foreground mb-3">Update Production Stage</h4>
              <ProductionTrackingInlineForm
                workOrderId={latestWorkOrderId}
                currentStage={item.currentStage}
                orderItemId={item.orderItemId}
                totalQuantity={item.quantity}
                onSuccess={() => {
                  setShowTrackingForm(false);
                  onRefresh?.();
                }}
                onCancel={() => setShowTrackingForm(false)}
              />
            </div>
          )}

          {/* Row 7: Bottom Metrics Grid - Full width utilization */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t border-border">
            {/* CAD Status */}
            <div className="bg-muted rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">CAD Status</div>
              <div
                className={`text-sm font-semibold ${
                  item.cadStatus === 'APPROVED' || item.cadStatus === 'SELECTED' ? 'text-success' : 'text-warning'
                }`}
              >
                {item.cadStatus}
              </div>
              {item.selectedCadWidth && (
                <div className="text-xs text-muted-foreground mt-1">Width: {item.selectedCadWidth}"</div>
              )}
            </div>

            {/* Costing & Margin */}
            <div className="bg-muted rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">
                Costing {item.costing?.isRecalculated && <span className="text-info">(Order)</span>}
              </div>
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
                {item.workOrders.workOrderCount} order
                {item.workOrders.workOrderCount !== 1 ? 's' : ''}
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

          {/* Row 8: Quick Actions */}
          <div className="pt-3 border-t border-border flex items-center justify-between">
            {/* Update Stage Button (for Production Managers and Admins) */}
            {user?.role && ['ADMIN', 'PRODUCTION_MANAGER'].includes(user.role) && latestWorkOrderId && (
              <Button
                size="sm"
                variant={showTrackingForm ? 'secondary' : 'outline'}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTrackingForm(!showTrackingForm);
                }}
              >
                <PlayCircle className="h-4 w-4 mr-1" />
                {showTrackingForm ? 'Hide' : 'Update Stage'}
              </Button>
            )}

            {/* Suggested Actions */}
            {item.suggestedActions.length > 0 && <QuickActions actions={item.suggestedActions} />}
          </div>
        </div>
      </div>
    </Card>
  );
}
