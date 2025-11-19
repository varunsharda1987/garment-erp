import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAllSuppliers, deleteSupplier } from '@/services/supplier.service';
import { SupplierCategory, SupplierCategoryLabels } from '@/types/supplier.types';
import type { Supplier } from '@/types/supplier.types';
import ExportButton from '@/components/ExportButton';
import ImportButton from '@/components/ImportButton';
import SearchInput from '@/components/SearchInput';
import DataTable from '@/components/DataTable';
import ConfirmDialog from '@/components/ConfirmDialog';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { Package, Star } from 'lucide-react';

// Local type definition to avoid import issues
type Column<T> = {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

export default function SupplierList() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalSuppliers, setTotalSuppliers] = useState(0);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [ratingFilter, setRatingFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    fetchSuppliers();
  }, [currentPage, pageSize, searchQuery, ratingFilter, categoryFilter]);

  const fetchSuppliers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await getAllSuppliers({
        page: currentPage,
        limit: pageSize,
        search: searchQuery || undefined,
        rating: ratingFilter !== 'all' ? parseInt(ratingFilter) : undefined,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
      });
      setSuppliers(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalSuppliers(response.pagination.total);
    } catch (err: any) {
      const errorMessage = handleApiError(err, 'Failed to load suppliers', false);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setSupplierToDelete({ id, name });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!supplierToDelete) return;

    try {
      await deleteSupplier(supplierToDelete.id);
      handleApiSuccess('Supplier deleted', `${supplierToDelete.name} has been successfully deleted.`);
      fetchSuppliers();
    } catch (err: any) {
      handleApiError(err, 'Failed to delete supplier');
    } finally {
      setSupplierToDelete(null);
    }
  };

  const renderStars = (rating: number | null | undefined) => {
    const stars = rating || 0;
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= stars ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  const getCategoryBadgeColor = (category: SupplierCategory) => {
    const colors = {
      FABRIC: 'bg-blue-100 text-blue-800',
      ACCESSORIES: 'bg-purple-100 text-purple-800',
      PACKAGING: 'bg-green-100 text-green-800',
      SERVICES: 'bg-orange-100 text-orange-800',
      OTHER: 'bg-gray-100 text-gray-800',
    };
    return colors[category] || colors.OTHER;
  };

  // Define columns for DataTable
  const columns: Column<Supplier>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (supplier) => (
        <div className="text-sm font-medium text-gray-900">{supplier.code}</div>
      ),
    },
    {
      key: 'name',
      header: 'Supplier Name',
      render: (supplier) => (
        <div>
          <div className="text-sm font-medium text-gray-900">{supplier.name}</div>
          {supplier.gstNumber && (
            <div className="text-xs text-gray-500">GST: {supplier.gstNumber}</div>
          )}
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (supplier) => (
        <span className={`px-2 py-1 text-xs font-medium rounded ${getCategoryBadgeColor(supplier.category)}`}>
          {SupplierCategoryLabels[supplier.category]}
        </span>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (supplier) => (
        <div>
          {supplier.contactPerson && (
            <div className="text-sm text-gray-900">{supplier.contactPerson}</div>
          )}
          {supplier.email && (
            <div className="text-xs text-gray-500">{supplier.email}</div>
          )}
          {supplier.phone && (
            <div className="text-xs text-gray-500">{supplier.phone}</div>
          )}
        </div>
      ),
    },
    {
      key: 'rating',
      header: 'Rating',
      render: (supplier) => renderStars(supplier.rating),
    },
    {
      key: 'paymentTerms',
      header: 'Payment Terms',
      render: (supplier) => (
        <div className="text-sm text-gray-700">
          {supplier.paymentTerms || '-'}
        </div>
      ),
    },
    {
      key: 'stats',
      header: 'Stats',
      render: (supplier) => (
        supplier._count && (
          <div className="text-xs text-gray-500">
            <div>POs: {supplier._count.purchaseOrders}</div>
            <div>Materials: {supplier._count.materials}</div>
          </div>
        )
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (supplier) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/suppliers/${supplier.id}/edit`)}
          >
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteClick(supplier.id, supplier.name);
            }}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Suppliers</CardTitle>
            <div className="flex gap-2">
              <ExportButton
                module="suppliers"
                filters={{
                  category: categoryFilter !== 'all' ? categoryFilter : undefined,
                  rating: ratingFilter !== 'all' ? parseInt(ratingFilter) : undefined,
                }}
              />
              <ImportButton
                module="suppliers"
                onSuccess={fetchSuppliers}
              />
              <Button onClick={() => navigate('/suppliers/new')}>
                + Add New Supplier
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-6 flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <SearchInput
                placeholder="Search by code, name, contact person, email..."
                value={searchQuery}
                onChange={setSearchQuery}
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {Object.entries(SupplierCategoryLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={ratingFilter} onValueChange={setRatingFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Ratings" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Ratings</SelectItem>
                {[5, 4, 3, 2, 1].map((rating) => (
                  <SelectItem key={rating} value={rating.toString()}>
                    {rating} Stars & Above
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* DataTable Component */}
          <DataTable
            data={suppliers}
            columns={columns}
            keyExtractor={(supplier) => supplier.id}
            loading={isLoading}
            error={error}
            emptyState={{
              icon: <Package className="h-16 w-16" />,
              title: 'No suppliers found',
              description: searchQuery || categoryFilter || ratingFilter
                ? 'Try adjusting your search or filter criteria'
                : 'Get started by creating your first supplier',
              actionLabel: 'Create First Supplier',
              onAction: () => navigate('/suppliers/new'),
            }}
            pagination={{
              currentPage,
              totalPages,
              pageSize,
              totalItems: totalSuppliers,
              onPageChange: setCurrentPage,
              onPageSizeChange: setPageSize,
            }}
          />
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Supplier"
        description={`Are you sure you want to delete ${supplierToDelete?.name}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        variant="destructive"
      />
    </div>
  );
}
