import { ProductionStage } from '@/types/style.types';
import { CheckCircle, Circle, Loader2, AlertCircle, XCircle } from 'lucide-react';

// Sample status type
interface SampleInfo {
  exists: boolean;
  status: string | null;
  daysPending: number | null;
  sampleId: string | null;
}

interface SampleStatus {
  fitSample: SampleInfo;
  ppSample: SampleInfo;
  sizeSetSample: SampleInfo;
  shipmentSample: SampleInfo;
}

// Inspection status type
interface InspectionInfo {
  completed: boolean;
  status: 'PASS' | 'FAIL' | 'PENDING' | null;
}

interface InspectionStatus {
  fabricInspection: InspectionInfo;
  inlineQC: InspectionInfo;
  finalQC: InspectionInfo;
}

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
  sampleStatus?: SampleStatus;
  inspectionStatus?: InspectionStatus;
}

// Combined stage type - includes production stages, sample stages, and inspection stages
type StageType = 'production' | 'sample' | 'inspection';

interface StageItem {
  key: string;
  label: string;
  type: StageType;
  stage?: ProductionStage;
  sampleKey?: keyof SampleStatus;
  inspectionKey?: keyof InspectionStatus;
}

// Full workflow order with samples and inspections integrated
const FULL_STAGE_ORDER: StageItem[] = [
  { key: 'ORDER_RECEIVED', label: 'Order', type: 'production', stage: 'ORDER_RECEIVED' },
  { key: 'PENDING_COSTING', label: 'Costing', type: 'production', stage: 'PENDING_COSTING' },
  { key: 'FIT_SAMPLE', label: 'FIT Sample', type: 'sample', sampleKey: 'fitSample' },
  { key: 'PENDING_GREIGE_ORDER', label: 'Greige', type: 'production', stage: 'PENDING_GREIGE_ORDER' },
  { key: 'TRIMS_NOT_ORDERED', label: 'Trims', type: 'production', stage: 'TRIMS_NOT_ORDERED' },
  { key: 'PP_SAMPLE', label: 'PP Sample', type: 'sample', sampleKey: 'ppSample' },
  { key: 'FABRIC_QC', label: 'Fabric QC', type: 'inspection', inspectionKey: 'fabricInspection' },
  { key: 'IN_PRINTING', label: 'Printing', type: 'production', stage: 'IN_PRINTING' },
  { key: 'IN_DYING', label: 'Dying', type: 'production', stage: 'IN_DYING' },
  { key: 'SIZE_SET_SAMPLE', label: 'Size Set', type: 'sample', sampleKey: 'sizeSetSample' },
  { key: 'IN_CUTTING', label: 'Cutting', type: 'production', stage: 'IN_CUTTING' },
  { key: 'IN_STITCHING', label: 'Stitching', type: 'production', stage: 'IN_STITCHING' },
  { key: 'INLINE_QC', label: 'Inline QC', type: 'inspection', inspectionKey: 'inlineQC' },
  { key: 'IN_FINISHING', label: 'Finishing', type: 'production', stage: 'IN_FINISHING' },
  { key: 'FINAL_QC', label: 'Final QC', type: 'inspection', inspectionKey: 'finalQC' },
  { key: 'SHIPMENT_SAMPLE', label: 'Shipment', type: 'sample', sampleKey: 'shipmentSample' },
  { key: 'READY_TO_SHIP', label: 'Ready', type: 'production', stage: 'READY_TO_SHIP' },
  { key: 'SHIPPED', label: 'Shipped', type: 'production', stage: 'SHIPPED' },
];

export default function StageProgressBar({
  currentStage,
  overallProgress,
  sampleStatus,
  inspectionStatus,
}: StageProgressBarProps) {
  // Find current production stage index (only among production stages)
  const productionStages = FULL_STAGE_ORDER.filter((s) => s.type === 'production');
  const currentStageIndex = productionStages.findIndex((s) => s.stage === currentStage);

  const getProductionStageStatus = (stageItem: StageItem): 'completed' | 'active' | 'blocked' | 'pending' => {
    const prodIndex = productionStages.findIndex((s) => s.key === stageItem.key);

    if (prodIndex < currentStageIndex) return 'completed';
    if (prodIndex === currentStageIndex) {
      if (
        stageItem.stage === 'PENDING_COSTING' ||
        stageItem.stage === 'PENDING_GREIGE_ORDER' ||
        stageItem.stage === 'TRIMS_NOT_ORDERED'
      ) {
        return 'blocked';
      }
      return 'active';
    }
    return 'pending';
  };

  const getSampleStageStatus = (
    sampleKey: keyof SampleStatus
  ): 'completed' | 'active' | 'blocked' | 'pending' | 'rejected' => {
    if (!sampleStatus) return 'pending';

    const sample = sampleStatus[sampleKey];
    if (!sample.exists) return 'pending';

    switch (sample.status) {
      case 'APPROVED':
      case 'APPROVED_WITH_COMMENTS':
        return 'completed';
      case 'REJECTED':
        return 'rejected';
      case 'SUBMITTED':
      case 'SENT':
      case 'FEEDBACK_PENDING':
      case 'REVISION_NEEDED':
      case 'IN_PROGRESS':
        return 'active';
      default:
        return sample.exists ? 'blocked' : 'pending';
    }
  };

  const getInspectionStageStatus = (
    inspectionKey: keyof InspectionStatus
  ): 'completed' | 'active' | 'blocked' | 'pending' | 'rejected' => {
    if (!inspectionStatus) return 'pending';

    const inspection = inspectionStatus[inspectionKey];
    if (!inspection.completed) return 'pending';

    switch (inspection.status) {
      case 'PASS':
        return 'completed';
      case 'FAIL':
        return 'rejected';
      case 'PENDING':
        return 'active';
      default:
        return 'pending';
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getStageIcon = (status: string, _type: StageType) => {
    const size = 'h-5 w-5';
    switch (status) {
      case 'completed':
        return <CheckCircle className={`${size} text-green-600`} />;
      case 'active':
        return <Loader2 className={`${size} text-blue-600 animate-spin`} />;
      case 'blocked':
        return <AlertCircle className={`${size} text-amber-600`} />;
      case 'rejected':
        return <XCircle className={`${size} text-red-600`} />;
      default:
        return <Circle className={`${size} text-gray-300`} />;
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-700';
      case 'active':
        return 'text-blue-700';
      case 'blocked':
        return 'text-amber-700';
      case 'rejected':
        return 'text-red-700';
      default:
        return 'text-gray-400';
    }
  };

  const getStageBackgroundColor = (status: string, type: StageType) => {
    if (type === 'sample') {
      switch (status) {
        case 'completed':
          return 'bg-green-100 border-green-300';
        case 'active':
          return 'bg-blue-100 border-blue-300';
        case 'blocked':
          return 'bg-amber-100 border-amber-300';
        case 'rejected':
          return 'bg-red-100 border-red-300';
        default:
          return 'bg-purple-50 border-purple-200';
      }
    }
    if (type === 'inspection') {
      switch (status) {
        case 'completed':
          return 'bg-green-100 border-green-300';
        case 'active':
          return 'bg-blue-100 border-blue-300';
        case 'rejected':
          return 'bg-red-100 border-red-300';
        default:
          return 'bg-orange-50 border-orange-200';
      }
    }
    return '';
  };

  const getConnectorColor = (status: string) => {
    return status === 'completed' ? 'bg-green-500' : 'bg-gray-200';
  };

  const getStageStatus = (stageItem: StageItem) => {
    if (stageItem.type === 'production') {
      return getProductionStageStatus(stageItem);
    } else if (stageItem.type === 'sample') {
      return getSampleStageStatus(stageItem.sampleKey!);
    } else {
      return getInspectionStageStatus(stageItem.inspectionKey!);
    }
  };

  return (
    <div className="space-y-4">
      {/* Stage Timeline - Expanded and Full Width */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between gap-1 overflow-x-auto">
          {FULL_STAGE_ORDER.map((stageItem, index) => {
            const status = getStageStatus(stageItem);
            const isLast = index === FULL_STAGE_ORDER.length - 1;
            const isSample = stageItem.type === 'sample';
            const isInspection = stageItem.type === 'inspection';
            const isSpecial = isSample || isInspection;

            return (
              <div key={stageItem.key} className="flex items-center flex-1 min-w-0">
                {/* Stage Node */}
                <div
                  className={`flex flex-col items-center justify-center flex-shrink-0 ${
                    isSpecial ? `rounded-lg px-2 py-1.5 border ${getStageBackgroundColor(status, stageItem.type)}` : ''
                  }`}
                  title={stageItem.label}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    {getStageIcon(status, stageItem.type)}
                    <span className={`text-[11px] font-semibold whitespace-nowrap ${getStatusTextColor(status)}`}>
                      {stageItem.label}
                    </span>
                    {isSpecial && (
                      <span className={`text-[9px] ${isSample ? 'text-purple-500' : 'text-orange-500'}`}>
                        {isSample ? 'Sample' : 'QC'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Connector Line */}
                {!isLast && (
                  <div className="flex-1 min-w-[8px] mx-1">
                    <div className={`h-1 rounded-full ${getConnectorColor(status)}`} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Progress Bar - Larger */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Overall Progress</span>
          <span className="text-lg font-bold text-gray-900">{overallProgress}%</span>
        </div>
        <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              overallProgress >= 80
                ? 'bg-gradient-to-r from-green-500 to-green-600'
                : overallProgress >= 50
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600'
                  : overallProgress >= 25
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600'
                    : 'bg-gradient-to-r from-gray-400 to-gray-500'
            }`}
            style={{ width: `${overallProgress}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-500">
          <span>Pre-Production</span>
          <span>Fabric Processing</span>
          <span>Manufacturing</span>
          <span>Dispatch</span>
        </div>
      </div>
    </div>
  );
}
