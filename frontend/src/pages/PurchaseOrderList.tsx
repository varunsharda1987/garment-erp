import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAllPurchaseOrders, deletePurchaseOrder, cancelPurchaseOrder } from '@/services/purchaseOrder.service';
import { getAllSuppliers } from '@/services/supplier.service';
import type { PurchaseOrder, PurchaseOrderStatus } from '@/types/purchaseOrder.types';
import { PurchaseOrderStatusLabels, PurchaseOrderStatusColors } from '@/types/purchaseOrder.types';
import SearchInput from '@/components/SearchInput';
import DataTable from '@/components/DataTable';
import ConfirmDialog from '@/components/ConfirmDialog';
import { StatusBadge } from '@/components/StatusBadge';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { ShoppingBag, Trash2, Eye, Send, XCircle } from 'lucide-react';

type Column<T> = {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

interface Supplier {
  id: string;
  code: string;
  name: string;
}

export default function PurchaseOrderList() {
  const navigate = useNavigate();
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Delete/Cancel dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<{ id: string; poNumber: string } | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    fetchSuppliers();
  }, []);

  useEffect(() => {
    fetchPurchaseOrders();
  }, [currentPage, pageSize, searchQuery, supplierFilter, statusFilter]);

  const fetchSuppliers = async () => {
    try {
      const response = await getAllSuppliers({ limit: 200 });
      setSuppliers(response.data);
    } catch (err) {
      handleApiError(err, 'Failed to load suppliers', false);
    }
  };

  const fetchPurchaseOrders = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await getAllPurchaseOrders({
        page: currentPage,
        limit: pageSize,
        search: searchQuery || undefined,
        supplierId: supplierFilter !== 'all' ? supplierFilter : undefined,
        status: statusFilter !== 'all' ? (statusFilter as PurchaseOrderStatus) : undefined,
      });
      setPurchaseOrders(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.total);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load purchase orders', false);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (id: string, poNumber: string) => {
    setSelectedPO({ id, poNumber });
    setDeleteDialogOpen(true);
  };

  const handleCancelClick = (id: string, poNumber: string) => {
    setSelectedPO({ id, poNumber });
    setCancelReason('');
    setCancelDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedPO) return;

    try {
      await deletePurchaseOrder(selectedPO.id);
      handleApiSuccess('Purchase order deleted', `PO ${selectedPO.poNumber} has been deleted.`);
      fetchPurchaseOrders();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to delete purchase order');
    } finally {
      setSelectedPO(null);
      setDeleteDialogOpen(false);
    }
  };

  const confirmCancel = async () => {
    if (!selectedPO) return;

    try {
      await cancelPurchaseOrder(selectedPO.id, { reason: cancelReason });
      handleApiSuccess('Purchase order cancelled', `PO ${selectedPO.poNumber} has been cancelled.`);
      fetchPurchaseOrders();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to cancel purchase order');
    } finally {
      setSelectedPO(null);
      setCancelDialogOpen(false);
      setCancelReason('');
    }
  };

  const formatAmount = (amount: number | null) => {
    if (amount === null || amount === undefined) return '-';
    return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusVariant = (status: PurchaseOrderStatus) => {
    switch (status) {
      case 'DRAFT':
        return 'secondary';
      case 'SENT':
        return 'info';
      case 'ACKNOWLEDGED':
        return 'info';
      case 'PARTIALLY_RECEIVED':
        return 'warning';
      case 'RECEIVED':
        return 'success';
      case 'CANCELLED':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const columns: Column<PurchaseOrder>[] = [
    {
      key: 'poNumber',
      header: 'PO Number',
      render: (po) => (
        <div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/procurement/purchase-orders/${po.id}`);
            }}
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            {po.poNumber}
          </button>
          <div className="text-xs text-gray-500 mt-0.5">
            {formatDate(po.poDate)}
          </div>
        </div>
      ),
    },
    {
      key: 'supplier',
      header: 'Supplier',
      render: (po) => (
        <div>
          <div className="text-sm font-medium text-gray-900">
            {po.suppliers?.name || 'N/A'}
          </div>
          <div className="text-xs text-gray-500">{po.suppliers?.code}</div>
        </div>
      ),
    },
    {
      key: 'expectedDeliveryDate',
      header: 'Expected Delivery',
      render: (po) => (
        <div className="text-sm text-gray-700">
          {formatDate(po.expectedDeliveryDate)}
        </div>
      ),
    },
    {
      key: 'items',
      header: 'Items',
      render: (po) => (
        <div className="text-sm text-gray-700">
          {po.itemCount || po.purchase_order_items?.length || 0} items
        </div>
      ),
    },
    {
      key: 'totalAmount',
      header: 'Amount',
      render: (po) => (
        <div className="text-sm font-medium text-gray-900">
          {formatAmount(po.totalAmount)}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (po) => (
        <StatusBadge
          status={PurchaseOrderStatusLabels[po.status]}
          variant={getStatusVariant(po.status)}
        />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (po) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/procurement/purchase-orders/${po.id}`);
            }}
            title="View"
          >
            <Eye className="h-4 w-4" />
          </Button>
          {po.status === 'DRAFT' && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/procurement/purchase-orders/${po.id}/edit`);
                }}
                title="Edit"
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteClick(po.id, po.poNumber);
                }}
                title="Delete"
                className="text-red-600 hover:text-red-800"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
          {po.status !== 'DRAFT' && po.status !== 'RECEIVED' && po.status !== 'CANCELLED' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleCancelClick(po.id, po.poNumber);
              }}
              title="Cancel"
              className="text-red-600 hover:text-red-800"
            >
              <XCircle className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              Purchase Orders
            </CardTitle>
            <div className="flex gap-2">
              <Button onClick={() => navigate('/procurement/purchase-orders/new')}>
                + Create Purchase Order
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-6 space-y-4">
            <div className="flex-1">
              <SearchInput
                placeholder="Search by PO number or supplier..."
                value={searchQuery}
                onChange={setSearchQuery}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Suppliers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Suppliers</SelectItem>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name} ({supplier.code})
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
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="SENT">Sent</SelectItem>
                  <SelectItem value="ACKNOWLEDGED">Acknowledged</SelectItem>
                  <SelectItem value="PARTIALLY_RECEIVED">Partially Received</SelectItem>
                  <SelectItem value="RECEIVED">Received</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* DataTable */}
          <DataTable
            data={purchaseOrders}
            columns={columns}
            keyExtractor={(po) => po.id}
            loading={isLoading}
            error={error}
            emptyState={{
              icon: <ShoppingBag className="h-16 w-16" />,
              title: 'No purchase orders found',
              description:
                searchQuery || supplierFilter !== 'all' || statusFilter !== 'all'
                  ? 'Try adjusting your search or filter criteria'
                  : 'Get started by creating your first purchase order',
              actionLabel: 'Create Purchase Order',
              onAction: () => navigate('/procurement/purchase-orders/new'),
            }}
            pagination={{
              currentPage,
              totalPages,
              pageSize,
              totalItems,
              onPageChange: setCurrentPage,
              onPageSizeChange: setPageSize,
            }}
            onRowClick={(po) => navigate(`/procurement/purchase-orders/${po.id}`)}
          />
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Purchase Order"
        description={`Are you sure you want to delete PO ${selectedPO?.poNumber}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        variant="destructive"
      />

      {/* Cancel Confirmation Dialog */}
      <ConfirmDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        title="Cancel Purchase Order"
        description={`Are you sure you want to cancel PO ${selectedPO?.poNumber}? This action cannot be undone.`}
        confirmText="Cancel Order"
        cancelText="Keep Order"
        onConfirm={confirmCancel}
        variant="destructive"
      />
    </>
  );
}
