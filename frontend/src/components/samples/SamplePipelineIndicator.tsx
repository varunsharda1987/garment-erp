import { CheckCircle, Circle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Sample, SampleType, SampleStatus } from '@/types/sample.types';
import { cn } from '@/lib/utils';

interface SamplePipelineIndicatorProps {
  samples: Sample[];
  compact?: boolean;
}

const PIPELINE_ORDER: SampleType[] = ['FIT_SAMPLE', 'PP_SAMPLE', 'SIZE_SET_SAMPLE'];

const SAMPLE_LABELS: Record<SampleType, string> = {
  FIT_SAMPLE: 'FIT',
  PP_SAMPLE: 'PP',
  SIZE_SET_SAMPLE: 'SIZE_SET',
  PHOTO_SAMPLE: 'PHOTO',
  PRODUCTION_SAMPLE: 'PROD',
  SHIPMENT_SAMPLE: 'SHIP',
};

type PipelineStatus = 'approved' | 'in_progress' | 'not_started' | 'rejected';

function getSamplePipelineStatus(sample: Sample | undefined): PipelineStatus {
  if (!sample) return 'not_started';

  const approvedStatuses: SampleStatus[] = ['APPROVED', 'APPROVED_WITH_COMMENTS'];
  const rejectedStatuses: SampleStatus[] = ['REJECTED'];

  if (approvedStatuses.includes(sample.status)) return 'approved';
  if (rejectedStatuses.includes(sample.status)) return 'rejected';
  return 'in_progress';
}

function getStatusIcon(status: PipelineStatus) {
  switch (status) {
    case 'approved':
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case 'in_progress':
      return <Clock className="h-4 w-4 text-yellow-600" />;
    case 'rejected':
      return <Circle className="h-4 w-4 text-red-600 fill-red-600" />;
    case 'not_started':
    default:
      return <Circle className="h-4 w-4 text-muted-foreground" />;
  }
}

function getStatusBadgeClass(status: PipelineStatus): string {
  switch (status) {
    case 'approved':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'in_progress':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'rejected':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'not_started':
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

export function SamplePipelineIndicator({ samples, compact = false }: SamplePipelineIndicatorProps) {
  const sampleMap = new Map(samples.map((s) => [s.sampleType, s]));

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {PIPELINE_ORDER.map((type, index) => {
          const sample = sampleMap.get(type);
          const status = getSamplePipelineStatus(sample);

          return (
            <div key={type} className="flex items-center">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-help">{getStatusIcon(status)}</div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {SAMPLE_LABELS[type]}: {sample ? sample.status.replace(/_/g, ' ') : 'Not Created'}
                      {sample?.version && sample.version > 1 && ` (v${sample.version})`}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {index < PIPELINE_ORDER.length - 1 && <span className="mx-0.5 text-muted-foreground">→</span>}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {PIPELINE_ORDER.map((type, index) => {
        const sample = sampleMap.get(type);
        const status = getSamplePipelineStatus(sample);

        return (
          <div key={type} className="flex items-center">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className={cn('gap-1 cursor-help', getStatusBadgeClass(status))}>
                    {getStatusIcon(status)}
                    <span>
                      {SAMPLE_LABELS[type]}
                      {sample?.version && sample.version > 1 && ` v${sample.version}`}
                    </span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {sample ? (
                      <>
                        {sample.sampleNumber} - {sample.status.replace(/_/g, ' ')}
                      </>
                    ) : (
                      'Not Created'
                    )}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {index < PIPELINE_ORDER.length - 1 && <span className="mx-1 text-muted-foreground">→</span>}
          </div>
        );
      })}
    </div>
  );
}
