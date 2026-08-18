/**
 * Unified Requirements Page
 * Three tabs:
 *   1. Material Requirements — only requirementType='MATERIAL' items
 *   2. Outsourced Work — PROCESSING items (from material_requirements) + SERVICE items (from work_order_service_requirements)
 *   3. Thread Requirements — order_thread_requirements
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useListQuery, queryKeys } from '@/hooks/useQuery';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import ConfirmDialog from '@/components/ConfirmDialog';
import VendorAllocationDialog from '@/components/VendorAllocationDialog';
import ProcessingAssignDialog from '@/components/ProcessingAssignDialog';
import BulkPOGenerationDialog from '@/components/BulkPOGenerationDialog';
import ProcessorAllocationDialog from '@/components/ProcessorAllocationDialog';
import BulkServicePODialog from '@/components/BulkServicePODialog';
import OrderThreadRequirementForm from '@/components/thread/OrderThreadRequirementForm';
import { Combobox } from '@/components/ui/combobox';

// Services
import {
  getRequirements,
  generatePOFromRequirements,
  cancelRequirement,
  calculateRequirements,
  getDashboardStats as getMRPDashboardStats,
  getRequirementStyles,
  convertToGreigeProcessing,
  previewPOs,
} from '@/services/mrp.service';
import {
  getAllServiceRequirements,
  generateServiceJWOs,
  getDashboardStats as getServiceDashboardStats,
} from '@/services/serviceRequirement.service';
import {
  getAllThreadRequirements,
  getThreadRequirementStats,
  generateThreadPO,
  getAvailableSuppliers as getThreadSuppliers,
} from '@/services/threadRequirement.service';
import { getAllSuppliers } from '@/services/supplier.service';
import { workOrderService } from '@/services/workOrder.service';
import { getProcessorSuppliers } from '@/services/vendorSuggestion.service';
import { useDebounce } from '@/hooks/useDebounce';
import { getAllOrders } from '@/services/order.service';
import type { Supplier } from '@/types/supplier.types';
import type {
  ThreadRequirementStatus,
  ThreadRequirementStats,
  PaginatedThreadRequirements,
} from '@/types/thread.types';
import {
  THREAD_REQUIREMENT_STATUS_LABELS,
  THREAD_PLY_LABELS,
  THREAD_MATERIAL_LABELS,
  THREAD_PACKAGING_LABELS,
} from '@/types/thread.types';
import api from '@/lib/api';

// Types
import type { MaterialRequirement, RequirementFilters, MaterialRequirementStatus } from '@/types/mrp.types';
import { MaterialRequirementStatusColors, MaterialRequirementStatusLabels } from '@/types/mrp.types';
import type {
  ServiceRequirement,
  ServiceRequirementFilters,
  ServiceRequirementStatus,
} from '@/types/serviceRequirement.types';
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
import { formatQuantity } from '@/lib/formatters';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  CheckCircle2,
  ArrowRight,
  X,
  Scissors,
  Plus,
  Download,
} from 'lucide-react';

type RequirementTab = 'material' | 'outsourced' | 'thread';

/**
 * MRP-43: search boxes on this page wrote straight to the URL on every keystroke, and the URL is
 * the query key — so typing "cotton" fired six list requests, each joining a dozen relations per
 * row (twelve on the Outsourced "all" view, which queries two backends). This keeps the input
 * responsive locally and pushes to the URL once the user pauses.
 *
 * Returns the live input value plus its setter; the URL (and therefore the query) follows.
 */
function useDebouncedSearchParam(
  searchParams: URLSearchParams,
  updateURLParams: (updates: Record<string, string | undefined>) => void,
  delay = 350
) {
  const urlSearch = searchParams.get('search') || '';
  const [value, setValue] = useState(urlSearch);
  const debounced = useDebounce(value, delay);

  // Adopt changes made to the URL elsewhere (tab switch clears it, a deep link arrives with one).
  useEffect(() => {
    setValue((current) => (current === urlSearch ? current : urlSearch));
  }, [urlSearch]);

  useEffect(() => {
    if (debounced !== urlSearch) {
      updateURLParams({ search: debounced || undefined, page: undefined });
    }
    // updateURLParams identity changes with searchParams; depending on it would re-push loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return [value, setValue] as const;
}

export default function UnifiedRequirementsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // MRP-37: an unrecognised ?tab= used to fall through the render ternary and silently show the
  // Outsourced tab. Validate against the union and fall back to the default instead.
  const TAB_VALUES: RequirementTab[] = ['material', 'outsourced', 'thread'];
  const tabParam = searchParams.get('tab');
  const activeTab: RequirementTab = TAB_VALUES.includes(tabParam as RequirementTab)
    ? (tabParam as RequirementTab)
    : 'material';

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

  const { data: threadStats } = useQuery<ThreadRequirementStats>({
    queryKey: ['thread-requirements', 'stats'],
    queryFn: getThreadRequirementStats,
    staleTime: 60 * 1000,
  });

  // Combined stats
  const totalRequirements =
    (mrpStats?.totalPendingRequirements || 0) +
    (mrpStats?.poInProgress || 0) +
    (mrpStats?.awaitingReceipt || 0) +
    (mrpStats?.processingRequirementsCount || 0) +
    (serviceStats?.totalServices || 0);
  // MRP-27: these two cards used to contradict each other and the table. "Needs Assignment"
  // added EVERY live PROCESSING row — including ones that already have a processor and a Job
  // Work Order — while "PO Generated" counted only MATERIAL rows, so the very row the table
  // labels "JWO Created" was reported as needing assignment and missing from PO Generated.
  // The backend now splits the PROCESSING total into the two halves these cards mean.
  const needsAssignment =
    (mrpStats?.requirementsNeedingPO || 0) +
    (mrpStats?.processingNeedingAssignment || 0) +
    (serviceStats?.needsProcessorCount || 0);
  const poGenerated =
    (mrpStats?.poInProgress || 0) + (mrpStats?.processingPoGenerated || 0) + (serviceStats?.poGeneratedCount || 0);
  const overdueCount = mrpStats?.overdueRequirements || 0;
  // Est. Service Cost = work-order services + open processing job work (billable fabric-out basis)
  const estimatedValue = (serviceStats?.estimatedTotalCost || 0) + (mrpStats?.processingEstimatedCost || 0);

  // ─── Tab Switch ────────────────────────────────────────────

  // MRP-20: this used to build a fresh URLSearchParams containing only `tab`, so switching tabs
  // dropped the order/work-order context every inbound deep link arrives with (OrderDetail,
  // OrderBOMDetail and the dashboard cards all link in with ?orderId=…). Entity scope now
  // survives the switch; genuinely tab-local state (status vocabularies differ per tab, search,
  // pagination, per-tab pickers) is still cleared, which is what you want when changing view.
  const CROSS_TAB_PARAMS = ['orderId', 'workOrderId'];
  const handleTabChange = (tab: string) => {
    const newParams = new URLSearchParams();
    newParams.set('tab', tab);
    for (const key of CROSS_TAB_PARAMS) {
      const value = searchParams.get(key);
      if (value) newParams.set(key, value);
    }
    setSearchParams(newParams, { replace: true });
  };

  const updateURLParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const newParams = new URLSearchParams(searchParams);
      Object.entries(updates).forEach(([key, value]) => {
        if (value) newParams.set(key, value);
        else newParams.delete(key);
      });
      setSearchParams(newParams, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  // ─── Render ────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-medium flex items-center gap-2">
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
              // MRP-21: the thread tab has its own query prefix — without this, pressing Refresh
              // while looking at Thread Requirements did nothing at all.
              queryClient.invalidateQueries({ queryKey: ['thread-requirements'] });
            }}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          {/* MRP-36: this only ever navigated — it never calculated anything. */}
          <Button variant="outline" size="sm" onClick={() => navigate('/orders')}>
            Go to Orders
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
              <div className="h-9 w-9 rounded-full bg-info-muted flex items-center justify-center">
                <FileText className="h-4 w-4 text-info" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Needs Assignment</p>
                <p className="text-xl font-bold text-primary">{needsAssignment}</p>
              </div>
              <div className="h-9 w-9 rounded-full bg-orange-100 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">PO / JWO Generated</p>
                <p className="text-xl font-bold text-success">{poGenerated}</p>
              </div>
              <div className="h-9 w-9 rounded-full bg-success-muted flex items-center justify-center">
                <ClipboardCheck className="h-4 w-4 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Overdue</p>
                <p className="text-xl font-bold text-destructive">{overdueCount}</p>
              </div>
              <div className="h-9 w-9 rounded-full bg-destructive/10 flex items-center justify-center">
                <Clock className="h-4 w-4 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Est. Service Cost</p>
                <p className="text-xl font-bold text-accent">{formatCurrency(estimatedValue)}</p>
              </div>
              <div className="h-9 w-9 rounded-full bg-accent/10 flex items-center justify-center">
                <IndianRupee className="h-4 w-4 text-accent" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="material" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Material Requirements
            <Badge variant="secondary" className="ml-1 text-xs">
              {(mrpStats?.totalPendingRequirements || 0) +
                (mrpStats?.poInProgress || 0) +
                (mrpStats?.awaitingReceipt || 0)}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="outsourced" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Outsourced Work
            <Badge variant="secondary" className="ml-1 text-xs">
              {(mrpStats?.processingRequirementsCount || 0) + (serviceStats?.totalServices || 0)}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="thread" className="flex items-center gap-2">
            <Scissors className="h-4 w-4" />
            Thread Requirements
            <Badge variant="secondary" className="ml-1 text-xs">
              {(threadStats?.pending || 0) + (threadStats?.poGenerated || 0)}
            </Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Tab Content */}
      {activeTab === 'material' ? (
        <MaterialRequirementsTab searchParams={searchParams} updateURLParams={updateURLParams} />
      ) : activeTab === 'thread' ? (
        <ThreadRequirementsTab searchParams={searchParams} updateURLParams={updateURLParams} />
      ) : (
        <OutsourcedWorkTab searchParams={searchParams} updateURLParams={updateURLParams} />
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
  const navigate = useNavigate();

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showVendorAllocation, setShowVendorAllocation] = useState(false);
  const [showBulkPOGeneration, setShowBulkPOGeneration] = useState(false);

  // PO generation success banner
  const [poGeneratedCount, setPOGeneratedCount] = useState<number | null>(null);
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
  const [greigeOptions, setGreigeOptions] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [selectedGreigeId, setSelectedGreigeId] = useState('');
  const [processorOptions, setProcessorOptions] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [selectedProcessorId, setSelectedProcessorId] = useState('');
  const [processingCostInput, setProcessingCostInput] = useState('');
  const [isConverting, setIsConverting] = useState(false);

  const [searchInput, setSearchInput] = useDebouncedSearchParam(searchParams, updateURLParams);

  // Filters — hard-code requirementType to MATERIAL
  const filters = useMemo(
    (): RequirementFilters => ({
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
    }),
    [searchParams]
  );

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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const requirements = requirementsResponse?.data || [];
  const pagination = requirementsResponse?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 };
  const suppliers: Supplier[] = suppliersResponse?.data || [];
  const styleOptions = stylesForFilter || [];

  // Selection helpers
  const selectableRequirements = useMemo(
    () => requirements.filter((r) => r.status === 'PO_REQUIRED' || r.status === 'PARTIAL_STOCK'),
    [requirements]
  );

  // MRP-17: selection used to survive filter, search and page changes. The bulk bar kept counting
  // rows that were no longer on screen — and Bulk Generate POs would happily raise POs for them.
  useEffect(() => {
    setSelectedIds([]);
  }, [filters]);

  // MRP-17: "select all" is a page-scoped control, so its checked state must be page-scoped too.
  // Comparing a global selection COUNT against this page's selectable count rendered the header
  // checked whenever the two numbers happened to match (3 selected on page 1, 3 selectable here).
  const allOnPageSelected =
    selectableRequirements.length > 0 && selectableRequirements.every((r) => selectedIds.includes(r.id));

  const handleSelectAll = (checked: boolean) => {
    const pageIds = selectableRequirements.map((r) => r.id);
    setSelectedIds((prev) =>
      checked ? [...new Set([...prev, ...pageIds])] : prev.filter((id) => !pageIds.includes(id))
    );
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((i) => i !== id)));
  };

  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.mrp.all });
    // MRP-23: generating a PO here never invalidated the Purchase Orders list, so a freshly
    // created PO could be missing from /procurement/purchase-orders for up to the 5-minute
    // staleTime — long enough to look like the PO was never created.
    queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all });
    setSelectedIds([]);
  };

  // MRP-18: "Manual PO" puts every selected requirement on ONE purchase order for ONE supplier,
  // but selection is grouped only by status — so rows whose preferred vendor is a different
  // supplier (or unassigned) could be silently bought from whoever was picked in the dialog. The
  // Bulk flow groups by supplier and never has this problem; surface the mismatch here.
  const selectedRequirementRows = useMemo(
    () => requirements.filter((r) => selectedIds.includes(r.id)),
    [requirements, selectedIds]
  );
  const selectedSupplierNames = useMemo(() => {
    const names = new Set<string>();
    for (const r of selectedRequirementRows) {
      names.add(r.preferredSupplier?.name ?? 'Not Assigned');
    }
    return [...names];
  }, [selectedRequirementRows]);
  const manualPOSupplierMismatch =
    poSupplierId.length > 0 &&
    selectedRequirementRows.some((r) => r.preferredSupplierId && r.preferredSupplierId !== poSupplierId);

  // MRP-22: the Bulk flow shows priced, GST-inclusive totals before anything is created; the
  // manual dialog committed blind. Same server endpoint, so what is shown here is what gets
  // created — including the zero-price warning that would otherwise surface only as a failure.
  const { data: manualPOPreview, isFetching: manualPOPreviewLoading } = useQuery({
    queryKey: ['mrp', 'manual-po-preview', poSupplierId, poDeliveryDate, selectedIds],
    queryFn: () =>
      previewPOs([
        {
          supplierId: poSupplierId,
          requirementIds: selectedIds,
          expectedDeliveryDate: poDeliveryDate,
        },
      ]),
    enabled: showGeneratePO && !!poSupplierId && !!poDeliveryDate && selectedIds.length > 0,
    staleTime: 30 * 1000,
  });
  const manualPOGroup = manualPOPreview?.[0];

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
      handleApiSuccess('PO Generated', `PO ${result.purchaseOrder?.poNumber} created with ${result.totalItems} items`);
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
      setGreigeOptions(
        // GET /fabric-management/greige returns raw greige_master rows: greigeCode / greigeName /
        // genericGreigeName (there is no name/code/genericName), so map those actual fields.
        (greigeRes.data?.data || []).map(
          (g: { id: string; genericGreigeName?: string; greigeName?: string; greigeCode: string }) => ({
            id: g.id,
            name: g.genericGreigeName || g.greigeName || g.greigeCode,
            code: g.greigeCode,
          })
        )
      );
      setProcessorOptions(
        (processorRes.data?.data || []).map((p: { id: string; name: string; code: string }) => ({
          id: p.id,
          name: p.name,
          code: p.code,
        }))
      );
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

  // Re-calculate MRP for the currently filtered order.
  //
  // MRP-08: this used to take the distinct orderIds of whatever 20 rows happened to be on screen
  // and fire one FULL-ORDER recalculation per order, sequentially — up to 20 heavy calls behind a
  // single spinner, each one cancelling and rebuilding every requirement of an order the user
  // never asked about. It also invented `requiredDate = today + 30 days` and stamped it on every
  // requirement it created, discarding the real delivery date. Now: one order, explicitly chosen
  // via the order filter, and the backend derives the date from the order itself.
  const recalcOrderId = filters.orderId;
  const orderLabelForRecalc =
    requirements.find((r) => r.orderId === recalcOrderId)?.order?.orderNumber ?? 'the selected order';
  const handleRecalculateMRP = async () => {
    if (!recalcOrderId) return;

    setIsRecalculating(true);
    setRecalcDialogOpen(false);
    try {
      await calculateRequirements({ orderId: recalcOrderId, checkStock: true });
      handleApiSuccess(
        'MRP Re-calculated',
        'Requirements recalculated for this order. Fabric/greige requirements should now appear.'
      );
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
      {/* PO Generation Success Banner */}
      {poGeneratedCount !== null && (
        <Alert className="mb-4 bg-success-muted border-success/20">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-success">
              <strong>{poGeneratedCount} Purchase Order(s) Generated</strong> — View and download from Purchase Orders.
            </span>
            <div className="flex gap-2 ml-4 flex-shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="border-success/50 text-success hover:bg-success-muted"
                onClick={() => navigate('/procurement/purchase-orders')}
              >
                View Purchase Orders <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPOGeneratedCount(null)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {filters.styleId && selectableRequirements.length > 0 && selectedIds.length === 0 && (
            <Button
              size="sm"
              variant="outline"
              className="border-accent/25 text-accent hover:bg-accent/10"
              onClick={() => setSelectedIds(selectableRequirements.map((r) => r.id))}
            >
              Select All for Style ({selectableRequirements.length})
            </Button>
          )}
          {/* MRP-08: only offered when a single order is in scope — recalculation rewrites that
              order's requirements, so it must be an explicit choice, not "whatever is on screen". */}
          {recalcOrderId && requirements.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setRecalcDialogOpen(true)} disabled={isRecalculating}>
              <RefreshCw className={`h-4 w-4 mr-1 ${isRecalculating ? 'animate-spin' : ''}`} />
              {isRecalculating ? 'Re-calculating...' : 'Re-calculate MRP'}
            </Button>
          )}
          {selectedIds.length > 0 && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="border-orange-300 text-primary hover:bg-primary/10"
                onClick={() => setShowVendorAllocation(true)}
              >
                Assign Vendors ({selectedIds.length})
              </Button>
              <Button
                size="sm"
                className="bg-success hover:bg-success text-white"
                onClick={() => setShowBulkPOGeneration(true)}
              >
                Bulk Generate POs ({selectedIds.length})
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowGeneratePO(true)}>
                Manual PO
              </Button>
            </>
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          {selectedIds.length > 0 && <span className="text-primary font-medium">{selectedIds.length} selected</span>}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search by material, order, style..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
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
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
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
                {suppliers.map((s: Supplier) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
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
                  <SelectItem key={s.id} value={s.id}>
                    {s.styleCode} — {s.styleName}
                  </SelectItem>
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
                  <Checkbox checked={allOnPageSelected} onCheckedChange={handleSelectAll} />
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
                      <TableCell className="text-sm font-medium">
                        {req.requirementNumber}
                        {/* MRP-12: a split remainder would otherwise look like an unexplained
                            duplicate row — say what it is. */}
                        {req.splitFromId && (
                          <Badge variant="outline" className="ml-2 text-xs font-normal">
                            Balance
                          </Badge>
                        )}
                      </TableCell>
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
                            <div className="text-xs text-muted-foreground">
                              {req.orderItem?.styleCode}
                              {req.orderItem?.buyerStyleRef ? ` (${req.orderItem.buyerStyleRef})` : ''}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{req.order?.orderNumber || '-'}</div>
                        {req.orderBom && (
                          <div className="text-xs text-muted-foreground">BOM v{req.orderBom.version}</div>
                        )}
                      </TableCell>
                      {/* MRP-29: both were raw Decimal-derived floats (1234.5670000000002 MTR was
                          renderable) and Shortfall silently dropped its unit. */}
                      <TableCell className="text-right text-sm">
                        {formatQuantity(req.totalRequired, req.unit)}
                        {/* MRP-48f: a greige quantity is shrinkage-inflated. Say which shrinkage,
                            and warn when it rests on a fallback average rather than the
                            processor's committed figure — this previously reached a log only. */}
                        {req.shrinkagePercentUsed != null && req.shrinkageSource !== 'NONE' && (
                          <div
                            className={`text-xs ${
                              req.shrinkageSource === 'GREIGE_MASTER_FALLBACK'
                                ? 'text-primary'
                                : 'text-muted-foreground'
                            }`}
                            title={
                              req.shrinkageSource === 'GREIGE_MASTER_FALLBACK'
                                ? 'No processor rate card found — planned on the greige master average. Attach a rate card so the quantity matches the processor’s committed loss.'
                                : 'Shrinkage from the processor’s rate card'
                            }
                          >
                            incl. {req.shrinkagePercentUsed}% shrinkage
                            {req.shrinkageSource === 'GREIGE_MASTER_FALLBACK' && ' (assumed)'}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`text-sm font-medium ${req.shortfall > 0 ? 'text-primary' : 'text-success'}`}>
                          {req.shortfall > 0 ? formatQuantity(req.shortfall, req.unit) : 'Fulfilled'}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(req.requiredDate)}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${MaterialRequirementStatusColors[req.status]}`}
                        >
                          {MaterialRequirementStatusLabels[req.status]}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{req.preferredSupplier?.name || 'Not Assigned'}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          {req.shortfall > 0 &&
                            req.material?.materialType === 'FABRIC' &&
                            !req.material?.fabricId &&
                            (req.status === 'PO_REQUIRED' || req.status === 'PARTIAL_STOCK') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-info hover:text-info text-xs"
                                onClick={() => openConvertGreigeDialog(req)}
                              >
                                Greige Process
                              </Button>
                            )}
                          {(req.status === 'PENDING' || req.status === 'PO_REQUIRED') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                setRequirementToCancel(req.id);
                                setCancelDialogOpen(true);
                              }}
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
        onComplete={(result) => {
          refreshData();
          if (result?.totalPOs) setPOGeneratedCount(result.totalPOs);
        }}
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
        description={
          `This re-calculates every material requirement for order ${orderLabelForRecalc}. ` +
          'Requirements that already have a PO or Job Work Order are left untouched; other non-final ' +
          'requirements are rebuilt from the approved BOM, and missing fabric/greige requirements are created.'
        }
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
              Create ONE purchase order covering {selectedIds.length} selected requirement(s).
              {selectedSupplierNames.length > 1 && (
                <> Preferred vendors in this selection: {selectedSupplierNames.join(', ')}.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* MRP-18 */}
            {manualPOSupplierMismatch && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Some selected requirements have a different preferred vendor. Continuing puts them all on one purchase
                  order for the supplier chosen below. Use <strong>Bulk Generate POs</strong> to raise a separate PO per
                  vendor instead.
                </AlertDescription>
              </Alert>
            )}
            <div>
              <Label>Supplier</Label>
              <Select value={poSupplierId} onValueChange={setPOSupplierId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s: Supplier) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
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

            {/* MRP-22: priced preview from the same endpoint the PO is created through */}
            {manualPOPreviewLoading && <div className="text-sm text-muted-foreground">Pricing…</div>}
            {manualPOGroup && !manualPOPreviewLoading && (
              <div className="rounded-md border p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Items</span>
                  <span>{manualPOGroup.items.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(manualPOGroup.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    GST {manualPOGroup.isInterstate ? '(IGST)' : '(CGST + SGST)'}
                  </span>
                  <span>{formatCurrency(manualPOGroup.totalTax)}</span>
                </div>
                <div className="flex justify-between font-medium pt-1 border-t">
                  <span>Total</span>
                  <span>{formatCurrency(manualPOGroup.grandTotal)}</span>
                </div>
                {manualPOGroup.hasZeroPriceItems && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      One or more items have no resolved price. Set a rate on the material or supplier first — a
                      zero-priced purchase order will be rejected.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGeneratePO(false)}>
              Cancel
            </Button>
            <Button onClick={handleGeneratePO} disabled={!poSupplierId || !poDeliveryDate || isGenerating}>
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
              Convert the shortfall of {convertingRequirement?.shortfall || 0} {convertingRequirement?.unit || 'units'}{' '}
              to greige procurement + processing workflow.
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
                    <SelectItem key={g.id} value={g.id}>
                      {g.name} ({g.code})
                    </SelectItem>
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
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </SelectItem>
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
            <Button variant="outline" onClick={() => setConvertGreigeDialogOpen(false)}>
              Cancel
            </Button>
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
  buyerStyleRef?: string | null;
  workType: string; // e.g. "Dyeing", "Embroidery"
  printingType?: string | null; // e.g. PIGMENT, PROCIAN, DISCHARGE
  reference: string; // Order # or Work Order #
  referenceLink?: string; // navigation path
  processor: string;
  processorAssigned: boolean;
  quantity: string; // "100 MTR" — for PROCESSING this is the BILLABLE fabric-out qty
  /** PROCESSING only: greige to physically issue, when it differs from the billable qty. */
  greigeIssueInfo?: string | null;
  // MRP-28: one "Est. Cost" column used to show a PER-UNIT rate for processing rows and a TOTAL
  // for service rows, so in the merged view the column meant nothing. Both are now carried
  // explicitly: rate for reference, total as the comparable figure.
  costRate: number | null;
  costTotal: number | null;
  status: string;
  statusColor: string;
  statusLabel: string;
  isSelectable: boolean;
  createdAt: string;
  componentName?: string | null;
  colorName?: string | null;
  fabricWidth?: number | null;
  jwoLink?: string; // navigation path to JWO detail
  jwoNumber?: string | null; // JWO number for display/export
  // Original data references for bulk operations
  originalProcessing?: MaterialRequirement;
  originalService?: ServiceRequirement;
}

// ─────────────────────────────────────────────────────────────
// Thread Requirements Tab
// ─────────────────────────────────────────────────────────────

function ThreadRequirementsTab({
  searchParams,
  updateURLParams,
}: {
  searchParams: URLSearchParams;
  updateURLParams: (updates: Record<string, string | undefined>) => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Filters from URL
  const search = searchParams.get('search') || '';
  const statusFilter = searchParams.get('status') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const [searchInput, setSearchInput] = useDebouncedSearchParam(searchParams, updateURLParams);

  // Fetch thread requirements
  const { data: threadData, isLoading } = useQuery<PaginatedThreadRequirements>({
    queryKey: ['thread-requirements', { page, search, status: statusFilter }],
    queryFn: () =>
      getAllThreadRequirements({
        page,
        limit: 25,
        search: search || undefined,
        status: (statusFilter || undefined) as ThreadRequirementStatus | undefined,
      }),
    staleTime: 30 * 1000,
  });

  const requirements = threadData?.data || [];
  const pagination = threadData?.pagination;

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [poDialogOpen, setPODialogOpen] = useState(false);
  const [poSupplierId, setPOSupplierId] = useState('');
  const [poDeliveryDate, setPODeliveryDate] = useState('');
  const [poRemarks, setPORemarks] = useState('');
  const [poGenerating, setPOGenerating] = useState(false);
  const [availableSuppliers, setAvailableSuppliers] = useState<{ id: string; name: string; code: string }[]>([]);

  // Add Thread Requirement dialog state
  const [addThreadDialogOpen, setAddThreadDialogOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [orderOptions, setOrderOptions] = useState<{ value: string; label: string }[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Fetch orders for selector
  const loadOrders = useCallback(async (searchTerm: string) => {
    setLoadingOrders(true);
    try {
      const response = await getAllOrders({ search: searchTerm, limit: 20 });
      // MRP-30: this read `order.style` / `order.styleName`, neither of which exists on Order —
      // styles hang off orderItems — so every option in this picker read "Unknown Style". The
      // `any` cast was hiding it from the compiler.
      const options = (response.data || []).map((order) => {
        const styleCodes = [...new Set((order.orderItems || []).map((item) => item.style?.styleCode).filter(Boolean))];
        const styleLabel =
          styleCodes.length === 0
            ? (order.customer?.name ?? 'No style')
            : styleCodes.length <= 2
              ? styleCodes.join(', ')
              : `${styleCodes.slice(0, 2).join(', ')} +${styleCodes.length - 2}`;
        return {
          value: order.id,
          label: `${order.orderNumber} - ${styleLabel}`,
        };
      });
      setOrderOptions(options);
    } catch (err) {
      handleApiError(err, 'Failed to load orders for selection');
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  // Load orders on dialog open
  const handleOpenAddDialog = () => {
    setAddThreadDialogOpen(true);
    setSelectedOrderId('');
    loadOrders('');
  };

  // Only pending items can be selected
  const selectableIds = requirements.filter((r) => r.status === 'PENDING').map((r) => r.id);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === selectableIds.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(selectableIds);
    }
  };

  // Open PO dialog — fetch available suppliers
  const handleOpenPODialog = async () => {
    if (selectedIds.length === 0) return;
    try {
      const suppliers = await getThreadSuppliers(selectedIds);
      setAvailableSuppliers(suppliers);
      setPODialogOpen(true);
    } catch (err) {
      handleApiError(err, 'Failed to fetch suppliers');
    }
  };

  // Generate PO
  const handleGeneratePO = async () => {
    if (!poSupplierId || !poDeliveryDate) return;
    setPOGenerating(true);
    try {
      const result = await generateThreadPO({
        requirementIds: selectedIds,
        supplierId: poSupplierId,
        expectedDeliveryDate: poDeliveryDate,
        remarks: poRemarks || undefined,
      });
      handleApiSuccess('Thread PO Created', `PO created with ${result.updatedRequirements} items`);
      setPODialogOpen(false);
      setSelectedIds([]);
      setPOSupplierId('');
      setPODeliveryDate('');
      setPORemarks('');
      queryClient.invalidateQueries({ queryKey: ['thread-requirements'] });
    } catch (err) {
      handleApiError(err, 'Failed to generate thread PO');
    } finally {
      setPOGenerating(false);
    }
  };

  const getStatusBadge = (status: ThreadRequirementStatus) => {
    const colorMap: Record<ThreadRequirementStatus, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      PO_GENERATED: 'bg-info-muted text-info',
      PARTIALLY_RECEIVED: 'bg-accent/10 text-accent',
      RECEIVED: 'bg-success-muted text-success',
      CANCELLED: 'bg-muted text-foreground',
    };
    return (
      <Badge className={colorMap[status] || 'bg-muted text-foreground'}>
        {THREAD_REQUIREMENT_STATUS_LABELS[status] || status}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* Filters & Actions */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              placeholder="Search thread, order..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-64"
            />
            <Select
              value={statusFilter || 'all'}
              onValueChange={(v) => updateURLParams({ status: v === 'all' ? undefined : v, page: undefined })}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="PO_GENERATED">PO Generated</SelectItem>
                <SelectItem value="PARTIALLY_RECEIVED">Partially Received</SelectItem>
                <SelectItem value="RECEIVED">Received</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <div className="ml-auto flex items-center gap-2">
              <Button onClick={handleOpenAddDialog} size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                Add Thread Requirement
              </Button>
              {selectedIds.length > 0 && (
                <Button onClick={handleOpenPODialog} size="sm">
                  <FileText className="h-4 w-4 mr-1" />
                  Generate PO ({selectedIds.length})
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={selectableIds.length > 0 && selectedIds.length === selectableIds.length}
                    onCheckedChange={toggleSelectAll}
                    disabled={selectableIds.length === 0}
                  />
                </TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Thread</TableHead>
                <TableHead>Ply / Material</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Packaging</TableHead>
                <TableHead className="text-right">Qty (Units)</TableHead>
                <TableHead className="text-right">Boxes</TableHead>
                <TableHead className="text-right">Meters</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Supplier</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : requirements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                    No thread requirements found. Click "Add Thread Requirement" to create one.
                  </TableCell>
                </TableRow>
              ) : (
                requirements.map((req) => (
                  <TableRow key={req.id} className={selectedIds.includes(req.id) ? 'bg-info-muted' : ''}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(req.id)}
                        onCheckedChange={() => toggleSelect(req.id)}
                        disabled={req.status !== 'PENDING'}
                      />
                    </TableCell>
                    <TableCell>
                      <button
                        className="text-info hover:underline text-sm font-medium"
                        onClick={() => navigate(`/orders/${req.orderId}`)}
                      >
                        {req.orderNumber || req.orderId.slice(0, 8)}
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{req.threadCode}</div>
                      <div className="text-xs text-muted-foreground">{req.threadName}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {/* MRP-38: fall back to the raw value like the packaging column already
                          did — an unmapped enum used to render "undefined / undefined". */}
                      {THREAD_PLY_LABELS[req.ply] || req.ply || '-'} /{' '}
                      {THREAD_MATERIAL_LABELS[req.materialComposition] || req.materialComposition || '-'}
                    </TableCell>
                    <TableCell className="text-sm">{req.colorName}</TableCell>
                    <TableCell className="text-sm">
                      {THREAD_PACKAGING_LABELS[req.packagingType] || req.packagingType}
                    </TableCell>
                    {/* MRP-29: three quantity columns previously used three different formats —
                        two raw, one bare toLocaleString() that silently rounded to 3 decimals. */}
                    <TableCell className="text-right font-mono text-sm">{formatQuantity(req.totalUnits)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatQuantity(req.totalBoxes)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatQuantity(req.totalMeters)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {req.unitPrice ? formatCurrency(req.unitPrice) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {req.totalCost ? formatCurrency(req.totalCost) : '-'}
                    </TableCell>
                    <TableCell>{getStatusBadge(req.status)}</TableCell>
                    <TableCell className="text-sm">{req.supplierName || '-'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.limit + 1}-
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => updateURLParams({ page: String(pagination.page - 1) })}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => updateURLParams({ page: String(pagination.page + 1) })}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Generate PO Dialog */}
      <Dialog open={poDialogOpen} onOpenChange={setPODialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Thread Purchase Order</DialogTitle>
            <DialogDescription>Create a PO for {selectedIds.length} selected thread requirement(s).</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Supplier</Label>
              {availableSuppliers.length === 0 ? (
                <Alert className="mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    No common supplier found for all selected threads. Ensure each thread has the supplier linked in
                    Thread Master.
                  </AlertDescription>
                </Alert>
              ) : (
                <Select value={poSupplierId} onValueChange={setPOSupplierId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSuppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.code} - {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
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
              <Label>Remarks (optional)</Label>
              <Textarea
                value={poRemarks}
                onChange={(e) => setPORemarks(e.target.value)}
                placeholder="Additional notes..."
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPODialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleGeneratePO} disabled={!poSupplierId || !poDeliveryDate || poGenerating}>
              {poGenerating ? 'Generating...' : 'Generate PO'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Thread Requirement Dialog */}
      <Dialog open={addThreadDialogOpen} onOpenChange={setAddThreadDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Thread Requirement</DialogTitle>
            <DialogDescription>
              {selectedOrderId
                ? 'Enter thread requirements for the selected order.'
                : 'Select an order to add thread requirements.'}
            </DialogDescription>
          </DialogHeader>
          {!selectedOrderId ? (
            <div className="py-4">
              <Label>Select Order</Label>
              <Combobox
                options={orderOptions}
                value={selectedOrderId}
                onValueChange={setSelectedOrderId}
                placeholder={loadingOrders ? 'Loading orders...' : 'Search and select an order...'}
                searchPlaceholder="Search by order number or style..."
                emptyText="No orders found. Try a different search."
                onSearchChange={loadOrders}
                className="mt-2"
              />
            </div>
          ) : (
            <div className="py-4">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Order: {orderOptions.find((o) => o.value === selectedOrderId)?.label || selectedOrderId}
                </span>
                <Button variant="ghost" size="sm" onClick={() => setSelectedOrderId('')}>
                  Change Order
                </Button>
              </div>
              <OrderThreadRequirementForm
                orderId={selectedOrderId}
                onSave={() => {
                  setAddThreadDialogOpen(false);
                  setSelectedOrderId('');
                  queryClient.invalidateQueries({ queryKey: ['thread-requirements'] });
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Outsourced Work Tab
// ─────────────────────────────────────────────────────────────

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
  const searchFilter = searchParams.get('search') || undefined;
  const processorIdFilter = searchParams.get('processorId') || undefined;
  const [searchInput, setSearchInput] = useDebouncedSearchParam(searchParams, updateURLParams);

  // MRP-11: this tab drives TWO backends with one status dropdown, and their status vocabularies
  // only partly overlap. IN_PROGRESS/COMPLETED are not MaterialRequirementStatus values (Prisma
  // threw → 500 on the processing list) and PO_REQUIRED is not a ServiceRequirementStatus (strict
  // Zod → 400 on the service list), so 3 of the 6 options broke half the table. Options are now
  // per-source, and in the merged "all" view only the statuses both sides understand are offered.
  const MATERIAL_STATUS_OPTIONS = [
    { value: 'PENDING', label: 'Pending' },
    { value: 'PO_REQUIRED', label: 'Job Work Required' },
    { value: 'PARTIAL_STOCK', label: 'Partial Stock' },
    { value: 'PO_GENERATED', label: 'JWO Created' },
    { value: 'PO_SENT', label: 'Sent to Processor' },
    { value: 'PARTIALLY_RECEIVED', label: 'Partially Received' },
    { value: 'RECEIVED', label: 'Received' },
    { value: 'CANCELLED', label: 'Cancelled' },
  ];
  const SERVICE_STATUS_OPTIONS = [
    { value: 'PENDING', label: 'Pending' },
    { value: 'PO_GENERATED', label: 'JWO Created' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'CANCELLED', label: 'Cancelled' },
  ];
  // Intersection of the two enums — safe to send to either backend.
  const SHARED_STATUS_OPTIONS = [
    { value: 'PENDING', label: 'Pending' },
    { value: 'PO_GENERATED', label: 'JWO Created' },
    { value: 'CANCELLED', label: 'Cancelled' },
  ];
  const statusOptions =
    sourceFilter === 'processing'
      ? MATERIAL_STATUS_OPTIONS
      : sourceFilter === 'service'
        ? SERVICE_STATUS_OPTIONS
        : SHARED_STATUS_OPTIONS;
  // A status left in the URL by another source (or hand-typed) must not reach the API.
  const rawStatusParam = searchParams.get('status') || undefined;
  const statusFilter = statusOptions.some((o) => o.value === rawStatusParam) ? rawStatusParam : undefined;

  // ─── Data Fetching ─────────────────────────────────────────

  // Processing requirements (from MRP with requirementType=PROCESSING)
  const orderIdFilter = searchParams.get('orderId') || undefined;
  const workOrderIdFilter = searchParams.get('workOrderId') || undefined;

  // MRP-19: material_requirements has no work-order column, so ?workOrderId= (how WorkOrderDetail
  // links in) was silently ignored for PROCESSING rows — the tab showed that work order's services
  // next to EVERY processing requirement in the database. Resolve the work order to its order /
  // order item and scope the processing list with that instead.
  const { data: scopeWorkOrder } = useQuery({
    queryKey: ['work-order', 'requirements-scope', workOrderIdFilter],
    queryFn: () => workOrderService.getById(workOrderIdFilter as string),
    enabled: !!workOrderIdFilter,
    staleTime: 5 * 60 * 1000,
  });

  const processingFilters = useMemo(
    (): RequirementFilters => ({
      requirementType: 'PROCESSING',
      orderId: orderIdFilter ?? (workOrderIdFilter ? (scopeWorkOrder?.orderId ?? undefined) : undefined),
      orderItemId: workOrderIdFilter ? (scopeWorkOrder?.orderItemId ?? undefined) : undefined,
      status: statusFilter?.split(',') as MaterialRequirementStatus[] | undefined,
      search: searchFilter,
      page,
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }),
    [statusFilter, searchFilter, orderIdFilter, workOrderIdFilter, scopeWorkOrder, page]
  );

  const { data: processingResponse, isLoading: processingLoading } = useQuery({
    queryKey: [...queryKeys.mrp.all, 'processing-list', processingFilters],
    queryFn: () => getRequirements(processingFilters),
    staleTime: 30 * 1000,
    // Wait for the work-order scope to resolve (MRP-19) — firing early would briefly list every
    // processing requirement in the database, which is the bug being fixed.
    enabled: (sourceFilter === 'all' || sourceFilter === 'processing') && (!workOrderIdFilter || !!scopeWorkOrder),
  });

  // Service requirements (from service-requirements/list)
  const serviceFilters = useMemo(
    (): ServiceRequirementFilters => ({
      orderId: orderIdFilter,
      workOrderId: workOrderIdFilter,
      status: statusFilter?.split(',') as ServiceRequirementStatus[] | undefined,
      processorId: processorIdFilter,
      search: searchFilter,
      page,
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }),
    [statusFilter, searchFilter, processorIdFilter, orderIdFilter, workOrderIdFilter, page]
  );

  const { data: serviceResponse, isLoading: serviceLoading } = useQuery({
    queryKey: [...queryKeys.serviceRequirements.all, 'service-list', serviceFilters],
    queryFn: () => getAllServiceRequirements(serviceFilters),
    staleTime: 30 * 1000,
    enabled: sourceFilter === 'all' || sourceFilter === 'service',
  });

  // MRP-17: drop selections whenever the visible set changes — otherwise the bulk actions operate
  // on rows the user can no longer see (and did not intend to include).
  useEffect(() => {
    setSelectedProcessingIds([]);
  }, [processingFilters]);
  useEffect(() => {
    setSelectedServiceIds([]);
  }, [serviceFilters]);

  // MRP-33: the processor roster (complete, capability-filtered) drives the processor filter and
  // both manual job-work dialogs. This tab used to load the generic first-100-suppliers list,
  // which both offered non-processors and hid processor #101; that query is gone with it.
  const { data: processorListResponse } = useQuery({
    queryKey: ['mrp', 'processor-list'],
    queryFn: getProcessorSuppliers,
    staleTime: 5 * 60 * 1000,
  });
  const processors = processorListResponse?.processorList || [];

  const isLoading =
    (sourceFilter !== 'service' && processingLoading) || (sourceFilter !== 'processing' && serviceLoading);

  // ─── Normalize to OutsourcedRow ────────────────────────────

  const rows = useMemo((): OutsourcedRow[] => {
    const result: OutsourcedRow[] = [];

    // Processing items
    if (sourceFilter !== 'service') {
      const processingItems = processingResponse?.data || [];
      for (const req of processingItems) {
        // Extract JWO link from jwoLinks (Phase 4c: JWO-based processing)
        const jwo = req.jwoLinks?.[0]?.jobWorkOrder;
        result.push({
          id: req.id,
          rowKey: `proc-${req.id}`,
          source: 'PROCESSING',
          style: req.orderItem?.styleName || '-',
          buyerStyleRef: req.orderItem?.buyerStyleRef ?? null,
          workType: req.material?.name || 'Processing',
          printingType: req.printingType || null,
          reference: req.order?.orderNumber || '-',
          referenceLink: req.orderId ? `/orders/${req.orderId}` : undefined,
          processor: req.processor?.name || req.preferredSupplier?.name || 'Not Assigned',
          processorAssigned: !!(req.processorId || req.preferredSupplierId),
          // Billing basis: show the fabric-out qty the processor bills for; the greige to
          // physically issue rides along as secondary info.
          quantity: formatQuantity(req.billableQuantity ?? req.totalRequired, req.unit),
          greigeIssueInfo:
            req.billableQuantity != null && req.billableQuantity !== Number(req.totalRequired)
              ? `Issue: ${formatQuantity(req.totalRequired, req.unit)} greige (+${req.effectiveShrinkagePercent}% shrink)`
              : null,
          // processingCost is a per-unit rate (the convert-to-greige dialog labels it
          // "Processing Cost (per unit)"), so the comparable total is rate × billable quantity.
          costRate: req.processingCost ?? null,
          costTotal:
            req.processingCost != null
              ? Number(req.processingCost) * Number(req.billableQuantity ?? req.totalRequired)
              : null,
          status: req.status,
          statusColor: MaterialRequirementStatusColors[req.status] || 'bg-muted text-foreground',
          // Phase 4c: PROCESSING uses JWOs, not POs — job-work vocabulary for every status
          statusLabel:
            req.status === 'PO_GENERATED'
              ? 'JWO Created'
              : req.status === 'PO_REQUIRED'
                ? 'Job Work Required'
                : req.status === 'PO_SENT'
                  ? 'Sent to Processor'
                  : MaterialRequirementStatusLabels[req.status] || req.status,
          isSelectable: req.status === 'PO_REQUIRED' || req.status === 'PARTIAL_STOCK',
          createdAt: req.createdAt,
          componentName: req.componentName || null,
          colorName: req.colorName || null,
          fabricWidth: req.fabricWidth ? Number(req.fabricWidth) : null,
          jwoLink: jwo ? `/job-work-orders/${jwo.id}` : undefined,
          jwoNumber: jwo?.jobWorkNumber || null,
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
          style: req.workOrder?.style?.styleCode || req.workOrder?.style?.styleName || '-',
          buyerStyleRef: req.workOrder?.style?.buyerStyleRef ?? null,
          workType: ServiceTypeLabels[req.serviceType] || req.serviceType,
          reference: req.workOrder?.workOrderNumber || '-',
          referenceLink: req.workOrderId ? `/production/work-orders/${req.workOrderId}` : undefined,
          processor: req.assignedProcessor?.name || req.preferredProcessor?.name || 'Not Assigned',
          processorAssigned: !!(req.assignedProcessorId || req.preferredProcessorId),
          quantity: formatQuantity(req.quantityRequired, req.unit),
          costRate: req.estimatedRate ?? null,
          costTotal: req.estimatedTotal ?? null,
          status: req.status,
          statusColor: ServiceRequirementStatusColors[req.status] || 'bg-muted text-foreground',
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
    return {
      page,
      limit: 40,
      total,
      totalPages: Math.max(
        processingResponse?.pagination?.totalPages || 1,
        serviceResponse?.pagination?.totalPages || 1
      ),
    };
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
      setSelectedProcessingIds((prev) => (checked ? [...prev, row.id] : prev.filter((i) => i !== row.id)));
    } else {
      setSelectedServiceIds((prev) => (checked ? [...prev, row.id] : prev.filter((i) => i !== row.id)));
    }
  };

  const isSelected = (row: OutsourcedRow) => {
    return row.source === 'PROCESSING' ? selectedProcessingIds.includes(row.id) : selectedServiceIds.includes(row.id);
  };

  const clearSelection = () => {
    setSelectedProcessingIds([]);
    setSelectedServiceIds([]);
  };

  // CSV Export handler
  const handleExport = () => {
    const headers = [
      'Style',
      'Buyer Ref',
      'Component',
      'Color',
      'Width',
      'Work Type',
      'Printing Type',
      'Reference',
      'Processor',
      'Quantity',
      'Rate/Unit',
      'Est. Total',
      'Status',
      'JWO Number',
      'Created At',
    ];
    const csvRows = rows.map((row) => [
      row.style,
      row.buyerStyleRef || '',
      row.componentName || '',
      row.colorName || '',
      row.fabricWidth ? `${row.fabricWidth}"` : '',
      row.workType,
      row.printingType || '',
      row.reference,
      row.processor,
      row.quantity,
      row.costRate != null ? row.costRate.toFixed(2) : '',
      row.costTotal != null ? row.costTotal.toFixed(2) : '',
      row.statusLabel,
      row.jwoNumber || '',
      // MRP-35: the table renders dates as en-IN; the export used the machine locale, so the same
      // date came out in two formats depending on who ran it.
      new Date(row.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    ]);

    // MRP-35: values were wrapped in quotes without escaping the quotes inside them, so a fabric
    // width note like 44" broke the row into extra columns. RFC 4180 doubles them.
    const escapeCsv = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
    const csv = [headers.map(escapeCsv).join(','), ...csvRows.map((r) => r.map(escapeCsv).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `outsourced-work-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.mrp.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.serviceRequirements.all });
    // MRP-23: keep the Purchase Orders / Job Work Order lists in step with what was just created.
    queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all });
    queryClient.invalidateQueries({ queryKey: ['job-work-orders'] });
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
      handleApiSuccess(
        result.purchaseOrder ? 'PO Generated' : 'Job Work Order Generated',
        result.purchaseOrder
          ? `PO ${result.purchaseOrder.poNumber} created with ${result.totalItems} items` +
              (result.jobWorkNumber ? ` · JWO ${result.jobWorkNumber}` : '')
          : `JWO ${result.jobWorkNumber} created covering ${result.linkedRequirements} requirement(s) — dispatch it from Job Work Orders`
      );
      setShowGenerateProcessingPO(false);
      setProcPOSupplierId('');
      setProcPODeliveryDate('');
      setProcPORemarks('');
      refreshData();
    } catch (err) {
      handleApiError(err, 'Failed to generate processing job work');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateServicePOAction = async () => {
    if (!svcPOProcessorId || !svcPODeliveryDate || selectedServiceIds.length === 0) return;
    setIsGenerating(true);
    try {
      const result = await generateServiceJWOs({
        processorId: svcPOProcessorId,
        requirementIds: selectedServiceIds,
        expectedDeliveryDate: svcPODeliveryDate,
        remarks: svcPORemarks || undefined,
      });
      const numbers = result.jobWorkOrders.map((j) => j.jobWorkNumber).join(', ');
      handleApiSuccess(
        'Job Work Order Generated',
        `JWO ${numbers} created covering ${result.linkedRequirements} requirement(s) — dispatch from Job Work Orders`
      );
      for (const warning of result.warnings) {
        handleApiError(new Error(warning), 'GST warning');
      }
      setShowGenerateServicePO(false);
      setSvcPOProcessorId('');
      setSvcPODeliveryDate('');
      setSvcPORemarks('');
      refreshData();
    } catch (err) {
      handleApiError(err, 'Failed to generate job work order');
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
              <Badge variant="outline" className="text-primary border-orange-300 py-1">
                Select items of the same type for bulk actions
              </Badge>
              <Button size="sm" variant="ghost" onClick={clearSelection}>
                Clear
              </Button>
            </div>
          ) : hasProcessingSelected ? (
            <>
              <Button
                size="sm"
                variant="outline"
                className="border-accent/25 text-accent hover:bg-accent/10"
                onClick={() => setShowProcessingAssign(true)}
              >
                Assign Processors ({selectedProcessingIds.length})
              </Button>
              <Button
                size="sm"
                className="bg-success hover:bg-success text-white"
                onClick={() => setShowBulkPOGeneration(true)}
              >
                Bulk Generate Job Work ({selectedProcessingIds.length})
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowGenerateProcessingPO(true)}>
                Manual Job Work
              </Button>
            </>
          ) : hasServiceSelected ? (
            <>
              <Button
                size="sm"
                variant="outline"
                className="border-accent/25 text-accent hover:bg-accent/10"
                onClick={() => setShowProcessorAllocation(true)}
              >
                Assign Processors ({selectedServiceIds.length})
              </Button>
              <Button
                size="sm"
                className="bg-success hover:bg-success text-white"
                onClick={() => setShowBulkServicePO(true)}
              >
                Bulk Generate JWOs ({selectedServiceIds.length})
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowGenerateServicePO(true)}>
                Manual Job Work Order
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
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {processingResponse.pagination.total}
                  </Badge>
                )}
                {src === 'service' && serviceResponse?.pagination?.total != null && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {serviceResponse.pagination.total}
                  </Badge>
                )}
              </Button>
            ))}
          </div>

          {/* Search + filters */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search by material, work order, service..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>

            {/* MRP-11: options come from the active source so every one of them is a status the
                backend(s) behind that view actually accept. */}
            <Select
              value={statusFilter || 'all'}
              onValueChange={(v) => updateURLParams({ status: v === 'all' ? undefined : v, page: undefined })}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={searchParams.get('processorId') || 'all'}
              onValueChange={(v) => updateURLParams({ processorId: v === 'all' ? undefined : v, page: undefined })}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Processors" />
              </SelectTrigger>
              {/* MRP-33: this listed the first 100 SUPPLIERS of any kind, so it both offered
                  non-processors and silently omitted processor #101. It now uses the processor
                  roster (suppliers categorised DYEING_PRINTING / WASHING / FINISHING_CONTRACTOR),
                  which is complete and unpaginated. */}
              <SelectContent>
                <SelectItem value="all">All Processors</SelectItem>
                {processors.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* MRP-35: the export only ever contained the rows currently loaded. Say so in the
                label rather than letting it read as a full export of the filtered set. */}
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={rows.length === 0}
              title={`Exports the ${rows.length} row(s) on this page`}
            >
              <Download className="h-4 w-4 mr-1" />
              Export page ({rows.length})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results summary.
          MRP-32: in the merged "All" view the two sources paginate independently (20 each), so a
          page can hold anywhere between 0 and 40 rows and later pages often carry only one source.
          Say that plainly instead of implying a single uniform sequence. */}
      <div className="text-sm text-muted-foreground px-1">
        Showing {rows.length} outsourced work items
        {pagination.total > 0 && ` of ${pagination.total}`}
        {sourceFilter === 'all' && pagination.totalPages > 1 && (
          <span className="ml-1">
            (page {pagination.page} of {pagination.totalPages}; processing and services are paged separately, so a page
            may show only one of the two)
          </span>
        )}
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
                <TableHead>Buyer Ref</TableHead>
                {sourceFilter !== 'service' && <TableHead>Component</TableHead>}
                {sourceFilter !== 'service' && <TableHead>Color</TableHead>}
                {sourceFilter !== 'service' && <TableHead>Width</TableHead>}
                <TableHead>Work Type</TableHead>
                {sourceFilter !== 'service' && <TableHead>Printing Type</TableHead>}
                <TableHead>Reference</TableHead>
                {/* MRP-34: this was hidden in the Service-only view — the one view whose primary
                    action is "Assign Processors", so the assigned processor was invisible exactly
                    where it mattered. Service rows carry a processor too. */}
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
                  <TableCell
                    colSpan={sourceFilter === 'service' ? 11 : 15}
                    className="text-center py-12 text-muted-foreground"
                  >
                    Loading outsourced work items...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={sourceFilter === 'service' ? 11 : 15}
                    className="text-center py-12 text-muted-foreground"
                  >
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
                        className={
                          row.source === 'PROCESSING'
                            ? 'border-accent/25 text-accent bg-accent/10'
                            : 'border-teal-300 text-teal-700 bg-teal-50'
                        }
                      >
                        {row.source === 'PROCESSING' ? 'Processing' : 'Service'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">{row.style}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{row.buyerStyleRef || '—'}</span>
                    </TableCell>
                    {sourceFilter !== 'service' && (
                      <TableCell>
                        <span className="text-sm">{row.componentName || '-'}</span>
                      </TableCell>
                    )}
                    {sourceFilter !== 'service' && (
                      <TableCell>
                        <span className="text-sm">{row.colorName || '-'}</span>
                      </TableCell>
                    )}
                    {sourceFilter !== 'service' && (
                      <TableCell>
                        <span className="text-sm">{row.fabricWidth ? `${row.fabricWidth}"` : '-'}</span>
                      </TableCell>
                    )}
                    <TableCell>
                      <span className="text-sm font-medium">{row.workType}</span>
                    </TableCell>
                    {sourceFilter !== 'service' && (
                      <TableCell>
                        {row.printingType ? (
                          <span className="text-sm font-semibold text-accent">
                            {row.printingType.replace('_', ' ')}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell>
                      {row.referenceLink ? (
                        <button
                          className="text-sm text-info hover:underline font-medium"
                          onClick={() => navigate(row.referenceLink!)}
                        >
                          {row.reference}
                        </button>
                      ) : (
                        <span className="text-sm">{row.reference}</span>
                      )}
                    </TableCell>
                    {/* MRP-34: always rendered — see the header comment. */}
                    <TableCell>
                      <span className={`text-sm ${row.processorAssigned ? '' : 'text-primary'}`}>{row.processor}</span>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {row.quantity}
                      {row.greigeIssueInfo && (
                        <div className="text-[10px] text-muted-foreground whitespace-nowrap">{row.greigeIssueInfo}</div>
                      )}
                    </TableCell>
                    {/* MRP-28: the headline figure is always the estimated TOTAL; the per-unit
                        rate sits underneath so the two sources stay comparable. */}
                    <TableCell className="text-right">
                      <span className="text-sm font-medium text-accent">
                        {row.costTotal != null ? formatCurrency(row.costTotal) : '-'}
                      </span>
                      {row.costRate != null && (
                        <div className="text-xs text-muted-foreground">{formatCurrency(row.costRate)}/unit</div>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.jwoLink ? (
                        <button
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${row.statusColor} hover:underline cursor-pointer`}
                          onClick={() => navigate(row.jwoLink!)}
                        >
                          {row.statusLabel}
                        </button>
                      ) : (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${row.statusColor}`}
                        >
                          {row.statusLabel}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(row.createdAt)}</TableCell>
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
        mode="JOBWORK"
      />

      {/* Manual Processing Job Work Dialog */}
      <Dialog open={showGenerateProcessingPO} onOpenChange={setShowGenerateProcessingPO}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Job Work</DialogTitle>
            <DialogDescription>
              Create a job work order for {selectedProcessingIds.length} selected processing requirement(s)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Processor</Label>
              {/* MRP-33: dyeing/printing work can only go to a processor — offering the generic
                  supplier list invited issuing a job-work order to a button vendor. */}
              <Select value={procPOSupplierId} onValueChange={setProcPOSupplierId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select processor" />
                </SelectTrigger>
                <SelectContent>
                  {processors.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
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
            <Button variant="outline" onClick={() => setShowGenerateProcessingPO(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleGenerateProcessingPO}
              disabled={!procPOSupplierId || !procPODeliveryDate || isGenerating}
            >
              {isGenerating ? 'Generating...' : 'Generate Job Work'}
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

      {/* Manual Service JWO Dialog (Phase 5a: services are job work orders) */}
      <Dialog open={showGenerateServicePO} onOpenChange={setShowGenerateServicePO}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Job Work Order</DialogTitle>
            <DialogDescription>
              Create job work order(s) for {selectedServiceIds.length} selected service requirement(s)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Processor</Label>
              {/* MRP-33: processor roster, not the truncated all-suppliers list. */}
              <Select value={svcPOProcessorId} onValueChange={setSvcPOProcessorId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select processor" />
                </SelectTrigger>
                <SelectContent>
                  {processors.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
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
            <Button variant="outline" onClick={() => setShowGenerateServicePO(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleGenerateServicePOAction}
              disabled={!svcPOProcessorId || !svcPODeliveryDate || isGenerating}
            >
              {isGenerating ? 'Generating...' : 'Generate Job Work Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
