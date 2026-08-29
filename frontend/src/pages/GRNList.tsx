import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAllGRNs } from '@/services/grn.service';
import type { GRN, GRNStatus } from '@/types/grn.types';
import { GRNStatusLabels } from '@/types/grn.types';
import SearchInput from '@/components/SearchInput';
import DataTable from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { SupplierCombobox } from '@/components/SupplierCombobox';
import { handleApiError } from '@/lib/api-error-handler';
import { PackageOpen, Eye } from 'lucide-react';

type Column<T> = {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

export default function GRNList() {
  const navigate = useNavigate();
  const [grns, setGRNs] = useState<GRN[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierFilter, setSupplierFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, supplierFilter, statusFilter]);

  useEffect(() => {
    fetchGRNs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, searchQuery, supplierFilter, statusFilter]);

  const fetchGRNs = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await getAllGRNs({
        page: currentPage,
        limit: pageSize,
        search: searchQuery || undefined,
        supplierId: supplierFilter || undefined,
        status: statusFilter !== 'all' ? (statusFilter as GRNStatus) : undefined,
      });
      setGRNs(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.total);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load GRNs', false);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusVariant = (status: GRNStatus) => {
    switch (status) {
      case 'PENDING_QC':
        return 'warning';
      case 'ACCEPTED':
        return 'success';
      case 'REJECTED':
        return 'destructive';
      case 'PARTIALLY_ACCEPTED':
        return 'warning';
      default:
        return 'secondary';
    }
  };

  const columns: Column<GRN>[] = [
    {
      key: 'grnNumber',
      header: 'GRN Number',
      render: (grn) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/procurement/grn/${grn.id}`);
          }}
          className="text-sm font-medium text-info hover:underline"
        >
          {grn.grnNumber}
        </button>
      ),
    },
    {
      key: 'inwardDate',
      header: 'Inward Date',
      render: (grn) => <div className="text-sm text-foreground">{formatDate(grn.receivingDate)}</div>,
    },
    {
      key: 'poNumber',
      header: 'PO / JWO',
      render: (grn) =>
        grn.poId ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/procurement/purchase-orders/${grn.poId}`);
            }}
            className="text-sm text-info hover:underline"
          >
            {grn.purchaseOrders?.poNumber || '-'}
          </button>
        ) : (grn as { jobWorkOrder?: { id: string; jobWorkNumber: string } }).jobWorkOrder ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/job-work-orders/${(grn as { jobWorkOrder?: { id: string } }).jobWorkOrder!.id}`);
            }}
            className="text-sm text-info hover:underline"
          >
            {(grn as { jobWorkOrder?: { jobWorkNumber: string } }).jobWorkOrder!.jobWorkNumber}
          </button>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        ),
    },
    {
      key: 'supplier',
      header: 'Supplier',
      render: (grn) => (
        <div>
          <div className="text-sm font-medium text-foreground">{grn.supplier?.name || 'N/A'}</div>
          <div className="text-xs text-muted-foreground">{grn.supplier?.code}</div>
        </div>
      ),
    },
    {
      key: 'warehouse',
      header: 'Warehouse',
      render: (grn) => <div className="text-sm text-foreground">{grn.warehouse?.warehouseName || '-'}</div>,
    },
    {
      key: 'invoiceNumber',
      header: 'Invoice #',
      render: (grn) => <div className="text-sm text-foreground">{grn.invoiceNumber || '-'}</div>,
    },
    {
      key: 'items',
      header: 'Items',
      render: (grn) => <div className="text-sm text-foreground">{grn.itemCount || grn.items?.length || 0} items</div>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (grn) => <StatusBadge status={GRNStatusLabels[grn.status]} variant={getStatusVariant(grn.status)} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (grn) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/procurement/grn/${grn.id}`);
            }}
            title="View"
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <PackageOpen className="h-5 w-5" />
            Goods Receiving Notes
          </CardTitle>
          <div className="flex gap-2">
            <Button onClick={() => navigate('/procurement/grn/new')}>+ Create GRN</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="mb-6 space-y-4">
          <div className="flex-1">
            <SearchInput
              placeholder="Search by GRN number, PO number, or supplier..."
              value={searchQuery}
              onChange={setSearchQuery}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SupplierCombobox
              value={supplierFilter}
              onValueChange={setSupplierFilter}
              placeholder="All Suppliers"
              allowAll
            />

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="PENDING_QC">Pending QC</SelectItem>
                <SelectItem value="ACCEPTED">Accepted</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="PARTIALLY_ACCEPTED">Partially Accepted</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* DataTable */}
        <DataTable
          data={grns}
          columns={columns}
          keyExtractor={(grn) => grn.id}
          loading={isLoading}
          error={error}
          emptyState={{
            icon: <PackageOpen className="h-16 w-16" />,
            title: 'No GRNs found',
            description:
              searchQuery || supplierFilter !== 'all' || statusFilter !== 'all'
                ? 'Try adjusting your search or filter criteria'
                : 'Create a GRN when receiving goods against a purchase order',
            actionLabel: 'Create GRN',
            onAction: () => navigate('/procurement/grn/new'),
          }}
          pagination={{
            currentPage,
            totalPages,
            pageSize,
            totalItems,
            onPageChange: setCurrentPage,
            onPageSizeChange: setPageSize,
          }}
          onRowClick={(grn) => navigate(`/procurement/grn/${grn.id}`)}
        />
      </CardContent>
    </Card>
  );
}
