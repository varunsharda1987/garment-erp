import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Send } from 'lucide-react';
import { sampleService } from '@/services/sample.service';
import { handleApiSuccess, handleApiError } from '@/lib/api-error-handler';

interface MarkAsSentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sampleId: string;
  onSuccess?: (data: { sentDate: string; courierMode: string; trackingNumber: string }) => void;
}

export function MarkAsSentDialog({ open, onOpenChange, sampleId, onSuccess }: MarkAsSentDialogProps) {
  const [form, setForm] = useState({
    sentDate: new Date().toISOString().split('T')[0],
    courierMode: '',
    trackingNumber: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      await sampleService.markAsSent(sampleId, form);
      handleApiSuccess('Sample sent', 'Sample has been marked as sent.');
      onOpenChange(false);
      onSuccess?.(form);
    } catch (err) {
      handleApiError(err, 'Failed to mark sample as sent');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark Sample as Sent</DialogTitle>
          <DialogDescription>Enter shipping details for tracking</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Sent Date</Label>
            <Input
              type="date"
              value={form.sentDate}
              onChange={(e) => setForm({ ...form, sentDate: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Courier Mode</Label>
            <Input
              placeholder="e.g., FedEx, DHL, Hand Delivery"
              value={form.courierMode}
              onChange={(e) => setForm({ ...form, courierMode: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Tracking Number</Label>
            <Input
              placeholder="Optional tracking number"
              value={form.trackingNumber}
              onChange={(e) => setForm({ ...form, trackingNumber: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            <Send className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Sending...' : 'Mark as Sent'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
