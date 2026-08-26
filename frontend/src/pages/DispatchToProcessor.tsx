/**
 * Dispatch to Processor — one truck, one processor, several job work orders, ONE challan.
 *
 * The event this screen models: a vehicle leaves for the dyer carrying 5,000 m of one greige for
 * one style, 3,000 m of another for a second, 2,000 m for a third. Each of those stays its own
 * job work order — own rate, shrinkage, receipt date and loss reconciliation — because that is
 * what the commercial terms and Section 143 are per. What was missing was the dispatch above
 * them, so the same vehicle used to produce three separate challans.
 *
 * Issuing a SINGLE order is unchanged and still lives on the order's own page; this screen is for
 * the case where several go together.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, Loader2, Truck } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

import { GreigeLotRows } from '@/components/job-work/GreigeLotRows';
import {
  ISSUE_QTY_TOLERANCE,
  autoFillLotRows,
  emptyLotRow,
  evaluateLotRows,
  round2,
  type IssueLotRow,
} from '@/components/job-work/lot-rows';
import { jobWorkOrderService, type DispatchOrderInput, type DispatchableOrder } from '@/services/jobWorkOrder.service';
import { SupplierCombobox } from '@/components/SupplierCombobox';

/**
 * Blockers no lot selection can clear. Everything else the server reports on a dispatchable order
 * describes the lot it was STAMPED with at creation, which the rows here replace.
 */
const FATAL_BLOCKER_CODES = new Set(['ALREADY_ISSUED', 'ORDER_CANCELLED', 'NOT_FOUND']);

interface OrderSelection {
  selected: boolean;
  rows: IssueLotRow[];
}

export default function DispatchToProcessor() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [processorId, setProcessorId] = useState('');
  const [sentDate, setSentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [challanNumber, setChallanNumber] = useState('');
  const [widthAcknowledged, setWidthAcknowledged] = useState(false);
  const [selection, setSelection] = useState<Record<string, OrderSelection>>({});
  /** Per-order message from a rejected submit, shown against the row it belongs to. */
  const [orderErrors, setOrderErrors] = useState<Record<string, string>>({});

  const {
    data: dispatchable,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['jwo-dispatchable', processorId],
    queryFn: () => jobWorkOrderService.getDispatchable(processorId),
    enabled: !!processorId,
  });

  const orders: DispatchableOrder[] = useMemo(() => dispatchable ?? [], [dispatchable]);

  /** Reset the picked rows whenever the processor changes — the old orders are gone. */
  const changeProcessor = (id: string) => {
    setProcessorId(id);
    setSelection({});
    setOrderErrors({});
    setWidthAcknowledged(false);
  };

  const stateFor = (order: DispatchableOrder): OrderSelection =>
    selection[order.id] ?? { selected: false, rows: [emptyLotRow()] };

  const setStateFor = (orderId: string, patch: Partial<OrderSelection>) =>
    setSelection((prev) => ({
      ...prev,
      [orderId]: { ...(prev[orderId] ?? { selected: false, rows: [emptyLotRow()] }), ...patch },
    }));

  /**
   * Selecting an order pre-fills its lots greedily, so the common case (each order covered by one
   * lot) needs no typing at all — the operator only intervenes where a split is genuinely needed.
   */
  const toggleOrder = (order: DispatchableOrder, selected: boolean) => {
    const current = stateFor(order);
    const untouched = current.rows.length === 1 && !current.rows[0].lotId;
    const rows =
      selected && untouched && order.availableLots.length > 0
        ? (autoFillLotRows(order.availableLots, order.requiredQty, current.rows) ?? current.rows)
        : current.rows;
    setStateFor(order.id, { selected, rows });
    // Re-selecting an order clears the message its last rejected submit left on the row
    setOrderErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => id !== order.id)));
  };

  const selectedOrders = orders.filter((o) => stateFor(o).selected);

  /** Everything the Send button depends on, evaluated per order and then across the truck. */
  const assessment = useMemo(() => {
    const perOrder = selectedOrders.map((order) => {
      const state = stateFor(order);
      const needsLots = order.fabricType === 'GREIGE';
      const evaluation = evaluateLotRows({
        rows: state.rows,
        lots: order.availableLots,
        requiredQty: order.requiredQty,
        orderWidthInches: null,
      });
      const fatal = order.blockers.filter((b) => FATAL_BLOCKER_CODES.has(b.code));
      const valid =
        fatal.length === 0 &&
        (!needsLots ||
          (evaluation.rowsComplete &&
            evaluation.totalMatches &&
            !evaluation.hasDuplicateLot &&
            !evaluation.hasMixedGreige));
      return { order, state, evaluation, needsLots, fatal, valid };
    });

    // The server refuses a lot that appears on two orders (LOT_REUSED_ACROSS_ORDERS): each order
    // dedups its own rows but cannot see its siblings'. Mirror it here so the operator is told at
    // the point of the mistake rather than by a rejected submit.
    const lotOwners = new Map<string, string[]>();
    for (const { order, state } of perOrder) {
      for (const row of state.rows) {
        if (!row.lotId) continue;
        lotOwners.set(row.lotId, [...(lotOwners.get(row.lotId) ?? []), order.jobWorkNumber]);
      }
    }
    const reusedLots = [...lotOwners.entries()].filter(([, owners]) => new Set(owners).size > 1);

    const widthAckNeeded = perOrder.some((p) => p.evaluation.needsWidthAck);
    const totalQty = round2(perOrder.reduce((sum, p) => sum + p.evaluation.totalQty, 0));

    return {
      perOrder,
      reusedLots,
      widthAckNeeded,
      totalQty,
      canSend:
        !!processorId &&
        perOrder.length > 0 &&
        perOrder.every((p) => p.valid) &&
        reusedLots.length === 0 &&
        (!widthAckNeeded || widthAcknowledged),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrders, selection, processorId, widthAcknowledged]);

  const dispatchMutation = useMutation({
    mutationFn: () => {
      const payloadOrders: DispatchOrderInput[] = assessment.perOrder.map(({ order, state, needsLots }) => {
        const filled = state.rows.filter((r) => r.lotId && parseFloat(r.qty) > 0);
        if (!needsLots || filled.length === 0) return { jwoId: order.id };
        // A single lot covering the whole order travels as greigeStockLotId, never as a
        // one-element lots[]: the server then consumes the order's own quantity verbatim, so the
        // figure cannot drift by a paisa from a number that went through an input box and back.
        if (filled.length === 1 && Math.abs(parseFloat(filled[0].qty) - order.requiredQty) <= ISSUE_QTY_TOLERANCE) {
          return { jwoId: order.id, greigeStockLotId: filled[0].lotId };
        }
        return {
          jwoId: order.id,
          lots: filled.map((r) => ({ greigeStockLotId: r.lotId, qty: parseFloat(r.qty) })),
        };
      });

      return jobWorkOrderService.dispatch({
        processorId,
        sentDate: sentDate || undefined,
        vehicleNumber: vehicleNumber || undefined,
        challanNumber: challanNumber || undefined,
        acknowledgeWidthMismatch: widthAcknowledged || undefined,
        orders: payloadOrders,
      });
    },
    onSuccess: (result) => {
      toast.success(
        `Challan ${result.data.challanNumber} issued — ${result.data.orders.length} order(s) on their way.`,
        { duration: 8000 }
      );
      if (result.warning) toast.warning(result.warning, { duration: 8000 });
      setSelection({});
      setOrderErrors({});
      setWidthAcknowledged(false);
      queryClient.invalidateQueries({ queryKey: ['jwo-dispatchable'] });
      queryClient.invalidateQueries({ queryKey: ['job-work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['challans'] });
    },
    onError: (error: unknown) => {
      const res = (error as { response?: { data?: { message?: string; code?: string } } })?.response?.data;
      const message = res?.message ?? 'Failed to dispatch';
      // The server names the offending order in the message, so match it back to its row rather
      // than leaving a toast the operator has to reconcile against the list by eye.
      const offending = assessment.perOrder.find((p) => message.includes(p.order.jobWorkNumber));
      if (offending) {
        setOrderErrors((prev) => ({ ...prev, [offending.order.id]: message }));
      }
      toast.error(message, { duration: 10000 });
    },
  });

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/job-work-orders')} aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Truck className="h-6 w-6" />
            Dispatch to Processor
          </h1>
          <p className="text-sm text-muted-foreground">
            Send several job work orders to one processor on a single outward challan. Each order keeps its own rate,
            shrinkage and reconciliation — only the movement document is shared.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>The vehicle</CardTitle>
          <CardDescription>One challan, one destination — every order below travels on it.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2 md:col-span-2">
            <Label>Processor *</Label>
            <SupplierCombobox value={processorId} onValueChange={changeProcessor} placeholder="Select processor..." />
          </div>
          <div className="space-y-2">
            <Label>Dispatch date</Label>
            <Input type="date" value={sentDate} onChange={(e) => setSentDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Vehicle number</Label>
            <Input
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value)}
              placeholder="RJ14 AB 1234"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Manual challan reference</Label>
            <Input
              value={challanNumber}
              onChange={(e) => setChallanNumber(e.target.value)}
              placeholder="Your challan book number (optional)"
            />
          </div>
        </CardContent>
      </Card>

      {!processorId ? (
        <Alert>
          <AlertDescription>Pick a processor to see the orders waiting to go to them.</AlertDescription>
        </Alert>
      ) : isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : isError ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Could not load the orders for this processor</AlertTitle>
          <AlertDescription>
            The list could not be fetched, so this is not a statement that there is nothing to send. Try again, and
            check the API is reachable if it persists.
          </AlertDescription>
        </Alert>
      ) : orders.length === 0 ? (
        <Alert>
          <AlertDescription>
            No approved orders are waiting for this processor. An order appears here once it is approved and before it
            has been sent — a draft has to be approved on its own page first.
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Orders on this truck</CardTitle>
            <CardDescription>
              Tick each order to include it, then confirm which lots leave the building for it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {orders.map((order) => {
              const state = stateFor(order);
              const assessed = assessment.perOrder.find((p) => p.order.id === order.id);
              const fatal = order.blockers.filter((b) => FATAL_BLOCKER_CODES.has(b.code));
              const advisory = order.blockers.filter((b) => !FATAL_BLOCKER_CODES.has(b.code));
              const evaluation =
                assessed?.evaluation ??
                evaluateLotRows({
                  rows: state.rows,
                  lots: order.availableLots,
                  requiredQty: order.requiredQty,
                  orderWidthInches: null,
                });
              const needsLots = order.fabricType === 'GREIGE';

              return (
                <div
                  key={order.id}
                  className={`rounded-md border p-4 ${state.selected ? 'border-primary/50 bg-muted/30' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={state.selected}
                      onCheckedChange={(v) => toggleOrder(order, v === true)}
                      disabled={fatal.length > 0}
                      aria-label={`Include ${order.jobWorkNumber}`}
                      className="mt-1"
                    />
                    <div className="flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{order.jobWorkNumber}</span>
                        <Badge variant="outline">{order.processType}</Badge>
                        {order.styleCode ? (
                          <Badge variant="secondary">{order.styleCode}</Badge>
                        ) : (
                          <Badge variant="secondary">Stock — no style</Badge>
                        )}
                        <span className="text-sm text-muted-foreground">
                          {order.requiredQty.toFixed(2)} {order.uom}
                        </span>
                      </div>
                      {order.expectedGreige && (
                        <p className="text-xs text-muted-foreground">
                          Cloth: {order.expectedGreige.greigeCode} — {order.expectedGreige.greigeName}
                        </p>
                      )}
                      {fatal.map((b) => (
                        <p key={b.code} className="text-xs text-red-600">
                          {b.message}
                        </p>
                      ))}
                      {state.selected &&
                        advisory.map((b) => (
                          <p key={b.code} className="text-xs text-amber-600">
                            {b.message}
                          </p>
                        ))}
                      {orderErrors[order.id] && <p className="text-xs text-red-600">{orderErrors[order.id]}</p>}
                    </div>
                  </div>

                  {state.selected && needsLots && (
                    <div className="mt-3 pl-7">
                      {order.availableLots.length === 0 ? (
                        <Alert className="border-amber-300 bg-amber-50 text-amber-900">
                          <AlertDescription className="text-sm">
                            No greige lots are available for this order
                            {order.expectedGreige ? ` (${order.expectedGreige.greigeCode})` : ''} — its purchase order
                            has to be received before it can be sent.
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <>
                          {!order.greigeAnchored && (
                            <p className="mb-2 text-xs text-muted-foreground">
                              This order names no cloth of its own, so any greige may be sent — but every row must be
                              the same one, because one order makes one fabric.
                            </p>
                          )}
                          <GreigeLotRows
                            rows={state.rows}
                            onRowsChange={(rows) => setStateFor(order.id, { rows })}
                            lots={order.availableLots}
                            requiredQty={order.requiredQty}
                            uom={order.uom}
                            evaluation={evaluation}
                            disabled={dispatchMutation.isPending}
                          />
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {assessment.reusedLots.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>The same lot is on more than one order</AlertTitle>
          <AlertDescription>
            {assessment.reusedLots.map(([lotId, owners]) => (
              <div key={lotId}>
                A lot is listed on {[...new Set(owners)].join(' and ')}. One roll of cloth can only be sent once — split
                the quantity across different lots.
              </div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {assessment.widthAckNeeded && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-900">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>A lot's width differs from its order</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>At least one chosen lot is wider or narrower than its order expects, beyond the usual loom variation.</p>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={widthAcknowledged} onCheckedChange={(v) => setWidthAcknowledged(v === true)} />
              Send anyway — the width difference is understood
            </label>
          </AlertDescription>
        </Alert>
      )}

      {selectedOrders.length > 0 && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div className="text-sm">
              <span className="font-medium">
                {selectedOrders.length} order{selectedOrders.length === 1 ? '' : 's'}
              </span>{' '}
              <span className="text-muted-foreground">
                · {assessment.totalQty.toFixed(2)} total on one challan
                {vehicleNumber ? ` · ${vehicleNumber}` : ''}
              </span>
            </div>
            <Button
              onClick={() => dispatchMutation.mutate()}
              disabled={!assessment.canSend || dispatchMutation.isPending}
            >
              {dispatchMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Truck className="mr-2 h-4 w-4" />
              Send on one challan
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
