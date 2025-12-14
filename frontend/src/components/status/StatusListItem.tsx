import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Calendar, Package, TrendingUp, AlertCircle } from 'lucide-react';
import type { ProductionStatusItem } from '@/types/productionStatus.types';
import StageProgressBar from './StageProgressBar';
import BlockerTags from './BlockerTags';
import QuickActions from './QuickActions';
import SampleStatusIndicator from './SampleStatusIndicator';

interface StatusListItemProps {
  item: ProductionStatusItem;
}

export default function StatusListItem({ item }: StatusListItemProps) {
  const navigate = useNavigate();

  const getStatusColorClass = () => {
    if (item.isDelayed) {
      return 'bg-red-50 border-red-500 hover:bg-red-100';
    }
    if (item.blockers.some((b) => b.severity === 'HIGH')) {
      return 'bg-orange-50 border-orange-500 hover:bg-orange-100';
    }
    if (item.blockers.length > 0) {
      return 'bg-amber-50 border-amber-500 hover:bg-amber-100';
    }
    if (item.currentStage === 'COMPLETED' || item.currentStage === 'SHIPPED') {
      return 'bg-green-50 border-green-500 hover:bg-green-100';
    }
    return 'bg-blue-50 border-blue-500 hover:bg-blue-100';
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
              className="w-[180px] h-[180px] object-cover rounded-lg border-2 border-gray-300 shadow-sm"
              loading="lazy"
            />
          ) : (
            <div className="w-[180px] h-[180px] bg-gray-100 rounded-lg border-2 border-gray-300 flex items-center justify-center">
              <Package className="h-16 w-16 text-gray-400" />
            </div>
          )}
        </div>

        {/* Main Content - Single column, full flow */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Row 1: Header with Status Badge */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-2xl font-bold text-gray-900">{item.styleCode}</h3>
                {item.internalCode && (
                  <span className="text-sm text-gray-500">• {item.internalCode}</span>
                )}
                {item.brandName && (
                  <span className="text-base font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                    {item.brandName}
                  </span>
                )}
              </div>
              {item.customerName && (
                <p className="text-base text-gray-700 font-medium mt-1">{item.customerName}</p>
              )}
              <p className="text-lg font-medium text-gray-800 mt-1">{item.styleName}</p>
              {item.season && (
                <p className="text-sm text-gray-500 mt-0.5">{item.season}</p>
              )}
            </div>

            {/* Status Badge */}
            <div className="flex-shrink-0">
              {item.isDelayed && (
                <div className="flex items-center gap-1.5 px-3 py-2 bg-red-100 border border-red-400 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <span className="text-sm font-bold text-red-700">
                    DELAYED {item.daysToDelivery !== null ? `${Math.abs(item.daysToDelivery)}d` : ''}
                  </span>
                </div>
              )}
              {item.daysToDelivery !== null && item.daysToDelivery > 0 && !item.isDelayed && (
                <span className="text-sm text-gray-500 font-medium">
                  Due in {item.daysToDelivery} days
                </span>
              )}
            </div>
          </div>

          {/* Row 2: Order Metrics - Horizontal */}
          <div className="flex items-center gap-8 text-base border-y border-gray-200 py-3">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-gray-500" />
              <span className="font-semibold text-gray-800">
                {item.orders.totalQuantity.toLocaleString()} pcs
              </span>
              {item.orders.orderCount > 1 && (
                <span className="text-gray-500 text-sm">({item.orders.orderCount} orders)</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-gray-500" />
              <span className="font-semibold text-gray-800">
                {formatCurrency(item.orders.totalValue)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-gray-500" />
              <span className="text-gray-700 font-medium">
                Due: {formatDate(item.orders.latestDeliveryDate)}
              </span>
            </div>
          </div>

          {/* Row 3: Stage Progress Bar */}
          <StageProgressBar
            currentStage={item.currentStage}
            stageBreakdown={item.stageBreakdown}
            overallProgress={item.overallProgress}
          />

          {/* Row 4: Blockers (if any) */}
          {item.blockers.length > 0 && <BlockerTags blockers={item.blockers} />}

          {/* Row 5: Bottom row - Additional Metrics + Quick Actions */}
          <div className="flex items-center justify-between gap-4 pt-2 border-t border-gray-200">
            <div className="flex items-center gap-6 text-sm text-gray-600">
              <div>
                CAD: <span className="font-semibold text-gray-800">{item.cadStatus}</span>
              </div>
              {item.costing && (
                <div>
                  Margin:{' '}
                  <span className="font-semibold text-gray-800">
                    {item.costing.profitMargin !== null
                      ? `${item.costing.profitMargin.toFixed(1)}%`
                      : 'N/A'}
                  </span>
                </div>
              )}
              {item.workOrders.workOrderCount > 0 && (
                <div>
                  Work Orders:{' '}
                  <span className="font-semibold text-gray-800">
                    {item.workOrders.totalCompletedQuantity.toLocaleString()} /{' '}
                    {item.workOrders.totalPlannedQuantity.toLocaleString()}
                  </span>
                </div>
              )}
              <div>
                Materials:{' '}
                <span className="font-semibold text-gray-800">
                  {item.materialStatus.fabricsOrdered ? '✓' : '✗'} Fabric{' '}
                  {item.materialStatus.trimsOrdered ? '✓' : '✗'} Trims
                </span>
              </div>
            </div>

            {/* Quick Actions */}
            {item.suggestedActions.length > 0 && (
              <QuickActions actions={item.suggestedActions} />
            )}
          </div>

          {/* Row 6: Sample Status and QC (if applicable) */}
          {(item.sampleStatus.fitSample.exists ||
            item.sampleStatus.ppSample.exists ||
            item.sampleStatus.sizeSetSample.exists ||
            item.sampleStatus.shipmentSample.exists ||
            item.inspectionStatus.fabricInspection.completed ||
            item.inspectionStatus.inlineQC.completed ||
            item.inspectionStatus.finalQC.completed) && (
            <div className="flex items-center gap-4 text-sm pt-2 border-t border-gray-200">
              <SampleStatusIndicator sampleStatus={item.sampleStatus} />

              {/* QC Status */}
              {(item.inspectionStatus.fabricInspection.completed ||
                item.inspectionStatus.inlineQC.completed ||
                item.inspectionStatus.finalQC.completed) && (
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="font-medium">QC:</span>
                  {item.inspectionStatus.fabricInspection.completed && (
                    <span className={item.inspectionStatus.fabricInspection.status === 'PASS' ? 'text-green-600' : 'text-red-600'}>
                      {item.inspectionStatus.fabricInspection.status === 'PASS' ? '✓' : '✗'} Fabric
                    </span>
                  )}
                  {item.inspectionStatus.inlineQC.completed && (
                    <span className={item.inspectionStatus.inlineQC.status === 'PASS' ? 'text-green-600' : 'text-red-600'}>
                      {item.inspectionStatus.inlineQC.status === 'PASS' ? '✓' : '✗'} Inline
                    </span>
                  )}
                  {item.inspectionStatus.finalQC.completed && (
                    <span className={item.inspectionStatus.finalQC.status === 'PASS' ? 'text-green-600' : 'text-red-600'}>
                      {item.inspectionStatus.finalQC.status === 'PASS' ? '✓' : '✗'} Final
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
