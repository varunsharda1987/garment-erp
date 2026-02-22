/**
 * Material Requirements List
 * View and manage all material requirements with filtering and actions
 * Uses React Query for efficient caching and deduplication
 */

import { useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useListQuery, queryKeys } from '@/hooks/useQuery';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import VendorAllocationDialog from '@/components/VendorAllocationDialog';
import BulkPOGenerationDialog from '@/components/BulkPOGenerationDialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  getRequirements,
  generatePOFromRequirements,
  cancelRequirement,
} from '@/services/mrp.service';
import { getAllSuppliers } from '@/services/supplier.service';
import type {
  MaterialRequirement,
  RequirementFilters,
  MaterialRequirementStatus,
} from '@/types/mrp.types';
import {
  MaterialRequirementStatusColors,
  MaterialRequirementStatusLabels,
  MaterialRequirementStatus as StatusEnum,
  RequirementSourceLabels,
} from '@/types/mrp.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import {
  ArrowLeft,
  Search,
  Filter,
  ShoppingCart,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  FileText,
  Calculator,
  Users,
} from 'lucide-react';

export default function MaterialRequirementsList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Selection and dialog state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showGeneratePO, setShowGeneratePO] = useState(false);
  const [poSupplierId, setPOSupplierId] = useState('');
  const [poDeliveryDate, setPODeliveryDate] = useState('');
  const [poRemarks, setPORemarks] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [requirementToCancel, setRequirementToCancel] = useState<string | null>(null);
  const [showVendorAllocation, setShowVendorAllocation] = useState(false);
  const [showBulkPOGeneration, setShowBulkPOGeneration] = useState(false);

  // Filters from URL (memoized)
  const filters = useMemo((): RequirementFilters => {
    return {
      status: searchParams.get('status')?.split(',') as MaterialRequirementStatus[] | undefined,
      supplierId: searchParams.get('supplierId') || undefined,
      hasShortfall: searchParams.get('hasShortfall') === 'true' ? true : undefined,
      search: searchParams.get('search') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: 20,
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
    };
  }, [searchParams]);

  // React Query: Fetch requirements (cached, auto-refetch on filter change)
  const {
    data: requirementsResponse,
    isLoading,
    refetch: rerefreshRequirements,
  } = useListQuery(
    queryKeys.mrp.list(filters),
    () => getRequirements(filters),
    {
      staleTime: 30 * 1000, // 30 seconds
      placeholderData: (previousData: unknown) => previousData,
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
      total: requirementsResponse.pagination?.total || 0,
    };
  }, [requirementsResponse]);

  // React Query: Fetch suppliers (cached for 5 minutes)
  const { data: suppliersResponse } = useListQuery(
    queryKeys.suppliers.list({ limit: 100 }),
    () => getAllSuppliers({ limit: 100 }),
    { staleTime: 5 * 60 * 1000 } // 5 minutes
  );

  const suppliers = useMemo(() => {
    return suppliersResponse?.data || [];
  }, [suppliersResponse]);

  // Helper to invalidate and refetch
  const refreshRequirements = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.mrp.all });
    rerefreshRequirements();
  }, [queryClient, rerefreshRequirements]);

  const updateURLParams = (updates: Partial<RequirementFilters>) => {
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
      updateURLParams({ status: [value] as MaterialRequirementStatus[] });
    }
  };

  const handleSupplierFilter = (value: string) => {
    updateURLParams({ supplierId: value === 'all' ? undefined : value });
  };

  const handlePageChange = (newPage: number) => {
    updateURLParams({ page: newPage });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Only select items that can have PO generated
      const selectableIds = requirements
        .filter(
          (r) =>
            r.status === StatusEnum.PO_REQUIRED || r.status === StatusEnum.PARTIAL_STOCK
        )
        .map((r) => r.id);
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

  const isSelectable = (req: MaterialRequirement): boolean => {
    return req.status === StatusEnum.PO_REQUIRED || req.status === StatusEnum.PARTIAL_STOCK;
  };

  const handleGeneratePO = async () => {
    if (!poSupplierId || !poDeliveryDate) {
      handleApiError(new Error('Please select supplier and delivery date'), 'Validation Error');
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generatePOFromRequirements({
        requirementIds: selectedIds,
        supplierId: poSupplierId,
        expectedDeliveryDate: poDeliveryDate,
        remarks: poRemarks || undefined,
        consolidate: true,
      });

      handleApiSuccess(
        'Purchase Order Created',
        `PO ${result.purchaseOrder.poNumber} created with ${result.totalItems} items`
      );

      setShowGeneratePO(false);
      setSelectedIds([]);
      setPOSupplierId('');
      setPODeliveryDate('');
      setPORemarks('');
      refreshRequirements();
    } catch (error) {
      handleApiError(error, 'Failed to generate PO');
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle cancel click - opens confirmation dialog
  const handleCancelClick = (id: string) => {
    setRequirementToCancel(id);
    setCancelDialogOpen(true);
  };

  // Confirm cancel - executes after user confirms
  const confirmCancelRequirement = async () => {
    if (!requirementToCancel) return;

    try {
      await cancelRequirement(requirementToCancel);
      handleApiSuccess('Requirement Cancelled', 'The requirement has been cancelled');
      refreshRequirements();
    } catch (error) {
      handleApiError(error, 'Failed to cancel requirement');
    } finally {
      setRequirementToCancel(null);
    }
  };

  const clearFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  const hasActiveFilters = () => {
    return (
      searchParams.has('status') ||
      searchParams.has('supplierId') ||
      searchParams.has('hasShortfall') ||
      searchParams.has('search')
    );
  };

  const currentPage = parseInt(searchParams.get('page') || '1');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/mrp')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Material Requirements
          </h1>
        </div>
        <div className="flex gap-2">
          {selectedIds.length > 0 && (
            <>
              <Button
                variant="outline"
                onClick={() => setShowVendorAllocation(true)}
                className="border-purple-500 text-purple-600 hover:bg-purple-50"
              >
                <Users className="h-4 w-4 mr-2" />
                Assign Vendors ({selectedIds.length})
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
                  placeholder="Search by material, order..."
                  value={searchParams.get('search') || ''}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="w-[180px]">
              <Label className="text-xs">Status</Label>
              <Select
                value={searchParams.get('status')?.split(',')[0] || 'all'}
                onValueChange={handleStatusFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {Object.entries(MaterialRequirementStatusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Supplier Filter */}
            <div className="w-[200px]">
              <Label className="text-xs">Supplier</Label>
              <Select
                value={searchParams.get('supplierId') || 'all'}
                onValueChange={handleSupplierFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Suppliers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Suppliers</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.code} - {s.name}
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
          Showing {requirements.length} of {total} requirements
        </span>
        {selectedIds.length > 0 && (
          <span className="text-primary font-medium">
            {selectedIds.length} selected for PO generation
          </span>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
              <p>Loading requirements...</p>
            </div>
          ) : requirements.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Calculator className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No requirements found</p>
              <p className="text-sm">Try adjusting your filters or calculate from orders</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={
                        selectedIds.length > 0 &&
                        selectedIds.length ===
                          requirements.filter(isSelectable).length
                      }
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Requirement #</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead className="text-right">Required</TableHead>
                  <TableHead className="text-right">Shortfall</TableHead>
                  <TableHead>Required Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requirements.map((req) => (
                  <TableRow key={req.id} className="hover:bg-muted/50">
                    <TableCell>
                      {isSelectable(req) && (
                        <Checkbox
                          checked={selectedIds.includes(req.id)}
                          onCheckedChange={(checked) =>
                            handleSelectOne(req.id, checked as boolean)
                          }
                        />
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {req.requirementNumber}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{req.material?.code}</div>
                        <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                          {req.material?.name}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {req.order ? (
                        <div className="space-y-1">
                          <Button
                            variant="link"
                            size="sm"
                            className="p-0 h-auto font-medium"
                            onClick={() => navigate(`/orders/${req.orderId}`)}
                          >
                            {req.order.orderNumber}
                          </Button>
                          {req.orderBom && (
                            <div>
                              <Badge variant="outline" className="text-xs">
                                BOM v{req.orderBom.version}
                              </Badge>
                            </div>
                          )}
                        </div>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          {RequirementSourceLabels[req.source]}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {req.totalRequired.toLocaleString()} {req.unit}
                    </TableCell>
                    <TableCell
                      className={`text-right ${req.shortfall > 0 ? 'text-orange-600 font-medium' : 'text-green-600'}`}
                    >
                      {req.shortfall > 0
                        ? `${req.shortfall.toLocaleString()} ${req.unit}`
                        : 'Fulfilled'}
                    </TableCell>
                    <TableCell>
                      {new Date(req.requiredDate).toLocaleDateString('en-IN')}
                    </TableCell>
                    <TableCell>
                      <Badge className={MaterialRequirementStatusColors[req.status]}>
                        {MaterialRequirementStatusLabels[req.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {(req.status === StatusEnum.PENDING ||
                        req.status === StatusEnum.PO_REQUIRED ||
                        req.status === StatusEnum.PARTIAL_STOCK) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancelClick(req.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
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
            <DialogTitle>Generate Purchase Order</DialogTitle>
            <DialogDescription>
              Create a purchase order for {selectedIds.length} selected requirements.
              Materials will be consolidated by supplier.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier *</Label>
              <Select value={poSupplierId} onValueChange={setPOSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.code} - {s.name}
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
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="remarks">Remarks</Label>
              <Textarea
                id="remarks"
                value={poRemarks}
                onChange={(e) => setPORemarks(e.target.value)}
                placeholder="Optional notes for the PO..."
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
                  Generate PO
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vendor Allocation Dialog */}
      <VendorAllocationDialog
        open={showVendorAllocation}
        onOpenChange={setShowVendorAllocation}
        requirementIds={selectedIds}
        onComplete={() => {
          refreshRequirements();
          setSelectedIds([]);
        }}
      />

      {/* Bulk PO Generation Dialog */}
      <BulkPOGenerationDialog
        open={showBulkPOGeneration}
        onOpenChange={setShowBulkPOGeneration}
        requirementIds={selectedIds}
        onComplete={() => {
          refreshRequirements();
          setSelectedIds([]);
        }}
      />

      {/* Cancel Requirement Confirmation Dialog */}
      <ConfirmDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        title="Cancel Requirement"
        description="Are you sure you want to cancel this requirement? This action cannot be undone."
        confirmText="Cancel Requirement"
        cancelText="Keep"
        onConfirm={confirmCancelRequirement}
        variant="destructive"
      />
    </div>
  );
}
