/**
 * CAD Planning List Page
 *
 * Dedicated list page for CAD Planning module.
 * Shows styles that need CAD work with status tabs.
 * Route: /cad-planning
 *
 * Features:
 * - Two tabs: Pending (includes IN_PROGRESS), Approved
 * - Filter bar: Buyer, Brand, Category, Orders, CAD Progress — the tab badges count under the
 *   same filters (backend cad-list-filter.helper.ts serves both)
 * - Tab, search, filters and page live in the URL, so Open CAD -> Back restores the view
 * - Expandable rows showing CAD width details (greige, width, CAD avg, purpose)
 * - Unified search across all statuses
 * - "Go to Fabric Costing" button for navigation
 * - React Query for efficient caching and deduplication
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useListQuery, queryKeys } from '@/hooks/useQuery';
import {
  cadPlanningService,
  type CADFilterOption,
  type CADListFilters,
  type CADOrderFilter,
  type CADPlanningStyle,
  type CADProgressFilter,
  type CADStatusCounts,
  type CADWidthDetail,
} from '@/services/cad-planning.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import SearchInput from '@/components/SearchInput';
import ExportButton from '@/components/ExportButton';
import { FilterBar, MultiSelectFilter, SelectFilter } from '@/components/filters';
import type { MultiSelectOption } from '@/components/ui/multi-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Ruler, Clock, CheckCircle2, Circle, Loader2, ChevronDown, ChevronRight, Calculator } from 'lucide-react';
import { getUploadUrl } from '../config/api.config';
import { MiniMarkerBadge } from '@/components/cad/MiniMarkerBadge';
import { applyUrlUpdates, getUrlList, getUrlPage, type FilterUpdate } from '@/lib/url-filters';

const PAGE_SIZE = 15;
const EMPTY_ROWS: ReadonlySet<string> = new Set();

const ORDER_FILTER_OPTIONS: Array<{ value: 'all' | CADOrderFilter; label: string }> = [
  { value: 'all', label: 'All styles' },
  { value: 'open', label: 'On an open order' },
  { value: 'none', label: 'No open order' },
];

const CAD_PROGRESS_OPTIONS: Array<{ value: 'all' | CADProgressFilter; label: string }> = [
  { value: 'all', label: 'Any' },
  // Short enough for SelectFilter's fixed 180px trigger
  { value: 'NO_CAD', label: 'No CAD yet' },
  { value: 'NO_COSTING', label: 'No Costing CAD' },
  { value: 'NO_RAW_MATERIAL_CALCULATION', label: 'No Raw Mat CAD' },
  { value: 'NO_PRODUCTION', label: 'No Production CAD' },
  { value: 'HAS_COSTING', label: 'Has Costing CAD' },
  { value: 'HAS_RAW_MATERIAL_CALCULATION', label: 'Has Raw Mat CAD' },
  { value: 'HAS_PRODUCTION', label: 'Has Production CAD' },
];

const isOrderFilter = (v: string | null): v is CADOrderFilter => v === 'open' || v === 'none';
const isProgressFilter = (v: string | null): v is CADProgressFilter =>
  CAD_PROGRESS_OPTIONS.some((o) => o.value !== 'all' && o.value === v);

const toOptions = (facet: CADFilterOption[] | undefined): MultiSelectOption[] =>
  (facet ?? []).map((o) => ({ value: o.value, label: o.label ?? o.value, count: o.count }));

export default function CADPlanningList() {
  const navigate = useNavigate();

  // Tab, search, filters and page live in the URL: Open CAD -> Back restores them, and a filtered
  // view can be pasted to a colleague. `replace` so filter fiddling does not flood the history.
  const [searchParams, setSearchParams] = useSearchParams();
  const updateURLParams = useCallback(
    (updates: Record<string, FilterUpdate>) => {
      setSearchParams((prev) => applyUrlUpdates(prev, updates), { replace: true });
    },
    [setSearchParams]
  );

  // Only PENDING and APPROVED tabs (IN_PROGRESS merged into PENDING)
  const statusTab: 'PENDING' | 'APPROVED' = searchParams.get('tab') === 'APPROVED' ? 'APPROVED' : 'PENDING';
  const currentPage = getUrlPage(searchParams);
  const pageSize = PAGE_SIZE;
  const searchQuery = searchParams.get('search') ?? '';

  // The filter bar — sent to both the list and the tab badges
  const listFilters = useMemo<CADListFilters>(() => {
    const orders = searchParams.get('orders');
    const cadProgress = searchParams.get('cadProgress');
    return {
      customerId: getUrlList(searchParams, 'customerId'),
      brandName: getUrlList(searchParams, 'brandName'),
      productCategoryId: getUrlList(searchParams, 'productCategoryId'),
      orders: isOrderFilter(orders) ? orders : undefined,
      cadProgress: isProgressFilter(cadProgress) ? cadProgress : undefined,
    };
  }, [searchParams]);

  const activeFilterCount =
    (searchQuery ? 1 : 0) +
    (listFilters.customerId?.length ? 1 : 0) +
    (listFilters.brandName?.length ? 1 : 0) +
    (listFilters.productCategoryId?.length ? 1 : 0) +
    (listFilters.orders ? 1 : 0) +
    (listFilters.cadProgress ? 1 : 0);
  const hasListFilters = activeFilterCount - (searchQuery ? 1 : 0) > 0;

  // Clear keeps the tab: it is where the user is, not a filter they set
  const clearFilters = useCallback(() => {
    setSearchParams(statusTab === 'APPROVED' ? new URLSearchParams({ tab: 'APPROVED' }) : new URLSearchParams(), {
      replace: true,
    });
  }, [setSearchParams, statusTab]);

  // SearchInput fires onChange ~300ms after MOUNT with the current value. Without this guard that
  // unchanged fire would strip `page` from the URL and bounce a deep-linked page 3 back to page 1.
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchParams(
        (prev) =>
          (prev.get('search') ?? '') === value
            ? prev
            : applyUrlUpdates(prev, { search: value || undefined, page: undefined }),
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const setCurrentPage = (page: number) => updateURLParams({ page: page > 1 ? page : undefined });

  // Expandable rows state, tied to the view it was opened in: changing the tab, search or a filter
  // collapses everything (derived during render — no reset effect). Page changes keep it.
  const viewKey = JSON.stringify([statusTab, searchQuery, listFilters]);
  const [expanded, setExpanded] = useState<{ viewKey: string; rows: Set<string> }>({ viewKey, rows: new Set() });
  const expandedRows = expanded.viewKey === viewKey ? expanded.rows : EMPTY_ROWS;

  // Option lists change only when styles are added — no need to refetch on every visit
  const { data: filterOptions } = useQuery({
    queryKey: queryKeys.cadPlanning.filterOptions(),
    queryFn: () => cadPlanningService.getFilterOptions(),
    staleTime: 5 * 60 * 1000,
  });

  // React Query: Fetch status counts under the current filters (cached for 2 minutes)
  const { data: statusCounts = { PENDING: 0, IN_PROGRESS: 0, APPROVED: 0 } } = useListQuery<CADStatusCounts>(
    queryKeys.cadPlanning.statusCounts(listFilters as Record<string, unknown>),
    () => cadPlanningService.getCADStatusCounts(listFilters),
    {
      staleTime: 2 * 60 * 1000, // 2 minutes
      placeholderData: (previousData) => previousData,
    }
  );

  // Build filters for styles query
  const stylesFilters = useMemo(
    () => ({
      status: searchQuery ? undefined : statusTab,
      page: currentPage,
      limit: pageSize,
      search: searchQuery || undefined,
      searchAll: !!searchQuery,
      ...listFilters,
    }),
    [statusTab, currentPage, pageSize, searchQuery, listFilters]
  );

  // React Query: Fetch styles (cached, deduped, auto-refetch)
  const {
    data: stylesResponse,
    isLoading,
    error: stylesError,
    refetch: refetchStyles,
  } = useListQuery(
    queryKeys.cadPlanning.list(stylesFilters),
    () => cadPlanningService.getStylesForCADPlanning(stylesFilters),
    {
      staleTime: 30 * 1000, // 30 seconds
      // Keep previous data while fetching new data
      placeholderData: (previousData) => previousData,
    }
  );

  // Process styles data — serializer maps 'styles' → 'style' via RELATION_MAPPINGS
  const { styles, totalPages, totalStyles } = useMemo(() => {
    if (!stylesResponse?.success || !stylesResponse.data) {
      return { styles: [], totalPages: 1, totalStyles: 0 };
    }

    const stylesArray = stylesResponse.data.style;
    if (!Array.isArray(stylesArray)) {
      console.error('[CADPlanningList] Expected data.style to be an array, got:', typeof stylesArray);
      return { styles: [], totalPages: 1, totalStyles: 0 };
    }

    // Use effectiveCadStatus for display consistency (reflects actual state)
    const stylesWithDefaults = stylesArray.map((style: CADPlanningStyle) => {
      const rawStyle = style as CADPlanningStyle & { effectiveCadStatus?: string };
      return {
        ...style,
        cadDetails: style.cadDetails ?? [],
        cadStatus: rawStyle.effectiveCadStatus ?? style.cadStatus,
      };
    });

    return {
      styles: stylesWithDefaults as Array<CADPlanningStyle & { cadDetails: CADWidthDetail[] }>,
      totalPages: stylesResponse.data.pagination?.totalPages ?? 1,
      totalStyles: stylesResponse.data.pagination?.total ?? 0,
    };
  }, [stylesResponse]);

  // Error message
  const error = stylesError?.message || null;

  // Toggle row expansion
  const toggleRowExpand = (styleId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev.viewKey === viewKey ? prev.rows : []);
      if (next.has(styleId)) {
        next.delete(styleId);
      } else {
        next.add(styleId);
      }
      return { viewKey, rows: next };
    });
  };

  // Get purpose badge color
  const getPurposeBadgeClass = (purpose: string | null) => {
    switch (purpose) {
      case 'PRODUCTION':
        return 'bg-success-muted text-success border-success/20';
      case 'RAW_MATERIAL_CALCULATION':
        return 'bg-info-muted text-info border-info/20';
      case 'COSTING':
        return 'bg-warning/10 text-warning border-warning/20';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  // Get purpose display label
  const getPurposeLabel = (purpose: string | null) => {
    switch (purpose) {
      case 'RAW_MATERIAL_CALCULATION':
        return 'Raw Mat';
      case 'COSTING':
        return 'Costing';
      case 'PRODUCTION':
        return 'Production';
      case 'OTHER':
        return 'Other';
      default:
        return purpose || '-';
    }
  };

  // Get set of completed purposes for a style
  const getCompletedPurposes = (cadDetails: CADWidthDetail[]): Set<string> => {
    const purposes = cadDetails?.map((cad) => cad.purpose).filter(Boolean) || [];
    return new Set(purposes as string[]);
  };

  // Get list of unique greiges for a style (returns array for stacked display)
  const getGreigesList = (cadDetails: CADWidthDetail[]): string[] => {
    if (!cadDetails || cadDetails.length === 0) return [];

    const greiges = new Set(cadDetails.filter((cad) => cad.greigeName).map((cad) => cad.greigeName));

    return Array.from(greiges) as string[];
  };

  // Pagination component
  const renderPagination = () => {
    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-between px-4 py-3 border-t">
        <div className="text-sm text-muted-foreground">
          Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalStyles)} of {totalStyles}{' '}
          results
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>
            «
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            ‹
          </Button>
          <span className="px-3 py-1 bg-primary text-primary-foreground rounded text-sm">{currentPage}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            ›
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(totalPages)}
          >
            »
          </Button>
        </div>
      </div>
    );
  };

  // Render CAD details sub-table grouped by purpose
  const renderCADDetails = (cadDetails: CADWidthDetail[]) => {
    if (!cadDetails || cadDetails.length === 0) {
      return <div className="text-center py-4 text-muted-foreground text-sm">No CAD entries found for this style</div>;
    }

    // Group by purpose
    const grouped: Record<string, CADWidthDetail[]> = {
      COSTING: cadDetails.filter((c) => c.purpose === 'COSTING'),
      RAW_MATERIAL_CALCULATION: cadDetails.filter((c) => c.purpose === 'RAW_MATERIAL_CALCULATION'),
      PRODUCTION: cadDetails.filter((c) => c.purpose === 'PRODUCTION'),
    };

    // Add items without a recognized purpose to OTHER
    const other = cadDetails.filter(
      (c) => !c.purpose || !['COSTING', 'RAW_MATERIAL_CALCULATION', 'PRODUCTION'].includes(c.purpose)
    );
    if (other.length > 0) {
      grouped['OTHER'] = other;
    }

    // Render table for a group of CAD entries
    const renderGroupTable = (items: CADWidthDetail[]) => (
      <Table className="border-0">
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="text-xs font-medium text-muted-foreground py-2">Width</TableHead>
            <TableHead className="text-xs font-medium text-muted-foreground py-2">Greige</TableHead>
            <TableHead className="text-xs font-medium text-muted-foreground py-2">Layer Length (m)</TableHead>
            <TableHead className="text-xs font-medium text-muted-foreground py-2">CAD Avg (m)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((cad) => (
            <TableRow key={cad.id} className="hover:bg-muted/50">
              <TableCell className="py-2">
                <Badge variant="outline" className="font-mono">
                  {cad.cutableWidth}"
                </Badge>
              </TableCell>
              <TableCell className="py-2 text-sm">
                {cad.greigeName || <span className="text-muted-foreground">-</span>}
                {cad.greigeCode && <span className="text-xs text-muted-foreground ml-1">({cad.greigeCode})</span>}
              </TableCell>
              <TableCell className="py-2 text-sm font-mono">
                {cad.layerLength ? cad.layerLength.toFixed(3) : '-'}
              </TableCell>
              <TableCell className="py-2 text-sm font-mono font-semibold text-info">
                {cad.cadAverage ? cad.cadAverage.toFixed(4) : '-'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );

    return (
      <div className="space-y-4">
        {Object.entries(grouped).map(([purpose, items]) => {
          if (items.length === 0) return null;
          return (
            <div key={purpose} className="border rounded-md overflow-hidden">
              <div className="bg-muted px-3 py-2 flex items-center gap-2 border-b">
                <Badge variant="outline" className={`text-xs ${getPurposeBadgeClass(purpose)}`}>
                  {getPurposeLabel(purpose)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  ({items.length} width{items.length !== 1 ? 's' : ''})
                </span>
              </div>
              {renderGroupTable(items)}
            </div>
          );
        })}
      </div>
    );
  };

  // Get combined pending count (PENDING + IN_PROGRESS)
  const pendingCount = statusCounts.PENDING + statusCounts.IN_PROGRESS;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Ruler className="h-6 w-6" />
              CAD Planning
            </CardTitle>
            <CardDescription>
              {searchQuery
                ? `Search results: ${totalStyles} styles found`
                : `Manage CAD planning for styles (${totalStyles} styles in ${statusTab.toLowerCase()} status${
                    hasListFilters ? ', filtered' : ''
                  })`}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <ExportButton module="styles" filters={{ cadStatus: statusTab }} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Search + filters — apply to both tabs and to the tab counts */}
        <FilterBar
          className="mb-4"
          onClear={clearFilters}
          hasActiveFilters={activeFilterCount > 0}
          clearText={`Clear ${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'}`}
        >
          <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
            <Label className="text-sm font-medium">Search</Label>
            <SearchInput value={searchQuery} onChange={handleSearchChange} placeholder="Code, name, buyer, brand…" />
          </div>

          <MultiSelectFilter
            label="Buyer"
            value={listFilters.customerId ?? []}
            onChange={(value) => updateURLParams({ customerId: value, page: undefined })}
            options={toOptions(filterOptions?.buyers)}
          />

          <MultiSelectFilter
            label="Brand"
            value={listFilters.brandName ?? []}
            onChange={(value) => updateURLParams({ brandName: value, page: undefined })}
            options={toOptions(filterOptions?.brands)}
          />

          <MultiSelectFilter
            label="Category"
            value={listFilters.productCategoryId ?? []}
            onChange={(value) => updateURLParams({ productCategoryId: value, page: undefined })}
            options={toOptions(filterOptions?.productCategories)}
            className="w-[220px]"
          />

          <SelectFilter
            label="Orders"
            value={listFilters.orders ?? 'all'}
            onChange={(value) => updateURLParams({ orders: value === 'all' ? undefined : value, page: undefined })}
            options={ORDER_FILTER_OPTIONS}
          />

          <SelectFilter
            label="CAD Progress"
            value={listFilters.cadProgress ?? 'all'}
            onChange={(value) => updateURLParams({ cadProgress: value === 'all' ? undefined : value, page: undefined })}
            options={CAD_PROGRESS_OPTIONS}
          />
        </FilterBar>

        {/* Status Tabs - Only PENDING and APPROVED */}
        <Tabs
          value={statusTab}
          onValueChange={(v) => updateURLParams({ tab: v === 'APPROVED' ? 'APPROVED' : undefined, page: undefined })}
          className="mb-6"
        >
          <TabsList>
            <TabsTrigger value="PENDING" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Pending
              {pendingCount > 0 && (
                <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                  {pendingCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="APPROVED" className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Approved
              {statusCounts.APPROVED > 0 && (
                <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-success-muted text-success">
                  {statusCounts.APPROVED}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Content for both tabs */}
          {(['PENDING', 'APPROVED'] as const).map((status) => (
            <TabsContent key={status} value={status}>
              {searchQuery && (
                <p className="text-xs text-muted-foreground mb-4">Searching across both Pending and Approved styles</p>
              )}

              {/* Loading state */}
              {isLoading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}

              {/* Error state */}
              {error && !isLoading && (
                <div className="text-center py-12 text-destructive">
                  <p>{error}</p>
                  <Button variant="outline" className="mt-4" onClick={() => refetchStyles()}>
                    Retry
                  </Button>
                </div>
              )}

              {/* Empty state */}
              {!isLoading && !error && styles.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Ruler className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No styles found</p>
                  <p className="text-sm mt-1">
                    {searchQuery || hasListFilters
                      ? 'No styles match this search and these filters — try clearing some'
                      : status === 'PENDING'
                        ? 'All styles have CAD planning completed'
                        : 'No styles have completed CAD planning yet'}
                  </p>
                </div>
              )}

              {/* Table with expandable rows */}
              {!isLoading && !error && styles.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted">
                        <TableHead className="w-10"></TableHead>
                        <TableHead className="w-16">Image</TableHead>
                        <TableHead>Style Code</TableHead>
                        <TableHead>Buyer Ref</TableHead>
                        <TableHead>Buyer / Brand</TableHead>
                        <TableHead>Greige</TableHead>
                        <TableHead className="text-center w-24">Components</TableHead>
                        <TableHead className="w-44">Progress</TableHead>
                        <TableHead className="w-24 text-center">Markers</TableHead>
                        <TableHead className="w-56">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {styles.map((style) => (
                        <React.Fragment key={style.id}>
                          {/* Main Row */}
                          <TableRow className="hover:bg-muted cursor-pointer" onClick={() => toggleRowExpand(style.id)}>
                            {/* Expand/Collapse */}
                            <TableCell className="w-10 px-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleRowExpand(style.id);
                                }}
                              >
                                {expandedRows.has(style.id) ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                            </TableCell>

                            {/* Image */}
                            <TableCell className="w-16">
                              <div className="w-12 h-12 rounded overflow-hidden bg-muted flex-shrink-0">
                                {style.imageUrl ? (
                                  <img
                                    src={getUploadUrl(style.imageUrl)}
                                    alt={style.styleCode}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = '/placeholder-style.png';
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                                    No img
                                  </div>
                                )}
                              </div>
                            </TableCell>

                            {/* Style Code */}
                            <TableCell>
                              <div>
                                <div className="font-medium text-info">{style.styleCode}</div>
                                <div
                                  className="text-sm text-muted-foreground truncate max-w-[180px]"
                                  title={style.styleName}
                                >
                                  {style.styleName}
                                </div>
                              </div>
                            </TableCell>

                            {/* Buyer Ref */}
                            <TableCell>
                              <span className="text-sm">{style.buyerStyleRef || '—'}</span>
                            </TableCell>

                            {/* Buyer / Brand */}
                            <TableCell>
                              <div>
                                <div className="font-medium">{style.buyerName || '-'}</div>
                                <div className="text-sm text-muted-foreground">{style.brandName || '-'}</div>
                              </div>
                            </TableCell>

                            {/* Greige - stacked vertically */}
                            <TableCell>
                              <div className="text-sm max-w-[250px]">
                                {getGreigesList(style.cadDetails).length === 0 ? (
                                  <span className="text-muted-foreground italic">Pending selection</span>
                                ) : (
                                  <div className="flex flex-col gap-0.5">
                                    {getGreigesList(style.cadDetails).map((greige, idx) => (
                                      <span key={idx} className="truncate text-xs" title={greige || ''}>
                                        {greige}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </TableCell>

                            {/* Components */}
                            <TableCell className="text-center">
                              <Badge variant="outline" className="text-xs">
                                {style.componentCount}
                              </Badge>
                            </TableCell>

                            {/* Progress - unified column showing completion state per purpose */}
                            <TableCell>
                              {(() => {
                                const completed = getCompletedPurposes(style.cadDetails);
                                return (
                                  <div className="flex flex-col gap-1.5">
                                    {(['COSTING', 'RAW_MATERIAL_CALCULATION', 'PRODUCTION'] as const).map((p) => {
                                      const isComplete = completed.has(p);
                                      const label =
                                        p === 'COSTING'
                                          ? 'Costing'
                                          : p === 'RAW_MATERIAL_CALCULATION'
                                            ? 'Raw Mat'
                                            : 'Production';
                                      return (
                                        <div key={p} className="flex items-center gap-2 text-xs">
                                          {isComplete ? (
                                            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                                          ) : (
                                            <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                                          )}
                                          <span className={isComplete ? 'text-foreground' : 'text-muted-foreground'}>
                                            {label}
                                          </span>
                                        </div>
                                      );
                                    })}
                                    {style.cadDetails && style.cadDetails.length > 0 && (
                                      <span className="text-[10px] text-muted-foreground mt-0.5">
                                        {style.cadDetails.length} width{style.cadDetails.length !== 1 ? 's' : ''}
                                      </span>
                                    )}
                                    {/* Show tab indicator during search */}
                                    {searchQuery && (
                                      <Badge
                                        variant="outline"
                                        className={`text-[10px] mt-1 ${
                                          style.cadStatus === 'APPROVED'
                                            ? 'bg-success-muted text-success border-success/20'
                                            : 'bg-warning-muted text-warning border-yellow-200'
                                        }`}
                                      >
                                        {style.cadStatus === 'APPROVED' ? 'Approved' : 'Pending'}
                                      </Badge>
                                    )}
                                  </div>
                                );
                              })()}
                            </TableCell>

                            {/* Mini Markers */}
                            <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                              <MiniMarkerBadge styleId={style.id} />
                            </TableCell>

                            {/* Actions */}
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/cad-planning/${style.id}`);
                                  }}
                                >
                                  Open CAD
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Navigate to most relevant purpose based on what CAD data exists.
                                    // Never PRODUCTION: a Production CAD is a lot marker and is not costed.
                                    const completedPurposes = getCompletedPurposes(style.cadDetails);
                                    const targetPurpose = completedPurposes.has('RAW_MATERIAL_CALCULATION')
                                      ? 'RAW_MATERIAL_CALCULATION'
                                      : 'COSTING';
                                    navigate(`/fabric-costing?styleId=${style.id}&purpose=${targetPurpose}`);
                                  }}
                                >
                                  <Calculator className="h-4 w-4 mr-1" />
                                  Fabric Costing
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>

                          {/* Expanded Row - CAD Details */}
                          {expandedRows.has(style.id) && (
                            <TableRow className="bg-muted/50">
                              <TableCell colSpan={10} className="p-0">
                                <div className="px-12 py-3 border-t border-gray-100">
                                  <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                                    CAD Width Details
                                  </div>
                                  {renderCADDetails(style.cadDetails || [])}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {renderPagination()}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
