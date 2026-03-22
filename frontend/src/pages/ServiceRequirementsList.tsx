/**
 * Service Requirements List
 * View and manage all service requirements with filtering and actions
 * Uses React Query for efficient caching and deduplication
 */

import { useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useListQuery, queryKeys } from '@/hooks/useQuery';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import ProcessorAllocationDialog from '@/components/ProcessorAllocationDialog';
import BulkServicePODialog from '@/components/BulkServicePODialog';
import { getAllServiceRequirements, generateServicePO } from '@/services/serviceRequirement.service';
import { getAllSuppliers } from '@/services/supplier.service';
import type {
  ServiceRequirement,
  ServiceRequirementFilters,
  ServiceRequirementStatus,
  ServiceType as ServiceTypeEnum,
} from '@/types/serviceRequirement.types';
import {
  ServiceRequirementStatusColors,
  ServiceRequirementStatusLabels,
  ServiceRequirementStatus as StatusEnum,
  ServiceTypeLabels,
  RequirementSourceLabels,
} from '@/types/serviceRequirement.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { ArrowLeft, Search, ShoppingCart, RefreshCw, X, ChevronLeft, ChevronRight, Zap, UserCheck } from 'lucide-react';

export default function ServiceRequirementsList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Selection and dialog state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showGeneratePO, setShowGeneratePO] = useState(false);
  const [poProcessorId, setPOProcessorId] = useState('');
  const [poDeliveryDate, setPODeliveryDate] = useState('');
  const [poRemarks, setPORemarks] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showProcessorAllocation, setShowProcessorAllocation] = useState(false);
  const [showBulkPOGeneration, setShowBulkPOGeneration] = useState(false);

  // Filters from URL (memoized)
  const filters = useMemo((): ServiceRequirementFilters => {
    return {
      workOrderId: searchParams.get('workOrderId') || undefined,
      status: searchParams.get('status')?.split(',') as ServiceRequirementStatus[] | undefined,
      serviceType: searchParams.get('serviceType')?.split(',') as ServiceTypeEnum[] | undefined,
      processorId: searchParams.get('processorId') || undefined,
      search: searchParams.get('search') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: 20,
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
    };
  }, [searchParams]);

  // React Query: Fetch service requirements (cached, auto-refetch on filter change)
  const {
    data: requirementsResponse,
    isLoading,
    refetch: rerefreshRequirements,
  } = useListQuery(
    queryKeys.serviceRequirements.list(filters as unknown as Record<string, unknown>),
    () => getAllServiceRequirements(filters),
    {
      staleTime: 30 * 1000, // 30 seconds
    }
  );

  // Process requirements data
  const { requirements, totalPages, total } = useMemo(() => {
    if (!requirementsResponse) {
      return { requirements: [], totalPages: 1, total: 0 };
    }
    return {
      requirements: requirementsResponse.data || [],
      totalPages: requirementsResponse.pagination?.totalPages || 1,
      total: requirementsResponse.pagination?.total || requirementsResponse.total || 0,
    };
  }, [requirementsResponse]);

  // React Query: Fetch processors/suppliers (cached for 5 minutes)
  const { data: processorsResponse } = useListQuery(
    queryKeys.suppliers.list({ limit: 100 }),
    () => getAllSuppliers({ limit: 100 }),
    { staleTime: 5 * 60 * 1000 } // 5 minutes
  );

  const processors = useMemo(() => {
    return processorsResponse?.data || [];
  }, [processorsResponse]);

  // Helper to invalidate and refetch
  const refreshRequirements = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.serviceRequirements.all });
    rerefreshRequirements();
  }, [queryClient, rerefreshRequirements]);

  const updateURLParams = (updates: Partial<ServiceRequirementFilters>) => {
    const newParams = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
        newParams.delete(key);
      } else if (Array.isArray(value)) {
        newParams.set(key, value.join(','));
      } else {
        newParams.set(key, String(value));
      }
    });

    // Reset to page 1 when filters change (except page itself)
    if (!('page' in updates)) {
      newParams.set('page', '1');
    }

    setSearchParams(newParams);
  };

  const handleSearch = (value: string) => {
    updateURLParams({ search: value });
  };

  const handleStatusFilter = (value: string) => {
    if (value === 'all') {
      updateURLParams({ status: undefined });
    } else {
      updateURLParams({ status: [value] as ServiceRequirementStatus[] });
    }
  };

  const handleServiceTypeFilter = (value: string) => {
    if (value === 'all') {
      updateURLParams({ serviceType: undefined });
    } else {
      updateURLParams({ serviceType: [value] as ServiceTypeEnum[] });
    }
  };

  const handleProcessorFilter = (value: string) => {
    updateURLParams({ processorId: value === 'all' ? undefined : value });
  };

  const handlePageChange = (newPage: number) => {
    updateURLParams({ page: newPage });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Only select items that are pending or in progress
      const selectableIds = requirements.filter((r) => isSelectable(r)).map((r) => r.id);
      setSelectedIds(selectableIds);
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((i) => i !== id));
    }
  };

  const isSelectable = (req: ServiceRequirement): boolean => {
    return req.status === StatusEnum.PENDING || req.status === StatusEnum.IN_PROGRESS;
  };

  const handleGeneratePO = async () => {
    if (!poProcessorId || !poDeliveryDate) {
      handleApiError(new Error('Please select processor and delivery date'), 'Validation Error');
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generateServicePO({
        processorId: poProcessorId,
        requirementIds: selectedIds,
        expectedDeliveryDate: poDeliveryDate,
        remarks: poRemarks || undefined,
      });

      handleApiSuccess(
        'Service Purchase Order Created',
        `Service PO ${result.purchaseOrder.poNumber} created with ${result.linkedRequirements} requirement(s)`
      );

      setShowGeneratePO(false);
      setSelectedIds([]);
      setPOProcessorId('');
      setPODeliveryDate('');
      setPORemarks('');
      refreshRequirements();
    } catch (error) {
      handleApiError(error, 'Failed to generate service PO');
    } finally {
      setIsGenerating(false);
    }
  };

  const clearFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  const hasActiveFilters = () => {
    return (
      searchParams.has('status') ||
      searchParams.has('serviceType') ||
      searchParams.has('processorId') ||
      searchParams.has('workOrderId') ||
      searchParams.has('search')
    );
  };

  const currentPage = parseInt(searchParams.get('page') || '1');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/service-requirements')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 text-purple-600" />
            Service Requirements
          </h1>
        </div>
        <div className="flex gap-2">
          {selectedIds.length > 0 && (
            <>
              <Button
                variant="outline"
                onClick={() => setShowProcessorAllocation(true)}
                className="border-purple-500 text-purple-600 hover:bg-purple-50"
              >
                <UserCheck className="h-4 w-4 mr-2" />
                Assign Processors ({selectedIds.length})
              </Button>
              <Button
                variant="default"
                onClick={() => setShowBulkPOGeneration(true)}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Bulk Generate POs ({selectedIds.length})
              </Button>
              <Button variant="outline" onClick={() => setShowGeneratePO(true)}>
                <ShoppingCart className="h-4 w-4 mr-2" />
                Generate PO ({selectedIds.length})
              </Button>
            </>
          )}
          <Button variant="outline" onClick={refreshRequirements}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by work order, service type..."
                  value={searchParams.get('search') || ''}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="w-[180px]">
              <Label className="text-xs">Status</Label>
              <Select value={searchParams.get('status')?.split(',')[0] || 'all'} onValueChange={handleStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {Object.entries(ServiceRequirementStatusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Service Type Filter */}
            <div className="w-[180px]">
              <Label className="text-xs">Service Type</Label>
              <Select
                value={searchParams.get('serviceType')?.split(',')[0] || 'all'}
                onValueChange={handleServiceTypeFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Services" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Services</SelectItem>
                  {Object.entries(ServiceTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Processor Filter */}
            <div className="w-[200px]">
              <Label className="text-xs">Processor</Label>
              <Select value={searchParams.get('processorId') || 'all'} onValueChange={handleProcessorFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Processors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Processors</SelectItem>
                  {processors.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.code} - {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Clear Filters */}
            {hasActiveFilters() && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {requirements.length} of {total} service requirements
        </span>
        {selectedIds.length > 0 && (
          <span className="text-primary font-medium">{selectedIds.length} selected for PO generation</span>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
              <p>Loading service requirements...</p>
            </div>
          ) : requirements.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No service requirements found</p>
              <p className="text-sm">Try adjusting your filters or calculate services from work orders</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={
                        selectedIds.length > 0 && selectedIds.length === requirements.filter(isSelectable).length
                      }
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Work Order</TableHead>
                  <TableHead>Service Type</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Processor</TableHead>
                  <TableHead className="text-right">Est. Cost</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requirements.map((req) => (
                  <TableRow key={req.id} className="hover:bg-muted/50">
                    <TableCell>
                      {isSelectable(req) && (
                        <Checkbox
                          checked={selectedIds.includes(req.id)}
                          onCheckedChange={(checked) => handleSelectOne(req.id, checked as boolean)}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {req.workOrder ? (
                        <Button
                          variant="link"
                          size="sm"
                          className="p-0 h-auto font-medium"
                          onClick={() => navigate(`/work-orders/${req.workOrderId}`)}
                        >
                          {req.workOrder.workOrderNumber}
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-medium">
                        {ServiceTypeLabels[req.serviceType]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="font-medium">
                        {req.quantityRequired.toLocaleString()} {req.unit}
                      </div>
                    </TableCell>
                    <TableCell>
                      {req.assignedProcessor ? (
                        <div>
                          <div className="font-medium">{req.assignedProcessor.supplierCode}</div>
                          <div className="text-sm text-muted-foreground truncate max-w-[150px]">
                            {req.assignedProcessor.supplierName}
                          </div>
                        </div>
                      ) : req.preferredProcessor ? (
                        <div>
                          <div className="font-medium text-orange-600">{req.preferredProcessor.supplierCode}</div>
                          <div className="text-xs text-muted-foreground">(Suggested)</div>
                        </div>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Unassigned
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {req.estimatedTotal ? (
                        <div className="font-medium text-purple-600">₹{req.estimatedTotal.toLocaleString()}</div>
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={ServiceRequirementStatusColors[req.status]}>
                        {ServiceRequirementStatusLabels[req.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {RequirementSourceLabels[req.source]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Generate PO Dialog */}
      <Dialog open={showGeneratePO} onOpenChange={setShowGeneratePO}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Service Purchase Order</DialogTitle>
            <DialogDescription>
              Create a service purchase order for {selectedIds.length} selected requirement(s).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="processor">Processor *</Label>
              <Select value={poProcessorId} onValueChange={setPOProcessorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select processor" />
                </SelectTrigger>
                <SelectContent>
                  {processors.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.code} - {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="deliveryDate">Expected Delivery Date *</Label>
              <Input
                id="deliveryDate"
                type="date"
                value={poDeliveryDate}
                onChange={(e) => setPODeliveryDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="remarks">Remarks</Label>
              <Textarea
                id="remarks"
                value={poRemarks}
                onChange={(e) => setPORemarks(e.target.value)}
                placeholder="Optional notes for the service PO..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGeneratePO(false)}>
              Cancel
            </Button>
            <Button onClick={handleGeneratePO} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Generate Service PO
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Processor Allocation Dialog */}
      <ProcessorAllocationDialog
        open={showProcessorAllocation}
        onOpenChange={setShowProcessorAllocation}
        requirementIds={selectedIds}
        onComplete={() => {
          refreshRequirements();
          setSelectedIds([]);
        }}
      />

      {/* Bulk PO Generation Dialog */}
      <BulkServicePODialog
        open={showBulkPOGeneration}
        onOpenChange={setShowBulkPOGeneration}
        requirementIds={selectedIds}
        onComplete={() => {
          refreshRequirements();
          setSelectedIds([]);
        }}
      />
    </div>
  );
}
