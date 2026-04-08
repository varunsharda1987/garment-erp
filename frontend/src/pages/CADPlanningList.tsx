/**
 * CAD Planning List Page
 *
 * Dedicated list page for CAD Planning module.
 * Shows styles that need CAD work with status tabs.
 * Route: /cad-planning
 *
 * Features:
 * - Two tabs: Pending (includes IN_PROGRESS), Approved
 * - Expandable rows showing CAD width details (greige, width, CAD avg, purpose)
 * - Unified search across all statuses
 * - "Go to Fabric Costing" button for navigation
 * - React Query for efficient caching and deduplication
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useListQuery, queryKeys } from '@/hooks/useQuery';
import {
  cadPlanningService,
  type CADPlanningStyle,
  type CADStatusCounts,
  type CADWidthDetail,
} from '@/services/cad-planning.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import SearchInput from '@/components/SearchInput';
import { CADStatusBadge } from '@/components/cad/CADStatusBadge';
import ExportButton from '@/components/ExportButton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Ruler, Clock, CheckCircle2, Loader2, ChevronDown, ChevronRight, Calculator } from 'lucide-react';
import { getUploadUrl } from '../config/api.config';

export default function CADPlanningList() {
  const navigate = useNavigate();

  // Tab state - Only PENDING and APPROVED now (IN_PROGRESS merged into PENDING)
  const [statusTab, setStatusTab] = useState<'PENDING' | 'APPROVED'>('PENDING');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(15);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Expandable rows state
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // React Query: Fetch status counts (cached for 2 minutes)
  const { data: statusCounts = { PENDING: 0, IN_PROGRESS: 0, APPROVED: 0 } } = useListQuery<CADStatusCounts>(
    queryKeys.cadPlanning.statusCounts(),
    () => cadPlanningService.getCADStatusCounts(),
    { staleTime: 2 * 60 * 1000 } // 2 minutes
  );

  // Build filters for styles query
  const stylesFilters = useMemo(
    () => ({
      status: searchQuery ? undefined : statusTab,
      page: currentPage,
      limit: pageSize,
      search: searchQuery || undefined,
      searchAll: !!searchQuery,
    }),
    [statusTab, currentPage, pageSize, searchQuery]
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
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(styleId)) {
        next.delete(styleId);
      } else {
        next.add(styleId);
      }
      return next;
    });
  };

  // Reset page when tab or search changes
  useEffect(() => {
    setCurrentPage(1);
    setExpandedRows(new Set()); // Collapse all rows when changing tab/search
  }, [statusTab, searchQuery]);

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

  // Get list of pending purposes for a style
  const getPendingPurposes = (cadDetails: CADWidthDetail[]): string[] => {
    const purposes = cadDetails?.map((cad) => cad.purpose).filter(Boolean) || [];
    const completedPurposes = new Set(purposes as string[]);
    const allPurposes = ['COSTING', 'RAW_MATERIAL_CALCULATION', 'PRODUCTION'];
    return allPurposes.filter((p) => !completedPurposes.has(p));
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
          <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}>
            ‹
          </Button>
          <span className="px-3 py-1 bg-primary text-primary-foreground rounded text-sm">{currentPage}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
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
                : `Manage CAD planning for styles (${totalStyles} styles in ${statusTab.toLowerCase()} status)`}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <ExportButton module="styles" filters={{ cadStatus: statusTab }} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Status Tabs - Only PENDING and APPROVED */}
        <Tabs value={statusTab} onValueChange={(v) => setStatusTab(v as 'PENDING' | 'APPROVED')} className="mb-6">
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
              {/* Search - Global across all statuses */}
              <div className="mb-4">
                <SearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Search across all statuses by style code, name, buyer, or brand..."
                  className="max-w-lg"
                />
                {searchQuery && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Searching across both Pending and Approved styles
                  </p>
                )}
              </div>

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
                    {searchQuery
                      ? 'Try adjusting your search terms'
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
                        <TableHead>Buyer / Brand</TableHead>
                        <TableHead>Greige</TableHead>
                        <TableHead className="text-center w-24">Components</TableHead>
                        <TableHead className="w-32">CAD Status</TableHead>
                        <TableHead>Pending Purposes</TableHead>
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

                            {/* CAD Status */}
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <CADStatusBadge status={style.cadStatus} />
                                {/* Show status badge during search to indicate which tab */}
                                {searchQuery && (
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] ${
                                      style.cadStatus === 'APPROVED'
                                        ? 'bg-success-muted text-success border-success/20'
                                        : 'bg-warning-muted text-warning border-yellow-200'
                                    }`}
                                  >
                                    {style.cadStatus === 'APPROVED' ? 'Approved' : 'Pending'}
                                  </Badge>
                                )}
                                {/* Show CAD count if available */}
                                {style.cadDetails && style.cadDetails.length > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    {style.cadDetails.length} width{style.cadDetails?.length !== 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                            </TableCell>

                            {/* Pending Purposes - always check actual data */}
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {getPendingPurposes(style.cadDetails).length === 0 ? (
                                  <span className="text-xs text-success font-medium">All Complete</span>
                                ) : (
                                  getPendingPurposes(style.cadDetails).map((purpose) => (
                                    <Badge key={purpose} variant="outline" className="text-xs text-muted-foreground">
                                      {purpose === 'COSTING'
                                        ? 'Costing'
                                        : purpose === 'RAW_MATERIAL_CALCULATION'
                                          ? 'Raw Mat'
                                          : 'Production'}
                                    </Badge>
                                  ))
                                )}
                              </div>
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
                                    navigate(`/fabric-costing?styleId=${style.id}`);
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
                              <TableCell colSpan={9} className="p-0">
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
