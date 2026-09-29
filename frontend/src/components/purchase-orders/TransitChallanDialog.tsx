// Goods-in-transit challan (2026-09-29): our Rule 45 challan for goods the supplier is sending STRAIGHT to a
// processor, issued before they arrive — the dyer inwards the goods against it. The receipt is filed on the day
// they really arrive, and picks this challan up. Written by direct-supply-challan.helper (server).
import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Truck } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ReceiptDetailRows, {
  sumDetailRows,
  type ReceiptDetailRow,
  type ReceiptEntryMode,
} from '@/components/job-work/ReceiptDetailRows';
import { challanService } from '@/services/challan.service';
import { handleApiError } from '@/lib/api-error-handler';
import { notify } from '@/lib/notify';
import { openPDF } from '@/lib/document-utils';
import { toDateInputValue } from '@/lib/date';
import { foldActual, hasFold } from '@/lib/fold-length';
import { isQtyZero } from '@/lib/quantity';
import { unitShort } from '@/lib/units';
import type { DeliveryProgressPoint, PurchaseOrder } from '@/types/purchaseOrder.types';

interface TransitChallanDialogProps {
  purchaseOrder: PurchaseOrder;
  /** The processor's place the goods are going to */
  point: DeliveryProgressPoint;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIssued?: () => void;
}

interface LineState {
  poItemId: string;
  label: string;
  unit: string;
  pending: number;
  include: boolean;
  /** COUNTED — as on the supplier's paper (typed when there is no piece list) */
  quantity: string;
  fold: string;
  mode: ReceiptEntryMode;
  rows: ReceiptDetailRow[];
}

const MODE_LABELS: Record<ReceiptEntryMode, string> = {
  TOTAL_METERS: 'Total metres',
  THAN_WISE: 'Than-wise',
  BALE_WISE: 'Bale-wise',
  ROLL_WISE: 'Roll-wise',
};

const today = () => toDateInputValue(new Date());

export function TransitChallanDialog({
  purchaseOrder: po,
  point,
  open,
  onOpenChange,
  onIssued,
}: TransitChallanDialogProps) {
  const queryClient = useQueryClient();
  const piecesAllowed = po.poCategory === 'GREIGE' || po.poCategory === 'FABRIC';
  const initialLines = useMemo<LineState[]>(
    () =>
      point.lines
        .filter((l) => !isQtyZero(l.pending))
        .map((l) => {
          const item = po.items?.find((i) => i.id === l.poItemId);
          return {
            poItemId: l.poItemId,
            label: l.label,
            unit: item?.unit ?? 'METER',
            pending: l.pending,
            include: true,
            quantity: '',
            fold: item?.foldLengthCm != null ? String(item.foldLengthCm) : '',
            mode: piecesAllowed ? 'THAN_WISE' : 'TOTAL_METERS',
            rows: [],
          };
        }),
    [point, po.items, piecesAllowed]
  );

  const [dispatchedOn, setDispatchedOn] = useState(today());
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [lrNumber, setLrNumber] = useState('');
  const [ewayBillNumber, setEwayBillNumber] = useState('');
  const [ewayBillDate, setEwayBillDate] = useState('');
  const [lines, setLines] = useState<LineState[]>(initialLines);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDispatchedOn(today());
    setInvoiceNumber('');
    setInvoiceDate('');
    setVehicleNumber('');
    setLrNumber('');
    setEwayBillNumber('');
    setEwayBillDate('');
    setLines(initialLines);
  }, [open, initialLines]);

  const patch = (poItemId: string, change: Partial<LineState>) =>
    setLines((prev) => prev.map((l) => (l.poItemId === poItemId ? { ...l, ...change } : l)));

  /** The counted figure: the piece list's total when there is one, else what was typed */
  const countedOf = (l: LineState) =>
    l.mode !== 'TOTAL_METERS' && l.rows.length > 0 ? sumDetailRows(l.rows) : Number(l.quantity) || 0;

  const chosen = lines.filter((l) => l.include && countedOf(l) > 0);

  const submit = async () => {
    if (chosen.length === 0) {
      notify.error('Enter what the supplier despatched on at least one line.');
      return;
    }
    setSaving(true);
    try {
      const challan = await challanService.issueTransitChallan({
        poId: po.id,
        poDeliveryPointId: point.id,
        dispatchedOn,
        invoiceNumber: invoiceNumber.trim() || null,
        invoiceDate: invoiceDate || null,
        vehicleNumber: vehicleNumber.trim() || null,
        lrNumber: lrNumber.trim() || null,
        ewayBillNumber: ewayBillNumber.trim() || null,
        ewayBillDate: ewayBillDate || null,
        lines: chosen.map((l) => {
          const listed = l.mode !== 'TOTAL_METERS' ? l.rows.filter((r) => r.meters > 0) : [];
          return {
            poItemId: l.poItemId,
            quantity: countedOf(l),
            foldLengthCm: l.fold ? Number(l.fold) : null,
            entryMode: listed.length > 0 ? l.mode : 'TOTAL_METERS',
            pieces: listed.map((r, i) => ({
              detailType: l.mode === 'ROLL_WISE' ? ('ROLL' as const) : ('THAN' as const),
              baleNumber: l.mode === 'BALE_WISE' ? r.baleNumber : null,
              sequenceNo: i + 1,
              meters: r.meters,
              baleNo: r.baleNo?.trim() || null,
              thanNo: r.thanNo?.trim() || null,
            })),
          };
        }),
      });
      notify.success(`Challan ${challan.challanNumber} issued`, {
        description: 'Give it with the goods. File the receipt against it when they reach the processor.',
      });
      await queryClient.invalidateQueries({ queryKey: ['purchase-orders', po.id] });
      onIssued?.();
      onOpenChange(false);
      try {
        await openPDF(`/documents/challans/${challan.id}/pdf`);
      } catch (err) {
        handleApiError(err, 'The challan was issued, but its print could not be opened');
      }
    } catch (err) {
      handleApiError(err, 'Could not issue the challan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Issue challan — goods on the way to {point.warehouseName}
          </DialogTitle>
          <DialogDescription>
            Our job-work challan for goods {po.supplier?.name ?? 'the supplier'} is sending straight to the processor.
            It goes with the goods, dated today. File the receipt when they arrive — it picks this challan up.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="transit-dispatched">Despatched on *</Label>
            <Input
              id="transit-dispatched"
              type="date"
              max={today()}
              value={dispatchedOn}
              onChange={(e) => setDispatchedOn(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="transit-invoice">Supplier invoice no.</Label>
              <Input
                id="transit-invoice"
                value={invoiceNumber}
                maxLength={100}
                onChange={(e) => setInvoiceNumber(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="transit-invoice-date">Invoice date</Label>
              <Input
                id="transit-invoice-date"
                type="date"
                max={today()}
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="transit-vehicle">Vehicle no.</Label>
              <Input
                id="transit-vehicle"
                value={vehicleNumber}
                maxLength={20}
                onChange={(e) => setVehicleNumber(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="transit-lr">LR no.</Label>
              <Input id="transit-lr" value={lrNumber} maxLength={50} onChange={(e) => setLrNumber(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="transit-eway">E-way bill no.</Label>
              <Input
                id="transit-eway"
                value={ewayBillNumber}
                maxLength={20}
                onChange={(e) => setEwayBillNumber(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="transit-eway-date">E-way bill date</Label>
              <Input
                id="transit-eway-date"
                type="date"
                max={today()}
                value={ewayBillDate}
                onChange={(e) => setEwayBillDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {lines.length === 0 && (
            <div className="text-sm text-muted-foreground">Nothing is left to come to {point.warehouseName}.</div>
          )}
          {lines.map((l) => {
            const counted = countedOf(l);
            const actual = hasFold(l.fold) ? foldActual(counted, Number(l.fold)) : counted;
            return (
              <div key={l.poItemId} className="rounded-md border p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 font-medium">
                    <Checkbox checked={l.include} onCheckedChange={(v) => patch(l.poItemId, { include: v === true })} />
                    {l.label}
                  </label>
                  <span className="text-xs text-muted-foreground">
                    {l.pending.toLocaleString('en-IN', { maximumFractionDigits: 3 })} {unitShort(l.unit)} to come here
                  </span>
                </div>
                {l.include && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-end gap-3">
                      {piecesAllowed && (
                        <div className="space-y-1">
                          <Label className="text-xs">Supplier's list</Label>
                          <Select
                            value={l.mode}
                            onValueChange={(v) => patch(l.poItemId, { mode: v as ReceiptEntryMode, rows: [] })}
                          >
                            <SelectTrigger className="h-8 w-[140px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.keys(MODE_LABELS) as ReceiptEntryMode[]).map((m) => (
                                <SelectItem key={m} value={m}>
                                  {MODE_LABELS[m]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div className="space-y-1">
                        <Label className="text-xs">Quantity despatched ({unitShort(l.unit)})</Label>
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          className="h-8 w-[130px] text-xs"
                          value={l.mode !== 'TOTAL_METERS' && l.rows.length > 0 ? String(counted) : l.quantity}
                          disabled={l.mode !== 'TOTAL_METERS' && l.rows.length > 0}
                          onChange={(e) => patch(l.poItemId, { quantity: e.target.value })}
                        />
                      </div>
                      {piecesAllowed && (
                        <div className="space-y-1">
                          <Label className="text-xs">Fold L (cm)</Label>
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            className="h-8 w-[90px] text-xs"
                            value={l.fold}
                            placeholder="100"
                            onChange={(e) => patch(l.poItemId, { fold: e.target.value })}
                          />
                        </div>
                      )}
                      {hasFold(l.fold) && counted > 0 && (
                        <span className="text-xs text-muted-foreground pb-2">
                          = {Number(actual).toLocaleString('en-IN', { maximumFractionDigits: 2 })} m actual
                        </span>
                      )}
                    </div>
                    {piecesAllowed && l.mode !== 'TOTAL_METERS' && (
                      <ReceiptDetailRows
                        mode={l.mode}
                        rows={l.rows}
                        onChange={(rows) => patch(l.poItemId, { rows })}
                        withTags
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || chosen.length === 0}>
            {saving ? 'Issuing…' : 'Issue challan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
