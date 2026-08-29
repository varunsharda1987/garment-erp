import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Send, MessageSquare, CheckCircle, RefreshCcw, Play } from 'lucide-react';
import { sampleService } from '@/services/sample.service';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import type { Sample, SampleStatus } from '@/types/sample.types';
import { cn } from '@/lib/utils';
import { MarkAsSentDialog } from '@/components/MarkAsSentDialog';
import { RecordFeedbackDialog } from '@/components/RecordFeedbackDialog';

interface SampleQuickActionBarProps {
  sample: Sample;
  onActionComplete: () => void;
  compact?: boolean;
}

export function SampleQuickActionBar({ sample, onActionComplete, compact = false }: SampleQuickActionBarProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);

  const handleQuickStatusUpdate = async (newStatus: SampleStatus, date?: Date) => {
    try {
      setIsUpdating(true);
      await sampleService.updateSample(sample.id, {
        status: newStatus,
        ...(newStatus === 'SUBMITTED' && date && { completionDate: date.toISOString() }),
      });
      handleApiSuccess('Status updated', `Sample marked as ${newStatus.replace(/_/g, ' ')}`);
      onActionComplete();
    } catch (err) {
      handleApiError(err, 'Failed to update status');
    } finally {
      setIsUpdating(false);
      setShowDatePicker(false);
    }
  };

  const handleCreateRevision = async () => {
    try {
      setIsUpdating(true);
      await sampleService.createRevision(sample.id);
      handleApiSuccess('Revision created', 'New sample version created');
      onActionComplete();
    } catch (err) {
      handleApiError(err, 'Failed to create revision');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSuccess = () => {
    onActionComplete();
  };

  const buttonSize = compact ? 'sm' : 'default';
  const iconSize = compact ? 'h-3 w-3' : 'h-4 w-4';

  switch (sample.status) {
    case 'REQUESTED':
      return (
        <Button
          size={buttonSize}
          variant="outline"
          onClick={() => handleQuickStatusUpdate('IN_PROGRESS')}
          disabled={isUpdating}
          className="gap-1"
        >
          <Play className={iconSize} />
          {!compact && 'Start Progress'}
        </Button>
      );

    case 'IN_PROGRESS':
      return (
        <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
          <PopoverTrigger asChild>
            <Button size={buttonSize} variant="outline" disabled={isUpdating} className="gap-1">
              <CheckCircle className={iconSize} />
              {!compact && 'Mark Complete'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <div className="p-3 border-b">
              <p className="text-sm font-medium">Completion Date</p>
              <p className="text-xs text-muted-foreground">When was this sample completed?</p>
            </div>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              initialFocus
            />
            <div className="p-3 border-t flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowDatePicker(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => handleQuickStatusUpdate('SUBMITTED', selectedDate)}
                disabled={isUpdating}
              >
                {isUpdating ? 'Saving...' : 'Mark Complete'}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      );

    case 'SUBMITTED':
      return (
        <>
          <Button
            size={buttonSize}
            variant="default"
            onClick={() => setSendDialogOpen(true)}
            disabled={isUpdating}
            className="gap-1"
          >
            <Send className={iconSize} />
            {!compact && 'Mark Sent'}
          </Button>
          <MarkAsSentDialog
            open={sendDialogOpen}
            onOpenChange={setSendDialogOpen}
            sampleId={sample.id}
            onSuccess={handleSuccess}
          />
        </>
      );

    case 'SENT':
    case 'FEEDBACK_PENDING':
      return (
        <>
          <Button
            size={buttonSize}
            variant="default"
            onClick={() => setFeedbackDialogOpen(true)}
            disabled={isUpdating}
            className="gap-1"
          >
            <MessageSquare className={iconSize} />
            {!compact && 'Record Feedback'}
          </Button>
          <RecordFeedbackDialog
            open={feedbackDialogOpen}
            onOpenChange={setFeedbackDialogOpen}
            sampleId={sample.id}
            sampleType={sample.sampleType}
            onSuccess={handleSuccess}
            onCreateRevision={handleCreateRevision}
          />
        </>
      );

    case 'REVISION_NEEDED':
      return (
        <Button
          size={buttonSize}
          variant="secondary"
          onClick={handleCreateRevision}
          disabled={isUpdating}
          className="gap-1"
        >
          <RefreshCcw className={iconSize} />
          {!compact && 'Create Revision'}
        </Button>
      );

    case 'APPROVED':
    case 'APPROVED_WITH_COMMENTS':
      return (
        <div className={cn('flex items-center gap-1 text-green-600', compact ? 'text-xs' : 'text-sm')}>
          <CheckCircle className={iconSize} />
          {!compact && 'Approved'}
        </div>
      );

    case 'REJECTED':
      return (
        <Button
          size={buttonSize}
          variant="secondary"
          onClick={handleCreateRevision}
          disabled={isUpdating}
          className="gap-1"
        >
          <RefreshCcw className={iconSize} />
          {!compact && 'Create Revision'}
        </Button>
      );

    default:
      return null;
  }
}
