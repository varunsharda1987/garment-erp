import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getAllOtherMaterials, deleteOtherMaterial } from '@/services/otherMaterial.service';
import type { OtherMaterial } from '@/types/otherMaterial.types';
import ExportButton from '@/components/ExportButton';
import ImportButton from '@/components/ImportButton';
import SearchInput from '@/components/SearchInput';
import DataTable from '@/components/DataTable';
import ConfirmDialog from '@/components/ConfirmDialog';
import { StatusBadge } from '@/components/StatusBadge';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { formatCurrency } from '@/lib/currency';
import { Package } from 'lucide-react';
import { ViewStockButton } from '@/components/ViewStockButton';
import stockLevelService from '@/services/stockLevel.service';

// Local type definition to avoid import issues
type Column<T> = {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

export default function OtherMaterialList() {
  const navigate = useNavigate();
  const [materialItems, setMaterialItems] = useState<OtherMaterial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');

  // Stock count state
  const [stockCount, setStockCount] = useState<number | undefined>(undefined);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [materialToDelete, setMaterialToDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    fetchMaterialItems();
    fetchStockCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, searchQuery]);

  const fetchStockCount = async () => {
    try {
      const stockLevels = await stockLevelService.getByMaterialType('OTHER');
      setStockCount(stockLevels.length);
    } catch {
      // Silently fail - stock count is not critical
      setStockCount(undefined);
    }
  };

  const fetchMaterialItems = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await getAllOtherMaterials({
        page: currentPage,
        limit: pageSize,
        search: searchQuery || undefined,
      });
      setMaterialItems(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.total);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load other material items', false);
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
      await deleteOtherMaterial(materialToDelete.id);
      handleApiSuccess('Material deleted', `${materialToDelete.name} has been successfully deleted.`);
      fetchMaterialItems();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to delete material');
    } finally {
      setMaterialToDelete(null);
    }
  };

  // Define columns for DataTable
  const columns: Column<OtherMaterial>[] = [
    {
      key: 'materialCode',
      header: 'Code',
      render: (material) => (
        <Badge variant="outline" className="font-mono text-xs">
          {material.materialCode}
        </Badge>
      ),
    },
    {
      key: 'materialName',
      header: 'Material Name',
      render: (material) => (
        <div>
          <div className="text-sm font-medium text-foreground">{material.materialName}</div>
          {material.description && (
            <div className="text-xs text-muted-foreground line-clamp-1">{material.description}</div>
          )}
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (material) => <div className="text-sm text-foreground">{material.category || '-'}</div>,
    },
    {
      key: 'unit',
      header: 'Unit',
      render: (material) => (
        <Badge variant="secondary" className="text-xs">
          {material.unit}
        </Badge>
      ),
    },
    {
      key: 'specifications',
      header: 'Specifications',
      render: (material) => (
        <div className="text-sm text-foreground max-w-xs truncate">{material.specifications || '-'}</div>
      ),
    },
    {
      key: 'suppliers',
      header: 'Suppliers',
      render: (material) => (
        <div className="flex flex-wrap gap-1">
          {material.otherMaterialSuppliers && material.otherMaterialSuppliers.length > 0 ? (
            material.otherMaterialSuppliers.slice(0, 2).map((s) => (
              <Badge
                key={s.id}
                variant={s.isPreferred ? 'default' : 'secondary'}
                className="text-xs"
                title={`${s.supplier.name}${s.pricePerUnit ? ` - ₹${s.pricePerUnit}/unit` : ''}`}
              >
                {s.supplier.code}
                {s.pricePerUnit ? ` ₹${s.pricePerUnit}` : ''}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">-</span>
          )}
          {material.otherMaterialSuppliers && material.otherMaterialSuppliers.length > 2 && (
            <Badge variant="outline" className="text-xs">
              +{material.otherMaterialSuppliers.length - 2}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'pricePerUnit',
      header: 'Price/Unit',
      render: (material) => (
        <div className="text-sm font-medium text-foreground">
          {material.pricePerUnit ? formatCurrency(material.pricePerUnit) : '-'}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (material) => (
        <StatusBadge
          status={material.isActive ? 'active' : 'inactive'}
          variant={material.isActive ? 'success' : 'secondary'}
        />
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
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/materials/other/${material.id}/edit`);
            }}
          >
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteClick(material.id, material.materialName);
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
            <CardTitle>Other Materials Management</CardTitle>
            <div className="flex gap-2">
              <ViewStockButton materialType="OTHER" stockCount={stockCount} />
              <ExportButton module="other-material" filters={{}} />
              <ImportButton module="other-material" onSuccess={fetchMaterialItems} />
              <Button onClick={() => navigate('/materials/other/new')}>+ Add New Material</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search Filter */}
          <div className="mb-6">
            <div className="flex-1 max-w-md">
              <SearchInput
                placeholder="Search by code, name, or category..."
                value={searchQuery}
                onChange={setSearchQuery}
              />
            </div>
          </div>

          {/* DataTable Component */}
          <DataTable
            data={materialItems}
            columns={columns}
            keyExtractor={(material) => material.id}
            loading={isLoading}
            error={error}
            onRowClick={(material) => navigate(`/materials/other/${material.id}`)}
            emptyState={{
              icon: <Package className="h-16 w-16" />,
              title: 'No other materials found',
              description: searchQuery
                ? 'Try adjusting your search criteria'
                : 'Get started by creating your first material',
              actionLabel: 'Create First Material',
              onAction: () => navigate('/materials/other/new'),
            }}
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

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Material"
        description={`Are you sure you want to delete ${materialToDelete?.name}? This action cannot be undone and will also remove the associated material entry.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        variant="destructive"
      />
    </>
  );
}
