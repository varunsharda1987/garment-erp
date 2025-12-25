import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAllMaterials, deleteMaterial, getAllCategories } from '@/services/material.service';
import { UnitLabels, MaterialTypeLabels } from '@/types/material.types';
import type { Material, MaterialCategory } from '@/types/material.types';
import ExportButton from '@/components/ExportButton';
import ImportButton from '@/components/ImportButton';
import SearchInput from '@/components/SearchInput';
import DataTable from '@/components/DataTable';
import ConfirmDialog from '@/components/ConfirmDialog';
import MaterialCategorySelector from '@/components/MaterialCategorySelector';
import { StatusBadge } from '@/components/StatusBadge';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { formatCurrency } from '@/lib/currency';
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

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [unitFilter, setUnitFilter] = useState<string>('all');

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
        categoryId: categoryFilter !== 'all' ? categoryFilter : undefined,
        unit: unitFilter !== 'all' ? unitFilter : undefined,
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
      render: (material) => (
        <div className="text-sm font-medium text-gray-900">{material.code}</div>
      ),
    },
    {
      key: 'name',
      header: 'Material Name',
      render: (material) => (
        <div>
          <div className="text-sm font-medium text-gray-900">{material.name}</div>
          {material.description && (
            <div className="text-xs text-gray-500 line-clamp-1">{material.description}</div>
          )}
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (material) => (
        <div className="text-sm text-gray-700">
          {material.category?.name || '-'}
        </div>
      ),
    },
    {
      key: 'materialType',
      header: 'Type',
      render: (material) => (
        <StatusBadge status={MaterialTypeLabels[material.materialType]} variant="info" />
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (material) => (
        <div className="text-sm text-gray-700">
          {material.customer?.name || '-'}
        </div>
      ),
    },
    {
      key: 'supplier',
      header: 'Preferred Supplier',
      render: (material) => (
        <div className="text-sm text-gray-700">
          {material.suppliers && material.suppliers.length > 0
            ? material.suppliers[0].supplier.name
            : '-'}
        </div>
      ),
    },
    {
      key: 'unit',
      header: 'Unit',
      render: (material) => (
        <div className="text-sm text-gray-700">
          {UnitLabels[material.unit]}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (material) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/materials/raw/${material.id}/edit`)}
          >
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
                  categoryId: categoryFilter !== 'all' ? categoryFilter : undefined,
                  unit: unitFilter !== 'all' ? unitFilter : undefined,
                }}
              />
              <ImportButton
                module="materials"
                onSuccess={fetchMaterials}
              />
              <Button onClick={() => setCategorySelectorOpen(true)}>
                + Add New Material
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-6 flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <SearchInput
                placeholder="Search by code, name, or description..."
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
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={unitFilter} onValueChange={setUnitFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Units" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Units</SelectItem>
                {Object.entries(UnitLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* DataTable Component */}
          <DataTable
            data={materials}
            columns={columns}
            keyExtractor={(material) => material.id}
            loading={isLoading}
            error={error}
            onRowClick={(material) => navigate(`/materials/raw/${material.id}`)}
            emptyState={{
              icon: <Package className="h-16 w-16" />,
              title: 'No materials found',
              description: searchQuery || categoryFilter || unitFilter
                ? 'Try adjusting your search or filter criteria'
                : 'Get started by creating your first material',
              actionLabel: 'Create First Material',
              onAction: () => setCategorySelectorOpen(true),
            }}
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
      <MaterialCategorySelector
        open={categorySelectorOpen}
        onOpenChange={setCategorySelectorOpen}
      />
    </>
  );
}
