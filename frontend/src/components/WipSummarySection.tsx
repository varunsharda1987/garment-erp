import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowRight, Scissors, Shirt, CheckSquare, Package } from 'lucide-react';
import { handleApiError } from '@/lib/api-error-handler';
import workOrderService from '@/services/workOrder.service';
import type { WipSummary } from '@/types/production.types';

interface WipSummarySectionProps {
  workOrderId: string;
}

function StageCard({
  icon: Icon,
  title,
  color,
  received,
  produced,
  defects,
  wip,
  total,
}: {
  icon: React.ElementType;
  title: string;
  color: string;
  received: number;
  produced: number;
  defects: number;
  wip: number;
  total: number;
}) {
  const progressPercent = total > 0 ? Math.min(100, Math.round((produced / total) * 100)) : 0;
  return (
    <div className="border rounded-lg p-4 space-y-2 flex-1 min-w-[140px]">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="font-medium text-sm">{title}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <span className="text-gray-500">In:</span>
        <span className="font-medium text-right">{received.toLocaleString()}</span>
        <span className="text-gray-500">Done:</span>
        <span className="font-medium text-right text-green-600">{produced.toLocaleString()}</span>
        <span className="text-gray-500">WIP:</span>
        <span className="font-semibold text-right text-orange-600">{wip.toLocaleString()}</span>
        {defects > 0 && (
          <>
            <span className="text-gray-500">Defects:</span>
            <span className="font-medium text-right text-red-600">{defects.toLocaleString()}</span>
          </>
        )}
      </div>
      <div className="w-full bg-gray-200 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full ${color.replace('text-', 'bg-')}`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <span className="text-xs text-gray-400">{progressPercent}% complete</span>
    </div>
  );
}

function TransferArrow({ issued, pending }: { issued: number; pending: number }) {
  return (
    <div className="flex flex-col items-center justify-center px-1 min-w-[50px]">
      <ArrowRight className="h-4 w-4 text-gray-400" />
      <span className="text-xs text-gray-500 font-medium">{issued.toLocaleString()}</span>
      {pending > 0 && <span className="text-xs text-amber-500">{pending} pending</span>}
    </div>
  );
}

export default function WipSummarySection({ workOrderId }: WipSummarySectionProps) {
  const [data, setData] = useState<WipSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const result = await workOrderService.getWipSummary(workOrderId);
        setData(result);
      } catch (err) {
        console.error('Failed to load WIP summary:', err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [workOrderId]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400 mr-2" />
          <span className="text-gray-500 text-sm">Loading WIP...</span>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  // Don't show if nothing has started
  const hasActivity = data.cutting.planned > 0 || data.stitching.received > 0 || data.finishing.received > 0;
  if (!hasActivity) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Package className="h-5 w-5 text-gray-600" />
          WIP Inventory — Production Pipeline
        </CardTitle>
        <p className="text-sm text-gray-500">
          Order: {data.orderQty.toLocaleString()} pcs — track pieces through each production stage
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex items-stretch gap-1 overflow-x-auto pb-2">
          <StageCard
            icon={Scissors}
            title="Cutting"
            color="text-orange-500"
            received={data.cutting.planned}
            produced={data.cutting.completed}
            defects={data.cutting.defects}
            wip={data.cutting.wip}
            total={data.cutting.planned}
          />
          <TransferArrow issued={data.cuttingToStitching.issued} pending={data.cuttingToStitching.pending} />
          <StageCard
            icon={Shirt}
            title="Stitching"
            color="text-blue-500"
            received={data.stitching.received}
            produced={data.stitching.produced}
            defects={data.stitching.defects}
            wip={data.stitching.wip}
            total={data.stitching.received}
          />
          <TransferArrow issued={data.stitchingToFinishing.issued} pending={data.stitchingToFinishing.pending} />
          <StageCard
            icon={CheckSquare}
            title="Finishing"
            color="text-green-500"
            received={data.finishing.received}
            produced={data.finishing.produced}
            defects={data.finishing.defects}
            wip={data.finishing.wip}
            total={data.finishing.received}
          />
          <TransferArrow issued={data.finishingToDispatch.issued} pending={data.finishingToDispatch.pending} />
          <div className="flex flex-col items-center justify-center border rounded-lg p-4 min-w-[80px]">
            <Package className="h-5 w-5 text-purple-500 mb-1" />
            <span className="text-xs font-medium">Dispatch</span>
            <span className="text-lg font-bold text-purple-600">
              {data.finishingToDispatch.issued.toLocaleString()}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
