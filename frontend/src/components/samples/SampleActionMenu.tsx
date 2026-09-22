import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Send, MessageSquare, CheckCircle, RefreshCcw, Play, MoreHorizontal } from 'lucide-react';
import { sampleService } from '@/services/sample.service';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import type { Sample, SampleStatus } from '@/types/sample.types';
import { isVersionedSampleType } from '@/types/sample.types';
import { cn } from '@/lib/utils';
import ConfirmDialog from '@/components/ConfirmDialog';
import { MarkAsSentDialog } from '@/components/MarkAsSentDialog';
import { RecordFeedbackDialog } from '@/components/RecordFeedbackDialog';

type SentDetails = { sentDate: string; courierMode: string; trackingNumber: string };

interface SampleActionMenuProps {
  sample: Sample;
  /** Refetch after any action succeeds. */
  onActionComplete: () => void;
  /** Page-specific items (View / Edit / Delete) appended below the status action. */
  extraItems?: ReactNode;
  align?: 'start' | 'end';
  /** Fires after a successful Mark Sent with the shipping details entered. */
  onMarkedSent?: (details: SentDetails) => void;
  /** Overrides the default refresh when a revision is created. */
  onRevisionCreated?: (revision: Sample) => void;
}

export function SampleActionMenu({
  sample,
  onActionComplete,
  extraItems,
  align = 'end',
  onMarkedSent,
  onRevisionCreated,
}: SampleActionMenuProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [completionDate, setCompletionDate] = useState<Date>(new Date());
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [startConfirmOpen, setStartConfirmOpen] = useState(false);
  const [revisionConfirmOpen, setRevisionConfirmOpen] = useState(false);

  const updateStatus = async (status: SampleStatus, completedOn?: Date) => {
    try {
      setIsUpdating(true);
      await sampleService.updateSample(sample.id, {
        status,
        ...(status === 'SUBMITTED' && completedOn && { completionDate: completedOn.toISOString() }),
      });
      handleApiSuccess('Status updated', `Sample marked as ${status.replace(/_/g, ' ').toLowerCase()}`);
      onActionComplete();
    } catch (err) {
      handleApiError(err, 'Failed to update status');
    } finally {
      setIsUpdating(false);
      setCompleteDialogOpen(false);
    }
  };

  const createRevision = async () => {
    try {
      setIsUpdating(true);
      const revision = await sampleService.createRevision(sample.id);
      handleApiSuccess('Revision created', `New version ${revision.sampleNumber} created.`);
      if (onRevisionCreated) onRevisionCreated(revision);
      else onActionComplete();
    } catch (err) {
      handleApiError(err, 'Failed to create revision');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSent = (details: SentDetails) => {
    onActionComplete();
    onMarkedSent?.(details);
  };

  const canRevise = isVersionedSampleType(sample.sampleType);
  const isApproved = sample.status === 'APPROVED' || sample.status === 'APPROVED_WITH_COMMENTS';

  const statusItem = (() => {
    switch (sample.status) {
      case 'REQUESTED':
        return (
          <DropdownMenuItem onSelect={() => setStartConfirmOpen(true)} disabled={isUpdating}>
            <Play className="h-4 w-4 mr-2" />
            Start Progress
          </DropdownMenuItem>
        );
      case 'IN_PROGRESS':
        return (
          <DropdownMenuItem onSelect={() => setCompleteDialogOpen(true)} disabled={isUpdating}>
            <CheckCircle className="h-4 w-4 mr-2" />
            Mark Complete
          </DropdownMenuItem>
        );
      case 'SUBMITTED':
        return (
          <DropdownMenuItem onSelect={() => setSendDialogOpen(true)} disabled={isUpdating}>
            <Send className="h-4 w-4 mr-2" />
            Mark Sent
          </DropdownMenuItem>
        );
      case 'SENT':
      case 'FEEDBACK_PENDING':
        return (
          <DropdownMenuItem onSelect={() => setFeedbackDialogOpen(true)} disabled={isUpdating}>
            <MessageSquare className="h-4 w-4 mr-2" />
            Record Feedback
          </DropdownMenuItem>
        );
      case 'REJECTED':
      case 'REVISION_NEEDED':
        return canRevise ? (
          <DropdownMenuItem onSelect={() => setRevisionConfirmOpen(true)} disabled={isUpdating}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Create Revision
          </DropdownMenuItem>
        ) : null;
      default:
        return null;
    }
  })();

  // Nothing actionable and no page-specific items: show the terminal state instead of an empty menu.
  if (!statusItem && !extraItems) {
    return isApproved ? (
      <div className="flex items-center gap-1 text-sm text-green-600">
        <CheckCircle className="h-4 w-4" />
        Approved
      </div>
    ) : null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" disabled={isUpdating} aria-label="Sample actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        {/* The menu is portalled but its events still bubble the React tree into
            DataTable's onRowClick — without this, every item navigates instead. */}
        <DropdownMenuContent align={align} onClick={(e) => e.stopPropagation()}>
          {statusItem}
          {statusItem && extraItems && <DropdownMenuSeparator />}
          {extraItems}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={startConfirmOpen}
        onOpenChange={setStartConfirmOpen}
        title="Start progress on this sample?"
        description={`${sample.sampleNumber} will be marked as being made. You can change the status again later.`}
        confirmText="Start Progress"
        onConfirm={() => updateStatus('IN_PROGRESS')}
        isLoading={isUpdating}
      />

      <ConfirmDialog
        open={revisionConfirmOpen}
        onOpenChange={setRevisionConfirmOpen}
        title="Create a new revision?"
        description={`This creates version ${(sample.version || 1) + 1} of ${sample.sampleNumber}. The current version stays on record.`}
        confirmText="Create Revision"
        onConfirm={createRevision}
        isLoading={isUpdating}
      />

      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent className="sm:max-w-fit">
          <DialogHeader>
            <DialogTitle>Mark Sample Complete</DialogTitle>
            <DialogDescription>When was {sample.sampleNumber} completed?</DialogDescription>
          </DialogHeader>
          <Calendar
            mode="single"
            selected={completionDate}
            onSelect={(date) => date && setCompletionDate(date)}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDialogOpen(false)} disabled={isUpdating}>
              Cancel
            </Button>
            <Button onClick={() => updateStatus('SUBMITTED', completionDate)} disabled={isUpdating}>
              <CheckCircle className={cn('h-4 w-4 mr-2')} />
              {isUpdating ? 'Saving...' : 'Mark Complete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MarkAsSentDialog
        open={sendDialogOpen}
        onOpenChange={setSendDialogOpen}
        sampleId={sample.id}
        onSuccess={handleSent}
      />

      <RecordFeedbackDialog
        open={feedbackDialogOpen}
        onOpenChange={setFeedbackDialogOpen}
        sampleId={sample.id}
        sampleType={sample.sampleType}
        onSuccess={onActionComplete}
        onCreateRevision={createRevision}
      />
    </>
  );
}
