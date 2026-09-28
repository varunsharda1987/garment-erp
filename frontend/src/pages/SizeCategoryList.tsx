import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAllSizeCategories, deleteSizeCategory } from '@/services/sizeCategory.service';
import type { SizeCategory } from '@/types/sizeCategory.types';
import SearchInput from '@/components/SearchInput';
import { FilterBar } from '@/components/filters';
import DataTable from '@/components/DataTable';
import ConfirmDialog from '@/components/ConfirmDialog';
import { StatusBadge } from '@/components/StatusBadge';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { Ruler } from 'lucide-react';

type Column<T> = {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

export default function SizeCategoryList() {
  const navigate = useNavigate();
  const [sizeCategories, setSizeCategories] = useState<SizeCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    fetchSizeCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, searchQuery, statusFilter]);

  const fetchSizeCategories = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await getAllSizeCategories({
        page: currentPage,
        limit: pageSize,
        search: searchQuery || undefined,
        isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
      });
      setSizeCategories(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.total);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load size categories', false);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const activeFilterCount = [searchQuery, statusFilter !== 'all'].filter(Boolean).length;

  // Clears every filter and goes back to page 1; the rows-per-page choice is not a filter, so it stays
  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setCurrentPage(1);
  };

  const handleDeleteClick = (id: string, name: string) => {
    setCategoryToDelete({ id, name });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!categoryToDelete) return;

    try {
      await deleteSizeCategory(categoryToDelete.id);
      handleApiSuccess('Size category deleted', `${categoryToDelete.name} has been successfully deleted.`);
      fetchSizeCategories();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to delete size category');
    } finally {
      setCategoryToDelete(null);
    }
  };

  const columns: Column<SizeCategory>[] = [
    {
      key: 'name',
      header: 'Category Name',
      render: (category) => (
        <div>
          <div className="text-sm font-medium text-foreground">{category.name}</div>
          {category.description && (
            <div className="text-xs text-muted-foreground line-clamp-1">{category.description}</div>
          )}
        </div>
      ),
    },
    {
      key: 'sizes',
      header: 'Sizes',
      render: (category) => (
        <div className="flex flex-wrap gap-1">
          {Array.isArray(category.sizes) && category.sizes.length > 0 ? (
            <>
              {category.sizes.slice(0, 5).map((size, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {size}
                </Badge>
              ))}
              {category.sizes.length > 5 && (
                <Badge variant="secondary" className="text-xs">
                  +{category.sizes.length - 5} more
                </Badge>
              )}
            </>
          ) : (
            <span className="text-sm text-muted-foreground">No sizes</span>
          )}
        </div>
      ),
    },
    {
      key: 'sizeCount',
      header: 'Total Sizes',
      render: (category) => (
        <div className="text-sm text-foreground">{Array.isArray(category.sizes) ? category.sizes.length : 0}</div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (category) => (
        <StatusBadge
          status={category.isActive ? 'active' : 'inactive'}
          variant={category.isActive ? 'success' : 'secondary'}
        />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (category) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/masters/size-categories/${category.id}/edit`);
            }}
          >
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteClick(category.id, category.name);
            }}
          >
            Delete
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
            <CardTitle>Size Categories</CardTitle>
            <Button onClick={() => navigate('/masters/size-categories/new')}>+ Add Size Category</Button>
          </div>
        </CardHeader>
        <CardContent>
          <FilterBar
            className="mb-6"
            onClear={clearFilters}
            hasActiveFilters={activeFilterCount > 0}
            clearText={`Clear ${activeFilterCount} ${activeFilterCount === 1 ? 'filter' : 'filters'}`}
          >
            <SearchInput
              className="w-full max-w-md"
              placeholder="Search category name, description…"
              value={searchQuery}
              onChange={(value) => {
                setSearchQuery(value);
                setCurrentPage(1);
              }}
            />
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value as 'all' | 'active' | 'inactive');
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </FilterBar>

          <DataTable
            data={sizeCategories}
            columns={columns}
            keyExtractor={(category) => category.id}
            loading={isLoading}
            error={error}
            onRowClick={(category) => navigate(`/masters/size-categories/${category.id}/edit`)}
            emptyState={
              activeFilterCount > 0
                ? {
                    icon: <Ruler className="h-16 w-16" />,
                    title: 'No size categories match these filters.',
                    actionLabel: 'Clear filters',
                    onAction: clearFilters,
                  }
                : {
                    icon: <Ruler className="h-16 w-16" />,
                    title: 'No size categories found',
                    description: 'Get started by creating your first size category',
                    actionLabel: 'Create First Size Category',
                    onAction: () => navigate('/masters/size-categories/new'),
                  }
            }
            pagination={{
              currentPage,
              totalPages,
              pageSize,
              totalItems,
              onPageChange: setCurrentPage,
              onPageSizeChange: setPageSize,
            }}
          />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Size Category"
        description={`Are you sure you want to delete ${categoryToDelete?.name}? This action cannot be undone. Make sure this category is not being used by any labels.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        variant="destructive"
      />
    </>
  );
}
