import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDetailQuery, queryKeys } from '@/hooks/useQuery';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Eye, Split, Factory, TrendingUp, TrendingDown, Minus, DollarSign, Calculator, AlertCircle, Package, ExternalLink, ArrowRight, Wrench, ClipboardList } from 'lucide-react';
import { getOrderById } from '../services/order.service';
import workOrderService from '../services/workOrder.service';
import { getByOrderId as getOrderBOM, createFromCostSheet as createOrderBOMFromCostSheet, calculateMRPStandalone } from '../services/orderBom.service';
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
import OrderThreadRequirementForm from '../components/thread/OrderThreadRequirementForm';
import { DocumentShareMenu } from '@/components/DocumentShareMenu';

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  useQueryClient(); // Ensure query client is available

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
    refetch: _refetchOrder,
  } = useDetailQuery<Order>(
    queryKeys.orders.detail(id || ''),
    () => getOrderById(id!),
    { enabled: !!id, staleTime: 60 * 1000 } // 1 minute
  );

  // React Query: Fetch work orders (cached)
  const {
    data: workOrders = [],
    isLoading: workOrdersLoading,
    refetch: refetchWorkOrders,
  } = useDetailQuery<WorkOrder[]>(
    [...queryKeys.orders.detail(id || ''), 'work-orders'],
    () => workOrderService.getByOrderId(id!),
    { enabled: !!id, staleTime: 60 * 1000 }
  );

  // React Query: Fetch order BOM (cached)
  const {
    data: orderBom,
    isLoading: bomLoading,
    refetch: refetchOrderBOM,
  } = useDetailQuery<OrderBOM | null>(
    queryKeys.boms.forStyle(id || ''),
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
  const {
    data: mrpSummary,
    isLoading: mrpLoading,
    refetch: _refetchMRPSummary,
  } = useDetailQuery<OrderRequirementsSummary | null>(
    [...queryKeys.mrp.all, 'order-summary', id || ''],
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
  const {
    data: serviceSummary,
    isLoading: serviceLoading,
    refetch: _refetchServiceSummary,
  } = useDetailQuery<OrderServiceRequirementsSummary | null>(
    ['service-requirements', 'order-summary', id || ''],
    async () => {
      try {
        return await getOrderServiceRequirementsSummary(id!);
      } catch {
        return null;
      }
    },
    { enabled: shouldFetchServiceSummary, staleTime: 60 * 1000 }
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
        handleApiError(
          new Error('Cost sheet ID is missing'),
          'Cost sheet data is invalid - ID is missing'
        );
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
      const result = await calculateMRPStandalone(order.id, {});
      toast({
        title: 'MRP Calculated',
        description: `Created ${result.created} requirements, updated ${result.updated}`,
      });
      navigate(`/mrp/requirements?orderId=${order.id}`);
    } catch (err) {
      handleApiError(err, 'Failed to calculate MRP requirements');
      logError('Failed to calculate MRP:', err);
    } finally {
      setCalculatingMrp(false);
    }
  };

  // Navigate to MRP requirements page
  const handleViewMRP = () => {
    navigate(`/mrp/requirements?orderId=${order?.id}`);
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
        return 'bg-blue-100 text-blue-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'DISPATCHED':
        return 'bg-purple-100 text-purple-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Note: getStatusBadgeColor is imported from orderBom.service

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case 'LOW':
        return 'bg-gray-100 text-gray-800';
      case 'MEDIUM':
        return 'bg-blue-100 text-blue-800';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800';
      case 'URGENT':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Render variance badge with icon
  const renderVarianceBadge = (variancePercent: number | null | undefined) => {
    if (variancePercent === null || variancePercent === undefined) return null;
    const percent = Number(variancePercent);
    if (percent > 0) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />
          +{percent.toFixed(1)}%
        </Badge>
      );
    } else if (percent < 0) {
      return (
        <Badge variant="default" className="flex items-center gap-1 bg-green-600">
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
      <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
        <div className="flex items-center gap-2 mb-3">
          <Calculator className="h-4 w-4 text-gray-500" />
          <h4 className="font-medium text-gray-700">Costing Details</h4>
          {costing.originalCostSheetVersion && (
            <Badge variant="outline" className="text-xs">
              v{costing.originalCostSheetVersion}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-gray-500">Fabric</div>
            <div className="font-medium">{formatCurrency(costing.fabricTotal)}</div>
          </div>
          <div>
            <div className="text-gray-500">Trims</div>
            <div className="font-medium">{formatCurrency(costing.trimsTotal)}</div>
          </div>
          <div>
            <div className="text-gray-500">CMT</div>
            <div className="font-medium">{formatCurrency(costing.cmtTotal)}</div>
          </div>
          <div>
            <div className="text-gray-500">Embroidery</div>
            <div className="font-medium">{formatCurrency(costing.embroideryTotal)}</div>
          </div>
        </div>

        {/* Variance Section */}
        {(hasVariance || hasActualCost) && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="h-4 w-4 text-gray-500" />
              <span className="font-medium text-gray-700">Production Variance</span>
              {hasVariance && renderVarianceBadge(costing.costVariancePercent)}
            </div>

            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-gray-500">Estimated Cost/Pc</div>
                <div className="font-medium">
                  {costing.estimatedCostPerPiece !== null && costing.estimatedCostPerPiece !== undefined
                    ? formatCurrency(costing.estimatedCostPerPiece)
                    : '-'}
                </div>
              </div>
              <div>
                <div className="text-gray-500">Actual Cost/Pc</div>
                <div className={`font-medium ${hasVariance && Number(costing.costVariancePercent) > 0 ? 'text-red-600' : hasVariance && Number(costing.costVariancePercent) < 0 ? 'text-green-600' : ''}`}>
                  {hasActualCost ? formatCurrency(costing.actualCostPerPiece!) : '-'}
                </div>
              </div>
              <div>
                <div className="text-gray-500">Variance Amount</div>
                <div className={`font-medium ${costing.costVarianceAmount && Number(costing.costVarianceAmount) > 0 ? 'text-red-600' : costing.costVarianceAmount && Number(costing.costVarianceAmount) < 0 ? 'text-green-600' : ''}`}>
                  {costing.costVarianceAmount !== null && costing.costVarianceAmount !== undefined
                    ? `${Number(costing.costVarianceAmount) > 0 ? '+' : ''}${formatCurrency(costing.costVarianceAmount)}`
                    : '-'}
                </div>
              </div>
            </div>

            {costing.varianceCalculatedAt && (
              <div className="mt-2 text-xs text-gray-400">
                Calculated: {new Date(costing.varianceCalculatedAt).toLocaleDateString()}
              </div>
            )}

            {!hasActualCost && (
              <div className="mt-3 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded">
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
            <div className="text-center text-red-600">{error || 'Order not found'}</div>
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
        <h1 className="text-3xl font-bold">Order Details</h1>
        <div className="flex gap-2">
          {/* Document Download Menu */}
          <DocumentShareMenu
            documentType="order"
            documentId={order.id}
            documentNumber={order.orderNumber}
          />
          <Button variant="outline" onClick={() => navigate('/orders')}>
            Back to Orders
          </Button>
          <Button onClick={() => navigate(`/orders/${order.id}/edit`)}>
            Edit Order
          </Button>
        </div>
      </div>

      {/* Order Header */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{order.orderNumber}</span>
            <div className="flex gap-2">
              <span
                className={`px-3 py-1 rounded text-sm font-medium ${getPriorityBadgeColor(
                  order.priority
                )}`}
              >
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
              <div className="text-sm font-medium text-gray-500">Customer</div>
              <div className="mt-1 text-lg">{order.customer?.name || 'N/A'}</div>
              <div className="text-sm text-gray-500">{order.customer?.code}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">Order Date</div>
              <div className="mt-1">{new Date(order.orderDate).toLocaleDateString()}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">Expected Delivery</div>
              <div className="mt-1">{new Date(order.expectedDeliveryDate).toLocaleDateString()}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">Total Quantity</div>
              <div className="mt-1 text-lg font-semibold">{order.totalQuantity} pieces</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">Total Amount</div>
              <div className="mt-1 text-lg font-semibold">
                {Number(order.totalAmount) > 0 ? (
                  formatCurrency(order.totalAmount, { decimals: 0 })
                ) : (
                  <span className="text-amber-600 bg-amber-50 px-2 py-1 rounded text-sm">
                    Pricing Pending
                  </span>
                )}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">Payment Terms</div>
              <div className="mt-1">{order.paymentTerms || 'N/A'}</div>
            </div>
          </div>

          {order.shippingAddress && (
            <div className="mt-6">
              <div className="text-sm font-medium text-gray-500">Shipping Address</div>
              <div className="mt-1">{order.shippingAddress}</div>
            </div>
          )}

          {order.remarks && (
            <div className="mt-6">
              <div className="text-sm font-medium text-gray-500">Remarks</div>
              <div className="mt-1">{order.remarks}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Production Workflow Tracker */}
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
            mrpSummary: mrpSummary ? {
              totalRequirements: mrpSummary.totalRequirements,
              requirementsNeedingPO: mrpSummary.requirementsNeedingPO,
              hasShortfall: mrpSummary.totalShortfall > 0,
            } : null,
          },
          {
            onCreateBOM: handleCreateBOM,
            onReviewBOM: handleReviewBOM,
            onCalculateMRP: handleCalculateMRP,
            onViewMRP: handleViewMRP,
          },
          {
            bom: creatingBom,
            mrp: calculatingMrp,
          }
        )}
      />

      {/* Unified Order Procurement Summary */}
      {((mrpSummary && (orderBom?.status === 'APPROVED' || orderBom?.status === 'LOCKED')) || (serviceSummary && serviceSummary.totalServices > 0)) && (
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
            {(mrpLoading || serviceLoading) ? (
              <div className="text-center py-4 text-muted-foreground">Loading procurement data...</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Materials Section (Blue) */}
                {mrpSummary && (orderBom?.status === 'APPROVED' || orderBom?.status === 'LOCKED') && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-blue-800 flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Materials (MRP)
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-blue-700 border-blue-300 hover:bg-blue-100"
                        onClick={() => navigate(`/procurement/requirements?tab=material&orderId=${id}`)}
                      >
                        View <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-white rounded-lg p-3 text-center border border-blue-100">
                        <div className="text-2xl font-bold text-blue-700">{mrpSummary.totalRequirements}</div>
                        <div className="text-xs text-blue-600">Total</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 text-center border border-blue-100">
                        <div className="text-2xl font-bold text-orange-600">{mrpSummary.requirementsNeedingPO}</div>
                        <div className="text-xs text-orange-500">Pending PO</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 text-center border border-blue-100">
                        <div className="text-2xl font-bold text-green-600">
                          {mrpSummary.totalRequirements - mrpSummary.requirementsNeedingPO}
                        </div>
                        <div className="text-xs text-green-500">PO Generated</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 text-center border border-blue-100">
                        <div className="text-2xl font-bold text-red-600">
                          {mrpSummary.totalShortfall > 0 ? mrpSummary.requirementsNeedingPO : 0}
                        </div>
                        <div className="text-xs text-red-500">With Shortfall</div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    {mrpSummary.totalRequirements > 0 && (
                      <div>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-blue-600">Progress</span>
                          <span className="font-medium text-blue-700">
                            {Math.round(((mrpSummary.totalRequirements - mrpSummary.requirementsNeedingPO) / mrpSummary.totalRequirements) * 100)}%
                          </span>
                        </div>
                        <div className="w-full bg-blue-100 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
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
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-purple-800 flex items-center gap-2">
                        <Wrench className="h-5 w-5" />
                        Services
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-purple-700 border-purple-300 hover:bg-purple-100"
                        onClick={() => navigate(`/procurement/requirements?tab=outsourced&orderId=${id}`)}
                      >
                        View <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-white rounded-lg p-3 text-center border border-purple-100">
                        <div className="text-2xl font-bold text-purple-700">{serviceSummary.totalServices}</div>
                        <div className="text-xs text-purple-600">Total</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 text-center border border-purple-100">
                        <div className="text-2xl font-bold text-orange-600">{serviceSummary.pendingServices}</div>
                        <div className="text-xs text-orange-500">Pending</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 text-center border border-purple-100">
                        <div className="text-2xl font-bold text-blue-600">{serviceSummary.poGenerated}</div>
                        <div className="text-xs text-blue-500">PO Generated</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 text-center border border-purple-100">
                        <div className="text-2xl font-bold text-green-600">{serviceSummary.completed}</div>
                        <div className="text-xs text-green-500">Completed</div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    {serviceSummary.totalServices > 0 && (
                      <div>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-purple-600">Progress</span>
                          <span className="font-medium text-purple-700">
                            {Math.round(((serviceSummary.poGenerated + serviceSummary.completed) / serviceSummary.totalServices) * 100)}%
                          </span>
                        </div>
                        <div className="w-full bg-purple-100 rounded-full h-2">
                          <div
                            className="bg-purple-600 h-2 rounded-full transition-all"
                            style={{
                              width: `${((serviceSummary.poGenerated + serviceSummary.completed) / serviceSummary.totalServices) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Work Order Count */}
                    <div className="mt-3 text-xs text-purple-600 text-center">
                      Across {serviceSummary.workOrderCount} work order{serviceSummary.workOrderCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                )}

                {/* Placeholder when only materials or only services */}
                {mrpSummary && (orderBom?.status === 'APPROVED' || orderBom?.status === 'LOCKED') && (!serviceSummary || serviceSummary.totalServices === 0) && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex flex-col items-center justify-center text-center">
                    <Wrench className="h-10 w-10 text-gray-300 mb-2" />
                    <div className="text-gray-500 font-medium">No Service Requirements</div>
                    <div className="text-xs text-gray-400 mt-1">
                      Calculate services from Work Orders to track service POs
                    </div>
                  </div>
                )}

                {serviceSummary && serviceSummary.totalServices > 0 && (!mrpSummary || !(orderBom?.status === 'APPROVED' || orderBom?.status === 'LOCKED')) && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex flex-col items-center justify-center text-center">
                    <Package className="h-10 w-10 text-gray-300 mb-2" />
                    <div className="text-gray-500 font-medium">No Material Requirements</div>
                    <div className="text-xs text-gray-400 mt-1">
                      Approve Order BOM to track material POs
                    </div>
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
                      <div className="text-sm text-gray-600 mt-1">
                        {item.style?.styleCode} - {item.style?.styleName}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">Quantity</div>
                      <div className="text-lg font-semibold">{item.totalQuantity} pieces</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <div className="text-sm text-gray-500">Unit Price</div>
                      <div>
                        {Number(item.unitPrice) > 0 ? (
                          formatCurrency(item.unitPrice)
                        ) : (
                          <span className="text-amber-600 text-sm">Not set</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Total Price</div>
                      <div className="font-semibold">
                        {Number(item.totalPrice) > 0 ? (
                          formatCurrency(item.totalPrice, { decimals: 0 })
                        ) : (
                          <span className="text-amber-600 text-sm">Pending</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Delivery Date</div>
                      <div>{item.deliveryDate
                        ? new Date(item.deliveryDate).toLocaleDateString()
                        : order.expectedDeliveryDate
                          ? new Date(order.expectedDeliveryDate).toLocaleDateString()
                          : 'N/A'}</div>
                    </div>
                  </div>

                  {item.itemDescription && (
                    <div className="mb-4">
                      <div className="text-sm text-gray-500">Description</div>
                      <div>{item.itemDescription}</div>
                    </div>
                  )}

                  {/* Quantity Breakup */}
                  {item.breakup && item.breakup.length > 0 ? (
                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-2">Quantity Breakup</div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full border text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="border px-4 py-2 text-left">Color</th>
                              <th className="border px-4 py-2 text-left">Size</th>
                              <th className="border px-4 py-2 text-right">Quantity</th>
                            </tr>
                          </thead>
                          <tbody>
                            {item.breakup.map((breakup, idx) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="border px-4 py-2">
                                  {breakup.colors?.colorName || (breakup.colorId === null ? '-' : 'N/A')}
                                </td>
                                <td className="border px-4 py-2">
                                  {breakup.sizes?.sizeName || 'N/A'}
                                </td>
                                <td className="border px-4 py-2 text-right font-medium">
                                  {breakup.quantity}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-gray-50 font-semibold">
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
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <div className="font-medium text-blue-800">Size breakdown not specified</div>
                          <p className="text-sm text-blue-700 mt-1">
                            This order was created with total quantity only ({item.totalQuantity} pcs).
                            Size breakdown can be added by editing the order.
                          </p>
                          <p className="text-xs text-blue-600 mt-2">
                            Note: Size-independent materials (fabric, greige, processing, most trims) can still be procured without size breakdown.
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3 text-blue-700 border-blue-300 hover:bg-blue-100"
                            onClick={() => navigate(`/orders/${order.id}/edit`)}
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
            <div className="text-center py-8 text-gray-500">No items found for this order</div>
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
            <div className="text-center py-4 text-gray-500">Loading BOM...</div>
          ) : orderBom ? (
            <div className="border rounded-lg p-4">
              <div className="flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-semibold">
                      {orderBom.style?.styleCode} - {orderBom.style?.styleName}
                    </span>
                    <Badge variant="outline">v{orderBom.version}</Badge>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(orderBom.status)}`}>
                      {orderBom.status}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {orderBom.items?.length || 0} items | Total: {orderBom.totalMaterialCost ? `${Number(orderBom.totalMaterialCost).toFixed(2)}` : 'N/A'}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/order-bom/${orderBom.id}`)}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  View Details
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <div className="text-gray-500">No Order BOM found</div>
              <div className="text-sm text-gray-400 mt-1">
                Create an Order BOM from an approved Cost Sheet
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Thread Requirements Section */}
      <div className="mt-6">
        <OrderThreadRequirementForm
          orderId={order.id}
          onSave={() => {
            // Reload thread requirements or show success message
            handleApiSuccess('Thread Requirements Saved', 'Thread requirements have been saved successfully');
          }}
        />
      </div>

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
            <div className="text-center py-4 text-gray-500">Loading production runs...</div>
          ) : workOrders.length > 0 ? (
            <div className="space-y-4">
              {workOrders.map((wo) => {
                const progress = calculateProgress(wo);
                return (
                  <div
                    key={wo.id}
                    className="border rounded-lg p-4 hover:border-gray-400 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-lg">{wo.workOrderNumber}</h4>
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${getWorkOrderStatusColor(
                              wo.status
                            )}`}
                          >
                            {wo.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {wo.styles?.styleCode} - {wo.styles?.styleName}
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
                        <div className="text-gray-500">Location</div>
                        <div className="font-medium">
                          {wo.locations?.locationName || (
                            <span className="text-amber-600">Not Assigned</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500">Quantity</div>
                        <div className="font-medium">
                          {wo.completedQuantity} / {wo.totalQuantity} pcs
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500">Planned Start</div>
                        <div className="font-medium">
                          {new Date(wo.plannedStartDate).toLocaleDateString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500">Planned End</div>
                        <div className="font-medium">
                          {new Date(wo.plannedEndDate).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Progress</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            progress === 100 ? 'bg-green-600' : 'bg-blue-600'
                          }`}
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
              <div className="text-gray-500">No production runs found for this order</div>
              <div className="text-sm text-gray-400 mt-1">
                Production runs are auto-created when orders are saved
              </div>
            </div>
          )}
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
    </div>
  );
}
