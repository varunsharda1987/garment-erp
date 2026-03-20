import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAllOrders, deleteOrder, hardDeleteOrder, canDeleteOrder } from '@/services/order.service';
import { customerService } from '@/services/customer.service';
import { createFromCostSheet } from '@/services/orderBom.service';
import { getCostSheetVersionsByStyle } from '@/services/costSheet.service';
import type { Order, OrderStatus, Priority } from '@/types/order.types';
import { OrderStatusLabels, PriorityLabels } from '@/types/order.types';
import type { Customer } from '@/types/customer.types';
import ExportButton from '@/components/ExportButton';
import ImportButton from '@/components/ImportButton';
import SearchInput from '@/components/SearchInput';
import DataTable from '@/components/DataTable';
import ConfirmDialog from '@/components/ConfirmDialog';
import { StatusBadge } from '@/components/StatusBadge';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { ShoppingCart, ArrowRight } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';

// Local type definition to avoid import issues
type Column<T> = {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

export default function OrderList() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [customerFilter, setCustomerFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<{ id: string; orderNumber: string; canHardDelete: boolean } | null>(null);

  // BOM creation loading state
  const [bomLoadingId, setBomLoadingId] = useState<string | null>(null);

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, customerFilter, statusFilter, priorityFilter]);

  useEffect(() => {
    fetchOrders();
  }, [currentPage, pageSize, searchQuery, customerFilter, statusFilter, priorityFilter]);

  const fetchCustomers = async () => {
    try {
      const response = await customerService.getAllCustomers({ limit: 100 });
      setCustomers(response.data);
    } catch (err) {
      handleApiError(err, 'Failed to load customers', false);
    }
  };

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await getAllOrders({
        page: currentPage,
        limit: pageSize,
        search: searchQuery || undefined,
        customerId: customerFilter !== 'all' ? customerFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        priority: priorityFilter !== 'all' ? priorityFilter : undefined,
      });
      setOrders(response.data);
      setTotalPages(response.pagination.pages);
      setTotalOrders(response.pagination.total);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load orders', false);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = async (id: string, orderNumber: string, isHardDelete: boolean) => {
    try {
      if (isHardDelete) {
        // Check if order can be hard deleted
        const result = await canDeleteOrder(id);
        setOrderToDelete({ id, orderNumber, canHardDelete: result.canDelete });
      } else {
        setOrderToDelete({ id, orderNumber, canHardDelete: false });
      }
      setDeleteDialogOpen(true);
    } catch (err) {
      handleApiError(err, 'Failed to check if order can be deleted');
    }
  };

  const confirmDelete = async () => {
    if (!orderToDelete) return;

    try {
      if (orderToDelete.canHardDelete) {
        await hardDeleteOrder(orderToDelete.id);
        handleApiSuccess('Order deleted', `Order ${orderToDelete.orderNumber} has been permanently deleted.`);
      } else {
        await deleteOrder(orderToDelete.id);
        handleApiSuccess('Order cancelled', `Order ${orderToDelete.orderNumber} has been cancelled.`);
      }
      fetchOrders();
    } catch (err: unknown) {
      handleApiError(err, orderToDelete.canHardDelete ? 'Failed to delete order' : 'Failed to cancel order');
    } finally {
      setOrderToDelete(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getPriorityVariant = (priority: Priority) => {
    switch (priority) {
      case 'LOW':
        return 'secondary';
      case 'MEDIUM':
        return 'info';
      case 'HIGH':
        return 'warning';
      case 'URGENT':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getStatusVariant = (status: OrderStatus) => {
    switch (status) {
      case 'PENDING':
        return 'warning';
      case 'IN_PRODUCTION':
        return 'info';
      case 'COMPLETED':
        return 'success';
      case 'DISPATCHED':
        return 'success';
      case 'CANCELLED':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  // Returns the next workflow action for an order based on its BOM status
  const getWorkflowAction = (order: Order) => {
    const bom = order.orderBoms?.[0];
    if (!bom) return { label: 'Create BOM', type: 'create' as const };
    if (bom.status === 'DRAFT') return { label: 'Review BOM', type: 'navigate' as const, path: `/order-bom/${bom.id}` };
    if (bom.status === 'APPROVED') return { label: 'Lock BOM', type: 'navigate' as const, path: `/order-bom/${bom.id}` };
    if (bom.status === 'LOCKED') return { label: 'View MRP', type: 'navigate' as const, path: `/mrp/requirements?orderId=${order.id}` };
    return null;
  };

  const handleCreateBOM = async (order: Order) => {
    const styleId = order.orderItems?.[0]?.styleId;
    if (!styleId) {
      handleApiError(new Error('No order items found'), 'Cannot create BOM');
      return;
    }
    setBomLoadingId(order.id);
    try {
      const costSheets = await getCostSheetVersionsByStyle(styleId);
      const approved = costSheets.find(
        (cs) =>
          (cs.approvalStatus === 'APPROVED' || cs.isApproved) &&
          (['RAW_MATERIAL_CALCULATION', 'PRODUCTION', 'PROCUREMENT_PRODUCTION'] as string[]).includes(cs.purpose)
      );
      if (!approved?.id) {
        handleApiError(
          new Error('No approved cost sheet found'),
          'Please approve a RAW_MATERIAL_CALCULATION or PRODUCTION cost sheet first'
        );
        return;
      }
      const bom = await createFromCostSheet(order.id, { styleId, costSheetId: approved.id });
      handleApiSuccess('BOM Created', 'BOM created successfully. Redirecting to review...');
      navigate(`/order-bom/${bom.id}`);
    } catch (err) {
      handleApiError(err, 'Failed to create BOM');
    } finally {
      setBomLoadingId(null);
    }
  };

  // Define columns for DataTable
  const columns: Column<Order>[] = [
    {
      key: 'orderNumber',
      header: 'Order Number',
      render: (order) => (
        <div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/orders/${order.id}`);
            }}
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            {order.orderNumber}
          </button>
          <div className="text-xs text-gray-500 mt-0.5">
            {formatDate(order.orderDate)}
          </div>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (order) => (
        <div>
          <div className="text-sm font-medium text-gray-900">{order.customer?.name || 'N/A'}</div>
          <div className="text-xs text-gray-500">{order.customer?.code}</div>
        </div>
      ),
    },
    {
      key: 'styles',
      header: 'Style(s)',
      render: (order) => {
        const styleCodes = order.orderItems
          ?.map((item) => item.style?.styleCode)
          .filter(Boolean) as string[] || [];
        const unique = [...new Set(styleCodes)];
        if (unique.length === 0) return <span className="text-xs text-gray-400">-</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {unique.map((code) => (
              <span key={code} className="text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                {code}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: 'expectedDeliveryDate',
      header: 'Delivery Date',
      render: (order) => (
        <div className="text-sm text-gray-700">
          {formatDate(order.expectedDeliveryDate)}
        </div>
      ),
    },
    {
      key: 'quantity',
      header: 'Quantity',
      render: (order) => (
        <div className="text-sm font-medium text-gray-900">
          {order.totalQuantity?.toLocaleString() || 0} pcs
        </div>
      ),
    },
    {
      key: 'totalAmount',
      header: 'Amount',
      render: (order) => (
        <div className="text-sm font-medium">
          {Number(order.totalAmount) > 0 ? (
            <span className="text-gray-900">{formatCurrency(order.totalAmount)}</span>
          ) : (
            <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded text-xs">
              Price TBD
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (order) => (
        <StatusBadge status={PriorityLabels[order.priority]} variant={getPriorityVariant(order.priority)} />
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (order) => (
        <StatusBadge status={OrderStatusLabels[order.status]} variant={getStatusVariant(order.status)} />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (order) => {
        const workflowAction = order.status !== 'CANCELLED' ? getWorkflowAction(order) : null;
        return (
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/orders/${order.id}`);
              }}
            >
              View
            </Button>
            {workflowAction && (
              workflowAction.type === 'create' ? (
                <Button
                  variant="default"
                  size="sm"
                  disabled={bomLoadingId === order.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCreateBOM(order);
                  }}
                >
                  {bomLoadingId === order.id ? 'Creating...' : 'Create BOM'}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(workflowAction.path!);
                  }}
                >
                  {workflowAction.label} <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              )
            )}
            {order.status !== 'CANCELLED' && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/orders/${order.id}/edit`);
                }}
              >
                Edit
              </Button>
            )}
            {(order.status === 'PENDING' || order.status === 'CANCELLED') && (
              <Button
                variant="destructive"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteClick(order.id, order.orderNumber, true);
                }}
              >
                Delete
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Orders</CardTitle>
            <div className="flex gap-2">
              <ExportButton
                module="orders"
                filters={{
                  customerId: customerFilter !== 'all' ? customerFilter : undefined,
                  status: statusFilter !== 'all' ? statusFilter : undefined,
                  priority: priorityFilter !== 'all' ? priorityFilter : undefined,
                }}
              />
              <ImportButton
                module="orders"
                onSuccess={fetchOrders}
              />
              <Button onClick={() => navigate('/orders/new')}>
                + Create New Order
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-6 space-y-4">
            <div className="flex-1">
              <SearchInput
                placeholder="Search by order number or customer..."
                value={searchQuery}
                onChange={setSearchQuery}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select value={customerFilter} onValueChange={setCustomerFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Customers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name} ({customer.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="IN_PRODUCTION">In Production</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="DISPATCHED">Dispatched</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* DataTable Component */}
          <DataTable
            data={orders}
            columns={columns}
            keyExtractor={(order) => order.id}
            loading={isLoading}
            error={error}
            emptyState={{
              icon: <ShoppingCart className="h-16 w-16" />,
              title: 'No orders found',
              description: searchQuery || customerFilter || statusFilter || priorityFilter
                ? 'Try adjusting your search or filter criteria'
                : 'Get started by creating your first order',
              actionLabel: 'Create First Order',
              onAction: () => navigate('/orders/new'),
            }}
            pagination={{
              currentPage,
              totalPages,
              pageSize,
              totalItems: totalOrders,
              onPageChange: setCurrentPage,
              onPageSizeChange: setPageSize,
            }}
            onRowClick={(order) => navigate(`/orders/${order.id}`)}
          />
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={orderToDelete?.canHardDelete ? "Delete Order" : "Cancel Order"}
        description={
          orderToDelete?.canHardDelete
            ? `Are you sure you want to permanently delete order ${orderToDelete?.orderNumber}? This will remove all related records and cannot be undone.`
            : `Are you sure you want to cancel order ${orderToDelete?.orderNumber}? This action cannot be undone.`
        }
        confirmText={orderToDelete?.canHardDelete ? "Delete Order" : "Cancel Order"}
        cancelText="Keep Order"
        onConfirm={confirmDelete}
        variant="destructive"
      />
    </>
  );
}
