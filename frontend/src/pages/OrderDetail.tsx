/**
 * The order page — where the order is, and what is stopping it (rebuilt 2026-09-28).
 *
 * The page it replaces was not used: every number on it was wrong for every order. The status never
 * moved; an 8-step waterfall stopped at "1 of 8" (MRP waited for a LOCKED BOM the team never locks,
 * GRN read a field the API never sent, Processing was hard-coded); "PO Generated" counted cancelled
 * lines; a run being cut read 0 %. Now each card reads its fact from the one place that owns it:
 *   status            orders.status, derived from runs + delivery notes (order-status.helper)
 *   what's stopping   the cutting gate itself (validateOrderItemForStage via /manufacturing/pipeline)
 *   materials         one bucket per live requirement line (order-requirements.helper)
 *   production        each run's cutting / stitching / finishing summaries + its fabric (run-fabric.helper)
 *   dispatch          notes and invoices of the order OR its sale order
 * Nothing waterfalls: a run can be cutting while trims are still on order, which is how the floor works.
 */
import { useState, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueries, useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Package,
  Factory,
  FileText,
  Truck,
  Scissors,
  Split,
  Eye,
  ExternalLink,
  Calculator,
  ArrowRight,
  Wrench,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { getOrderById, createWorkOrdersForOrder } from '../services/order.service';
import workOrderService from '../services/workOrder.service';
import { manufacturingAlertsService, type PipelineBlocker } from '../services/manufacturingAlerts.service';
import { cuttingSummaryService } from '../services/cutting.service';
import { stitchingSummaryService } from '../services/stitching.service';
import { finishingSummaryService } from '../services/finishing.service';
import { getOrderServiceRequirementsSummary } from '../services/serviceRequirement.service';
import { InvoiceStatusLabels } from '../types/invoice.types';
import type { InvoiceStatus } from '../types/invoice.types';
import { DeliveryStatusLabels } from '../types/dispatch.types';
import type { DeliveryStatus } from '../types/dispatch.types';
import type { Order, OrderItemCosting, OrderStatus, RequirementBuckets } from '../types/order.types';
import { OrderStatusLabels } from '../types/order.types';
import type { WorkOrder } from '../types/production.types';
import SplitProductionModal from '../components/SplitProductionModal';
import { DocumentShareMenu } from '@/components/DocumentShareMenu';
import { SizeBreakupDialog } from '@/components/orders/SizeBreakupDialog';
import CancelOrderDialog from '@/components/orders/CancelOrderDialog';
import { useCreateOrderBom } from '@/hooks/useCreateOrderBom';
import { queryKeys } from '@/hooks/useQuery';
import { formatCurrency } from '@/lib/currency';
import { formatQuantity } from '@/lib/formatters';
import { formatDate, toDateInputValue } from '@/lib/date';
import { isQtyZero } from '@/lib/quantity';
import { getErrorMessage, handleApiError, handleApiSuccess } from '../lib/api-error-handler';

const ORDER_STATUS_STYLE: Record<OrderStatus, string> = {
  PENDING: 'bg-warning-muted text-warning',
  IN_PRODUCTION: 'bg-info-muted text-info',
  COMPLETED: 'bg-success-muted text-success',
  DISPATCHED: 'bg-success-muted text-success',
  CANCELLED: 'bg-destructive/10 text-destructive',
  SPLIT: 'bg-muted text-foreground',
};

const RUN_STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-warning-muted text-warning',
  IN_PRODUCTION: 'bg-info-muted text-info',
  COMPLETED: 'bg-success-muted text-success',
  DISPATCHED: 'bg-accent/10 text-accent',
  CANCELLED: 'bg-destructive/10 text-destructive',
  SPLIT: 'bg-muted text-foreground',
};

const CLOSED: OrderStatus[] = ['CANCELLED', 'COMPLETED', 'DISPATCHED', 'SPLIT'];

/** Days from today (IST calendar) to the date; negative when it has passed. */
function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  const today = Date.parse(toDateInputValue(new Date()));
  const due = Date.parse(toDateInputValue(date));
  return Number.isNaN(due) ? null : Math.round((due - today) / 86_400_000);
}

/** Where each blocker is fixed. */
function blockerLink(
  blocker: PipelineBlocker,
  order: Order,
  styleId: string | null
): { label: string; to: string } | null {
  if (blocker.type.endsWith('_SAMPLE_NOT_APPROVED') || blocker.type === 'SAMPLE_LAB_NOT_PASSED') {
    return styleId ? { label: 'Open the style', to: `/styles/${styleId}` } : { label: 'Open samples', to: '/samples' };
  }
  if (blocker.type === 'FPT_NOT_PASSED') return { label: 'Fabric tests', to: '/fabric-physical-tests' };
  if (blocker.type === 'GPT_NOT_PASSED') return { label: 'Garment tests', to: '/garment-physical-tests' };
  if (blocker.type === 'MATERIAL_SHORTAGE') {
    return { label: 'Requirements', to: `/procurement/requirements?tab=material&orderId=${order.id}` };
  }
  if (blocker.type === 'PRODUCTION_CAD_MISSING') return { label: 'CAD Planning', to: '/cad-planning' };
  return null;
}

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [splitRun, setSplitRun] = useState<WorkOrder | null>(null);
  const [sizeBreakupItem, setSizeBreakupItem] = useState<{
    initialBreakup?: Array<{ colorId: string | null; sizeId: string; quantity: number }>;
    orderItemId: string;
    styleId: string;
    currentTotal: number;
  } | null>(null);

  const { createBom, creatingOrderId, dialog: createBomDialog } = useCreateOrderBom();

  // Everything this page shows moves together: one refresh after any action on it.
  const refreshOrder = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.workOrders.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.mrp.all });
    queryClient.invalidateQueries({ queryKey: ['manufacturing', 'pipeline'] });
    queryClient.invalidateQueries({ queryKey: ['order-page-run'] });
  };

  const {
    data: order,
    isLoading,
    error: orderError,
  } = useQuery({
    queryKey: queryKeys.orders.detail(id || ''),
    queryFn: () => getOrderById(id!),
    enabled: !!id,
    staleTime: 30 * 1000,
  });

  const { data: allRuns = [], error: runsError } = useQuery({
    queryKey: queryKeys.workOrders.forOrder(id || ''),
    queryFn: () => workOrderService.getByOrderId(id!),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
  const runs = allRuns.filter((wo) => wo.status !== 'CANCELLED');

  const orderOpen = !!order && !CLOSED.includes(order.status);
  const { data: pipeline, error: pipelineError } = useQuery({
    queryKey: ['manufacturing', 'pipeline', 'order', id],
    queryFn: () => manufacturingAlertsService.getPipelineForOrder(id!),
    enabled: !!id && orderOpen,
    staleTime: 30 * 1000,
  });

  // Each started run's progress, from the stage pages' own per-run summaries
  const startedRuns = runs.filter((wo) => wo.status !== 'PENDING' || wo.completedQuantity > 0);
  const runProgress = useQueries({
    queries: startedRuns.map((wo) => ({
      queryKey: ['order-page-run', wo.id],
      queryFn: async () => {
        const [cutting, stitching, finishing] = await Promise.all([
          cuttingSummaryService.getSummaryByWorkOrder(wo.id),
          stitchingSummaryService.getSummaryByWorkOrder(wo.id),
          finishingSummaryService.getSummaryByWorkOrder(wo.id),
        ]);
        return { cutting, stitching, finishing };
      },
      staleTime: 30 * 1000,
    })),
  });
  const progressOf = (runId: string) => runProgress[startedRuns.findIndex((wo) => wo.id === runId)]?.data;

  const { data: serviceSummary } = useQuery({
    queryKey: queryKeys.serviceRequirements.forOrder(id || ''),
    queryFn: () => getOrderServiceRequirementsSummary(id!),
    enabled: !!id && runs.length > 0,
    staleTime: 30 * 1000,
  });

  const createWorkOrdersMutation = useMutation({
    mutationFn: () => createWorkOrdersForOrder(id!),
    onSuccess: (result) => {
      if (result.failed.length > 0) {
        handleApiError(
          new Error(result.failed.map((f) => f.reason).join('; ')),
          `${result.created.length} created, ${result.failed.length} could not be created`
        );
      } else if (result.created.length === 0) {
        handleApiSuccess('Nothing to create', 'Every order line already has a production run.');
      } else {
        handleApiSuccess('Production run created', `${result.created.join(', ')} created.`);
      }
      refreshOrder();
    },
    onError: (err) => handleApiError(err, 'Failed to create production runs'),
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center py-8">Loading order details...</div>
      </div>
    );
  }

  if (orderError || !order) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-destructive">
              {orderError ? getErrorMessage(orderError) : 'Order not found'}
            </div>
            <div className="text-center mt-4">
              <Button onClick={() => navigate('/orders')}>Back to Orders</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const items = order.orderItems ?? [];
  const due = daysUntil(order.expectedDeliveryDate);
  const late = due !== null && due < 0 && order.status !== 'DISPATCHED' && order.status !== 'CANCELLED';

  // Each style's latest active BOM (the API sends every version, newest first)
  const bomOf = (styleId: string) => (order.orderBoms ?? []).find((b) => b.styleId === styleId && b.isActive !== false);
  const liveRunFor = (itemId: string) => runs.some((wo) => wo.orderItemId === itemId);
  const canPlanRun = orderOpen && items.some((item) => (item.breakup?.length ?? 0) > 0 && !liveRunFor(item.id));

  const material = order.requirementsSummary?.material;
  const processing = order.requirementsSummary?.processing;
  const shipment = order.shipment;
  const notes = order.dispatchNotes ?? [];
  const invoices = order.orderInvoices ?? [];

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-display font-medium">{order.orderNumber}</h1>
            <span
              className={`px-3 py-1 rounded text-sm font-medium ${ORDER_STATUS_STYLE[order.status]}`}
              title={order.statusReason ?? undefined}
            >
              {OrderStatusLabels[order.status]}
            </span>
            {order.saleOrder && (
              <button
                onClick={() => navigate(`/sale-orders/${order.saleOrder!.id}`)}
                className="inline-flex items-center rounded border px-2 py-0.5 text-xs font-mono text-muted-foreground hover:bg-muted"
                title={
                  order.saleOrder.buyerPoNumber ? `Buyer PO ${order.saleOrder.buyerPoNumber}` : 'Linked sale order'
                }
              >
                SO {order.saleOrder.saleOrderNumber}
              </button>
            )}
          </div>
          {order.statusReason && order.status !== 'CANCELLED' && (
            <div className="mt-1 text-sm text-muted-foreground">Status: {order.statusReason}</div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <DocumentShareMenu
            documentType="order"
            documentId={order.id}
            documentNumber={order.orderNumber}
            customerPhone={order.customer?.phone ?? undefined}
          />
          <Button variant="outline" onClick={() => navigate('/orders')}>
            Back to Orders
          </Button>
          {orderOpen && (
            <Button variant="outline" onClick={() => setCancelOpen(true)}>
              Cancel Order
            </Button>
          )}
          {(order.status === 'PENDING' || order.status === 'IN_PRODUCTION') && (
            <Button onClick={() => navigate(`/orders/${order.id}/edit`)}>Edit Order</Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 grid grid-cols-2 md:grid-cols-5 gap-6">
          <div>
            <div className="text-sm text-muted-foreground">Customer</div>
            <div className="mt-1 font-medium">{order.customer?.name}</div>
            <div className="text-xs text-muted-foreground">{order.customer?.code}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Order Date</div>
            <div className="mt-1">{formatDate(order.orderDate)}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Delivery Date</div>
            <div className="mt-1">{formatDate(order.expectedDeliveryDate)}</div>
            {due !== null && order.status !== 'DISPATCHED' && order.status !== 'CANCELLED' && (
              <div
                className={`text-xs font-medium ${late ? 'text-destructive' : due <= 7 ? 'text-warning' : 'text-muted-foreground'}`}
              >
                {late
                  ? `${-due} day${due === -1 ? '' : 's'} late`
                  : due === 0
                    ? 'due today'
                    : `due in ${due} day${due === 1 ? '' : 's'}`}
              </div>
            )}
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Quantity</div>
            <div className="mt-1 text-lg font-semibold">{formatQuantity(order.totalQuantity, 'PIECE', 0)}</div>
            {shipment && shipment.shipped > 0 && (
              <div className="text-xs text-muted-foreground">
                {formatQuantity(shipment.shipped, 'PIECE', 0)} shipped
              </div>
            )}
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Amount</div>
            <div className="mt-1 text-lg font-semibold">
              {Number(order.totalAmount) > 0 ? (
                formatCurrency(order.totalAmount)
              ) : (
                <span className="text-warning bg-warning-muted px-2 py-1 rounded text-sm">Pricing Pending</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── What's stopping it ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            What&apos;s stopping it
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {order.status === 'CANCELLED' ? (
            <div className="text-muted-foreground">This order is cancelled.</div>
          ) : !orderOpen ? (
            <div className="flex items-center gap-2 text-success">
              <CheckCircle2 className="h-5 w-5" /> Production is finished
              {order.status === 'DISPATCHED' ? ' and shipped' : ''}.
            </div>
          ) : pipelineError ? (
            <div className="text-destructive text-sm">Could not check the order: {getErrorMessage(pipelineError)}</div>
          ) : (
            items.map((item) => {
              const line = pipeline?.orders.find((o) => o.orderItemId === item.id);
              const hasSizes = (item.breakup?.length ?? 0) > 0;
              const bom = bomOf(item.styleId);
              const label = item.style?.styleCode ?? 'Line';
              if (liveRunFor(item.id)) {
                const itemRuns = runs.filter((wo) => wo.orderItemId === item.id);
                return (
                  <div key={item.id} className="flex items-start gap-2">
                    <Factory className="h-5 w-5 text-info mt-0.5" />
                    <div>
                      <span className="font-medium">{label}</span> — production run{itemRuns.length > 1 ? 's' : ''}{' '}
                      {itemRuns
                        .map((wo) => `${wo.workOrderNumber} (${wo.status.replace(/_/g, ' ').toLowerCase()})`)
                        .join(', ')}
                      . See Production below.
                    </div>
                  </div>
                );
              }
              const blockers = line?.blockers ?? [];
              return (
                <div key={item.id} className="rounded-lg border p-3">
                  <div className="font-medium mb-2">{label}</div>
                  <ul className="space-y-2 text-sm">
                    {!bom && (
                      <li className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-destructive" />
                        No BOM yet.
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={creatingOrderId === order.id}
                          onClick={() =>
                            void createBom({ orderId: order.id, styleId: item.styleId, orderItemId: item.id })
                          }
                        >
                          {creatingOrderId === order.id ? 'Creating…' : 'Create BOM'}
                        </Button>
                      </li>
                    )}
                    {bom?.status === 'DRAFT' && (
                      <li className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-warning" />
                        BOM v{bom.version} is a draft — review and approve it.
                        <Button size="sm" variant="outline" onClick={() => navigate(`/order-bom/${bom.id}`)}>
                          Review BOM
                        </Button>
                      </li>
                    )}
                    {!hasSizes && (
                      <li className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-warning" />
                        Size breakdown not given — the production run is planned once the sizes are in.
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setSizeBreakupItem({
                              orderItemId: item.id,
                              styleId: item.styleId,
                              currentTotal: item.totalQuantity,
                            })
                          }
                        >
                          Add Size Breakdown
                        </Button>
                      </li>
                    )}
                    {blockers.map((b, i) => {
                      const link = blockerLink(b, order, item.styleId);
                      return (
                        <li key={i} className="flex items-center gap-2">
                          <AlertCircle
                            className={`h-4 w-4 ${b.severity === 'CRITICAL' ? 'text-destructive' : 'text-warning'}`}
                          />
                          <span>{b.message}</span>
                          {link && (
                            <Button size="sm" variant="ghost" onClick={() => navigate(link.to)}>
                              {link.label} <ArrowRight className="h-3 w-3 ml-1" />
                            </Button>
                          )}
                        </li>
                      );
                    })}
                    {pipeline && blockers.length === 0 && bom && bom.status !== 'DRAFT' && hasSizes && (
                      <li className="flex items-center gap-2 text-success">
                        <CheckCircle2 className="h-4 w-4" /> Ready to cut — plan the production run.
                        <Button
                          size="sm"
                          onClick={() => createWorkOrdersMutation.mutate()}
                          disabled={createWorkOrdersMutation.isPending}
                        >
                          {createWorkOrdersMutation.isPending ? 'Creating…' : 'Create Production Run'}
                        </Button>
                      </li>
                    )}
                    {!pipeline && <li className="text-muted-foreground">Checking…</li>}
                  </ul>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* ── Materials ───────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Materials
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/procurement/requirements?tab=material&orderId=${order.id}`)}
            >
              Open Requirements <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!material || material.live + (processing?.live ?? 0) === 0 ? (
            <div className="text-sm text-muted-foreground">
              No requirements yet — they are worked out when the order&apos;s BOM is approved.
            </div>
          ) : (
            <>
              <RequirementRow title="Materials to buy" buckets={material} />
              {processing && processing.live > 0 && (
                <RequirementRow
                  title="Processing (dyeing / printing)"
                  buckets={processing}
                  onOpen={() => navigate(`/procurement/requirements?tab=outsourced&orderId=${order.id}`)}
                />
              )}
            </>
          )}
          {serviceSummary && serviceSummary.totalServices > 0 && (
            <div className="rounded-lg border p-3 text-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium flex items-center gap-2">
                  <Wrench className="h-4 w-4" /> Services on the production runs
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/procurement/requirements?tab=outsourced&orderId=${order.id}`)}
                >
                  Open <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-4">
                <span>To assign: {serviceSummary.pendingServices}</span>
                <span>Job work created: {serviceSummary.poGenerated}</span>
                <span>Completed: {serviceSummary.completed}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Production ──────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Factory className="h-5 w-5" />
              Production
            </CardTitle>
            {canPlanRun && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => createWorkOrdersMutation.mutate()}
                disabled={createWorkOrdersMutation.isPending}
              >
                {createWorkOrdersMutation.isPending ? 'Creating…' : 'Create Production Run'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {runsError ? (
            <div className="text-destructive text-sm">
              Could not load the production runs: {getErrorMessage(runsError)}
            </div>
          ) : runs.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No production run yet. One is planned per order line once its sizes are in — see What&apos;s stopping it.
            </div>
          ) : (
            <div className="space-y-4">
              {runs.map((wo) => {
                const progress = progressOf(wo.id);
                const fabric = order.runFabric?.find((f) => f.workOrderId === wo.id);
                const cut = progress?.cutting.totalPcsCut ?? 0;
                const stitched = progress?.stitching.totalCompleted ?? 0;
                const finished = progress?.finishing.totalFinished ?? 0;
                const pct =
                  wo.totalQuantity > 0 ? Math.min(100, Math.round((wo.completedQuantity / wo.totalQuantity) * 100)) : 0;
                return (
                  <div key={wo.id} className="border rounded-lg p-4">
                    <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-lg">{wo.workOrderNumber}</h4>
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${RUN_STATUS_STYLE[wo.status] ?? ''}`}
                          >
                            {wo.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {wo.style?.styleCode} · planned {formatDate(wo.plannedStartDate)} →{' '}
                          {formatDate(wo.plannedEndDate)}
                          {wo.warehouse?.warehouseName ? ` · ${wo.warehouse.warehouseName}` : ''}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {wo.status === 'PENDING' && wo.totalQuantity > 1 && (wo.breakup?.length ?? 0) > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSplitRun(wo)}
                            title="Split for partial dispatch"
                          >
                            <Split className="h-4 w-4 mr-1" />
                            Split
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/production/work-orders/${wo.id}`)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                      <Stage icon={<Scissors className="h-4 w-4" />} label="Fabric issued">
                        {fabric && !isQtyZero(fabric.issued - fabric.returned) ? (
                          <>
                            {/* Net of returns: a deleted batch's fabric goes back to the store and is issued
                                again — WO2609-0087 read "3,408 m" for 1,704 m (2026-09-28) */}
                            {formatQuantity(fabric.issued - fabric.returned, 'METER')}
                            {fabric.atCutting > 0 && (
                              <div className="text-xs text-muted-foreground">
                                {formatQuantity(fabric.atCutting, 'METER')} still at Cutting
                              </div>
                            )}
                          </>
                        ) : (
                          '—'
                        )}
                      </Stage>
                      <Stage label="Cut">
                        {progress
                          ? `${formatQuantity(cut, 'PIECE', 0)} of ${formatQuantity(wo.totalQuantity, 'PIECE', 0)}`
                          : '—'}
                      </Stage>
                      <Stage label="Stitched">{progress ? formatQuantity(stitched, 'PIECE', 0) : '—'}</Stage>
                      <Stage label="Finished">{progress ? formatQuantity(finished, 'PIECE', 0) : '—'}</Stage>
                      <Stage label="Completed">
                        {formatQuantity(wo.completedQuantity, 'PIECE', 0)} ({pct}%)
                      </Stage>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Items & sizes ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Items &amp; Sizes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {items.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">No items found for this order</div>
          )}
          {items.map((item) => (
            <div key={item.id} className="border rounded-lg p-4">
              <div className="flex flex-wrap justify-between items-start gap-2 mb-4">
                <div>
                  <h3 className="font-semibold text-lg">
                    {item.style?.styleCode}
                    {item.style?.buyerStyleRef && item.style.buyerStyleRef !== item.style.styleCode && (
                      <span className="text-muted-foreground font-normal"> ({item.style.buyerStyleRef})</span>
                    )}
                  </h3>
                  <div className="text-sm text-muted-foreground">{item.style?.styleName}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold">{formatQuantity(item.totalQuantity, 'PIECE', 0)}</div>
                  <div className="text-sm text-muted-foreground">
                    {Number(item.unitPrice) > 0
                      ? `${formatCurrency(item.unitPrice)} / pc · ${formatCurrency(item.totalPrice)}`
                      : 'Price not set'}
                  </div>
                </div>
              </div>

              {item.breakup && item.breakup.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-foreground">Size breakdown</div>
                    {orderOpen && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setSizeBreakupItem({
                            orderItemId: item.id,
                            styleId: item.styleId,
                            currentTotal: item.totalQuantity,
                            initialBreakup: (item.breakup ?? []).map((b) => ({
                              colorId: b.colorId,
                              sizeId: b.sizeId,
                              quantity: b.quantity,
                            })),
                          })
                        }
                      >
                        Edit Size Breakdown
                      </Button>
                    )}
                  </div>
                  <SizeGrid breakup={item.breakup} />
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Size breakdown not given yet (ordered as {item.totalQuantity} pcs). Fabric, greige, processing and
                  most trims can be bought without it; size-wise labels wait for it.
                </div>
              )}

              <CostingDetails costing={item.orderItemCosting} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── BOM ─────────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            Order BOM
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((item) => {
            const bom = bomOf(item.styleId);
            return (
              <div key={item.id} className="border rounded-lg p-4 flex flex-wrap justify-between items-center gap-3">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-semibold">{item.style?.styleCode}</span>
                    {bom && <Badge variant="outline">v{bom.version}</Badge>}
                    {bom && <Badge variant={bom.status === 'DRAFT' ? 'secondary' : 'default'}>{bom.status}</Badge>}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {bom
                      ? `${bom._count?.items ?? 0} lines · material cost ${bom.totalMaterialCost != null ? formatCurrency(bom.totalMaterialCost) : '—'}`
                      : 'No BOM yet — it is built from the style’s approved raw-material cost sheet.'}
                  </div>
                </div>
                {bom ? (
                  <Button variant="outline" size="sm" onClick={() => navigate(`/order-bom/${bom.id}`)}>
                    <ExternalLink className="h-4 w-4 mr-1" />
                    {bom.status === 'DRAFT' ? 'Review BOM' : 'View BOM'}
                  </Button>
                ) : (
                  orderOpen && (
                    <Button
                      size="sm"
                      disabled={creatingOrderId === order.id}
                      onClick={() => void createBom({ orderId: order.id, styleId: item.styleId, orderItemId: item.id })}
                    >
                      {creatingOrderId === order.id ? 'Creating…' : 'Create BOM'}
                    </Button>
                  )
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* ── Dispatch & billing (once there is something to show) ─────────────── */}
      {(notes.length > 0 || invoices.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Dispatch &amp; Billing
              {shipment && (
                <span className="text-sm font-normal text-muted-foreground">
                  · {formatQuantity(shipment.shipped, 'PIECE', 0)} of {formatQuantity(shipment.ordered, 'PIECE', 0)}{' '}
                  shipped
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center gap-2 mb-3 text-sm font-medium text-muted-foreground">
                  <Truck className="h-4 w-4" />
                  Delivery Notes <Badge variant="secondary">{notes.length}</Badge>
                </div>
                {notes.length === 0 ? (
                  <div className="text-sm text-muted-foreground">None yet</div>
                ) : (
                  <div className="space-y-2">
                    {notes.map((dn) => (
                      <button
                        key={dn.id}
                        onClick={() => navigate(`/manufacturing/dispatch/delivery/${dn.id}`)}
                        className="w-full flex items-center justify-between rounded-md border p-2 text-sm hover:border-gray-400 transition-colors"
                      >
                        <span className={`font-medium text-primary ${dn.status === 'CANCELLED' ? 'line-through' : ''}`}>
                          {dn.deliveryNumber}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="text-muted-foreground">
                            {formatDate(dn.deliveryDate)} · {formatQuantity(dn.quantity, 'PIECE', 0)}
                          </span>
                          <Badge variant="outline">
                            {DeliveryStatusLabels[dn.status as DeliveryStatus] ?? dn.status}
                          </Badge>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-3 text-sm font-medium text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  Invoices <Badge variant="secondary">{invoices.length}</Badge>
                </div>
                {invoices.length === 0 ? (
                  <div className="text-sm text-muted-foreground">None yet</div>
                ) : (
                  <div className="space-y-2">
                    {invoices.map((inv) => (
                      <button
                        key={inv.id}
                        onClick={() => navigate(`/invoices/${inv.id}`)}
                        className="w-full flex items-center justify-between rounded-md border p-2 text-sm hover:border-gray-400 transition-colors"
                      >
                        <span className="font-medium text-primary">{inv.invoiceNumber}</span>
                        <span className="flex items-center gap-2">
                          <span className="text-muted-foreground">{formatCurrency(inv.totalAmount)}</span>
                          <Badge variant="outline">
                            {InvoiceStatusLabels[inv.status as InvoiceStatus] ?? inv.status}
                          </Badge>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}
      <CancelOrderDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        orderId={order.id}
        orderNumber={order.orderNumber}
        onCancelled={refreshOrder}
      />

      {splitRun && (
        <SplitProductionModal
          isOpen={splitRun != null}
          onClose={() => setSplitRun(null)}
          workOrder={splitRun}
          onSplitComplete={() => {
            setSplitRun(null);
            refreshOrder();
          }}
        />
      )}

      {sizeBreakupItem && (
        <SizeBreakupDialog
          open={!!sizeBreakupItem}
          onOpenChange={(open) => !open && setSizeBreakupItem(null)}
          orderId={order.id}
          orderItemId={sizeBreakupItem.orderItemId}
          styleId={sizeBreakupItem.styleId}
          currentTotal={sizeBreakupItem.currentTotal}
          initialBreakup={sizeBreakupItem.initialBreakup}
          onSaved={() => {
            setSizeBreakupItem(null);
            // Saving the breakup also rewrites requirements and production runs server-side
            refreshOrder();
          }}
        />
      )}

      {createBomDialog}
    </div>
  );
}

/** Colour × size grid of an order line's breakup (one row per colour — normally one: a style has one colour). */
function SizeGrid({ breakup }: { breakup: NonNullable<Order['orderItems']>[number]['breakup'] }) {
  const sizes: Array<{ id: string; name: string }> = [];
  const colours: Array<{ id: string; name: string }> = [];
  for (const b of breakup) {
    if (!sizes.some((s) => s.id === b.sizeId)) sizes.push({ id: b.sizeId, name: b.sizeOptions?.sizeName || '—' });
    const colourId = b.colorId ?? '';
    if (!colours.some((c) => c.id === colourId)) colours.push({ id: colourId, name: b.colorOptions?.colorName || '—' });
  }
  const qty = (colourId: string, sizeId: string) =>
    breakup
      .filter((b) => (b.colorId ?? '') === colourId && b.sizeId === sizeId)
      .reduce((sum, b) => sum + b.quantity, 0);
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="border px-4 py-2 text-left">Colour</th>
            {sizes.map((s) => (
              <th key={s.id} className="border px-4 py-2 text-right">
                {s.name}
              </th>
            ))}
            <th className="border px-4 py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {colours.map((c) => (
            <tr key={c.id}>
              <td className="border px-4 py-2">{c.name}</td>
              {sizes.map((s) => (
                <td key={s.id} className="border px-4 py-2 text-right font-medium">
                  {qty(c.id, s.id) || ''}
                </td>
              ))}
              <td className="border px-4 py-2 text-right font-semibold">
                {sizes.reduce((sum, s) => sum + qty(c.id, s.id), 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One requirement type's lines, each in exactly one bucket. */
function RequirementRow({
  title,
  buckets,
  onOpen,
}: {
  title: string;
  buckets: RequirementBuckets;
  onOpen?: () => void;
}) {
  const inHandOrComing = buckets.onOrder + buckets.received + buckets.fromStock;
  const pct = buckets.live > 0 ? Math.round((inHandOrComing / buckets.live) * 100) : 0;
  const tiles: Array<[string, number, string]> = [
    ['To order', buckets.toOrder, buckets.toOrder > 0 ? 'text-destructive' : 'text-muted-foreground'],
    ['On order', buckets.onOrder, 'text-info'],
    ['Received', buckets.received, 'text-success'],
    ['From stock', buckets.fromStock, 'text-success'],
  ];
  if (buckets.waitingSizes > 0) tiles.push(['Waiting for sizes', buckets.waitingSizes, 'text-warning']);
  if (buckets.needDecision > 0) tiles.push(['Needs a decision', buckets.needDecision, 'text-warning']);
  if (buckets.notChecked > 0) tiles.push(['Not checked', buckets.notChecked, 'text-muted-foreground']);
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between mb-2 text-sm">
        <span className="font-medium">
          {title} — {buckets.live} line{buckets.live === 1 ? '' : 's'}
        </span>
        <span className="flex items-center gap-2 text-muted-foreground">
          {pct}% ordered or in hand
          {onOpen && (
            <Button variant="ghost" size="sm" onClick={onOpen}>
              Open <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        {tiles.map(([label, count, tone]) => (
          <div key={label} className="bg-card rounded-md border p-2 text-center">
            <div className={`text-xl font-bold ${tone}`}>{count}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>
      <div className="w-full bg-muted rounded-full h-1.5 mt-3">
        <div className="bg-info h-1.5 rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Stage({ label, icon, children }: { label: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className="text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className="font-medium">{children}</div>
    </div>
  );
}

/**
 * The costed build-up per piece: the parts, value loss, markup and the price. The cost sheet stores
 * its PRICE as "totalCostPerPiece" (122.64 = 104.56 + 2 % loss + 15 % markup for ESSKY085LS), so the
 * page used to label the price "Total cost". Cost and markup now show separately.
 */
function CostingDetails({ costing }: { costing: OrderItemCosting | null | undefined }) {
  if (!costing) return null;
  const snap = (costing.costingSnapshot ?? {}) as Record<string, unknown>;
  const n = (v: unknown) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
  const valueLoss = n(snap.valueLossAmount);
  const valueLossPct = n(snap.valueLossPercent);
  const markup = n(snap.markupAmount);
  const markupPct = n(snap.markupPercent);
  const price = Number(costing.totalCostPerPiece);
  const cost = costing.estimatedCostPerPiece != null ? Number(costing.estimatedCostPerPiece) : null;
  const parts: Array<[string, number]> = [
    ['Fabric', costing.fabricTotal],
    ['Trims', costing.trimsTotal],
    ['Accessories', costing.accessoriesTotal],
    ['Processing', costing.processingTotal],
    ['Embroidery', costing.embroideryTotal],
    ['CMT', costing.cmtTotal],
    ['Overheads', costing.overheadsTotal],
  ];
  const variance = costing.costVariancePercent;
  return (
    <div className="mt-4 p-4 bg-muted rounded-lg border">
      <div className="flex items-center gap-2 mb-3">
        <Calculator className="h-4 w-4 text-muted-foreground" />
        <h4 className="font-medium text-foreground">Costing (per piece)</h4>
        {costing.originalCostSheetVersion && (
          <Badge variant="outline" className="text-xs">
            cost sheet v{costing.originalCostSheetVersion}
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 text-sm">
        {parts
          .filter(([, value]) => Number(value) !== 0)
          .map(([label, value]) => (
            <div key={label}>
              <div className="text-muted-foreground">{label}</div>
              <div className="font-medium">{formatCurrency(value)}</div>
            </div>
          ))}
        {valueLoss != null && valueLoss !== 0 && (
          <div>
            <div className="text-muted-foreground">Value loss{valueLossPct != null ? ` ${valueLossPct}%` : ''}</div>
            <div className="font-medium">{formatCurrency(valueLoss)}</div>
          </div>
        )}
        {cost != null && cost !== price && (
          <div>
            <div className="text-muted-foreground">Cost</div>
            <div className="font-semibold">{formatCurrency(cost)}</div>
          </div>
        )}
        {markup != null && markup !== 0 && (
          <div>
            <div className="text-muted-foreground">Markup{markupPct != null ? ` ${markupPct}%` : ''}</div>
            <div className="font-medium">{formatCurrency(markup)}</div>
          </div>
        )}
        <div>
          <div className="text-muted-foreground">{cost != null && cost !== price ? 'Price' : 'Total'}</div>
          <div className="font-semibold">{formatCurrency(price)}</div>
        </div>
      </div>
      {costing.actualCostPerPiece != null && (
        <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center gap-4 text-sm">
          <span>
            Actual cost {formatCurrency(costing.actualCostPerPiece)} / pc against {formatCurrency(cost ?? price)} costed
          </span>
          {variance != null && (
            <Badge variant={Number(variance) > 0 ? 'destructive' : 'secondary'} className="flex items-center gap-1">
              {Number(variance) > 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : Number(variance) < 0 ? (
                <TrendingDown className="h-3 w-3" />
              ) : (
                <Minus className="h-3 w-3" />
              )}
              {Number(variance) > 0 ? '+' : ''}
              {Number(variance).toFixed(1)}%
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
