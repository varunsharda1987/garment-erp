import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CustomerCombobox } from '@/components/CustomerCombobox';
import { getAllOrders, hardDeleteOrder, canDeleteOrder } from '@/services/order.service';
import type { Order, OrderStatus } from '@/types/order.types';
import { OrderStatusLabels } from '@/types/order.types';
import ExportButton from '@/components/ExportButton';
import SearchInput from '@/components/SearchInput';
import DataTable from '@/components/DataTable';
import ConfirmDialog from '@/components/ConfirmDialog';
import CancelOrderDialog from '@/components/orders/CancelOrderDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuthStore } from '@/stores/auth.store';
import { StatusBadge } from '@/components/StatusBadge';
import { getErrorMessage, handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { useCreateOrderBom } from '@/hooks/useCreateOrderBom';
import { queryKeys } from '@/hooks/useQuery';
import { ShoppingCart, ArrowRight } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { formatQuantity } from '@/lib/formatters';
import { formatDate } from '@/lib/date';
import { BUYER_STYLE_CODE_LABEL, STYLE_CODE_LABEL, buyerStyleCode } from '@/lib/style-code';

// Local type definition to avoid import issues
type Column<T> = {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

/** Statuses an order does no more BOM / edit work in. */
const CLOSED_STATUSES: OrderStatus[] = ['CANCELLED', 'COMPLETED', 'DISPATCHED', 'SPLIT'];

// One entry per distinct style on the order, in line order — the Buyer Style Code and Style Code
// columns both render from this list so a multi-style order's two stacks line up row for row.
function uniqueStyles(order: Order): Array<{ code: string; buyer: string }> {
  const uniqueByCode = new Map<string, { code: string; buyer: string }>();
  for (const item of order.orderItems || []) {
    const code = item.style?.styleCode;
    if (code && !uniqueByCode.has(code)) {
      uniqueByCode.set(code, { code, buyer: buyerStyleCode(item.style) });
    }
  }
  return [...uniqueByCode.values()];
}

type WorkflowAction =
  | { type: 'create'; label: string; styleId: string; orderItemId?: string }
  | { type: 'navigate'; label: string; path: string };

/**
 * The next BOM step for the order, across ALL its styles (one BOM per style). A style with no BOM
 * comes first, then a draft to review. An APPROVED BOM is enough to buy and cut from (owner,
 * 2026-09-28 — Lock is optional), so approved and locked both lead to the requirements.
 */
function getWorkflowAction(order: Order): WorkflowAction | null {
  if (CLOSED_STATUSES.includes(order.status)) return null;
  const boms = order.orderBoms ?? [];
  const missing = (order.orderItems ?? []).find(
    (item) => item.styleId && !boms.some((b) => b.styleId === item.styleId)
  );
  if (missing?.styleId) {
    return { type: 'create', label: 'Create BOM', styleId: missing.styleId, orderItemId: missing.id };
  }
  const draft = boms.find((b) => b.status === 'DRAFT');
  if (draft) return { type: 'navigate', label: 'Review BOM', path: `/order-bom/${draft.id}` };
  if (boms.length === 0) return null;
  return {
    type: 'navigate',
    label: 'Requirements',
    path: `/procurement/requirements?tab=material&orderId=${order.id}`,
  };
}

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

export default function OrderList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Pagination + filters. Every filter setter resets the page in the same update, so one change is
  // one request — two effects used to fire the old page and then page 1, and the slower one won.
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filters = {
    page: currentPage,
    limit: pageSize,
    search: searchQuery || undefined,
    customerId: customerFilter || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  };
  const hasFilters = Boolean(searchQuery || customerFilter || statusFilter !== 'all');

  const {
    data: response,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.orders.list(filters),
    queryFn: () => getAllOrders(filters),
    placeholderData: keepPreviousData,
  });
  const orders = response?.data ?? [];
  const totalOrders = response?.pagination.total ?? 0;
  const totalPages = response?.pagination.totalPages ?? 1; // backend key is totalPages (bug-hunt orders-13)

  // A page past the end (rows-per-page raised, or the last row of the last page deleted) would
  // show the empty state INSTEAD of the pager, with no way back. Step back to the last real page.
  const pastTheEnd = Boolean(response) && orders.length === 0 && currentPage > 1 && currentPage > totalPages;
  useEffect(() => {
    if (pastTheEnd) setCurrentPage(Math.max(1, totalPages));
  }, [pastTheEnd, totalPages]);

  const refreshOrders = () => queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });

  // Delete is only ever a delete (admin). A refusal shows its reason; cancelling is a separate,
  // explicit decision (CancelOrderDialog) — never what a Delete click falls through to.
  const isAdmin = useAuthStore((state) => state.user?.role === 'ADMIN');
  const [orderToDelete, setOrderToDelete] = useState<{ id: string; orderNumber: string } | null>(null);
  const [deleteRefusal, setDeleteRefusal] = useState<{
    id: string;
    orderNumber: string;
    status: OrderStatus;
    reason: string;
  } | null>(null);
  const [orderToCancel, setOrderToCancel] = useState<{ id: string; orderNumber: string } | null>(null);

  const { createBom, creatingOrderId, dialog: createBomDialog } = useCreateOrderBom();

  const handleDeleteClick = async (order: Order) => {
    try {
      const result = await canDeleteOrder(order.id);
      if (result.canDelete) {
        setOrderToDelete({ id: order.id, orderNumber: order.orderNumber });
      } else {
        setDeleteRefusal({
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          reason: result.reason || 'This order cannot be deleted.',
        });
      }
    } catch (err) {
      handleApiError(err, 'Failed to check if order can be deleted');
    }
  };

  const confirmDelete = async () => {
    if (!orderToDelete) return;

    try {
      await hardDeleteOrder(orderToDelete.id);
      handleApiSuccess('Order deleted', `Order ${orderToDelete.orderNumber} has been permanently deleted.`);
      refreshOrders();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to delete order');
    } finally {
      setOrderToDelete(null);
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
            className="text-sm font-medium text-info hover:underline"
          >
            {order.orderNumber}
          </button>
          <div className="text-xs text-muted-foreground mt-0.5">{formatDate(order.orderDate)}</div>
          {order.saleOrder && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/sale-orders/${order.saleOrder!.id}`);
              }}
              className="mt-0.5 inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-mono text-muted-foreground hover:bg-muted"
              title={order.saleOrder.buyerPoNumber ? `Buyer PO ${order.saleOrder.buyerPoNumber}` : 'Linked sale order'}
            >
              SO {order.saleOrder.saleOrderNumber}
            </button>
          )}
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (order) => (
        <div>
          <div className="text-sm font-medium text-foreground">{order.customer?.name || 'N/A'}</div>
          <div className="text-xs text-muted-foreground">{order.customer?.code}</div>
        </div>
      ),
    },
    {
      key: 'buyerStyles',
      header: BUYER_STYLE_CODE_LABEL,
      render: (order) => {
        const unique = uniqueStyles(order);
        if (unique.length === 0) return <span className="text-xs text-muted-foreground">-</span>;
        return (
          <div className="flex flex-col items-start gap-1">
            {unique.map(({ code, buyer }) => (
              <span key={code} className="text-xs font-medium bg-muted text-foreground px-1.5 py-0.5 rounded">
                {buyer}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: 'styles',
      header: STYLE_CODE_LABEL,
      render: (order) => {
        const unique = uniqueStyles(order);
        if (unique.length === 0) return <span className="text-xs text-muted-foreground">-</span>;
        return (
          <div className="flex flex-col items-start gap-1">
            {unique.map(({ code }) => (
              <span key={code} className="text-xs text-foreground px-1.5 py-0.5">
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
      render: (order) => <div className="text-sm text-foreground">{formatDate(order.expectedDeliveryDate)}</div>,
    },
    {
      key: 'quantity',
      header: 'Quantity',
      render: (order) => (
        <div className="text-sm font-medium text-foreground">{formatQuantity(order.totalQuantity, 'PIECE', 0)}</div>
      ),
    },
    {
      key: 'totalAmount',
      header: 'Amount',
      render: (order) => (
        <div className="text-sm font-medium">
          {Number(order.totalAmount) > 0 ? (
            <span className="text-foreground">{formatCurrency(order.totalAmount)}</span>
          ) : (
            <span className="text-warning bg-warning-muted px-2 py-0.5 rounded text-xs">Price TBD</span>
          )}
        </div>
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
        const workflowAction = getWorkflowAction(order);
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
            {workflowAction &&
              (workflowAction.type === 'create' ? (
                <Button
                  variant="default"
                  size="sm"
                  disabled={creatingOrderId === order.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    void createBom({
                      orderId: order.id,
                      styleId: workflowAction.styleId,
                      orderItemId: workflowAction.orderItemId,
                    });
                  }}
                >
                  {creatingOrderId === order.id ? 'Creating...' : 'Create BOM'}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(workflowAction.path);
                  }}
                >
                  {workflowAction.label} <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              ))}
            {(order.status === 'PENDING' || order.status === 'IN_PRODUCTION') && (
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
            {isAdmin && (order.status === 'PENDING' || order.status === 'CANCELLED') && (
              <Button
                variant="destructive"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteClick(order);
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
                  search: searchQuery || undefined,
                  customerId: customerFilter || undefined,
                  status: statusFilter !== 'all' ? statusFilter : undefined,
                }}
              />
              <Button onClick={() => navigate('/orders/new')}>+ Create New Order</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-6 space-y-4">
            <div className="flex-1">
              <SearchInput
                placeholder="Search by order number, customer or style..."
                value={searchQuery}
                maxLength={100}
                onChange={(v) => {
                  setSearchQuery(v);
                  setCurrentPage(1);
                }}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CustomerCombobox
                value={customerFilter}
                onValueChange={(v) => {
                  setCustomerFilter(v || '');
                  setCurrentPage(1);
                }}
                placeholder="All Customers"
              />

              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v);
                  setCurrentPage(1);
                }}
              >
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
            </div>
          </div>

          {/* DataTable Component */}
          <DataTable
            data={orders}
            columns={columns}
            keyExtractor={(order) => order.id}
            loading={isLoading}
            error={error ? getErrorMessage(error) : null}
            emptyState={
              hasFilters
                ? {
                    icon: <ShoppingCart className="h-16 w-16" />,
                    title: 'No orders found',
                    description: 'Try adjusting your search or filter criteria',
                  }
                : {
                    icon: <ShoppingCart className="h-16 w-16" />,
                    title: 'No orders yet',
                    description: 'Get started by creating your first order',
                    actionLabel: 'Create First Order',
                    onAction: () => navigate('/orders/new'),
                  }
            }
            pagination={{
              currentPage,
              totalPages,
              pageSize,
              totalItems: totalOrders,
              onPageChange: setCurrentPage,
              onPageSizeChange: (size) => {
                setPageSize(size);
                setCurrentPage(1);
              },
            }}
            onRowClick={(order) => navigate(`/orders/${order.id}`)}
          />
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog — permanent delete only */}
      <ConfirmDialog
        open={orderToDelete != null}
        onOpenChange={(open) => {
          if (!open) setOrderToDelete(null);
        }}
        title="Delete order permanently"
        description={`Permanently delete order ${orderToDelete?.orderNumber}? This removes all its records and cannot be undone.`}
        confirmText="Delete order"
        cancelText="Keep order"
        onConfirm={confirmDelete}
        variant="destructive"
      />

      {/* Delete refused: say why, and stop. Cancelling is offered as its own step, never done here. */}
      <AlertDialog
        open={deleteRefusal != null}
        onOpenChange={(open) => {
          if (!open) setDeleteRefusal(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Order {deleteRefusal?.orderNumber} cannot be deleted</AlertDialogTitle>
            <AlertDialogDescription>{deleteRefusal?.reason}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            {deleteRefusal && deleteRefusal.status !== 'CANCELLED' && (
              <AlertDialogAction
                onClick={() => {
                  setOrderToCancel({ id: deleteRefusal.id, orderNumber: deleteRefusal.orderNumber });
                  setDeleteRefusal(null);
                }}
              >
                Cancel the order instead…
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {orderToCancel && (
        <CancelOrderDialog
          open={orderToCancel != null}
          onOpenChange={(open) => {
            if (!open) setOrderToCancel(null);
          }}
          orderId={orderToCancel.id}
          orderNumber={orderToCancel.orderNumber}
          onCancelled={refreshOrders}
        />
      )}

      {/* Order-quantity rate-slab change (RATE_SLAB_CHANGED) — asked by the shared Create BOM */}
      {createBomDialog}
    </>
  );
}
