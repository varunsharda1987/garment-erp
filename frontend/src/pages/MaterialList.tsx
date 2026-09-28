import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { getAllMaterials, deleteMaterial, getAllCategories } from '@/services/material.service';
import { MaterialTypeLabels } from '@/types/material.types';
import { UNIT_OPTIONS, unitLabel } from '@/lib/units';
import type { Material, MaterialCategory } from '@/types/material.types';
import ExportButton from '@/components/ExportButton';
import ImportButton from '@/components/ImportButton';
import SearchInput from '@/components/SearchInput';
import { FilterBar } from '@/components/filters';
import DataTable from '@/components/DataTable';
import ConfirmDialog from '@/components/ConfirmDialog';
import MaterialCategorySelector from '@/components/MaterialCategorySelector';
import { StatusBadge } from '@/components/StatusBadge';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { Package } from 'lucide-react';

// Local type definition to avoid import issues
type Column<T> = {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

export default function MaterialList() {
  const navigate = useNavigate();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [categories, setCategories] = useState<MaterialCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMaterials, setTotalMaterials] = useState(0);

  // Filter state ('' / undefined = all)
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);
  const [unitFilter, setUnitFilter] = useState<string | undefined>(undefined);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [materialToDelete, setMaterialToDelete] = useState<{ id: string; name: string } | null>(null);

  // Category selector dialog state
  const [categorySelectorOpen, setCategorySelectorOpen] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchMaterials();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, searchQuery, categoryFilter, unitFilter]);

  const fetchCategories = async () => {
    try {
      const data = await getAllCategories();
      setCategories(data);
    } catch (err) {
      handleApiError(err, 'Failed to load categories', false);
    }
  };

  const fetchMaterials = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await getAllMaterials({
        page: currentPage,
        limit: pageSize,
        search: searchQuery || undefined,
        categoryId: categoryFilter,
        unit: unitFilter,
      });
      setMaterials(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalMaterials(response.pagination.total);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load materials', false);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Every filter change starts again from page 1 — in the same update as the filter, so one request
  // goes out (the old reset-in-an-effect sent a second one for the stale page, and the slower of the
  // two could land last)
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleCategoryChange = (value: string) => {
    setCategoryFilter(value || undefined);
    setCurrentPage(1);
  };

  const handleUnitChange = (value: string) => {
    setUnitFilter(value || undefined);
    setCurrentPage(1);
  };

  const activeFilterCount = [searchQuery, categoryFilter, unitFilter].filter(Boolean).length;

  const clearFilters = () => {
    setSearchQuery('');
    setCategoryFilter(undefined);
    setUnitFilter(undefined);
    setCurrentPage(1);
  };

  const categoryOptions = [
    { value: '', label: 'All categories', searchText: 'all categories' },
    ...categories.map((category) => ({ value: category.id, label: category.name })),
  ];

  const unitOptions = [
    { value: '', label: 'All units', searchText: 'all units' },
    ...UNIT_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label, searchText: `${opt.label} ${opt.value}` })),
  ];

  const handleDeleteClick = (id: string, name: string) => {
    setMaterialToDelete({ id, name });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!materialToDelete) return;

    try {
      await deleteMaterial(materialToDelete.id);
      handleApiSuccess('Material deleted', `${materialToDelete.name} has been successfully deleted.`);
      fetchMaterials();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to delete material');
    } finally {
      setMaterialToDelete(null);
    }
  };

  // Define columns for DataTable
  const columns: Column<Material>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (material) => <div className="text-sm font-medium text-foreground">{material.code}</div>,
    },
    {
      key: 'name',
      header: 'Material Name',
      render: (material) => (
        <div>
          <div className="text-sm font-medium text-foreground">{material.name}</div>
          {material.description && (
            <div className="text-xs text-muted-foreground line-clamp-1">{material.description}</div>
          )}
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (material) => <div className="text-sm text-foreground">{material.category?.name || '-'}</div>,
    },
    {
      key: 'materialType',
      header: 'Type',
      render: (material) => <StatusBadge status={MaterialTypeLabels[material.materialType]} variant="info" />,
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (material) => <div className="text-sm text-foreground">{material.customer?.name || '-'}</div>,
    },
    {
      key: 'supplier',
      header: 'Preferred Supplier',
      render: (material) => (
        <div className="text-sm text-foreground">
          {material.supplier && material.supplier.length > 0 ? material.supplier[0].supplier.name : '-'}
        </div>
      ),
    },
    {
      key: 'unit',
      header: 'Unit',
      render: (material) => <div className="text-sm text-foreground">{unitLabel(material.unit)}</div>,
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (material) => (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(`/materials/raw/${material.id}/edit`)}>
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteClick(material.id, material.name);
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
            <CardTitle>Materials</CardTitle>
            <div className="flex gap-2">
              <ExportButton
                module="materials"
                filters={{
                  categoryId: categoryFilter,
                  unit: unitFilter,
                }}
              />
              <ImportButton module="materials" onSuccess={fetchMaterials} />
              <Button onClick={() => setCategorySelectorOpen(true)}>+ Add New Material</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <FilterBar
            className="mb-6"
            onClear={clearFilters}
            hasActiveFilters={activeFilterCount > 0}
            clearText={`Clear ${activeFilterCount} ${activeFilterCount === 1 ? 'filter' : 'filters'}`}
          >
            <SearchInput
              className="min-w-[220px] flex-1"
              placeholder="Search code, name, description, category, customer, supplier, HSN…"
              value={searchQuery}
              onChange={handleSearchChange}
            />
            <Combobox
              options={categoryOptions}
              value={categoryFilter || ''}
              onValueChange={handleCategoryChange}
              placeholder="All categories"
              searchPlaceholder="Search categories..."
              emptyText="No categories found."
              className="w-[220px]"
            />
            <Combobox
              options={unitOptions}
              value={unitFilter || ''}
              onValueChange={handleUnitChange}
              placeholder="All units"
              searchPlaceholder="Search units..."
              emptyText="No units found."
              className="w-[220px]"
            />
          </FilterBar>

          {/* DataTable Component */}
          <DataTable
            data={materials}
            columns={columns}
            keyExtractor={(material) => material.id}
            loading={isLoading}
            error={error}
            onRowClick={(material) => navigate(`/materials/raw/${material.id}`)}
            emptyState={
              activeFilterCount > 0
                ? {
                    icon: <Package className="h-16 w-16" />,
                    title: 'No materials match these filters.',
                    actionLabel: 'Clear filters',
                    onAction: clearFilters,
                  }
                : {
                    icon: <Package className="h-16 w-16" />,
                    title: 'No materials found',
                    description: 'Get started by creating your first material',
                    actionLabel: 'Create First Material',
                    onAction: () => setCategorySelectorOpen(true),
                  }
            }
            pagination={{
              currentPage,
              totalPages,
              pageSize,
              totalItems: totalMaterials,
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
        title="Delete Material"
        description={`Are you sure you want to delete ${materialToDelete?.name}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        variant="destructive"
      />

      {/* Material Category Selector Dialog */}
      <MaterialCategorySelector open={categorySelectorOpen} onOpenChange={setCategorySelectorOpen} />
    </>
  );
}
