import { useState } from 'react';
import { ProductionStage } from '@/types/style.types';
import { CheckCircle, Circle, Loader2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

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

interface InspectionInfo {
  completed: boolean;
  status: 'PASS' | 'FAIL' | 'PENDING' | null;
}

interface InspectionStatus {
  fabricInspection: InspectionInfo;
  inlineQC: InspectionInfo;
  finalQC: InspectionInfo;
}

interface CompactProgressBarProps {
  currentStage: ProductionStage;
  overallProgress: number;
  sampleStatus?: SampleStatus;
  inspectionStatus?: InspectionStatus;
  isDelayed?: boolean;
}

type PhaseKey = 'preProduction' | 'processing' | 'manufacturing' | 'finishing' | 'dispatch';

interface Phase {
  key: PhaseKey;
  label: string;
  stages: ProductionStage[];
  sampleKeys?: (keyof SampleStatus)[];
  inspectionKeys?: (keyof InspectionStatus)[];
}

const PHASES: Phase[] = [
  {
    key: 'preProduction',
    label: 'Pre-Production',
    stages: ['ORDER_RECEIVED', 'PENDING_COSTING', 'PENDING_GREIGE_ORDER', 'TRIMS_NOT_ORDERED'],
    sampleKeys: ['fitSample', 'ppSample'],
  },
  {
    key: 'processing',
    label: 'Processing',
    stages: ['IN_PRINTING', 'IN_DYING'],
    inspectionKeys: ['fabricInspection'],
  },
  {
    key: 'manufacturing',
    label: 'Manufacturing',
    stages: ['IN_CUTTING', 'IN_EMBROIDERY', 'IN_SMOCKING', 'IN_STITCHING', 'IN_HANDWORK'],
    sampleKeys: ['sizeSetSample'],
    inspectionKeys: ['inlineQC'],
  },
  {
    key: 'finishing',
    label: 'Finishing',
    stages: ['IN_FINISHING'],
    inspectionKeys: ['finalQC'],
  },
  {
    key: 'dispatch',
    label: 'Dispatch',
    stages: ['READY_TO_SHIP', 'SHIPPED', 'COMPLETED'],
    sampleKeys: ['shipmentSample'],
  },
];

const STAGE_LABELS: Record<ProductionStage, string> = {
  ORDER_RECEIVED: 'Order Received',
  PENDING_COSTING: 'Pending Costing',
  PENDING_GREIGE_ORDER: 'Pending Greige',
  TRIMS_NOT_ORDERED: 'Trims Not Ordered',
  IN_PRINTING: 'Printing',
  IN_DYING: 'Dying',
  IN_EMBROIDERY: 'Embroidery',
  IN_SMOCKING: 'Smocking',
  IN_HANDWORK: 'Handwork',
  IN_CUTTING: 'Cutting',
  IN_STITCHING: 'Stitching',
  IN_FINISHING: 'Finishing',
  READY_TO_SHIP: 'Ready to Ship',
  SHIPPED: 'Shipped',
  COMPLETED: 'Completed',
};

export default function CompactProgressBar({
  currentStage,
  overallProgress,
  sampleStatus,
  inspectionStatus,
  isDelayed,
}: CompactProgressBarProps) {
  const [expandedPhase, setExpandedPhase] = useState<PhaseKey | null>(null);

  const getCurrentPhaseIndex = (): number => {
    for (let i = 0; i < PHASES.length; i++) {
      if (PHASES[i].stages.includes(currentStage)) {
        return i;
      }
    }
    return 0;
  };

  const currentPhaseIndex = getCurrentPhaseIndex();

  const getPhaseStatus = (phaseIndex: number): 'completed' | 'active' | 'blocked' | 'pending' => {
    if (phaseIndex < currentPhaseIndex) return 'completed';
    if (phaseIndex === currentPhaseIndex) {
      if (['PENDING_COSTING', 'PENDING_GREIGE_ORDER', 'TRIMS_NOT_ORDERED'].includes(currentStage)) {
        return 'blocked';
      }
      return 'active';
    }
    return 'pending';
  };

  const getSampleStatus = (sampleKey: keyof SampleStatus): 'pass' | 'fail' | 'pending' | 'none' => {
    if (!sampleStatus) return 'none';
    const sample = sampleStatus[sampleKey];
    if (!sample.exists) return 'none';
    if (['APPROVED', 'APPROVED_WITH_COMMENTS'].includes(sample.status || '')) return 'pass';
    if (sample.status === 'REJECTED') return 'fail';
    return 'pending';
  };

  const getInspectionStatus = (inspectionKey: keyof InspectionStatus): 'pass' | 'fail' | 'pending' | 'none' => {
    if (!inspectionStatus) return 'none';
    const inspection = inspectionStatus[inspectionKey];
    if (!inspection.completed) return 'none';
    if (inspection.status === 'PASS') return 'pass';
    if (inspection.status === 'FAIL') return 'fail';
    return 'pending';
  };

  const getPhaseIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-success" />;
      case 'active':
        return <Loader2 className="h-5 w-5 text-info animate-spin" />;
      case 'blocked':
        return <AlertCircle className="h-5 w-5 text-warning" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground/40" />;
    }
  };

  const getPhaseStyle = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-success/10 border-success/30 text-success';
      case 'active':
        return 'bg-info/10 border-info/30 text-info';
      case 'blocked':
        return 'bg-warning/10 border-warning/30 text-warning';
      default:
        return 'bg-muted border-border text-muted-foreground';
    }
  };

  const togglePhase = (key: PhaseKey) => {
    setExpandedPhase(expandedPhase === key ? null : key);
  };

  return (
    <div className="space-y-3">
      {/* Compact Phase Progress */}
      <div className="flex items-center gap-2">
        {PHASES.map((phase, index) => {
          const status = getPhaseStatus(index);
          const isExpanded = expandedPhase === phase.key;
          const isLast = index === PHASES.length - 1;

          return (
            <div key={phase.key} className="flex items-center flex-1">
              <button
                onClick={() => togglePhase(phase.key)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg border transition-all w-full',
                  'hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-info/20',
                  getPhaseStyle(status)
                )}
              >
                {getPhaseIcon(status)}
                <span className="text-sm font-medium truncate">{phase.label}</span>
                {(phase.sampleKeys?.length || phase.inspectionKeys?.length) &&
                  (isExpanded ? (
                    <ChevronUp className="h-4 w-4 ml-auto flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 ml-auto flex-shrink-0" />
                  ))}
              </button>
              {!isLast && (
                <div
                  className={cn('w-4 h-0.5 mx-1 flex-shrink-0', status === 'completed' ? 'bg-success/30' : 'bg-border')}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Expanded Phase Details */}
      {expandedPhase && (
        <div className="bg-card rounded-lg border border-border p-3 animate-in slide-in-from-top-2 duration-200">
          {PHASES.filter((p) => p.key === expandedPhase).map((phase) => (
            <div key={phase.key} className="space-y-3">
              {/* Stages in this phase */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">STAGES</p>
                <div className="flex flex-wrap gap-2">
                  {phase.stages.map((stage) => {
                    const isCurrentStage = stage === currentStage;
                    const stageIndex = phase.stages.indexOf(stage);
                    const currentStageInPhase = phase.stages.indexOf(currentStage);
                    const isCompleted = currentStageInPhase > stageIndex || currentPhaseIndex > PHASES.indexOf(phase);

                    return (
                      <span
                        key={stage}
                        className={cn(
                          'px-2 py-1 rounded text-xs font-medium border',
                          isCurrentStage
                            ? 'bg-info/10 border-info/30 text-info'
                            : isCompleted
                              ? 'bg-success/10 border-success/30 text-success'
                              : 'bg-muted border-border text-muted-foreground'
                        )}
                      >
                        {isCompleted && <CheckCircle className="h-3 w-3 inline mr-1" />}
                        {isCurrentStage && <Loader2 className="h-3 w-3 inline mr-1 animate-spin" />}
                        {STAGE_LABELS[stage]}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Samples in this phase */}
              {phase.sampleKeys && phase.sampleKeys.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">SAMPLES</p>
                  <div className="flex flex-wrap gap-2">
                    {phase.sampleKeys.map((sampleKey) => {
                      const status = getSampleStatus(sampleKey);
                      const labels: Record<keyof SampleStatus, string> = {
                        fitSample: 'FIT Sample',
                        ppSample: 'PP Sample',
                        sizeSetSample: 'Size Set',
                        shipmentSample: 'Shipment',
                      };
                      return (
                        <span
                          key={sampleKey}
                          className={cn(
                            'px-2 py-1 rounded text-xs font-medium border',
                            status === 'pass'
                              ? 'bg-success/10 border-success/30 text-success'
                              : status === 'fail'
                                ? 'bg-destructive/10 border-destructive/30 text-destructive'
                                : status === 'pending'
                                  ? 'bg-warning/10 border-warning/30 text-warning'
                                  : 'bg-muted border-border text-muted-foreground'
                          )}
                        >
                          {status === 'pass' && '✓ '}
                          {status === 'fail' && '✗ '}
                          {status === 'pending' && '⏳ '}
                          {labels[sampleKey]}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Inspections in this phase */}
              {phase.inspectionKeys && phase.inspectionKeys.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">QC CHECKS</p>
                  <div className="flex flex-wrap gap-2">
                    {phase.inspectionKeys.map((inspectionKey) => {
                      const status = getInspectionStatus(inspectionKey);
                      const labels: Record<keyof InspectionStatus, string> = {
                        fabricInspection: 'Fabric QC',
                        inlineQC: 'Inline QC',
                        finalQC: 'Final QC',
                      };
                      return (
                        <span
                          key={inspectionKey}
                          className={cn(
                            'px-2 py-1 rounded text-xs font-medium border',
                            status === 'pass'
                              ? 'bg-success/10 border-success/30 text-success'
                              : status === 'fail'
                                ? 'bg-destructive/10 border-destructive/30 text-destructive'
                                : status === 'pending'
                                  ? 'bg-warning/10 border-warning/30 text-warning'
                                  : 'bg-muted border-border text-muted-foreground'
                          )}
                        >
                          {status === 'pass' && '✓ '}
                          {status === 'fail' && '✗ '}
                          {status === 'pending' && '⏳ '}
                          {labels[inspectionKey]}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Progress Bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              isDelayed
                ? 'bg-destructive'
                : overallProgress >= 80
                  ? 'bg-success'
                  : overallProgress >= 50
                    ? 'bg-info'
                    : overallProgress >= 25
                      ? 'bg-warning'
                      : 'bg-muted-foreground'
            )}
            style={{ width: `${overallProgress}%` }}
          />
        </div>
        <span
          className={cn(
            'text-sm font-bold min-w-[3rem] text-right',
            isDelayed ? 'text-destructive' : 'text-foreground'
          )}
        >
          {overallProgress}%
        </span>
      </div>
    </div>
  );
}
