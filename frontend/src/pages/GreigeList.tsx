import { useState, useEffect, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Layers, Upload, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
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
import { usePagination } from '../hooks/usePagination';
import { greigeService } from '../services/fabricGreigeService';
import type { GreigeMaster, PaginatedResponse } from '../types/fabric-greige.types';
import { API_URL } from '../config/api.config';

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
  const [greigeToDelete, setGreigeToDelete] = useState<{ id: string; name: string } | null>(null);

  // Reset to page 1 when filters change
  useEffect(() => {
    resetPage();
  }, [filterActive, searchTerm, resetPage]);

  useEffect(() => {
    fetchGreigeMasters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, filterActive, searchTerm]);

  const fetchGreigeMasters = async () => {
    try {
      setLoading(true);
      setError(null);
      const response: PaginatedResponse<GreigeMaster> = await greigeService.getAll({
        page: currentPage,
        limit: pageSize,
        search: searchTerm,
        isActive: filterActive,
      });
      setGreigeMasters(response.data);
      setTotal(response.pagination.total);
      setTotalPages(response.pagination.totalPages);
    } catch (err: unknown) {
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
      handleApiSuccess('Greige deleted', `${greigeToDelete.name} has been successfully deleted.`);
      fetchGreigeMasters();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to delete greige master');
    } finally {
      setGreigeToDelete(null);
    }
  };

  const handleExport = async () => {
    try {
      // Get token
      const authStorage = localStorage.getItem('auth-storage');
      let token = null;
      if (authStorage) {
        const parsed = JSON.parse(authStorage);
        token = parsed.state?.token || null;
      }

      // Fetch export data
      const response = await fetch(`${API_URL}/fabric-management/greige/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Export failed');
      }

      // Convert to Excel
      const ws = XLSX.utils.json_to_sheet(result.data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Greige Masters');

      // Set column widths
      ws['!cols'] = [
        { wch: 15 }, // Greige Code
        { wch: 20 }, // Generic Greige Name
        { wch: 35 }, // Greige Name
        { wch: 15 }, // Yarn Count
        { wch: 15 }, // Construction
        { wch: 18 }, // Greige Width
        { wch: 28 }, // Default Cutable Width
        { wch: 25 }, // Composition
        { wch: 15 }, // Greige Quality
        { wch: 15 }, // Weave Type
        { wch: 15 }, // GSM Range
        { wch: 25 }, // Expected Finished Width Min
        { wch: 25 }, // Expected Finished Width Max
        { wch: 20 }, // Average Shrinkage %
        { wch: 40 }, // Description
        { wch: 30 }, // Notes
        { wch: 30 }, // Suppliers
        { wch: 12 }, // Is Active
      ];

      // Download file
      XLSX.writeFile(wb, `Greige_Masters_${new Date().toISOString().split('T')[0]}.xlsx`);

      handleApiSuccess('Export successful', `${result.totalRecords} greige masters exported`);
    } catch (err: unknown) {
      handleApiError(err, 'Failed to export greige masters');
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
      key: 'genericGreigeName',
      header: 'Generic Greige Name',
      render: (greige) => <div className="text-sm text-gray-900">{greige.genericGreigeName || '-'}</div>,
    },
    {
      key: 'greigeName',
      header: 'Greige Name',
      render: (greige) => (
        <div>
          <div className="text-sm font-medium text-gray-900">{greige.greigeName}</div>
          {greige.weaveType && <div className="text-xs text-gray-500">{greige.weaveType}</div>}
        </div>
      ),
    },
    {
      key: 'composition',
      header: 'Composition',
      render: (greige) => <div className="text-sm text-gray-900">{greige.composition}</div>,
    },
    {
      key: 'greigeQuality',
      header: 'Greige Quality',
      render: (greige) => (
        <div className="text-sm">
          {greige.greigeQuality ? (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                greige.greigeQuality === 'SUPER_DYEING'
                  ? 'bg-purple-100 text-purple-800'
                  : greige.greigeQuality === 'DYEING'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-orange-100 text-orange-800'
              }`}
            >
              {greige.greigeQuality === 'SUPER_DYEING'
                ? 'Super Dyeing'
                : greige.greigeQuality === 'DYEING'
                  ? 'Dyeing'
                  : 'Printing'}
            </span>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </div>
      ),
    },
    {
      key: 'weaver',
      header: 'Weaver',
      render: (greige) => (
        <div className="text-sm text-gray-900">{greige.weaver || <span className="text-gray-400">-</span>}</div>
      ),
    },
    {
      key: 'greigeWidth',
      header: 'Width (")',
      render: (greige) => <div className="text-sm text-gray-900">{Number(greige.greigeWidth)}"</div>,
    },
    {
      key: 'shrinkage',
      header: 'Shrinkage (%)',
      render: (greige) => (
        <div className="text-sm text-gray-900">{Number(greige.averageShrinkagePercent).toFixed(1)}%</div>
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
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Link to="/greige/bulk-import">
            <Button variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
          </Link>
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
          Showing {greigeMasters.length} of {total} greige masters
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
            description:
              searchTerm || filterActive !== 'true'
                ? 'Try adjusting your search or filter criteria'
                : 'Create your first greige master to get started',
            actionLabel: !searchTerm && filterActive === 'true' ? 'Create First Greige' : undefined,
            onAction: !searchTerm && filterActive === 'true' ? () => navigate('/greige/new') : undefined,
          }}
          pagination={{
            currentPage,
            totalPages,
            pageSize,
            totalItems: total,
            onPageChange: setCurrentPage,
            onPageSizeChange: setPageSize,
          }}
          onRowClick={(greige) => navigate(`/greige/${greige.id}`)}
        />
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
