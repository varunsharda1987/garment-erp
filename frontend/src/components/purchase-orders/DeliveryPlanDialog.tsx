import { useEffect, useMemo, useState } from 'react';
import { History } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { WarehouseCombobox } from '@/components/WarehouseCombobox';
import { DeliverySplitEditor } from '@/components/purchase-orders/DeliverySplitEditor';
import { amendDeliveryPlan } from '@/services/purchaseOrder.service';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { formatDateTime } from '@/lib/date';
import { toQty } from '@/lib/quantity';
import {
  anythingReceived,
  describePlan,
  planMode,
  PRE_SEND_STATUSES,
  seedSplit,
  splitProblems,
  toSplitRequest,
  type SplitLine,
  type SplitPointDraft,
} from '@/lib/delivery-plan';
import type { AmendDeliveryPlanRequest, DeliveryPlanMode, PurchaseOrder } from '@/types/purchaseOrder.types';

interface DeliveryPlanDialogProps {
  purchaseOrder: PurchaseOrder;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (po: PurchaseOrder) => void;
}

const MODE_LABEL: Record<DeliveryPlanMode, string> = {
  ONE_PLACE: 'One place',
  SPLIT: 'Split across places',
  TO_BE_ADVISED: 'To be advised',
};

/**
 * Change delivery — the ONE door for where a PO delivers: one place, a split across places with a
 * quantity each, or "to be advised". Every change after sending needs a reason and is kept as a
 * numbered amendment (server: helpers/po-delivery-plan.helper.ts, which also refuses moving metres
 * already received).
 */
export function DeliveryPlanDialog({ purchaseOrder: po, open, onOpenChange, onSaved }: DeliveryPlanDialogProps) {
  const lines: SplitLine[] = useMemo(
    () =>
      (po.items ?? []).map((item) => ({
        id: item.id,
        label: item.materials?.code || item.materials?.name || item.serviceDescription || 'Item',
        ordered: toQty(item.orderedQuantity),
        unit: item.unit,
      })),
    [po.items]
  );
  const received = anythingReceived(po);
  const sent = !PRE_SEND_STATUSES.includes(po.status);

  const [mode, setMode] = useState<DeliveryPlanMode>(planMode(po));
  const [onePlaceId, setOnePlaceId] = useState(po.deliveryLocationId ?? '');
  const [points, setPoints] = useState<SplitPointDraft[]>(() => seedSplit(po, lines));
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode(planMode(po));
    setOnePlaceId(po.deliveryLocationId ?? '');
    setPoints(seedSplit(po, lines));
    setReason('');
  }, [open, po, lines]);

  // Names of the places this PO already knows, for messages
  const names = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of po.deliveryPoints ?? []) m.set(p.warehouseId, p.warehouse.warehouseName);
    if (po.deliveryWarehouse && po.deliveryLocationId) m.set(po.deliveryLocationId, po.deliveryWarehouse.warehouseName);
    for (const g of po.goodsReceivingNotes ?? []) if (g.warehouse) m.set(g.warehouse.id, g.warehouse.warehouseName);
    return m;
  }, [po]);
  const placeName = (id: string) => names.get(id) ?? 'That place';

  // Places that received goods stay in the plan (the server refuses dropping them)
  const lockedWarehouseIds = useMemo(() => {
    const byPoint = new Map((po.deliveryPoints ?? []).map((p) => [p.id, p.warehouseId]));
    return (po.goodsReceivingNotes ?? [])
      .filter((g) => g.status !== 'REJECTED' && g.status !== 'REVERSED')
      .map((g) => (g.poDeliveryPointId ? byPoint.get(g.poDeliveryPointId) : g.warehouseId))
      .filter((id): id is string => !!id);
  }, [po]);

  const problems =
    mode === 'SPLIT'
      ? splitProblems(lines, points, placeName)
      : mode === 'ONE_PLACE' && !onePlaceId
        ? ['Pick the place.']
        : [];
  const reasonMissing = sent && !reason.trim();

  const handleSave = async () => {
    const body: AmendDeliveryPlanRequest =
      mode === 'SPLIT'
        ? toSplitRequest(points, reason)
        : mode === 'ONE_PLACE'
          ? { mode, warehouseId: onePlaceId, reason: reason.trim() || null }
          : { mode, reason: reason.trim() || null };
    try {
      setSaving(true);
      const updated = await amendDeliveryPlan(po.id, body);
      handleApiSuccess(
        'Delivery changed',
        sent ? 'Share the Delivery Instruction (or the PO) with the supplier again.' : 'Saved on the draft.'
      );
      onSaved(updated);
      onOpenChange(false);
    } catch (err) {
      handleApiError(err, 'Could not change the delivery');
    } finally {
      setSaving(false);
    }
  };

  const revisions = po.deliveryPlanRevisions ?? [];
  // The printout's "Amendment N" counts only changes made after the PO was sent
  const amendmentNo = (revisionNumber: number) =>
    revisions.filter((x) => !PRE_SEND_STATUSES.includes(x.poStatus) && x.revisionNumber <= revisionNumber).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Change delivery — {po.poNumber}</DialogTitle>
          <DialogDescription>
            Where the supplier delivers this order: one place, several places with a quantity each (one invoice and one
            e-way bill per delivery), or decided before dispatch.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <RadioGroup
            value={mode}
            onValueChange={(v) => setMode(v as DeliveryPlanMode)}
            className="grid grid-cols-1 sm:grid-cols-3 gap-2"
          >
            {(['ONE_PLACE', 'SPLIT', 'TO_BE_ADVISED'] as DeliveryPlanMode[]).map((m) => (
              <Label
                key={m}
                htmlFor={`delivery-mode-${m}`}
                className="flex items-center gap-2 rounded-md border p-3 cursor-pointer has-[:disabled]:opacity-50"
              >
                <RadioGroupItem id={`delivery-mode-${m}`} value={m} disabled={m === 'TO_BE_ADVISED' && received} />
                {MODE_LABEL[m]}
              </Label>
            ))}
          </RadioGroup>
          {received && (
            <p className="text-xs text-muted-foreground">
              Goods have already arrived on this PO: what was received stays where it arrived, and the PO cannot go back
              to "to be advised".
            </p>
          )}

          {mode === 'ONE_PLACE' && (
            <div className="space-y-2">
              <Label>Deliver to</Label>
              <WarehouseCombobox
                value={onePlaceId}
                onValueChange={setOnePlaceId}
                placeholder="Pick a store or a processor's unit"
              />
            </div>
          )}

          {mode === 'SPLIT' && (
            <DeliverySplitEditor
              lines={lines}
              points={points}
              onChange={setPoints}
              lockedWarehouseIds={lockedWarehouseIds}
              disabled={saving}
            />
          )}

          {mode === 'TO_BE_ADVISED' && (
            <Alert>
              <AlertDescription>
                The PO prints "to be advised before dispatch — we will confirm the address in writing". Set the place
                before the supplier dispatches; the PO list flags it 3 days before the due date.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="delivery-reason">Reason{sent ? ' *' : ' (optional on a draft)'}</Label>
            <Textarea
              id="delivery-reason"
              rows={2}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Dyer confirmed; 4,000 m straight to Aryan Dyeing"
            />
          </div>

          {problems.length > 0 && (
            <ul className="text-sm text-warning list-disc pl-5 space-y-0.5">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}

          {revisions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <History className="h-4 w-4" /> Changes so far
              </div>
              <ul className="space-y-1.5 text-sm">
                {revisions.map((r) => (
                  <li key={r.id} className="rounded-md border px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">
                        {PRE_SEND_STATUSES.includes(r.poStatus)
                          ? 'Draft change'
                          : `Amendment ${amendmentNo(r.revisionNumber)}`}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(r.changedAt)}
                        {r.changedBy ? ` · ${r.changedBy.firstName} ${r.changedBy.lastName}` : ''}
                      </span>
                    </div>
                    <div className="text-muted-foreground">
                      {describePlan(r.before)} → <span className="text-foreground">{describePlan(r.after)}</span>
                    </div>
                    {r.reason && <div className="text-xs mt-0.5">Why: {r.reason}</div>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || problems.length > 0 || reasonMissing}>
            {saving ? 'Saving…' : 'Save delivery'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
