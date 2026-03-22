import { useState, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { customerService, type DeactivationCheck } from '@/services/customer.service';
import type { Customer, CustomerCategory } from '@/types/customer.types';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import ExportButton from '@/components/ExportButton';
import ImportButton from '@/components/ImportButton';
import SearchInput from '@/components/SearchInput';
import ConfirmDialog from '@/components/ConfirmDialog';
import DataTable from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { Package, AlertTriangle } from 'lucide-react';

// Local type definition to avoid import issues
type Column<T> = {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

export default function CustomerList() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.user);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [blockedDialogOpen, setBlockedDialogOpen] = useState(false);
  const [customerToDeactivate, setCustomerToDeactivate] = useState<{ id: string; name: string } | null>(null);
  const [deactivationCheck, setDeactivationCheck] = useState<DeactivationCheck | null>(null);
  const [checkingDeactivation, setCheckingDeactivation] = useState(false);
  const limit = 10;

  // Check if current user can create/edit customers
  const canCreateEdit =
    currentUser?.role === 'ADMIN' || currentUser?.role === 'SALES' || currentUser?.role === 'MERCHANDISER';

  // Fetch customers
  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await customerService.getAllCustomers({
        page,
        limit,
        search: searchQuery || undefined,
        category: categoryFilter || undefined,
      });
      setCustomers(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotal(response.pagination.total);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load customers', false);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [categoryFilter]);

  useEffect(() => {
    fetchCustomers();
  }, [page, searchQuery, categoryFilter]);

  // Handle search
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setPage(1);
  };

  // Handle deactivate customer - Check if can deactivate first
  const handleDeactivateClick = async (id: string, customerName: string) => {
    setCustomerToDeactivate({ id, name: customerName });
    setCheckingDeactivation(true);

    try {
      const check = await customerService.canDeactivate(id);
      setDeactivationCheck(check);

      if (check.canDeactivate) {
        setDeactivateDialogOpen(true);
      } else {
        setBlockedDialogOpen(true);
      }
    } catch (err: unknown) {
      handleApiError(err, 'Failed to check deactivation status');
    } finally {
      setCheckingDeactivation(false);
    }
  };

  // Confirm deactivate customer
  const confirmDeactivate = async () => {
    if (!customerToDeactivate) return;

    try {
      await customerService.deleteCustomer(customerToDeactivate.id);
      handleApiSuccess('Customer deactivated', `${customerToDeactivate.name} has been successfully deactivated.`);
      fetchCustomers();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to deactivate customer');
    } finally {
      setCustomerToDeactivate(null);
      setDeactivationCheck(null);
    }
  };

  // Get customer category badge variant
  const getCategoryVariant = (category: CustomerCategory) => {
    switch (category) {
      case 'DOMESTIC':
        return 'warning' as const;
      case 'EXPORT':
        return 'info' as const;
      case 'WHOLESALER':
        return 'success' as const;
      case 'RETAILER':
        return 'secondary' as const;
      default:
        return 'secondary' as const;
    }
  };

  // Define columns for DataTable
  const columns: Column<Customer>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (customer) => <div className="text-sm font-medium text-gray-900">{customer.code}</div>,
    },
    {
      key: 'name',
      header: 'Company Name',
      render: (customer) => (
        <div>
          <div className="text-sm font-medium text-gray-900">{customer.name}</div>
          {customer.gstNumber && <div className="text-xs text-gray-500">GST: {customer.gstNumber}</div>}
        </div>
      ),
    },
    {
      key: 'brandNames',
      header: 'Brand Names',
      render: (customer) => (
        <div className="text-sm text-gray-700">
          {customer.brandNames
            ? customer.brandNames
                .split('\n')
                .filter((b) => b.trim())
                .slice(0, 2)
                .join(', ')
            : '-'}
          {customer.brandNames && customer.brandNames.split('\n').filter((b) => b.trim()).length > 2 && (
            <span className="text-xs text-gray-500">
              {' '}
              +{customer.brandNames.split('\n').filter((b) => b.trim()).length - 2} more
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'categories',
      header: 'Product Categories',
      render: (customer) => (
        <div className="text-sm text-gray-700">
          {customer.categories
            ? customer.categories
                .split('\n')
                .filter((c) => c.trim())
                .slice(0, 2)
                .join(', ')
            : '-'}
          {customer.categories && customer.categories.split('\n').filter((c) => c.trim()).length > 2 && (
            <span className="text-xs text-gray-500">
              {' '}
              +{customer.categories.split('\n').filter((c) => c.trim()).length - 2} more
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Customer Category',
      render: (customer) => <StatusBadge status={customer.category} variant={getCategoryVariant(customer.category)} />,
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (customer) => (
        <div>
          {customer.contactPerson && <div className="text-sm text-gray-900">{customer.contactPerson}</div>}
          {customer.email && <div className="text-xs text-gray-500">{customer.email}</div>}
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (customer) => <div className="text-sm text-gray-900">{customer.phone || '-'}</div>,
    },
    {
      key: 'stats',
      header: 'Stats',
      render: (customer) =>
        customer._count && (
          <div className="text-xs text-gray-500">
            <div>Orders: {customer._count.orders}</div>
            <div>Quotations: {customer._count.quotations}</div>
            <div>Invoices: {customer._count.invoices}</div>
          </div>
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (customer) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/customers/${customer.id}`);
            }}
          >
            View
          </Button>
          {canCreateEdit && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/customers/${customer.id}/edit`);
                }}
              >
                Edit
              </Button>
              {currentUser?.role === 'ADMIN' && (
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={checkingDeactivation}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeactivateClick(customer.id, customer.name);
                  }}
                >
                  {checkingDeactivation && customerToDeactivate?.id === customer.id ? 'Checking...' : 'Deactivate'}
                </Button>
              )}
            </>
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
            <div>
              <CardTitle className="text-2xl">Customer Management</CardTitle>
              <CardDescription>Manage customers, buyers, and suppliers</CardDescription>
            </div>
            <div className="flex gap-2">
              <ExportButton module="customers" filters={{ category: categoryFilter || undefined }} />
              {canCreateEdit && (
                <>
                  <ImportButton module="customers" onSuccess={fetchCustomers} />
                  <Button onClick={() => navigate('/customers/new')}>+ Add Customer</Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search and Filters */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <SearchInput
                placeholder="Search by code, company name, contact person, or email..."
                value={searchQuery}
                onChange={handleSearch}
              />
            </div>
            <Select
              value={categoryFilter || 'ALL'}
              onValueChange={(value) => setCategoryFilter(value === 'ALL' ? '' : value)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Categories</SelectItem>
                <SelectItem value="DOMESTIC">Domestic</SelectItem>
                <SelectItem value="EXPORT">Export</SelectItem>
                <SelectItem value="LOCAL">Local</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* DataTable */}
          <DataTable
            data={customers}
            columns={columns}
            keyExtractor={(customer) => customer.id}
            loading={loading}
            error={error}
            emptyState={{
              icon: <Package className="h-16 w-16" />,
              title: 'No customers found',
              description:
                searchQuery || categoryFilter
                  ? 'Try adjusting your search or filter criteria'
                  : 'Get started by creating your first customer',
              actionLabel: canCreateEdit && !searchQuery && !categoryFilter ? 'Create First Customer' : undefined,
              onAction: canCreateEdit && !searchQuery && !categoryFilter ? () => navigate('/customers/new') : undefined,
            }}
            pagination={{
              currentPage: page,
              totalPages,
              pageSize: limit,
              totalItems: total,
              onPageChange: setPage,
              onPageSizeChange: () => {}, // Fixed page size for now
            }}
            onRowClick={(customer) => navigate(`/customers/${customer.id}`)}
          />
        </CardContent>
      </Card>

      {/* Deactivate Confirmation Dialog */}
      <ConfirmDialog
        open={deactivateDialogOpen}
        onOpenChange={setDeactivateDialogOpen}
        title="Deactivate Customer"
        description={`Are you sure you want to deactivate ${customerToDeactivate?.name}? The customer will be hidden from lists but all historical data will be preserved.`}
        confirmText="Deactivate"
        cancelText="Cancel"
        onConfirm={confirmDeactivate}
        variant="destructive"
      />

      {/* Blocked Deactivation Dialog */}
      <Dialog open={blockedDialogOpen} onOpenChange={setBlockedDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Cannot Deactivate Customer
            </DialogTitle>
            <DialogDescription>
              {customerToDeactivate?.name} cannot be deactivated due to active dependencies.
            </DialogDescription>
          </DialogHeader>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Please resolve the following:</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside mt-2">
                {deactivationCheck?.blockers.map((blocker, index) => (
                  <li key={index}>
                    {blocker.count} {blocker.type}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockedDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
