import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { customerService } from '@/services/customer.service';
import type { Customer, CustomerType, CustomerCategory } from '@/types/customer.types';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ExportButton from '@/components/ExportButton';
import ImportButton from '@/components/ImportButton';
import SearchInput from '@/components/SearchInput';
import EmptyState from '@/components/EmptyState';
import ConfirmDialog from '@/components/ConfirmDialog';
import { toast } from 'sonner';
import { Package } from 'lucide-react';

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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<{ id: string; name: string } | null>(null);
  const limit = 10;

  // Check if current user can create/edit customers
  const canCreateEdit = currentUser?.role === 'ADMIN' || currentUser?.role === 'SALES' || currentUser?.role === 'MERCHANDISER';

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
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to load customers';
      setError(errorMessage);
      toast.error('Error', { description: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [page, searchQuery, categoryFilter]);

  // Handle search
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setPage(1);
  };

  // Handle delete customer - Open confirmation dialog
  const handleDeleteClick = (id: string, customerName: string) => {
    setCustomerToDelete({ id, name: customerName });
    setDeleteDialogOpen(true);
  };

  // Confirm delete customer
  const confirmDelete = async () => {
    if (!customerToDelete) return;

    try {
      await customerService.deleteCustomer(customerToDelete.id);
      toast.success('Customer deleted', {
        description: `${customerToDelete.name} has been successfully deleted.`
      });
      fetchCustomers();
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to delete customer';
      toast.error('Delete failed', { description: errorMessage });
    } finally {
      setCustomerToDelete(null);
    }
  };

  // Get customer category badge color
  const getCategoryBadgeColor = (category: CustomerCategory) => {
    switch (category) {
      case 'DOMESTIC':
        return 'bg-orange-100 text-orange-800';
      case 'EXPORT':
        return 'bg-indigo-100 text-indigo-800';
      case 'LOCAL':
        return 'bg-teal-100 text-teal-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-2xl">Customer Management</CardTitle>
                <CardDescription>
                  Manage customers, buyers, and suppliers
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <ExportButton
                  module="customers"
                  filters={{ category: categoryFilter || undefined }}
                />
                {canCreateEdit && (
                  <>
                    <ImportButton
                      module="customers"
                      onSuccess={fetchCustomers}
                    />
                    <Button onClick={() => navigate('/customers/new')}>
                      + Add Customer
                    </Button>
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
              <Select value={categoryFilter || "ALL"} onValueChange={(value) => setCategoryFilter(value === "ALL" ? "" : value)}>
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

            {/* Loading State */}
            {loading && (
              <div className="text-center py-8">
                <p className="text-gray-500">Loading customers...</p>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="text-center py-8">
                <p className="text-red-500">{error}</p>
                <Button variant="outline" onClick={fetchCustomers} className="mt-4">
                  Try Again
                </Button>
              </div>
            )}

            {/* Empty State */}
            {!loading && !error && customers.length === 0 && (
              <EmptyState
                icon={<Package className="h-16 w-16" />}
                title="No customers found"
                description={searchQuery || categoryFilter
                  ? "Try adjusting your search or filter criteria"
                  : "Get started by creating your first customer"}
                actionLabel={canCreateEdit ? "Create First Customer" : undefined}
                onAction={canCreateEdit ? () => navigate('/customers/new') : undefined}
              />
            )}

            {/* Customers Table */}
            {!loading && !error && customers.length > 0 && (
              <>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Brand Names</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product Categories</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer Category</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stats</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {customers.map((customer) => (
                        <tr key={customer.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{customer.code}</div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                            {customer.gstNumber && (
                              <div className="text-xs text-gray-500">GST: {customer.gstNumber}</div>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-sm text-gray-700">
                              {customer.brandNames
                                ? customer.brandNames.split('\n').filter(b => b.trim()).join(', ')
                                : '-'}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-sm text-gray-700">
                              {customer.categories
                                ? customer.categories.split('\n').filter(c => c.trim()).join(', ')
                                : '-'}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-medium rounded ${getCategoryBadgeColor(customer.category)}`}>
                              {customer.category}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            {customer.contactPerson && (
                              <div className="text-sm text-gray-900">{customer.contactPerson}</div>
                            )}
                            {customer.email && (
                              <div className="text-xs text-gray-500">{customer.email}</div>
                            )}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{customer.phone || '-'}</div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            {customer._count && (
                              <div className="text-xs text-gray-500">
                                <div>Orders: {customer._count.orders}</div>
                                <div>Quotations: {customer._count.quotations}</div>
                                <div>Invoices: {customer._count.invoices}</div>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/customers/${customer.id}`)}
                              >
                                View
                              </Button>
                              {canCreateEdit && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => navigate(`/customers/${customer.id}/edit`)}
                                  >
                                    Edit
                                  </Button>
                                  {currentUser?.role === 'ADMIN' && (
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => handleDeleteClick(customer.id, customer.name)}
                                    >
                                      Delete
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-6">
                  <div className="text-sm text-gray-700">
                    Showing {customers.length} of {total} customers
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <div className="flex gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                        <Button
                          key={pageNum}
                          variant={pageNum === page ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setPage(pageNum)}
                        >
                          {pageNum}
                        </Button>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Customer"
        description={`Are you sure you want to delete ${customerToDelete?.name}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        variant="destructive"
      />
    </div>
  );
}
