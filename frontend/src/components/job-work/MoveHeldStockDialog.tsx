// Move to another processor — goods we own that one processor holds go on to another, on ONE challan
// from the first to the second (direct-to-processor plan, Phase 4c). The goods become held at the new
// processor and keep the day they first reached a processor, so the one-year return period does not
// restart. The server (helpers/held-stock-doors.helper.ts) files the challan and moves the stock.
import { useEffect, useState } from 'react';
import { ArrowRightLeft, Loader2 } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { WarehouseCombobox } from '@/components/WarehouseCombobox';
import stockMovementService from '@/services/stockMovement.service';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { formatDate, toDateInputValue } from '@/lib/date';
import { isQtyZero, prefillQty, qtyExceeds, snapToLimit, toQty } from '@/lib/quantity';

export interface MoveLot {
  lotType: 'GREIGE' | 'LACE' | 'FABRIC';
  id: string;
  code: string;
  quantityAvailable: number;
  receivedDate?: string | null;
}

interface MoveHeldStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Lots held by ONE processor */
  lots: MoveLot[];
  fromName: string;
  /** Fixed destination (e.g. this job's processor); omit to let the user pick a processor's unit */
  toProcessorId?: string | null;
  toName?: string | null;
  onMoved?: () => void;
}

export default function MoveHeldStockDialog({
  open,
  onOpenChange,
  lots,
  fromName,
  toProcessorId,
  toName,
  onMoved,
}: MoveHeldStockDialogProps) {
  const [qty, setQty] = useState<Record<string, string>>({});
  const [toUnitId, setToUnitId] = useState('');
  const [movedOn, setMovedOn] = useState(toDateInputValue(new Date()));
  const [vehicle, setVehicle] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQty(Object.fromEntries(lots.map((l) => [l.id, prefillQty(l.quantityAvailable)])));
    setToUnitId('');
    setMovedOn(toDateInputValue(new Date()));
    setVehicle('');
    setRemarks('');
  }, [open, lots]);

  const lines = lots.map((l) => ({ lot: l, quantity: toQty(qty[l.id]) })).filter((l) => !isQtyZero(l.quantity));
  const over = lines.find((l) => qtyExceeds(l.quantity, l.lot.quantityAvailable));
  const earliest = lots
    .map((l) => l.receivedDate)
    .filter((d): d is string => !!d)
    .sort()[0];
  const canSave = lines.length > 0 && !over && (!!toProcessorId || !!toUnitId) && !saving;

  const handleMove = async () => {
    try {
      setSaving(true);
      const result = await stockMovementService.moveHeldStock({
        lines: lines.map((l) => ({
          lotType: l.lot.lotType,
          lotId: l.lot.id,
          quantity: snapToLimit(l.quantity, l.lot.quantityAvailable),
        })),
        ...(toProcessorId ? { toProcessorId } : { toWarehouseId: toUnitId }),
        movedOn,
        vehicleNumber: vehicle.trim() || undefined,
        remarks: remarks.trim() || undefined,
      });
      handleApiSuccess(
        'Moved',
        `From ${result.fromName} to ${result.toName} on challan ${result.challanNumber}. Give the challan to the transporter.`
      );
      onOpenChange(false);
      onMoved?.();
    } catch (err) {
      handleApiError(err, 'Could not move the goods');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            Move to {toName ?? 'another processor'}
          </DialogTitle>
          <DialogDescription>
            From {fromName}, on one challan. The goods stay ours and keep the day they first reached a processor
            {earliest ? ` (${formatDate(earliest)})` : ''}, so the one-year return period does not restart.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!toProcessorId && (
            <div className="space-y-1.5">
              <Label>To processor *</Label>
              <WarehouseCombobox
                value={toUnitId}
                onValueChange={setToUnitId}
                placeholder="Pick the processor's unit"
                warehouseTypeFilter="JOB_WORK"
              />
            </div>
          )}

          <div className="space-y-2">
            {lots.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-3">
                <div className="text-sm">
                  <div className="font-medium">{l.code}</div>
                  <div className="text-xs text-muted-foreground">
                    {l.quantityAvailable.toLocaleString('en-IN', { maximumFractionDigits: 3 })} m at {fromName}
                  </div>
                </div>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  className="w-32 text-right"
                  value={qty[l.id] ?? ''}
                  onChange={(e) => setQty((prev) => ({ ...prev, [l.id]: e.target.value }))}
                  aria-label={`Metres of ${l.code} to move`}
                />
              </div>
            ))}
            {over && (
              <p className="text-xs text-destructive">
                {over.lot.code}: more than is at {fromName}.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="move-date">Moved on</Label>
              <Input
                id="move-date"
                type="date"
                value={movedOn}
                max={toDateInputValue(new Date())}
                min={earliest ? toDateInputValue(earliest) : undefined}
                onChange={(e) => setMovedOn(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="move-vehicle">Vehicle</Label>
              <Input id="move-vehicle" value={vehicle} onChange={(e) => setVehicle(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="move-remarks">Remarks</Label>
            <Textarea id="move-remarks" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleMove} disabled={!canSave}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRightLeft className="mr-2 h-4 w-4" />}
            Move and create challan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
