import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getAllElastics, deleteElastic } from '@/services/elastic.service';
import type { Elastic } from '@/types/elastic.types';
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

export default function ElasticList() {
  const navigate = useNavigate();
  const [elasticItems, setElasticItems] = useState<Elastic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filter state
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || '');

  // Stock count state
  const [stockCount, setStockCount] = useState<number | undefined>(undefined);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [elasticToDelete, setElasticToDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    fetchElasticItems();
    fetchStockCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, searchQuery]);

  const fetchStockCount = async () => {
    try {
      const stockLevels = await stockLevelService.getByMaterialType('ELASTIC');
      setStockCount(stockLevels.length);
    } catch {
      // Silently fail - stock count is not critical
      setStockCount(undefined);
    }
  };

  const fetchElasticItems = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await getAllElastics({
        page: currentPage,
        limit: pageSize,
        search: searchQuery || undefined,
      });
      setElasticItems(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.total);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load elastic items', false);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setElasticToDelete({ id, name });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!elasticToDelete) return;

    try {
      await deleteElastic(elasticToDelete.id);
      handleApiSuccess('Elastic deleted', `${elasticToDelete.name} has been successfully deleted.`);
      fetchElasticItems();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to delete elastic');
    } finally {
      setElasticToDelete(null);
    }
  };

  // Define columns for DataTable
  const columns: Column<Elastic>[] = [
    {
      key: 'elasticCode',
      header: 'Code',
      render: (elastic) => (
        <Badge variant="outline" className="font-mono text-xs">
          {elastic.elasticCode}
        </Badge>
      ),
    },
    {
      key: 'elasticName',
      header: 'Elastic Name',
      render: (elastic) => (
        <div>
          <div className="text-sm font-medium text-foreground">{elastic.elasticName}</div>
          {elastic.description && (
            <div className="text-xs text-muted-foreground line-clamp-1">{elastic.description}</div>
          )}
        </div>
      ),
    },
    {
      key: 'width',
      header: 'Width',
      render: (elastic) => <div className="text-sm text-foreground">{elastic.width ? `${elastic.width}mm` : '-'}</div>,
    },
    {
      key: 'stretchPercent',
      header: 'Stretch %',
      render: (elastic) => (
        <div className="text-sm text-foreground">{elastic.stretchPercent ? `${elastic.stretchPercent}%` : '-'}</div>
      ),
    },
    {
      key: 'color',
      header: 'Color',
      render: (elastic) => <div className="text-sm text-foreground">{elastic.color || '-'}</div>,
    },
    {
      key: 'suppliers',
      header: 'Suppliers',
      render: (elastic) => (
        <div className="flex flex-wrap gap-1">
          {elastic.elasticSuppliers && elastic.elasticSuppliers.length > 0 ? (
            elastic.elasticSuppliers.slice(0, 2).map((s) => (
              <Badge
                key={s.id}
                variant={s.isPreferred ? 'default' : 'secondary'}
                className="text-xs"
                title={`${s.supplier.name}${s.pricePerMeter ? ` - ₹${s.pricePerMeter}/m` : ''}`}
              >
                {s.supplier.code}
                {s.pricePerMeter ? ` ₹${s.pricePerMeter}` : ''}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">-</span>
          )}
          {elastic.elasticSuppliers && elastic.elasticSuppliers.length > 2 && (
            <Badge variant="outline" className="text-xs">
              +{elastic.elasticSuppliers.length - 2}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'pricePerMeter',
      header: 'Price/Meter',
      render: (elastic) => (
        <div className="text-sm font-medium text-foreground">
          {elastic.pricePerMeter ? formatCurrency(elastic.pricePerMeter) : '-'}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (elastic) => (
        <StatusBadge
          status={elastic.isActive ? 'active' : 'inactive'}
          variant={elastic.isActive ? 'success' : 'secondary'}
        />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (elastic) => (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(`/materials/elastic/${elastic.id}/edit`)}>
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteClick(elastic.id, elastic.elasticName);
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
            <CardTitle>Elastic Management</CardTitle>
            <div className="flex gap-2">
              <ViewStockButton materialType="ELASTIC" stockCount={stockCount} />
              <ExportButton module="elastic" filters={{}} />
              <ImportButton module="elastic" onSuccess={fetchElasticItems} />
              <Button onClick={() => navigate('/materials/elastic/new')}>+ Add New Elastic</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search Filter */}
          <div className="mb-6">
            <div className="flex-1 max-w-md">
              <SearchInput
                placeholder="Search by code, name, or color..."
                value={searchQuery}
                onChange={setSearchQuery}
              />
            </div>
          </div>

          {/* DataTable Component */}
          <DataTable
            data={elasticItems}
            columns={columns}
            keyExtractor={(elastic) => elastic.id}
            loading={isLoading}
            error={error}
            onRowClick={(elastic) => navigate(`/materials/elastic/${elastic.id}`)}
            emptyState={{
              icon: <Package className="h-16 w-16" />,
              title: 'No elastic items found',
              description: searchQuery
                ? 'Try adjusting your search criteria'
                : 'Get started by creating your first elastic item',
              actionLabel: 'Create First Elastic',
              onAction: () => navigate('/materials/elastic/new'),
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
        title="Delete Elastic"
        description={`Are you sure you want to delete ${elasticToDelete?.name}? This action cannot be undone and will also remove the associated material entry.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        variant="destructive"
      />
    </>
  );
}
