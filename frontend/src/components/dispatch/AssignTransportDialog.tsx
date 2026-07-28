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
import { deliveryNoteService } from '@/services/dispatch.service';
import type { DeliveryNote, AssignTransportRequest } from '@/types/dispatch.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';

interface AssignTransportDialogProps {
  // Open when a delivery note is supplied; null closes the dialog.
  deliveryNote: DeliveryNote | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

/**
 * Assign Transport dialog for a PENDING delivery note.
 * Wires the previously UI-less POST /dispatch/delivery-notes/:id/assign-transport endpoint
 * (deliveryNoteService.assignTransport) so dispatch_transports is populated before dispatch
 * and the POD form's transport block renders (finding B10-06).
 */
export function AssignTransportDialog({ deliveryNote, onOpenChange, onSuccess }: AssignTransportDialogProps) {
  const [transporterName, setTransporterName] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [lrNumber, setLrNumber] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Reset the form each time a different delivery note opens the dialog.
  useEffect(() => {
    setTransporterName('');
    setVehicleNumber('');
    setVehicleType('');
    setDriverName('');
    setDriverPhone('');
    setLrNumber('');
    setExpectedDeliveryDate('');
    setRemarks('');
  }, [deliveryNote?.id]);

  const handleSubmit = async () => {
    if (!deliveryNote) return;
    if (!transporterName.trim() || !vehicleNumber.trim() || !driverName.trim()) {
      handleApiError(new Error('Transporter, vehicle number and driver name are required'), 'Validation Error');
      return;
    }
    try {
      setIsSaving(true);
      const payload: AssignTransportRequest = {
        transporterName: transporterName.trim(),
        vehicleNumber: vehicleNumber.trim(),
        vehicleType: vehicleType.trim() || undefined,
        driverName: driverName.trim(),
        driverPhone: driverPhone.trim() || undefined,
        lrNumber: lrNumber.trim() || undefined,
        expectedDeliveryDate: expectedDeliveryDate || undefined,
        remarks: remarks.trim() || undefined,
      };
      await deliveryNoteService.assignTransport(deliveryNote.id, payload);
      handleApiSuccess('Success', 'Transport assigned successfully');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      handleApiError(error, 'Failed to assign transport');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={!!deliveryNote} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign Transport</DialogTitle>
          <DialogDescription>{deliveryNote ? `Delivery Note ${deliveryNote.deliveryNumber}` : ''}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="transporterName">Transporter *</Label>
            <Input id="transporterName" value={transporterName} onChange={(e) => setTransporterName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vehicleNumber">Vehicle Number *</Label>
            <Input id="vehicleNumber" value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vehicleType">Vehicle Type</Label>
            <Input id="vehicleType" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="driverName">Driver Name *</Label>
            <Input id="driverName" value={driverName} onChange={(e) => setDriverName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="driverPhone">Driver Phone</Label>
            <Input id="driverPhone" value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lrNumber">LR Number</Label>
            <Input id="lrNumber" value={lrNumber} onChange={(e) => setLrNumber(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expectedDeliveryDate">Expected Delivery</Label>
            <Input
              id="expectedDeliveryDate"
              type="date"
              value={expectedDeliveryDate}
              onChange={(e) => setExpectedDeliveryDate(e.target.value)}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="transportRemarks">Remarks</Label>
            <Textarea id="transportRemarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Assign Transport'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
