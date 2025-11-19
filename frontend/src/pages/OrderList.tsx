import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAllOrders, deleteOrder } from '@/services/order.service';
import { customerService } from '@/services/customer.service';
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
import { ShoppingCart } from 'lucide-react';

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
  const [orderToDelete, setOrderToDelete] = useState<{ id: string; orderNumber: string } | null>(null);

  useEffect(() => {
    fetchCustomers();
  }, []);

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
    } catch (err: any) {
      const errorMessage = handleApiError(err, 'Failed to load orders', false);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (id: string, orderNumber: string) => {
    setOrderToDelete({ id, orderNumber });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!orderToDelete) return;

    try {
      await deleteOrder(orderToDelete.id);
      handleApiSuccess('Order cancelled', `Order ${orderToDelete.orderNumber} has been successfully cancelled.`);
      fetchOrders();
    } catch (err: any) {
      handleApiError(err, 'Failed to cancel order');
    } finally {
      setOrderToDelete(null);
    }
  };

  const formatAmount = (amount: number) => {
    return `₹${Number(amount).toLocaleString()}`;
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
      header: 'Items / Qty',
      render: (order) => (
        <div>
          <div className="text-sm font-medium text-gray-900">
            {order._count?.orderItems || 0} items
          </div>
          <div className="text-xs text-gray-500">
            {order.totalQuantity} units
          </div>
        </div>
      ),
    },
    {
      key: 'totalAmount',
      header: 'Amount',
      render: (order) => (
        <div className="text-sm font-medium text-gray-900">
          {formatAmount(order.totalAmount)}
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
      render: (order) => (
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
          {order.status === 'PENDING' && (
            <Button
              variant="destructive"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteClick(order.id, order.orderNumber);
              }}
            >
              Cancel
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="container mx-auto py-8 px-4">
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
        title="Cancel Order"
        description={`Are you sure you want to cancel order ${orderToDelete?.orderNumber}? This action cannot be undone.`}
        confirmText="Cancel Order"
        cancelText="Keep Order"
        onConfirm={confirmDelete}
        variant="destructive"
      />
    </div>
  );
}
