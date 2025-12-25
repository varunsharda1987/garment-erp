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
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState<string>('true');

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fabricToDelete, setFabricToDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    fetchFabrics();
  }, [pagination.page, filterActive, searchTerm]);

  const fetchFabrics = async () => {
    try {
      setLoading(true);
      setError(null);
      const response: PaginatedResponse<FabricMaster> = await fabricService.getAll({
        page: pagination.page,
        limit: pagination.limit,
        search: searchTerm,
        isActive: filterActive,
      });
      setFabrics(response.data);
      setPagination(response.pagination);
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
          {fabric.finishType && (
            <div className="text-xs text-gray-500">{fabric.finishType}</div>
          )}
        </div>
      ),
    },
    {
      key: 'color',
      header: 'Color',
      render: (fabric) => (
        <div>
          {fabric.colorName && (
            <div className="text-sm text-gray-900">{fabric.colorName}</div>
          )}
          {fabric.colorCode && (
            <div className="text-xs text-gray-500">{fabric.colorCode}</div>
          )}
        </div>
      ),
    },
    {
      key: 'greige',
      header: 'Greige Base',
      render: (fabric) => (
        <div className="text-sm text-gray-900">
          {fabric.greige ? fabric.greige.greigeCode : '-'}
        </div>
      ),
    },
    {
      key: 'width',
      header: 'Width (")',
      render: (fabric) => (
        <div>
          <div className="text-sm text-gray-900">{Number(fabric.actualWidth)}"</div>
          {fabric.actualShrinkagePercent && (
            <div className="text-xs text-gray-500">
              -{Number(fabric.actualShrinkagePercent)}% shrink
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'cost',
      header: 'Cost/m',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (fabric) => (
        <div className="text-sm font-medium text-gray-900">
          {formatCurrency(fabric.costPerMeter)}
        </div>
      ),
    },
    {
      key: 'cadWidths',
      header: 'CAD Widths',
      render: (fabric) => (
        <StatusBadge
          status={`${fabric._count?.widthCADs || 0} widths`}
          variant={fabric._count?.widthCADs ? 'info' : 'secondary'}
        />
      ),
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
                id="search"
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
          Showing {fabrics.length} of {pagination.total} fabric masters
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
            description: searchTerm || filterActive !== 'true'
              ? 'Try adjusting your search or filter criteria'
              : 'Create your first fabric master to get started',
            actionLabel: !searchTerm && filterActive === 'true' ? 'Create First Fabric' : undefined,
            onAction: !searchTerm && filterActive === 'true' ? () => navigate('/fabric/new') : undefined,
          }}
          onRowClick={(fabric) => navigate(`/fabric/${fabric.id}`)}
        />

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
            <div className="flex-1 flex justify-between sm:hidden">
              <Button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
                variant="outline"
              >
                Previous
              </Button>
              <Button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page === pagination.totalPages}
                variant="outline"
              >
                Next
              </Button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Page <span className="font-medium">{pagination.page}</span> of{' '}
                  <span className="font-medium">{pagination.totalPages}</span>
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1}
                  variant="outline"
                >
                  Previous
                </Button>
                <Button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page === pagination.totalPages}
                  variant="outline"
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
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
