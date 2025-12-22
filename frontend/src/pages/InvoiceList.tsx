import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getInvoices, deleteInvoice, getInvoiceSummary } from '@/services/invoice.service';
import { customerService } from '@/services/customer.service';
import type { Invoice, InvoiceStatus, InvoiceSummary } from '@/types/invoice.types';
import { InvoiceStatusLabels } from '@/types/invoice.types';
import type { Customer } from '@/types/customer.types';
import SearchInput from '@/components/SearchInput';
import DataTable from '@/components/DataTable';
import ConfirmDialog from '@/components/ConfirmDialog';
import { StatusBadge } from '@/components/StatusBadge';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { FileText, Plus } from 'lucide-react';

// Local type definition
type Column<T> = {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

export default function InvoiceList() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [summary, setSummary] = useState<InvoiceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalInvoices, setTotalInvoices] = useState(0);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [customerFilter, setCustomerFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<{ id: string; invoiceNumber: string } | null>(null);

  useEffect(() => {
    fetchCustomers();
    fetchSummary();
  }, []);

  useEffect(() => {
    fetchInvoices();
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
      const data = await getInvoiceSummary();
      setSummary(data);
    } catch (err) {
      handleApiError(err, 'Failed to load summary', false);
    }
  };

  const fetchInvoices = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await getInvoices({
        page: currentPage,
        limit: pageSize,
        search: searchQuery || undefined,
        customerId: customerFilter !== 'all' ? customerFilter : undefined,
        status: statusFilter !== 'all' ? (statusFilter as InvoiceStatus) : undefined,
      });
      setInvoices(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalInvoices(response.pagination.total);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load invoices', false);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (id: string, invoiceNumber: string) => {
    setInvoiceToDelete({ id, invoiceNumber });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!invoiceToDelete) return;

    try {
      await deleteInvoice(invoiceToDelete.id);
      handleApiSuccess('Invoice deleted', `Invoice ${invoiceToDelete.invoiceNumber} has been successfully deleted.`);
      fetchInvoices();
      fetchSummary();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to delete invoice');
    } finally {
      setInvoiceToDelete(null);
    }
  };

  const formatAmount = (amount: number) => {
    return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusVariant = (status: InvoiceStatus) => {
    switch (status) {
      case 'PENDING':
        return 'warning';
      case 'PARTIALLY_PAID':
        return 'info';
      case 'PAID':
        return 'success';
      case 'OVERDUE':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  // Define columns for DataTable
  const columns: Column<Invoice>[] = [
    {
      key: 'invoiceNumber',
      header: 'Invoice Number',
      render: (invoice) => (
        <div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/invoices/${invoice.id}`);
            }}
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            {invoice.invoiceNumber}
          </button>
          <div className="text-xs text-gray-500 mt-0.5">
            {formatDate(invoice.invoiceDate)}
          </div>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (invoice) => (
        <div>
          <div className="text-sm font-medium text-gray-900">
            {invoice.customers?.billingName || invoice.customers?.name || 'N/A'}
          </div>
          <div className="text-xs text-gray-500">{invoice.customers?.code}</div>
        </div>
      ),
    },
    {
      key: 'order',
      header: 'Order',
      render: (invoice) => (
        <div className="text-sm text-gray-700">
          {invoice.orders?.orderNumber || 'N/A'}
        </div>
      ),
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      render: (invoice) => {
        const isOverdue = new Date(invoice.dueDate) < new Date() && invoice.status !== 'PAID';
        return (
          <div className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-700'}`}>
            {formatDate(invoice.dueDate)}
          </div>
        );
      },
    },
    {
      key: 'totalAmount',
      header: 'Total',
      render: (invoice) => (
        <div className="text-sm font-medium text-gray-900">
          {formatAmount(invoice.totalAmount)}
        </div>
      ),
    },
    {
      key: 'paidAmount',
      header: 'Paid',
      render: (invoice) => (
        <div className="text-sm text-gray-700">
          {formatAmount(invoice.paidAmount)}
        </div>
      ),
    },
    {
      key: 'balanceAmount',
      header: 'Balance',
      render: (invoice) => (
        <div className={`text-sm font-medium ${invoice.balanceAmount > 0 ? 'text-orange-600' : 'text-green-600'}`}>
          {formatAmount(invoice.balanceAmount)}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (invoice) => (
        <StatusBadge status={InvoiceStatusLabels[invoice.status]} variant={getStatusVariant(invoice.status)} />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (invoice) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/invoices/${invoice.id}`);
            }}
          >
            View
          </Button>
          {invoice.status === 'PENDING' && invoice.paidAmount === 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteClick(invoice.id, invoice.invoiceNumber);
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
          <div className="p-2 bg-blue-100 rounded-lg">
            <FileText className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
            <p className="text-sm text-gray-500">Manage customer invoices and payments</p>
          </div>
        </div>
        <Button onClick={() => navigate('/invoices/new')} className="gap-2">
          <Plus className="h-4 w-4" />
          New Invoice
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.total}</div>
              <p className="text-xs text-gray-500 mt-1">
                {formatAmount(summary.totalAmount)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{summary.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Overdue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{summary.overdue}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Outstanding</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {formatAmount(summary.balanceAmount)}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Paid: {formatAmount(summary.paidAmount)}
              </p>
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
                placeholder="Search by invoice number..."
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
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="PARTIALLY_PAID">Partially Paid</SelectItem>
                <SelectItem value="PAID">Paid</SelectItem>
                <SelectItem value="OVERDUE">Overdue</SelectItem>
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
            data={invoices}
            keyExtractor={(invoice) => invoice.id}
            loading={isLoading}
            error={error}
            pagination={{
              currentPage,
              pageSize,
              totalPages,
              totalItems: totalInvoices,
              onPageChange: setCurrentPage,
              onPageSizeChange: setPageSize,
            }}
            onRowClick={(invoice) => navigate(`/invoices/${invoice.id}`)}
          />
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Invoice"
        description={`Are you sure you want to delete invoice ${invoiceToDelete?.invoiceNumber}? This action cannot be undone.`}
        onConfirm={confirmDelete}
        confirmText="Delete"
        variant="destructive"
      />
    </div>
  );
}
