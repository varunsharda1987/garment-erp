import { useState, useEffect, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Layers } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import SearchInput from '../components/SearchInput';
import DataTable from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import { handleApiError, handleApiSuccess } from '../lib/api-error-handler';
import { formatCurrency } from '@/lib/currency';
import { usePagination } from '../hooks/usePagination';
import { fabricService } from '../services/fabricGreigeService';
import type { FabricMaster, PaginatedResponse } from '../types/fabric-greige.types';

// Local type definition to avoid import issues
type Column<T> = {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

export default function FabricList() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fabrics, setFabrics] = useState<FabricMaster[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState<string>('true');

  // Use centralized pagination hook
  const { currentPage, pageSize, setCurrentPage, setPageSize, resetPage } = usePagination({
    defaultPageSize: 50,
  });

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fabricToDelete, setFabricToDelete] = useState<{ id: string; name: string } | null>(null);

  // Reset to page 1 when filters change
  useEffect(() => {
    resetPage();
  }, [filterActive, searchTerm, resetPage]);

  useEffect(() => {
    fetchFabrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, filterActive, searchTerm]);

  const fetchFabrics = async () => {
    try {
      setLoading(true);
      setError(null);
      const response: PaginatedResponse<FabricMaster> = await fabricService.getAll({
        page: currentPage,
        limit: pageSize,
        search: searchTerm,
        isActive: filterActive,
      });
      setFabrics(response.data);
      setTotal(response.pagination.total);
      setTotalPages(response.pagination.totalPages);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load fabric masters', false);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setFabricToDelete({ id, name });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!fabricToDelete) return;

    try {
      const result = await fabricService.delete(fabricToDelete.id);
      handleApiSuccess(
        'Fabric deleted',
        `${fabricToDelete.name} has been successfully deleted. ${result.deletedCADs} CAD entries were also removed.`
      );
      fetchFabrics();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to delete fabric master');
    } finally {
      setFabricToDelete(null);
    }
  };

  // Define columns for DataTable
  const columns: Column<FabricMaster>[] = [
    {
      key: 'fabricCode',
      header: 'Code',
      render: (fabric) => (
        <Link
          to={`/fabric/${fabric.id}`}
          className="text-blue-600 hover:text-blue-800 font-medium"
          onClick={(e) => e.stopPropagation()}
        >
          {fabric.fabricCode}
        </Link>
      ),
    },
    {
      key: 'fabricName',
      header: 'Name',
      render: (fabric) => (
        <div>
          <div className="text-sm font-medium text-gray-900">{fabric.fabricName}</div>
          {fabric.finishType && <div className="text-xs text-gray-500">{fabric.finishType}</div>}
        </div>
      ),
    },
    {
      key: 'color',
      header: 'Color',
      render: (fabric) => (
        <div>
          {fabric.colorName && <div className="text-sm text-gray-900">{fabric.colorName}</div>}
          {fabric.colorCode && <div className="text-xs text-gray-500">{fabric.colorCode}</div>}
        </div>
      ),
    },
    {
      key: 'greige',
      header: 'Greige Name',
      render: (fabric) => (
        <div className="text-sm text-gray-900 truncate max-w-[200px]" title={fabric.greige?.greigeName}>
          {fabric.greige ? fabric.greige.greigeName : '-'}
        </div>
      ),
    },
    {
      key: 'width',
      header: 'Width (")',
      render: (fabric) => (
        <div>
          <div className="text-sm text-gray-900">{Number(fabric.actualWidth)}"</div>
          {fabric.cutableWidth && <div className="text-xs text-gray-500">Cutable: {Number(fabric.cutableWidth)}"</div>}
        </div>
      ),
    },
    {
      key: 'cost',
      header: 'Cost/m',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (fabric) => (
        <div className="text-sm font-medium text-gray-900">{formatCurrency(fabric.costPerMeter)}</div>
      ),
    },
    {
      key: 'cadWidths',
      header: 'CAD Widths',
      render: (fabric) => (
        <StatusBadge
          status={`${fabric.count?.widthCADs || 0} widths`}
          variant={fabric.count?.widthCADs ? 'info' : 'secondary'}
        />
      ),
    },
    {
      key: 'styleUsage',
      header: 'Style Usage',
      render: (fabric) => {
        const styleCount = fabric.count?.fabrics || 0; // _count -> count (humps camelCase), styleFabrics -> fabrics
        const allocations = fabric.fabrics || []; // styleFabrics -> fabrics (serializer mapping)

        if (styleCount === 0) {
          return <span className="text-xs text-gray-400">Not allocated</span>;
        }

        // Get unique styles and components
        const styleComponentMap = new Map<string, { styleName: string; styleCode: string; components: string[] }>();
        allocations.forEach((sf) => {
          const style = sf.components?.style; // styleComponents -> components, styles -> style (serializer mappings)
          if (style) {
            const key = style.id;
            if (!styleComponentMap.has(key)) {
              styleComponentMap.set(key, {
                styleName: style.styleName,
                styleCode: style.styleCode,
                components: [],
              });
            }
            const entry = styleComponentMap.get(key)!;
            if (sf.components?.componentName && !entry.components.includes(sf.components.componentName)) {
              entry.components.push(sf.components.componentName);
            }
          }
        });

        const entries = Array.from(styleComponentMap.values());

        return (
          <div className="space-y-1">
            {entries.slice(0, 2).map((entry, idx) => (
              <div key={idx} className="text-xs">
                <span className="font-medium text-blue-600">{entry.styleCode}</span>
                {entry.components.length > 0 && (
                  <span className="text-gray-500 ml-1">({entry.components.join(', ')})</span>
                )}
              </div>
            ))}
            {styleCount > 2 && <span className="text-xs text-gray-400">+{styleCount - 2} more</span>}
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (fabric) => (
        <StatusBadge
          status={fabric.isActive ? 'Active' : 'Inactive'}
          variant={fabric.isActive ? 'success' : 'secondary'}
        />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (fabric) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/fabric/${fabric.id}`);
            }}
          >
            View
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/fabric/${fabric.id}/edit`);
            }}
          >
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteClick(fabric.id, fabric.fabricName);
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
      <PageHeader title="Fabric Master">
        <div className="flex gap-2">
          <Link to="/fabric-stock">
            <Button variant="outline">View Stock</Button>
          </Link>
          <Link to="/fabric-stock-entry">
            <Button variant="outline">Stock Entry</Button>
          </Link>
          <Link to="/fabric/bulk-import">
            <Button variant="outline">Bulk Import</Button>
          </Link>
          <Link to="/reports/fabric-usage">
            <Button variant="outline">Usage Report</Button>
          </Link>
          <Link to="/fabric/new">
            <Button>+ New Fabric</Button>
          </Link>
        </div>
      </PageHeader>

      {/* Search and Filter Bar */}
      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="search">Search</Label>
              <SearchInput
                placeholder="Search by code, name, or color..."
                value={searchTerm}
                onChange={setSearchTerm}
              />
            </div>
            <div className="w-48">
              <Label htmlFor="statusFilter">Status</Label>
              <Select value={filterActive} onValueChange={setFilterActive}>
                <SelectTrigger id="statusFilter">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="true">Active Only</SelectItem>
                  <SelectItem value="false">Inactive Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      {!loading && fabrics.length > 0 && (
        <div className="mb-4 text-sm text-gray-600">
          Showing {fabrics.length} of {total} fabric masters
        </div>
      )}

      {/* DataTable */}
      <Card>
        <DataTable
          data={fabrics}
          columns={columns}
          keyExtractor={(fabric) => fabric.id}
          loading={loading}
          error={error}
          emptyState={{
            icon: <Layers className="h-16 w-16" />,
            title: 'No fabric masters found',
            description:
              searchTerm || filterActive !== 'true'
                ? 'Try adjusting your search or filter criteria'
                : 'Create your first fabric master to get started',
            actionLabel: !searchTerm && filterActive === 'true' ? 'Create First Fabric' : undefined,
            onAction: !searchTerm && filterActive === 'true' ? () => navigate('/fabric/new') : undefined,
          }}
          pagination={{
            currentPage,
            totalPages,
            pageSize,
            totalItems: total,
            onPageChange: setCurrentPage,
            onPageSizeChange: setPageSize,
          }}
          onRowClick={(fabric) => navigate(`/fabric/${fabric.id}`)}
        />
      </Card>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Fabric Master"
        description={`Are you sure you want to delete "${fabricToDelete?.name}"? This will also delete all CAD width entries for this fabric. This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        variant="destructive"
      />
    </>
  );
}
