import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getQuotations, deleteQuotation, getQuotationSummary } from '@/services/quotation.service';
import { customerService } from '@/services/customer.service';
import type { Quotation, QuotationStatus, QuotationSummary } from '@/types/quotation.types';
import { QuotationStatusLabels } from '@/types/quotation.types';
import type { Customer } from '@/types/customer.types';
import SearchInput from '@/components/SearchInput';
import DataTable from '@/components/DataTable';
import ConfirmDialog from '@/components/ConfirmDialog';
import { StatusBadge } from '@/components/StatusBadge';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { FileText, Plus } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';

// Local type definition
type Column<T> = {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

export default function QuotationList() {
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [summary, setSummary] = useState<QuotationSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalQuotations, setTotalQuotations] = useState(0);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [customerFilter, setCustomerFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [quotationToDelete, setQuotationToDelete] = useState<{ id: string; quotationNumber: string } | null>(null);

  useEffect(() => {
    fetchCustomers();
    fetchSummary();
  }, []);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, customerFilter, statusFilter]);

  useEffect(() => {
    fetchQuotations();
  }, [currentPage, pageSize, searchQuery, customerFilter, statusFilter]);

  const fetchCustomers = async () => {
    try {
      const response = await customerService.getAllCustomers({ limit: 100 });
      setCustomers(response.data);
    } catch (err) {
      handleApiError(err, 'Failed to load customers', false);
    }
  };

  const fetchSummary = async () => {
    try {
      const data = await getQuotationSummary();
      setSummary(data);
    } catch (err) {
      handleApiError(err, 'Failed to load summary', false);
    }
  };

  const fetchQuotations = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await getQuotations({
        page: currentPage,
        limit: pageSize,
        search: searchQuery || undefined,
        customerId: customerFilter !== 'all' ? customerFilter : undefined,
        status: statusFilter !== 'all' ? (statusFilter as QuotationStatus) : undefined,
      });
      setQuotations(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalQuotations(response.pagination.total);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load quotations', false);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (id: string, quotationNumber: string) => {
    setQuotationToDelete({ id, quotationNumber });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!quotationToDelete) return;

    try {
      await deleteQuotation(quotationToDelete.id);
      handleApiSuccess('Quotation deleted', `Quotation ${quotationToDelete.quotationNumber} has been successfully deleted.`);
      fetchQuotations();
      fetchSummary();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to delete quotation');
    } finally {
      setQuotationToDelete(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusVariant = (status: QuotationStatus) => {
    switch (status) {
      case 'DRAFT':
        return 'secondary';
      case 'SENT':
        return 'info';
      case 'ACCEPTED':
        return 'success';
      case 'REJECTED':
        return 'destructive';
      case 'EXPIRED':
        return 'warning';
      default:
        return 'secondary';
    }
  };

  // Define columns for DataTable
  const columns: Column<Quotation>[] = [
    {
      key: 'quotationNumber',
      header: 'Quotation Number',
      render: (quotation) => (
        <div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/quotations/${quotation.id}`);
            }}
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            {quotation.quotationNumber}
          </button>
          <div className="text-xs text-gray-500 mt-0.5">
            {formatDate(quotation.quotationDate)}
          </div>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (quotation) => (
        <div>
          <div className="text-sm font-medium text-gray-900">
            {quotation.customer?.billingName || quotation.customer?.name || 'N/A'}
          </div>
          <div className="text-xs text-gray-500">{quotation.customer?.code}</div>
        </div>
      ),
    },
    {
      key: 'validUntil',
      header: 'Valid Until',
      render: (quotation) => {
        const isExpired = new Date(quotation.validUntil) < new Date() &&
                         quotation.status !== 'ACCEPTED' &&
                         quotation.status !== 'REJECTED';
        return (
          <div className={`text-sm ${isExpired ? 'text-red-600 font-medium' : 'text-gray-700'}`}>
            {formatDate(quotation.validUntil)}
          </div>
        );
      },
    },
    {
      key: 'items',
      header: 'Items',
      render: (quotation) => (
        <div className="text-sm text-gray-700">
          {quotation.items?.length || 0} item(s)
        </div>
      ),
    },
    {
      key: 'totalAmount',
      header: 'Total Amount',
      render: (quotation) => (
        <div className="text-sm font-medium text-gray-900">
          {quotation.totalAmount ? formatCurrency(quotation.totalAmount) : 'N/A'}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (quotation) => (
        <StatusBadge
          status={QuotationStatusLabels[quotation.status]}
          variant={getStatusVariant(quotation.status)}
        />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (quotation) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/quotations/${quotation.id}`);
            }}
          >
            View
          </Button>
          {quotation.status === 'DRAFT' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteClick(quotation.id, quotation.quotationNumber);
              }}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              Delete
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <FileText className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Quotations</h1>
            <p className="text-sm text-gray-500">Manage customer quotations and proforma invoices</p>
          </div>
        </div>
        <Button onClick={() => navigate('/quotations/new')} className="gap-2">
          <Plus className="h-4 w-4" />
          New Quotation
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.total}</div>
              <p className="text-xs text-gray-500 mt-1">
                {formatCurrency(summary.totalValue)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Draft</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-600">{summary.draft}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Sent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{summary.sent}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Accepted</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{summary.accepted}</div>
              <p className="text-xs text-gray-500 mt-1">
                Value: {formatCurrency(summary.acceptedValue)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Rejected</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{summary.rejected}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search by quotation number..."
              />
            </div>
            <Select value={customerFilter} onValueChange={setCustomerFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Customers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Customers</SelectItem>
                {customers?.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.billingName || customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="SENT">Sent</SelectItem>
                <SelectItem value="ACCEPTED">Accepted</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="EXPIRED">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent className="pt-6">
          <DataTable
            columns={columns}
            data={quotations}
            keyExtractor={(quotation) => quotation.id}
            loading={isLoading}
            error={error}
            pagination={{
              currentPage,
              pageSize,
              totalPages,
              totalItems: totalQuotations,
              onPageChange: setCurrentPage,
              onPageSizeChange: setPageSize,
            }}
            onRowClick={(quotation) => navigate(`/quotations/${quotation.id}`)}
          />
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Quotation"
        description={`Are you sure you want to delete quotation ${quotationToDelete?.quotationNumber}? This action cannot be undone.`}
        onConfirm={confirmDelete}
        confirmText="Delete"
        variant="destructive"
      />
    </div>
  );
}
