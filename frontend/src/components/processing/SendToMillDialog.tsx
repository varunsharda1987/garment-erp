/**
 * Send-to-Mill dialog — shared by the Dyeing / Printing / Processing lists.
 *
 * Replaces the old one-click Send (which could despatch an MRP-created greige order
 * with NO lot: zero stock consumed, a challan with no material, and a permanently
 * locked order). Greige orders without a lot now pick one here; orders that already
 * carry their lot (created from the process-PO form) just confirm date/vehicle.
 * Identity/width/balance enforcement is server-side — 422 messages are shown verbatim.
 *
 * The lots come from the job's own issue preview (2026-09-26), the same list the Job Work Order page
 * shows: only the cloth the job names, placed by where it lies — already at this mill first (taken
 * where it lies, no dispatch), then our stores — and never another mill's cloth. It used to list every
 * greige lot of every cloth, wherever it was.
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Send } from 'lucide-react';
import { jobWorkOrderService, type JwoIssuePreview } from '@/services/jobWorkOrder.service';
import {
  checkSentDate,
  groupLotsForIssue,
  lotIsDrawnWhereItLies,
  lotOptionLabel,
} from '@/components/job-work/lot-rows';
import { formatQuantity } from '@/lib/formatters';
import { qtyAtLeast } from '@/lib/quantity';
import { dyeingService } from '@/services/dyeing.service';
import { processPOService as printProcessPOService } from '@/services/printing.service';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import type { ProcessPO } from '@/types/printing.types';
import { toDateInputValue } from '@/lib/date';

interface SendToMillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  po: ProcessPO | null;
  processType: 'DYEING' | 'PRINTING';
  onSent: () => void;
}

export default function SendToMillDialog({ open, onOpenChange, po, processType, onSent }: SendToMillDialogProps) {
  const [sentDate, setSentDate] = useState<string>(toDateInputValue(new Date()));
  const [lotId, setLotId] = useState<string>('');
  const [challanNumber, setChallanNumber] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [preview, setPreview] = useState<JwoIssuePreview | null>(null);
  const [sending, setSending] = useState(false);

  const jwo = po?.jobWorkOrder;
  const qtyNeeded = Number(jwo?.qtySentMeters ?? 0);
  // A greige order that doesn't already carry its lot must pick one here
  const needsLot = jwo?.fabricType === 'GREIGE' && !jwo?.greigeStockLotId;

  useEffect(() => {
    if (!open) return;
    setSentDate(toDateInputValue(new Date()));
    setLotId('');
    setChallanNumber('');
    setVehicleNumber('');
    setPreview(null);
    if (needsLot && jwo?.id) {
      jobWorkOrderService
        .getIssuePreview(jwo.id)
        .then(setPreview)
        .catch(() => setPreview(null));
    }
  }, [open, needsLot, jwo?.id]);

  const processorName = preview?.processorName ?? 'the mill';
  // One lot has to cover the order here — a split across lots is issued from the Job Work Order page
  const selectableLots = useMemo(
    () => (preview?.availableLots ?? []).filter((lot) => qtyAtLeast(lot.quantityAvailable, qtyNeeded)),
    [preview, qtyNeeded]
  );
  const lotGroups = groupLotsForIssue(selectableLots, processorName);
  const chosenLot = selectableLots.find((lot) => lot.id === lotId);
  const drawsHere = lotIsDrawnWhereItLies(chosenLot);
  const today = toDateInputValue(new Date());
  const dateCheck = checkSentDate(sentDate, chosenLot ? [chosenLot] : [], today);
  const elsewhere = (preview?.greigeAnchored ? (preview?.elsewhere ?? []) : []).reduce<Record<string, number>>(
    (acc, lot) => {
      const holder = lot.location?.holderName ?? 'another mill';
      acc[holder] = (acc[holder] ?? 0) + lot.quantityAvailable;
      return acc;
    },
    {}
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
      handleApiSuccess(
        'Sent to Mill',
        drawsHere
          ? `${po.poNumber} allocated at ${processorName} — the cloth was already there, nothing dispatched.`
          : `${po.poNumber} issued — outward challan created.`
      );
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
              ? drawsHere
                ? `Takes ${qtyNeeded.toFixed(2)} MTR greige already at ${processorName} — no dispatch and no new challan; the one-year period runs from the day it got there.`
                : `Issues ${qtyNeeded.toFixed(2)} MTR greige — consumes the selected lot, creates the outward challan, and locks the Section 143 due date.`
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
                  {lotGroups.map((group) => (
                    <SelectGroup key={group.key}>
                      <SelectLabel>{group.label}</SelectLabel>
                      {group.lots.map((lot) => (
                        <SelectItem key={lot.id} value={lot.id}>
                          {lotOptionLabel(lot)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              {selectableLots.length === 0 && (
                <p className="text-xs text-amber-600">
                  No single lot covers {qtyNeeded.toFixed(2)} MTR — receive the greige PO first, or issue multiple lots
                  from the Job Work Order page.
                </p>
              )}
              {Object.keys(elsewhere).length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Elsewhere:{' '}
                  {Object.entries(elsewhere)
                    .map(([holder, qty]) => `${formatQuantity(qty, 'METER')} at ${holder}`)
                    .join(', ')}{' '}
                  — cloth at another mill cannot go on this order.
                </p>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Sent Date</Label>
              <Input type="date" value={sentDate} max={today} onChange={(e) => setSentDate(e.target.value)} />
              {dateCheck.error && <p className="text-xs text-red-600">{dateCheck.error}</p>}
              {dateCheck.warning && <p className="text-xs text-amber-700">{dateCheck.warning}</p>}
            </div>
            {!drawsHere && (
              <div className="space-y-1.5">
                <Label>Vehicle Number</Label>
                <Input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} />
              </div>
            )}
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
          <Button onClick={handleSend} disabled={sending || (needsLot && !lotId) || !!dateCheck.error}>
            <Send className="mr-2 h-4 w-4" />
            {sending ? 'Sending...' : drawsHere ? `Allocate at ${processorName}` : 'Send & Create Challan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
