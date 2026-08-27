/**
 * Fabric Costing Page - Redesigned
 * Focus on greige processing workflow with transportation costs and processor rate card integration
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  X,
  Eye,
  ArrowLeft,
  Save,
  Loader2,
  Info,
  RefreshCw,
  FileText,
  AlertCircle,
  Clock,
  Package,
  CheckCircle2,
  Trash2,
  Lock,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Combobox } from '../components/ui/combobox';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { fabricCostingService } from '../services/fabricCosting.service';
import type { StyleCostingStatus } from '../services/fabricCosting.service';
import { getRunsByStyle, createRun, deleteRun, type CostingRun } from '../services/fabricCostingRun.service';
import { styleService } from '../services/style.service';
import { customerService } from '../services/customer.service';
import { CustomerCombobox } from '@/components/CustomerCombobox';
import { divideByShrinkage } from '../utils/math';
import { formatStyleCodeWithRef } from '../utils/style-ref-format';
import { resolveGreigeCost, isGreigeRateStale, greigeSourceLabel, describeLiveRate } from '../utils/greigeRate';
import type {
  FabricCostingRow,
  FabricForCosting,
  ProcessorInfo,
  CostInputMode,
  TransportCostMode,
  ProcessorRateLookup,
  ScreenType,
  CostingPurpose,
} from '../types/fabricCosting.types';
import { SCREEN_TYPE_LABELS, DEFAULT_SCREEN_COSTS } from '../types/fabricCosting.types';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import type { Style } from '../types/style.types';
import { notify } from '../lib/notify';
import { getErrorMessage } from '../lib/api-error-handler';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';

// Helper to validate UUID format
const isValidUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

// Helper to parse greige name into structured parts
// Pattern: "Fiber Name Count×Count / Construction" e.g., "Viscose Staple 30×30 / 68×52"
const parseGreigeName = (name: string | null | undefined): { line1: string; line2: string } => {
  if (!name) return { line1: '', line2: '' };

  // Match pattern where count starts (e.g., "30×30" or "30x30")
  const match = name.match(/^(.+?)\s+(\d+[×x]\d+.*)$/i);
  if (match) {
    return { line1: match[1], line2: match[2] };
  }
  return { line1: name, line2: '' };
};

// Per-row quantity input that commits on blur/Enter, not per keystroke.
// The table groups rows by quantity (nestedGroups qtyKey) — committing per keystroke changed the
// row's group key, which remounted the DOM subtree and killed input focus after every digit.
// Keeping a local draft while focused means the row only regroups once, when editing is done.
function RowQtyInput({
  rowQuantity,
  effectiveGlobalQty,
  className,
  onCommit,
}: {
  rowQuantity: number | undefined;
  effectiveGlobalQty: number;
  className?: string;
  onCommit: (qty: number | undefined) => void;
}) {
  const [draft, setDraft] = useState(rowQuantity != null ? String(rowQuantity) : '');
  const focusedRef = useRef(false);

  // Sync from prop only when not focused (covers refetch-after-save updating rowQuantity)
  useEffect(() => {
    if (!focusedRef.current) {
      setDraft(rowQuantity != null ? String(rowQuantity) : '');
    }
  }, [rowQuantity]);

  const commit = () => {
    const n = parseInt(draft, 10);
    // empty/0/garbage → undefined = fall back to global order quantity
    onCommit(Number.isFinite(n) && n > 0 ? n : undefined);
  };

  return (
    <Input
      type="number"
      min="1"
      className={className}
      value={draft}
      placeholder={effectiveGlobalQty > 0 ? String(effectiveGlobalQty) : '-'}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onBlur={() => {
        focusedRef.current = false;
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      title="Order quantity for this row (leave empty to use global quantity)"
    />
  );
}

// Finished-fabric stock indicator — DISPLAY ONLY. Numbers here are indicative for planning;
// actual stock allocation and PO quantities are decided at Material Requisition (MRP),
// which uses the same width ±0.5" matching rule against fabric_stock.
function StockBadge({ row, effectiveQty }: { row: FabricCostingRow; effectiveQty: number }) {
  const stockM = row.stockAtWidth;
  if (!stockM || stockM <= 0) return null;

  const coversPcs = row.cadMeters > 0 ? Math.floor(stockM / row.cadMeters) : null;
  const toProcurePcs = coversPcs != null && effectiveQty > 0 ? Math.max(0, effectiveQty - coversPcs) : null;
  const coversAll = toProcurePcs === 0;

  // Indicative blended ₹/m: stock portion at its WAC + procured portion at this row's calculated cost
  let blended: number | null = null;
  if (
    coversPcs != null &&
    toProcurePcs != null &&
    toProcurePcs > 0 &&
    effectiveQty > 0 &&
    row.stockWacAtWidth != null &&
    row.totalCostPerMeter != null
  ) {
    const stockPcsUsed = Math.min(coversPcs, effectiveQty);
    const stockMeters = stockPcsUsed * row.cadMeters;
    const procureMeters = toProcurePcs * row.cadMeters;
    const totalMeters = stockMeters + procureMeters;
    if (totalMeters > 0) {
      blended = (stockMeters * row.stockWacAtWidth + procureMeters * row.totalCostPerMeter) / totalMeters;
    }
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`text-[9px] px-1 py-0 flex-shrink-0 cursor-help ${
              coversAll
                ? 'bg-success-muted text-success border-success/20'
                : 'bg-warning-muted text-warning border-warning/20'
            }`}
          >
            Stock: {stockM.toLocaleString(undefined, { maximumFractionDigits: 0 })}m
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[260px] text-xs">
          <div className="space-y-1">
            <p className="font-semibold">
              {stockM.toLocaleString(undefined, { maximumFractionDigits: 1 })} m in stock at this width
            </p>
            {coversPcs != null && (
              <p>
                Covers ~{coversPcs.toLocaleString()} pcs
                {effectiveQty > 0 && toProcurePcs != null && (
                  <>
                    {' · '}
                    {coversAll ? (
                      <span className="text-success">covers full quantity</span>
                    ) : (
                      <>
                        to procure ~{toProcurePcs.toLocaleString()} pcs (~
                        {(toProcurePcs * row.cadMeters).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        m)
                      </>
                    )}
                  </>
                )}
              </p>
            )}
            {row.stockWacAtWidth != null && (
              <p>
                Stock WAC: ₹
                {row.stockWacAtWidth.toLocaleString('en-IN', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
                /m
              </p>
            )}
            {blended != null && (
              <p>
                Indicative blended: ₹
                {blended.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/m
              </p>
            )}
            <p className="text-muted-foreground pt-1 border-t border-border/50">
              Indicative only — actual allocation &amp; PO happen at Material Requisition (MRP)
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * The greige ₹/m cell: the rate, an honest source label, and — when the row's number differs
 * from today's price — the live rate with one click to adopt it.
 *
 * Shared by BOTH table layouts (flat and nested). They previously had separate inputs which had
 * already drifted: the nested one showed no source at all and recomputed the total with its own
 * shrinkage formula that bypassed the divide-by-shrinkage guard.
 */
function GreigeCostCell({
  row,
  onChange,
}: {
  row: FabricCostingRow;
  onChange: (updates: Partial<FabricCostingRow>) => void;
}) {
  const live = row.liveGreigeCostPerMeter;
  const stale = isGreigeRateStale(row);
  const label = greigeSourceLabel(row.greigeCostSource);
  const liveDescription = describeLiveRate(row);
  const missing = row.greigeCostPerMeter == null || row.greigeCostPerMeter <= 0;

  const applyLive = () => onChange({ greigeCostPerMeter: live, greigeCostSource: row.liveGreigeCostSource });

  const title = missing
    ? 'No greige rate available — enter one, or set a rate on the Greige Master'
    : [
        row.greigeCostSource === 'COMMITTED' ? 'The rate this costing was saved at' : null,
        row.greigeCostSource === 'MANUAL' ? 'Manually entered' : null,
        liveDescription ? `Live: ₹${live}/m ${liveDescription}` : null,
      ]
        .filter(Boolean)
        .join(' · ');

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-0.5">
        <Input
          type="number"
          step="0.01"
          placeholder="Greige"
          className={`w-14 text-center text-xs h-6 px-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
            missing
              ? 'border-destructive/60 bg-destructive/5'
              : row.greigeCostSource === 'MANUAL'
                ? 'border-warning/50 bg-warning-muted'
                : ''
          }`}
          value={row.greigeCostPerMeter ?? ''}
          onChange={(e) => {
            const parsed = parseFloat(e.target.value);
            onChange({
              greigeCostPerMeter: Number.isFinite(parsed) ? parsed : null,
              greigeCostSource: 'MANUAL',
            });
          }}
          title={title}
        />
        {stale && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 text-info hover:text-info"
            onClick={applyLive}
            title={`Use the live rate ₹${live}/m (${liveDescription})`}
          >
            <RefreshCw className="w-2.5 h-2.5" />
          </Button>
        )}
      </div>
      {/* No label at all when nothing resolved — this used to read "default" over an empty box */}
      {label && !missing && (
        <span
          className={`text-[8px] mt-0.5 ${
            row.greigeCostSource === 'MANUAL'
              ? 'text-warning'
              : row.greigeCostSource === 'COMMITTED'
                ? 'text-muted-foreground'
                : row.greigeCostSource === 'GREIGE_PROCUREMENT'
                  ? 'text-info'
                  : row.greigeCostSource === 'GREIGE_STOCK'
                    ? 'text-success'
                    : 'text-muted-foreground'
          }`}
          title={liveDescription ?? undefined}
        >
          {label}
        </span>
      )}
      {missing && <span className="text-[8px] mt-0.5 text-destructive">rate required</span>}
      {stale && !missing && (
        <span className="text-[8px] text-info mt-0.5" title={liveDescription ?? undefined}>
          live ₹{live}
        </span>
      )}
    </div>
  );
}

export default function FabricCostingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedStyleId = searchParams.get('styleId');
  const preselectedPurpose = searchParams.get('purpose') as CostingPurpose | null;

  // Validate and determine initial purpose from URL param
  const validPurposes: CostingPurpose[] = ['COSTING', 'RAW_MATERIAL_CALCULATION', 'PRODUCTION'];
  const hasExplicitPurpose = !!preselectedPurpose && validPurposes.includes(preselectedPurpose);
  const initialPurpose = hasExplicitPurpose ? (preselectedPurpose as CostingPurpose) : 'COSTING';

  // Selection state
  const [styles, setStyles] = useState<Style[]>([]);
  const [processors, setProcessors] = useState<ProcessorInfo[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedCustomerName, setSelectedCustomerName] = useState('');
  const [selectedStyleId, setSelectedStyleId] = useState('');
  const [orderQuantity, setOrderQuantity] = useState<number>(0);
  const [previousQuantity, setPreviousQuantity] = useState<number | null>(null);
  const [purpose, setPurpose] = useState<CostingPurpose>(initialPurpose);

  // Fabric rows
  const [fabricRows, setFabricRows] = useState<FabricCostingRow[]>([]);

  // Style search state
  const [styleSearchQuery, setStyleSearchQuery] = useState('');
  const [styleSearchResults, setStyleSearchResults] = useState<Style[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Loading states
  const [isLoadingStyles, setIsLoadingStyles] = useState(false);
  const [isLoadingFabrics, setIsLoadingFabrics] = useState(false);
  const [, setIsLoadingProcessors] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [, setApprovingRowId] = useState<string | null>(null);
  const [isRepeatOrder, setIsRepeatOrder] = useState(false); // Track if style is repeat order
  const [showStyleOptionsButton, setShowStyleOptionsButton] = useState(false); // Show "View Style Options" button after save
  const [styleCostingStatus, setStyleCostingStatus] = useState<Record<string, StyleCostingStatus>>({}); // Costing status for search results

  // Costing Run state
  const [existingRuns, setExistingRuns] = useState<CostingRun[]>([]);
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);
  const [showCreateRunDialog, setShowCreateRunDialog] = useState(false);
  const [isCreatingRun, setIsCreatingRun] = useState(false);
  const [savedCadIds, setSavedCadIds] = useState<string[]>([]);
  const [isDeletingRun, setIsDeletingRun] = useState<string | null>(null);

  // CAD validation state
  const [hasCADData, setHasCADData] = useState(true);
  const [isValidatingCAD, setIsValidatingCAD] = useState(false);

  // BUG-FC3 fix: Track unsaved changes - using hook for both beforeunload AND in-app navigation
  const initialLoadRef = useRef(true); // Prevent marking dirty on initial load
  const [internalDirty, setInternalDirty] = useState(false);
  // Ref to hold the save function for the dialog callback (avoids circular dependency)
  const saveRef = useRef<(() => Promise<void>) | null>(null);

  const { UnsavedDialog } = useUnsavedChanges({
    enabled: internalDirty,
    onSave: async () => {
      if (saveRef.current) {
        await saveRef.current();
      }
    },
    title: 'Unsaved Fabric Costing',
    description: 'You have unsaved changes to your fabric costing. Do you want to save them before leaving?',
  });

  // Pick the tab a style actually has costing on. Most entry points into this page don't
  // pass ?purpose=, so without this a style costed under RAW_MATERIAL_CALCULATION or
  // PRODUCTION opened on the empty COSTING tab and looked like it had default values.
  // Most advanced stage first.
  const pickCostedPurpose = useCallback((costedPurposes?: string[]): CostingPurpose | null => {
    const priority: CostingPurpose[] = ['PRODUCTION', 'RAW_MATERIAL_CALCULATION', 'COSTING'];
    return priority.find((p) => costedPurposes?.includes(p)) ?? null;
  }, []);

  // Fetch customer details when selectedCustomerId changes (to get name for style filtering)
  useEffect(() => {
    const fetchCustomerName = async () => {
      if (!selectedCustomerId) {
        setSelectedCustomerName('');
        return;
      }
      try {
        const customer = await customerService.getCustomerById(selectedCustomerId);
        setSelectedCustomerName(customer?.name || '');
      } catch {
        // Silently fail - name lookup is for filtering convenience
        setSelectedCustomerName('');
      }
    };
    fetchCustomerName();
  }, [selectedCustomerId]);

  // Fetch processors on mount
  useEffect(() => {
    const fetchProcessors = async () => {
      setIsLoadingProcessors(true);
      try {
        const data = await fabricCostingService.getProcessors();
        setProcessors(data);
      } catch {
        notify.error('Failed to load processors');
      } finally {
        setIsLoadingProcessors(false);
      }
    };
    fetchProcessors();
  }, []);

  // Handle preselected style from URL query param (e.g., from CAD Planning page)
  useEffect(() => {
    if (preselectedStyleId) {
      // Validate UUID format before making API call
      if (!isValidUUID(preselectedStyleId)) {
        notify.warning('Invalid style ID format in URL. Please search for the style manually.');
        return;
      }

      const loadPreselectedStyle = async () => {
        try {
          const response = await styleService.getStyleById(preselectedStyleId);
          if (response) {
            // Open on the stage that actually holds costing (unless the URL named one).
            // Resolved before selecting the style so the load effect runs once, on the right tab.
            if (!hasExplicitPurpose) {
              try {
                const statusMap = await fabricCostingService.getStylesCostingStatus([preselectedStyleId]);
                const costedPurpose = pickCostedPurpose(statusMap[preselectedStyleId]?.costedPurposes);
                if (costedPurpose) setPurpose(costedPurpose);
              } catch {
                // allow-silent-catch — picking the initial tab is a convenience; if the
                // status lookup fails we simply open on the default tab. Nothing to report.
              }
            }
            setSelectedStyleId(preselectedStyleId);
            setStyleSearchQuery(
              formatStyleCodeWithRef(response.styleCode, response.buyerStyleRef) +
                (response.styleName ? ` - ${response.styleName}` : '')
            );
            // Note: Customer auto-selection removed - CustomerCombobox handles selection independently
          }
        } catch {
          notify.error('Failed to load preselected style. It may have been deleted.');
        }
      };
      loadPreselectedStyle();
    }
  }, [preselectedStyleId, hasExplicitPurpose, pickCostedPurpose]);

  // Style search with debounce
  const handleStyleSearch = useCallback(
    (query: string) => {
      setStyleSearchQuery(query);

      // Clear previous timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      if (query.length < 2) {
        setStyleSearchResults([]);
        setShowSearchResults(false);
        return;
      }

      // Debounce search
      searchTimeoutRef.current = setTimeout(async () => {
        setIsSearching(true);
        try {
          // BUG FIX: Respect selected customer filter when searching
          // Include both ACTIVE and DRAFT styles for costing (no status filter)
          const response = await styleService.getAllStyles(
            1,
            20,
            query,
            undefined,
            undefined,
            selectedCustomerName || undefined,
            undefined
          );
          setStyleSearchResults(response.data);
          setShowSearchResults(true);

          // Fetch costing status for search results
          if (response.data.length > 0) {
            const styleIds = response.data.map((s: Style) => s.id);
            const statusMap = await fabricCostingService.getStylesCostingStatus(styleIds);
            setStyleCostingStatus(statusMap);
          }
        } catch {
          notify.error('Failed to search styles');
        } finally {
          setIsSearching(false);
        }
      }, 300);
    },
    [selectedCustomerName]
  );

  // Handle style selection from search
  const handleSearchResultSelect = (style: Style) => {
    // Open on the stage that actually holds costing. The search already fetched each
    // result's costing status, so no extra request is needed here.
    const costedPurpose = pickCostedPurpose(styleCostingStatus[style.id]?.costedPurposes);
    if (costedPurpose) setPurpose(costedPurpose);

    setSelectedStyleId(style.id);
    setStyleSearchQuery(
      formatStyleCodeWithRef(style.styleCode, style.buyerStyleRef) + (style.styleName ? ` - ${style.styleName}` : '')
    );
    setShowSearchResults(false);
    setStyleSearchResults([]);
    setIsRepeatOrder(false); // Reset repeat order status when selecting new style
    setPreviousQuantity(null); // Reset previous quantity indicator
    setOrderQuantity(0); // Reset order quantity for new style (will be loaded from saved data)
    // BUG-FC3 fix: Reset dirty tracking for new style
    setInternalDirty(false);
    initialLoadRef.current = true;

    // Note: Customer auto-selection removed - CustomerCombobox handles selection independently
  };

  // Clear search
  const clearSearch = () => {
    setStyleSearchQuery('');
    setStyleSearchResults([]);
    setShowSearchResults(false);
    setSelectedStyleId('');
    setSelectedCustomerId('');
    setFabricRows([]);
    setIsRepeatOrder(false); // Reset repeat order status
    setPreviousQuantity(null); // Reset previous quantity indicator
    setOrderQuantity(0); // Reset order quantity
    // BUG-FC3 fix: Reset dirty tracking when clearing
    setInternalDirty(false);
    initialLoadRef.current = true;
  };

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup search timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // BUG-FC3 fix: Track changes to fabric rows after initial load
  // (The useUnsavedChanges hook handles beforeunload AND in-app navigation blocking)
  useEffect(() => {
    if (initialLoadRef.current) {
      // Skip the first render after loading fabric data
      if (fabricRows.length > 0) {
        initialLoadRef.current = false;
      }
      return;
    }
    // Any subsequent change to fabricRows marks form as dirty
    setInternalDirty(true);
  }, [fabricRows]);

  // Fetch styles when customer is selected
  useEffect(() => {
    const fetchStyles = async () => {
      if (!selectedCustomerId) {
        setStyles([]);
        setSelectedStyleId('');
        return;
      }

      // Wait for customer name to be fetched
      if (!selectedCustomerName) {
        return;
      }

      setIsLoadingStyles(true);
      try {
        // Include both ACTIVE and DRAFT styles for costing (no status filter)
        const response = await styleService.getAllStyles(
          1,
          1000,
          undefined,
          undefined,
          undefined,
          selectedCustomerName,
          undefined
        );
        setStyles(response.data);
      } catch {
        notify.error('Failed to load styles');
      } finally {
        setIsLoadingStyles(false);
      }
    };
    fetchStyles();
  }, [selectedCustomerId, selectedCustomerName]);

  // Fetch fabrics for selected style - extracted to useCallback so it can be called after save
  const fetchStyleFabrics = useCallback(
    async (preserveUserEdits = false) => {
      if (!selectedStyleId) {
        setFabricRows([]);
        return;
      }

      setIsLoadingFabrics(true);
      try {
        const response = await fabricCostingService.getStyleFabrics(selectedStyleId, purpose);

        // If preserveUserEdits is true, merge new IDs with existing row data
        // This preserves user's edits while updating fabricWidthCadId from saved records
        if (preserveUserEdits && fabricRows.length > 0) {
          const updatedRows = fabricRows.map((existingRow) => {
            // Find matching fabric from response by id (the cadRow.id which becomes fabricWidthCadId)
            // The backend returns data directly on fabric objects, not in widthOptions
            const matchingFabric = response.fabrics.find((f: FabricForCosting) => f.id === existingRow.id);
            if (matchingFabric) {
              return {
                ...existingRow,
                fabricWidthCadId: matchingFabric.id, // Update with the saved ID from database
                // Refresh approval + saved-costing state too — without this a row approved
                // elsewhere (or just saved here) keeps stale local state until full reload
                approvalStatus: matchingFabric.approvalStatus ?? null,
                costingApprovalStatus: matchingFabric.costingApprovalStatus ?? null,
                hasSavedCosting: matchingFabric.totalCostPerMeter != null,
                savedOrderQuantityPcs: matchingFabric.orderQuantityPcs ?? null,
              };
            }
            return existingRow;
          });
          setFabricRows(updatedRows);
          setIsLoadingFabrics(false);
          return;
        }

        // Convert FabricForCosting to FabricCostingRow
        const rows: FabricCostingRow[] = response.fabrics.map((fabric: FabricForCosting) => {
          // Ready fabric workflow: no greige AND no generic greige name means true ready-to-use fabric
          // (genericGreigeName signals a greige workflow awaiting master creation)
          const isReadyFabricWorkflow = !fabric.greigeId && !fabric.genericGreigeName;
          // Check if ready fabric cost is available from fabric_master
          const hasReadyFabricCost = fabric.readyFabricCost != null && fabric.readyFabricCost > 0;

          // Each returned fabric IS one CAD row, and the backend puts its saved costing
          // directly on the fabric object (widthOptions is always []). Reading the saved
          // values off `fabric` is what makes a reopened page show the last saved costing.
          if (fabric.totalCostPerMeter != null) {
            return {
              id: fabric.id,
              styleFabricId: fabric.styleFabricId || fabric.id, // For unique key grouping
              fabricId: fabric.fabricId,
              fabricWidthCadId: fabric.id,
              savedOrderQuantityPcs: fabric.orderQuantityPcs || null, // Track saved quantity for clone detection
              rowQuantity: fabric.orderQuantityPcs || undefined, // Pre-populate Qty column with saved quantity
              createdAt: fabric.createdAt || null, // Timestamp for date-based grouping
              fabricName: fabric.fabricName,
              genericGreigeName: fabric.genericGreigeName,
              componentName: fabric.componentName,
              cadMeters: fabric.cadMeters || 0,
              width: fabric.width || 0,
              finishType: fabric.finishType,

              // Greige reference - from saved data
              greigeId: fabric.greigeId,
              greigeName: fabric.greigeName,
              greigeCode: fabric.greigeCode,
              greigeDefaultCost: fabric.greigeDefaultCost,

              // Ready fabric cost from fabric_master
              readyFabricCost: fabric.readyFabricCost,

              // Finished-fabric stock at this width (display-only)
              stockAtWidth: fabric.stockAtWidth ?? null,
              stockWacAtWidth: fabric.stockWacAtWidth ?? null,

              // Cost input mode from saved data. Older rows may carry a non-costing value
              // (CAD Planning used to stamp 'AUTO_CALCULATED'/'MANUAL' here), so anything
              // that isn't LANDED_PRICE is treated as the BUILD_UP default.
              costInputMode: (fabric.costInputMode === 'LANDED_PRICE' ? 'LANDED_PRICE' : 'BUILD_UP') as CostInputMode,

              // Landed price mode
              landedPricePerMeter: fabric.costInputMode === 'LANDED_PRICE' ? (fabric.totalCostPerMeter ?? null) : null,

              // Build-up mode - Greige & Transport.
              // resolveGreigeCost owns the precedence for BOTH branches — this logic was
              // duplicated here and below, which is how the costed/uncosted paths drifted apart.
              ...resolveGreigeCost(fabric, true),
              transportCostMode: 'PER_METER' as TransportCostMode,
              transportCostPerMeter: fabric.transportCostPerMeter ?? 2, // Default ₹2/m
              transportFixedAmount: null,

              // Shrinkage (from saved data, fallback to API which includes greige master default)
              shrinkagePercent: fabric.shrinkagePercent,
              shrinkageValue: fabric.shrinkageCostPerMeter ?? null,

              // Processor selection (from saved data or fabric directly)
              processorId: fabric.processorId || null,
              processorName: fabric.processorName || null,
              processingType:
                fabric.finishType === 'PRINTED'
                  ? 'PRINTING'
                  : fabric.finishType === 'DYED' || fabric.finishType === 'YARN_DYED'
                    ? 'DYEING'
                    : null,
              printingType: fabric.printingType ?? null,
              processingCostPerMeter: fabric.processingPricePerMeter || null,
              slabLabel: null,
              // MRP-48d: restore which rate card the saved numbers came from, so re-saving
              // doesn't silently drop the processor's committed shrinkage/print type
              rateCardId: fabric.rateCardId ?? null,

              // Screen cost (from saved data or fabric directly)
              numberOfColors: fabric.numberOfColors,
              screenType: fabric.screenType as ScreenType | null,
              // BUG-FC4 fix: derive screenCostPerScreen from saved values when possible
              // Formula: screenCostPerScreen = screenCostPerMeter * totalMeters / numberOfColors
              screenCostPerScreen: (() => {
                const savedScreenCostPerMeter = fabric.screenCostPerMeter ?? null;
                const savedNumColors = fabric.numberOfColors;
                const savedCadMeters = fabric.cadMeters || 0;
                const savedQty = fabric.orderQuantityPcs || 0;
                if (savedScreenCostPerMeter && savedNumColors && savedCadMeters > 0 && savedQty > 0) {
                  const totalMeters = savedCadMeters * savedQty;
                  return (savedScreenCostPerMeter * totalMeters) / savedNumColors;
                }
                return null;
              })(),
              screenCostTotal: null,
              screenCostPerMeter: fabric.screenCostPerMeter ?? null,

              // Calculated totals (from saved data or fabric directly)
              totalCostPerMeter: fabric.totalCostPerMeter || null,
              totalCostForQuantity: null,

              // Design/Color identification (from style)
              colorMasterId: fabric.colorMasterId || null,
              colorName: fabric.colorName || null,

              // Processing batch group - auto-populated from style's color
              processingBatchGroupColorId: fabric.colorMasterId || null,
              processingBatchGroupColorName: fabric.colorName || null,
              batchRate: null,
              individualRate: null,
              batchSavings: null,
              batchGroupTotalQuantity: null,

              // UI state
              isExpanded: false,
              isLoading: false,
              error: null,
              // Two-owner split: approvalStatus = CAD geometry, costingApprovalStatus = price
              approvalStatus: fabric.approvalStatus || null,
              costingApprovalStatus: fabric.costingApprovalStatus || null,
              hasSavedCosting: true, // this branch = row had a saved costing in the DB at load
            };
          }

          // No existing costing, create default row
          // CAD rows have id (cadRow.id) ≠ styleFabricId, legacy rows have id = styleFabricId
          const isCadRow = fabric.id !== (fabric.styleFabricId || fabric.id);
          return {
            id: fabric.id,
            styleFabricId: fabric.styleFabricId || fabric.id, // For unique key grouping
            fabricId: fabric.fabricId,
            fabricWidthCadId: isCadRow ? fabric.id : null, // Use fabric.id for CAD rows (it's the cadRow.id)
            savedOrderQuantityPcs: null, // No saved quantity for new rows
            rowQuantity: undefined, // Will use global orderQuantity
            createdAt: null, // New row, not yet saved
            fabricName: fabric.fabricName,
            genericGreigeName: fabric.genericGreigeName,
            componentName: fabric.componentName,
            cadMeters: fabric.cadMeters || 0,
            width: fabric.width || 0,
            finishType: fabric.finishType,

            // Greige reference
            greigeId: fabric.greigeId,
            greigeName: fabric.greigeName,
            greigeCode: fabric.greigeCode,
            greigeDefaultCost: fabric.greigeDefaultCost,

            // Ready fabric cost from fabric_master
            readyFabricCost: fabric.readyFabricCost,

            // Finished-fabric stock at this width (display-only)
            stockAtWidth: fabric.stockAtWidth ?? null,
            stockWacAtWidth: fabric.stockWacAtWidth ?? null,

            // Default to Landed Price mode for ready fabric workflow OR if ready fabric cost is available
            costInputMode:
              isReadyFabricWorkflow || hasReadyFabricCost
                ? ('LANDED_PRICE' as CostInputMode)
                : ('BUILD_UP' as CostInputMode),

            // Landed price mode - default to ready fabric cost if available
            landedPricePerMeter: isReadyFabricWorkflow || hasReadyFabricCost ? (fabric.readyFabricCost ?? null) : null,

            // Build-up mode - Greige & Transport. Never costed, so this shows TODAY's rate:
            // a new GRN takes effect immediately instead of a months-old CAD snapshot winning.
            ...resolveGreigeCost(fabric, false),
            transportCostMode: 'PER_METER' as TransportCostMode,
            transportCostPerMeter: fabric.transportCostPerMeter ?? 2, // Use saved or default ₹2/m
            transportFixedAmount: null,

            // Shrinkage - use API response which includes greige master fallback
            shrinkagePercent: fabric.shrinkagePercent || null,
            shrinkageValue: null,

            // Processor selection - use API response if available (from saved CAD data)
            processorId: fabric.processorId || null,
            processorName: fabric.processorName || null,
            processingType:
              fabric.finishType === 'PRINTED'
                ? 'PRINTING'
                : fabric.finishType === 'DYED' || fabric.finishType === 'YARN_DYED'
                  ? 'DYEING'
                  : null,
            printingType: null,
            processingCostPerMeter: fabric.processingPricePerMeter || null,
            slabLabel: null,
            rateCardId: null,

            // Screen cost - use API response if available
            numberOfColors: fabric.numberOfColors,
            screenType: (fabric.screenType as ScreenType) || null,
            screenCostPerScreen: null,
            screenCostTotal: null,
            screenCostPerMeter: null,

            // Calculated totals - use API response if available
            totalCostPerMeter: fabric.totalCostPerMeter || null,
            totalCostForQuantity: null,

            // Design/Color identification (from style)
            colorMasterId: fabric.colorMasterId || null,
            colorName: fabric.colorName || null,

            // Processing batch group - auto-populated from style's color
            processingBatchGroupColorId: fabric.colorMasterId || null,
            processingBatchGroupColorName: fabric.colorName || null,
            batchRate: null,
            individualRate: null,
            batchSavings: null,
            batchGroupTotalQuantity: null,

            // UI state
            isExpanded: false,
            isLoading: false,
            error: null,
            // Two-owner split: a CAD-approved row with no costing is a LEGITIMATE state that
            // must accept its first costing save — only the PRICE approval skips a row.
            approvalStatus: fabric.approvalStatus || null,
            costingApprovalStatus: fabric.costingApprovalStatus || null,
            hasSavedCosting: false, // this branch = no saved costing in the DB at load
          };
        });

        // Calculate initial totalCostPerMeter for rows that have landed price set
        const rowsWithTotals = rows.map((row) => {
          if (row.costInputMode === 'LANDED_PRICE' && row.landedPricePerMeter) {
            return {
              ...row,
              totalCostPerMeter: row.landedPricePerMeter,
            };
          }
          return row;
        });

        setFabricRows(rowsWithTotals);

        // Extract orderQuantityPcs from loaded fabrics - use MOST RECENT by createdAt
        const fabricsWithQuantity = response.fabrics
          .filter((f: FabricForCosting) => f.orderQuantityPcs != null && f.orderQuantityPcs > 0)
          .sort((a: FabricForCosting, b: FabricForCosting) => {
            // Sort by createdAt descending (most recent first)
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
          });

        if (fabricsWithQuantity.length > 0) {
          const mostRecentQuantity = fabricsWithQuantity[0].orderQuantityPcs!;
          setPreviousQuantity(mostRecentQuantity);

          // Only set if current orderQuantity is 0 (not already entered by user)
          if (orderQuantity === 0) {
            setOrderQuantity(mostRecentQuantity);
          }

          // Info if different quantities exist (e.g., 500 pcs and 1000 pcs options)
          const uniqueQuantities = [...new Set(fabricsWithQuantity.map((f) => f.orderQuantityPcs))];
          if (uniqueQuantities.length > 1) {
            notify.info(
              `Multiple quantity options found: ${uniqueQuantities.join(', ')} pcs. ` +
                `Loading most recent: ${mostRecentQuantity} pcs.`
            );
          }
        } else {
          setPreviousQuantity(null);
        }

        notify.success(`Loaded ${rowsWithTotals.length} fabrics from style`);
      } catch {
        notify.error('Failed to load style fabrics');
      } finally {
        setIsLoadingFabrics(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedStyleId, fabricRows.length, purpose]
  );

  // Validate if style has CAD data from CAD Planning
  const validateCADData = useCallback(async () => {
    if (!selectedStyleId) {
      setHasCADData(true);
      return;
    }

    setIsValidatingCAD(true);
    try {
      const validation = await fabricCostingService.validateStyleCADData(selectedStyleId, purpose);
      setHasCADData(validation.hasCADData);

      if (!validation.hasCADData) {
        notify.warning('This style has no CAD data. Please create CAD data in CAD Planning first.');
      }
    } catch (error) {
      console.error('Failed to validate CAD data:', error);
      // Assume CAD data exists if validation fails (don't block user)
      setHasCADData(true);
    } finally {
      setIsValidatingCAD(false);
    }
  }, [selectedStyleId, purpose]);

  // Call fetchStyleFabrics and validate CAD when selectedStyleId or purpose changes
  useEffect(() => {
    // Reset the "View Style Options" button when style/purpose changes
    setShowStyleOptionsButton(false);
    if (selectedStyleId) {
      validateCADData();
      fetchStyleFabrics(false);
    }
  }, [selectedStyleId, purpose]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch existing costing runs when style and purpose change
  useEffect(() => {
    const fetchRuns = async () => {
      if (!selectedStyleId) {
        setExistingRuns([]);
        return;
      }
      setIsLoadingRuns(true);
      try {
        const runs = await getRunsByStyle(selectedStyleId, purpose);
        setExistingRuns(runs);
      } catch (error) {
        console.error('Failed to fetch costing runs:', error);
        setExistingRuns([]);
      } finally {
        setIsLoadingRuns(false);
      }
    };
    fetchRuns();
  }, [selectedStyleId, purpose]);

  // Calculate cost per meter for a row
  // Note: totalCostForQuantity is kept for internal calculations (screen cost amortization)
  // but is NOT displayed to users - this page only shows ₹/m
  const calculateRowTotals = useCallback(
    (row: FabricCostingRow): FabricCostingRow => {
      // Use row-level quantity if set, otherwise fall back to global orderQuantity
      const rowQty = row.rowQuantity || orderQuantity;
      const totalQuantity = row.cadMeters * rowQty;

      // If landed price mode
      if (row.costInputMode === 'LANDED_PRICE') {
        const totalCostPerMeter = row.landedPricePerMeter;
        return {
          ...row,
          totalCostPerMeter,
          totalCostForQuantity: null, // Not used in this page
        };
      }

      // Build-up mode
      const greigeCost = row.greigeCostPerMeter || 0;

      // Transport cost per meter
      let transportPerMeter = 0;
      if (row.transportCostMode === 'PER_METER') {
        transportPerMeter = row.transportCostPerMeter || 0;
      } else if (row.transportFixedAmount && totalQuantity > 0) {
        transportPerMeter = row.transportFixedAmount / totalQuantity;
      }

      // BUG-FC1 fix: Shrinkage-adjusted greige cost using divideByShrinkage helper
      // Guards against Infinity at 100% shrinkage (bug-hunt BH-0364/BH-0366)
      const shrinkagePct = row.shrinkagePercent || 0;
      const shrinkageAdjustedGreige = divideByShrinkage(greigeCost, shrinkagePct);
      // The "shrinkage value" is the difference between adjusted and original
      const shrinkageValue = shrinkageAdjustedGreige - greigeCost;

      // Processing cost
      const processingCost = row.processingCostPerMeter || 0;

      // Screen cost per meter (for PRINTING only - amortized over estimated quantity)
      let screenCostPerMeter = 0;
      let screenCostTotal = null;
      let effectiveScreenCostPerScreen = row.screenCostPerScreen;

      // BUG-FC4 FIX: Only apply default screen cost for NEW rows (no fabricWidthCadId).
      // Saved rows may have intentionally null/zero screen cost - don't overwrite with defaults.
      if (!effectiveScreenCostPerScreen && row.screenType && !row.fabricWidthCadId) {
        effectiveScreenCostPerScreen = DEFAULT_SCREEN_COSTS[row.screenType];
      }

      if (row.processingType === 'PRINTING' && effectiveScreenCostPerScreen && row.numberOfColors) {
        screenCostTotal = effectiveScreenCostPerScreen * row.numberOfColors;
        screenCostPerMeter = totalQuantity > 0 ? screenCostTotal / totalQuantity : 0;
      }

      // Total per meter
      const totalCostPerMeter = greigeCost + transportPerMeter + shrinkageValue + processingCost + screenCostPerMeter;

      return {
        ...row,
        shrinkageValue,
        screenCostTotal,
        screenCostPerMeter: screenCostPerMeter > 0 ? screenCostPerMeter : null,
        totalCostPerMeter,
        totalCostForQuantity: null, // Not used in this page
      };
    },
    [orderQuantity]
  );

  // Recalculate all rows when orderQuantity changes
  useEffect(() => {
    if (fabricRows.length > 0) {
      setFabricRows((rows) => rows.map((row) => calculateRowTotals(row)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderQuantity, calculateRowTotals]);

  // Update a single row
  const updateRow = (index: number, updates: Partial<FabricCostingRow>) => {
    setFabricRows((rows) => {
      const newRows = [...rows];
      newRows[index] = calculateRowTotals({ ...newRows[index], ...updates });
      return newRows;
    });
  };

  // Lookup processor rate
  // overrides: optional partial row data for values not yet committed to state
  const lookupRate = async (index: number, overrides?: Partial<FabricCostingRow>) => {
    const baseRow = fabricRows[index];
    const row = overrides ? { ...baseRow, ...overrides } : baseRow;

    if (!row.processorId || !row.processingType || !row.greigeId) {
      notify.warning('Please select a processor and ensure greige is set');
      return;
    }

    // For PRINTING, we need printingType
    if (row.processingType === 'PRINTING' && !row.printingType) {
      notify.warning('Please select a printing type');
      return;
    }

    // Use row-level quantity if set, otherwise fall back to global orderQuantity
    const rowQty = row.rowQuantity || orderQuantity;
    const rowQuantityMeters = row.cadMeters * rowQty;
    if (rowQuantityMeters <= 0) {
      notify.warning('Order quantity must be greater than 0');
      return;
    }

    // Check if this row is part of a processing batch group
    const hasBatchGroup = row.processingBatchGroupColorId != null;
    let batchQuantityMeters = rowQuantityMeters;

    if (hasBatchGroup) {
      // Calculate combined quantity for all rows in this batch group
      // Batch key: same greigeId + same processorId + same batch color
      // The current row's processor may exist only in `overrides` (state not yet
      // committed on processor select), so substitute `row` for the current index
      // — otherwise the self-row fails the processorId match and the sum is 0.
      //
      // Rows sharing styleFabricId + width are the same physical fabric saved at
      // different times (quantity-change clones) — only the newest may count, or
      // the batch quantity inflates and the slab lookup understates the rate.
      const newestPerFabric = new Map<string, { candidate: FabricCostingRow; t: number }>();
      fabricRows.forEach((r, i) => {
        const candidate = i === index ? row : r;
        const key = `${candidate.styleFabricId ?? candidate.id}|${candidate.width}`;
        const t =
          i === index
            ? Number.MAX_SAFE_INTEGER // the row being edited always wins its slot
            : candidate.createdAt
              ? new Date(candidate.createdAt).getTime()
              : Number.MAX_SAFE_INTEGER - 1; // unsaved rows are newer than any saved one
        const prev = newestPerFabric.get(key);
        if (!prev || t >= prev.t) newestPerFabric.set(key, { candidate, t });
      });
      batchQuantityMeters = [...newestPerFabric.values()].reduce((sum, { candidate }) => {
        if (
          candidate.greigeId === row.greigeId &&
          candidate.processorId === row.processorId &&
          candidate.processingBatchGroupColorId === row.processingBatchGroupColorId
        ) {
          const rQty = candidate.rowQuantity || orderQuantity;
          return sum + candidate.cadMeters * rQty;
        }
        return sum;
      }, 0);
    }

    updateRow(index, { isLoading: true, error: null });

    try {
      // Lookup rate using batch (combined) quantity if in a batch group, else individual
      const result = await fabricCostingService.lookupRate({
        processorId: row.processorId,
        processingType: row.processingType,
        printingType: row.printingType || undefined,
        greigeId: row.greigeId,
        quantityMeters: hasBatchGroup ? batchQuantityMeters : rowQuantityMeters,
      });

      // Also lookup individual rate for comparison when in a batch group
      let individualResult: ProcessorRateLookup | null = null;
      if (hasBatchGroup && batchQuantityMeters !== rowQuantityMeters) {
        try {
          individualResult = await fabricCostingService.lookupRate({
            processorId: row.processorId,
            processingType: row.processingType,
            printingType: row.printingType || undefined,
            greigeId: row.greigeId,
            quantityMeters: rowQuantityMeters,
          });
        } catch {
          // Individual lookup failure is not critical
        }
      }

      if (result) {
        const batchRate = result.ratePerMeter;
        const indivRate = individualResult?.ratePerMeter ?? null;
        const savings = indivRate != null ? indivRate - batchRate : null;

        // Update THIS row
        updateRow(index, {
          processingCostPerMeter: batchRate,
          slabLabel: result.slabLabel,
          rateCardId: result.id,
          processorName: result.processorName,
          shrinkagePercent: result.shrinkagePercent,
          screenCostPerScreen: result.screenCostPerScreen,
          batchRate: hasBatchGroup ? batchRate : null,
          individualRate: indivRate,
          batchSavings: savings,
          batchGroupTotalQuantity: hasBatchGroup ? batchQuantityMeters : null,
          isLoading: false,
        });

        // If batch group, also update ALL OTHER rows in the same batch
        if (hasBatchGroup) {
          fabricRows.forEach((r, i) => {
            if (
              i !== index &&
              r.greigeId === row.greigeId &&
              r.processorId === row.processorId &&
              r.processingBatchGroupColorId === row.processingBatchGroupColorId
            ) {
              // Calculate this row's individual quantity for comparison
              const otherRowQty = r.rowQuantity || orderQuantity;
              const otherRowMeters = r.cadMeters * otherRowQty;

              // Lookup individual rate for this row asynchronously
              fabricCostingService
                .lookupRate({
                  processorId: r.processorId!,
                  processingType: r.processingType!,
                  printingType: r.printingType || undefined,
                  greigeId: r.greigeId!,
                  quantityMeters: otherRowMeters,
                })
                .then((otherIndivResult) => {
                  const otherIndivRate = otherIndivResult?.ratePerMeter ?? null;
                  const otherSavings = otherIndivRate != null ? otherIndivRate - batchRate : null;
                  updateRow(i, {
                    processingCostPerMeter: batchRate,
                    slabLabel: result.slabLabel,
                    shrinkagePercent: result.shrinkagePercent,
                    screenCostPerScreen: result.screenCostPerScreen,
                    batchRate: batchRate,
                    individualRate: otherIndivRate,
                    batchSavings: otherSavings,
                    batchGroupTotalQuantity: batchQuantityMeters,
                  });
                })
                .catch(() => {
                  // Still apply batch rate even if individual lookup fails
                  updateRow(i, {
                    processingCostPerMeter: batchRate,
                    slabLabel: result.slabLabel,
                    shrinkagePercent: result.shrinkagePercent,
                    batchRate: batchRate,
                    individualRate: null,
                    batchSavings: null,
                    batchGroupTotalQuantity: batchQuantityMeters,
                  });
                });
            }
          });

          notify.success(
            `Batch rate loaded: ₹${batchRate}/m for ${batchQuantityMeters.toFixed(0)}m combined (${result.slabLabel})`
          );
        } else {
          notify.success(`Rate loaded: ₹${result.ratePerMeter}/m (${result.slabLabel})`);
        }
      } else {
        updateRow(index, {
          processingCostPerMeter: null,
          slabLabel: null,
          rateCardId: null,
          shrinkagePercent: null,
          screenCostPerScreen: null,
          batchRate: null,
          individualRate: null,
          batchSavings: null,
          batchGroupTotalQuantity: null,
          isLoading: false,
          error: 'No rate found for this processor/greige/quantity',
        });
        notify.warning('No rate found for this combination', {
          description: 'Please add the rate in Processor Rate Card',
          action: {
            label: 'Go to Rate Cards',
            onClick: () => navigate('/processor-rate-cards'),
          },
          duration: 8000,
        });
      }
    } catch (error: unknown) {
      // getErrorMessage prefers the backend's human message over the machine code —
      // the old data.error read rendered raw "VALIDATION_ERROR" toasts
      const errorMessage = getErrorMessage(error) || 'Failed to lookup rate';

      updateRow(index, {
        isLoading: false,
        error: errorMessage,
      });

      // Show detailed error
      notify.error(errorMessage);
    }
  };

  // Save fabric costing - saves to fabric_width_cad
  const handleSave = async () => {
    if (!selectedStyleId) {
      notify.error('Please select a style first');
      return;
    }

    // Save rows that have a calculated cost (fabricId is optional - supports generic fabrics)
    const costedRows = fabricRows.filter((row) => row.totalCostPerMeter != null);

    // Helper to describe a row for warning messages
    const describeRow = (row: FabricCostingRow) =>
      `${row.componentName || row.fabricName || 'fabric'}${row.width ? ` ${row.width}"` : ''}`;

    // LANDED_PRICE rows without a price have totalCostPerMeter = null and are silently excluded
    // from costedRows. Warn the user so they know why rows aren't being saved.
    const missingLandedPrice = fabricRows.filter(
      (row) => row.costInputMode === 'LANDED_PRICE' && !row.landedPricePerMeter
    );
    if (missingLandedPrice.length > 0) {
      notify.warning(
        `${missingLandedPrice.length} row(s) in Landed Price mode without a price: ${missingLandedPrice.map(describeRow).join(', ')}. Enter a landed price or switch to Build Up mode.`
      );
    }

    // A build-up row with no greige price is not a costing — calculateRowTotals treats a missing
    // greige rate as ₹0, so the row still totals the ₹2 transport default and used to save
    // silently, feeding ₹2/m fabric into the cost sheet and MRP. Landed-price rows never use greige.
    const missingGreige = costedRows.filter(
      (row) => row.costInputMode === 'BUILD_UP' && !(row.greigeCostPerMeter != null && row.greigeCostPerMeter > 0)
    );
    // Don't send rows whose COSTING is approved — the backend rejects re-pricing an approved
    // costing. Two-owner split: CAD-geometry approval alone must NOT skip a row (a CAD-approved
    // row with no saved costing needs its FIRST costing saved). hasSavedCosting is
    // defense-in-depth: costing approval implies a saved cost.
    const approvedRows = costedRows.filter(
      (row) =>
        (row.costingApprovalStatus === 'APPROVED' || row.costingApprovalStatus === 'ALTERNATE_APPROVED') &&
        row.hasSavedCosting
    );
    const rowsToSave = costedRows.filter((row) => !missingGreige.includes(row) && !approvedRows.includes(row));

    if (rowsToSave.length === 0) {
      const hasMissingPrices = missingGreige.length > 0 || missingLandedPrice.length > 0;
      const allApproved = approvedRows.length > 0 && !hasMissingPrices && costedRows.length === approvedRows.length;
      notify.error(
        allApproved
          ? 'All rows have an approved costing. Unapprove on the Options page first to modify.'
          : hasMissingPrices
            ? missingGreige.length > 0
              ? `Cannot save: no greige price for ${missingGreige.map(describeRow).join(', ')}. Enter a rate, or set one on the Greige Master.`
              : `Cannot save: no landed price for ${missingLandedPrice.map(describeRow).join(', ')}. Enter a landed price or switch to Build Up mode.`
            : 'No fabrics with calculated costs to save'
      );
      return;
    }

    if (missingGreige.length > 0) {
      notify.warning(
        `Skipped ${missingGreige.length} fabric(s) with no greige price: ${missingGreige.map(describeRow).join(', ')}`
      );
    }

    // Notify user if some rows were skipped because their costing is approved
    if (approvedRows.length > 0) {
      notify.info(
        `${approvedRows.length} approved costing(s) unchanged. Unapprove on the Options page first to modify.`
      );
    }

    setIsSaving(true);
    try {
      const response = await fabricCostingService.saveFabricCosting({
        styleId: selectedStyleId,
        fabricCostings: rowsToSave.map((row) => {
          // Detect quantity change: if saved quantity exists and current quantity is different, clone instead of update
          const currentQty = row.rowQuantity ?? orderQuantity ?? 0;
          const savedQty = row.savedOrderQuantityPcs;
          const quantityChanged = savedQty != null && savedQty > 0 && currentQty !== savedQty && currentQty > 0;

          return {
            // fabric_width_cad identification - clone mode if quantity changed
            fabricWidthCadId: quantityChanged ? null : row.fabricWidthCadId,
            cloneFromCadId: quantityChanged ? (row.fabricWidthCadId ?? undefined) : undefined,
            styleFabricId: row.styleFabricId, // For unique key (multi-fabric same-component support)
            fabricId: row.fabricId,
            // NOTE: cutableWidth and componentName are CAD-owned fields - don't send them
            // They are managed by CAD Planning module only
            // Greige and Transport
            greigeId: row.greigeId,
            greigeCostPerMeter: row.costInputMode === 'BUILD_UP' ? row.greigeCostPerMeter : null,
            transportCostPerMeter: row.costInputMode === 'BUILD_UP' ? row.transportCostPerMeter : null,
            // Processing
            processorId: row.processorId,
            // MRP-48d: the card the rate lookup resolved (held in row state since :1090) was
            // being dropped here. Sending it persists WHICH processor rate — and therefore which
            // committed shrinkage, process type and print type — these numbers came from, so the
            // cost sheet, BOM and MRP all price and plan off the same row.
            rateCardId: row.rateCardId ?? null,
            processingCostPerMeter: row.costInputMode === 'BUILD_UP' ? row.processingCostPerMeter : null,
            // Shrinkage
            shrinkagePercent: row.shrinkagePercent,
            shrinkageCostPerMeter: row.shrinkageValue,
            // Screen cost (for printing)
            screenCostPerMeter: row.screenCostPerMeter,
            screenType: row.screenType,
            numberOfColors: row.numberOfColors,
            // Total
            totalCostPerMeter: row.totalCostPerMeter,
            // Mode
            costInputMode: row.costInputMode,
            // Order quantity used for slab rate lookup (use row-level if set)
            // Use nullish coalescing (??) to preserve 0 as a valid value
            orderQuantityPcs: row.rowQuantity ?? orderQuantity ?? 0,
            // Qty-rate audit 2026-08-24: persist the EXACT meters the slab lookup ran on.
            // For a batch-grouped row that is the COMBINED group total (held in row state,
            // reconstructable nowhere else) — without it a downstream re-check at the order's
            // own meters reports a phantom rate rise on every batched row.
            costedAtQuantityMeters:
              row.processingBatchGroupColorId != null && row.batchGroupTotalQuantity != null
                ? row.batchGroupTotalQuantity
                : row.cadMeters * (row.rowQuantity ?? orderQuantity ?? 0),
            costedRateIsBatch: row.processingBatchGroupColorId != null && row.batchGroupTotalQuantity != null,
            // NOTE: cadMeters is CAD-owned - don't send it (managed by CAD Planning)
            // Workflow purpose mode
            purpose: purpose,
            // Processing batch group
            processingBatchGroupColorId: row.processingBatchGroupColorId || null,
          };
        }),
      });

      // Update repeat order status from backend response
      if (response.isRepeatOrder) {
        setIsRepeatOrder(true);
        notify.info('Repeat Order: Costings saved directly to PRODUCTION mode');
      }

      notify.success(`Saved costing for ${rowsToSave.length} fabric(s) to fabric_width_cad`);
      // BUG-FC3 fix: Mark as clean after successful save
      setInternalDirty(false);
      // Show the "View Style Options" button after successful save
      setShowStyleOptionsButton(true);
      // Re-fetch with preserveUserEdits to get the new fabricWidthCadIds from database
      // This enables the Approve button which requires fabricWidthCadId
      await fetchStyleFabrics(true);

      // Collect saved CAD IDs for potential run creation.
      // Prefer the ids the backend reports it wrote: clone mode creates NEW rows, so the
      // local fabricRows state can't know them and the run would be linked to the
      // superseded rows (which then show as a run with 0 fabrics).
      const cadIds =
        response.records && response.records.length > 0
          ? response.records.map((r) => r.id)
          : fabricRows.filter((row) => row.fabricWidthCadId).map((row) => row.fabricWidthCadId as string);
      if (cadIds.length > 0) {
        setSavedCadIds(cadIds);
        // Show create run dialog
        setShowCreateRunDialog(true);
      }
    } catch (error: unknown) {
      const msg = getErrorMessage(error) || 'Failed to save fabric costing';
      notify.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // BUG-FC3 fix: Update saveRef so the unsaved changes dialog can call handleSave
  // Direct assignment is fine since ref persists across renders
  saveRef.current = handleSave;

  // Create a new costing run from saved CAD IDs
  const handleCreateRun = async () => {
    if (!selectedStyleId || savedCadIds.length === 0) return;

    setIsCreatingRun(true);
    try {
      const newRun = await createRun(selectedStyleId, purpose, savedCadIds);
      notify.success(`Created ${newRun.runName} with ${newRun.fabricCount} fabrics`);
      setShowCreateRunDialog(false);
      // Refresh the runs list
      const runs = await getRunsByStyle(selectedStyleId, purpose);
      setExistingRuns(runs);
    } catch (error: unknown) {
      const msg = getErrorMessage(error) || 'Failed to create costing run';
      notify.error(msg);
    } finally {
      setIsCreatingRun(false);
    }
  };

  // Delete a costing run
  const handleDeleteRun = async (runId: string) => {
    setIsDeletingRun(runId);
    try {
      await deleteRun(runId);
      notify.success('Costing run deleted');
      // Refresh the runs list
      const runs = await getRunsByStyle(selectedStyleId, purpose);
      setExistingRuns(runs);
    } catch (error: unknown) {
      const msg = getErrorMessage(error) || 'Failed to delete costing run';
      notify.error(msg);
    } finally {
      setIsDeletingRun(null);
    }
  };

  // Approve a single row's costing option (temporarily disabled - can be re-enabled when needed)

  const handleApproveRow = async (row: FabricCostingRow) => {
    if (!row.fabricWidthCadId) {
      notify.warning('Save the costing first before approving');
      return;
    }

    setApprovingRowId(row.id);
    try {
      await fabricCostingService.approveCostingOption(row.fabricWidthCadId);
      notify.success('Costing option approved');
    } catch (error: unknown) {
      const msg = getErrorMessage(error) || 'Failed to approve';
      notify.error(msg);
    } finally {
      setApprovingRowId(null);
    }
  };
  void handleApproveRow; // Suppress unused warning - will be used later

  // Count fabrics with calculated costs
  const fabricsWithCosts = fabricRows.filter((row) => row.totalCostPerMeter != null).length;

  // Group rows by greigeId only for subtotals (all widths of same greige grouped together)
  const groupedRows = React.useMemo(() => {
    const groups: Record<string, { rows: FabricCostingRow[]; greigeId: string; greigeName: string }> = {};

    fabricRows.forEach((row, index) => {
      // Group by greigeId only (not width) so same greige at different widths are grouped together
      const greigeId = row.greigeId || 'no-greige';
      const key = greigeId;

      if (!groups[key]) {
        groups[key] = {
          rows: [],
          greigeId,
          greigeName: row.greigeName || row.fabricName || 'Unknown',
        };
      }
      groups[key].rows.push({ ...row, _originalIndex: index } as FabricCostingRow & { _originalIndex: number });
    });

    return groups;
  }, [fabricRows]);

  // Nested grouping: Date → Quantity → Greige (for visual organization)
  const nestedGroups = React.useMemo(() => {
    // Step 1: Group by createdAt date
    const byDate: Record<string, (FabricCostingRow & { _originalIndex: number })[]> = {};
    fabricRows.forEach((row, index) => {
      const dateKey = row.createdAt
        ? new Date(row.createdAt).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }) +
          ' ' +
          new Date(row.createdAt).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
          })
        : 'New (Unsaved)';

      if (!byDate[dateKey]) byDate[dateKey] = [];
      byDate[dateKey].push({ ...row, _originalIndex: index } as FabricCostingRow & { _originalIndex: number });
    });

    // Step 2: Within each date, group by quantity
    const result = Object.entries(byDate).map(([dateKey, dateRows]) => {
      const byQty: Record<string, (FabricCostingRow & { _originalIndex: number })[]> = {};
      dateRows.forEach((row) => {
        const qty = row.rowQuantity ?? row.savedOrderQuantityPcs ?? 0;
        const qtyKey = qty > 0 ? qty.toString() : 'No Qty';
        if (!byQty[qtyKey]) byQty[qtyKey] = [];
        byQty[qtyKey].push(row);
      });

      // Step 3: Within each quantity, group by greige (for subtotals)
      const quantityGroups = Object.entries(byQty).map(([qtyKey, qtyRows]) => {
        const byGreige: Record<
          string,
          { rows: (FabricCostingRow & { _originalIndex: number })[]; greigeId: string; greigeName: string }
        > = {};
        qtyRows.forEach((row) => {
          const greigeId = row.greigeId || 'no-greige';
          if (!byGreige[greigeId]) {
            byGreige[greigeId] = {
              rows: [],
              greigeId,
              greigeName: row.greigeName || row.fabricName || 'Unknown',
            };
          }
          byGreige[greigeId].rows.push(row);
        });
        return {
          qtyKey,
          qtyValue: qtyKey === 'No Qty' ? 0 : Number(qtyKey),
          greigeGroups: byGreige,
          totalRows: qtyRows.length,
        };
      });

      // Sort quantities descending (largest first, "No Qty" last)
      quantityGroups.sort((a, b) => {
        if (a.qtyKey === 'No Qty') return 1;
        if (b.qtyKey === 'No Qty') return -1;
        return b.qtyValue - a.qtyValue;
      });

      return { dateKey, quantityGroups, totalRows: dateRows.length };
    });

    // Sort dates: "New (Unsaved)" first, then most recent first
    result.sort((a, b) => {
      if (a.dateKey === 'New (Unsaved)') return -1;
      if (b.dateKey === 'New (Unsaved)') return 1;
      // Parse back to compare timestamps
      const parseDate = (str: string) => {
        try {
          const [datePart, timePart] = str.split(' ');
          return new Date(`${datePart} ${timePart}`).getTime();
        } catch {
          return 0;
        }
      };
      return parseDate(b.dateKey) - parseDate(a.dateKey);
    });

    return result;
  }, [fabricRows]);

  // Check if we need to show nested grouping headers (only when multiple dates or quantities exist)
  const hasMultipleDateGroups = nestedGroups.length > 1;
  const hasMultipleQtyGroups = nestedGroups.some((dg) => dg.quantityGroups.length > 1);
  const showNestedGrouping = hasMultipleDateGroups || hasMultipleQtyGroups;

  // Calculate subtotals for a group of rows
  const calculateGroupSubtotals = (rows: FabricCostingRow[]) => {
    let totalCadMeters = 0;
    let totalRowCost = 0;
    let totalFabricReq = 0;
    let totalGreigeReq = 0;
    let hasAnyCost = false;

    rows.forEach((row) => {
      totalCadMeters += row.cadMeters || 0;

      const qty = row.rowQuantity || orderQuantity;
      const fabricReq = row.cadMeters * qty;
      totalFabricReq += fabricReq;

      const shrinkage = row.shrinkagePercent || 0;
      const greigeReq = divideByShrinkage(fabricReq, shrinkage);
      totalGreigeReq += greigeReq;

      if (row.totalCostPerMeter && row.cadMeters > 0) {
        totalRowCost += row.cadMeters * row.totalCostPerMeter;
        hasAnyCost = true;
      }
    });

    return {
      totalCadMeters,
      totalRowCost: hasAnyCost ? totalRowCost : null,
      totalFabricReq,
      totalGreigeReq,
    };
  };

  // Get finish type badge color
  const getFinishTypeBadge = (finishType: string | null) => {
    switch (finishType) {
      case 'DYED':
        return (
          <Badge variant="secondary" className="bg-info-muted text-info">
            Dyed
          </Badge>
        );
      case 'PRINTED':
        return (
          <Badge variant="secondary" className="bg-accent/10 text-accent">
            Printed
          </Badge>
        );
      case 'YARN_DYED':
        return (
          <Badge variant="secondary" className="bg-success-muted text-success">
            Yarn Dyed
          </Badge>
        );
      case 'RAW':
        return (
          <Badge variant="secondary" className="bg-muted text-foreground">
            Raw
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="bg-muted text-muted-foreground">
            -
          </Badge>
        );
    }
  };

  return (
    <div className="p-6 max-w-full mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-display font-medium">Fabric Costing</h1>
          <p className="text-muted-foreground mt-1">
            Calculate fabric cost per meter (₹/m) - consumption is calculated in CAD Planning
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() =>
              navigate(
                selectedStyleId ? `/fabric-costing/options?styleId=${selectedStyleId}` : '/fabric-costing/options'
              )
            }
          >
            <Eye className="w-4 h-4 mr-2" />
            View All Options
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              // Fallback to fabric-costing page if history is empty
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate('/fabric-costing');
              }
            }}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
      </div>

      {/* Purpose Mode Tabs */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm font-medium text-foreground">Mode:</span>
        <Tabs value={purpose} onValueChange={(val) => setPurpose(val as CostingPurpose)}>
          <TabsList>
            <TabsTrigger value="COSTING" className="data-[state=active]:bg-info-muted data-[state=active]:text-info">
              Costing
            </TabsTrigger>
            <TabsTrigger
              value="RAW_MATERIAL_CALCULATION"
              className="data-[state=active]:bg-warning/10 data-[state=active]:text-warning"
            >
              Raw Mat Calculation
            </TabsTrigger>
            <TabsTrigger
              value="PRODUCTION"
              className="data-[state=active]:bg-success-muted data-[state=active]:text-success"
            >
              Production
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <span className="text-xs text-muted-foreground">
          {purpose === 'COSTING' && 'Style costing for quotations'}
          {purpose === 'RAW_MATERIAL_CALCULATION' && 'MRP for confirmed orders'}
          {purpose === 'PRODUCTION' && 'Final costings locked for production'}
        </span>
        {isRepeatOrder && (
          <Badge variant="outline" className="ml-2 bg-warning-muted text-warning border-warning/25">
            Repeat Order
          </Badge>
        )}
      </div>

      {/* Selection Card */}
      <Card className="p-4 mb-6">
        {/* Quick Search Bar */}
        <div className="mb-4" ref={searchContainerRef}>
          <Label className="text-sm font-medium mb-2 block">Quick Search</Label>
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by style code, buyer ref or name..."
                value={styleSearchQuery}
                onChange={(e) => handleStyleSearch(e.target.value)}
                onFocus={() => styleSearchResults.length > 0 && setShowSearchResults(true)}
                className="pl-10 pr-10"
              />
              {styleSearchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
                  onClick={clearSearch}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
              {isSearching && (
                <Loader2 className="absolute right-10 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </div>
            {/* Search Results Dropdown */}
            {showSearchResults && styleSearchResults.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-60 overflow-auto">
                {styleSearchResults.map((style) => {
                  const status = styleCostingStatus[style.id];
                  return (
                    <div
                      key={style.id}
                      className="px-4 py-2 hover:bg-muted cursor-pointer border-b last:border-b-0"
                      onClick={() => handleSearchResultSelect(style)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-sm">
                          {style.styleCode}
                          {style.buyerStyleRef && (
                            <span className="ml-1 text-muted-foreground font-normal">({style.buyerStyleRef})</span>
                          )}
                        </div>
                        {/* Costing Status Badge */}
                        {status && (
                          <div className="flex items-center gap-1">
                            {status.hasProduction && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 bg-success-muted text-success border-success/25"
                              >
                                Costed
                              </Badge>
                            )}
                            {!status.hasProduction && status.hasApproved && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 bg-info-muted text-info border-info/30"
                              >
                                Approved
                              </Badge>
                            )}
                            {!status.hasProduction && !status.hasApproved && status.hasPending && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 bg-warning-muted text-warning border-warning/25"
                              >
                                Pending
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {style.styleName && <span>{style.styleName} • </span>}
                        {style.customerName || 'No Customer'}
                        {status?.costingCount ? ` • ${status.costingCount} option(s)` : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {showSearchResults && styleSearchResults.length === 0 && styleSearchQuery.length >= 2 && !isSearching && (
              <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-md shadow-lg p-4 text-center text-muted-foreground text-sm">
                No styles found
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Or select customer below to filter styles</p>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div>
            <Label className="text-sm font-medium mb-2 block">Customer</Label>
            <CustomerCombobox
              value={selectedCustomerId}
              onValueChange={setSelectedCustomerId}
              placeholder="Select customer..."
            />
          </div>

          <div>
            <Label className="text-sm font-medium mb-2 block">Style</Label>
            <Select
              value={selectedStyleId}
              onValueChange={setSelectedStyleId}
              disabled={!selectedCustomerId || isLoadingStyles}
            >
              <SelectTrigger>
                <SelectValue placeholder={isLoadingStyles ? 'Loading...' : 'Select style'} />
              </SelectTrigger>
              <SelectContent>
                {styles.map((style) => (
                  <SelectItem key={style.id} value={style.id}>
                    {formatStyleCodeWithRef(style.styleCode, style.buyerStyleRef)} - {style.styleName || 'No Name'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-medium mb-2 block">
              Order Quantity (pcs)
              {previousQuantity && previousQuantity !== orderQuantity && (
                <span className="ml-2 text-xs text-muted-foreground font-normal">
                  (Previous: {previousQuantity.toLocaleString()})
                </span>
              )}
            </Label>
            <Input
              type="number"
              min="1"
              value={orderQuantity || ''}
              onChange={(e) => setOrderQuantity(parseInt(e.target.value) || 0)}
              placeholder="e.g., 1000"
              className="w-full"
            />
            {previousQuantity && previousQuantity !== orderQuantity && (
              <p className="text-xs text-warning mt-1">
                Quantity changed from previous costing ({previousQuantity.toLocaleString()} pcs)
              </p>
            )}
            {previousQuantity && previousQuantity !== orderQuantity && previousQuantity > 0 && orderQuantity > 0 && (
              <p className="text-xs text-info mt-1">
                💡 This will create a NEW costing option. Original ({previousQuantity.toLocaleString()} pcs) will be
                preserved.
              </p>
            )}
          </div>

          <div className="flex flex-col justify-end">
            <div className="flex items-end gap-2">
              <Button onClick={handleSave} disabled={isSaving || fabricRows.length === 0} className="flex-1">
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Costing
              </Button>
              {selectedStyleId && (
                <Button
                  variant="outline"
                  onClick={() => navigate(`/fabric-costing/style/${selectedStyleId}`)}
                  title="View all costing options for this style"
                >
                  <Eye className="w-4 h-4 mr-1" />
                  Options
                </Button>
              )}
            </div>
            {showStyleOptionsButton && selectedStyleId && (
              <Button
                variant="default"
                className="w-full bg-success hover:bg-success"
                onClick={() => navigate(`/fabric-costing/options?styleId=${selectedStyleId}`)}
                title="View saved costing options for this style"
              >
                <Eye className="w-4 h-4 mr-1" />
                View Saved Options
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* CAD Data Warning Banner */}
      {selectedStyleId && !hasCADData && !isValidatingCAD && (
        <Card className="border-warning/20 bg-warning-muted">
          <div className="p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-warning mb-1">No CAD Data Found</h3>
              <p className="text-sm text-warning mb-3">
                This style has no CAD data from CAD Planning. Fabric costing requires CAD consumption data (meters per
                piece) to calculate costs accurately.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/cad-planning/${selectedStyleId}`)}
                className="border-warning text-warning hover:bg-warning/10"
              >
                <FileText className="w-4 h-4 mr-2" />
                Create CAD Data in CAD Planning
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Fabric Costing Table */}
      {isLoadingFabrics ? (
        <Card className="p-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span>Loading fabrics...</span>
        </Card>
      ) : fabricRows.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          {selectedStyleId
            ? `No fabrics found for ${purpose === 'COSTING' ? 'Costing' : purpose === 'RAW_MATERIAL_CALCULATION' ? 'Raw Material Calculation' : 'Production'} mode.${purpose !== 'COSTING' ? ' Try switching to Costing mode to see available data.' : ''}`
            : 'Select a customer and style to load fabrics'}
        </Card>
      ) : (
        <>
          {/* Existing Costing Runs */}
          {existingRuns.length > 0 && (
            <Card className="mb-4 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Existing Costing Runs ({existingRuns.length})
                </h3>
                {isLoadingRuns && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {existingRuns.map((run) => (
                  <div key={run.id} className="p-3 border rounded-lg bg-card hover:shadow-sm transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-sm">{run.runName}</span>
                      <div className="flex items-center gap-1">
                        {run.isComplete ? (
                          <Badge className="bg-success-muted text-success text-xs">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Complete
                          </Badge>
                        ) : (
                          <Badge className="bg-warning/10 text-warning text-xs">Incomplete</Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteRun(run.id)}
                          disabled={isDeletingRun === run.id}
                        >
                          {isDeletingRun === run.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>{run.fabricCount} fabrics</p>
                      <p>₹{run.totalFabricCost?.toFixed(2) ?? '0.00'}/garment</p>
                      <p className="text-muted-foreground">{new Date(run.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Stock notice — informational only; allocation happens at MRP */}
          {(() => {
            const fabricsWithStock = new Set(fabricRows.filter((r) => (r.stockAtWidth ?? 0) > 0).map((r) => r.fabricId))
              .size;
            if (fabricsWithStock === 0) return null;
            return (
              <div className="mb-3 flex items-center gap-2 text-xs text-info bg-info-muted border border-info/20 rounded-md px-3 py-2">
                <Info className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  {fabricsWithStock} fabric{fabricsWithStock !== 1 ? 's have' : ' has'} finished stock available — see
                  the row badges. Stock is allocated at Material Requisition (MRP), not here; figures are indicative.
                </span>
              </div>
            );
          })()}

          <Card className="overflow-x-auto">
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow className="bg-muted">
                  <TableHead className="w-[130px] px-1 text-xs">Greige</TableHead>
                  <TableHead
                    className="w-[70px] px-1 text-center text-xs whitespace-normal leading-tight"
                    title="Fabric color from style - same greige + same color are batched for combined rate"
                  >
                    Color
                  </TableHead>
                  <TableHead
                    className="w-[50px] px-1 text-center text-xs whitespace-normal leading-tight"
                    title="Fabric consumption per piece (from CAD Planning)"
                  >
                    CAD (m/pc)
                  </TableHead>
                  <TableHead className="w-[60px] px-1 text-center text-xs">
                    <div>Qty</div>
                    <div className="text-[10px] text-muted-foreground">(pcs)</div>
                  </TableHead>
                  <TableHead className="w-[45px] px-1 text-center text-xs" title="Cutable Width">
                    CW
                  </TableHead>
                  <TableHead className="w-[42px] px-1 text-center text-xs">Finish</TableHead>
                  <TableHead className="w-[48px] px-1 text-center text-xs">Mode</TableHead>
                  <TableHead className="w-[75px] px-1 text-center text-xs">
                    <div>Greige +Trp</div>
                    <div className="text-[10px] text-muted-foreground">(₹/m)</div>
                  </TableHead>
                  <TableHead className="w-[170px] px-1 text-center text-xs">Processor</TableHead>
                  <TableHead className="w-[55px] px-1 text-center text-xs">Colors</TableHead>
                  <TableHead className="w-[85px] px-1 text-center text-xs">Print Type</TableHead>
                  <TableHead className="w-[80px] px-1 text-center text-xs">Screen</TableHead>
                  <TableHead className="w-[70px] px-1 text-center text-xs">
                    <div>Process</div>
                    <div className="text-[10px] text-muted-foreground">(₹/m)</div>
                  </TableHead>
                  <TableHead className="w-[70px] px-1 text-center text-xs">
                    <div>Shrink</div>
                    <div className="text-[10px] text-muted-foreground">(₹/m)</div>
                  </TableHead>
                  <TableHead className="w-[70px] px-1 text-center text-xs font-semibold">
                    <div>Total</div>
                    <div className="text-[10px] text-muted-foreground">(₹/m)</div>
                  </TableHead>
                  <TableHead className="w-[70px] px-1 text-center text-xs">
                    <div>Part Cost</div>
                    <div className="text-[10px] text-muted-foreground">(₹)</div>
                  </TableHead>
                  <TableHead className="w-[70px] px-1 text-center text-xs">
                    <div>Fabric Req</div>
                    <div className="text-[10px] text-muted-foreground">(m)</div>
                  </TableHead>
                  <TableHead className="w-[70px] px-1 text-center text-xs">
                    <div>Greige Req</div>
                    <div className="text-[10px] text-muted-foreground">(m)</div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Conditional rendering based on whether nested grouping is needed */}
                {showNestedGrouping
                  ? /* Nested grouping: Date → Quantity → Greige */
                    nestedGroups.map((dateGroup) => (
                      <React.Fragment key={dateGroup.dateKey}>
                        {/* Date Group Header */}
                        <TableRow className="bg-warning-muted border-t-2 border-warning/20">
                          <TableCell colSpan={18} className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-warning" />
                              <span className="font-semibold text-warning">
                                {dateGroup.dateKey === 'New (Unsaved)'
                                  ? 'New (Unsaved)'
                                  : `Created: ${dateGroup.dateKey}`}
                              </span>
                              <Badge variant="secondary" className="text-xs">
                                {dateGroup.totalRows} row{dateGroup.totalRows !== 1 ? 's' : ''}
                              </Badge>
                              {dateGroup.dateKey === 'New (Unsaved)' && (
                                <Badge variant="outline" className="text-info border-info/30 text-xs">
                                  Not yet saved
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Quantity Sub-Groups */}
                        {dateGroup.quantityGroups.map((qtyGroup) => (
                          <React.Fragment key={qtyGroup.qtyKey}>
                            {/* Quantity Sub-Header (only if multiple qty groups in this date) */}
                            {dateGroup.quantityGroups.length > 1 && (
                              <TableRow className="bg-info-muted border-t border-info/20">
                                <TableCell colSpan={18} className="py-1.5 px-3">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-info">
                                      Order Qty:{' '}
                                      {qtyGroup.qtyKey === 'No Qty'
                                        ? 'Not specified'
                                        : `${Number(qtyGroup.qtyKey).toLocaleString()} pcs`}
                                    </span>
                                    <Badge variant="secondary" className="text-xs">
                                      {qtyGroup.totalRows} row{qtyGroup.totalRows !== 1 ? 's' : ''}
                                    </Badge>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}

                            {/* Greige Groups within this Quantity */}
                            {Object.entries(qtyGroup.greigeGroups).map(([greigeKey, greigeGroup]) => {
                              const subtotals = calculateGroupSubtotals(greigeGroup.rows);
                              const showSubtotal =
                                greigeGroup.rows.length > 1 || Object.keys(qtyGroup.greigeGroups).length > 1;

                              return (
                                <React.Fragment key={greigeKey}>
                                  {greigeGroup.rows.map((row) => {
                                    const index = (row as FabricCostingRow & { _originalIndex: number })._originalIndex;
                                    return (
                                      <React.Fragment key={row.id}>
                                        <TableRow>
                                          {/* Fabric Info */}
                                          <TableCell className="px-1 overflow-hidden">
                                            <div>
                                              {(() => {
                                                const greigeName = row.greigeName || row.fabricName;
                                                // parseGreigeName's regex is greige-shaped; style-prefixed
                                                // fabric names would mis-split — render them whole
                                                const parsed = row.greigeName
                                                  ? parseGreigeName(row.greigeName)
                                                  : { line1: row.fabricName ?? '', line2: '' };
                                                return (
                                                  <>
                                                    <div className="flex items-center gap-1">
                                                      <p className="font-medium text-xs" title={greigeName}>
                                                        {parsed.line1}
                                                      </p>
                                                      {row.readyFabricCost && (
                                                        <Badge
                                                          variant="outline"
                                                          className="text-[9px] px-1 py-0 bg-success-muted text-success border-success/20 flex-shrink-0"
                                                        >
                                                          ₹{row.readyFabricCost}
                                                        </Badge>
                                                      )}
                                                      <StockBadge
                                                        row={row}
                                                        effectiveQty={row.rowQuantity || orderQuantity}
                                                      />
                                                    </div>
                                                    {parsed.line2 && (
                                                      <p className="text-[10px] text-muted-foreground">
                                                        {parsed.line2}
                                                      </p>
                                                    )}
                                                  </>
                                                );
                                              })()}
                                              <p className="text-[10px] text-muted-foreground truncate">
                                                {row.componentName}
                                              </p>
                                              {row.greigeCode && (
                                                <p
                                                  className="text-[9px] text-muted-foreground truncate"
                                                  title={`Greige Code: ${row.greigeCode}`}
                                                >
                                                  {row.greigeCode}
                                                </p>
                                              )}
                                              {row.greigeName &&
                                                row.fabricName &&
                                                row.greigeName !== row.fabricName && (
                                                  <p
                                                    className="text-[10px] text-muted-foreground truncate"
                                                    title={row.fabricName}
                                                  >
                                                    Fabric: {row.fabricName}
                                                  </p>
                                                )}
                                            </div>
                                          </TableCell>

                                          {/* Color (from style fabric) */}
                                          <TableCell className="px-1 text-center">
                                            {row.colorName ? (
                                              <Badge
                                                variant="outline"
                                                className="text-[10px] px-1.5 py-0"
                                                title={`Color from style definition${row.colorMasterId ? ` (ID: ${row.colorMasterId})` : ''}`}
                                              >
                                                {row.colorName}
                                              </Badge>
                                            ) : (
                                              <span className="text-muted-foreground text-[10px]">-</span>
                                            )}
                                            {row.batchGroupTotalQuantity != null && (
                                              <div
                                                className="text-[9px] text-info mt-0.5"
                                                title="Combined batch quantity for rate slab"
                                              >
                                                {row.batchGroupTotalQuantity.toFixed(0)}m batch
                                              </div>
                                            )}
                                            {row.batchSavings != null && row.batchSavings > 0 && (
                                              <div
                                                className="text-[9px] text-success font-medium"
                                                title={`Individual rate: ₹${row.individualRate?.toFixed(2)}/m`}
                                              >
                                                save ₹{row.batchSavings.toFixed(2)}/m
                                              </div>
                                            )}
                                          </TableCell>

                                          {/* CAD */}
                                          <TableCell className="px-1 text-center text-xs">
                                            <div className="flex items-center justify-center gap-0.5">
                                              <span
                                                className={row.cadMeters === 0 ? 'text-destructive font-medium' : ''}
                                                title="Per-piece fabric consumption (calculated from CAD Planning)"
                                              >
                                                {row.cadMeters.toFixed(3)}
                                              </span>
                                              {row.cadMeters === 0 && (
                                                <span
                                                  className="text-destructive cursor-help text-[10px]"
                                                  title="No CAD data - set consumption in CAD Planning first"
                                                >
                                                  !
                                                </span>
                                              )}
                                            </div>
                                          </TableCell>

                                          {/* Qty (pcs) */}
                                          <TableCell className="px-1 text-center">
                                            <RowQtyInput
                                              rowQuantity={row.rowQuantity}
                                              effectiveGlobalQty={orderQuantity}
                                              className="h-7 w-full text-xs text-center px-1"
                                              onCommit={(qty) => updateRow(index, { rowQuantity: qty })}
                                            />
                                          </TableCell>

                                          {/* Width */}
                                          <TableCell className="px-1 text-center text-xs">{row.width}"</TableCell>

                                          {/* Finish */}
                                          <TableCell className="px-1 text-center">
                                            {getFinishTypeBadge(row.finishType)}
                                          </TableCell>

                                          {/* Mode Toggle (Build-up vs Landed) */}
                                          <TableCell className="px-1 text-center">
                                            <div className="flex items-center justify-center gap-0.5">
                                              <span
                                                className={`text-[9px] ${row.costInputMode === 'BUILD_UP' ? 'text-info font-semibold' : 'text-muted-foreground'}`}
                                              >
                                                B
                                              </span>
                                              <Switch
                                                checked={row.costInputMode === 'LANDED_PRICE'}
                                                onCheckedChange={(checked) => {
                                                  updateRow(index, {
                                                    costInputMode: checked ? 'LANDED_PRICE' : 'BUILD_UP',
                                                    // When switching to landed price, default to ready fabric cost if available
                                                    landedPricePerMeter: checked ? row.readyFabricCost || null : null,
                                                  });
                                                }}
                                                className="scale-75"
                                              />
                                              <span
                                                className={`text-[9px] ${row.costInputMode === 'LANDED_PRICE' ? 'text-success font-semibold' : 'text-muted-foreground'}`}
                                              >
                                                L
                                              </span>
                                            </div>
                                          </TableCell>

                                          {/* Greige + Transport Cost */}
                                          <TableCell className="px-1 text-center">
                                            {row.costInputMode === 'BUILD_UP' ? (
                                              <div className="flex items-center gap-0.5 justify-center">
                                                {/* Shared cell — the inline total math that used to
                                                    live here was overwritten by calculateRowTotals
                                                    anyway, and used its own shrinkage formula. */}
                                                <GreigeCostCell
                                                  row={row}
                                                  onChange={(updates) => updateRow(index, updates)}
                                                />
                                                <span className="text-[10px] text-muted-foreground">+</span>
                                                <Input
                                                  type="number"
                                                  step="0.1"
                                                  className="h-7 w-10 text-xs text-center px-0.5"
                                                  value={row.transportCostPerMeter || ''}
                                                  onChange={(e) => {
                                                    const transportCost = parseFloat(e.target.value) || 0;
                                                    const greigeCost = row.greigeCostPerMeter || 0;
                                                    const shrinkageValue = row.shrinkageValue || 0;
                                                    const processingCost = row.processingCostPerMeter || 0;
                                                    const screenCost = row.screenCostPerMeter || 0;
                                                    const total =
                                                      greigeCost +
                                                      transportCost +
                                                      shrinkageValue +
                                                      processingCost +
                                                      screenCost;
                                                    updateRow(index, {
                                                      transportCostPerMeter: transportCost,
                                                      totalCostPerMeter: total,
                                                    });
                                                  }}
                                                  placeholder="Trp"
                                                  title="Transport cost per meter"
                                                />
                                              </div>
                                            ) : (
                                              <Input
                                                type="number"
                                                step="0.01"
                                                className="h-7 w-full text-xs text-center"
                                                value={row.landedPricePerMeter || ''}
                                                onChange={(e) => {
                                                  const landedPrice = parseFloat(e.target.value) || 0;
                                                  updateRow(index, {
                                                    landedPricePerMeter: landedPrice,
                                                    totalCostPerMeter: landedPrice,
                                                  });
                                                }}
                                                placeholder="Landed ₹/m"
                                                title="Landed price per meter (includes all costs)"
                                              />
                                            )}
                                          </TableCell>

                                          {/* Processor Selection */}
                                          <TableCell className="px-1 text-center">
                                            {row.costInputMode === 'LANDED_PRICE' || row.finishType === 'RAW' ? (
                                              <span className="text-muted-foreground text-xs">-</span>
                                            ) : (
                                              <div className="flex items-center justify-center gap-0.5">
                                                <Combobox
                                                  value={row.processorId || ''}
                                                  onValueChange={(value) => {
                                                    const processor = processors.find((p) => p.id === value);
                                                    updateRow(index, {
                                                      processorId: value,
                                                      processorName: processor?.name || null,
                                                      processingCostPerMeter: null,
                                                      slabLabel: null,
                                                      shrinkagePercent: null,
                                                      screenCostPerScreen: null,
                                                    });

                                                    // Auto-lookup rates for DYEING (no printing type needed)
                                                    if (row.processingType === 'DYEING' && value && row.greigeId) {
                                                      lookupRate(index, { processorId: value });
                                                    }
                                                  }}
                                                  options={processors.map((p) => ({ value: p.id, label: p.name }))}
                                                  placeholder="Select"
                                                  searchPlaceholder="Search processor..."
                                                  emptyText="No processors found"
                                                  className="w-[150px] h-7 text-[10px]"
                                                  hideChevron
                                                />
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-6 w-6 p-0"
                                                  onClick={() => lookupRate(index)}
                                                  disabled={row.isLoading || !row.processorId || !row.greigeId}
                                                >
                                                  {row.isLoading ? (
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                  ) : (
                                                    <RefreshCw className="w-3 h-3" />
                                                  )}
                                                </Button>
                                              </div>
                                            )}
                                          </TableCell>

                                          {/* Colors */}
                                          <TableCell className="px-1 text-center">
                                            {row.finishType === 'PRINTED' ? (
                                              <Input
                                                type="number"
                                                min="1"
                                                max="12"
                                                className="h-7 w-full text-xs text-center px-0.5"
                                                value={row.numberOfColors || ''}
                                                onChange={(e) => {
                                                  const numColors = parseInt(e.target.value) || null;
                                                  // Recalculate screen cost
                                                  const screenType = row.screenType;
                                                  const defaultCost = screenType ? DEFAULT_SCREEN_COSTS[screenType] : 0;
                                                  // BUG-FC4 fix: only apply defaults for new rows
                                                  const costPerScreen = row.fabricWidthCadId
                                                    ? row.screenCostPerScreen // Saved row: preserve existing value
                                                    : row.screenCostPerScreen || defaultCost; // New row: use default
                                                  const totalScreenCost =
                                                    numColors && costPerScreen ? numColors * costPerScreen : null;
                                                  const qty = row.rowQuantity ?? orderQuantity;
                                                  const fabricMeters = row.cadMeters * (qty || 0);
                                                  const screenCostPerMeter =
                                                    totalScreenCost && fabricMeters > 0
                                                      ? totalScreenCost / fabricMeters
                                                      : null;
                                                  // Recalc total
                                                  const greigeCost = row.greigeCostPerMeter || 0;
                                                  const transportCost = row.transportCostPerMeter || 0;
                                                  const shrinkageValue = row.shrinkageValue || 0;
                                                  const processingCost = row.processingCostPerMeter || 0;
                                                  const total =
                                                    greigeCost +
                                                    transportCost +
                                                    shrinkageValue +
                                                    processingCost +
                                                    (screenCostPerMeter || 0);
                                                  updateRow(index, {
                                                    numberOfColors: numColors,
                                                    screenCostTotal: totalScreenCost,
                                                    screenCostPerMeter,
                                                    totalCostPerMeter:
                                                      row.costInputMode === 'BUILD_UP' ? total : row.totalCostPerMeter,
                                                  });
                                                }}
                                                placeholder="#"
                                                title="Number of colors/screens"
                                              />
                                            ) : (
                                              <span className="text-muted-foreground text-xs">-</span>
                                            )}
                                          </TableCell>

                                          {/* Print Type */}
                                          <TableCell className="px-1 text-center">
                                            {row.finishType === 'PRINTED' ? (
                                              <select
                                                className="h-7 w-full text-[10px] border rounded px-0.5 bg-card"
                                                value={row.screenType || ''}
                                                onChange={(e) => {
                                                  const screenType = (e.target.value || null) as ScreenType | null;
                                                  const defaultCost = screenType ? DEFAULT_SCREEN_COSTS[screenType] : 0;
                                                  // BUG-FC4 fix: only apply defaults for new rows
                                                  const costPerScreen = row.fabricWidthCadId
                                                    ? row.screenCostPerScreen // Saved row: preserve existing value
                                                    : row.screenCostPerScreen || defaultCost; // New row: use default
                                                  const numColors = row.numberOfColors || 0;
                                                  const totalScreenCost =
                                                    numColors && costPerScreen ? numColors * costPerScreen : null;
                                                  const qty = row.rowQuantity ?? orderQuantity;
                                                  const fabricMeters = row.cadMeters * (qty || 0);
                                                  const screenCostPerMeter =
                                                    totalScreenCost && fabricMeters > 0
                                                      ? totalScreenCost / fabricMeters
                                                      : null;
                                                  // Recalc total
                                                  const greigeCost = row.greigeCostPerMeter || 0;
                                                  const transportCost = row.transportCostPerMeter || 0;
                                                  const shrinkageValue = row.shrinkageValue || 0;
                                                  const processingCost = row.processingCostPerMeter || 0;
                                                  const total =
                                                    greigeCost +
                                                    transportCost +
                                                    shrinkageValue +
                                                    processingCost +
                                                    (screenCostPerMeter || 0);
                                                  updateRow(index, {
                                                    screenType,
                                                    screenCostPerScreen: costPerScreen,
                                                    screenCostTotal: totalScreenCost,
                                                    screenCostPerMeter,
                                                    totalCostPerMeter:
                                                      row.costInputMode === 'BUILD_UP' ? total : row.totalCostPerMeter,
                                                  });
                                                }}
                                              >
                                                <option value="">-</option>
                                                {Object.entries(SCREEN_TYPE_LABELS).map(([value, label]) => (
                                                  <option key={value} value={value}>
                                                    {label}
                                                  </option>
                                                ))}
                                              </select>
                                            ) : (
                                              <span className="text-muted-foreground text-xs">-</span>
                                            )}
                                          </TableCell>

                                          {/* Screen Cost */}
                                          <TableCell className="px-1 text-center">
                                            {row.finishType === 'PRINTED' && row.screenCostPerMeter ? (
                                              <span
                                                className="text-xs"
                                                title={`Total screen cost: ₹${row.screenCostTotal?.toLocaleString() || 0}`}
                                              >
                                                ₹{row.screenCostPerMeter.toFixed(2)}
                                              </span>
                                            ) : (
                                              <span className="text-muted-foreground text-xs">-</span>
                                            )}
                                          </TableCell>

                                          {/* Processing Cost */}
                                          <TableCell className="px-1 text-center">
                                            {row.processingCostPerMeter != null ? (
                                              <div>
                                                <span className="text-xs">
                                                  ₹{row.processingCostPerMeter.toFixed(2)}
                                                </span>
                                                {row.slabLabel && (
                                                  <div
                                                    className="text-[9px] text-muted-foreground truncate"
                                                    title={row.slabLabel}
                                                  >
                                                    {row.slabLabel}
                                                  </div>
                                                )}
                                              </div>
                                            ) : (
                                              <span className="text-muted-foreground text-xs">-</span>
                                            )}
                                          </TableCell>

                                          {/* Shrinkage Cost */}
                                          <TableCell className="px-1 text-center">
                                            {row.shrinkageValue ? (
                                              <div>
                                                <span className="text-xs">₹{row.shrinkageValue.toFixed(2)}</span>
                                                {row.shrinkagePercent && (
                                                  <div className="text-[9px] text-muted-foreground">
                                                    {row.shrinkagePercent}%
                                                  </div>
                                                )}
                                              </div>
                                            ) : (
                                              <span className="text-muted-foreground text-xs">-</span>
                                            )}
                                          </TableCell>

                                          {/* Total Cost */}
                                          <TableCell className="px-1 text-center">
                                            {row.totalCostPerMeter ? (
                                              <span className="text-xs font-semibold text-success">
                                                ₹{row.totalCostPerMeter.toFixed(2)}
                                              </span>
                                            ) : (
                                              <span className="text-muted-foreground text-xs">-</span>
                                            )}
                                          </TableCell>

                                          {/* Part Cost (CAD × Total) */}
                                          <TableCell className="px-1 text-center">
                                            {row.totalCostPerMeter && row.cadMeters > 0 ? (
                                              <span className="text-xs font-medium">
                                                ₹{(row.cadMeters * row.totalCostPerMeter).toFixed(2)}
                                              </span>
                                            ) : (
                                              <span className="text-muted-foreground text-xs">-</span>
                                            )}
                                          </TableCell>

                                          {/* Fabric Req (CAD × Qty) */}
                                          <TableCell className="px-1 text-center">
                                            {row.cadMeters > 0 && (row.rowQuantity || orderQuantity) > 0 ? (
                                              <span className="text-xs">
                                                {((row.rowQuantity ?? orderQuantity) * row.cadMeters).toLocaleString(
                                                  undefined,
                                                  { maximumFractionDigits: 0 }
                                                )}
                                              </span>
                                            ) : (
                                              <span className="text-muted-foreground text-xs">-</span>
                                            )}
                                          </TableCell>

                                          {/* Greige Req (adjusted for shrinkage) */}
                                          <TableCell className="px-1 text-center">
                                            {row.cadMeters > 0 && (row.rowQuantity || orderQuantity) > 0 ? (
                                              (() => {
                                                const qty = row.rowQuantity ?? orderQuantity;
                                                const fabricReq = row.cadMeters * qty;
                                                const shrinkage = row.shrinkagePercent || 0;
                                                const greigeReq = divideByShrinkage(fabricReq, shrinkage);
                                                return (
                                                  <span
                                                    className="text-xs"
                                                    title={
                                                      shrinkage > 0
                                                        ? `Fabric req ÷ (1 - ${shrinkage}% shrinkage)`
                                                        : 'No shrinkage applied'
                                                    }
                                                  >
                                                    {greigeReq.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                  </span>
                                                );
                                              })()
                                            ) : (
                                              <span className="text-muted-foreground text-xs">-</span>
                                            )}
                                          </TableCell>
                                        </TableRow>
                                      </React.Fragment>
                                    );
                                  })}

                                  {/* Subtotal Row for this greige group */}
                                  {showSubtotal && (
                                    <TableRow className="bg-info-muted font-medium border-t-2 border-info/20">
                                      <TableCell className="px-1" colSpan={3}>
                                        <span className="text-xs font-semibold text-info">
                                          Subtotal: {greigeGroup.greigeName}
                                        </span>
                                      </TableCell>
                                      <TableCell className="px-1 text-center">
                                        <span className="text-xs font-semibold text-info">
                                          {subtotals.totalCadMeters.toFixed(3)}
                                        </span>
                                      </TableCell>
                                      <TableCell colSpan={10} className="px-1"></TableCell>
                                      <TableCell className="px-1 text-center">
                                        {subtotals.totalRowCost !== null ? (
                                          <span className="text-xs font-bold text-info">
                                            ₹{subtotals.totalRowCost.toFixed(2)}/pc
                                          </span>
                                        ) : (
                                          <span className="text-muted-foreground text-xs">-</span>
                                        )}
                                      </TableCell>
                                      <TableCell className="px-1 text-center">
                                        <span className="text-xs font-semibold text-info">
                                          {subtotals.totalFabricReq.toLocaleString(undefined, {
                                            maximumFractionDigits: 0,
                                          })}
                                        </span>
                                      </TableCell>
                                      <TableCell className="px-1 text-center">
                                        <span className="text-xs font-semibold text-info">
                                          {subtotals.totalGreigeReq.toLocaleString(undefined, {
                                            maximumFractionDigits: 0,
                                          })}
                                        </span>
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </React.Fragment>
                        ))}
                      </React.Fragment>
                    ))
                  : /* Simple grouping: Just Greige (no date/qty headers) */
                    Object.entries(groupedRows).map(([groupKey, group]) => {
                      const subtotals = calculateGroupSubtotals(group.rows);
                      const showSubtotal = group.rows.length > 1 || Object.keys(groupedRows).length > 1;

                      return (
                        <React.Fragment key={groupKey}>
                          {/* Render rows in this group */}
                          {group.rows.map((row) => {
                            const index = (row as FabricCostingRow & { _originalIndex: number })._originalIndex;
                            return (
                              <React.Fragment key={row.id}>
                                {/* Main Row */}
                                <TableRow>
                                  {/* Fabric Info */}
                                  <TableCell className="px-1 overflow-hidden">
                                    <div>
                                      {(() => {
                                        const greigeName = row.greigeName || row.fabricName;
                                        // parseGreigeName's regex is greige-shaped; style-prefixed
                                        // fabric names would mis-split — render them whole
                                        const parsed = row.greigeName
                                          ? parseGreigeName(row.greigeName)
                                          : { line1: row.fabricName ?? '', line2: '' };
                                        return (
                                          <>
                                            <div className="flex items-center gap-1">
                                              <p className="font-medium text-xs" title={greigeName}>
                                                {parsed.line1}
                                              </p>
                                              {row.readyFabricCost && (
                                                <Badge
                                                  variant="outline"
                                                  className="text-[9px] px-1 py-0 bg-success-muted text-success border-success/20 flex-shrink-0"
                                                >
                                                  ₹{row.readyFabricCost}
                                                </Badge>
                                              )}
                                              <StockBadge row={row} effectiveQty={row.rowQuantity || orderQuantity} />
                                              {(row.costingApprovalStatus === 'APPROVED' ||
                                                row.costingApprovalStatus === 'ALTERNATE_APPROVED') && (
                                                <Badge
                                                  variant="outline"
                                                  className="text-[9px] px-1 py-0 bg-warning-muted text-warning border-warning/20 flex-shrink-0 gap-0.5"
                                                  title="Approved costing — skipped on save. Unapprove on the Options page to edit."
                                                >
                                                  <Lock className="h-2.5 w-2.5" />
                                                  {row.costingApprovalStatus === 'APPROVED' ? 'Approved' : 'Alternate'}
                                                </Badge>
                                              )}
                                            </div>
                                            {parsed.line2 && (
                                              <p className="text-[10px] text-muted-foreground">{parsed.line2}</p>
                                            )}
                                          </>
                                        );
                                      })()}
                                      <p className="text-[10px] text-muted-foreground truncate">{row.componentName}</p>
                                      {row.greigeCode && (
                                        <p
                                          className="text-[9px] text-muted-foreground truncate"
                                          title={`Greige Code: ${row.greigeCode}`}
                                        >
                                          {row.greigeCode}
                                        </p>
                                      )}
                                      {row.greigeName && row.fabricName && row.greigeName !== row.fabricName && (
                                        <p
                                          className="text-[10px] text-muted-foreground truncate"
                                          title={row.fabricName}
                                        >
                                          Fabric: {row.fabricName}
                                        </p>
                                      )}
                                    </div>
                                  </TableCell>

                                  {/* Color (from style fabric) */}
                                  <TableCell className="px-1 text-center">
                                    {row.colorName ? (
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] px-1.5 py-0"
                                        title={`Color from style definition${row.colorMasterId ? ` (ID: ${row.colorMasterId})` : ''}`}
                                      >
                                        {row.colorName}
                                      </Badge>
                                    ) : (
                                      <span className="text-muted-foreground text-[10px]">-</span>
                                    )}
                                    {row.batchGroupTotalQuantity != null && (
                                      <div
                                        className="text-[9px] text-info mt-0.5"
                                        title="Combined batch quantity for rate slab"
                                      >
                                        {row.batchGroupTotalQuantity.toFixed(0)}m batch
                                      </div>
                                    )}
                                    {row.batchSavings != null && row.batchSavings > 0 && (
                                      <div
                                        className="text-[9px] text-success font-medium"
                                        title={`Individual rate: ₹${row.individualRate?.toFixed(2)}/m`}
                                      >
                                        save ₹{row.batchSavings.toFixed(2)}/m
                                      </div>
                                    )}
                                  </TableCell>

                                  {/* CAD */}
                                  <TableCell className="px-1 text-center text-xs">
                                    <div className="flex items-center justify-center gap-0.5">
                                      <span
                                        className={row.cadMeters === 0 ? 'text-destructive font-medium' : ''}
                                        title="Per-piece fabric consumption (calculated from CAD Planning)"
                                      >
                                        {row.cadMeters.toFixed(3)}
                                      </span>
                                      {row.cadMeters === 0 && (
                                        <span
                                          className="text-destructive cursor-help text-[10px]"
                                          title="CAD consumption not set. Complete CAD Planning for this style first."
                                        >
                                          ⚠️
                                        </span>
                                      )}
                                    </div>
                                  </TableCell>

                                  {/* Row Quantity */}
                                  <TableCell className="px-1 text-center">
                                    <RowQtyInput
                                      rowQuantity={row.rowQuantity}
                                      effectiveGlobalQty={orderQuantity}
                                      className="w-20 text-center text-xs h-7 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      onCommit={(qty) => updateRow(index, { rowQuantity: qty })}
                                    />
                                  </TableCell>

                                  {/* Cutable Width */}
                                  <TableCell className="px-1 text-center text-xs">
                                    {row.width ? `${row.width}"` : '-'}
                                  </TableCell>

                                  {/* Finish Type */}
                                  <TableCell className="px-1 text-center">
                                    {getFinishTypeBadge(row.finishType)}
                                  </TableCell>

                                  {/* Cost Mode Toggle */}
                                  <TableCell className="px-1">
                                    <div className="flex items-center gap-1 justify-center">
                                      <span
                                        className={`text-[10px] ${row.costInputMode === 'BUILD_UP' ? 'font-medium' : 'text-muted-foreground'}`}
                                      >
                                        B
                                      </span>
                                      <Switch
                                        checked={row.costInputMode === 'LANDED_PRICE'}
                                        onCheckedChange={(checked) =>
                                          updateRow(index, {
                                            costInputMode: checked ? 'LANDED_PRICE' : 'BUILD_UP',
                                          })
                                        }
                                        className="scale-75"
                                      />
                                      <span
                                        className={`text-[10px] ${row.costInputMode === 'LANDED_PRICE' ? 'font-medium' : 'text-muted-foreground'}`}
                                      >
                                        L
                                      </span>
                                    </div>
                                  </TableCell>

                                  {/* Greige + Transport Combined */}
                                  <TableCell className="px-1">
                                    {row.costInputMode === 'LANDED_PRICE' ? (
                                      <div className="flex items-center justify-center gap-0.5">
                                        <Input
                                          type="number"
                                          step="0.01"
                                          placeholder="Landed ₹"
                                          className="w-16 text-center text-xs h-7 px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                          value={row.landedPricePerMeter || ''}
                                          onChange={(e) =>
                                            updateRow(index, {
                                              landedPricePerMeter: parseFloat(e.target.value) || null,
                                            })
                                          }
                                        />
                                        {row.readyFabricCost && row.landedPricePerMeter !== row.readyFabricCost && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-5 w-5 p-0 text-success hover:text-success hover:bg-success-muted"
                                            onClick={() =>
                                              updateRow(index, {
                                                landedPricePerMeter: row.readyFabricCost,
                                              })
                                            }
                                            title={`Use fabric master price: ₹${row.readyFabricCost}/m`}
                                          >
                                            <RefreshCw className="w-2.5 h-2.5" />
                                          </Button>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="flex flex-col items-center gap-0.5">
                                        {/* Greige Cost */}
                                        <GreigeCostCell row={row} onChange={(updates) => updateRow(index, updates)} />
                                        {/* Transport Cost */}
                                        <div className="flex flex-col items-center">
                                          <Input
                                            type="number"
                                            step="0.01"
                                            placeholder="+Trp"
                                            className="w-14 text-center text-xs h-6 px-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            value={row.transportCostPerMeter || ''}
                                            onChange={(e) =>
                                              updateRow(index, {
                                                transportCostPerMeter: parseFloat(e.target.value) || null,
                                              })
                                            }
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </TableCell>

                                  {/* Processor Selection */}
                                  <TableCell className="px-1 text-center">
                                    {row.costInputMode === 'LANDED_PRICE' || row.finishType === 'RAW' ? (
                                      <span className="text-muted-foreground text-xs">-</span>
                                    ) : (
                                      <div className="flex items-center justify-center gap-0.5">
                                        <Combobox
                                          value={row.processorId || ''}
                                          onValueChange={(value) => {
                                            const processor = processors.find((p) => p.id === value);
                                            updateRow(index, {
                                              processorId: value,
                                              processorName: processor?.name || null,
                                              processingCostPerMeter: null,
                                              slabLabel: null,
                                              shrinkagePercent: null,
                                              screenCostPerScreen: null,
                                            });

                                            // Auto-lookup rates for DYEING (no printing type needed)
                                            // For PRINTING, wait until printing type is selected
                                            if (row.processingType === 'DYEING' && value && row.greigeId) {
                                              // Pass the new processorId as override since state hasn't updated yet
                                              lookupRate(index, { processorId: value });
                                            }
                                          }}
                                          options={processors.map((p) => ({ value: p.id, label: p.name }))}
                                          placeholder="Select"
                                          searchPlaceholder="Search processor..."
                                          emptyText="No processors found"
                                          className="w-[150px] h-7 text-[10px]"
                                          hideChevron
                                        />
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 w-6 p-0"
                                          onClick={() => lookupRate(index)}
                                          disabled={row.isLoading || !row.processorId || !row.greigeId}
                                        >
                                          {row.isLoading ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                          ) : (
                                            <RefreshCw className="w-3 h-3" />
                                          )}
                                        </Button>
                                      </div>
                                    )}
                                  </TableCell>

                                  {/* Number of Colors */}
                                  <TableCell className="px-1 text-center">
                                    {row.processingType === 'PRINTING' && row.costInputMode !== 'LANDED_PRICE' ? (
                                      <Input
                                        type="number"
                                        min="1"
                                        max="20"
                                        className="w-9 text-center text-xs h-7 px-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        value={row.numberOfColors || ''}
                                        onChange={(e) =>
                                          updateRow(index, {
                                            numberOfColors: parseInt(e.target.value) || null,
                                          })
                                        }
                                        placeholder="#"
                                      />
                                    ) : (
                                      <span className="text-muted-foreground text-xs">-</span>
                                    )}
                                  </TableCell>

                                  {/* Printing Type */}
                                  <TableCell className="px-1 text-center">
                                    {row.processingType === 'PRINTING' && row.costInputMode !== 'LANDED_PRICE' ? (
                                      <Select
                                        value={row.printingType || ''}
                                        onValueChange={(value) => {
                                          const newPrintingType = value as
                                            | 'PIGMENT'
                                            | 'PROCIAN'
                                            | 'DISCHARGE'
                                            | 'PIGMENT_DISCHARGE';
                                          updateRow(index, {
                                            printingType: newPrintingType,
                                            processingCostPerMeter: null,
                                            slabLabel: null,
                                          });
                                          // Auto-lookup after printing type is selected
                                          if (value && row.processorId && row.greigeId) {
                                            // Pass the new printingType as override since state hasn't updated yet
                                            lookupRate(index, { printingType: newPrintingType });
                                          }
                                        }}
                                      >
                                        <SelectTrigger className="w-[70px] h-7 text-[10px]">
                                          <SelectValue placeholder="Type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="PIGMENT" className="text-xs">
                                            Pigment
                                          </SelectItem>
                                          <SelectItem value="PROCIAN" className="text-xs">
                                            Procian
                                          </SelectItem>
                                          <SelectItem value="DISCHARGE" className="text-xs">
                                            Discharge
                                          </SelectItem>
                                          <SelectItem value="PIGMENT_DISCHARGE" className="text-xs">
                                            Pig+Dis
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <span className="text-muted-foreground text-xs">-</span>
                                    )}
                                  </TableCell>

                                  {/* Screen Type */}
                                  <TableCell className="px-1 text-center">
                                    {row.processingType === 'PRINTING' && row.costInputMode !== 'LANDED_PRICE' ? (
                                      <Select
                                        value={row.screenType || ''}
                                        onValueChange={(value) =>
                                          updateRow(index, {
                                            screenType: value as 'ROTARY' | 'FLATBELT' | 'TABLE',
                                          })
                                        }
                                      >
                                        <SelectTrigger className="w-[65px] h-7 text-[10px]">
                                          <SelectValue placeholder="Screen" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="ROTARY" className="text-xs">
                                            Rotary
                                          </SelectItem>
                                          <SelectItem value="FLATBELT" className="text-xs">
                                            Flat Belt
                                          </SelectItem>
                                          <SelectItem value="TABLE" className="text-xs">
                                            Table
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <span className="text-muted-foreground text-xs">-</span>
                                    )}
                                  </TableCell>

                                  {/* Processing Cost */}
                                  <TableCell className="px-1 text-center">
                                    {row.processingCostPerMeter ? (
                                      <div>
                                        <span className="font-medium text-xs">
                                          ₹{row.processingCostPerMeter.toFixed(2)}
                                        </span>
                                        {row.slabLabel && (
                                          <p
                                            className="text-[9px] text-muted-foreground truncate"
                                            title={row.slabLabel}
                                          >
                                            {row.slabLabel}
                                          </p>
                                        )}
                                        {/* Show individual rate comparison when in a batch group */}
                                        {row.individualRate != null &&
                                          row.batchRate != null &&
                                          row.individualRate !== row.batchRate && (
                                            <p
                                              className="text-[9px] text-muted-foreground line-through"
                                              title="Individual rate (without batch grouping)"
                                            >
                                              ₹{row.individualRate.toFixed(2)}
                                            </p>
                                          )}
                                      </div>
                                    ) : row.costInputMode === 'LANDED_PRICE' || row.finishType === 'RAW' ? (
                                      <span className="text-muted-foreground text-xs">-</span>
                                    ) : (
                                      <span className="text-muted-foreground text-[10px]">Select</span>
                                    )}
                                  </TableCell>

                                  {/* Shrinkage Cost */}
                                  <TableCell className="px-1 text-center">
                                    {row.shrinkageValue ? (
                                      <div>
                                        <span className="text-xs">₹{row.shrinkageValue.toFixed(2)}</span>
                                        {row.shrinkagePercent && (
                                          <div className="text-[9px] text-muted-foreground">
                                            {row.shrinkagePercent}%
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground text-xs">-</span>
                                    )}
                                  </TableCell>

                                  {/* Total Cost */}
                                  <TableCell className="px-1 text-center">
                                    {row.totalCostPerMeter ? (
                                      <span className="font-bold text-xs">₹{row.totalCostPerMeter.toFixed(2)}</span>
                                    ) : (
                                      <span className="text-muted-foreground text-xs">-</span>
                                    )}
                                  </TableCell>

                                  {/* Part Cost (CAD × Total ₹/m) */}
                                  <TableCell className="px-1 text-center">
                                    {row.totalCostPerMeter && row.cadMeters > 0 ? (
                                      <span className="text-xs">
                                        ₹{(row.cadMeters * row.totalCostPerMeter).toFixed(2)}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground text-xs">-</span>
                                    )}
                                  </TableCell>

                                  {/* Fabric Requirement (CAD × Qty) */}
                                  <TableCell className="px-1 text-center">
                                    {row.cadMeters > 0 ? (
                                      <span className="text-xs">
                                        {((row.rowQuantity || orderQuantity) * row.cadMeters).toLocaleString(
                                          undefined,
                                          { maximumFractionDigits: 0 }
                                        )}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground text-xs">-</span>
                                    )}
                                  </TableCell>

                                  {/* Greige Requirement (Fabric Req ÷ (1 - Shrinkage%)) */}
                                  <TableCell className="px-1 text-center">
                                    {row.cadMeters > 0 ? (
                                      (() => {
                                        const qty = row.rowQuantity ?? orderQuantity;
                                        const fabricReq = row.cadMeters * qty;
                                        const shrinkage = row.shrinkagePercent || 0;
                                        const greigeReq = divideByShrinkage(fabricReq, shrinkage);
                                        return (
                                          <span className="text-xs">
                                            {greigeReq.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                          </span>
                                        );
                                      })()
                                    ) : (
                                      <span className="text-muted-foreground text-xs">-</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              </React.Fragment>
                            );
                          })}

                          {/* Subtotal Row for this greige group */}
                          {showSubtotal && (
                            <TableRow className="bg-info-muted font-medium border-t-2 border-info/20">
                              <TableCell className="px-1" colSpan={3}>
                                <span className="text-xs font-semibold text-info">Subtotal: {group.greigeName}</span>
                              </TableCell>
                              <TableCell className="px-1 text-center">
                                <span className="text-xs font-semibold text-info">
                                  {subtotals.totalCadMeters.toFixed(3)}
                                </span>
                              </TableCell>
                              <TableCell colSpan={10} className="px-1"></TableCell>
                              <TableCell className="px-1 text-center">
                                {subtotals.totalRowCost !== null ? (
                                  <span className="text-xs font-bold text-info">
                                    ₹{subtotals.totalRowCost.toFixed(2)}/pc
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground text-xs">-</span>
                                )}
                              </TableCell>
                              <TableCell className="px-1 text-center">
                                <span className="text-xs font-semibold text-info">
                                  {subtotals.totalFabricReq.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </span>
                              </TableCell>
                              <TableCell className="px-1 text-center">
                                <span className="text-xs font-semibold text-info">
                                  {subtotals.totalGreigeReq.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </span>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })}
              </TableBody>
            </Table>

            {/* Summary Footer */}
            <div className="p-4 bg-muted border-t flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                {fabricRows.length} fabric{fabricRows.length !== 1 ? 's' : ''} •{fabricsWithCosts} with cost calculated
              </div>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Info className="w-4 h-4" />
                  Cost per meter will be used in Cost Sheet calculation
                </span>
                {selectedStyleId && fabricsWithCosts > 0 && purpose === 'COSTING' && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => navigate(`/cost-sheets/new?styleId=${selectedStyleId}`)}
                    className="bg-info hover:bg-info"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Create Cost Sheet
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </>
      )}

      {/* Create Costing Run Dialog */}
      <Dialog open={showCreateRunDialog} onOpenChange={setShowCreateRunDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-info" />
              Create Costing Run?
            </DialogTitle>
            <DialogDescription>
              Save these {savedCadIds.length} fabric(s) as a new costing run. This allows you to easily select this
              combination when creating a Cost Sheet.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="p-3 bg-info-muted rounded-lg border border-info/15">
              <p className="text-sm text-info">
                <strong>Run {existingRuns.length + 1}</strong> will be created with:
              </p>
              <ul className="mt-2 text-sm text-info list-disc list-inside">
                <li>{savedCadIds.length} fabric entries</li>
                <li>
                  Purpose:{' '}
                  {purpose === 'COSTING'
                    ? 'Costing'
                    : purpose === 'RAW_MATERIAL_CALCULATION'
                      ? 'Raw Material Calculation'
                      : 'Production'}
                </li>
              </ul>
            </div>
          </div>

          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowCreateRunDialog(false)} disabled={isCreatingRun}>
              Skip
            </Button>
            <Button onClick={handleCreateRun} disabled={isCreatingRun} className="bg-info hover:bg-info">
              {isCreatingRun ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Package className="w-4 h-4 mr-2" />
                  Create Run {existingRuns.length + 1}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BUG-FC3 fix: Unsaved changes warning dialog for in-app navigation */}
      <UnsavedDialog />
    </div>
  );
}
