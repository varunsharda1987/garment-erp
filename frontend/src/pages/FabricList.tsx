import { useState, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Layers } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import SearchInput from '../components/SearchInput';
import DataTable from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import { FilterBar, MultiSelectFilter, NumberRangeFilter, SelectFilter } from '../components/filters';
import { GreigeCombobox } from '../components/GreigeCombobox';
import { SupplierCombobox } from '../components/SupplierCombobox';
import { handleApiError, handleApiSuccess } from '../lib/api-error-handler';
import { formatCurrency } from '@/lib/currency';
import { useListQuery, queryKeys } from '../hooks/useQuery';
import { useFabricFacets, toFacetOptions } from '../hooks/useFacetOptions';
import { applyUrlUpdates, getUrlList, getUrlLimit, getUrlNumber, getUrlPage } from '../lib/url-filters';
import type { FilterUpdate } from '../lib/url-filters';
import { fabricService } from '../services/fabricGreigeService';
import type { FabricMaster, FabricQueryParams } from '../types/fabric-greige.types';

// Local type definition to avoid import issues
type Column<T> = {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

/** Enum-ish values as the filter dropdowns should read them. */
const FINISH_TYPE_LABELS: Record<string, string> = {
  DYED: 'Dyed',
  PRINTED: 'Printed',
  YARN_DYED: 'Yarn Dyed',
  RAW: 'Raw',
};

/**
 * fabric_master.source is free text, not a Prisma enum, and it has FIVE writers — two from the
 * Fabric form and three that mint a finished fabric automatically:
 *   STYLE_LINKED / STOCK        FabricForm
 *   AUTO_FROM_MRP_JWO           mrp.service.ts
 *   AUTO_FROM_MRP_GRN           grn.service.ts (a job-work receipt minting its own fabric)
 *   AUTO_FROM_JOB_WORK          dyeing.controller.ts / printing.controller.ts
 * The options themselves come from /fabric/filter-options, so a sixth writer would appear in the
 * dropdown on its own; anything unmapped here simply falls back to its raw value.
 */
const SOURCE_LABELS: Record<string, string> = {
  STYLE_LINKED: 'Style-linked',
  STOCK: 'Stock',
  AUTO_FROM_MRP_JWO: 'Auto — MRP job work',
  AUTO_FROM_MRP_GRN: 'Auto — goods receipt',
  AUTO_FROM_JOB_WORK: 'Auto — dyeing / printing',
};

export default function FabricList() {
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

  const filters = useMemo<FabricQueryParams>(
    () => ({
      page: getUrlPage(searchParams),
      limit: getUrlLimit(searchParams),
      search: searchParams.get('search') ?? '',
      // 'all' | 'true' | 'false' — defaulted here, so Clear (which empties the URL) returns to it
      isActive: searchParams.get('isActive') ?? 'true',
      isGeneric: searchParams.get('isGeneric') ?? 'all',
      greigeId: searchParams.get('greigeId') ?? '',
      supplierId: searchParams.get('supplierId') ?? '',
      finishType: getUrlList(searchParams, 'finishType'),
      genericGreigeName: getUrlList(searchParams, 'genericGreigeName'),
      colorName: getUrlList(searchParams, 'colorName'),
      source: getUrlList(searchParams, 'source'),
      minGSM: getUrlNumber(searchParams, 'minGSM'),
      maxGSM: getUrlNumber(searchParams, 'maxGSM'),
      minWidth: getUrlNumber(searchParams, 'minWidth'),
      maxWidth: getUrlNumber(searchParams, 'maxWidth'),
    }),
    [searchParams]
  );

  const {
    data,
    isLoading,
    error: queryError,
  } = useListQuery(
    queryKeys.fabrics.list(filters as unknown as Record<string, unknown>),
    () => fabricService.getAll(filters),
    {
      staleTime: 30_000,
      // Bulk import navigates back here via the SPA router; without this the default 5-minute
      // staleTime would show someone who just imported rows the pre-import list.
      refetchOnMount: 'always',
      // Keep the previous page on screen while the next loads — DataTable replaces the whole
      // table AND its pager with a skeleton whenever `loading` is true.
      placeholderData: (previous) => previous,
    }
  );

  const fabrics = data?.data ?? [];
  const total = data?.pagination.total ?? 0;
  const totalPages = data?.pagination.totalPages ?? 0;
  const error = queryError ? queryError.message : null;

  const { data: facets } = useFabricFacets(filters.isActive ?? 'true');

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fabricToDelete, setFabricToDelete] = useState<{ id: string; name: string } | null>(null);

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
    if ((filters.isGeneric ?? 'all') !== 'all') n++;
    if (filters.greigeId) n++;
    if (filters.supplierId) n++;
    if (filters.finishType?.length) n++;
    if (filters.genericGreigeName?.length) n++;
    if (filters.colorName?.length) n++;
    if (filters.source?.length) n++;
    if (filters.minGSM !== undefined || filters.maxGSM !== undefined) n++;
    if (filters.minWidth !== undefined || filters.maxWidth !== undefined) n++;
    return n;
  }, [filters]);

  const clearFilters = useCallback(() => {
    // Emptying the URL restores every default, including isActive -> 'true'
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

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
      queryClient.invalidateQueries({ queryKey: queryKeys.fabrics.all });
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
          className="text-info hover:text-info font-medium"
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
          <div className="text-sm font-medium text-foreground">{fabric.fabricName}</div>
          {fabric.finishType && <div className="text-xs text-muted-foreground">{fabric.finishType}</div>}
        </div>
      ),
    },
    {
      key: 'color',
      header: 'Color',
      render: (fabric) => (
        <div>
          {fabric.colorName && <div className="text-sm text-foreground">{fabric.colorName}</div>}
          {fabric.colorCode && <div className="text-xs text-muted-foreground">{fabric.colorCode}</div>}
        </div>
      ),
    },
    {
      key: 'greige',
      header: 'Greige Name',
      render: (fabric) => (
        <div className="text-sm text-foreground truncate max-w-[200px]" title={fabric.greige?.greigeName}>
          {fabric.greige ? fabric.greige.greigeName : '-'}
        </div>
      ),
    },
    {
      key: 'width',
      header: 'Width (")',
      render: (fabric) => (
        <div>
          <div className="text-sm text-foreground">{Number(fabric.actualWidth)}"</div>
          {fabric.cutableWidth && (
            <div className="text-xs text-muted-foreground">Cutable: {Number(fabric.cutableWidth)}"</div>
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
        <div className="text-sm font-medium text-foreground">{formatCurrency(fabric.costPerMeter)}</div>
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
      key: 'styleUsage',
      header: 'Style Usage',
      render: (fabric) => {
        const styleCount = fabric._count?.styleFabrics || 0; // _count.styleFabrics: serializer preserves _count verbatim (no inner remap)
        const allocations = fabric.fabrics || []; // styleFabrics -> fabrics (serializer mapping)

        if (styleCount === 0) {
          return <span className="text-xs text-muted-foreground">Not allocated</span>;
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
                <span className="font-medium text-info">{entry.styleCode}</span>
                {entry.components.length > 0 && (
                  <span className="text-muted-foreground ml-1">({entry.components.join(', ')})</span>
                )}
              </div>
            ))}
            {styleCount > 2 && <span className="text-xs text-muted-foreground">+{styleCount - 2} more</span>}
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
                placeholder="Search by code, name, or color..."
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
              label="Finish Type"
              value={filters.finishType ?? []}
              onChange={(value) => updateURLParams({ finishType: value, page: undefined })}
              options={toFacetOptions(facets?.finishType, FINISH_TYPE_LABELS)}
            />

            <MultiSelectFilter
              label="Generic Name"
              value={filters.genericGreigeName ?? []}
              onChange={(value) => updateURLParams({ genericGreigeName: value, page: undefined })}
              options={toFacetOptions(facets?.genericGreigeName)}
            />

            <MultiSelectFilter
              label="Colour"
              value={filters.colorName ?? []}
              onChange={(value) => updateURLParams({ colorName: value, page: undefined })}
              options={toFacetOptions(facets?.colorName)}
            />

            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium">Greige</Label>
              <GreigeCombobox
                allowAll
                value={filters.greigeId || ''}
                onValueChange={(value) => updateURLParams({ greigeId: value || undefined, page: undefined })}
                placeholder="All Greige"
                className="w-[200px]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium">Supplier</Label>
              <SupplierCombobox
                allowAll
                value={filters.supplierId || ''}
                onValueChange={(value) => updateURLParams({ supplierId: value || undefined, page: undefined })}
                className="w-[200px]"
              />
            </div>

            <MultiSelectFilter
              label="Source"
              value={filters.source ?? []}
              onChange={(value) => updateURLParams({ source: value, page: undefined })}
              options={toFacetOptions(facets?.source, SOURCE_LABELS)}
            />

            <SelectFilter
              label="Generic"
              value={filters.isGeneric ?? 'all'}
              onChange={(value) => updateURLParams({ isGeneric: value === 'all' ? undefined : value, page: undefined })}
              options={[
                { value: 'all', label: 'All' },
                { value: 'true', label: 'Generic only' },
                { value: 'false', label: 'Style-specific' },
              ]}
            />

            <NumberRangeFilter
              label="GSM"
              value={{ min: filters.minGSM, max: filters.maxGSM }}
              onChange={({ min, max }) => updateURLParams({ minGSM: min, maxGSM: max, page: undefined })}
            />

            <NumberRangeFilter
              label='Width (")'
              value={{ min: filters.minWidth, max: filters.maxWidth }}
              onChange={({ min, max }) => updateURLParams({ minWidth: min, maxWidth: max, page: undefined })}
            />
          </FilterBar>
        </CardContent>
      </Card>

      {/* Results Summary */}
      {!isLoading && fabrics.length > 0 && (
        <div className="mb-4 text-sm text-muted-foreground">
          Showing {fabrics.length} of {total} fabric masters
          {activeFilterCount > 0 && ` · ${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'} applied`}
        </div>
      )}

      {/* DataTable */}
      <Card>
        <DataTable
          data={fabrics}
          columns={columns}
          keyExtractor={(fabric) => fabric.id}
          loading={isLoading}
          error={error}
          emptyState={{
            icon: <Layers className="h-16 w-16" />,
            title: 'No fabric masters found',
            description:
              activeFilterCount > 0
                ? 'Try adjusting your search or filter criteria'
                : 'Create your first fabric master to get started',
            actionLabel: activeFilterCount === 0 ? 'Create First Fabric' : undefined,
            onAction: activeFilterCount === 0 ? () => navigate('/fabric/new') : undefined,
          }}
          pagination={{
            currentPage: filters.page ?? 1,
            totalPages,
            pageSize: filters.limit ?? 50,
            totalItems: total,
            onPageChange: (page) => updateURLParams({ page: page > 1 ? page : undefined }),
            onPageSizeChange: (size) => updateURLParams({ limit: size === 50 ? undefined : size, page: undefined }),
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
