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
import { greigeService } from '../services/fabricGreigeService';
import type { GreigeMaster, PaginatedResponse } from '../types/fabric-greige.types';

// Local type definition to avoid import issues
type Column<T> = {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

export default function GreigeList() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [greigeMasters, setGreigeMasters] = useState<GreigeMaster[]>([]);
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
  const [greigeToDelete, setGreigeToDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    fetchGreigeMasters();
  }, [pagination.page, filterActive, searchTerm]);

  const fetchGreigeMasters = async () => {
    try {
      setLoading(true);
      setError(null);
      const response: PaginatedResponse<GreigeMaster> = await greigeService.getAll({
        page: pagination.page,
        limit: pagination.limit,
        search: searchTerm,
        isActive: filterActive,
      });
      setGreigeMasters(response.data);
      setPagination(response.pagination);
    } catch (err: any) {
      const errorMessage = handleApiError(err, 'Failed to load greige masters', false);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setGreigeToDelete({ id, name });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!greigeToDelete) return;

    try {
      await greigeService.delete(greigeToDelete.id);
      handleApiSuccess(
        'Greige deleted',
        `${greigeToDelete.name} has been successfully deleted.`
      );
      fetchGreigeMasters();
    } catch (err: any) {
      handleApiError(err, 'Failed to delete greige master');
    } finally {
      setGreigeToDelete(null);
    }
  };

  // Define columns for DataTable
  const columns: Column<GreigeMaster>[] = [
    {
      key: 'greigeCode',
      header: 'Code',
      render: (greige) => (
        <Link
          to={`/greige/${greige.id}`}
          className="text-blue-600 hover:text-blue-800 font-medium"
          onClick={(e) => e.stopPropagation()}
        >
          {greige.greigeCode}
        </Link>
      ),
    },
    {
      key: 'greigeName',
      header: 'Name',
      render: (greige) => (
        <div>
          <div className="text-sm font-medium text-gray-900">{greige.greigeName}</div>
          {greige.weaveType && (
            <div className="text-xs text-gray-500">{greige.weaveType}</div>
          )}
        </div>
      ),
    },
    {
      key: 'composition',
      header: 'Composition',
      render: (greige) => (
        <div className="text-sm text-gray-900">{greige.composition}</div>
      ),
    },
    {
      key: 'greigeWidth',
      header: 'Width (")',
      render: (greige) => (
        <div className="text-sm text-gray-900">{Number(greige.greigeWidth)}"</div>
      ),
    },
    {
      key: 'shrinkage',
      header: 'Shrinkage (%)',
      render: (greige) => (
        <div className="text-sm text-gray-900">
          {Number(greige.averageShrinkagePercent)}%
        </div>
      ),
    },
    {
      key: 'finishedFabrics',
      header: 'Finished Fabrics',
      render: (greige) => (
        <StatusBadge
          status={`${greige._count?.finishedFabrics || 0} fabrics`}
          variant={greige._count?.finishedFabrics ? 'info' : 'secondary'}
        />
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (greige) => (
        <StatusBadge
          status={greige.isActive ? 'Active' : 'Inactive'}
          variant={greige.isActive ? 'success' : 'secondary'}
        />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (greige) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/greige/${greige.id}`);
            }}
          >
            View
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/greige/${greige.id}/edit`);
            }}
          >
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteClick(greige.id, greige.greigeName);
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
      <PageHeader title="Greige Master">
        <div className="flex gap-2">
          <Link to="/greige-stock-entry">
            <Button variant="outline">+ Add Stock</Button>
          </Link>
          <Link to="/greige-stock">
            <Button variant="outline">View Stock</Button>
          </Link>
          <Link to="/greige/new">
            <Button>+ New Greige</Button>
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
                placeholder="Search by code, name, or composition..."
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
      {!loading && greigeMasters.length > 0 && (
        <div className="mb-4 text-sm text-gray-600">
          Showing {greigeMasters.length} of {pagination.total} greige masters
        </div>
      )}

      {/* DataTable */}
      <Card>
        <DataTable
          data={greigeMasters}
          columns={columns}
          keyExtractor={(greige) => greige.id}
          loading={loading}
          error={error}
          emptyState={{
            icon: <Layers className="h-16 w-16" />,
            title: 'No greige masters found',
            description: searchTerm || filterActive !== 'true'
              ? 'Try adjusting your search or filter criteria'
              : 'Create your first greige master to get started',
            actionLabel: !searchTerm && filterActive === 'true' ? 'Create First Greige' : undefined,
            onAction: !searchTerm && filterActive === 'true' ? () => navigate('/greige/new') : undefined,
          }}
          onRowClick={(greige) => navigate(`/greige/${greige.id}`)}
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
        title="Delete Greige Master"
        description={`Are you sure you want to delete "${greigeToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        variant="destructive"
      />
    </>
  );
}
