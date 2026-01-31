/**
 * Fabric Costing Options Page
 * View all saved fabric costing options with filtering, comparison, and approval workflow
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, Trash2, Loader2, Filter, X, Eye, ArrowRight, Lock, FileText } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Combobox } from '../components/ui/combobox';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import ConfirmDialog from '@/components/ConfirmDialog';
import { fabricCostingService } from '../services/fabricCosting.service';
import { customerService } from '../services/customer.service';
import { styleService } from '../services/style.service';
import type {
  CostingOption,
  GroupedCostingByStyle,
  CostingOptionsFilters,
  ProcessorInfo,
  PurposeCounts,
  CostingPurpose,
} from '../types/fabricCosting.types';
import type { Customer } from '../types/customer.types';
import type { Style } from '../types/style.types';
import { notify } from '../lib/notify';

export default function FabricCostingOptionsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Data state
  const [groupedData, setGroupedData] = useState<Record<string, GroupedCostingByStyle>>({});
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [styles, setStyles] = useState<Style[]>([]);
  const [processors, setProcessors] = useState<ProcessorInfo[]>([]);

  // Filters state
  const [filters, setFilters] = useState<CostingOptionsFilters>({
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
    planning: 0,
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
  const [isLoadingFilters, setIsLoadingFilters] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [unapprovingId, setUnapprovingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [promotingId, setPromotingId] = useState<string | null>(null);

  // Collapsed/expanded state per style
  const [expandedStyles, setExpandedStyles] = useState<Set<string>>(new Set());

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [optionToDelete, setOptionToDelete] = useState<{ id: string; componentName: string } | null>(null);

  // Fetch filter options on mount
  useEffect(() => {
    const fetchFilterOptions = async () => {
      setIsLoadingFilters(true);
      try {
        const [customersRes, processorsRes] = await Promise.all([
          customerService.getAllCustomers({ page: 1, limit: 1000 }),
          fabricCostingService.getProcessors(),
        ]);
        setCustomers(customersRes.data);
        setProcessors(processorsRes);
      } catch (error) {
        notify.error('Failed to load filter options');
      } finally {
        setIsLoadingFilters(false);
      }
    };
    fetchFilterOptions();
  }, []);

  // Auto-load style info when styleId is provided in URL (e.g., from fabric costing page)
  useEffect(() => {
    const loadStyleInfo = async () => {
      if (filters.styleId && !filters.customerId) {
        try {
          const style = await styleService.getStyleById(filters.styleId);
          if (style && style.customerId) {
            // Set customer ID to enable style dropdown
            setFilters((prev) => ({ ...prev, customerId: style.customerId }));
          }
        } catch (error) {
          console.error('Failed to load style info:', error);
        }
      }
    };
    loadStyleInfo();
  }, [filters.styleId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch styles when customer changes
  useEffect(() => {
    const fetchStyles = async () => {
      if (!filters.customerId) {
        setStyles([]);
        return;
      }
      try {
        const response = await styleService.getAllStyles({
          page: 1,
          limit: 500,
          customerId: filters.customerId,
        });
        setStyles(response.data);
      } catch (error) {
        notify.error('Failed to load styles');
      }
    };
    fetchStyles();
  }, [filters.customerId]);

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
    } catch (error) {
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
    setFilters(prev => ({
      ...prev,
      [key]: value === 'all' ? undefined : value,
      page: 1, // Reset page on filter change
    }));
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      customerId: undefined,
      styleId: undefined,
      processorId: undefined,
      status: 'ALL',
      purpose: 'ALL',
      page: 1,
      limit: 10,
    });
  };

  // Handle approve
  const handleApprove = async (optionId: string) => {
    setApprovingId(optionId);
    try {
      await fabricCostingService.approveCostingOption(optionId);
      notify.success('Option approved successfully');
      fetchCostingOptions(); // Refresh data
    } catch (error) {
      notify.error('Failed to approve option');
    } finally {
      setApprovingId(null);
    }
  };

  // Handle unapprove
  const handleUnapprove = async (optionId: string) => {
    setUnapprovingId(optionId);
    try {
      await fabricCostingService.unapproveCostingOption(optionId);
      notify.success('Option unapproved');
      fetchCostingOptions(); // Refresh data
    } catch (error) {
      notify.error('Failed to unapprove option');
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
      notify.success('Option deleted successfully');
      fetchCostingOptions(); // Refresh data
    } catch (error) {
      notify.error('Failed to delete option');
    } finally {
      setDeletingId(null);
      setOptionToDelete(null);
    }
  };

  // Handle promote to next workflow stage
  const handlePromote = async (optionId: string, targetPurpose: 'RAW_MATERIAL_CALCULATION' | 'PRODUCTION') => {
    setPromotingId(optionId);
    try {
      await fabricCostingService.promoteCostingOption(optionId, targetPurpose);
      const displayLabel = targetPurpose === 'RAW_MATERIAL_CALCULATION' ? 'Raw Material Calculation' : 'Production';
      notify.success(`Promoted to ${displayLabel} successfully`);
      fetchCostingOptions(); // Refresh data
    } catch (error) {
      notify.error('Failed to promote option');
    } finally {
      setPromotingId(null);
    }
  };

  // Toggle style expansion
  const toggleStyleExpanded = (styleId: string) => {
    setExpandedStyles(prev => {
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

  // Check if any filters are active (excluding purpose tabs which are separate)
  const hasActiveFilters = filters.customerId || filters.styleId || filters.processorId || filters.status !== 'ALL';

  // Get purpose badge variant
  const getPurposeBadgeVariant = (purpose: string | null) => {
    switch (purpose) {
      case 'PRODUCTION': return 'default';
      case 'RAW_MATERIAL_CALCULATION': return 'secondary';
      case 'COSTING': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => {
            // Fallback to fabric-costing page if history is empty
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate('/fabric-costing');
            }
          }}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {filters.styleId
                ? `Costing Options - ${styles.find((s) => s.id === filters.styleId)?.styleCode || 'Loading...'}`
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
            <Button
              variant="outline"
              onClick={() => navigate(`/fabric-costing?styleId=${filters.styleId}`)}
            >
              Edit Costing
            </Button>
          )}
          <Button onClick={() => navigate('/fabric-costing')}>
            + New Costing
          </Button>
        </div>
      </div>

      {/* Purpose Tabs */}
      <Tabs
        value={filters.purpose || 'ALL'}
        onValueChange={(val) => handleFilterChange('purpose', val)}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-4 max-w-xl">
          <TabsTrigger value="ALL">
            All ({purposeCounts.all})
          </TabsTrigger>
          <TabsTrigger value="COSTING">
            Costing ({purposeCounts.costing})
          </TabsTrigger>
          <TabsTrigger value="RAW_MATERIAL_CALCULATION">
            Raw Mat ({purposeCounts.rawMaterialCalculation})
          </TabsTrigger>
          <TabsTrigger value="PRODUCTION">
            Production ({purposeCounts.production})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters:</span>
          </div>

          {/* Customer Filter */}
          <Select
            value={filters.customerId || 'all'}
            onValueChange={(val) => handleFilterChange('customerId', val)}
            disabled={isLoadingFilters}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Customers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Customers</SelectItem>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Style Filter */}
          <Select
            value={filters.styleId || 'all'}
            onValueChange={(val) => handleFilterChange('styleId', val)}
            disabled={!filters.customerId}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Styles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Styles</SelectItem>
              {styles.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.styleCode} - {s.styleName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Processor Filter */}
          <Combobox
            value={filters.processorId || 'all'}
            onValueChange={(val) => handleFilterChange('processorId', val)}
            options={[
              { value: 'all', label: 'All Processors' },
              ...processors.map((p) => ({ value: p.id, label: p.name }))
            ]}
            placeholder="All Processors"
            searchPlaceholder="Search processor..."
            emptyText="No processors found"
            className="w-[180px]"
          />

          {/* Status Filter */}
          <Select
            value={filters.status || 'ALL'}
            onValueChange={(val) => handleFilterChange('status', val as any)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
            </SelectContent>
          </Select>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </Card>

      {/* Summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {Object.keys(groupedData).length} of {pagination.totalStyles} styles
          ({pagination.totalOptions} total options)
        </span>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
      </div>

      {/* Main Content */}
      {isLoading && Object.keys(groupedData).length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : Object.keys(groupedData).length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">No costing options found.</p>
          <p className="text-sm text-muted-foreground mt-2">
            Try adjusting your filters or create a new costing.
          </p>
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
              (sum, [, opts]) => sum + opts.filter(o => o.approvalStatus === 'APPROVED').length,
              0
            );
            const allApproved = componentEntries.every(([, opts]) =>
              opts.some(o => o.approvalStatus === 'APPROVED')
            );

            return (
              <Card key={styleId} className="overflow-hidden">
                {/* Style Header */}
                <div
                  className="p-4 bg-muted/50 cursor-pointer flex items-center justify-between"
                  onClick={() => toggleStyleExpanded(styleId)}
                >
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold">
                        {style.styleCode} - {style.styleName}
                      </h3>
                      {allApproved && (
                        <Badge variant="default" className="bg-green-600">
                          <Check className="h-3 w-3 mr-1" />
                          All Approved
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {style.customerName || 'No Customer'} |
                      {componentEntries.length} components |
                      {totalOptions} options |
                      {approvedCount} approved
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
                    <Badge variant="outline">
                      {isExpanded ? '▼' : '▶'}
                    </Badge>
                  </div>
                </div>

                {/* Components */}
                {isExpanded && (
                  <div className="divide-y">
                    {componentEntries.map(([componentName, options]) => {
                      const hasApproved = options.some(o => o.approvalStatus === 'APPROVED');

                      // Group options by styleFabricId to check if ALL fabric groups have approval
                      const styleFabricGroups = new Map<string | null, CostingOption[]>();
                      options.forEach(opt => {
                        const key = opt.styleFabricId || opt.id; // Use id as fallback for legacy records
                        if (!styleFabricGroups.has(key)) {
                          styleFabricGroups.set(key, []);
                        }
                        styleFabricGroups.get(key)!.push(opt);
                      });

                      // Check if ALL styleFabric groups have at least one approved COSTING option
                      const allStyleFabricsApproved = Array.from(styleFabricGroups.values()).every(groupOptions =>
                        groupOptions.some(o => o.purpose === 'COSTING' && o.approvalStatus === 'APPROVED')
                      );

                      return (
                        <div key={componentName} className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{componentName}</h4>
                              <Badge variant="secondary">{options.length} options</Badge>
                              {hasApproved && (
                                <Badge variant="default" className="bg-green-600">
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
                                className="text-blue-600 hover:text-blue-700"
                                title="Create Cost Sheet - All fabric options approved"
                              >
                                <FileText className="h-3 w-3 mr-1" />
                                Create Cost Sheet
                              </Button>
                            )}
                          </div>

                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[50px]">#</TableHead>
                                <TableHead>Greige</TableHead>
                                <TableHead>Width</TableHead>
                                <TableHead>Processor</TableHead>
                                <TableHead className="text-right">Qty (pcs)</TableHead>
                                <TableHead className="text-right">Fabric (m)</TableHead>
                                <TableHead className="text-right">Part Cost (₹)</TableHead>
                                <TableHead className="text-right">Greige Req (m)</TableHead>
                                <TableHead className="text-right">Greige</TableHead>
                                <TableHead className="text-right">Transport</TableHead>
                                <TableHead className="text-right">Process</TableHead>
                                <TableHead className="text-right">Shrink</TableHead>
                                <TableHead className="text-right">Screen</TableHead>
                                <TableHead className="text-right font-semibold">Total</TableHead>
                                <TableHead>Mode</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="w-[180px]">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {options.map((option, idx) => (
                                <TableRow
                                  key={option.id}
                                  className={option.approvalStatus === 'APPROVED' ? 'bg-green-50' : ''}
                                >
                                  <TableCell>{idx + 1}</TableCell>
                                  <TableCell className="font-medium">
                                    {option.greigeName || option.greigeCode || '-'}
                                  </TableCell>
                                  <TableCell>{option.cutableWidth}"</TableCell>
                                  <TableCell>
                                    {option.processorName || option.processorCode || (
                                      <span className="text-muted-foreground">Direct</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {option.orderQuantityPcs?.toLocaleString() || '-'}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {option.cadMeters && option.orderQuantityPcs
                                      ? (Number(option.cadMeters) * option.orderQuantityPcs).toLocaleString(undefined, { maximumFractionDigits: 0 })
                                      : '-'}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {option.cadMeters && option.totalCostPerMeter
                                      ? `₹${(Number(option.cadMeters) * Number(option.totalCostPerMeter)).toFixed(2)}`
                                      : '-'}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {option.cadMeters && option.orderQuantityPcs
                                      ? (() => {
                                          const fabricReq = Number(option.cadMeters) * option.orderQuantityPcs;
                                          const shrinkage = option.shrinkagePercent ? Number(option.shrinkagePercent) : 0;
                                          const greigeReq = shrinkage > 0 ? fabricReq / (1 - shrinkage / 100) : fabricReq;
                                          return greigeReq.toLocaleString(undefined, { maximumFractionDigits: 0 });
                                        })()
                                      : '-'}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatCurrency(option.greigeCostPerMeter)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatCurrency(option.transportCostPerMeter)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatCurrency(option.processingPricePerMeter)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatCurrency(option.shrinkageCostPerMeter)}
                                    {option.shrinkagePercent && (
                                      <span className="text-xs text-muted-foreground ml-1">
                                        ({option.shrinkagePercent}%)
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatCurrency(option.screenCostPerMeter)}
                                    {option.numberOfColors && (
                                      <span className="text-xs text-muted-foreground ml-1">
                                        ({option.numberOfColors}c)
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right font-semibold">
                                    {formatCurrency(option.totalCostPerMeter)}
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant={getPurposeBadgeVariant(option.purpose)}
                                      className={option.purpose === 'PRODUCTION' ? 'bg-blue-600' : ''}
                                    >
                                      {option.isLocked && <Lock className="h-3 w-3 mr-1" />}
                                      {option.purpose === 'RAW_MATERIAL_CALCULATION' ? 'Raw Mat' : (option.purpose || 'Costing')}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    {option.approvalStatus === 'APPROVED' ? (
                                      <Badge variant="default" className="bg-green-600">
                                        <Check className="h-3 w-3 mr-1" />
                                        Approved
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline">Pending</Badge>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1">
                                      {/* Approve button (only for pending options) */}
                                      {option.approvalStatus !== 'APPROVED' && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleApprove(option.id)}
                                          disabled={approvingId === option.id}
                                          title="Approve"
                                        >
                                          {approvingId === option.id ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                          ) : (
                                            <Check className="h-3 w-3" />
                                          )}
                                        </Button>
                                      )}

                                      {/* Unapprove button (only for approved, non-locked options) */}
                                      {option.approvalStatus === 'APPROVED' && !option.isLocked && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleUnapprove(option.id)}
                                          disabled={unapprovingId === option.id}
                                          title="Unapprove - revert to Pending"
                                          className="text-amber-600 hover:text-amber-700"
                                        >
                                          {unapprovingId === option.id ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                          ) : (
                                            <X className="h-3 w-3" />
                                          )}
                                        </Button>
                                      )}

                                      {/*
                                        NOTE: Copy workflow buttons removed from Fabric Costing Options page.
                                        As of the new data ownership model:
                                        - CAD Planning module owns CAD structure and workflow transitions
                                        - Fabric Costing module only manages cost data
                                        - To copy CAD between purposes, use the CAD Planning page
                                      */}

                                      {/* Lock indicator for Production */}
                                      {option.purpose === 'PRODUCTION' && (
                                        <span className="text-muted-foreground text-xs" title="Production records are locked">
                                          <Lock className="h-3 w-3" />
                                        </span>
                                      )}

                                      {/* Delete button (not for locked Production records) */}
                                      {!(option.purpose === 'PRODUCTION' && option.isLocked) && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="text-destructive hover:text-destructive"
                                          disabled={deletingId === option.id}
                                          onClick={() => handleDeleteClick(option.id, componentName)}
                                        >
                                          {deletingId === option.id ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                          ) : (
                                            <Trash2 className="h-3 w-3" />
                                          )}
                                        </Button>
                                      )}
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
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilters(prev => ({ ...prev, page: prev.page - 1 }))}
            disabled={filters.page <= 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilters(prev => ({ ...prev, page: prev.page + 1 }))}
            disabled={filters.page >= pagination.totalPages}
          >
            Next
          </Button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Costing Option?"
        description={`This will permanently delete this costing option for ${optionToDelete?.componentName || 'this component'}. This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        variant="destructive"
      />
    </div>
  );
}
