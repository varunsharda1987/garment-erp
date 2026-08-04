/**
 * CAD Planning Page - Spreadsheet-Style Workflow
 *
 * Unified spreadsheet table for CAD planning:
 * - Each row = one CAD entry for a component part
 * - Inline editing for all fields
 * - Auto-calculation of CAD values
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { cadPlanningService } from '../services/cad-planning.service';
import { fabricCostingService, type CADCostingStatusResponse } from '../services/fabricCosting.service';
import {
  ArrowLeft,
  AlertCircle,
  Layers,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Info,
  Sparkles,
  Loader2,
  History,
  Grid3X3,
  ClipboardList,
  FileSpreadsheet,
  XCircle,
  MoreHorizontal,
  ExternalLink,
} from 'lucide-react';
import { notify } from '../lib/notify';
import { cn } from '../lib/utils';
import type { CADTableData } from '../types/cad-planning.types';
import CADSpreadsheetTable from '../components/cad/CADSpreadsheetTable';
import { StockSummaryBanner } from '../components/cad/StockSummaryBanner';
import { CADOrderHistoryTable } from '../components/cad/CADOrderHistoryTable';

// ============================================
// INTERFACES
// ============================================

// Interfaces for CAD History
interface CADHistorySizeBreakdown {
  sizeName: string;
  quantity: number;
}

interface CADHistoryOption {
  id: string;
  fabricId: string;
  cutableWidth: number;
  cadMeters: number | null;
  cadYards: number | null;
  piecesPerMarker: number | null;
  markerLengthMeters: number | null;
  markerEfficiency: number | null;
  cadWastagePercent: number;
  layerMarginMeters: number | null;
  isPreferred: boolean;
  isSelected: boolean;
  componentName: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  sizeBreakdowns: CADHistorySizeBreakdown[];
}

interface CADHistoryGroup {
  groupKey: string;
  genericGreigeName: string;
  fabricFinishType: string;
  printDesign: string | null;
  colorName: string | null;
  hasEmbroidery: boolean;
  embroidery: { id: string; embroideryCode: string; designName: string } | null;
  greige: { id: string; greigeCode: string; greigeName: string; greigeWidth: number } | null;
  components: string[];
  selectedCADId: string | null;
  cadOptions: CADHistoryOption[];
}

interface CADHistoryData {
  style: {
    id: string;
    styleCode: string;
    styleName: string;
    cadStatus: string;
    approvedCadDate: string | null;
    imageUrl: string | null;
  };
  summary: {
    totalFabricGroups: number;
    groupsWithSelectedCAD: number;
    totalCADOptions: number;
    isFullyApproved: boolean;
  };
  cadGroups: CADHistoryGroup[];
}

interface StyleInfo {
  id: string;
  styleCode: string;
  styleName: string;
  cadStatus: 'PENDING' | 'IN_PROGRESS' | 'APPROVED';
  approvedCadDate?: string;
}

// ============================================
// MAIN COMPONENT
// ============================================
export default function CADPlanningPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [style, setStyle] = useState<StyleInfo | null>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // CAD History state
  const [activeTab, setActiveTab] = useState<'spreadsheet' | 'history' | 'orders'>('spreadsheet');
  const [cadHistory, setCadHistory] = useState<CADHistoryData | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState(false);

  // CAD Spreadsheet Table state
  const [cadTableData, setCadTableData] = useState<CADTableData | null>(null);
  const [loadingTableData, setLoadingTableData] = useState(false);
  const [tableDataError, setTableDataError] = useState(false);

  // Push to Fabric Costing state
  const [showPushModal, setShowPushModal] = useState(false);
  const [pushStatus, setPushStatus] = useState<CADCostingStatusResponse | null>(null);
  const [loadingPushStatus, setLoadingPushStatus] = useState(false);
  const [isPushing, setIsPushing] = useState(false);

  // ============================================
  // DATA LOADING
  // ============================================
  const loadCADTableData = useCallback(async () => {
    if (!id) return;
    try {
      setLoadingTableData(true);
      setTableDataError(false);
      const response = await cadPlanningService.getCADTableData(id);
      const tableData = response.data;
      if (!tableData || !Array.isArray(tableData.components)) {
        throw new Error(`CAD API returned unexpected structure: components=${typeof tableData?.components}`);
      }
      setCadTableData(tableData);
      // Extract style info from table data
      if (tableData.style) {
        setStyle({
          id: tableData.style.id,
          styleCode: tableData.style.styleCode,
          styleName: tableData.style.styleName,
          cadStatus: tableData.style.cadStatus as 'PENDING' | 'IN_PROGRESS' | 'APPROVED',
          approvedCadDate: tableData.style.approvedCadDate ?? undefined,
        });
      }
    } catch (error: unknown) {
      console.error('Failed to load CAD table data:', error);
      setTableDataError(true);
      const errMsg = error instanceof Error ? error.message : 'Failed to load CAD spreadsheet data';
      const axiosMsg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      notify.error(axiosMsg || errMsg);
    } finally {
      setLoadingTableData(false);
      setLoading(false);
    }
  }, [id]);

  const loadCADHistory = useCallback(async () => {
    if (!id) return;
    try {
      setLoadingHistory(true);
      setHistoryError(false);
      const response = await cadPlanningService.getStyleCADHistory(id);
      if (response.success) {
        setCadHistory(response.data);
      }
    } catch (error: unknown) {
      console.error('Failed to load CAD history:', error);
      setHistoryError(true);
      const axiosMsg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      notify.error(axiosMsg || 'Failed to load CAD history');
    } finally {
      setLoadingHistory(false);
    }
  }, [id]);

  useEffect(() => {
    loadCADTableData();
  }, [loadCADTableData]);

  // Load history when switching to history tab
  useEffect(() => {
    if (activeTab === 'history' && !cadHistory && !loadingHistory && !historyError) {
      loadCADHistory();
    }
  }, [activeTab, cadHistory, loadingHistory, historyError, loadCADHistory]);

  // ============================================
  // APPROVAL
  // ============================================
  const handleApproveCAD = async () => {
    if (!cadTableData) return;

    // Check if all rows have Part assigned
    const rowsWithoutPart = cadTableData.cadRows.filter((row) => !row.partId);
    if (rowsWithoutPart.length > 0) {
      notify.error(
        `Please select a Part for all rows (${rowsWithoutPart.length} row${rowsWithoutPart.length > 1 ? 's' : ''} missing Part)`
      );
      return;
    }

    // Check if all rows have CAD values
    const incompleteRows = cadTableData.cadRows.filter((row) => !row.cadAverage || row.cadAverage <= 0);

    if (incompleteRows.length > 0) {
      notify.error(`Please complete CAD values for all rows (${incompleteRows.length} incomplete)`);
      return;
    }

    // Check all fabric groups have at least one CAD row
    const allStyleFabricIds = new Set<string>();
    cadTableData.components?.forEach((comp) => {
      comp.fabrics?.forEach((fab) => {
        allStyleFabricIds.add(fab.id);
      });
    });

    const coveredFabricIds = new Set(
      cadTableData.cadRows.filter((row) => row.cadAverage && row.cadAverage > 0).map((row) => row.styleFabricId)
    );

    const uncoveredFabrics =
      cadTableData.components?.flatMap((comp) => (comp.fabrics || []).filter((fab) => !coveredFabricIds.has(fab.id))) ||
      [];

    if (uncoveredFabrics.length > 0) {
      const missing = uncoveredFabrics
        .map((fab) => {
          const designColor = fab.printDesign || fab.colorName || '';
          return `${fab.fabricFinishType || 'PLAIN'}${designColor ? ` ${designColor}` : ''} • ${fab.genericGreigeName || 'Unknown'}`;
        })
        .join(', ');
      notify.error(`Cannot approve: ${uncoveredFabrics.length} fabric(s) have no CAD data. Missing: ${missing}`);
      return;
    }

    try {
      setSaving(true);

      // Build fabricCADMappings from spreadsheet rows
      const fabricCADMappings: Array<{ fabricId: string; fabricCADId: string }> = [];

      cadTableData.cadRows.forEach((row) => {
        if (row.styleFabricId && row.id) {
          fabricCADMappings.push({
            fabricId: row.styleFabricId,
            fabricCADId: row.id,
          });
        }
      });

      await cadPlanningService.approveCADPlan(id!, { fabricCADMappings });

      notify.success('CAD plan approved! You can now generate cost sheet.', { duration: 5000 });
      setShowApproveDialog(false);
      navigate('/cad-planning');
    } catch (error: unknown) {
      console.error('Failed to approve CAD:', error);
      const axiosMsg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      notify.error(axiosMsg || 'Failed to approve CAD plan');
    } finally {
      setSaving(false);
    }
  };

  // ============================================
  // REJECT CAD PLAN
  // ============================================
  const handleRejectCAD = async () => {
    if (!id) return;
    if (!rejectionReason.trim()) {
      notify.error('Please provide a reason for rejection');
      return;
    }
    try {
      setRejecting(true);
      await cadPlanningService.rejectCADPlan(id, rejectionReason.trim());
      notify.success('CAD plan rejected. All rows reset to PENDING.', { duration: 5000 });
      setShowRejectDialog(false);
      setRejectionReason('');
      // loadCADTableData also refreshes style info (cadStatus, approvedCadDate)
      await loadCADTableData();
    } catch (error: unknown) {
      const axiosMsg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      notify.error(axiosMsg || 'Failed to reject CAD plan');
    } finally {
      setRejecting(false);
    }
  };

  // ============================================
  // CAD SPREADSHEET TABLE HANDLERS
  // ============================================
  const handleSpreadsheetAddRow = async (
    styleFabricId: string,
    partId?: string,
    purpose?: 'COSTING' | 'RAW_MATERIAL_CALCULATION' | 'PRODUCTION',
    fabricStockId?: string
  ) => {
    if (!id) return;
    try {
      await cadPlanningService.addCADTableRow(id, {
        styleFabricId,
        partId,
        componentId: '', // Will be derived from styleFabricId on backend
        purpose,
        fabricStockId,
      });
      const purposeLabel = purpose === 'RAW_MATERIAL_CALCULATION' ? 'Raw Mat' : purpose || 'Costing';
      notify.success(`${purposeLabel} row added successfully`);
      await loadCADTableData();
    } catch (error: unknown) {
      console.error('Failed to add row:', error);
      const axiosMsg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      notify.error(axiosMsg || 'Failed to add row');
      throw error;
    }
  };

  const handleSpreadsheetAddCombinedRow = async (
    styleFabricIds: string[],
    purpose?: 'COSTING' | 'RAW_MATERIAL_CALCULATION' | 'PRODUCTION'
  ) => {
    if (!id) return;
    try {
      await cadPlanningService.addCombinedCADRow(id, styleFabricIds, purpose);
      const purposeLabel = purpose === 'RAW_MATERIAL_CALCULATION' ? 'Raw Mat' : purpose || 'Costing';
      notify.success(`Combined ${purposeLabel} row added successfully`);
      await loadCADTableData();
    } catch (error: unknown) {
      console.error('Failed to add combined row:', error);
      const axiosMsg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      notify.error(axiosMsg || 'Failed to add combined row');
      throw error;
    }
  };

  const handleSpreadsheetUpdateRow = async (
    rowId: string,
    data: Parameters<typeof cadPlanningService.updateCADTableRow>[2]
  ) => {
    if (!id) return;
    try {
      await cadPlanningService.updateCADTableRow(id, rowId, data);
      // Refresh data to get updated calculations from backend
      await loadCADTableData();
    } catch (error: unknown) {
      console.error('Failed to update row:', error);
      const axiosMsg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      notify.error(axiosMsg || 'Failed to update row');
      throw error;
    }
  };

  const handleSpreadsheetDeleteRow = async (rowId: string) => {
    if (!id) return;
    try {
      await cadPlanningService.deleteCADTableRow(id, rowId);
      notify.success('Row deleted successfully');
      // Update local state
      if (cadTableData) {
        setCadTableData({
          ...cadTableData,
          cadRows: cadTableData.cadRows.filter((row) => row.id !== rowId),
        });
      }
    } catch (error: unknown) {
      console.error('Failed to delete row:', error);
      const axiosMsg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      notify.error(axiosMsg || 'Failed to delete row');
      throw error;
    }
  };

  // Handler for creating PRODUCTION CAD from stock (called from StockSummaryBanner)
  const handleCreateProductionCADFromStock = async (
    stockId: string,
    _fabricId: string,
    greigeId: string,
    styleFabricId?: string | null,
    componentId?: string | null
  ) => {
    if (!id) return;
    try {
      await cadPlanningService.createProductionCADFromStock(id, {
        fabricStockId: stockId,
        greigeId,
        styleFabricId: styleFabricId || undefined,
        componentId: componentId || undefined,
      });
      notify.success('PRODUCTION CAD created from stock');
      await loadCADTableData();
    } catch (error: unknown) {
      console.error('Failed to create PRODUCTION CAD from stock:', error);
      const axiosMsg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      notify.error(axiosMsg || 'Failed to create PRODUCTION CAD');
      throw error;
    }
  };

  // ============================================
  // PUSH TO FABRIC COSTING HANDLERS
  // ============================================
  const handleCheckAndShowPushModal = async () => {
    if (!id || !cadTableData) return;

    const cadRowIds = cadTableData.cadRows.map((row) => row.id);
    if (cadRowIds.length === 0) {
      notify.error('No CAD rows to push to fabric costing');
      return;
    }

    try {
      setLoadingPushStatus(true);
      const status = await fabricCostingService.checkCADCostingStatus(id, cadRowIds);
      setPushStatus(status);
      setShowPushModal(true);
    } catch (error: unknown) {
      console.error('Failed to check CAD costing status:', error);
      const axiosMsg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      notify.error(axiosMsg || 'Failed to check costing status');
    } finally {
      setLoadingPushStatus(false);
    }
  };

  const handlePushToCosting = async () => {
    if (!id || !cadTableData) return;

    const cadRowIds = cadTableData.cadRows.map((row) => row.id);

    try {
      setIsPushing(true);
      const result = await fabricCostingService.pushFromCAD(id, cadRowIds);

      if (result.created > 0) {
        notify.success(`Created ${result.created} fabric costing record${result.created > 1 ? 's' : ''}`);
      } else {
        notify.info('All CAD rows already have costing records');
      }

      setShowPushModal(false);
      // Navigate to fabric costing page
      navigate(`/fabric-costing?styleId=${id}`);
    } catch (error: unknown) {
      console.error('Failed to push CAD to fabric costing:', error);
      const axiosMsg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      notify.error(axiosMsg || 'Failed to create fabric costing records');
    } finally {
      setIsPushing(false);
    }
  };

  // ============================================
  // RENDER
  // ============================================
  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-info mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading CAD planning data...</p>
        </div>
      </div>
    );
  }

  if (!style) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <AlertCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-display font-semibold mb-2">Style not found</h2>
          <Button onClick={() => navigate('/cad-planning')}>Back to CAD Planning</Button>
        </div>
      </div>
    );
  }

  const isApproved = style.cadStatus === 'APPROVED';
  const canApprove =
    cadTableData &&
    cadTableData.cadRows.length > 0 &&
    cadTableData.cadRows.every((row) => row.cadAverage && row.cadAverage > 0) &&
    !isApproved;

  return (
    <div className="p-4 w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <Button type="button" variant="ghost" size="sm" onClick={() => navigate('/cad-planning')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-display font-medium">CAD Planning</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {style.styleCode} - {style.styleName}
            </p>
          </div>
        </div>
        <Badge
          variant={isApproved ? 'default' : style.cadStatus === 'IN_PROGRESS' ? 'secondary' : 'outline'}
          className={cn('text-sm px-3 py-1', isApproved && 'bg-success')}
        >
          {isApproved && <CheckCircle2 className="h-4 w-4 mr-1" />}
          {style.cadStatus}
        </Badge>
      </div>

      {/* Info Banner - Compact */}
      <div className="mb-4 p-3 bg-accent/10 border border-accent/20 rounded-lg flex items-center gap-3">
        <Grid3X3 className="h-4 w-4 text-accent flex-shrink-0" />
        <p className="text-sm text-accent">
          <span className="font-medium text-accent">Spreadsheet CAD Planning:</span> Each row = one CAD entry. Select
          greige, width, enter size breakdown → CAD auto-calculates.
        </p>
      </div>

      {/* Status Card with Actions Dropdown */}
      {isApproved ? (
        <div className="mb-4 p-3 bg-success-muted border border-success/25 rounded-lg flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
            <div className="text-sm">
              <span className="font-medium text-success">CAD Plan Approved</span>
              {style.approvedCadDate && (
                <span className="text-success ml-2">on {new Date(style.approvedCadDate).toLocaleDateString()}</span>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" disabled={loadingPushStatus || rejecting}>
                {loadingPushStatus || rejecting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <MoreHorizontal className="h-4 w-4 mr-2" />
                )}
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleCheckAndShowPushModal} disabled={loadingPushStatus}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Push to Fabric Costing
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/fabric-costing?styleId=${id}`)}>
                <ExternalLink className="h-4 w-4 mr-2" />
                View Fabric Costing
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setShowRejectDialog(true)}
                disabled={rejecting}
                className="text-destructive focus:text-destructive"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject CAD Plan
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : (
        <div className="mb-4 p-3 bg-muted border rounded-lg flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {canApprove ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                <span className="text-sm font-medium text-success">All CAD entries complete. Ready to approve!</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-warning flex-shrink-0" />
                <span className="text-sm text-muted-foreground">Complete all CAD entries before approval</span>
              </>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <MoreHorizontal className="h-4 w-4 mr-2" />
                )}
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setShowApproveDialog(true)}
                disabled={!canApprove || saving}
                className="text-success focus:text-success"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Approve CAD Plan
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate(`/fabric-costing?styleId=${id}`)}>
                <ExternalLink className="h-4 w-4 mr-2" />
                View Fabric Costing
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Tabs for Spreadsheet vs History vs Order History */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'spreadsheet' | 'history' | 'orders')}
        className="mb-4"
      >
        <TabsList className="grid w-96 grid-cols-3">
          <TabsTrigger value="spreadsheet" className="flex items-center gap-2">
            <Grid3X3 className="h-4 w-4" />
            CAD Spreadsheet
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            CAD History
          </TabsTrigger>
          <TabsTrigger value="orders" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Order History
          </TabsTrigger>
        </TabsList>

        {/* CAD Spreadsheet Tab */}
        <TabsContent value="spreadsheet" className="mt-2">
          {loadingTableData ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-info" />
                <p className="text-muted-foreground">Loading CAD spreadsheet data...</p>
              </div>
            </div>
          ) : tableDataError || !cadTableData || !cadTableData.components ? (
            <Card className="p-8 text-center">
              <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Unable to load spreadsheet data</h3>
              <p className="text-muted-foreground mb-4">
                There was an error loading the CAD spreadsheet. Please try again.
              </p>
              <Button onClick={loadCADTableData} variant="outline">
                <Loader2 className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </Card>
          ) : (
            <div>
              {/* Stock Summary Banner */}
              {cadTableData.stockSummary && cadTableData.stockSummary.length > 0 && (
                <StockSummaryBanner
                  stockSummary={cadTableData.stockSummary}
                  styleId={id}
                  onCreateProductionCAD={handleCreateProductionCADFromStock}
                />
              )}

              <CADSpreadsheetTable
                styleId={id!}
                rows={cadTableData.cadRows}
                components={cadTableData.components}
                availableGreiges={cadTableData.availableGreiges}
                sizeOptions={cadTableData.sizeOptions || cadTableData.sizes || []}
                onAddRow={handleSpreadsheetAddRow}
                onAddCombinedRow={handleSpreadsheetAddCombinedRow}
                onUpdateRow={handleSpreadsheetUpdateRow}
                onDeleteRow={handleSpreadsheetDeleteRow}
                disabled={false}
                isStyleApproved={isApproved}
                onDataRefresh={loadCADTableData}
              />
            </div>
          )}
        </TabsContent>

        {/* CAD History Tab */}
        <TabsContent value="history" className="mt-4">
          <CADHistoryView cadHistory={cadHistory} loading={loadingHistory} onRefresh={loadCADHistory} />
        </TabsContent>

        {/* Order History Tab */}
        <TabsContent value="orders" className="mt-4">
          <CADOrderHistoryTable styleId={id!} />
        </TabsContent>
      </Tabs>

      {/* Approve Confirmation Dialog */}
      <ConfirmDialog
        open={showApproveDialog}
        onOpenChange={setShowApproveDialog}
        title="Approve CAD Plan?"
        description="Once approved, the CAD plan will be locked and you can generate the cost sheet. You won't be able to change fabric widths or values after approval. Make sure all CAD entries have values calculated, size breakdowns are filled correctly, and greige/width selections are correct."
        confirmText={saving ? 'Approving...' : 'Approve & Lock'}
        cancelText="Cancel"
        onConfirm={handleApproveCAD}
        variant="default"
      />

      {/* Reject CAD Plan Dialog with Reason Input */}
      <Dialog
        open={showRejectDialog}
        onOpenChange={(open) => {
          setShowRejectDialog(open);
          if (!open) setRejectionReason('');
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              Reject CAD Plan?
            </DialogTitle>
            <DialogDescription>
              This will revert the CAD plan status to PENDING and reset all row approvals. You will be able to edit all
              CAD entries again. Any linked fabric costing data will NOT be affected.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label htmlFor="rejection-reason" className="text-sm font-medium mb-2 block">
              Reason for rejection <span className="text-destructive">*</span>
            </label>
            <Textarea
              id="rejection-reason"
              placeholder="Enter the reason for rejecting this CAD plan..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowRejectDialog(false)} disabled={rejecting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRejectCAD} disabled={rejecting || !rejectionReason.trim()}>
              {rejecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rejecting...
                </>
              ) : (
                'Reject & Unlock'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Push to Fabric Costing Modal */}
      <Dialog open={showPushModal} onOpenChange={setShowPushModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-info" />
              Push to Fabric Costing
            </DialogTitle>
            <DialogDescription>Create fabric costing records from CAD planning data</DialogDescription>
          </DialogHeader>

          {pushStatus && (
            <div className="py-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                This will create fabric costing records from your CAD data with greige costs pre-populated from
                procurement records.
              </p>

              <div className="space-y-2">
                {pushStatus.newCount > 0 && (
                  <div className="flex items-center gap-2 text-success bg-success-muted p-2 rounded">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {pushStatus.newCount} new record{pushStatus.newCount > 1 ? 's' : ''} will be created
                    </span>
                  </div>
                )}

                {pushStatus.existingCount > 0 && (
                  <div className="flex items-center gap-2 text-muted-foreground bg-muted p-2 rounded">
                    <Info className="h-4 w-4" />
                    <span className="text-sm">
                      {pushStatus.existingCount} record{pushStatus.existingCount > 1 ? 's' : ''} already exist (will be
                      skipped)
                    </span>
                  </div>
                )}

                {pushStatus.newCount === 0 && pushStatus.existingCount > 0 && (
                  <div className="text-sm text-warning bg-warning-muted p-2 rounded">
                    All CAD rows already have fabric costing records. You can view them in the Fabric Costing page.
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowPushModal(false)} disabled={isPushing}>
              Cancel
            </Button>
            {pushStatus && pushStatus.newCount > 0 ? (
              <Button onClick={handlePushToCosting} disabled={isPushing}>
                {isPushing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Create {pushStatus.newCount} Record{pushStatus.newCount > 1 ? 's' : ''}
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={() => {
                  setShowPushModal(false);
                  navigate(`/fabric-costing?styleId=${id}`);
                }}
              >
                View Fabric Costing →
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================
// CAD HISTORY VIEW COMPONENT
// ============================================
interface CADHistoryViewProps {
  cadHistory: CADHistoryData | null;
  loading: boolean;
  onRefresh: () => void;
}

function CADHistoryView({ cadHistory, loading, onRefresh }: CADHistoryViewProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-info" />
          <p className="text-muted-foreground">Loading CAD history...</p>
        </div>
      </div>
    );
  }

  if (!cadHistory) {
    return (
      <Card className="p-8 text-center">
        <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No CAD history available</h3>
        <p className="text-muted-foreground mb-4">CAD history will appear here once fabric groups are set up.</p>
        <Button onClick={onRefresh} variant="outline">
          <Loader2 className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </Card>
    );
  }

  const { summary, cadGroups } = cadHistory;

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card className="p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-info">{summary.totalFabricGroups}</p>
              <p className="text-sm text-muted-foreground">Fabric Groups</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-success">{summary.groupsWithSelectedCAD}</p>
              <p className="text-sm text-muted-foreground">With Selected CAD</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-accent">{summary.totalCADOptions}</p>
              <p className="text-sm text-muted-foreground">Total CAD Options</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {summary.isFullyApproved && (
              <Badge className="bg-success-muted text-success hover:bg-success-muted">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Approved
              </Badge>
            )}
            <Button onClick={onRefresh} variant="outline" size="sm">
              <Loader2 className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </Card>

      {/* CAD Groups */}
      {cadGroups.length === 0 ? (
        <Card className="p-8 text-center">
          <History className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No CAD records yet</h3>
          <p className="text-muted-foreground">
            CAD options will appear here once greige is selected and CAD values are entered.
          </p>
        </Card>
      ) : (
        cadGroups.map((group, index) => <CADHistoryGroupCard key={group.groupKey} group={group} index={index} />)
      )}
    </div>
  );
}

// ============================================
// CAD HISTORY GROUP CARD COMPONENT
// ============================================
interface CADHistoryGroupCardProps {
  group: CADHistoryGroup;
  index: number;
}

function CADHistoryGroupCard({ group, index }: CADHistoryGroupCardProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <Card className={cn('overflow-hidden', group.hasEmbroidery && 'border-accent/20')}>
      {/* Header */}
      <div
        className={cn(
          'p-4 cursor-pointer flex items-center justify-between',
          group.hasEmbroidery ? 'bg-accent/10' : 'bg-muted'
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant="outline" className="text-sm">
            <Layers className="h-3 w-3 mr-1" />
            Group {index + 1}
          </Badge>
          <h4 className="font-semibold">
            {group.fabricFinishType}
            {(group.printDesign || group.colorName) && ` ${group.printDesign || group.colorName}`}
            {' • '}
            {group.genericGreigeName}
          </h4>
          {group.hasEmbroidery && group.embroidery && (
            <Badge className="bg-accent/10 text-accent hover:bg-accent/10 text-xs">
              <Sparkles className="h-3 w-3 mr-1" />
              {group.embroidery.designName}
            </Badge>
          )}
          {group.selectedCADId && (
            <Badge className="bg-success-muted text-success hover:bg-success-muted text-xs">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              CAD Selected
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {group.cadOptions.length} CAD option{group.cadOptions.length !== 1 ? 's' : ''}
          </span>
          {expanded ? (
            <TrendingUp className="h-4 w-4 text-muted-foreground rotate-180" />
          ) : (
            <TrendingDown className="h-4 w-4 text-muted-foreground rotate-180" />
          )}
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div className="p-4 border-t">
          {/* Greige Info */}
          {group.greige && (
            <div className="mb-4 p-3 bg-warning-muted border border-warning/20 rounded-lg text-sm">
              <span className="font-medium text-warning">Greige: </span>
              <span className="text-warning">
                {group.greige.greigeCode} - {group.greige.greigeName} ({group.greige.greigeWidth}")
              </span>
            </div>
          )}

          {/* Components */}
          <div className="mb-4 text-sm text-muted-foreground">
            <span className="font-medium">Components: </span>
            {group.components.join(', ')}
          </div>

          {/* CAD Options Table */}
          {group.cadOptions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted">
                    <th className="p-2 text-left border-b">Status</th>
                    <th className="p-2 text-left border-b">Cut Width</th>
                    <th className="p-2 text-left border-b">CAD (m)</th>
                    <th className="p-2 text-left border-b">Pcs/Layer</th>
                    <th className="p-2 text-left border-b">Layer Length</th>
                    <th className="p-2 text-left border-b">Efficiency</th>
                    <th className="p-2 text-left border-b">Size Breakdown</th>
                    <th className="p-2 text-left border-b">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {group.cadOptions.map((cad) => (
                    <tr
                      key={cad.id}
                      className={cn(
                        'hover:bg-muted',
                        cad.isSelected && 'bg-success-muted border-l-4 border-l-green-600',
                        cad.isPreferred && !cad.isSelected && 'bg-info-muted'
                      )}
                    >
                      <td className="p-2 border-b">
                        <div className="flex items-center gap-1">
                          {cad.isSelected ? (
                            <Badge className="bg-success-muted text-success hover:bg-success-muted text-xs">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Selected
                            </Badge>
                          ) : cad.isPreferred ? (
                            <Badge className="bg-info-muted text-info hover:bg-info-muted text-xs">Preferred</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              Option
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-2 border-b font-semibold">{cad.cutableWidth}"</td>
                      <td className="p-2 border-b">
                        {cad.cadMeters ? (
                          <span className="font-medium text-success">{cad.cadMeters.toFixed(3)} m</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="p-2 border-b text-muted-foreground">{cad.piecesPerMarker || '-'}</td>
                      <td className="p-2 border-b text-muted-foreground">
                        {cad.markerLengthMeters ? `${cad.markerLengthMeters.toFixed(2)} m` : '-'}
                      </td>
                      <td className="p-2 border-b text-muted-foreground">
                        {cad.markerEfficiency ? `${cad.markerEfficiency.toFixed(1)}%` : '-'}
                      </td>
                      <td className="p-2 border-b">
                        {cad.sizeBreakdowns && cad.sizeBreakdowns.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {cad.sizeBreakdowns.map((sb, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {sb.sizeName}: {sb.quantity}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="p-2 border-b text-muted-foreground text-xs">
                        {new Date(cad.updatedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">No CAD options calculated yet</div>
          )}

          {/* Notes for selected CAD */}
          {(() => {
            const selectedCad = group.cadOptions.find((c) => c.isSelected);
            if (selectedCad?.notes) {
              return (
                <div className="mt-3 p-3 bg-muted border rounded-lg text-sm">
                  <span className="font-medium">Notes: </span>
                  {selectedCad.notes}
                </div>
              );
            }
            return null;
          })()}
        </div>
      )}
    </Card>
  );
}
