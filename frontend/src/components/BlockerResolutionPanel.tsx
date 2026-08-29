import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Send, MessageSquare, Clock, CheckCircle, AlertCircle, RefreshCcw } from 'lucide-react';
import { sampleService } from '@/services/sample.service';
import { MarkAsSentDialog } from './MarkAsSentDialog';
import { RecordFeedbackDialog } from './RecordFeedbackDialog';
import { UpdateStatusDialog } from './UpdateStatusDialog';
import { SampleVersionBadge } from './SampleVersionBadge';
import { SampleSLABadge } from './SampleSLABadge';
import type { Sample, SampleStatus } from '@/types/sample.types';
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

  // Dialog states
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);

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

  const handleCreateRevision = async () => {
    if (!sample) return;
    try {
      await sampleService.createRevision(sample.id, { remarks: 'Revision created from blocker resolution' });
      handleSuccess();
    } catch (err) {
      // Error handled by the service
    }
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

  const getActionButton = (status: SampleStatus) => {
    switch (status) {
      case 'REQUESTED':
      case 'IN_PROGRESS':
        return (
          <Button size="sm" variant="outline" onClick={() => setStatusDialogOpen(true)} className="gap-1">
            <Clock className="h-3 w-3" />
            Update Status
          </Button>
        );
      case 'SUBMITTED':
        return (
          <Button size="sm" variant="default" onClick={() => setSendDialogOpen(true)} className="gap-1">
            <Send className="h-3 w-3" />
            Mark as Sent
          </Button>
        );
      case 'SENT':
      case 'FEEDBACK_PENDING':
        return (
          <Button size="sm" variant="default" onClick={() => setFeedbackDialogOpen(true)} className="gap-1">
            <MessageSquare className="h-3 w-3" />
            Record Feedback
          </Button>
        );
      case 'REVISION_NEEDED':
        return (
          <Button size="sm" variant="secondary" onClick={handleCreateRevision} className="gap-1">
            <RefreshCcw className="h-3 w-3" />
            Create Revision
          </Button>
        );
      case 'APPROVED':
      case 'APPROVED_WITH_COMMENTS':
        return (
          <div className="flex items-center gap-1 text-sm text-green-600">
            <CheckCircle className="h-4 w-4" />
            Approved
          </div>
        );
      default:
        return null;
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{sample.sampleNumber}</span>
          <SampleVersionBadge version={sample.version} sampleType={sample.sampleType} />
          <Badge className={SampleStatusColors[sample.status]}>
            {SampleStatusLabels[sample.status]}
          </Badge>
        </div>
        {getActionButton(sample.status)}

        <MarkAsSentDialog
          open={sendDialogOpen}
          onOpenChange={setSendDialogOpen}
          sampleId={sample.id}
          onSuccess={handleSuccess}
        />
        <RecordFeedbackDialog
          open={feedbackDialogOpen}
          onOpenChange={setFeedbackDialogOpen}
          sampleId={sample.id}
          sampleType={sample.sampleType}
          onSuccess={handleSuccess}
          onCreateRevision={handleCreateRevision}
        />
        <UpdateStatusDialog
          open={statusDialogOpen}
          onOpenChange={setStatusDialogOpen}
          sampleId={sample.id}
          currentStatus={sample.status}
          onSuccess={handleSuccess}
        />
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
              <Badge className={SampleStatusColors[sample.status]}>
                {SampleStatusLabels[sample.status]}
              </Badge>
              <SampleSLABadge slaStatus={sample.slaStatus} daysUntilDue={sample.daysUntilDue} />
            </div>
            {sample.style && (
              <p className="text-sm text-muted-foreground">
                {sample.style.buyerStyleRef || sample.style.styleCode}
                {sample.style.styleName && ` - ${sample.style.styleName}`}
              </p>
            )}
          </div>
          <div className="flex-shrink-0">{getActionButton(sample.status)}</div>
        </div>
      </CardContent>

      <MarkAsSentDialog
        open={sendDialogOpen}
        onOpenChange={setSendDialogOpen}
        sampleId={sample.id}
        onSuccess={handleSuccess}
      />
      <RecordFeedbackDialog
        open={feedbackDialogOpen}
        onOpenChange={setFeedbackDialogOpen}
        sampleId={sample.id}
        sampleType={sample.sampleType}
        onSuccess={handleSuccess}
        onCreateRevision={handleCreateRevision}
      />
      <UpdateStatusDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        sampleId={sample.id}
        currentStatus={sample.status}
        onSuccess={handleSuccess}
      />
    </Card>
  );
}
