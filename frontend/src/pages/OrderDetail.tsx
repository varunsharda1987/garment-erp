import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDetailQuery, queryKeys } from '@/hooks/useQuery';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Eye,
  Split,
  Factory,
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  Calculator,
  AlertCircle,
  Package,
  ExternalLink,
  ArrowRight,
  Wrench,
  ClipboardList,
  FileText,
  Truck,
} from 'lucide-react';
import { getOrderById, createWorkOrdersForOrder } from '../services/order.service';
import workOrderService from '../services/workOrder.service';
import { getInvoices } from '../services/invoice.service';
import { deliveryNoteService } from '../services/dispatch.service';
import { InvoiceStatusLabels } from '../types/invoice.types';
import type { Invoice } from '../types/invoice.types';
import { DeliveryStatusLabels } from '../types/dispatch.types';
import type { DeliveryNote } from '../types/dispatch.types';
import {
  getByOrderId as getOrderBOM,
  createFromCostSheet as createOrderBOMFromCostSheet,
  calculateMRPStandalone,
} from '../services/orderBom.service';
import { getStatusBadgeColor } from '../services/orderBom.service';
import { useToast } from '@/hooks/use-toast';
import { getCostSheetVersionsByStyle } from '../services/costSheet.service';
import { getOrderRequirementsSummary } from '../services/mrp.service';
import { getOrderServiceRequirementsSummary } from '../services/serviceRequirement.service';
import type { OrderRequirementsSummary } from '../types/mrp.types';
import type { OrderServiceRequirementsSummary } from '../types/serviceRequirement.types';
import type { OrderBOM } from '../types/orderBom.types';
import type { Order, OrderItemCosting } from '../types/order.types';
import { OrderStatusLabels, PriorityLabels } from '../types/order.types';
import type { WorkOrder } from '../types/production.types';
import SplitProductionModal from '../components/SplitProductionModal';
import { formatCurrency } from '@/lib/currency';
import { OrderWorkflowTracker, buildWorkflowSteps } from '../components/OrderWorkflowTracker';
import { handleApiError, handleApiSuccess } from '../lib/api-error-handler';
import { logError } from '../lib/logger';
import { DocumentShareMenu } from '@/components/DocumentShareMenu';
import { SizeBreakupDialog } from '@/components/orders/SizeBreakupDialog';

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Sizes-later workflow: which order item is having its size breakdown entered
  const [sizeBreakupItem, setSizeBreakupItem] = useState<{
    orderItemId: string;
    styleId: string;
    currentTotal: number;
  } | null>(null);

  // MRP-49: explicit production scheduling (was a hidden side effect of BOM approval).
  const createWorkOrdersMutation = useMutation({
    mutationFn: () => createWorkOrdersForOrder(id!),
    onSuccess: (result) => {
      if (result.failed.length > 0) {
        handleApiError(
          new Error(result.failed.map((f) => f.reason).join('; ')),
          `${result.created.length} created, ${result.failed.length} could not be created`
        );
      } else if (result.created.length === 0) {
        handleApiSuccess('Nothing to create', 'Every order item already has a work order.');
      } else {
        handleApiSuccess('Work Orders Created', `${result.created.length} work order(s) created.`);
      }
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
    },
    onError: (err) => handleApiError(err, 'Failed to create work orders'),
  });

  // Modal state
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);

  // Action loading states
  const [creatingBom, setCreatingBom] = useState(false);
  const [calculatingMrp, setCalculatingMrp] = useState(false);

  // Toast notifications
  const { toast } = useToast();

  // React Query: Fetch order (cached)
  const {
    data: order,
    isLoading,
    error: orderError,
    refetch: _refetchOrder, // eslint-disable-line @typescript-eslint/no-unused-vars
  } = useDetailQuery<Order>(
    queryKeys.orders.detail(id || ''),
    () => getOrderById(id!),
    { enabled: !!id, staleTime: 60 * 1000 } // 1 minute
  );

  // React Query: Fetch work orders (cached)
  // BUG-ORD14: Use consistent queryKeys.workOrders.forOrder pattern
  const {
    data: workOrders = [],
    isLoading: workOrdersLoading,
    refetch: refetchWorkOrders,
  } = useDetailQuery<WorkOrder[]>(queryKeys.workOrders.forOrder(id || ''), () => workOrderService.getByOrderId(id!), {
    enabled: !!id,
    staleTime: 60 * 1000,
  });

  // React Query: Fetch order BOM (cached)
  // BUG-ORD14: Use queryKeys.boms.forOrder (not forStyle - id is orderId)
  const {
    data: orderBom,
    isLoading: bomLoading,
    refetch: refetchOrderBOM,
  } = useDetailQuery<OrderBOM | null>(
    queryKeys.boms.forOrder(id || ''),
    async () => {
      try {
        return await getOrderBOM(id!);
      } catch {
        return null;
      }
    },
    { enabled: !!id, staleTime: 60 * 1000 }
  );

  // Determine if MRP should be fetched
  const shouldFetchMRP = !!id && !!orderBom && (orderBom.status === 'APPROVED' || orderBom.status === 'LOCKED');

  // React Query: Fetch MRP summary (conditional)
  // BUG-ORD14: Use consistent queryKeys.mrp.forOrder pattern
  const {
    data: mrpSummary,
    isLoading: mrpLoading,
    refetch: _refetchMRPSummary, // eslint-disable-line @typescript-eslint/no-unused-vars
  } = useDetailQuery<OrderRequirementsSummary | null>(
    queryKeys.mrp.forOrder(id || ''),
    async () => {
      try {
        return await getOrderRequirementsSummary(id!);
      } catch {
        return null;
      }
    },
    { enabled: shouldFetchMRP, staleTime: 60 * 1000 }
  );

  // Determine if Service summary should be fetched (when work orders exist)
  const shouldFetchServiceSummary = !!id && workOrders.length > 0;

  // React Query: Fetch Service Requirements summary (conditional)
  // BUG-ORD14: Use consistent queryKeys.serviceRequirements.forOrder pattern
  const {
    data: serviceSummary,
    isLoading: serviceLoading,
    refetch: _refetchServiceSummary, // eslint-disable-line @typescript-eslint/no-unused-vars
  } = useDetailQuery<OrderServiceRequirementsSummary | null>(
    queryKeys.serviceRequirements.forOrder(id || ''),
    async () => {
      try {
        return await getOrderServiceRequirementsSummary(id!);
      } catch {
        return null;
      }
    },
    { enabled: shouldFetchServiceSummary, staleTime: 60 * 1000 }
  );

  // React Query: Downstream invoices for this order (billing surfacing)
  const { data: invoices = [] } = useDetailQuery<Invoice[]>(
    [...queryKeys.orders.detail(id || ''), 'invoices'],
    async () => {
      try {
        const res = await getInvoices({ orderId: id!, limit: 100 });
        return res.data;
      } catch {
        return [];
      }
    },
    { enabled: !!id, staleTime: 60 * 1000 }
  );

  // React Query: Downstream delivery notes for this order (dispatch surfacing)
  const { data: deliveryNotes = [] } = useDetailQuery<DeliveryNote[]>(
    [...queryKeys.orders.detail(id || ''), 'delivery-notes'],
    async () => {
      try {
        const res = await deliveryNoteService.getAll({ orderId: id!, limit: 100 });
        return res.data;
      } catch {
        return [];
      }
    },
    { enabled: !!id, staleTime: 60 * 1000 }
  );

  // Error message
  const error = orderError?.message || null;

  // Refresh all data - available for future use
  // const refreshAll = useCallback(() => {
  //   refetchOrder();
  //   refetchWorkOrders();
  //   refetchOrderBOM();
  //   if (shouldFetchMRP) refetchMRPSummary();
  // }, [refetchOrder, refetchWorkOrders, refetchOrderBOM, refetchMRPSummary, shouldFetchMRP]);

  const handleSplitClick = (wo: WorkOrder) => {
    setSelectedWorkOrder(wo);
    setSplitModalOpen(true);
  };

  const handleSplitComplete = () => {
    setSplitModalOpen(false);
    setSelectedWorkOrder(null);
    refetchWorkOrders(); // Refresh the list
  };

  // Create Order BOM from approved cost sheet
  const handleCreateBOM = async () => {
    if (!order || !order.orderItems?.[0]) {
      handleApiError(new Error('No order items found'), 'Cannot create BOM');
      return;
    }

    const orderItem = order.orderItems[0];

    try {
      setCreatingBom(true);

      // Find approved cost sheet for this style WITH purpose filter
      const costSheets = await getCostSheetVersionsByStyle(orderItem.styleId);

      const approvedCostSheet = costSheets.find(
        (cs) =>
          (cs.approvalStatus === 'APPROVED' || cs.isApproved) &&
          (['RAW_MATERIAL_CALCULATION', 'PRODUCTION', 'PROCUREMENT_PRODUCTION'] as string[]).includes(cs.purpose)
      );

      if (!approvedCostSheet) {
        handleApiError(
          new Error('No approved cost sheet found'),
          'Please approve a RAW_MATERIAL_CALCULATION or PRODUCTION cost sheet first'
        );
        return;
      }

      // Validate cost sheet ID before sending
      if (!approvedCostSheet.id) {
        handleApiError(new Error('Cost sheet ID is missing'), 'Cost sheet data is invalid - ID is missing');
        console.error('Cost sheet missing ID:', approvedCostSheet);
        return;
      }

      await createOrderBOMFromCostSheet(order.id, {
        styleId: orderItem.styleId,
        costSheetId: approvedCostSheet.id,
      });

      handleApiSuccess('Order BOM Created', 'BOM has been created. Please review and approve it.');
      refetchOrderBOM(); // Refresh BOM data
    } catch (err) {
      handleApiError(err, 'Failed to create Order BOM');
      logError('Failed to create Order BOM:', err);
    } finally {
      setCreatingBom(false);
    }
  };

  // Navigate to Order BOM detail for review
  const handleReviewBOM = () => {
    if (orderBom) {
      navigate(`/order-bom/${orderBom.id}`);
    }
  };

  // Calculate MRP requirements from Order BOM
  const handleCalculateMRP = async () => {
    if (!order) return;

    try {
      setCalculatingMrp(true);
      const result = await calculateMRPStandalone(order.id, {
        styleId: order.orderItems?.[0]?.styleId,
      });
      toast({
        title: 'MRP Calculated',
        description: `Created ${result.created} requirements, updated ${result.updated}`,
      });
      navigate(`/procurement/requirements?tab=material&orderId=${order.id}`);
    } catch (err) {
      handleApiError(err, 'Failed to calculate MRP requirements');
      logError('Failed to calculate MRP:', err);
    } finally {
      setCalculatingMrp(false);
    }
  };

  // Navigate to MRP requirements page
  const handleViewMRP = () => {
    navigate(`/procurement/requirements?tab=material&orderId=${order?.id}`);
  };

  const calculateProgress = (wo: WorkOrder) => {
    if (wo.totalQuantity === 0) return 0;
    return Math.round((wo.completedQuantity / wo.totalQuantity) * 100);
  };

  const getWorkOrderStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'IN_PRODUCTION':
        return 'bg-info-muted text-info';
      case 'COMPLETED':
        return 'bg-success-muted text-success';
      case 'DISPATCHED':
        return 'bg-accent/10 text-accent';
      case 'CANCELLED':
        return 'bg-destructive/10 text-destructive';
      default:
        return 'bg-muted text-foreground';
    }
  };

  // Note: getStatusBadgeColor is imported from orderBom.service

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case 'LOW':
        return 'bg-muted text-foreground';
      case 'MEDIUM':
        return 'bg-info-muted text-info';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800';
      case 'URGENT':
        return 'bg-destructive/10 text-destructive';
      default:
        return 'bg-muted text-foreground';
    }
  };

  // Render variance badge with icon
  const renderVarianceBadge = (variancePercent: number | null | undefined) => {
    if (variancePercent === null || variancePercent === undefined) return null;
    const percent = Number(variancePercent);
    if (percent > 0) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />+{percent.toFixed(1)}%
        </Badge>
      );
    } else if (percent < 0) {
      return (
        <Badge variant="default" className="flex items-center gap-1 bg-success">
          <TrendingDown className="h-3 w-3" />
          {percent.toFixed(1)}%
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="flex items-center gap-1">
        <Minus className="h-3 w-3" />
        0%
      </Badge>
    );
  };

  // Render costing details for an order item
  const renderCostingDetails = (costing: OrderItemCosting | null | undefined) => {
    if (!costing) return null;

    const hasVariance = costing.costVariancePercent !== null && costing.costVariancePercent !== undefined;
    const hasActualCost = costing.actualCostPerPiece !== null && costing.actualCostPerPiece !== undefined;

    return (
      <div className="mt-4 p-4 bg-muted rounded-lg border">
        <div className="flex items-center gap-2 mb-3">
          <Calculator className="h-4 w-4 text-muted-foreground" />
          <h4 className="font-medium text-foreground">Costing Details</h4>
          {costing.originalCostSheetVersion && (
            <Badge variant="outline" className="text-xs">
              v{costing.originalCostSheetVersion}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Fabric</div>
            <div className="font-medium">{formatCurrency(costing.fabricTotal)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Trims</div>
            <div className="font-medium">{formatCurrency(costing.trimsTotal)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">CMT</div>
            <div className="font-medium">{formatCurrency(costing.cmtTotal)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Embroidery</div>
            <div className="font-medium">{formatCurrency(costing.embroideryTotal)}</div>
          </div>
        </div>

        {/* Variance Section */}
        {(hasVariance || hasActualCost) && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-foreground">Production Variance</span>
              {hasVariance && renderVarianceBadge(costing.costVariancePercent)}
            </div>

            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Estimated Cost/Pc</div>
                <div className="font-medium">
                  {costing.estimatedCostPerPiece !== null && costing.estimatedCostPerPiece !== undefined
                    ? formatCurrency(costing.estimatedCostPerPiece)
                    : '-'}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Actual Cost/Pc</div>
                <div
                  className={`font-medium ${hasVariance && Number(costing.costVariancePercent) > 0 ? 'text-destructive' : hasVariance && Number(costing.costVariancePercent) < 0 ? 'text-success' : ''}`}
                >
                  {hasActualCost ? formatCurrency(costing.actualCostPerPiece!) : '-'}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Variance Amount</div>
                <div
                  className={`font-medium ${costing.costVarianceAmount && Number(costing.costVarianceAmount) > 0 ? 'text-destructive' : costing.costVarianceAmount && Number(costing.costVarianceAmount) < 0 ? 'text-success' : ''}`}
                >
                  {costing.costVarianceAmount !== null && costing.costVarianceAmount !== undefined
                    ? `${Number(costing.costVarianceAmount) > 0 ? '+' : ''}${formatCurrency(costing.costVarianceAmount)}`
                    : '-'}
                </div>
              </div>
            </div>

            {costing.varianceCalculatedAt && (
              <div className="mt-2 text-xs text-muted-foreground">
                Calculated: {new Date(costing.varianceCalculatedAt).toLocaleDateString()}
              </div>
            )}

            {!hasActualCost && (
              <div className="mt-3 flex items-center gap-2 text-xs text-warning bg-warning-muted px-3 py-2 rounded">
                <AlertCircle className="h-4 w-4" />
                <span>Actual production costs not yet calculated</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center py-8">Loading order details...</div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-destructive">{error || 'Order not found'}</div>
            <div className="text-center mt-4">
              <Button onClick={() => navigate('/orders')}>Back to Orders</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-display font-medium">Order Details</h1>
        <div className="flex gap-2">
          {/* Document Download Menu */}
          <DocumentShareMenu documentType="order" documentId={order.id} documentNumber={order.orderNumber} />
          <Button variant="outline" onClick={() => navigate('/orders')}>
            Back to Orders
          </Button>
          {/* MRP-49: production scheduling is now an explicit action rather than a hidden side
              effect of approving the BOM. Fabric is routinely bought — and sent for dyeing —
              weeks before anyone is ready to cut, and neither needs a colour/size breakup. */}
          <Button
            variant="outline"
            onClick={() => createWorkOrdersMutation.mutate()}
            disabled={createWorkOrdersMutation.isPending}
          >
            {createWorkOrdersMutation.isPending ? 'Creating…' : 'Create Work Orders'}
          </Button>
          <Button onClick={() => navigate(`/orders/${order.id}/edit`)}>Edit Order</Button>
        </div>
      </div>

      {/* Order Header */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-3">
              {order.orderNumber}
              {order.saleOrder && (
                <button
                  onClick={() => navigate(`/sale-orders/${order.saleOrder!.id}`)}
                  className="inline-flex items-center rounded border px-2 py-0.5 text-xs font-mono font-normal text-muted-foreground hover:bg-muted"
                  title={
                    order.saleOrder.buyerPoNumber ? `Buyer PO ${order.saleOrder.buyerPoNumber}` : 'Linked sale order'
                  }
                >
                  SO {order.saleOrder.saleOrderNumber}
                </button>
              )}
            </span>
            <div className="flex gap-2">
              <span className={`px-3 py-1 rounded text-sm font-medium ${getPriorityBadgeColor(order.priority)}`}>
                {PriorityLabels[order.priority]}
              </span>
              <span
                className={`px-3 py-1 rounded text-sm font-medium ${getStatusBadgeColor(
                  order.status as unknown as Parameters<typeof getStatusBadgeColor>[0]
                )}`}
              >
                {OrderStatusLabels[order.status]}
              </span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Customer</div>
              <div className="mt-1 text-lg">{order.customer?.name || 'N/A'}</div>
              <div className="text-sm text-muted-foreground">{order.customer?.code}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Order Date</div>
              <div className="mt-1">{new Date(order.orderDate).toLocaleDateString()}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Expected Delivery</div>
              <div className="mt-1">{new Date(order.expectedDeliveryDate).toLocaleDateString()}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Total Quantity</div>
              <div className="mt-1 text-lg font-semibold">{order.totalQuantity} pieces</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Total Amount</div>
              <div className="mt-1 text-lg font-semibold">
                {Number(order.totalAmount) > 0 ? (
                  formatCurrency(order.totalAmount, { decimals: 0 })
                ) : (
                  <span className="text-warning bg-warning-muted px-2 py-1 rounded text-sm">Pricing Pending</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Payment Terms</div>
              <div className="mt-1">{order.paymentTerms || 'N/A'}</div>
            </div>
          </div>

          {order.shippingAddress && (
            <div className="mt-6">
              <div className="text-sm font-medium text-muted-foreground">Shipping Address</div>
              <div className="mt-1">{order.shippingAddress}</div>
            </div>
          )}

          {order.remarks && (
            <div className="mt-6">
              <div className="text-sm font-medium text-muted-foreground">Remarks</div>
              <div className="mt-1">{order.remarks}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Production Workflow Tracker - P5.1: Extended to show full pipeline */}
      <OrderWorkflowTracker
        steps={buildWorkflowSteps(
          {
            order: {
              id: order.id,
              orderNumber: order.orderNumber,
              totalQuantity: order.totalQuantity,
              expectedDeliveryDate: order.expectedDeliveryDate,
            },
            orderBom: orderBom
              ? {
                  id: orderBom.id,
                  version: orderBom.version,
                  status: orderBom.status,
                }
              : null,
            mrpSummary: mrpSummary
              ? {
                  totalRequirements: mrpSummary.totalRequirements,
                  requirementsNeedingPO: mrpSummary.requirementsNeedingPO,
                  requirementsAwaitingSizes: mrpSummary.requirementsAwaitingSizes,
                  hasShortfall: mrpSummary.totalShortfall > 0,
                }
              : null,
            // P5.1: GRN status - derive from MRP received counts
            grnSummary: mrpSummary
              ? {
                  totalGRNs: mrpSummary.receivedCount || 0,
                  pendingGRNs: mrpSummary.totalRequirements - (mrpSummary.receivedCount || 0),
                  materialsReceived: (mrpSummary.receivedCount || 0) >= mrpSummary.totalRequirements,
                }
              : null,
            // P5.1: Processing - simplified (no external jobs data yet, show as N/A)
            processingSummary: null,
            // P5.1: Production status from work orders
            productionSummary:
              workOrders.length > 0
                ? {
                    totalWorkOrders: workOrders.length,
                    completedQuantity: workOrders.reduce((sum, wo) => sum + (wo.completedQuantity || 0), 0),
                    inCutting: workOrders.filter((wo) => wo.status === 'IN_PRODUCTION').length,
                    inStitching: 0, // Would need detailed stage tracking
                    inFinishing: 0,
                  }
                : null,
            // P5.1: Dispatch status from delivery notes
            dispatchSummary:
              deliveryNotes.length > 0
                ? {
                    totalDeliveryNotes: deliveryNotes.length,
                    dispatchedQuantity: deliveryNotes.reduce(
                      (sum, dn) => sum + (dn.items?.reduce((s, i) => s + (i.quantity || 0), 0) || 0),
                      0
                    ),
                    pendingDispatch:
                      order.totalQuantity -
                      deliveryNotes.reduce(
                        (sum, dn) => sum + (dn.items?.reduce((s, i) => s + (i.quantity || 0), 0) || 0),
                        0
                      ),
                  }
                : null,
          },
          {
            onCreateBOM: handleCreateBOM,
            onReviewBOM: handleReviewBOM,
            onCalculateMRP: handleCalculateMRP,
            onViewMRP: handleViewMRP,
            onViewPOs: () => navigate(`/procurement/purchase-orders?orderId=${order.id}`),
            onViewGRNs: () => navigate(`/procurement/grn?orderId=${order.id}`),
            onViewProcessing: () => navigate(`/manufacturing/job-work?orderId=${order.id}`),
            onViewProduction: () => navigate(`/production/work-orders?orderId=${order.id}`),
            onViewDispatch: () => navigate(`/manufacturing/dispatch?orderId=${order.id}`),
          },
          {
            bom: creatingBom,
            mrp: calculatingMrp,
          }
        )}
      />

      {/* Unified Order Procurement Summary */}
      {((mrpSummary && (orderBom?.status === 'APPROVED' || orderBom?.status === 'LOCKED')) ||
        (serviceSummary && serviceSummary.totalServices > 0)) && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                Order Procurement Summary
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {mrpLoading || serviceLoading ? (
              <div className="text-center py-4 text-muted-foreground">Loading procurement data...</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Materials Section (Blue) */}
                {mrpSummary && (orderBom?.status === 'APPROVED' || orderBom?.status === 'LOCKED') && (
                  <div className="bg-info-muted border border-info/20 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-info flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Materials (MRP)
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-info border-info/30 hover:bg-info-muted"
                        onClick={() => navigate(`/procurement/requirements?tab=material&orderId=${id}`)}
                      >
                        View <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-card rounded-lg p-3 text-center border border-info/15">
                        <div className="text-2xl font-bold text-info">{mrpSummary.totalRequirements}</div>
                        <div className="text-xs text-info">Total</div>
                      </div>
                      <div className="bg-card rounded-lg p-3 text-center border border-info/15">
                        <div className="text-2xl font-bold text-primary">{mrpSummary.requirementsNeedingPO}</div>
                        <div className="text-xs text-orange-500">Pending PO</div>
                      </div>
                      <div className="bg-card rounded-lg p-3 text-center border border-info/15">
                        <div className="text-2xl font-bold text-success">
                          {mrpSummary.totalRequirements - mrpSummary.requirementsNeedingPO}
                        </div>
                        <div className="text-xs text-success">PO Generated</div>
                      </div>
                      <div className="bg-card rounded-lg p-3 text-center border border-info/15">
                        <div className="text-2xl font-bold text-destructive">
                          {mrpSummary.totalShortfall > 0 ? mrpSummary.requirementsNeedingPO : 0}
                        </div>
                        <div className="text-xs text-destructive">With Shortfall</div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    {mrpSummary.totalRequirements > 0 && (
                      <div>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-info">Progress</span>
                          <span className="font-medium text-info">
                            {Math.round(
                              ((mrpSummary.totalRequirements - mrpSummary.requirementsNeedingPO) /
                                mrpSummary.totalRequirements) *
                                100
                            )}
                            %
                          </span>
                        </div>
                        <div className="w-full bg-info-muted rounded-full h-2">
                          <div
                            className="bg-info h-2 rounded-full transition-all"
                            style={{
                              width: `${((mrpSummary.totalRequirements - mrpSummary.requirementsNeedingPO) / mrpSummary.totalRequirements) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Services Section (Purple) */}
                {serviceSummary && serviceSummary.totalServices > 0 && (
                  <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-accent flex items-center gap-2">
                        <Wrench className="h-5 w-5" />
                        Services
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-accent border-accent/25 hover:bg-accent/10"
                        onClick={() => navigate(`/procurement/requirements?tab=outsourced&orderId=${id}`)}
                      >
                        View <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-card rounded-lg p-3 text-center border border-accent/15">
                        <div className="text-2xl font-bold text-accent">{serviceSummary.totalServices}</div>
                        <div className="text-xs text-accent">Total</div>
                      </div>
                      <div className="bg-card rounded-lg p-3 text-center border border-accent/15">
                        <div className="text-2xl font-bold text-primary">{serviceSummary.pendingServices}</div>
                        <div className="text-xs text-orange-500">Pending</div>
                      </div>
                      <div className="bg-card rounded-lg p-3 text-center border border-accent/15">
                        <div className="text-2xl font-bold text-info">{serviceSummary.poGenerated}</div>
                        <div className="text-xs text-info">JWO Created</div>
                      </div>
                      <div className="bg-card rounded-lg p-3 text-center border border-accent/15">
                        <div className="text-2xl font-bold text-success">{serviceSummary.completed}</div>
                        <div className="text-xs text-success">Completed</div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    {serviceSummary.totalServices > 0 && (
                      <div>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-accent">Progress</span>
                          <span className="font-medium text-accent">
                            {Math.round(
                              ((serviceSummary.poGenerated + serviceSummary.completed) / serviceSummary.totalServices) *
                                100
                            )}
                            %
                          </span>
                        </div>
                        <div className="w-full bg-accent/10 rounded-full h-2">
                          <div
                            className="bg-accent h-2 rounded-full transition-all"
                            style={{
                              width: `${((serviceSummary.poGenerated + serviceSummary.completed) / serviceSummary.totalServices) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Work Order Count */}
                    <div className="mt-3 text-xs text-accent text-center">
                      Across {serviceSummary.workOrderCount} work order{serviceSummary.workOrderCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                )}

                {/* Placeholder when only materials or only services */}
                {mrpSummary &&
                  (orderBom?.status === 'APPROVED' || orderBom?.status === 'LOCKED') &&
                  (!serviceSummary || serviceSummary.totalServices === 0) && (
                    <div className="bg-muted border border-border rounded-lg p-4 flex flex-col items-center justify-center text-center">
                      <Wrench className="h-10 w-10 text-gray-300 mb-2" />
                      <div className="text-muted-foreground font-medium">No Service Requirements</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Calculate services from Work Orders to track service POs
                      </div>
                    </div>
                  )}

                {serviceSummary &&
                  serviceSummary.totalServices > 0 &&
                  (!mrpSummary || !(orderBom?.status === 'APPROVED' || orderBom?.status === 'LOCKED')) && (
                    <div className="bg-muted border border-border rounded-lg p-4 flex flex-col items-center justify-center text-center">
                      <Package className="h-10 w-10 text-gray-300 mb-2" />
                      <div className="text-muted-foreground font-medium">No Material Requirements</div>
                      <div className="text-xs text-muted-foreground mt-1">Approve Order BOM to track material POs</div>
                    </div>
                  )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Order Items */}
      <Card>
        <CardHeader>
          <CardTitle>Order Items</CardTitle>
        </CardHeader>
        <CardContent>
          {order.orderItems && order.orderItems.length > 0 ? (
            <div className="space-y-6">
              {order.orderItems.map((item, index) => (
                <div key={item.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">Item #{index + 1}</h3>
                      <div className="text-sm text-muted-foreground mt-1">
                        {item.style?.styleCode}
                        {item.style?.buyerStyleRef && ` (${item.style.buyerStyleRef})`}
                        {' - '}
                        {item.style?.styleName}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Quantity</div>
                      <div className="text-lg font-semibold">{item.totalQuantity} pieces</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Unit Price</div>
                      <div>
                        {Number(item.unitPrice) > 0 ? (
                          formatCurrency(item.unitPrice)
                        ) : (
                          <span className="text-warning text-sm">Not set</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Total Price</div>
                      <div className="font-semibold">
                        {Number(item.totalPrice) > 0 ? (
                          formatCurrency(item.totalPrice, { decimals: 0 })
                        ) : (
                          <span className="text-warning text-sm">Pending</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Delivery Date</div>
                      <div>
                        {item.deliveryDate
                          ? new Date(item.deliveryDate).toLocaleDateString()
                          : order.expectedDeliveryDate
                            ? new Date(order.expectedDeliveryDate).toLocaleDateString()
                            : 'N/A'}
                      </div>
                    </div>
                  </div>

                  {item.itemDescription && (
                    <div className="mb-4">
                      <div className="text-sm text-muted-foreground">Description</div>
                      <div>{item.itemDescription}</div>
                    </div>
                  )}

                  {/* Quantity Breakup */}
                  {item.breakup && item.breakup.length > 0 ? (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium text-foreground">Quantity Breakup</div>
                        {/* Also reachable once a split EXISTS — otherwise a wrong split entered
                            here could never be corrected without deleting the order. */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setSizeBreakupItem({
                              orderItemId: item.id,
                              styleId: item.styleId,
                              currentTotal: item.totalQuantity,
                            })
                          }
                        >
                          Edit Size Breakdown
                        </Button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full border text-sm">
                          <thead className="bg-muted">
                            <tr>
                              <th className="border px-4 py-2 text-left">Color</th>
                              <th className="border px-4 py-2 text-left">Size</th>
                              <th className="border px-4 py-2 text-right">Quantity</th>
                            </tr>
                          </thead>
                          <tbody>
                            {item.breakup.map((breakup, idx) => (
                              <tr key={idx} className="hover:bg-muted">
                                <td className="border px-4 py-2">
                                  {breakup.colorOptions?.colorName || (breakup.colorId === null ? '-' : 'N/A')}
                                </td>
                                <td className="border px-4 py-2">{breakup.sizeOptions?.sizeName || 'N/A'}</td>
                                <td className="border px-4 py-2 text-right font-medium">{breakup.quantity}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-muted font-semibold">
                            <tr>
                              <td colSpan={2} className="border px-4 py-2 text-right">
                                Total:
                              </td>
                              <td className="border px-4 py-2 text-right">
                                {item.breakup.reduce((sum, b) => sum + b.quantity, 0)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-info-muted border border-info/20 rounded-lg">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-info flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <div className="font-medium text-info">Size breakdown not specified</div>
                          <p className="text-sm text-info mt-1">
                            This order was created with total quantity only ({item.totalQuantity} pcs). Add the sizes
                            here whenever they are confirmed.
                          </p>
                          <p className="text-xs text-info mt-2">
                            Note: Size-independent materials (fabric, greige, processing, most trims) can still be
                            procured without size breakdown. Size-wise labels are planned at their full quantity and
                            become orderable once the sizes are entered.
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3 text-info border-info/30 hover:bg-info-muted"
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
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Costing Details with Production Variance */}
                  {renderCostingDetails(item.orderItemCosting)}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">No items found for this order</div>
          )}
        </CardContent>
      </Card>

      {/* Order BOM Section */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Order BOM
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bomLoading ? (
            <div className="text-center py-4 text-muted-foreground">Loading BOM...</div>
          ) : orderBom ? (
            <div className="border rounded-lg p-4">
              <div className="flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-semibold">
                      {orderBom.style?.styleCode}
                      {orderBom.style?.buyerStyleRef && ` (${orderBom.style.buyerStyleRef})`}
                      {' - '}
                      {orderBom.style?.styleName}
                    </span>
                    <Badge variant="outline">v{orderBom.version}</Badge>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(orderBom.status)}`}
                    >
                      {orderBom.status}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {orderBom.items?.length || 0} items | Total:{' '}
                    {orderBom.totalMaterialCost ? `${Number(orderBom.totalMaterialCost).toFixed(2)}` : 'N/A'}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate(`/order-bom/${orderBom.id}`)}>
                  <ExternalLink className="h-4 w-4 mr-1" />
                  View Details
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <div className="text-muted-foreground">No Order BOM found</div>
              <div className="text-sm text-muted-foreground mt-1">Create an Order BOM from an approved Cost Sheet</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Production Runs Section */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Factory className="h-5 w-5" />
            Production Runs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {workOrdersLoading ? (
            <div className="text-center py-4 text-muted-foreground">Loading production runs...</div>
          ) : workOrders.length > 0 ? (
            <div className="space-y-4">
              {workOrders.map((wo) => {
                const progress = calculateProgress(wo);
                return (
                  <div key={wo.id} className="border rounded-lg p-4 hover:border-gray-400 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-lg">{wo.workOrderNumber}</h4>
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${getWorkOrderStatusColor(wo.status)}`}
                          >
                            {wo.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {wo.style?.styleCode}
                          {wo.style?.buyerStyleRef && ` (${wo.style.buyerStyleRef})`}
                          {' - '}
                          {wo.style?.styleName}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {wo.status === 'PENDING' && wo.totalQuantity > 1 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSplitClick(wo)}
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

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Location</div>
                        <div className="font-medium">
                          {wo.warehouses?.warehouseName || <span className="text-warning">Not Assigned</span>}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Quantity</div>
                        <div className="font-medium">
                          {wo.completedQuantity} / {wo.totalQuantity} pcs
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Planned Start</div>
                        <div className="font-medium">{new Date(wo.plannedStartDate).toLocaleDateString()}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Planned End</div>
                        <div className="font-medium">{new Date(wo.plannedEndDate).toLocaleDateString()}</div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Progress</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${progress === 100 ? 'bg-success' : 'bg-info'}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Factory className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <div className="text-muted-foreground">No production runs found for this order</div>
              <div className="text-sm text-muted-foreground mt-1">
                Production runs are auto-created when orders are saved
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billing & Dispatch Summary */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Billing & Dispatch
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Invoices */}
            <div>
              <div className="flex items-center gap-2 mb-3 text-sm font-medium text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                Invoices
                <Badge variant="secondary">{invoices.length}</Badge>
              </div>
              {invoices.length === 0 ? (
                <div className="text-sm text-muted-foreground">No invoices created for this order yet</div>
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
                        <Badge variant="outline">{InvoiceStatusLabels[inv.status]}</Badge>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Delivery Notes */}
            <div>
              <div className="flex items-center gap-2 mb-3 text-sm font-medium text-muted-foreground">
                <Truck className="h-4 w-4" />
                Delivery Notes
                <Badge variant="secondary">{deliveryNotes.length}</Badge>
              </div>
              {deliveryNotes.length === 0 ? (
                <div className="text-sm text-muted-foreground">No delivery notes created for this order yet</div>
              ) : (
                <div className="space-y-2">
                  {deliveryNotes.map((dn) => (
                    <button
                      key={dn.id}
                      onClick={() => navigate(`/manufacturing/dispatch/delivery/${dn.id}`)}
                      className="w-full flex items-center justify-between rounded-md border p-2 text-sm hover:border-gray-400 transition-colors"
                    >
                      <span className="font-medium text-primary">{dn.deliveryNumber}</span>
                      <Badge variant="outline">{DeliveryStatusLabels[dn.status]}</Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Split Production Modal */}
      {selectedWorkOrder && (
        <SplitProductionModal
          isOpen={splitModalOpen}
          onClose={() => {
            setSplitModalOpen(false);
            setSelectedWorkOrder(null);
          }}
          workOrder={selectedWorkOrder}
          onSplitComplete={handleSplitComplete}
        />
      )}

      {/* Sizes-later workflow: fill in the size split after the order was created without it */}
      {sizeBreakupItem && order && (
        <SizeBreakupDialog
          open={!!sizeBreakupItem}
          onOpenChange={(open) => !open && setSizeBreakupItem(null)}
          orderId={order.id}
          orderItemId={sizeBreakupItem.orderItemId}
          styleId={sizeBreakupItem.styleId}
          currentTotal={sizeBreakupItem.currentTotal}
          onSaved={() => {
            setSizeBreakupItem(null);
            // Saving the breakup also rewrites requirements and work orders server-side, so
            // every dependent view must refetch — not just the order.
            queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
            queryClient.invalidateQueries({ queryKey: ['work-orders'] });
            queryClient.invalidateQueries({ queryKey: queryKeys.mrp.forOrder(order.id) });
          }}
        />
      )}
    </div>
  );
}
