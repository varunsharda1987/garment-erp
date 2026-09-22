import { useState, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Layers, Upload, Download } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import * as XLSX from '@e965/xlsx';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import SearchInput from '../components/SearchInput';
import DataTable from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import { FilterBar, MultiSelectFilter, NumberRangeFilter, SelectFilter } from '../components/filters';
import { handleApiError, handleApiSuccess } from '../lib/api-error-handler';
import { useListQuery, queryKeys } from '../hooks/useQuery';
import { useGreigeFacets, toFacetOptions } from '../hooks/useFacetOptions';
import { applyUrlUpdates, getUrlList, getUrlLimit, getUrlNumber, getUrlPage } from '../lib/url-filters';
import type { FilterUpdate } from '../lib/url-filters';
import { greigeService } from '../services/fabricGreigeService';
import type { GreigeMaster, GreigeQueryParams } from '../types/fabric-greige.types';
import api from '@/lib/api';
import { toDateInputValue } from '@/lib/date';

// Local type definition to avoid import issues
type Column<T> = {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

/** GreigeQuality enum values as the filter dropdown should read them. */
const GREIGE_QUALITY_LABELS: Record<string, string> = {
  PRINTING: 'Printing',
  DYEING: 'Dyeing',
  SUPER_DYEING: 'Super Dyeing',
};

export default function GreigeList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Filters live in the URL: row -> detail -> Back restores them, and a filtered view can be
  // pasted to a colleague. `replace` so filter fiddling does not flood the history stack.
  const [searchParams, setSearchParams] = useSearchParams();

  const updateURLParams = useCallback(
    (updates: Record<string, FilterUpdate>) => {
      setSearchParams((prev) => applyUrlUpdates(prev, updates), { replace: true });
    },
    [setSearchParams]
  );

  const filters = useMemo<GreigeQueryParams>(
    () => ({
      page: getUrlPage(searchParams),
      limit: getUrlLimit(searchParams),
      search: searchParams.get('search') ?? '',
      // 'all' | 'true' | 'false' — defaulted here, so Clear (which empties the URL) returns to it
      isActive: searchParams.get('isActive') ?? 'true',
      greigeQuality: getUrlList(searchParams, 'greigeQuality'),
      weaveType: getUrlList(searchParams, 'weaveType'),
      genericGreigeName: getUrlList(searchParams, 'genericGreigeName'),
      minWidth: getUrlNumber(searchParams, 'minWidth'),
      maxWidth: getUrlNumber(searchParams, 'maxWidth'),
      minShrinkage: getUrlNumber(searchParams, 'minShrinkage'),
      maxShrinkage: getUrlNumber(searchParams, 'maxShrinkage'),
    }),
    [searchParams]
  );

  const {
    data,
    isLoading,
    error: queryError,
  } = useListQuery(
    queryKeys.greige.list(filters as unknown as Record<string, unknown>),
    () => greigeService.getAll(filters),
    {
      staleTime: 30_000,
      // GreigeBulkImport navigates back here via the SPA router; without this the default 5-minute
      // staleTime would show someone who just imported 500 rows the pre-import list.
      refetchOnMount: 'always',
      // Keep the previous page on screen while the next loads — DataTable replaces the whole
      // table AND its pager with a skeleton whenever `loading` is true.
      placeholderData: (previous) => previous,
    }
  );

  const greigeMasters = data?.data ?? [];
  const total = data?.pagination.total ?? 0;
  const totalPages = data?.pagination.totalPages ?? 0;
  const error = queryError ? queryError.message : null;

  const { data: facets } = useGreigeFacets(filters.isActive ?? 'true');

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [greigeToDelete, setGreigeToDelete] = useState<{ id: string; name: string } | null>(null);

  // SearchInput lists onChange in its debounce deps, so it fires ~300ms after MOUNT with the
  // current value. Without this guard that unchanged fire would strip `page` from the URL and
  // bounce anyone who opened a deep-linked page 3 back to page 1.
  const searchRef = useRef(filters.search);
  searchRef.current = filters.search;
  const handleSearchChange = useCallback(
    (value: string) => {
      if (value === searchRef.current) return;
      updateURLParams({ search: value || undefined, page: undefined });
    },
    [updateURLParams]
  );

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.search) n++;
    // isActive defaults to 'true' — "Active Only" is the resting state, not a filter the user set
    if ((filters.isActive ?? 'true') !== 'true') n++;
    if (filters.greigeQuality?.length) n++;
    if (filters.weaveType?.length) n++;
    if (filters.genericGreigeName?.length) n++;
    if (filters.minWidth !== undefined || filters.maxWidth !== undefined) n++;
    if (filters.minShrinkage !== undefined || filters.maxShrinkage !== undefined) n++;
    return n;
  }, [filters]);

  const clearFilters = useCallback(() => {
    // Emptying the URL restores every default, including isActive -> 'true'
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  const handleDeleteClick = (id: string, name: string) => {
    setGreigeToDelete({ id, name });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!greigeToDelete) return;

    try {
      await greigeService.delete(greigeToDelete.id);
      handleApiSuccess('Greige deleted', `${greigeToDelete.name} has been successfully deleted.`);
      queryClient.invalidateQueries({ queryKey: queryKeys.greige.all });
    } catch (err: unknown) {
      handleApiError(err, 'Failed to delete greige master');
    } finally {
      setGreigeToDelete(null);
    }
  };

  const handleExport = async () => {
    try {
      // Fetch export data
      const response = await api.get<{ data: unknown[] }>('/fabric-management/greige/export');

      // Convert to Excel
      const ws = XLSX.utils.json_to_sheet(response.data.data);
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
      XLSX.writeFile(wb, `Greige_Masters_${toDateInputValue(new Date())}.xlsx`);

      handleApiSuccess('Export successful', `${response.data.data.length} greige masters exported`);
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
          className="text-info hover:text-info font-medium"
          onClick={(e) => e.stopPropagation()}
        >
          {greige.greigeCode}
        </Link>
      ),
    },
    {
      key: 'genericGreigeName',
      header: 'Generic Greige Name',
      render: (greige) => <div className="text-sm text-foreground">{greige.genericGreigeName || '-'}</div>,
    },
    {
      key: 'greigeName',
      header: 'Greige Name',
      render: (greige) => (
        <div>
          <div className="text-sm font-medium text-foreground">{greige.greigeName}</div>
          {greige.weaveType && <div className="text-xs text-muted-foreground">{greige.weaveType}</div>}
        </div>
      ),
    },
    {
      key: 'composition',
      header: 'Composition',
      render: (greige) => <div className="text-sm text-foreground">{greige.composition}</div>,
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
                  ? 'bg-accent/10 text-accent'
                  : greige.greigeQuality === 'DYEING'
                    ? 'bg-info-muted text-info'
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
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      ),
    },
    {
      key: 'weaver',
      header: 'Weaver',
      render: (greige) => (
        <div className="text-sm text-foreground">
          {greige.weaver || <span className="text-muted-foreground">-</span>}
        </div>
      ),
    },
    {
      key: 'greigeWidth',
      header: 'Width (")',
      render: (greige) => <div className="text-sm text-foreground">{Number(greige.greigeWidth)}"</div>,
    },
    {
      key: 'shrinkage',
      header: 'Shrinkage (%)',
      render: (greige) => (
        <div className="text-sm text-foreground">{(greige.averageShrinkagePercent ?? 0).toFixed(1)}%</div>
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
          <FilterBar
            onClear={clearFilters}
            hasActiveFilters={activeFilterCount > 0}
            clearText={`Clear ${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'}`}
          >
            <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
              <Label htmlFor="search" className="text-sm font-medium">
                Search
              </Label>
              <SearchInput
                placeholder="Search by code, name, or composition..."
                value={filters.search ?? ''}
                onChange={handleSearchChange}
              />
            </div>

            <SelectFilter
              label="Status"
              value={filters.isActive ?? 'true'}
              onChange={(value) => updateURLParams({ isActive: value === 'true' ? undefined : value, page: undefined })}
              options={[
                { value: 'true', label: 'Active Only' },
                { value: 'false', label: 'Inactive Only' },
                { value: 'all', label: 'All' },
              ]}
            />

            <MultiSelectFilter
              label="Quality"
              value={filters.greigeQuality ?? []}
              onChange={(value) => updateURLParams({ greigeQuality: value, page: undefined })}
              options={toFacetOptions(facets?.greigeQuality, GREIGE_QUALITY_LABELS)}
            />

            <MultiSelectFilter
              label="Weave"
              value={filters.weaveType ?? []}
              onChange={(value) => updateURLParams({ weaveType: value, page: undefined })}
              options={toFacetOptions(facets?.weaveType)}
            />

            <MultiSelectFilter
              label="Generic Name"
              value={filters.genericGreigeName ?? []}
              onChange={(value) => updateURLParams({ genericGreigeName: value, page: undefined })}
              options={toFacetOptions(facets?.genericGreigeName)}
            />

            <NumberRangeFilter
              label='Width (")'
              value={{ min: filters.minWidth, max: filters.maxWidth }}
              onChange={({ min, max }) => updateURLParams({ minWidth: min, maxWidth: max, page: undefined })}
            />

            <NumberRangeFilter
              label="Shrinkage (%)"
              value={{ min: filters.minShrinkage, max: filters.maxShrinkage }}
              onChange={({ min, max }) => updateURLParams({ minShrinkage: min, maxShrinkage: max, page: undefined })}
            />
          </FilterBar>
        </CardContent>
      </Card>

      {/* Results Summary */}
      {!isLoading && greigeMasters.length > 0 && (
        <div className="mb-4 text-sm text-muted-foreground">
          Showing {greigeMasters.length} of {total} greige masters
          {activeFilterCount > 0 && ` · ${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'} applied`}
        </div>
      )}

      {/* DataTable */}
      <Card>
        <DataTable
          data={greigeMasters}
          columns={columns}
          keyExtractor={(greige) => greige.id}
          loading={isLoading}
          error={error}
          emptyState={{
            icon: <Layers className="h-16 w-16" />,
            title: 'No greige masters found',
            description:
              activeFilterCount > 0
                ? 'Try adjusting your search or filter criteria'
                : 'Create your first greige master to get started',
            actionLabel: activeFilterCount === 0 ? 'Create First Greige' : undefined,
            onAction: activeFilterCount === 0 ? () => navigate('/greige/new') : undefined,
          }}
          pagination={{
            currentPage: filters.page ?? 1,
            totalPages,
            pageSize: filters.limit ?? 50,
            totalItems: total,
            onPageChange: (page) => updateURLParams({ page: page > 1 ? page : undefined }),
            onPageSizeChange: (size) => updateURLParams({ limit: size === 50 ? undefined : size, page: undefined }),
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
