import { ProductionStage } from '@/types/style.types';
import { CheckCircle, Circle, Loader2, AlertCircle } from 'lucide-react';

interface StageProgressBarProps {
  currentStage: ProductionStage;
  stageBreakdown: {
    ordersReceived: number;
    pendingCosting: number;
    pendingGreige: number;
    trimsNotOrdered: number;
    inPrinting: number;
    inDying: number;
    inEmbroidery: number;
    inHandwork: number;
    inCutting: number;
    inStitching: number;
    inFinishing: number;
    readyToShip: number;
    shipped: number;
    completed: number;
  };
  overallProgress: number;
}

const STAGE_ORDER: { stage: ProductionStage; label: string }[] = [
  { stage: 'ORDER_RECEIVED', label: 'Order' },
  { stage: 'PENDING_COSTING', label: 'Costing' },
  { stage: 'PENDING_GREIGE_ORDER', label: 'Greige' },
  { stage: 'TRIMS_NOT_ORDERED', label: 'Trims' },
  { stage: 'IN_PRINTING', label: 'Printing' },
  { stage: 'IN_DYING', label: 'Dying' },
  { stage: 'IN_CUTTING', label: 'Cutting' },
  { stage: 'IN_STITCHING', label: 'Stitching' },
  { stage: 'IN_FINISHING', label: 'Finishing' },
  { stage: 'READY_TO_SHIP', label: 'Ready' },
  { stage: 'SHIPPED', label: 'Shipped' },
];

export default function StageProgressBar({
  currentStage,
  stageBreakdown,
  overallProgress,
}: StageProgressBarProps) {
  const currentStageIndex = STAGE_ORDER.findIndex((s) => s.stage === currentStage);

  const getStageStatus = (index: number, stage: ProductionStage): 'completed' | 'active' | 'blocked' | 'pending' => {
    if (index < currentStageIndex) return 'completed';
    if (index === currentStageIndex) {
      // Check if blocked (in pending stages for too long)
      if (
        stage === 'PENDING_COSTING' ||
        stage === 'PENDING_GREIGE_ORDER' ||
        stage === 'TRIMS_NOT_ORDERED'
      ) {
        return 'blocked';
      }
      return 'active';
    }
    return 'pending';
  };

  const getStageIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'active':
        return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
      case 'blocked':
        return <AlertCircle className="h-4 w-4 text-amber-600" />;
      default:
        return <Circle className="h-4 w-4 text-gray-300" />;
    }
  };

  return (
    <div className="space-y-3">
      {/* Stage Timeline */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {STAGE_ORDER.map((stageInfo, index) => {
          const status = getStageStatus(index, stageInfo.stage);
          const isLast = index === STAGE_ORDER.length - 1;

          return (
            <div key={stageInfo.stage} className="flex items-center gap-2 flex-shrink-0">
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1">
                  {getStageIcon(status)}
                  <span
                    className={`text-xs font-medium whitespace-nowrap ${
                      status === 'completed'
                        ? 'text-green-600'
                        : status === 'active'
                        ? 'text-blue-600'
                        : status === 'blocked'
                        ? 'text-amber-600'
                        : 'text-gray-400'
                    }`}
                  >
                    {stageInfo.label}
                  </span>
                </div>
              </div>
              {!isLast && (
                <div
                  className={`h-0.5 w-6 ${
                    status === 'completed' ? 'bg-green-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Progress Bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600">Overall Progress</span>
          <span className="font-semibold text-gray-900">{overallProgress}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
