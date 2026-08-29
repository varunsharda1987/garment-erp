import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MessageCircle } from 'lucide-react';
import { sampleService } from '@/services/sample.service';
import { handleApiSuccess, handleApiError } from '@/lib/api-error-handler';
import { useWhatsappStatus } from '@/hooks/useWhatsapp';
import type { Sample } from '@/types/sample.types';

interface NotifyBuyerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sample: Sample;
  shippingOverrides?: {
    courierMode?: string;
    trackingNumber?: string;
    sentDate?: string;
  };
  onSuccess?: () => void;
}

function buildBuyerMessage(
  s: Sample,
  courier?: string | null,
  tracking?: string | null,
  sentDate?: string | null
): string {
  const greet = s.customer?.contactPerson?.trim() || s.customer?.name?.trim() || 'Sir/Madam';
  const buyerRef = s.style?.buyerStyleRef ? ` [Ref: ${s.style.buyerStyleRef}]` : '';
  const styleBit = s.style?.styleCode
    ? ` for style ${s.style.styleCode}${buyerRef}${s.style.styleName ? ` (${s.style.styleName})` : ''}`
    : '';
  const dateStr = sentDate ? new Date(sentDate).toLocaleDateString('en-IN') : '';
  return [
    `Dear ${greet},`,
    '',
    `Your sample ${s.sampleNumber}${styleBit} has been dispatched.`,
    courier ? `Courier: ${courier}` : '',
    tracking ? `Tracking No: ${tracking}` : '',
    dateStr ? `Dispatched on: ${dateStr}` : '',
    '',
    'Kindly confirm once received. Thank you!',
  ]
    .filter(Boolean)
    .join('\n');
}

export function NotifyBuyerDialog({
  open,
  onOpenChange,
  sample,
  shippingOverrides,
  onSuccess,
}: NotifyBuyerDialogProps) {
  const { data: waStatus } = useWhatsappStatus();
  const waLinked = waStatus?.state === 'ready';
  const [form, setForm] = useState({ to: '', text: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open && sample) {
      const courier = shippingOverrides?.courierMode ?? sample.courierMode ?? '';
      const tracking = shippingOverrides?.trackingNumber ?? sample.trackingNumber ?? '';
      const sentDate = shippingOverrides?.sentDate ?? sample.sentDate ?? new Date().toISOString();
      setForm({
        to: sample.customer?.phone || '',
        text: buildBuyerMessage(sample, courier, tracking, sentDate),
      });
    }
  }, [open, sample, shippingOverrides]);

  const handleSubmit = async () => {
    if (!form.to.trim()) {
      handleApiError(new Error('Enter a WhatsApp number'), 'No recipient');
      return;
    }
    try {
      setIsSubmitting(true);
      await sampleService.notifyBuyer(sample.id, { to: form.to.trim(), text: form.text });
      handleApiSuccess('Buyer notified', 'WhatsApp message sent to the buyer.');
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      handleApiError(err, 'Failed to notify buyer');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" />
            Notify Buyer on WhatsApp
          </DialogTitle>
          <DialogDescription>
            Sends from your own WhatsApp number. Review or edit the message before sending.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Buyer WhatsApp Number</Label>
            <Input
              value={form.to}
              onChange={(e) => setForm({ ...form, to: e.target.value })}
              placeholder="e.g. 919876543210"
            />
            <p className="text-xs text-muted-foreground">Include country code without + (e.g. 91... for India).</p>
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              rows={8}
              value={form.text}
              onChange={(e) => setForm({ ...form, text: e.target.value })}
            />
          </div>
          {!waLinked && (
            <p className="text-sm text-amber-700">
              Your WhatsApp isn't linked yet.{' '}
              <Link to="/whatsapp" className="font-medium underline">
                Link it in My WhatsApp
              </Link>{' '}
              to send.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !waLinked || !form.to.trim()}
            className="bg-[#25D366] text-white hover:bg-[#1ebe5b]"
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Sending...' : 'Send on WhatsApp'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
