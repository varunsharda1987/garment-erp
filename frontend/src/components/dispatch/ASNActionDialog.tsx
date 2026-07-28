import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { asnService } from '@/services/dispatch.service';
import type { ASNApplication, ApproveASNRequest } from '@/types/dispatch.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';

export type ASNAction = 'approve' | 'reject' | 'reschedule';

interface ASNActionDialogProps {
  asn: ASNApplication | null;
  action: ASNAction | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const TITLES: Record<ASNAction, string> = {
  approve: 'Approve ASN',
  reject: 'Reject ASN',
  reschedule: 'Reschedule ASN',
};

/**
 * Drives the ASN buyer-response lifecycle from the UI (APPLIED -> APPROVED / REJECTED / RESCHEDULE)
 * by wiring the previously UI-less endpoints asnService.approve / reject / reschedule (finding B10-05).
 * Without this the UI could only take an ASN as far as APPLIED, so the APPROVED -> Create Delivery Note
 * handoff could never trigger.
 */
export function ASNActionDialog({ asn, action, onOpenChange, onSuccess }: ASNActionDialogProps) {
  // Approve fields
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [buyerRefNumber, setBuyerRefNumber] = useState('');
  const [approvedQty, setApprovedQty] = useState('');
  // Reject field
  const [rejectionReason, setRejectionReason] = useState('');
  // Reschedule field
  const [rescheduleDate, setRescheduleDate] = useState('');

  const [isSaving, setIsSaving] = useState(false);

  // Reset the form each time a different ASN / action opens the dialog.
  useEffect(() => {
    setAppointmentDate('');
    setAppointmentTime('');
    setBuyerRefNumber('');
    setApprovedQty('');
    setRejectionReason('');
    setRescheduleDate('');
  }, [asn?.id, action]);

  const handleSubmit = async () => {
    if (!asn || !action) return;
    try {
      setIsSaving(true);
      if (action === 'approve') {
        if (!appointmentDate) {
          handleApiError(new Error('Appointment date is required'), 'Validation Error');
          return;
        }
        const payload: ApproveASNRequest = {
          appointmentDate,
          appointmentTime: appointmentTime || undefined,
          buyerRefNumber: buyerRefNumber.trim() || undefined,
          approvedQty: approvedQty ? Number(approvedQty) : undefined,
        };
        await asnService.approve(asn.id, payload);
        handleApiSuccess('Success', 'ASN approved successfully');
      } else if (action === 'reject') {
        if (!rejectionReason.trim()) {
          handleApiError(new Error('Rejection reason is required'), 'Validation Error');
          return;
        }
        await asnService.reject(asn.id, rejectionReason.trim());
        handleApiSuccess('Success', 'ASN rejected');
      } else {
        if (!rescheduleDate) {
          handleApiError(new Error('Reschedule date is required'), 'Validation Error');
          return;
        }
        await asnService.reschedule(asn.id, rescheduleDate);
        handleApiSuccess('Success', 'ASN rescheduled');
      }
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      handleApiError(error, 'Failed to update ASN');
    } finally {
      setIsSaving(false);
    }
  };

  const open = !!asn && !!action;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{action ? TITLES[action] : ''}</DialogTitle>
          <DialogDescription>{asn ? `ASN ${asn.asnNumber}` : ''}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {action === 'approve' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="appointmentDate">Appointment Date *</Label>
                  <Input
                    id="appointmentDate"
                    type="date"
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="appointmentTime">Appointment Time</Label>
                  <Input
                    id="appointmentTime"
                    type="time"
                    value={appointmentTime}
                    onChange={(e) => setAppointmentTime(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="buyerRefNumber">Buyer Reference Number</Label>
                <Input id="buyerRefNumber" value={buyerRefNumber} onChange={(e) => setBuyerRefNumber(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="approvedQty">Approved Quantity</Label>
                <Input
                  id="approvedQty"
                  type="number"
                  min="0"
                  value={approvedQty}
                  onChange={(e) => setApprovedQty(e.target.value)}
                  placeholder={String(asn?.plannedDispatchQty ?? '')}
                />
              </div>
            </>
          )}

          {action === 'reject' && (
            <div className="space-y-2">
              <Label htmlFor="rejectionReason">Rejection Reason *</Label>
              <Textarea
                id="rejectionReason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
              />
            </div>
          )}

          {action === 'reschedule' && (
            <div className="space-y-2">
              <Label htmlFor="rescheduleDate">New Ship Date *</Label>
              <Input
                id="rescheduleDate"
                type="date"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving} variant={action === 'reject' ? 'destructive' : 'default'}>
            {isSaving ? 'Saving...' : action ? TITLES[action] : 'Submit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
