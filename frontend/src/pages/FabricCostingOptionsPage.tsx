/**
 * Fabric Costing Options Page
 * View all saved fabric costing options with filtering, comparison, and approval workflow
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, Trash2, Loader2, X, Eye, Lock, FileText, MoreHorizontal } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import ConfirmDialog from '@/components/ConfirmDialog';
import Pagination from '@/components/Pagination';
import UnapproveImpactDialog from '@/components/fabric-costing/UnapproveImpactDialog';
import { getCostingInUseDetails } from '@/components/fabric-costing/costing-in-use';
import { fabricCostingService } from '../services/fabricCosting.service';
import { CustomerCombobox } from '@/components/CustomerCombobox';
import { StyleCombobox } from '@/components/StyleCombobox';
import { ProcessorCombobox } from '@/components/ProcessorCombobox';
import { FilterBar } from '@/components/filters';
import SearchInput from '@/components/SearchInput';
import type {
  CostingOption,
  GroupedCostingByStyle,
  CostingOptionsFilters,
  PurposeCounts,
  CostingPurpose,
  CostingInUseErrorDetails,
} from '../types/fabricCosting.types';
import { notify } from '../lib/notify';
import { handleApiError } from '../lib/api-error-handler';
import { divideByShrinkage } from '../utils/math';
import { StyleIdentity } from '@/components/StyleIdentity';
import { styleCodeLabel } from '@/lib/style-code';

export default function FabricCostingOptionsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Data state
  const [groupedData, setGroupedData] = useState<Record<string, GroupedCostingByStyle>>({});

  // Filters state
  const [filters, setFilters] = useState<CostingOptionsFilters>({
    search: searchParams.get('search') || undefined,
    customerId: searchParams.get('customerId') || undefined,
    styleId: searchParams.get('styleId') || undefined,
    processorId: searchParams.get('processorId') || undefined,
    status: (searchParams.get('status') as 'ALL' | 'APPROVED' | 'PENDING') || 'ALL',
    purpose: (searchParams.get('purpose') as 'ALL' | CostingPurpose) || 'ALL',
    page: parseInt(searchParams.get('page') || '1'),
    limit: 10,
  });

  // Purpose counts state
  const [purposeCounts, setPurposeCounts] = useState<PurposeCounts>({
    all: 0,
    rawMaterialCalculation: 0,
    costing: 0,
    production: 0,
  });

  // Pagination state
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalStyles: 0,
    totalPages: 0,
    totalOptions: 0,
  });

  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [unapprovingId, setUnapprovingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Collapsed/expanded state per style
  const [expandedStyles, setExpandedStyles] = useState<Set<string>>(new Set());

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [optionToDelete, setOptionToDelete] = useState<{ id: string; componentName: string } | null>(null);

  // Unapprove guard: 409 COSTING_OPTION_IN_USE → impact dialog (blocked or confirmable)
  const [unapproveImpact, setUnapproveImpact] = useState<{
    optionId: string;
    details: CostingInUseErrorDetails;
  } | null>(null);

  // Fetch costing options
  const fetchCostingOptions = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fabricCostingService.getCostingOptions(filters);
      setGroupedData(response.data);
      setPagination(response.pagination);

      // Update purpose counts from response
      if (response.purposeCounts) {
        setPurposeCounts(response.purposeCounts);
      }

      // Expand all styles by default
      setExpandedStyles(new Set(Object.keys(response.data)));
    } catch {
      notify.error('Failed to load costing options');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchCostingOptions();
  }, [fetchCostingOptions]);

  // Update URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.customerId) params.set('customerId', filters.customerId);
    if (filters.styleId) params.set('styleId', filters.styleId);
    if (filters.processorId) params.set('processorId', filters.processorId);
    if (filters.status !== 'ALL') params.set('status', filters.status || '');
    if (filters.purpose && filters.purpose !== 'ALL') params.set('purpose', filters.purpose);
    if (filters.page > 1) params.set('page', filters.page.toString());
    setSearchParams(params);
  }, [filters, setSearchParams]);

  // Handle filter changes
  const handleFilterChange = (key: keyof CostingOptionsFilters, value: string | undefined) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value === 'all' ? undefined : value,
      page: 1, // Reset page on filter change
    }));
  };

  // Clear all filters — the purpose tab and the rows-per-page choice are not filters, so they stay
  const clearFilters = () => {
    setFilters((prev) => ({
      search: undefined,
      customerId: undefined,
      styleId: undefined,
      processorId: undefined,
      status: 'ALL',
      purpose: prev.purpose,
      page: 1,
      limit: prev.limit,
    }));
  };

  // Handle approve
  const handleApprove = async (optionId: string) => {
    setApprovingId(optionId);
    try {
      await fabricCostingService.approveCostingOption(optionId);
      notify.success('Option approved successfully');
      fetchCostingOptions(); // Refresh data
    } catch {
      notify.error('Failed to approve option');
    } finally {
      setApprovingId(null);
    }
  };

  // Handle unapprove (confirmImpact = user acknowledged the dependent-documents warning)
  const handleUnapprove = async (optionId: string, confirmImpact = false) => {
    setUnapprovingId(optionId);
    try {
      await fabricCostingService.unapproveCostingOption(optionId, { confirmImpact });
      setUnapproveImpact(null);
      notify.success('Option unapproved');
      fetchCostingOptions(); // Refresh data
    } catch (error) {
      const inUse = getCostingInUseDetails(error);
      if (inUse) {
        // Downstream documents froze this rate — show them instead of a toast
        setUnapproveImpact({ optionId, details: inUse });
      } else {
        handleApiError(error, 'Failed to unapprove option');
      }
    } finally {
      setUnapprovingId(null);
    }
  };

  // Handle delete click - opens confirmation dialog
  const handleDeleteClick = (optionId: string, componentName: string) => {
    setOptionToDelete({ id: optionId, componentName });
    setDeleteDialogOpen(true);
  };

  // Confirm delete - executes after user confirms
  const confirmDelete = async () => {
    if (!optionToDelete) return;

    setDeletingId(optionToDelete.id);
    try {
      await fabricCostingService.deleteCostingOption(optionToDelete.id);
      notify.success('Costing removed. CAD data preserved');
      fetchCostingOptions(); // Refresh data
    } catch (error) {
      // Surface the server's reason — approved and locked options are refused with
      // instructions ("unapprove it first"), which a generic message would hide
      handleApiError(error, 'Failed to remove costing');
    } finally {
      setDeletingId(null);
      setOptionToDelete(null);
    }
  };

  // Toggle style expansion
  const toggleStyleExpanded = (styleId: string) => {
    setExpandedStyles((prev) => {
      const next = new Set(prev);
      if (next.has(styleId)) {
        next.delete(styleId);
      } else {
        next.add(styleId);
      }
      return next;
    });
  };

  // Format currency
  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return `₹${value.toFixed(2)}`;
  };

  // Active filters (the purpose tabs are separate)
  const activeFilterCount = [
    filters.search,
    filters.customerId,
    filters.styleId,
    filters.processorId,
    filters.status && filters.status !== 'ALL',
  ].filter(Boolean).length;

  // The filtered style's card carries its code — named in the heading once its options load
  const selectedStyle = filters.styleId ? groupedData[filters.styleId]?.style : undefined;

  // Get purpose badge variant
  const getPurposeBadgeVariant = (purpose: string | null) => {
    switch (purpose) {
      case 'RAW_MATERIAL_CALCULATION':
        return 'secondary';
      case 'COSTING':
        return 'outline';
      default:
        return 'outline';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Fallback to fabric-costing page if history is empty
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate('/fabric-costing');
              }
            }}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-display font-medium">
              {filters.styleId
                ? selectedStyle
                  ? `Costing Options - ${styleCodeLabel(selectedStyle)}`
                  : 'Costing Options'
                : 'Fabric Costing Options'}
            </h1>
            <p className="text-muted-foreground text-sm">
              {filters.styleId
                ? 'View and manage all costing options for this style'
                : 'View, compare, and approve saved fabric costing options'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {filters.styleId && (
            <Button variant="outline" onClick={() => navigate(`/fabric-costing?styleId=${filters.styleId}`)}>
              Edit Costing
            </Button>
          )}
          <Button onClick={() => navigate('/fabric-costing')}>+ New Costing</Button>
        </div>
      </div>

      {/* Purpose Tabs */}
      <Tabs
        value={filters.purpose || 'ALL'}
        onValueChange={(val) => handleFilterChange('purpose', val)}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="ALL">All ({purposeCounts.all})</TabsTrigger>
          <TabsTrigger value="COSTING">Costing ({purposeCounts.costing})</TabsTrigger>
          <TabsTrigger value="RAW_MATERIAL_CALCULATION">Raw Mat ({purposeCounts.rawMaterialCalculation})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <Card className="p-4">
        <FilterBar
          onClear={clearFilters}
          hasActiveFilters={activeFilterCount > 0}
          clearText={`Clear ${activeFilterCount} ${activeFilterCount === 1 ? 'filter' : 'filters'}`}
        >
          {/* Not handleFilterChange: it maps the value 'all' to undefined, and "all" is a fair word to type */}
          <SearchInput
            value={filters.search || ''}
            onChange={(v) => setFilters((prev) => ({ ...prev, search: v || undefined, page: 1 }))}
            placeholder="Search style, buyer style code, customer, component, greige, processor…"
            className="w-[340px]"
          />

          <CustomerCombobox
            value={filters.customerId || ''}
            onValueChange={(val) => handleFilterChange('customerId', val || undefined)}
            allowAll
            placeholder="All customers"
            className="w-[220px]"
          />

          <StyleCombobox
            value={filters.styleId || ''}
            onValueChange={(val) => handleFilterChange('styleId', val || undefined)}
            status={null}
            allowAll
            placeholder="All styles"
            className="w-[220px]"
          />

          <ProcessorCombobox
            value={filters.processorId || ''}
            onValueChange={(val) => handleFilterChange('processorId', val || undefined)}
            allowAll
            placeholder="All processors"
            className="w-[220px]"
          />

          <Select
            value={filters.status || 'ALL'}
            onValueChange={(val) => handleFilterChange('status', val as CostingOptionsFilters['status'])}
          >
            <SelectTrigger className="w-[180px]" aria-label="Status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
            </SelectContent>
          </Select>
        </FilterBar>
      </Card>

      {/* Summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {Object.keys(groupedData).length} of {pagination.totalStyles} styles ({pagination.totalOptions} total
          options)
        </span>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
      </div>

      {/* Main Content */}
      {isLoading && Object.keys(groupedData).length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : Object.keys(groupedData).length === 0 && activeFilterCount > 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">No costing options match these filters.</p>
          <Button variant="outline" className="mt-4" onClick={clearFilters}>
            Clear filters
          </Button>
        </Card>
      ) : Object.keys(groupedData).length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">No costing options found.</p>
          <p className="text-sm text-muted-foreground mt-2">Try adjusting your filters or create a new costing.</p>
          <Button className="mt-4" onClick={() => navigate('/fabric-costing')}>
            + New Costing
          </Button>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedData).map(([styleId, { style, components }]) => {
            const isExpanded = expandedStyles.has(styleId);
            const componentEntries = Object.entries(components);
            const totalOptions = componentEntries.reduce((sum, [, opts]) => sum + opts.length, 0);
            const approvedCount = componentEntries.reduce(
              (sum, [, opts]) => sum + opts.filter((o) => o.approvalStatus === 'APPROVED').length,
              0
            );
            const allApproved = componentEntries.every(([, opts]) => opts.some((o) => o.approvalStatus === 'APPROVED'));

            return (
              <Card key={styleId} className="overflow-hidden">
                {/* Style Header */}
                <div
                  className="p-4 bg-muted/50 cursor-pointer flex items-center justify-between"
                  onClick={() => toggleStyleExpanded(styleId)}
                >
                  <div>
                    <div className="flex items-center gap-3">
                      <h3>
                        <StyleIdentity style={style} name={style.styleName} codeClassName="font-semibold" />
                      </h3>
                      {allApproved && (
                        <Badge variant="default" className="bg-success">
                          <Check className="h-3 w-3 mr-1" />
                          All Approved
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {style.customerName || 'No Customer'} | {componentEntries.length} components |{totalOptions}{' '}
                      options |{approvedCount} approved
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/fabric-costing?styleId=${styleId}`);
                      }}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Edit Costing
                    </Button>
                    <Badge variant="outline">{isExpanded ? '▼' : '▶'}</Badge>
                  </div>
                </div>

                {/* Components */}
                {isExpanded && (
                  <div className="divide-y">
                    {componentEntries.map(([componentName, options]) => {
                      const hasApproved = options.some((o) => o.approvalStatus === 'APPROVED');

                      // Group options by styleFabricId to check if ALL fabric groups have approval
                      const styleFabricGroups = new Map<string | null, CostingOption[]>();
                      options.forEach((opt) => {
                        const key = opt.styleFabricId || opt.id; // Use id as fallback for legacy records
                        if (!styleFabricGroups.has(key)) {
                          styleFabricGroups.set(key, []);
                        }
                        styleFabricGroups.get(key)!.push(opt);
                      });

                      // Check if ALL styleFabric groups have at least one approved COSTING option
                      const allStyleFabricsApproved = Array.from(styleFabricGroups.values()).every((groupOptions) =>
                        groupOptions.some((o) => o.purpose === 'COSTING' && o.approvalStatus === 'APPROVED')
                      );

                      // Group options by orderQuantityPcs for visual separation
                      const optionsByQuantity = options.reduce(
                        (acc, option) => {
                          const qty = option.orderQuantityPcs || 0;
                          const key = qty > 0 ? qty.toString() : 'No Qty';
                          if (!acc[key]) acc[key] = [];
                          acc[key].push(option);
                          return acc;
                        },
                        {} as Record<string, CostingOption[]>
                      );

                      // Sort quantities descending (largest first, "No Qty" last)
                      const sortedQuantities = Object.keys(optionsByQuantity).sort((a, b) => {
                        if (a === 'No Qty') return 1;
                        if (b === 'No Qty') return -1;
                        return Number(b) - Number(a);
                      });

                      const hasMultipleQuantityGroups = sortedQuantities.length > 1;

                      return (
                        <div key={componentName} className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{componentName}</h4>
                              <Badge variant="secondary">{options.length} options</Badge>
                              {hasMultipleQuantityGroups && (
                                <Badge variant="outline" className="text-info border-info/30">
                                  {sortedQuantities.length} qty groups
                                </Badge>
                              )}
                              {hasApproved && (
                                <Badge variant="default" className="bg-success">
                                  Approved
                                </Badge>
                              )}
                            </div>
                            {/* Cost Sheet button - only show when ALL styleFabric groups have approved COSTING option */}
                            {allStyleFabricsApproved && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/cost-sheets/new?styleId=${styleId}`)}
                                className="text-info hover:text-info"
                                title="Create Cost Sheet - All fabric options approved"
                              >
                                <FileText className="h-3 w-3 mr-1" />
                                Create Cost Sheet
                              </Button>
                            )}
                          </div>

                          {/* Quantity-grouped tables */}
                          <div className="space-y-4">
                            {sortedQuantities.map((qty) => {
                              const qtyOptions = optionsByQuantity[qty];
                              const qtyHasApproved = qtyOptions.some((o) => o.approvalStatus === 'APPROVED');

                              return (
                                <div key={qty} className="border rounded-lg overflow-hidden">
                                  {/* Quantity group header - only show if multiple groups */}
                                  {hasMultipleQuantityGroups && (
                                    <div className="bg-info-muted px-4 py-2 flex items-center gap-2 border-b">
                                      <span className="font-medium text-info">
                                        {qty === 'No Qty'
                                          ? 'No Quantity Specified'
                                          : `Order Qty: ${Number(qty).toLocaleString()} pcs`}
                                      </span>
                                      <Badge variant="secondary" className="text-xs">
                                        {qtyOptions.length} option{qtyOptions.length > 1 ? 's' : ''}
                                      </Badge>
                                      {qtyHasApproved && (
                                        <Badge variant="default" className="bg-success text-xs">
                                          Has Approved
                                        </Badge>
                                      )}
                                    </div>
                                  )}

                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="w-[50px]">#</TableHead>
                                        <TableHead>Greige</TableHead>
                                        <TableHead className="text-center" title="Cutable Width">
                                          CW
                                        </TableHead>
                                        <TableHead className="text-right">
                                          <div>Qty</div>
                                          <div className="text-[10px] text-muted-foreground">(pcs)</div>
                                        </TableHead>
                                        <TableHead>Mode</TableHead>
                                        <TableHead className="text-right">
                                          <div>Greige +Trp</div>
                                          <div className="text-[10px] text-muted-foreground">(₹/m)</div>
                                        </TableHead>
                                        <TableHead>Processor</TableHead>
                                        <TableHead className="text-right">
                                          <div>Process</div>
                                          <div className="text-[10px] text-muted-foreground">(₹/m)</div>
                                        </TableHead>
                                        <TableHead className="text-right">
                                          <div>Shrink</div>
                                          <div className="text-[10px] text-muted-foreground">(₹/m)</div>
                                        </TableHead>
                                        <TableHead className="text-right font-semibold">
                                          <div>Total</div>
                                          <div className="text-[10px] text-muted-foreground">(₹/m)</div>
                                        </TableHead>
                                        <TableHead className="text-right">
                                          <div>Part Cost</div>
                                          <div className="text-[10px] text-muted-foreground">(₹)</div>
                                        </TableHead>
                                        <TableHead className="text-right">
                                          <div>Fabric Req</div>
                                          <div className="text-[10px] text-muted-foreground">(m)</div>
                                        </TableHead>
                                        <TableHead className="text-right">
                                          <div>Greige Req</div>
                                          <div className="text-[10px] text-muted-foreground">(m)</div>
                                        </TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="w-[180px]">Actions</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {qtyOptions.map((option, idx) => (
                                        <TableRow
                                          key={option.id}
                                          className={option.approvalStatus === 'APPROVED' ? 'bg-success-muted' : ''}
                                        >
                                          {/* 1. Row Number */}
                                          <TableCell>{idx + 1}</TableCell>
                                          {/* 2. Greige */}
                                          <TableCell className="font-medium">
                                            {option.greigeName || option.greigeCode || '-'}
                                          </TableCell>
                                          {/* 3. CW (Cutable Width) */}
                                          <TableCell className="text-center">{option.cutableWidth}"</TableCell>
                                          {/* 4. Qty (pcs) */}
                                          <TableCell className="text-right">
                                            {option.orderQuantityPcs?.toLocaleString() || '-'}
                                          </TableCell>
                                          {/* 5. Mode */}
                                          <TableCell>
                                            <Badge variant={getPurposeBadgeVariant(option.purpose)}>
                                              {option.isLocked && <Lock className="h-3 w-3 mr-1" />}
                                              {option.purpose === 'RAW_MATERIAL_CALCULATION' ? 'Raw Mat' : 'Costing'}
                                            </Badge>
                                          </TableCell>
                                          {/* 6. Greige +Trp (₹/m) - Combined */}
                                          <TableCell className="text-right">
                                            {(() => {
                                              const greige = Number(option.greigeCostPerMeter) || 0;
                                              const transport = Number(option.transportCostPerMeter) || 0;
                                              return formatCurrency(greige + transport);
                                            })()}
                                          </TableCell>
                                          {/* 7. Processor */}
                                          <TableCell>
                                            {option.processorName || option.processorCode || (
                                              <span className="text-muted-foreground">Direct</span>
                                            )}
                                          </TableCell>
                                          {/* 8. Process (₹/m) */}
                                          <TableCell className="text-right">
                                            {formatCurrency(option.processingPricePerMeter)}
                                            {option.numberOfColors && (
                                              <span className="text-xs text-muted-foreground ml-1">
                                                ({option.numberOfColors}c)
                                              </span>
                                            )}
                                          </TableCell>
                                          {/* 9. Shrink (₹/m) */}
                                          <TableCell className="text-right">
                                            {formatCurrency(option.shrinkageCostPerMeter)}
                                            {option.shrinkagePercent && (
                                              <span className="text-xs text-muted-foreground ml-1">
                                                ({option.shrinkagePercent}%)
                                              </span>
                                            )}
                                          </TableCell>
                                          {/* 10. Total (₹/m) */}
                                          <TableCell className="text-right font-semibold">
                                            {formatCurrency(option.totalCostPerMeter)}
                                          </TableCell>
                                          {/* 11. Part Cost (₹) */}
                                          <TableCell className="text-right">
                                            {option.cadAverage && option.totalCostPerMeter
                                              ? `₹${(Number(option.cadAverage) * Number(option.totalCostPerMeter)).toFixed(2)}`
                                              : '-'}
                                          </TableCell>
                                          {/* 12. Fabric Req (m) */}
                                          <TableCell className="text-right">
                                            {option.cadAverage && option.orderQuantityPcs
                                              ? (Number(option.cadAverage) * option.orderQuantityPcs).toLocaleString(
                                                  undefined,
                                                  { maximumFractionDigits: 2 }
                                                )
                                              : '-'}
                                          </TableCell>
                                          {/* 13. Greige Req (m) */}
                                          <TableCell className="text-right">
                                            {option.cadAverage && option.orderQuantityPcs
                                              ? (() => {
                                                  const fabricReq = Number(option.cadAverage) * option.orderQuantityPcs;
                                                  const shrinkage = option.shrinkagePercent
                                                    ? Number(option.shrinkagePercent)
                                                    : 0;
                                                  const greigeReq = divideByShrinkage(fabricReq, shrinkage);
                                                  return greigeReq.toLocaleString(undefined, {
                                                    maximumFractionDigits: 0,
                                                  });
                                                })()
                                              : '-'}
                                          </TableCell>
                                          {/* 14. Status */}
                                          <TableCell>
                                            {option.approvalStatus === 'APPROVED' ? (
                                              <Badge variant="default" className="bg-success">
                                                <Check className="h-3 w-3 mr-1" />
                                                Approved
                                              </Badge>
                                            ) : option.approvalStatus === 'ALTERNATE_APPROVED' ? (
                                              <Badge
                                                variant="outline"
                                                className="text-warning border-warning/40"
                                                title="Approved as an alternate width — another option is the primary"
                                              >
                                                <Check className="h-3 w-3 mr-1" />
                                                Alternate
                                              </Badge>
                                            ) : (
                                              <Badge variant="outline">Pending</Badge>
                                            )}
                                          </TableCell>
                                          <TableCell>
                                            <div className="flex items-center gap-1">
                                              {/* Actions dropdown */}
                                              <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                  <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    disabled={
                                                      approvingId === option.id ||
                                                      unapprovingId === option.id ||
                                                      deletingId === option.id
                                                    }
                                                  >
                                                    {approvingId === option.id ||
                                                    unapprovingId === option.id ||
                                                    deletingId === option.id ? (
                                                      <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                      <MoreHorizontal className="h-4 w-4" />
                                                    )}
                                                  </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                  {/* Approve (only for pending options) */}
                                                  {option.approvalStatus !== 'APPROVED' && (
                                                    <DropdownMenuItem onClick={() => handleApprove(option.id)}>
                                                      <Check className="mr-2 h-4 w-4" />
                                                      Approve
                                                    </DropdownMenuItem>
                                                  )}

                                                  {/* Unapprove (approved or alternate, non-locked options) */}
                                                  {(option.approvalStatus === 'APPROVED' ||
                                                    option.approvalStatus === 'ALTERNATE_APPROVED') &&
                                                    !option.isLocked && (
                                                      <DropdownMenuItem
                                                        onClick={() => handleUnapprove(option.id)}
                                                        className="text-warning"
                                                      >
                                                        <X className="mr-2 h-4 w-4" />
                                                        Unapprove
                                                      </DropdownMenuItem>
                                                    )}

                                                  {/* Remove costing (the backend refuses approved/alternate rows —
                                                      unapprove first) */}
                                                  {option.approvalStatus !== 'APPROVED' &&
                                                    option.approvalStatus !== 'ALTERNATE_APPROVED' && (
                                                      <>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                          onClick={() => handleDeleteClick(option.id, componentName)}
                                                          className="text-destructive"
                                                        >
                                                          <Trash2 className="mr-2 h-4 w-4" />
                                                          Remove Costing
                                                        </DropdownMenuItem>
                                                      </>
                                                    )}
                                                </DropdownMenuContent>
                                              </DropdownMenu>
                                            </div>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination — the API pages by STYLE (each style card holds all its options) */}
      <Pagination
        currentPage={filters.page}
        totalPages={pagination.totalPages}
        pageSize={filters.limit}
        totalItems={pagination.totalStyles}
        onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
        onPageSizeChange={(limit) => setFilters((prev) => ({ ...prev, limit, page: 1 }))}
        itemLabel="styles"
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Remove Costing Option?"
        description={`This removes the costing (rates, processor, costs) for ${optionToDelete?.componentName || 'this component'}. The CAD entry and its size breakdowns are preserved and stay available in CAD Planning.`}
        confirmText="Remove"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        variant="destructive"
      />

      <UnapproveImpactDialog
        open={!!unapproveImpact}
        onOpenChange={(open) => !open && setUnapproveImpact(null)}
        blocking={unapproveImpact?.details.blocking ?? false}
        dependents={unapproveImpact?.details.dependents ?? null}
        isLoading={!!unapprovingId}
        onConfirm={() => unapproveImpact && handleUnapprove(unapproveImpact.optionId, true)}
      />
    </div>
  );
}
