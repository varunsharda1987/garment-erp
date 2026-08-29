import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquare, RefreshCcw } from 'lucide-react';
import { sampleService } from '@/services/sample.service';
import { handleApiSuccess, handleApiError } from '@/lib/api-error-handler';

type FeedbackStatus = 'APPROVED' | 'REJECTED' | 'REVISION_NEEDED' | 'APPROVED_WITH_COMMENTS';

interface RecordFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sampleId: string;
  sampleType: string;
  onSuccess?: () => void;
  onCreateRevision?: () => void;
}

export function RecordFeedbackDialog({
  open,
  onOpenChange,
  sampleId,
  sampleType,
  onSuccess,
  onCreateRevision,
}: RecordFeedbackDialogProps) {
  const [form, setForm] = useState({
    status: 'APPROVED' as FeedbackStatus,
    feedback: '',
    measurementComments: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const VERSIONED_TYPES = ['FIT_SAMPLE', 'PP_SAMPLE', 'SIZE_SET_SAMPLE'];
  const canCreateRevision = VERSIONED_TYPES.includes(sampleType) && form.status === 'REVISION_NEEDED';

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      await sampleService.recordFeedback(sampleId, {
        status: form.status,
        customerFeedback: form.feedback,
        measurementComments: form.measurementComments,
      });
      handleApiSuccess('Feedback recorded', 'Buyer feedback has been saved.');
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      handleApiError(err, 'Failed to record feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveAndCreateRevision = async () => {
    try {
      setIsSubmitting(true);
      await sampleService.recordFeedback(sampleId, {
        status: form.status,
        customerFeedback: form.feedback,
        measurementComments: form.measurementComments,
      });
      handleApiSuccess('Feedback recorded', 'Creating revision...');
      onOpenChange(false);
      onCreateRevision?.();
    } catch (err) {
      handleApiError(err, 'Failed to record feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Buyer Feedback</DialogTitle>
          <DialogDescription>Enter the buyer's response to this sample</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => setForm({ ...form, status: v as FeedbackStatus })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="APPROVED_WITH_COMMENTS">Approved (with comments)</SelectItem>
                <SelectItem value="REVISION_NEEDED">Revision Needed</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Feedback Comments</Label>
            <Textarea
              placeholder="Enter buyer's feedback..."
              value={form.feedback}
              onChange={(e) => setForm({ ...form, feedback: e.target.value })}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Measurement Notes</Label>
            <Textarea
              placeholder="Any measurement-specific comments..."
              value={form.measurementComments}
              onChange={(e) => setForm({ ...form, measurementComments: e.target.value })}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          {canCreateRevision && onCreateRevision && (
            <Button variant="secondary" onClick={handleSaveAndCreateRevision} disabled={isSubmitting}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Save & Create Revision
            </Button>
          )}
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            <MessageSquare className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Saving...' : 'Save Feedback'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
