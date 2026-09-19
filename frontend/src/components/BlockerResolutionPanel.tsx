import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, AlertCircle } from 'lucide-react';
import { sampleService } from '@/services/sample.service';
import { SampleActionMenu } from './samples/SampleActionMenu';
import { SampleVersionBadge } from './SampleVersionBadge';
import { SampleSLABadge } from './SampleSLABadge';
import type { Sample } from '@/types/sample.types';
import { SampleStatusLabels, SampleStatusColors } from '@/types/sample.types';

interface BlockerResolutionPanelProps {
  sampleId: string;
  onResolved?: () => void;
  compact?: boolean;
}

export function BlockerResolutionPanel({ sampleId, onResolved, compact = false }: BlockerResolutionPanelProps) {
  const [sample, setSample] = useState<Sample | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSample();
  }, [sampleId]);

  const fetchSample = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await sampleService.getSampleById(sampleId);
      setSample(data);
    } catch (err) {
      setError('Failed to load sample');
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = () => {
    fetchSample();
    onResolved?.();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4 animate-pulse" />
        Loading sample...
      </div>
    );
  }

  if (error || !sample) {
    return (
      <div className="flex items-center gap-2 text-sm text-destructive">
        <AlertCircle className="h-4 w-4" />
        {error || 'Sample not found'}
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{sample.sampleNumber}</span>
          <SampleVersionBadge version={sample.version} sampleType={sample.sampleType} />
          <Badge className={SampleStatusColors[sample.status]}>{SampleStatusLabels[sample.status]}</Badge>
        </div>
        <SampleActionMenu sample={sample} onActionComplete={handleSuccess} />
      </div>
    );
  }

  return (
    <Card className="border-dashed">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{sample.sampleNumber}</span>
              <SampleVersionBadge version={sample.version} sampleType={sample.sampleType} />
              <Badge className={SampleStatusColors[sample.status]}>{SampleStatusLabels[sample.status]}</Badge>
              <SampleSLABadge slaStatus={sample.slaStatus} daysUntilDue={sample.daysUntilDue} />
            </div>
            {sample.style && (
              <p className="text-sm text-muted-foreground">
                {sample.style.buyerStyleRef || sample.style.styleCode}
                {sample.style.styleName && ` - ${sample.style.styleName}`}
              </p>
            )}
          </div>
          <div className="flex-shrink-0">
            <SampleActionMenu sample={sample} onActionComplete={handleSuccess} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
