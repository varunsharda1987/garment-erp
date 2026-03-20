/**
 * Unified Requirements Page
 * Two tabs:
 *   1. Material Requirements — only requirementType='MATERIAL' items
 *   2. Outsourced Work — PROCESSING items (from material_requirements) + SERVICE items (from work_order_service_requirements)
 */

import { useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useListQuery, queryKeys } from '@/hooks/useQuery';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import ConfirmDialog from '@/components/ConfirmDialog';
import VendorAllocationDialog from '@/components/VendorAllocationDialog';
import ProcessingAssignDialog from '@/components/ProcessingAssignDialog';
import BulkPOGenerationDialog from '@/components/BulkPOGenerationDialog';
import ProcessorAllocationDialog from '@/components/ProcessorAllocationDialog';
import BulkServicePODialog from '@/components/BulkServicePODialog';

// Services
import { getRequirements, generatePOFromRequirements, cancelRequirement, calculateRequirements, getDashboardStats as getMRPDashboardStats, getRequirementStyles, convertToGreigeProcessing } from '@/services/mrp.service';
import { getAllServiceRequirements, generateServicePO, getDashboardStats as getServiceDashboardStats } from '@/services/serviceRequirement.service';
import { getAllSuppliers } from '@/services/supplier.service';
import api from '@/lib/api';

// Types
import type { MaterialRequirement, RequirementFilters, MaterialRequirementStatus } from '@/types/mrp.types';
import {
  MaterialRequirementStatusColors,
  MaterialRequirementStatusLabels,
} from '@/types/mrp.types';
import type { ServiceRequirement, ServiceRequirementFilters, ServiceRequirementStatus } from '@/types/serviceRequirement.types';
import {
  ServiceRequirementStatusColors,
  ServiceRequirementStatusLabels,
  ServiceTypeLabels,
} from '@/types/serviceRequirement.types';
import type { MRPDashboardStats } from '@/types/mrp.types';
import type { ServiceDashboardStats } from '@/types/serviceRequirement.types';

// Utilities
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { formatCurrency } from '@/lib/currency';
import {
  FileText,
  RefreshCw,
  Package,
  Wrench,
  AlertTriangle,
  ClipboardCheck,
  Clock,
  IndianRupee,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

type RequirementTab = 'material' | 'outsourced';

export default function UnifiedRequirementsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const activeTab = (searchParams.get('tab') || 'material') as RequirementTab;

  // ─── Stats Queries ─────────────────────────────────────────

  const { data: mrpStats } = useListQuery<MRPDashboardStats>(
    [...queryKeys.mrp.all, 'dashboard-stats'],
    getMRPDashboardStats,
    { staleTime: 60 * 1000 }
  );

  const { data: serviceStats } = useListQuery<ServiceDashboardStats>(
    [...queryKeys.serviceRequirements.all, 'dashboard-stats'],
    getServiceDashboardStats,
    { staleTime: 60 * 1000 }
  );

  // Combined stats
  const totalRequirements = (mrpStats?.totalPendingRequirements || 0) + (mrpStats?.poInProgress || 0) + (mrpStats?.awaitingReceipt || 0) + (mrpStats?.processingRequirementsCount || 0) + (serviceStats?.totalServices || 0);
  const needsAssignment = (mrpStats?.requirementsNeedingPO || 0) + (mrpStats?.processingRequirementsCount || 0) + (serviceStats?.servicesWithoutProcessor || 0);
  const poGenerated = (mrpStats?.poInProgress || 0) + (serviceStats?.poGeneratedServices || 0);
  const overdueCount = (mrpStats?.overdueRequirements || 0);
  const estimatedValue = (serviceStats?.totalEstimatedCost || 0);

  // ─── Tab Switch ────────────────────────────────────────────

  const handleTabChange = (tab: string) => {
    const newParams = new URLSearchParams();
    newParams.set('tab', tab);
    setSearchParams(newParams, { replace: true });
  };

  const updateURLParams = useCallback((updates: Record<string, string | undefined>) => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) newParams.set(key, value);
      else newParams.delete(key);
    });
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  // ─── Render ────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6" />
          Procurement Requirements
        </h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: queryKeys.mrp.all });
              queryClient.invalidateQueries({ queryKey: queryKeys.serviceRequirements.all });
            }}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/orders')}>
            Calculate from Orders
          </Button>
        </div>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-xl font-bold">{totalRequirements}</p>
              </div>
              <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center">
                <FileText className="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Needs Assignment</p>
                <p className="text-xl font-bold text-orange-600">{needsAssignment}</p>
              </div>
              <div className="h-9 w-9 rounded-full bg-orange-100 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">PO Generated</p>
                <p className="text-xl font-bold text-green-600">{poGenerated}</p>
              </div>
              <div className="h-9 w-9 rounded-full bg-green-100 flex items-center justify-center">
                <ClipboardCheck className="h-4 w-4 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Overdue</p>
                <p className="text-xl font-bold text-red-600">{overdueCount}</p>
              </div>
              <div className="h-9 w-9 rounded-full bg-red-100 flex items-center justify-center">
                <Clock className="h-4 w-4 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Est. Service Cost</p>
                <p className="text-xl font-bold text-purple-600">{formatCurrency(estimatedValue)}</p>
              </div>
              <div className="h-9 w-9 rounded-full bg-purple-100 flex items-center justify-center">
                <IndianRupee className="h-4 w-4 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="material" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Material Requirements
            <Badge variant="secondary" className="ml-1 text-xs">
              {(mrpStats?.totalPendingRequirements || 0) + (mrpStats?.poInProgress || 0) + (mrpStats?.awaitingReceipt || 0)}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="outsourced" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Outsourced Work
            <Badge variant="secondary" className="ml-1 text-xs">
              {(mrpStats?.processingRequirementsCount || 0) + (serviceStats?.totalServices || 0)}
            </Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Tab Content */}
      {activeTab === 'material' ? (
        <MaterialRequirementsTab
          searchParams={searchParams}
          updateURLParams={updateURLParams}
        />
      ) : (
        <OutsourcedWorkTab
          searchParams={searchParams}
          updateURLParams={updateURLParams}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Material Requirements Tab (only MATERIAL type)
// ─────────────────────────────────────────────────────────────

function MaterialRequirementsTab({
  searchParams,
  updateURLParams,
}: {
  searchParams: URLSearchParams;
  updateURLParams: (updates: Record<string, string | undefined>) => void;
}) {
  const queryClient = useQueryClient();

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showVendorAllocation, setShowVendorAllocation] = useState(false);
  const [showBulkPOGeneration, setShowBulkPOGeneration] = useState(false);
  const [showGeneratePO, setShowGeneratePO] = useState(false);
  const [poSupplierId, setPOSupplierId] = useState('');
  const [poDeliveryDate, setPODeliveryDate] = useState('');
  const [poRemarks, setPORemarks] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [requirementToCancel, setRequirementToCancel] = useState<string | null>(null);
  const [recalcDialogOpen, setRecalcDialogOpen] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);

  // Convert to Greige Processing state
  const [convertGreigeDialogOpen, setConvertGreigeDialogOpen] = useState(false);
  const [convertingRequirement, setConvertingRequirement] = useState<MaterialRequirement | null>(null);
  const [greigeSearch, setGreigeSearch] = useState('');
  const [greigeOptions, setGreigeOptions] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [selectedGreigeId, setSelectedGreigeId] = useState('');
  const [processorOptions, setProcessorOptions] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [selectedProcessorId, setSelectedProcessorId] = useState('');
  const [processingCostInput, setProcessingCostInput] = useState('');
  const [isConverting, setIsConverting] = useState(false);

  // Filters — hard-code requirementType to MATERIAL
  const filters = useMemo((): RequirementFilters => ({
    orderId: searchParams.get('orderId') || undefined,
    status: searchParams.get('status')?.split(',') as MaterialRequirementStatus[] | undefined,
    supplierId: searchParams.get('supplierId') || undefined,
    styleId: searchParams.get('styleId') || undefined,
    requirementType: 'MATERIAL',
    search: searchParams.get('search') || undefined,
    page: parseInt(searchParams.get('page') || '1'),
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  }), [searchParams]);

  // Queries
  const { data: requirementsResponse, isLoading } = useListQuery(
    queryKeys.mrp.list({ ...filters } as Record<string, unknown>),
    () => getRequirements(filters),
    { staleTime: 30 * 1000 }
  );

  const { data: suppliersResponse } = useListQuery(
    queryKeys.suppliers.list({ limit: 100 }),
    () => getAllSuppliers({ limit: 100 }),
    { staleTime: 5 * 60 * 1000 }
  );

  const { data: stylesForFilter } = useQuery({
    queryKey: [...queryKeys.mrp.all, 'requirement-styles', 'MATERIAL'],
    queryFn: () => getRequirementStyles('MATERIAL'),
    staleTime: 5 * 60 * 1000,
  });

  const requirements = requirementsResponse?.data || [];
  const pagination = requirementsResponse?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 };
  const suppliers = (suppliersResponse as any)?.data || [];
  const styleOptions = stylesForFilter || [];

  // Selection helpers
  const selectableRequirements = useMemo(
    () => requirements.filter((r) => r.status === 'PO_REQUIRED' || r.status === 'PARTIAL_STOCK'),
    [requirements]
  );

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? selectableRequirements.map((r) => r.id) : []);
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => checked ? [...prev, id] : prev.filter((i) => i !== id));
  };

  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.mrp.all });
    setSelectedIds([]);
  };

  // Manual PO generation
  const handleGeneratePO = async () => {
    if (!poSupplierId || !poDeliveryDate || selectedIds.length === 0) return;
    setIsGenerating(true);
    try {
      const result = await generatePOFromRequirements({
        requirementIds: selectedIds,
        supplierId: poSupplierId,
        expectedDeliveryDate: poDeliveryDate,
        remarks: poRemarks || undefined,
        consolidate: true,
      });
      handleApiSuccess('PO Generated', `PO ${result.purchaseOrder.poNumber} created with ${result.totalItems} items`);
      setShowGeneratePO(false);
      setPOSupplierId('');
      setPODeliveryDate('');
      setPORemarks('');
      refreshData();
    } catch (err) {
      handleApiError(err, 'Failed to generate PO');
    } finally {
      setIsGenerating(false);
    }
  };

  const confirmCancelRequirement = async () => {
    if (!requirementToCancel) return;
    try {
      await cancelRequirement(requirementToCancel);
      handleApiSuccess('Requirement cancelled');
      refreshData();
    } catch (err) {
      handleApiError(err, 'Failed to cancel requirement');
    } finally {
      setRequirementToCancel(null);
      setCancelDialogOpen(false);
    }
  };

  // Convert to Greige Processing handlers
  const openConvertGreigeDialog = async (req: MaterialRequirement) => {
    setConvertingRequirement(req);
    setSelectedGreigeId('');
    setSelectedProcessorId('');
    setProcessingCostInput('');
    setConvertGreigeDialogOpen(true);

    // Fetch greige options and processors in parallel
    try {
      const [greigeRes, processorRes] = await Promise.all([
        api.get('/fabric-management/greige', { params: { limit: 50 } }),
        api.get('/mrp/processing-assignment/processors'),
      ]);
      setGreigeOptions((greigeRes.data?.data || []).map((g: any) => ({ id: g.id, name: g.genericName || g.name || g.code, code: g.code })));
      setProcessorOptions((processorRes.data?.data || []).map((p: any) => ({ id: p.id, name: p.name, code: p.code })));
    } catch {
      // Silently handle — user can still type IDs
    }
  };

  const handleConvertToGreige = async () => {
    if (!convertingRequirement || !selectedGreigeId || !selectedProcessorId) return;
    setIsConverting(true);
    try {
      await convertToGreigeProcessing(convertingRequirement.id, {
        processorId: selectedProcessorId,
        greigeId: selectedGreigeId,
        processingCost: processingCostInput ? Number(processingCostInput) : undefined,
      });
      handleApiSuccess('Converted to GREIGE + PROCESSING workflow');
      refreshData();
      setConvertGreigeDialogOpen(false);
      setConvertingRequirement(null);
    } catch (err) {
      handleApiError(err, 'Failed to convert requirement');
    } finally {
      setIsConverting(false);
    }
  };

  // Re-calculate MRP for the filtered order(s)
  const handleRecalculateMRP = async () => {
    const orderIds = [...new Set(requirements.map((r) => r.orderId).filter(Boolean))] as string[];
    if (orderIds.length === 0) return;

    setIsRecalculating(true);
    setRecalcDialogOpen(false);
    try {
      const requiredDate = new Date();
      requiredDate.setDate(requiredDate.getDate() + 30);

      for (const orderId of orderIds) {
        await calculateRequirements({
          orderId,
          requiredDate: requiredDate.toISOString().split('T')[0],
          checkStock: true,
        });
      }
      handleApiSuccess('MRP Re-calculated', `Requirements recalculated for ${orderIds.length} order(s). Fabric/greige requirements should now appear.`);
      refreshData();
    } catch (err) {
      handleApiError(err, 'Failed to re-calculate MRP');
    } finally {
      setIsRecalculating(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <>
      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {filters.styleId && selectableRequirements.length > 0 && selectedIds.length === 0 && (
            <Button
              size="sm"
              variant="outline"
              className="border-purple-300 text-purple-700 hover:bg-purple-50"
              onClick={() => setSelectedIds(selectableRequirements.map((r) => r.id))}
            >
              Select All for Style ({selectableRequirements.length})
            </Button>
          )}
          {requirements.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRecalcDialogOpen(true)}
              disabled={isRecalculating}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isRecalculating ? 'animate-spin' : ''}`} />
              {isRecalculating ? 'Re-calculating...' : 'Re-calculate MRP'}
            </Button>
          )}
          {selectedIds.length > 0 && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="border-orange-300 text-orange-700 hover:bg-orange-50"
                onClick={() => setShowVendorAllocation(true)}
              >
                Assign Vendors ({selectedIds.length})
              </Button>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => setShowBulkPOGeneration(true)}
              >
                Bulk Generate POs ({selectedIds.length})
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowGeneratePO(true)}
              >
                Manual PO
              </Button>
            </>
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          {selectedIds.length > 0 && (
            <span className="text-primary font-medium">{selectedIds.length} selected</span>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search by material, order, style..."
                value={searchParams.get('search') || ''}
                onChange={(e) => updateURLParams({ search: e.target.value || undefined, page: undefined })}
              />
            </div>

            <Select
              value={searchParams.get('status') || 'all'}
              onValueChange={(v) => updateURLParams({ status: v === 'all' ? undefined : v, page: undefined })}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {Object.entries(MaterialRequirementStatusLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={searchParams.get('supplierId') || 'all'}
              onValueChange={(v) => updateURLParams({ supplierId: v === 'all' ? undefined : v, page: undefined })}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Suppliers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Suppliers</SelectItem>
                {suppliers.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={searchParams.get('styleId') || 'all'}
              onValueChange={(v) => updateURLParams({ styleId: v === 'all' ? undefined : v, page: undefined })}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Styles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Styles</SelectItem>
                {styleOptions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.styleCode} — {s.styleName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results summary */}
      <div className="text-sm text-muted-foreground px-1">
        Showing {requirements.length} of {pagination.total} requirements
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={selectableRequirements.length > 0 && selectedIds.length === selectableRequirements.length}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Requirement #</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Style</TableHead>
                <TableHead>Order</TableHead>
                <TableHead className="text-right">Required</TableHead>
                <TableHead className="text-right">Shortfall</TableHead>
                <TableHead>Required Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                    Loading requirements...
                  </TableCell>
                </TableRow>
              ) : requirements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                    No material requirements found
                  </TableCell>
                </TableRow>
              ) : (
                requirements.map((req) => {
                  const isSelectable = req.status === 'PO_REQUIRED' || req.status === 'PARTIAL_STOCK';
                  return (
                    <TableRow key={req.id}>
                      <TableCell>
                        {isSelectable && (
                          <Checkbox
                            checked={selectedIds.includes(req.id)}
                            onCheckedChange={(checked) => handleSelectOne(req.id, !!checked)}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{req.requirementNumber}</TableCell>
                      <TableCell>
                        <div>
                          <div className="text-sm font-medium">{req.material?.name || 'N/A'}</div>
                          <div className="text-xs text-muted-foreground">{req.material?.code}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="text-sm font-medium">{req.orderItem?.styleName || '-'}</div>
                          {req.orderItem?.styleCode && (
                            <div className="text-xs text-muted-foreground">{req.orderItem.styleCode}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{req.order?.orderNumber || '-'}</div>
                        {req.orderBom && <div className="text-xs text-muted-foreground">BOM v{req.orderBom.version}</div>}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {req.totalRequired} {req.unit}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`text-sm font-medium ${req.shortfall > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                          {req.shortfall > 0 ? req.shortfall : 'Fulfilled'}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(req.requiredDate)}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${MaterialRequirementStatusColors[req.status]}`}>
                          {MaterialRequirementStatusLabels[req.status]}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{req.preferredSupplier?.name || 'Not Assigned'}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          {req.shortfall > 0 && req.material?.materialType === 'FABRIC' && !req.material?.fabricId && (req.status === 'PO_REQUIRED' || req.status === 'PARTIAL_STOCK') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-blue-600 hover:text-blue-800 text-xs"
                              onClick={() => openConvertGreigeDialog(req)}
                            >
                              Greige Process
                            </Button>
                          )}
                          {(req.status === 'PENDING' || req.status === 'PO_REQUIRED') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-800"
                              onClick={() => { setRequirementToCancel(req.id); setCancelDialogOpen(true); }}
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page <= 1}
            onClick={() => updateURLParams({ page: String(pagination.page - 1) })}
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => updateURLParams({ page: String(pagination.page + 1) })}
          >
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

      {/* Dialogs */}
      <VendorAllocationDialog
        open={showVendorAllocation}
        onOpenChange={setShowVendorAllocation}
        requirementIds={selectedIds}
        onComplete={refreshData}
      />

      <BulkPOGenerationDialog
        open={showBulkPOGeneration}
        onOpenChange={setShowBulkPOGeneration}
        requirementIds={selectedIds}
        onComplete={refreshData}
      />

      <ConfirmDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        title="Cancel Requirement"
        description="Are you sure you want to cancel this requirement? This cannot be undone."
        confirmText="Cancel Requirement"
        cancelText="Keep"
        onConfirm={confirmCancelRequirement}
        variant="destructive"
      />

      <ConfirmDialog
        open={recalcDialogOpen}
        onOpenChange={setRecalcDialogOpen}
        title="Re-calculate MRP"
        description="This will re-calculate all material requirements for the displayed order(s). Existing non-final requirements will be refreshed. Any missing fabric/greige requirements will be created."
        confirmText="Re-calculate"
        cancelText="Cancel"
        onConfirm={handleRecalculateMRP}
      />

      {/* Manual PO Generation Dialog */}
      <Dialog open={showGeneratePO} onOpenChange={setShowGeneratePO}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Purchase Order</DialogTitle>
            <DialogDescription>
              Create a PO for {selectedIds.length} selected requirement(s)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Supplier</Label>
              <Select value={poSupplierId} onValueChange={setPOSupplierId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Expected Delivery Date</Label>
              <Input
                type="date"
                value={poDeliveryDate}
                onChange={(e) => setPODeliveryDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Remarks (Optional)</Label>
              <Textarea
                value={poRemarks}
                onChange={(e) => setPORemarks(e.target.value)}
                placeholder="Any notes..."
                className="mt-1"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGeneratePO(false)}>Cancel</Button>
            <Button
              onClick={handleGeneratePO}
              disabled={!poSupplierId || !poDeliveryDate || isGenerating}
            >
              {isGenerating ? 'Generating...' : 'Generate PO'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert to Greige Processing Dialog */}
      <Dialog open={convertGreigeDialogOpen} onOpenChange={setConvertGreigeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert to Greige Processing</DialogTitle>
            <DialogDescription>
              Convert the shortfall of {convertingRequirement?.shortfall || 0} {convertingRequirement?.unit || 'units'} to greige procurement + processing workflow.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Greige Fabric</Label>
              <Select value={selectedGreigeId} onValueChange={setSelectedGreigeId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select greige fabric" />
                </SelectTrigger>
                <SelectContent>
                  {greigeOptions.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name} ({g.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Processor</Label>
              <Select value={selectedProcessorId} onValueChange={setSelectedProcessorId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select processor" />
                </SelectTrigger>
                <SelectContent>
                  {processorOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} ({p.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Processing Cost (per unit, optional)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="e.g. 45.00"
                value={processingCostInput}
                onChange={(e) => setProcessingCostInput(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertGreigeDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleConvertToGreige}
              disabled={!selectedGreigeId || !selectedProcessorId || isConverting}
            >
              {isConverting ? 'Converting...' : 'Convert to Greige'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Outsourced Work Tab (Processing + Service)
// ─────────────────────────────────────────────────────────────

type OutsourcedSource = 'all' | 'processing' | 'service';

/** Unified row shape for both processing and service requirements */
interface OutsourcedRow {
  id: string;
  rowKey: string; // prefixed: 'proc-{id}' or 'svc-{id}'
  source: 'PROCESSING' | 'SERVICE';
  style: string; // Style code or name
  workType: string; // e.g. "Dyeing", "Embroidery"
  printingType?: string | null; // e.g. PIGMENT, PROCIAN, DISCHARGE
  reference: string; // Order # or Work Order #
  referenceLink?: string; // navigation path
  processor: string;
  processorAssigned: boolean;
  quantity: string; // "100 MTR"
  cost: number | null;
  status: string;
  statusColor: string;
  statusLabel: string;
  isSelectable: boolean;
  createdAt: string;
  // Original data references for bulk operations
  originalProcessing?: MaterialRequirement;
  originalService?: ServiceRequirement;
}

function OutsourcedWorkTab({
  searchParams,
  updateURLParams,
}: {
  searchParams: URLSearchParams;
  updateURLParams: (updates: Record<string, string | undefined>) => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Sub-filter: all / processing / service
  const sourceFilter = (searchParams.get('source') || 'all') as OutsourcedSource;

  // Selection state — track separately by type
  const [selectedProcessingIds, setSelectedProcessingIds] = useState<string[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);

  // Dialog states — Processing
  const [showProcessingAssign, setShowProcessingAssign] = useState(false);
  const [showBulkPOGeneration, setShowBulkPOGeneration] = useState(false);
  const [showGenerateProcessingPO, setShowGenerateProcessingPO] = useState(false);
  const [procPOSupplierId, setProcPOSupplierId] = useState('');
  const [procPODeliveryDate, setProcPODeliveryDate] = useState('');
  const [procPORemarks, setProcPORemarks] = useState('');

  // Dialog states — Service
  const [showProcessorAllocation, setShowProcessorAllocation] = useState(false);
  const [showBulkServicePO, setShowBulkServicePO] = useState(false);
  const [showGenerateServicePO, setShowGenerateServicePO] = useState(false);
  const [svcPOProcessorId, setSvcPOProcessorId] = useState('');
  const [svcPODeliveryDate, setSvcPODeliveryDate] = useState('');
  const [svcPORemarks, setSvcPORemarks] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);

  const page = parseInt(searchParams.get('page') || '1');
  const statusFilter = searchParams.get('status') || undefined;
  const searchFilter = searchParams.get('search') || undefined;
  const processorIdFilter = searchParams.get('processorId') || undefined;

  // ─── Data Fetching ─────────────────────────────────────────

  // Processing requirements (from MRP with requirementType=PROCESSING)
  const orderIdFilter = searchParams.get('orderId') || undefined;
  const workOrderIdFilter = searchParams.get('workOrderId') || undefined;

  const processingFilters = useMemo((): RequirementFilters => ({
    requirementType: 'PROCESSING',
    orderId: orderIdFilter,
    status: statusFilter?.split(',') as MaterialRequirementStatus[] | undefined,
    search: searchFilter,
    page,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  }), [statusFilter, searchFilter, orderIdFilter, page]);

  const { data: processingResponse, isLoading: processingLoading } = useQuery({
    queryKey: [...queryKeys.mrp.all, 'processing-list', processingFilters],
    queryFn: () => getRequirements(processingFilters),
    staleTime: 30 * 1000,
    enabled: sourceFilter === 'all' || sourceFilter === 'processing',
  });

  // Service requirements (from service-requirements/list)
  const serviceFilters = useMemo((): ServiceRequirementFilters => ({
    orderId: orderIdFilter,
    workOrderId: workOrderIdFilter,
    status: statusFilter?.split(',') as ServiceRequirementStatus[] | undefined,
    processorId: processorIdFilter,
    search: searchFilter,
    page,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  }), [statusFilter, searchFilter, processorIdFilter, orderIdFilter, workOrderIdFilter, page]);

  const { data: serviceResponse, isLoading: serviceLoading } = useQuery({
    queryKey: [...queryKeys.serviceRequirements.all, 'service-list', serviceFilters],
    queryFn: () => getAllServiceRequirements(serviceFilters),
    staleTime: 30 * 1000,
    enabled: sourceFilter === 'all' || sourceFilter === 'service',
  });

  // Suppliers list for dialogs
  const { data: suppliersResponse } = useListQuery(
    queryKeys.suppliers.list({ limit: 100 }),
    () => getAllSuppliers({ limit: 100 }),
    { staleTime: 5 * 60 * 1000 }
  );
  const suppliers = (suppliersResponse as any)?.data || [];

  const isLoading = (sourceFilter !== 'service' && processingLoading) || (sourceFilter !== 'processing' && serviceLoading);

  // ─── Normalize to OutsourcedRow ────────────────────────────

  const rows = useMemo((): OutsourcedRow[] => {
    const result: OutsourcedRow[] = [];

    // Processing items
    if (sourceFilter !== 'service') {
      const processingItems = processingResponse?.data || [];
      for (const req of processingItems) {
        result.push({
          id: req.id,
          rowKey: `proc-${req.id}`,
          source: 'PROCESSING',
          style: req.orderItem?.styleName || '-',
          workType: req.material?.name || 'Processing',
          printingType: req.printingType || null,
          reference: req.order?.orderNumber || '-',
          referenceLink: req.orderId ? `/orders/${req.orderId}` : undefined,
          processor: req.processor?.name || req.preferredSupplier?.name || 'Not Assigned',
          processorAssigned: !!(req.processorId || req.preferredSupplierId),
          quantity: `${req.totalRequired} ${req.unit}`,
          cost: req.processingCost ?? null,
          status: req.status,
          statusColor: MaterialRequirementStatusColors[req.status] || 'bg-gray-100 text-gray-800',
          statusLabel: MaterialRequirementStatusLabels[req.status] || req.status,
          isSelectable: req.status === 'PO_REQUIRED' || req.status === 'PARTIAL_STOCK',
          createdAt: req.createdAt,
          originalProcessing: req,
        });
      }
    }

    // Service items
    if (sourceFilter !== 'processing') {
      const serviceItems = serviceResponse?.data || [];
      for (const req of serviceItems) {
        result.push({
          id: req.id,
          rowKey: `svc-${req.id}`,
          source: 'SERVICE',
          style: (req.workOrder as any)?.styles?.styleCode || (req.workOrder as any)?.styles?.styleName || '-',
          workType: ServiceTypeLabels[req.serviceType] || req.serviceType,
          reference: req.workOrder?.workOrderNumber || '-',
          referenceLink: req.workOrderId ? `/work-orders/${req.workOrderId}` : undefined,
          processor: req.assignedProcessor?.supplierName || req.preferredProcessor?.supplierName || 'Not Assigned',
          processorAssigned: !!(req.assignedProcessorId || req.preferredProcessorId),
          quantity: `${req.quantityRequired} ${req.unit}`,
          cost: req.estimatedTotal ?? null,
          status: req.status,
          statusColor: ServiceRequirementStatusColors[req.status] || 'bg-gray-100 text-gray-800',
          statusLabel: ServiceRequirementStatusLabels[req.status] || req.status,
          isSelectable: req.status === 'PENDING',
          createdAt: req.createdAt,
          originalService: req,
        });
      }
    }

    // Sort by createdAt descending when showing both
    if (sourceFilter === 'all') {
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return result;
  }, [processingResponse, serviceResponse, sourceFilter]);

  // Pagination: when viewing a single source, use server pagination; when "all", show merged results
  const pagination = useMemo(() => {
    if (sourceFilter === 'processing') {
      return processingResponse?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 };
    }
    if (sourceFilter === 'service') {
      return serviceResponse?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 };
    }
    // "all" — combine totals (client-side merge)
    const procTotal = processingResponse?.pagination?.total || 0;
    const svcTotal = serviceResponse?.pagination?.total || 0;
    const total = procTotal + svcTotal;
    return { page, limit: 40, total, totalPages: Math.max(processingResponse?.pagination?.totalPages || 1, serviceResponse?.pagination?.totalPages || 1) };
  }, [sourceFilter, processingResponse, serviceResponse, page]);

  // Selection helpers
  const selectableRows = useMemo(() => rows.filter((r) => r.isSelectable), [rows]);
  const allSelectedIds = [...selectedProcessingIds, ...selectedServiceIds];
  const hasProcessingSelected = selectedProcessingIds.length > 0;
  const hasServiceSelected = selectedServiceIds.length > 0;
  const hasMixedSelection = hasProcessingSelected && hasServiceSelected;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const procIds = selectableRows.filter((r) => r.source === 'PROCESSING').map((r) => r.id);
      const svcIds = selectableRows.filter((r) => r.source === 'SERVICE').map((r) => r.id);
      setSelectedProcessingIds(procIds);
      setSelectedServiceIds(svcIds);
    } else {
      setSelectedProcessingIds([]);
      setSelectedServiceIds([]);
    }
  };

  const handleSelectOne = (row: OutsourcedRow, checked: boolean) => {
    if (row.source === 'PROCESSING') {
      setSelectedProcessingIds((prev) => checked ? [...prev, row.id] : prev.filter((i) => i !== row.id));
    } else {
      setSelectedServiceIds((prev) => checked ? [...prev, row.id] : prev.filter((i) => i !== row.id));
    }
  };

  const isSelected = (row: OutsourcedRow) => {
    return row.source === 'PROCESSING'
      ? selectedProcessingIds.includes(row.id)
      : selectedServiceIds.includes(row.id);
  };

  const clearSelection = () => {
    setSelectedProcessingIds([]);
    setSelectedServiceIds([]);
  };

  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.mrp.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.serviceRequirements.all });
    clearSelection();
  };

  // ─── Manual PO handlers ────────────────────────────────────

  const handleGenerateProcessingPO = async () => {
    if (!procPOSupplierId || !procPODeliveryDate || selectedProcessingIds.length === 0) return;
    setIsGenerating(true);
    try {
      const result = await generatePOFromRequirements({
        requirementIds: selectedProcessingIds,
        supplierId: procPOSupplierId,
        expectedDeliveryDate: procPODeliveryDate,
        remarks: procPORemarks || undefined,
        consolidate: true,
      });
      handleApiSuccess('PO Generated', `PO ${result.purchaseOrder.poNumber} created with ${result.totalItems} items`);
      setShowGenerateProcessingPO(false);
      setProcPOSupplierId('');
      setProcPODeliveryDate('');
      setProcPORemarks('');
      refreshData();
    } catch (err) {
      handleApiError(err, 'Failed to generate Processing PO');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateServicePOAction = async () => {
    if (!svcPOProcessorId || !svcPODeliveryDate || selectedServiceIds.length === 0) return;
    setIsGenerating(true);
    try {
      const result = await generateServicePO({
        processorId: svcPOProcessorId,
        requirementIds: selectedServiceIds,
        expectedDeliveryDate: svcPODeliveryDate,
        remarks: svcPORemarks || undefined,
      });
      handleApiSuccess('Service PO Generated', `PO ${result.purchaseOrder.poNumber} created`);
      setShowGenerateServicePO(false);
      setSvcPOProcessorId('');
      setSvcPODeliveryDate('');
      setSvcPORemarks('');
      refreshData();
    } catch (err) {
      handleApiError(err, 'Failed to generate Service PO');
    } finally {
      setIsGenerating(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <>
      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {hasMixedSelection ? (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-orange-600 border-orange-300 py-1">
                Select items of the same type for bulk actions
              </Badge>
              <Button size="sm" variant="ghost" onClick={clearSelection}>Clear</Button>
            </div>
          ) : hasProcessingSelected ? (
            <>
              <Button
                size="sm"
                variant="outline"
                className="border-purple-300 text-purple-700 hover:bg-purple-50"
                onClick={() => setShowProcessingAssign(true)}
              >
                Assign Processors ({selectedProcessingIds.length})
              </Button>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => setShowBulkPOGeneration(true)}
              >
                Bulk Generate POs ({selectedProcessingIds.length})
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowGenerateProcessingPO(true)}
              >
                Manual PO
              </Button>
            </>
          ) : hasServiceSelected ? (
            <>
              <Button
                size="sm"
                variant="outline"
                className="border-purple-300 text-purple-700 hover:bg-purple-50"
                onClick={() => setShowProcessorAllocation(true)}
              >
                Assign Processors ({selectedServiceIds.length})
              </Button>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => setShowBulkServicePO(true)}
              >
                Bulk Generate POs ({selectedServiceIds.length})
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowGenerateServicePO(true)}
              >
                Manual Service PO
              </Button>
            </>
          ) : null}
        </div>
        <div className="text-sm text-muted-foreground">
          {allSelectedIds.length > 0 && (
            <span className="text-primary font-medium">{allSelectedIds.length} selected</span>
          )}
        </div>
      </div>

      {/* Sub-filter chips + Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          {/* Source sub-filter chips */}
          <div className="flex gap-2 mb-3">
            {(['all', 'processing', 'service'] as const).map((src) => (
              <Button
                key={src}
                size="sm"
                variant={sourceFilter === src ? 'default' : 'outline'}
                onClick={() => {
                  clearSelection();
                  updateURLParams({ source: src === 'all' ? undefined : src, page: undefined });
                }}
              >
                {src === 'all' ? 'All' : src === 'processing' ? 'Processing' : 'Service'}
                {src === 'processing' && processingResponse?.pagination?.total != null && (
                  <Badge variant="secondary" className="ml-1 text-xs">{processingResponse.pagination.total}</Badge>
                )}
                {src === 'service' && serviceResponse?.pagination?.total != null && (
                  <Badge variant="secondary" className="ml-1 text-xs">{serviceResponse.pagination.total}</Badge>
                )}
              </Button>
            ))}
          </div>

          {/* Search + filters */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search by material, work order, service..."
                value={searchParams.get('search') || ''}
                onChange={(e) => updateURLParams({ search: e.target.value || undefined, page: undefined })}
              />
            </div>

            <Select
              value={searchParams.get('status') || 'all'}
              onValueChange={(v) => updateURLParams({ status: v === 'all' ? undefined : v, page: undefined })}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {/* Show combined status options */}
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="PO_REQUIRED">PO Required</SelectItem>
                <SelectItem value="PO_GENERATED">PO Generated</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={searchParams.get('processorId') || 'all'}
              onValueChange={(v) => updateURLParams({ processorId: v === 'all' ? undefined : v, page: undefined })}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Processors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Processors</SelectItem>
                {suppliers.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results summary */}
      <div className="text-sm text-muted-foreground px-1">
        Showing {rows.length} outsourced work items
        {pagination.total > 0 && ` (${pagination.total} total)`}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={selectableRows.length > 0 && allSelectedIds.length === selectableRows.length}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Style</TableHead>
                <TableHead>Work Type</TableHead>
                <TableHead>Printing Type</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Processor / Vendor</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Est. Cost</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                    Loading outsourced work items...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                    No outsourced work items found
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.rowKey}>
                    <TableCell>
                      {row.isSelectable && (
                        <Checkbox
                          checked={isSelected(row)}
                          onCheckedChange={(checked) => handleSelectOne(row, !!checked)}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={row.source === 'PROCESSING' ? 'border-purple-300 text-purple-700 bg-purple-50' : 'border-teal-300 text-teal-700 bg-teal-50'}
                      >
                        {row.source === 'PROCESSING' ? 'Processing' : 'Service'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">{row.style}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">{row.workType}</span>
                    </TableCell>
                    <TableCell>
                      {row.printingType ? (
                        <span className="text-sm font-semibold text-purple-700">
                          {row.printingType.replace('_', ' ')}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.referenceLink ? (
                        <button
                          className="text-sm text-blue-600 hover:underline font-medium"
                          onClick={() => navigate(row.referenceLink!)}
                        >
                          {row.reference}
                        </button>
                      ) : (
                        <span className="text-sm">{row.reference}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`text-sm ${row.processorAssigned ? '' : 'text-orange-600'}`}>
                        {row.processor}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-sm">{row.quantity}</TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-medium text-purple-700">
                        {row.cost != null ? formatCurrency(row.cost) : '-'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${row.statusColor}`}>
                        {row.statusLabel}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(row.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page <= 1}
            onClick={() => updateURLParams({ page: String(pagination.page - 1) })}
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => updateURLParams({ page: String(pagination.page + 1) })}
          >
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

      {/* ─── Processing Dialogs ──────────────────────────────── */}
      <ProcessingAssignDialog
        open={showProcessingAssign}
        onOpenChange={setShowProcessingAssign}
        requirementIds={selectedProcessingIds}
        onComplete={refreshData}
      />

      <BulkPOGenerationDialog
        open={showBulkPOGeneration}
        onOpenChange={setShowBulkPOGeneration}
        requirementIds={selectedProcessingIds}
        onComplete={refreshData}
      />

      {/* Manual Processing PO Dialog */}
      <Dialog open={showGenerateProcessingPO} onOpenChange={setShowGenerateProcessingPO}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Processing PO</DialogTitle>
            <DialogDescription>
              Create a PO for {selectedProcessingIds.length} selected processing requirement(s)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Supplier / Processor</Label>
              <Select value={procPOSupplierId} onValueChange={setProcPOSupplierId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Expected Delivery Date</Label>
              <Input
                type="date"
                value={procPODeliveryDate}
                onChange={(e) => setProcPODeliveryDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Remarks (Optional)</Label>
              <Textarea
                value={procPORemarks}
                onChange={(e) => setProcPORemarks(e.target.value)}
                placeholder="Any notes..."
                className="mt-1"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateProcessingPO(false)}>Cancel</Button>
            <Button
              onClick={handleGenerateProcessingPO}
              disabled={!procPOSupplierId || !procPODeliveryDate || isGenerating}
            >
              {isGenerating ? 'Generating...' : 'Generate PO'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Service Dialogs ─────────────────────────────────── */}
      <ProcessorAllocationDialog
        open={showProcessorAllocation}
        onOpenChange={setShowProcessorAllocation}
        requirementIds={selectedServiceIds}
        onComplete={refreshData}
      />

      <BulkServicePODialog
        open={showBulkServicePO}
        onOpenChange={setShowBulkServicePO}
        requirementIds={selectedServiceIds}
        onComplete={refreshData}
      />

      {/* Manual Service PO Dialog */}
      <Dialog open={showGenerateServicePO} onOpenChange={setShowGenerateServicePO}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Service PO</DialogTitle>
            <DialogDescription>
              Create a service PO for {selectedServiceIds.length} selected service requirement(s)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Processor</Label>
              <Select value={svcPOProcessorId} onValueChange={setSvcPOProcessorId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select processor" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Expected Delivery Date</Label>
              <Input
                type="date"
                value={svcPODeliveryDate}
                onChange={(e) => setSvcPODeliveryDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Remarks (Optional)</Label>
              <Textarea
                value={svcPORemarks}
                onChange={(e) => setSvcPORemarks(e.target.value)}
                placeholder="Any notes..."
                className="mt-1"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateServicePO(false)}>Cancel</Button>
            <Button
              onClick={handleGenerateServicePOAction}
              disabled={!svcPOProcessorId || !svcPODeliveryDate || isGenerating}
            >
              {isGenerating ? 'Generating...' : 'Generate Service PO'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
