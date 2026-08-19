/**
 * Send-to-Mill dialog — shared by the Dyeing / Printing / Processing lists.
 *
 * Replaces the old one-click Send (which could despatch an MRP-created greige order
 * with NO lot: zero stock consumed, a challan with no material, and a permanently
 * locked order). Greige orders without a lot now pick one here; orders that already
 * carry their lot (created from the process-PO form) just confirm date/vehicle.
 * Identity/width/balance enforcement is server-side — 422 messages are shown verbatim.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send } from 'lucide-react';
import { greigeStockService, type GreigeStockEntry } from '@/services/greigeStock.service';
import { dyeingService } from '@/services/dyeing.service';
import { processPOService as printProcessPOService } from '@/services/printing.service';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import type { ProcessPO } from '@/types/printing.types';

interface SendToMillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  po: ProcessPO | null;
  processType: 'DYEING' | 'PRINTING';
  onSent: () => void;
}

export default function SendToMillDialog({ open, onOpenChange, po, processType, onSent }: SendToMillDialogProps) {
  const [sentDate, setSentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [lotId, setLotId] = useState<string>('');
  const [challanNumber, setChallanNumber] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [lots, setLots] = useState<GreigeStockEntry[]>([]);
  const [sending, setSending] = useState(false);

  const jwo = po?.jobWorkOrder;
  const qtyNeeded = Number(jwo?.qtySentMeters ?? 0);
  // A greige order that doesn't already carry its lot must pick one here
  const needsLot = jwo?.fabricType === 'GREIGE' && !jwo?.greigeStockLotId;

  useEffect(() => {
    if (!open) return;
    setSentDate(new Date().toISOString().split('T')[0]);
    setLotId('');
    setChallanNumber('');
    setVehicleNumber('');
    if (needsLot) {
      greigeStockService
        .listAvailableStock({ excludeTransferred: true })
        .then(setLots)
        .catch(() => setLots([]));
    }
  }, [open, needsLot]);

  const selectableLots = useMemo(
    () => lots.filter((lot) => Number(lot.quantityAvailable) >= qtyNeeded),
    [lots, qtyNeeded]
  );

  const handleSend = async () => {
    if (!po) return;
    setSending(true);
    try {
      const service = processType === 'DYEING' ? dyeingService.processPOs : printProcessPOService;
      await service.sendToMill(po.id, {
        sentDate,
        challanNumber: challanNumber || undefined,
        vehicleNumber: vehicleNumber || undefined,
        greigeStockLotId: needsLot && lotId ? lotId : undefined,
      });
      handleApiSuccess('Sent to Mill', `${po.poNumber} issued — outward challan created.`);
      onOpenChange(false);
      onSent();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to send to mill');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send {po?.poNumber ?? ''} to Mill</DialogTitle>
          <DialogDescription>
            {needsLot
              ? `Issues ${qtyNeeded.toFixed(2)} MTR greige — consumes the selected lot, creates the outward challan, and locks the Section 143 due date.`
              : `Despatches the material, creates the outward challan, and locks the Section 143 due date.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {needsLot && (
            <div className="space-y-1.5">
              <Label>Greige Stock Lot *</Label>
              <Select value={lotId || 'none'} onValueChange={(v) => setLotId(v === 'none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select greige lot" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Select a lot --</SelectItem>
                  {selectableLots.map((lot) => (
                    <SelectItem key={lot.id} value={lot.id}>
                      {lot.greige?.greigeCode} — {lot.greige?.greigeName} ({Number(lot.quantityAvailable).toFixed(1)}m
                      avail, {Number(lot.greigeWidth)}″)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectableLots.length === 0 && (
                <p className="text-xs text-amber-600">
                  No single lot covers {qtyNeeded.toFixed(2)} MTR — receive the greige PO first, or issue multiple lots
                  from the Job Work Order page.
                </p>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Sent Date</Label>
              <Input type="date" value={sentDate} onChange={(e) => setSentDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Vehicle Number</Label>
              <Input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Challan Ref (optional manual book ref)</Label>
            <Input value={challanNumber} onChange={(e) => setChallanNumber(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending || (needsLot && !lotId)}>
            <Send className="mr-2 h-4 w-4" />
            {sending ? 'Sending...' : 'Send & Create Challan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
