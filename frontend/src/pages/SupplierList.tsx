import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getAllSuppliers, deleteSupplier, canDeactivate, type DeactivationCheck } from '@/services/supplier.service';
import { SupplierCategory, SupplierCategoryLabels } from '@/types/supplier.types';
import type { Supplier } from '@/types/supplier.types';
import ExportButton from '@/components/ExportButton';
import ImportButton from '@/components/ImportButton';
import SearchInput from '@/components/SearchInput';
import DataTable from '@/components/DataTable';
import ConfirmDialog from '@/components/ConfirmDialog';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { Package, Star, AlertTriangle } from 'lucide-react';

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state - initialize from URL params
  const initialPage = parseInt(searchParams.get('page') || '1', 10);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalSuppliers, setTotalSuppliers] = useState(0);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [ratingFilter, setRatingFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Deactivate dialog state
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [blockedDialogOpen, setBlockedDialogOpen] = useState(false);
  const [supplierToDeactivate, setSupplierToDeactivate] = useState<{ id: string; name: string } | null>(null);
  const [deactivationCheck, setDeactivationCheck] = useState<DeactivationCheck | null>(null);
  const [checkingDeactivation, setCheckingDeactivation] = useState(false);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, ratingFilter, categoryFilter]);

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
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load suppliers', false);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeactivateClick = async (id: string, name: string) => {
    setSupplierToDeactivate({ id, name });
    setCheckingDeactivation(true);

    try {
      const check = await canDeactivate(id);
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

  const confirmDeactivate = async () => {
    if (!supplierToDeactivate) return;

    try {
      await deleteSupplier(supplierToDeactivate.id);
      handleApiSuccess('Supplier deactivated', `${supplierToDeactivate.name} has been successfully deactivated.`);
      fetchSuppliers();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to deactivate supplier');
    } finally {
      setSupplierToDeactivate(null);
      setDeactivationCheck(null);
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
    const colors: Record<string, string> = {
      FABRIC_SUPPLIER: 'bg-blue-100 text-blue-800',
      TRIMS_SUPPLIER: 'bg-purple-100 text-purple-800',
      THREAD_SUPPLIER: 'bg-green-100 text-green-800',
      PACKAGING_SUPPLIER: 'bg-teal-100 text-teal-800',
      LACE_SUPPLIER: 'bg-indigo-100 text-indigo-800',
      DYEING_PRINTING: 'bg-yellow-100 text-yellow-800',
      EMBROIDERY: 'bg-pink-100 text-pink-800',
      HAND_WORK: 'bg-rose-100 text-rose-800',
      SMOCKING: 'bg-amber-100 text-amber-800',
      CMT_UNIT: 'bg-orange-100 text-orange-800',
      FINISHING_CONTRACTOR: 'bg-cyan-100 text-cyan-800',
      STITCHING_CONTRACTOR: 'bg-lime-100 text-lime-800',
      WASHING: 'bg-sky-100 text-sky-800',
      DORI_PIPING_CONTRACTOR: 'bg-violet-100 text-violet-800',
      MACHINE_PARTS_SUPPLIER: 'bg-slate-100 text-slate-800',
      OTHER_SERVICES: 'bg-gray-100 text-gray-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
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
          {supplier.gstNumbers && supplier.gstNumbers.length > 0 && (
            <div className="text-xs text-gray-500">GST: {supplier.gstNumbers[0].gstNumber}</div>
          )}
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Categories',
      render: (supplier) => (
        <div className="flex flex-wrap gap-1 max-w-xs">
          {(supplier.supplierCategories || []).map((cat) => (
            <span key={cat} className={`px-2 py-0.5 text-xs font-medium rounded ${getCategoryBadgeColor(cat)}`}>
              {SupplierCategoryLabels[cat]}
            </span>
          ))}
        </div>
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
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/suppliers/${supplier.id}`);
            }}
          >
            View
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/suppliers/${supplier.id}/edit?page=${currentPage}`);
            }}
          >
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={checkingDeactivation}
            onClick={(e) => {
              e.stopPropagation();
              handleDeactivateClick(supplier.id, supplier.name);
            }}
          >
            {checkingDeactivation && supplierToDeactivate?.id === supplier.id ? 'Checking...' : 'Deactivate'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
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
            onRowClick={(supplier) => navigate(`/suppliers/${supplier.id}`)}
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
              onPageChange: (page) => {
                setCurrentPage(page);
                setSearchParams({ page: page.toString() });
              },
              onPageSizeChange: setPageSize,
            }}
          />
        </CardContent>
      </Card>

      {/* Deactivate Confirmation Dialog */}
      <ConfirmDialog
        open={deactivateDialogOpen}
        onOpenChange={setDeactivateDialogOpen}
        title="Deactivate Supplier"
        description={`Are you sure you want to deactivate ${supplierToDeactivate?.name}? The supplier will be hidden from lists but all historical data will be preserved.`}
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
              Cannot Deactivate Supplier
            </DialogTitle>
            <DialogDescription>
              {supplierToDeactivate?.name} cannot be deactivated due to active dependencies.
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
