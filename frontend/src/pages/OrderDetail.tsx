import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Eye, Split, Factory, ChevronRight, TrendingUp, TrendingDown, Minus, DollarSign, Calculator, AlertCircle } from 'lucide-react';
import { getOrderById } from '../services/order.service';
import workOrderService from '../services/workOrder.service';
import type { Order, OrderItemCosting } from '../types/order.types';
import { OrderStatusLabels, PriorityLabels } from '../types/order.types';
import type { WorkOrder } from '../types/production.types';
import SplitProductionModal from '../components/SplitProductionModal';
import { formatCurrency } from '@/lib/currency';

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Production Runs state
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [workOrdersLoading, setWorkOrdersLoading] = useState(false);
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);

  useEffect(() => {
    if (id) {
      fetchOrder();
      fetchWorkOrders();
    }
  }, [id]);

  const fetchOrder = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const order = await getOrderById(id!);
      setOrder(order);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to fetch order');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchWorkOrders = async () => {
    try {
      setWorkOrdersLoading(true);
      const data = await workOrderService.getByOrderId(id!);
      setWorkOrders(data);
    } catch (err: unknown) {
      console.error('Failed to fetch work orders', err);
    } finally {
      setWorkOrdersLoading(false);
    }
  };

  const handleSplitClick = (wo: WorkOrder) => {
    setSelectedWorkOrder(wo);
    setSplitModalOpen(true);
  };

  const handleSplitComplete = () => {
    setSplitModalOpen(false);
    setSelectedWorkOrder(null);
    fetchWorkOrders(); // Refresh the list
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

  const getStatusBadgeColor = (status: string) => {
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
                  order.status
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
                      <div>{item.deliveryDate ? new Date(item.deliveryDate).toLocaleDateString() : 'N/A'}</div>
                    </div>
                  </div>

                  {item.itemDescription && (
                    <div className="mb-4">
                      <div className="text-sm text-gray-500">Description</div>
                      <div>{item.itemDescription}</div>
                    </div>
                  )}

                  {/* Quantity Breakup */}
                  {item.orderItemBreakup && item.orderItemBreakup.length > 0 && (
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
                            {item.orderItemBreakup.map((breakup, idx) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="border px-4 py-2">
                                  {breakup.color?.colorName || (breakup.colorId === null ? '-' : 'N/A')}
                                </td>
                                <td className="border px-4 py-2">
                                  {breakup.size?.sizeName || 'N/A'}
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
                                {item.orderItemBreakup.reduce((sum, b) => sum + b.quantity, 0)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
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
