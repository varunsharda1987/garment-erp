import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { sampleService } from '@/services/sample.service';
import { handleApiSuccess, handleApiError } from '@/lib/api-error-handler';
import type { SampleStatus } from '@/types/sample.types';

interface UpdateStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sampleId: string;
  currentStatus?: SampleStatus;
  onSuccess?: () => void;
}

export function UpdateStatusDialog({
  open,
  onOpenChange,
  sampleId,
  currentStatus = 'IN_PROGRESS',
  onSuccess,
}: UpdateStatusDialogProps) {
  const [status, setStatus] = useState<SampleStatus>(currentStatus);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      await sampleService.updateSample(sampleId, { status });
      handleApiSuccess('Status updated', `Sample status changed to ${status.replace(/_/g, ' ')}.`);
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      handleApiError(err, 'Failed to update status');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Status</DialogTitle>
          <DialogDescription>Change the sample status</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Select value={status} onValueChange={(v) => setStatus(v as SampleStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="REQUESTED">Requested</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="SUBMITTED">Submitted (Complete)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Updating...' : 'Update Status'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
