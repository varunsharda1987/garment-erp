import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, FileText, MapPin, PackageCheck, PenLine, Printer, Truck, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { DeliveryPlanDialog } from '@/components/purchase-orders/DeliveryPlanDialog';
import { TransitChallanDialog } from '@/components/purchase-orders/TransitChallanDialog';
import { getDeliveryProgress } from '@/services/purchaseOrder.service';
import { challanService } from '@/services/challan.service';
import { openPDF } from '@/lib/document-utils';
import { handleApiError } from '@/lib/api-error-handler';
import { notify } from '@/lib/notify';
import { formatDate } from '@/lib/date';
import { isQtyZero } from '@/lib/quantity';
import { unitShort } from '@/lib/units';
import { deliveryUndecidedSoon, FINISHED_STATUSES, planMode, PRE_SEND_STATUSES } from '@/lib/delivery-plan';
import type { DeliveryProgressPoint, PurchaseOrder, WarehouseSummary } from '@/types/purchaseOrder.types';
import type { TransitChallan } from '@/types/challan.types';

interface DeliveryPlanCardProps {
  purchaseOrder: PurchaseOrder;
  /** Company Profile address — what our own store without an address of its own prints */
  companyFullAddress: string;
  onChanged: (po: PurchaseOrder) => void;
}

const RECEIVABLE = ['SENT', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED'];

function addressOf(wh: WarehouseSummary | null | undefined, companyFullAddress: string): string {
  if (!wh) return '';
  const own = [wh.address, wh.city, wh.state, wh.pincode].filter(Boolean).join(', ');
  if (own) return own;
  return wh.warehouseType !== 'JOB_WORK'
    ? `${companyFullAddress} (company address)`
    : 'Address not on file — add it to the processor in Suppliers';
}

const qty = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 3 });

/**
 * Where a PO delivers — one place, a split across places, or "to be advised" — with planned / received /
 * pending per place (received derived from the receipts, server-side), and the Change delivery door.
 */
export function DeliveryPlanCard({ purchaseOrder: po, companyFullAddress, onChanged }: DeliveryPlanCardProps) {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const mode = planMode(po);
  const stamp = `${po.deliveryPlanRevisions?.length ?? 0}-${po.goodsReceivingNotes?.length ?? 0}-${po.status}`;
  const { data: progress } = useQuery({
    queryKey: ['purchase-orders', po.id, 'delivery-progress', stamp],
    queryFn: () => getDeliveryProgress(po.id),
    enabled: mode !== 'TO_BE_ADVISED',
  });

  // Goods on the way to a processor under our challan (issued at despatch, adopted by the receipt on arrival)
  const queryClient = useQueryClient();
  const { data: transit = [] } = useQuery({
    queryKey: ['purchase-orders', po.id, 'transit-challans', stamp],
    queryFn: () => challanService.getTransitChallans(po.id),
    enabled: mode !== 'TO_BE_ADVISED',
  });
  const [transitPoint, setTransitPoint] = useState<DeliveryProgressPoint | null>(null);
  const [cancelling, setCancelling] = useState<TransitChallan | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);
  const transitAt = (warehouseId: string) =>
    transit.filter((c) => c.warehouseId === warehouseId && c.transitState !== 'CANCELLED');
  const refreshTransit = () => queryClient.invalidateQueries({ queryKey: ['purchase-orders', po.id] });

  const printChallan = async (c: TransitChallan) => {
    try {
      await openPDF(`/documents/challans/${c.id}/pdf`);
    } catch (err) {
      handleApiError(err, `Could not open ${c.challanNumber}`);
    }
  };
  const confirmCancel = async () => {
    if (!cancelling) return;
    setCancelBusy(true);
    try {
      const result = await challanService.cancelTransitChallan(cancelling.id, cancelReason);
      notify.success(`${result.challanNumber} cancelled`, result.warning ? { description: result.warning } : undefined);
      setCancelling(null);
      setCancelReason('');
      await refreshTransit();
    } catch (err) {
      handleApiError(err, 'Could not cancel the challan');
    } finally {
      setCancelBusy(false);
    }
  };

  const canChange = !FINISHED_STATUSES.includes(po.status);
  const canReceive = RECEIVABLE.includes(po.status);
  const amendments = (po.deliveryPlanRevisions ?? []).filter((r) => !PRE_SEND_STATUSES.includes(r.poStatus)).length;
  const undecidedSoon = deliveryUndecidedSoon(po);
  const warehouseOf = (id: string): WarehouseSummary | null =>
    po.deliveryPoints?.find((p) => p.warehouseId === id)?.warehouse ??
    (po.deliveryLocationId === id ? (po.deliveryWarehouse ?? null) : null);

  const shareInstruction = async () => {
    try {
      await openPDF(`/documents/purchase-orders/${po.id}/delivery-instruction/pdf`);
    } catch (err) {
      handleApiError(err, 'Could not open the Delivery Instruction');
    }
  };

  return (
    <Card className={undecidedSoon ? 'border-warning' : undefined}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Deliver To
            <Badge variant="outline" className="text-xs">
              {mode === 'SPLIT'
                ? `Split · ${po.deliveryPoints?.length} places`
                : mode === 'ONE_PLACE'
                  ? 'One place'
                  : 'To be advised'}
            </Badge>
            {amendments > 0 && (
              <Badge variant="outline" className="text-xs border-amber-300 bg-amber-100 text-amber-800">
                Amendment {amendments}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-1">
            {mode !== 'TO_BE_ADVISED' && (
              <Button variant="ghost" size="sm" onClick={shareInstruction}>
                <FileText className="h-3.5 w-3.5 mr-1" />
                Delivery instruction
              </Button>
            )}
            {canChange && (
              <Button variant="ghost" size="sm" onClick={() => setDialogOpen(true)}>
                <PenLine className="h-3.5 w-3.5 mr-1" />
                {mode === 'TO_BE_ADVISED' ? 'Set delivery' : 'Change delivery'}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {mode === 'TO_BE_ADVISED' ? (
          <>
            <div className="font-semibold text-lg">To be advised</div>
            <div className="text-sm text-muted-foreground">
              The PO prints "to be advised before dispatch". Set the place (or split it) before the supplier dispatches,
              then share the Delivery Instruction.
            </div>
            {undecidedSoon && (
              <div className="flex items-start gap-2 rounded-md border border-warning bg-warning/10 p-3 text-sm">
                <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                <span>
                  Due {formatDate(po.expectedDeliveryDate)} and the delivery place is not decided yet — tell the
                  supplier where to deliver before it dispatches.
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            {(progress?.points ?? []).map((point) => {
              const wh = warehouseOf(point.warehouseId);
              const planned = point.lines.reduce((s, l) => s + l.planned, 0);
              const got = point.lines.reduce((s, l) => s + l.received, 0);
              const pct = planned > 0 ? Math.min(100, Math.round((got / planned) * 100)) : 100;
              const onTheWay = transitAt(point.warehouseId);
              const openHere = onTheWay.filter((c) => c.transitState === 'OPEN');
              const atProcessor = wh?.warehouseType === 'JOB_WORK';
              return (
                <div key={point.warehouseId} className="rounded-md border p-3 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">
                        {point.sequence ? `${point.sequence}. ` : ''}
                        {point.warehouseName}
                        {wh?.warehouseType === 'JOB_WORK' && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Processor
                          </Badge>
                        )}
                        {!point.planned && (
                          <Badge
                            variant="outline"
                            className="ml-2 text-xs border-amber-300 bg-amber-100 text-amber-800"
                          >
                            Received here, not planned
                          </Badge>
                        )}
                      </div>
                      {wh && <div className="text-xs text-muted-foreground">{addressOf(wh, companyFullAddress)}</div>}
                    </div>
                    {canReceive && point.planned && !point.complete && (
                      <div className="flex flex-wrap gap-1">
                        {atProcessor && (
                          <Button size="sm" variant="outline" onClick={() => setTransitPoint(point)}>
                            <Truck className="h-3.5 w-3.5 mr-1" />
                            Issue challan — goods on the way
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            navigate(
                              `/procurement/grn/new?poId=${po.id}${point.id ? `&pointId=${point.id}` : ''}` +
                                (openHere.length === 1 ? `&challanId=${openHere[0].id}` : '')
                            )
                          }
                        >
                          <PackageCheck className="h-3.5 w-3.5 mr-1" />
                          Receive here
                        </Button>
                      </div>
                    )}
                  </div>
                  {onTheWay.length > 0 && (
                    <div className="space-y-1">
                      {onTheWay.map((c) => {
                        const despatched = c.items
                          .map((i) => `${qty(Number(i.quantity))} ${unitShort(i.unit)}`)
                          .join(' + ');
                        return (
                          <div
                            key={c.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1.5 text-sm"
                          >
                            <span className="flex flex-wrap items-center gap-2">
                              <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-medium">{c.challanNumber}</span>
                              <span>{despatched}</span>
                              {c.transitState === 'OPEN' && (
                                <Badge
                                  variant="outline"
                                  className="text-xs border-amber-300 bg-amber-100 text-amber-800"
                                >
                                  On the way since {formatDate(c.supplierDispatchedAt)}
                                </Badge>
                              )}
                              {c.transitState === 'CLAIMED' && (
                                <Badge variant="outline" className="text-xs">
                                  Receipt {c.directSupplyGrn?.grnNumber} waiting for QC
                                </Badge>
                              )}
                              {c.transitState === 'ADOPTED' && (
                                <Badge
                                  variant="outline"
                                  className="text-xs border-green-300 bg-green-100 text-green-800"
                                >
                                  Arrived {formatDate(c.directSupplyGrn?.receivingDate)} ·{' '}
                                  {c.directSupplyGrn?.grnNumber}
                                </Badge>
                              )}
                            </span>
                            <span className="flex items-center gap-1">
                              <Button size="sm" variant="ghost" className="h-7" onClick={() => printChallan(c)}>
                                <Printer className="h-3.5 w-3.5 mr-1" />
                                Print
                              </Button>
                              {c.transitState === 'OPEN' && canReceive && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7"
                                  onClick={() =>
                                    navigate(
                                      `/procurement/grn/new?poId=${po.id}${point.id ? `&pointId=${point.id}` : ''}&challanId=${c.id}`
                                    )
                                  }
                                >
                                  <PackageCheck className="h-3.5 w-3.5 mr-1" />
                                  Receive
                                </Button>
                              )}
                              {c.transitState === 'OPEN' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-destructive"
                                  onClick={() => {
                                    setCancelReason('');
                                    setCancelling(c);
                                  }}
                                >
                                  <X className="h-3.5 w-3.5 mr-1" />
                                  Cancel
                                </Button>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {point.planned && <Progress value={pct} className="h-1.5" />}
                  <div className="grid gap-1 text-sm">
                    {point.lines.map((l) => (
                      <div key={l.poItemId} className="flex flex-wrap justify-between gap-2">
                        <span className="text-muted-foreground">{l.label}</span>
                        <span>
                          {point.planned ? `${qty(l.planned)} planned · ` : ''}
                          {qty(l.received)} received
                          {point.planned &&
                            (l.complete ? (
                              <span className="text-success"> · complete</span>
                            ) : isQtyZero(l.pending) ? null : (
                              <span className="text-warning"> · {qty(l.pending)} to come</span>
                            ))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {!progress && <div className="text-sm text-muted-foreground">Loading delivery places…</div>}
          </div>
        )}
      </CardContent>

      <DeliveryPlanDialog
        purchaseOrder={po}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={(updated) => onChanged(updated)}
      />
      {transitPoint && (
        <TransitChallanDialog
          purchaseOrder={po}
          point={transitPoint}
          open={transitPoint != null}
          onOpenChange={(o) => !o && setTransitPoint(null)}
          onIssued={refreshTransit}
        />
      )}
      <Dialog open={cancelling != null} onOpenChange={(o) => !o && setCancelling(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel {cancelling?.challanNumber}?</DialogTitle>
            <DialogDescription>
              Only when the goods never went to {cancelling?.toName} — the truck never came, or the supplier sent them
              elsewhere. A cancelled challan is left out of ITC-04.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Why is it cancelled?"
            maxLength={500}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelling(null)} disabled={cancelBusy}>
              Keep it
            </Button>
            <Button
              variant="destructive"
              onClick={confirmCancel}
              disabled={cancelBusy || cancelReason.trim().length < 3}
            >
              Cancel challan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
