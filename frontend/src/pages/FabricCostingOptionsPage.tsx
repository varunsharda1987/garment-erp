/**
 * Fabric Costing Options Page
 * View all saved fabric costing options with filtering, comparison, and approval workflow
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, Trash2, Star, Loader2, Filter, X, Eye, ArrowRight, Lock } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../components/ui/alert-dialog';
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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [promotingId, setPromotingId] = useState<string | null>(null);

  // Collapsed/expanded state per style
  const [expandedStyles, setExpandedStyles] = useState<Set<string>>(new Set());

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

  // Handle delete
  const handleDelete = async (optionId: string) => {
    setDeletingId(optionId);
    try {
      await fabricCostingService.deleteCostingOption(optionId);
      notify.success('Option deleted successfully');
      fetchCostingOptions(); // Refresh data
    } catch (error) {
      notify.error('Failed to delete option');
    } finally {
      setDeletingId(null);
    }
  };

  // Handle promote to next workflow stage
  const handlePromote = async (optionId: string, targetPurpose: 'COSTING' | 'PRODUCTION') => {
    setPromotingId(optionId);
    try {
      await fabricCostingService.promoteCostingOption(optionId, targetPurpose);
      notify.success(`Promoted to ${targetPurpose.toLowerCase()} successfully`);
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
      case 'COSTING': return 'secondary';
      case 'PLANNING': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Fabric Costing Options</h1>
            <p className="text-muted-foreground text-sm">
              View, compare, and approve saved fabric costing options
            </p>
          </div>
        </div>
        <Button onClick={() => navigate('/fabric-costing')}>
          + New Costing
        </Button>
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
          <TabsTrigger value="PLANNING">
            Planning ({purposeCounts.planning})
          </TabsTrigger>
          <TabsTrigger value="COSTING">
            Costing ({purposeCounts.costing})
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
          <Select
            value={filters.processorId || 'all'}
            onValueChange={(val) => handleFilterChange('processorId', val)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Processors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Processors</SelectItem>
              {processors.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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

                      return (
                        <div key={componentName} className="p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <h4 className="font-medium">{componentName}</h4>
                            <Badge variant="secondary">{options.length} options</Badge>
                            {hasApproved && (
                              <Badge variant="default" className="bg-green-600">
                                Approved
                              </Badge>
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
                                  <TableCell>
                                    {option.isLowestCost && (
                                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                                    )}
                                    {!option.isLowestCost && idx + 1}
                                  </TableCell>
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
                                      {option.purpose || 'PLANNING'}
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

                                      {/* Promote to Costing button (PLANNING + APPROVED) */}
                                      {option.purpose === 'PLANNING' && option.approvalStatus === 'APPROVED' && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handlePromote(option.id, 'COSTING')}
                                          disabled={promotingId === option.id}
                                          className="text-blue-600 hover:text-blue-700"
                                          title="Promote to Costing"
                                        >
                                          {promotingId === option.id ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                          ) : (
                                            <>
                                              <ArrowRight className="h-3 w-3 mr-1" />
                                              Cost
                                            </>
                                          )}
                                        </Button>
                                      )}

                                      {/* Promote to Production button (COSTING + APPROVED) */}
                                      {option.purpose === 'COSTING' && option.approvalStatus === 'APPROVED' && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handlePromote(option.id, 'PRODUCTION')}
                                          disabled={promotingId === option.id}
                                          className="text-green-600 hover:text-green-700"
                                          title="Promote to Production"
                                        >
                                          {promotingId === option.id ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                          ) : (
                                            <>
                                              <ArrowRight className="h-3 w-3 mr-1" />
                                              Prod
                                            </>
                                          )}
                                        </Button>
                                      )}

                                      {/* Lock indicator for Production */}
                                      {option.purpose === 'PRODUCTION' && (
                                        <span className="text-muted-foreground text-xs" title="Production records are locked">
                                          <Lock className="h-3 w-3" />
                                        </span>
                                      )}

                                      {/* Delete button (not for locked Production records) */}
                                      {!(option.purpose === 'PRODUCTION' && option.isLocked) && (
                                        <AlertDialog>
                                          <AlertDialogTrigger asChild>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              className="text-destructive hover:text-destructive"
                                              disabled={deletingId === option.id}
                                            >
                                              {deletingId === option.id ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                              ) : (
                                                <Trash2 className="h-3 w-3" />
                                              )}
                                            </Button>
                                          </AlertDialogTrigger>
                                          <AlertDialogContent>
                                            <AlertDialogHeader>
                                              <AlertDialogTitle>Delete Costing Option?</AlertDialogTitle>
                                              <AlertDialogDescription>
                                                This will permanently delete this costing option for {componentName}.
                                                This action cannot be undone.
                                              </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                                              <AlertDialogAction
                                                className="bg-destructive text-destructive-foreground"
                                                onClick={() => handleDelete(option.id)}
                                              >
                                                Delete
                                              </AlertDialogAction>
                                            </AlertDialogFooter>
                                          </AlertDialogContent>
                                        </AlertDialog>
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
    </div>
  );
}
