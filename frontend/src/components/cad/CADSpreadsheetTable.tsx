/**
 * CADSpreadsheetTable Component
 *
 * A spreadsheet-style table for CAD planning that shows all CAD entries in a flat table.
 * Each row represents one CAD entry with inline editing for all fields.
 *
 * Columns:
 * Purpose | Component | Part | Fabric Finish | Embroidery | Generic Greige | Greige Name |
 * Cutable Width | Print Direction | Size Breakup | No. of Pcs | Layer Margin | Layer(M) | CAD Average
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus,
  Trash2,
  Loader2,
  Calculator,
  Table as TableIcon,
  Pencil,
  Save,
  X,
  Check,
  XCircle,
  Clock,
  Lock,
  Copy,
  GitBranch,
  Package,
  Sparkles,
  AlertCircle,
  MoreHorizontal,
  History,
  PencilLine,
  ImageIcon,
  ImagePlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { notify } from '@/lib/notify';
// BUG-CAD11 fix: use shared error utility instead of inline extraction
import { getErrorMessage } from '@/lib/api-error-handler';
import {
  cadPlanningService,
  cadInUseFromError,
  type CadInUseEntry,
  type PendingCadCorrection,
} from '@/services/cad-planning.service';
import { CadInUseNotice } from './CadInUseNotice';
import { CadHistoryDialog } from './CadHistoryDialog';
import { SizeBreakdownPopup } from './SizeBreakdownPopup';
import { CorrectCadDialog } from './CorrectCadDialog';
import { MarkerImageDialog, MarkerStateBadge, type MarkerValuesForRow } from './MarkerImageDialog';
import { miniMarkerService, markerRefusalFromError } from '@/services/miniMarker.service';
import type { MarkerDifference } from '@/types/cadFile.types';
import { Textarea } from '@/components/ui/textarea';
import { isQtyZero } from '@/lib/quantity';
import { fabricStockService, type FabricStockForCAD } from '@/services/fabricStockService';
import type {
  CADSpreadsheetRow,
  CADComponentOption,
  CADGreigeOption,
  CADSizeOption,
  CADSizeBreakdown,
  CADPurpose,
  PrintDirection,
  UpdateCADRowRequest,
  CADSpreadsheetRowExtended,
} from '@/types/cad-planning.types';
import {
  CAD_PURPOSE_LABELS,
  PRINT_DIRECTION_LABELS,
  ALL_PARTS_CODE,
  CADApprovalStatus,
} from '@/types/cad-planning.types';

import { CopyCADConfirmationDialog } from './CopyCADConfirmationDialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import { CADPartMultiSelect } from './CADPartMultiSelect';
import { formatDate, formatDateTime } from '@/lib/date';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Field styling by type for visual differentiation
 * - Editable (Blue): Fields user can modify
 * - Pre-populated (Gray): Auto-filled from master data
 * - Calculated (Green): Computed values
 */
const FIELD_STYLES = {
  editable: {
    cell: 'bg-info-muted border-l-2 border-l-blue-400',
    cellEdit: 'bg-info/15 border-l-2 border-l-blue-500',
  },
  prepopulated: {
    cell: 'bg-slate-100 text-slate-700 border-l-2 border-l-slate-400',
    cellEdit: 'bg-slate-200 text-slate-700 border-l-2 border-l-slate-500',
  },
  calculated: {
    cell: 'bg-success-muted text-success border-l-2 border-l-green-500 font-medium',
    cellEdit: 'bg-success-muted text-success border-l-2 border-l-green-500 font-medium',
  },
} as const;

// Helper to get cell class based on field type and edit state
const getFieldClass = (type: keyof typeof FIELD_STYLES, isEditing: boolean) => {
  return isEditing ? FIELD_STYLES[type].cellEdit : FIELD_STYLES[type].cell;
};

/** Spare above this earns a warning — the backend's MARKER_SPARE_WARN_INCHES (lot-width.helper) */
const MARKER_SPARE_WARN_INCHES = 2;

/**
 * Under a Production row's width: its lot's cutable width and what is left over. A marker may be narrower
 * than its lot (52" on 53" cutable: 1" spare) but never wider — the server refuses that save / approve.
 */
function LotFitNote({ width, lotCutable }: { width: number | null; lotCutable: number | null | undefined }) {
  if (lotCutable == null || width == null || !(width > 0)) return null;
  const spare = Math.round((lotCutable - width) * 100) / 100;
  if (spare < -0.005) {
    return (
      <div className="text-[10px] text-destructive whitespace-nowrap" title="The marker will not fit this lot">
        Wider than lot ({lotCutable}")
      </div>
    );
  }
  const wide = spare > MARKER_SPARE_WARN_INCHES;
  return (
    <div
      className={cn('text-[10px] whitespace-nowrap', wide ? 'text-amber-700' : 'text-muted-foreground')}
      title={wide ? 'A wider marker may save fabric' : "The lot's cutable width"}
    >
      Lot {lotCutable}"{spare > 0.005 ? ` · ${spare}" spare` : ''}
    </div>
  );
}

export interface CADSpreadsheetTableProps {
  styleId: string;
  rows: CADSpreadsheetRow[];
  components: CADComponentOption[];
  availableGreiges: CADGreigeOption[];
  sizeOptions: CADSizeOption[];
  onAddRow: (styleFabricId: string, partId?: string, purpose?: CADPurpose, fabricStockId?: string) => Promise<void>;
  onAddCombinedRow?: (styleFabricIds: string[], purpose?: CADPurpose, fabricStockId?: string) => Promise<void>;
  onUpdateRow: (rowId: string, data: UpdateCADRowRequest) => Promise<void>;
  onDeleteRow: (rowId: string) => Promise<void>;
  disabled?: boolean;
  isLoading?: boolean;
  /** When true, style is approved but users can still add new width variants */
  isStyleApproved?: boolean;
  /** Callback to refresh data after approve/reject/version operations (replaces window.location.reload) */
  onDataRefresh?: () => void;
  /** Corrections of this style's CAD rows waiting for an admin ("Correction pending" badges) */
  pendingCorrections?: PendingCadCorrection[];
}

export function CADSpreadsheetTable({
  styleId,
  rows,
  components,
  availableGreiges,
  sizeOptions,
  onAddRow,
  onAddCombinedRow,
  onUpdateRow,
  onDeleteRow,
  disabled = false,
  isLoading = false,
  isStyleApproved = false,
  onDataRefresh,
  pendingCorrections = [],
}: CADSpreadsheetTableProps) {
  const [editingRow, setEditingRow] = useState<string | null>(null);
  // Another row was asked for while this one has unsaved changes (withEditOf): save / discard them, then go on
  const [switchRowPrompt, setSwitchRowPrompt] = useState<{ from: string; then: () => void } | null>(null);
  // The row whose Delete was clicked, waiting for the confirmation
  const [deleteConfirmRowId, setDeleteConfirmRowId] = useState<string | null>(null);
  const [savingRow, setSavingRow] = useState<string | null>(null);
  const [deletingRow, setDeletingRow] = useState<string | null>(null);
  const [sizeBreakdownOpen, setSizeBreakdownOpen] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Record<string, Partial<UpdateCADRowRequest>>>({});
  const [addRowDialogOpen, setAddRowDialogOpen] = useState(false);
  const [addingRow, setAddingRow] = useState(false);
  const [approvingRow, setApprovingRow] = useState<string | null>(null);
  const [rejectingRow, setRejectingRow] = useState<string | null>(null);
  const [copyingRow, setCopyingRow] = useState<string | null>(null);
  const [creatingVersion, setCreatingVersion] = useState<string | null>(null);
  // Copy CAD dialog state
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [copySourceRow, setCopySourceRow] = useState<CADSpreadsheetRow | null>(null);
  const [copyTargetPurpose, setCopyTargetPurpose] = useState<'RAW_MATERIAL_CALCULATION' | 'PRODUCTION' | null>(null);
  // Rejection reason dialog state (BUG-CAD6: replaces native prompt())
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectDialogRowId, setRejectDialogRowId] = useState<string | null>(null);
  // Approved cost sheets / order BOMs built on the row (409 CAD_IN_USE) — the reject is refused
  const [rejectInUse, setRejectInUse] = useState<CadInUseEntry[] | null>(null);
  // History dialog (who created / edited / approved / rejected the row)
  const [historyRowId, setHistoryRowId] = useState<string | null>(null);
  // Correct CAD dialog (an approved row, fixed and carried to its cost sheets / orders)
  const [correctRow, setCorrectRow] = useState<CADSpreadsheetRow | null>(null);
  const pendingByCad = useMemo(() => new Map(pendingCorrections.map((c) => [c.cadId, c])), [pendingCorrections]);
  // CAD image of each row (backend helpers/cad-marker.helper.ts): its state, what was read, the differences
  const [markerRowId, setMarkerRowId] = useState<string | null>(null);
  // A save refused because the values differ from the row's CAD image — asks for the reason, then saves
  // (also when the row has NO image: its values are then saved by hand, with the reason — `noImage`)
  const [markerReasonPrompt, setMarkerReasonPrompt] = useState<{
    rowId: string;
    differences: MarkerDifference[];
    noImage?: boolean;
  } | null>(null);
  const [markerReason, setMarkerReason] = useState('');
  const { data: rowMarkers, refetch: refetchMarkers } = useQuery({
    queryKey: ['cadRowMarkers', styleId],
    queryFn: () => miniMarkerService.getRowMarkers(styleId),
    enabled: !!styleId,
  });
  const markerByRow = useMemo(() => new Map((rowMarkers ?? []).map((m) => [m.cadId, m])), [rowMarkers]);
  // The rows reload after every save, approve and correction — the image states follow them
  useEffect(() => {
    void refetchMarkers();
  }, [rows, refetchMarkers]);
  const [rejectionReason, setRejectionReason] = useState('');
  // Version reason dialog state (BUG-CAD6: replaces native prompt())
  const [versionDialogOpen, setVersionDialogOpen] = useState(false);
  const [versionDialogRowId, setVersionDialogRowId] = useState<string | null>(null);
  const [versionReason, setVersionReason] = useState('');
  // Multi-select state for batch CAD row creation
  const [selectedStyleFabrics, setSelectedStyleFabrics] = useState<string[]>([]);
  const [selectAllStyleFabrics, setSelectAllStyleFabrics] = useState(false);
  // Purpose selection for new CAD rows (COSTING default, PRODUCTION requires stock)
  const [selectedPurpose, setSelectedPurpose] = useState<CADPurpose>('COSTING');
  // Stock selection for PRODUCTION CAD rows (required)
  const [selectedStockForProduction, setSelectedStockForProduction] = useState<string | null>(null);
  const [productionStockOptions, setProductionStockOptions] = useState<FabricStockForCAD[]>([]);
  const [loadingProductionStock, setLoadingProductionStock] = useState(false);
  // Stock selection modal state (for PRODUCTION CAD)
  const [stockSelectionOpen, setStockSelectionOpen] = useState(false);
  const [selectedRowForStock, setSelectedRowForStock] = useState<string | null>(null);
  const [loadingStock, setLoadingStock] = useState(false);
  const [availableStock, setAvailableStock] = useState<FabricStockForCAD[]>([]);
  // Variance warning state
  const [varianceWarningOpen, setVarianceWarningOpen] = useState(false);
  const [pendingStockSelection, setPendingStockSelection] = useState<{
    stockId: string;
    stock: FabricStockForCAD;
    planningWidth?: number;
    variance?: number;
    variancePercent?: number;
  } | null>(null);

  // Get all available style fabrics for add row from components
  // Note: Backend serializer maps 'styleFabrics' to 'fabrics'
  const styleFabrics = useMemo(() => {
    const fabricsList: {
      id: string;
      componentName: string;
      componentId: string;
      fabricFinishType: string | null;
      genericGreigeName: string | null;
      printDesign?: string | null;
      colorName?: string | null;
      hasEmbroidery?: boolean;
      embroideryCode?: string | null;
      fabricCode?: string | null;
    }[] = [];
    const seen = new Set<string>();

    // Get from components prop (primary source) - uses 'fabrics' due to serializer mapping
    components.forEach((comp) => {
      if (comp.fabrics) {
        comp.fabrics.forEach((sf) => {
          if (!seen.has(sf.id)) {
            seen.add(sf.id);
            fabricsList.push({
              id: sf.id,
              componentName: comp.name,
              componentId: comp.id,
              fabricFinishType: sf.fabricFinishType,
              genericGreigeName: sf.genericGreigeName,
              printDesign: sf.printDesign,
              colorName: sf.colorName,
              hasEmbroidery: sf.hasEmbroidery,
              embroideryCode: sf.embroideryCode,
              fabricCode: sf.fabricCode,
            });
          }
        });
      }
    });

    // Fallback: also check existing rows in case components don't have fabrics
    if (fabricsList.length === 0) {
      rows.forEach((row) => {
        if (!seen.has(row.styleFabricId)) {
          seen.add(row.styleFabricId);
          fabricsList.push({
            id: row.styleFabricId,
            componentName: row.componentName,
            componentId: row.componentId,
            fabricFinishType: row.fabricFinishType,
            genericGreigeName: row.genericGreigeName,
            hasEmbroidery: row.isEmbroidery,
          });
        }
      });
    }

    return fabricsList;
  }, [components, rows]);

  // Count existing CAD rows per fabric ID for "Added (N)" badge
  const fabricCadCounts = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((row) => {
      // Count the primary styleFabricId
      counts.set(row.styleFabricId, (counts.get(row.styleFabricId) || 0) + 1);

      // For combined rows, also count all fabric IDs in combinedFabricIds
      if (row.isCombinedCutting && row.combinedFabricIds && Array.isArray(row.combinedFabricIds)) {
        row.combinedFabricIds.forEach((fabricId) => {
          // Don't double-count the primary styleFabricId
          if (fabricId !== row.styleFabricId) {
            counts.set(fabricId, (counts.get(fabricId) || 0) + 1);
          }
        });
      }
    });
    return counts;
  }, [rows]);

  // Check if selected fabrics can be combined into a single CAD row
  // Rules (mirrors addCombinedCADRow on the server): same genericGreigeName, same fabricFinishType,
  // same colour / print design, same embroidery status and design
  const canCombineSelected = useMemo(() => {
    if (selectedStyleFabrics.length < 2) return { canCombine: false, reason: '' };

    const selectedFabrics = styleFabrics.filter((sf) => selectedStyleFabrics.includes(sf.id));
    if (selectedFabrics.length < 2) return { canCombine: false, reason: '' };

    const first = selectedFabrics[0];
    const lookOf = (sf: (typeof selectedFabrics)[number]) => sf.printDesign || sf.colorName || null;
    const firstLook = lookOf(first);

    for (const sf of selectedFabrics) {
      if (sf.genericGreigeName !== first.genericGreigeName) {
        return {
          canCombine: false,
          reason: `Different fabric types: "${first.genericGreigeName}" vs "${sf.genericGreigeName}"`,
        };
      }
      if (sf.fabricFinishType !== first.fabricFinishType) {
        return {
          canCombine: false,
          reason: `Different finish types: "${first.fabricFinishType}" vs "${sf.fabricFinishType}"`,
        };
      }
      const sfLook = lookOf(sf);
      if ((sfLook || '').trim().toLowerCase() !== (firstLook || '').trim().toLowerCase()) {
        return {
          canCombine: false,
          reason: `Different colours: "${firstLook || 'none'}" vs "${sfLook || 'none'}" — add them as separate rows`,
        };
      }
      // Check embroidery status matches
      const firstHasEmb = !!first.hasEmbroidery;
      const sfHasEmb = !!sf.hasEmbroidery;
      if (firstHasEmb !== sfHasEmb) {
        return {
          canCombine: false,
          reason: 'Cannot combine plain and embroidered fabrics',
        };
      }
      if (firstHasEmb && sf.embroideryCode !== first.embroideryCode) {
        return {
          canCombine: false,
          reason: `Different embroidery designs: "${first.embroideryCode || 'none'}" vs "${sf.embroideryCode || 'none'}"`,
        };
      }
    }

    return {
      canCombine: true,
      reason: `Same fabric: ${first.genericGreigeName} ${first.fabricFinishType}${firstLook ? ` ${firstLook}` : ''}`,
    };
  }, [selectedStyleFabrics, styleFabrics]);

  // RETIRED 2026-09-28: an effect here copied one row's size breakdown into every sibling row with none,
  // saving it without the user seeing it. Each row's sizes now come from its own marker image (CAD Image →
  // Use these values) and are checked against it on save (backend helpers/cad-marker.helper.ts).

  // Group and sort rows by purpose for visual separation
  const groupedRows = useMemo(() => {
    const purposeOrder: (CADPurpose | null)[] = ['COSTING', 'RAW_MATERIAL_CALCULATION', 'PRODUCTION'];

    // Group rows by purpose
    const groups: Record<string, CADSpreadsheetRow[]> = {};
    purposeOrder.forEach((p) => (groups[p || 'null'] = []));

    rows.forEach((row) => {
      const key = row.purpose || 'COSTING'; // Default to COSTING if null
      if (key in groups) {
        groups[key].push(row);
      }
    });

    // Return array of { purpose, rows } with non-empty groups only
    return purposeOrder
      .map((purpose) => ({
        purpose,
        rows: groups[purpose || 'null'],
      }))
      .filter((group) => group.rows.length > 0);
  }, [rows]);

  // Get default cutable width based on greige width
  // Business rules: 63" greige → 52", 48" greige → 40"
  const getDefaultCutableWidth = (greigeId: string | null): number | null => {
    if (!greigeId) return null;
    const greige = availableGreiges.find((g) => g.id === greigeId);
    if (!greige) return null;

    // The server's rule (defaultCutableWidthForGreige, cad-planning.utils.ts) — the width a save with no width
    // stores when the greige changes
    const greigeWidth = greige.greigeWidth ? Number(greige.greigeWidth) : 0;
    if (greigeWidth >= 63) return 52;
    if (greigeWidth >= 48) return 40;
    return greige.expectedFinishedWidthMin ? Number(greige.expectedFinishedWidthMin) : 44;
  };

  // The greiges a row's Greige cell offers — those of the row's generic greige, searchable — plus the row's
  // own greige when it is no longer offered (made inactive), so the cell still names it
  const greigeOptionsFor = (row: CADSpreadsheetRow): ComboboxOption[] => {
    const options: ComboboxOption[] = availableGreiges
      .filter((g) => !row.genericGreigeName || g.genericGreigeName === row.genericGreigeName)
      .map((g) => ({
        value: g.id,
        label: g.greigeName,
        searchText: [g.greigeName, g.genericGreigeName, g.supplierName].filter(Boolean).join(' '),
      }));
    if (row.greigeId && row.greigeName && !options.some((o) => o.value === row.greigeId)) {
      options.unshift({ value: row.greigeId, label: row.greigeName });
    }
    return options;
  };

  // Get pattern parts for a component
  // masterPatternParts = component master definitions; patternParts = style-assigned (via serializer)
  const getPatternParts = (componentId: string) => {
    const comp = components.find((c) => c.id === componentId);
    if (!comp) return [];
    const parts = [...(comp.masterPatternParts || [])];
    (comp.patternParts || []).forEach((spp) => {
      if (!parts.find((p) => p.id === spp.id)) {
        parts.push(spp);
      }
    });
    return parts;
  };

  // Get parts already used in other CAD rows for same style fabric at the SAME width and purpose
  // Same part CAN be used at different widths or purposes (variants are allowed)
  const getUsedPartIds = (
    styleFabricId: string,
    currentRowId: string,
    currentWidth: number | null, // Width of the row being edited
    currentPurpose: string | null // Purpose of the row being edited
  ): Set<string> => {
    const usedParts = new Set<string>();
    rows.forEach((row) => {
      if (row.styleFabricId === styleFabricId && row.id !== currentRowId) {
        // Compare widths with type coercion (both could be string or number)
        const rowWidth = row.cutableWidth != null ? Number(row.cutableWidth) : null;
        const currWidth = currentWidth != null ? Number(currentWidth) : null;
        // Only mark as used if SAME width - width variants are allowed
        const sameWidth = currWidth !== null && rowWidth !== null && currWidth === rowWidth;
        // Check if same purpose - different purposes can reuse the same part
        const samePurpose = currentPurpose !== null && row.purpose === currentPurpose;
        // Don't count "All Parts" as a used part (it's a special grouping)
        // Used = SAME width AND SAME purpose, whatever the greige: the save refuses that pair (and the row's unique
        // key — part, fabric, width, purpose — has no greige). Offering it on another greige led to "already exists".
        if (row.partId && row.partCode !== ALL_PARTS_CODE && sameWidth && samePurpose) {
          usedParts.add(row.partId);
        }
      }
    });
    return usedParts;
  };

  // Check if "All Parts" is already used for this style fabric at the SAME width and purpose
  // "All Parts" at one width doesn't prevent using it at a different width
  const isAllPartsUsed = (
    styleFabricId: string,
    currentRowId: string,
    currentPartCode: string | null,
    currentWidth: number | null, // Width of the row being edited
    currentPurpose: string | null // Purpose of the row being edited
  ): boolean => {
    const currWidth = currentWidth != null ? Number(currentWidth) : null;
    return (
      rows.some((row) => {
        const rowWidth = row.cutableWidth != null ? Number(row.cutableWidth) : null;
        return (
          row.styleFabricId === styleFabricId &&
          row.id !== currentRowId &&
          row.partCode === ALL_PARTS_CODE &&
          // "All Parts" is used at the SAME width AND SAME purpose, whatever the greige (as the save checks)
          currWidth !== null &&
          rowWidth !== null &&
          currWidth === rowWidth &&
          currentPurpose !== null &&
          row.purpose === currentPurpose
        );
      }) && currentPartCode !== ALL_PARTS_CODE
    );
  };

  // Get available parts with exclusion logic
  const getAvailablePatternParts = (
    componentId: string,
    styleFabricId: string,
    currentRowId: string,
    currentPartId: string | null,
    currentPartCode: string | null,
    currentWidth: number | null, // Width of the row being edited
    currentPurpose: string | null // Purpose of the row being edited
  ) => {
    const allParts = getPatternParts(componentId);
    const usedPartIds = getUsedPartIds(styleFabricId, currentRowId, currentWidth, currentPurpose);
    const allPartsAlreadyUsed = isAllPartsUsed(
      styleFabricId,
      currentRowId,
      currentPartCode,
      currentWidth,
      currentPurpose
    );

    return {
      parts: allParts.map((part) => ({
        ...part,
        // Mark as used if: already used in another row AND not the current selection
        // Also mark "All Parts" as used if already selected in another row
        isUsed:
          (usedPartIds.has(part.id) && part.id !== currentPartId) ||
          (part.code === ALL_PARTS_CODE && allPartsAlreadyUsed),
      })),
      allPartsAvailable: !allPartsAlreadyUsed,
    };
  };

  // Handle field change with auto-populate logic for stock widths
  const handleFieldChange = (
    rowId: string,
    field: keyof UpdateCADRowRequest,
    value: UpdateCADRowRequest[keyof UpdateCADRowRequest]
  ) => {
    setPendingChanges((prev) => {
      const newChanges = {
        ...prev,
        [rowId]: {
          ...prev[rowId],
          [field]: value,
        },
      };

      // A greige change with no width typed in this edit: the server stores that greige's default width (or the
      // received lot's), replacing the row's — so show it in the row now instead of a width that will not be saved.
      // A row with no width yet keeps the default as its placeholder, as before.
      if (field === 'greigeId' && value) {
        const row = rows.find((r) => r.id === rowId);
        const typedWidth = prev[rowId]?.cutableWidth;
        if (row && (typedWidth === undefined || typedWidth === null)) {
          const replacesWidth = value !== row.greigeId && !!row.cutableWidth;
          const fromStock = row.stockWidths && row.stockWidths.length > 0 ? row.stockWidths[0] : null;
          const width =
            !row.cutableWidth || replacesWidth
              ? (fromStock ?? (replacesWidth ? getDefaultCutableWidth(value as string) : null))
              : null;
          if (width !== null) {
            newChanges[rowId] = {
              ...newChanges[rowId],
              cutableWidth: width,
            };
          }
        }
      }

      return newChanges;
    });
  };

  // Save row changes
  /** true when the row was saved (or had nothing to save) */
  const handleSaveRow = async (rowId: string): Promise<boolean> => {
    const changes = pendingChanges[rowId];
    if (!changes || Object.keys(changes).length === 0) {
      setEditingRow(null);
      return true;
    }

    // Get current row data
    const currentRow = rows.find((r) => r.id === rowId);
    if (!currentRow) {
      notify.error('Row not found');
      return false;
    }

    // Get the values that will be saved (pending changes override current values)
    const finalPartId = changes.partId !== undefined ? changes.partId : currentRow.partId;
    const finalWidth =
      changes.cutableWidth !== undefined
        ? Number(changes.cutableWidth)
        : currentRow.cutableWidth
          ? Number(currentRow.cutableWidth)
          : null;

    // Get pattern parts for this component to look up part code/name
    const componentPatternParts = getPatternParts(currentRow.componentId);
    const finalPartCode = finalPartId
      ? componentPatternParts.find((p) => p.id === finalPartId)?.code || currentRow.partCode
      : currentRow.partCode;

    // Check for duplicate Part + Width + Purpose combination in same styleFabric
    // Different purposes (e.g., RAW_MATERIAL_CALCULATION vs COSTING) can have same width
    // A Production CAD is the marker for ONE received lot: two lots at the same width each get their own
    if (finalWidth !== null) {
      const finalPurpose = changes.purpose !== undefined ? changes.purpose : currentRow.purpose;
      const currentLotId = (currentRow as CADSpreadsheetRowExtended).fabricStockId ?? null;

      const isDuplicate = rows.some((row) => {
        if (row.id === rowId) return false; // Skip current row
        if (row.styleFabricId !== currentRow.styleFabricId) return false; // Different fabric

        const rowWidth = row.cutableWidth ? Number(row.cutableWidth) : null;
        if (rowWidth !== finalWidth) return false; // Different width - allowed

        // Different purpose - allowed (e.g., COSTING vs RAW_MATERIAL_CALCULATION)
        if (row.purpose !== finalPurpose) return false;

        // Production CADs on different lots - allowed (the server refuses a second one on the SAME lot)
        if (
          finalPurpose === 'PRODUCTION' &&
          ((row as CADSpreadsheetRowExtended).fabricStockId ?? null) !== currentLotId
        ) {
          return false;
        }

        // Same width AND same purpose - check if same part
        if (finalPartCode === ALL_PARTS_CODE && row.partCode === ALL_PARTS_CODE) {
          return true; // Duplicate "All Parts" at same width and purpose
        }
        if (finalPartId && row.partId === finalPartId) {
          return true; // Duplicate specific part at same width and purpose
        }
        return false;
      });

      if (isDuplicate) {
        const partName =
          finalPartCode === ALL_PARTS_CODE
            ? 'All Parts'
            : componentPatternParts.find((p) => p.id === finalPartId)?.name || 'this part';
        const errorMsg = `${partName} at ${finalWidth}" width with the same purpose already exists. Use a different width or purpose.`;
        console.error('CAD duplicate validation:', errorMsg);
        notify.error(errorMsg, {
          duration: 6000, // Show for 6 seconds
          position: 'top-center', // Make sure it's visible
        });
        return false;
      }
    }

    setSavingRow(rowId);
    try {
      await onUpdateRow(rowId, changes);
      setPendingChanges((prev) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [rowId]: _, ...rest } = prev;
        return rest;
      });
      setEditingRow(null);
      notify.success('CAD row updated successfully');
      return true;
    } catch (error) {
      // The CAD image rule (cad-marker.helper): values that differ from the image ask for a reason; a row
      // with no image opens the image dialog. The pending edit stays so nothing typed is lost.
      const refusal = markerRefusalFromError(error);
      if (refusal?.code === 'CAD_MARKER_MISMATCH') {
        setMarkerReason('');
        setMarkerReasonPrompt({ rowId, differences: refusal.differences });
      } else if (refusal?.code === 'CAD_MARKER_IMAGE_REQUIRED') {
        // No image: attach one, or save these values by hand with a reason (the same prompt)
        setMarkerReason('');
        setMarkerReasonPrompt({ rowId, differences: refusal.differences, noImage: true });
      }
      // allow-silent-catch: otherwise the page's handler has already shown the server's reason (it names the
      // next click); a second, vaguer toast here only buried it
      return false;
    } finally {
      setSavingRow(null);
    }
  };

  // ONE row is edited at a time. Starting on another row (Edit, its sizes, Use these values, Enter values by hand)
  // while this one has unsaved changes asks first — they used to stay behind on a row out of edit mode, with no
  // Save button, and came back into the next save of that row.
  const hasPendingChanges = (rowId: string) => !!pendingChanges[rowId] && Object.keys(pendingChanges[rowId]).length > 0;
  const discardPendingChanges = (rowId: string) =>
    setPendingChanges((prev) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [rowId]: _, ...rest } = prev;
      return rest;
    });
  const withEditOf = (rowId: string, then: () => void) => {
    if (editingRow && editingRow !== rowId && hasPendingChanges(editingRow)) {
      setSwitchRowPrompt({ from: editingRow, then });
      return;
    }
    then();
  };

  // Handle delete row — asked first (deleteConfirmRowId): the row menu deleted at one click, with no way back
  const handleDeleteRow = async (rowId: string) => {
    setDeleteConfirmRowId(null);
    setDeletingRow(rowId);
    try {
      await onDeleteRow(rowId);
    } catch {
      // allow-silent-catch: the page's handler has already shown the server's reason (it names the next
      // click); a second, vaguer toast here only buried it
    } finally {
      setDeletingRow(null);
    }
  };

  // Handle add row - always opens dialog so user can select purpose
  const handleAddRowClick = () => {
    if (styleFabrics.length === 0) {
      notify.error('No fabrics available to add CAD row. Please add components with fabrics first.');
      return;
    }
    // Always show dialog so user can select purpose (Costing/Raw Mat/Production)
    setAddRowDialogOpen(true);
    // Pre-select the only fabric if there's just one
    if (styleFabrics.length === 1) {
      setSelectedStyleFabrics([styleFabrics[0].id]);
    }
  };

  // Load available stock for PRODUCTION purpose when style fabrics are selected
  // `fabricIds` = the ticks as they are about to be (a tick change reloads the lots before its state settles)
  const loadProductionStock = async (fabricIds: string[] = selectedStyleFabrics) => {
    if (fabricIds.length === 0) return;

    setLoadingProductionStock(true);
    try {
      // Get the first selected fabric to determine embroidery status
      const firstFabric = styleFabrics.find((sf) => fabricIds.includes(sf.id));
      // 'any' = embroidered lots of any design (undefined sent no filter, so plain lots were offered too)
      const embroideryFilter = firstFabric?.hasEmbroidery ? 'any' : null;

      const stock = await fabricStockService.getStockForStyle(styleId, {
        status: 'AVAILABLE',
        embroideryId: embroideryFilter,
      });
      setProductionStockOptions(stock);
    } catch (error: unknown) {
      // BUG-CAD11 fix: use error utility instead of inline extraction
      notify.error(`Failed to load stock: ${getErrorMessage(error)}`);
      setProductionStockOptions([]);
    } finally {
      setLoadingProductionStock(false);
    }
  };

  // The fabrics ticked in Add Row. For a Production row the lots offered depend on them (plain or embroidered), so
  // they are reloaded — they used to load only when the purpose changed, from whatever was ticked then.
  const changeFabricTicks = (next: string[]) => {
    setSelectedStyleFabrics(next);
    if (selectedPurpose === 'PRODUCTION') {
      setSelectedStockForProduction(null);
      if (next.length > 0) void loadProductionStock(next);
      else setProductionStockOptions([]);
    }
  };

  // Handle batch creation of CAD rows for multiple style_fabrics
  const handleBatchAddRows = async () => {
    if (selectedStyleFabrics.length === 0) return;

    // For PRODUCTION purpose, stock is required
    if (selectedPurpose === 'PRODUCTION' && !selectedStockForProduction) {
      notify.error('PRODUCTION CAD requires stock selection. Please select available stock or use COSTING purpose.');
      return;
    }
    // A Production CAD is the marker of ONE lot, on that lot's own fabric: one lot cannot be every ticked fabric's
    // (all but one were refused). Several fabrics cut together are one combined row.
    if (selectedPurpose === 'PRODUCTION' && selectedStyleFabrics.length > 1) {
      notify.error(
        'A Production CAD is for one fabric lot — tick one fabric, or use "Combine as 1 PRODUCTION Row" for fabrics cut together.'
      );
      return;
    }

    setAddingRow(true);
    try {
      let successCount = 0;
      let failCount = 0;
      let firstError: unknown = null;

      // Create CAD rows for all selected style_fabrics
      for (const styleFabricId of selectedStyleFabrics) {
        try {
          await onAddRow(
            styleFabricId,
            undefined,
            selectedPurpose,
            selectedPurpose === 'PRODUCTION' ? selectedStockForProduction! : undefined
          );
          successCount++;
        } catch (error) {
          console.error(`Failed to add CAD row for ${styleFabricId}:`, error);
          firstError ??= error;
          failCount++;
        }
      }

      // Show result notification — one, with the server's reason (the page no longer toasts each row)
      if (failCount === 0) {
        notify.success(`Successfully created ${successCount} ${selectedPurpose} CAD row${successCount > 1 ? 's' : ''}`);
      } else if (successCount > 0) {
        notify.warning(`Created ${successCount} row(s), ${failCount} failed: ${getErrorMessage(firstError)}`);
      } else {
        notify.error(getErrorMessage(firstError));
      }

      // Reset state
      resetAddRowDialogState();
      setAddRowDialogOpen(false);
    } catch {
      notify.error('Failed to create CAD rows');
    } finally {
      setAddingRow(false);
    }
  };

  // Reset add row dialog state
  const resetAddRowDialogState = () => {
    setSelectedStyleFabrics([]);
    setSelectAllStyleFabrics(false);
    // Keep selectedPurpose - don't reset it so user can continue adding rows with same purpose
    setSelectedStockForProduction(null);
    setProductionStockOptions([]);
  };

  // Handle combined CAD row creation
  const handleCombineRows = async () => {
    if (!onAddCombinedRow) {
      notify.error('Combined row creation not supported');
      return;
    }
    if (selectedStyleFabrics.length < 2) {
      notify.error('Select at least 2 fabrics to combine');
      return;
    }
    if (!canCombineSelected.canCombine) {
      notify.error(canCombineSelected.reason);
      return;
    }

    // For PRODUCTION purpose, stock is required
    if (selectedPurpose === 'PRODUCTION' && !selectedStockForProduction) {
      notify.error('PRODUCTION CAD requires stock selection. Please select available stock or use COSTING purpose.');
      return;
    }

    setAddingRow(true);
    try {
      await onAddCombinedRow(
        selectedStyleFabrics,
        selectedPurpose,
        selectedPurpose === 'PRODUCTION' ? selectedStockForProduction! : undefined
      );

      // Get component names for display
      const selectedFabrics = styleFabrics.filter((sf) => selectedStyleFabrics.includes(sf.id));
      const componentNames = selectedFabrics.map((sf) => sf.componentName).join(', ');
      notify.success(`Combined ${selectedPurpose} CAD row created for: ${componentNames}`);

      // Reset state
      resetAddRowDialogState();
      setAddRowDialogOpen(false);
    } catch (error: unknown) {
      // BUG-CAD11 fix: use error utility instead of inline extraction
      notify.error(getErrorMessage(error));
    } finally {
      setAddingRow(false);
    }
  };

  // "Use these values" in the CAD image dialog: the marker's length, width and sizes go into the row's
  // pending edit; nothing is saved until the user clicks Save
  const handleUseMarkerValues = (rowId: string, values: MarkerValuesForRow) =>
    withEditOf(rowId, () => applyMarkerValues(rowId, values));
  const applyMarkerValues = (rowId: string, values: MarkerValuesForRow) => {
    if (values.layerLengthMeters !== null) handleFieldChange(rowId, 'layerLengthMeters', values.layerLengthMeters);
    if (values.cutableWidth !== null) handleFieldChange(rowId, 'cutableWidth', values.cutableWidth);
    if (values.sizeBreakdowns) {
      handleFieldChange(rowId, 'sizeBreakdowns', values.sizeBreakdowns);
      handleFieldChange(
        rowId,
        'piecesPerMarker',
        values.sizeBreakdowns.reduce((sum, s) => sum + s.quantity, 0)
      );
    }
    setEditingRow(rowId);
    notify.info('Values from the CAD image are filled in — check them and click Save');
  };

  // The reason given for saving values that differ from the row's CAD image
  const handleSaveWithMarkerReason = async () => {
    if (!markerReasonPrompt) return;
    const { rowId } = markerReasonPrompt;
    const changes = pendingChanges[rowId] ?? {};
    setSavingRow(rowId);
    try {
      await onUpdateRow(rowId, { ...changes, markerOverrideReason: markerReason.trim() });
      setPendingChanges((prev) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [rowId]: _, ...rest } = prev;
        return rest;
      });
      setEditingRow(null);
      setMarkerReasonPrompt(null);
      setMarkerReason('');
      notify.success('CAD row saved with your reason');
    } catch (error) {
      const refusal = markerRefusalFromError(error);
      if (refusal?.code === 'CAD_MARKER_MISMATCH') {
        setMarkerReasonPrompt({ rowId, differences: refusal.differences });
      } else if (refusal?.code === 'CAD_MARKER_IMAGE_REQUIRED') {
        setMarkerReasonPrompt({ rowId, differences: refusal.differences, noImage: true });
      } else if (!refusal) {
        notify.error(getErrorMessage(error));
      }
    } finally {
      setSavingRow(null);
    }
  };

  // Handle size breakdown save - each row maintains its own Pcs independently
  const handleSizeBreakdownSave = (rowId: string, breakdowns: CADSizeBreakdown[]) => {
    const totalPieces = breakdowns.reduce((sum, b) => sum + b.quantity, 0);

    // Update the current row only (no sibling propagation - allows different Pcs per row). The calculator button
    // works outside edit mode too, so the row enters edit mode to show Save/Cancel for the new sizes — after
    // asking about another row's unsaved changes (it used to leave these on a row with no Save button)
    withEditOf(rowId, () => {
      handleFieldChange(rowId, 'sizeBreakdowns', breakdowns);
      handleFieldChange(rowId, 'piecesPerMarker', totalPieces);
      setEditingRow(rowId);
    });
  };

  // STOCK INTEGRATION HANDLERS (for PRODUCTION CAD)

  // Open stock selection modal
  const handleOpenStockSelection = async (rowId: string) => {
    setSelectedRowForStock(rowId);
    setStockSelectionOpen(true);
    setLoadingStock(true);
    try {
      // Get the current CAD row to check embroidery status
      const currentRow = rows.find((r) => r.id === rowId);

      // Filter stock based on embroidery status:
      // - If CAD row is for embroidery (isEmbroidery=true), show only embroidered stock
      // - If CAD row is for plain fabric (isEmbroidery=false), show only plain stock
      const embroideryFilter = currentRow?.isEmbroidery
        ? 'any' // Show embroidered stock (any embroideryId) — undefined sent no filter at all
        : null; // Show only plain stock (embroideryId=null)

      const stock = await fabricStockService.getStockForStyle(styleId, {
        status: 'AVAILABLE',
        embroideryId: embroideryFilter,
      });
      setAvailableStock(stock);
    } catch (error: unknown) {
      // BUG-CAD11 fix: use error utility instead of inline extraction
      notify.error(`Failed to load stock: ${getErrorMessage(error)}`);
      setAvailableStock([]);
    } finally {
      setLoadingStock(false);
    }
  };

  // Handle stock selection
  const handleSelectStock = async (stockId: string) => {
    if (!selectedRowForStock) return;

    const selectedStock = availableStock.find((s) => s.id === stockId);
    if (!selectedStock) return;

    // Check if there's a RAW_MATERIAL_CALCULATION CAD for variance comparison
    const currentRow = rows.find((r) => r.id === selectedRowForStock);
    if (!currentRow) return;

    // Find RAW_MATERIAL_CALCULATION CAD for the same style fabric (if exists)
    const rawMatCAD = rows.find(
      (r) =>
        r.purpose === 'RAW_MATERIAL_CALCULATION' &&
        r.styleFabricId === currentRow.styleFabricId &&
        r.partId === currentRow.partId &&
        (r as CADSpreadsheetRowExtended).approvalStatus === CADApprovalStatus.APPROVED
    );

    const sourceWidth = rawMatCAD?.cutableWidth;
    const actualWidth = selectedStock.cutableWidth;

    // Calculate variance if RAW_MATERIAL_CALCULATION CAD exists
    if (sourceWidth && Math.abs(actualWidth - sourceWidth) > 0.1) {
      const variance = actualWidth - sourceWidth;
      const variancePercent = (variance / sourceWidth) * 100;

      // Show warning if variance is significant (> 5% or > 2 inches)
      if (Math.abs(variancePercent) > 5 || Math.abs(variance) > 2) {
        setPendingStockSelection({
          stockId,
          stock: selectedStock,
          planningWidth: sourceWidth,
          variance,
          variancePercent,
        });
        setVarianceWarningOpen(true);
        return; // Wait for user confirmation
      }
    }

    // No significant variance or no RAW_MATERIAL_CALCULATION CAD - proceed directly
    await confirmStockSelection(stockId, selectedStock);
  };

  // Confirm stock selection (after variance check)
  const confirmStockSelection = async (stockId: string, selectedStock: FabricStockForCAD) => {
    if (!selectedRowForStock) return;

    try {
      // ONE call: the link sets the lot, its greige and the width — keeping the marker's own width when it fits
      // the lot. A row save first (width + greige) used to replace the marker's width before that rule could keep
      // it, checked the fit against the OLD lot, and was left half-done when the link was refused.
      await cadPlanningService.linkCADToStock(styleId, {
        cadId: selectedRowForStock,
        fabricStockId: stockId,
      });

      notify.success(`Linked to stock: ${selectedStock.rollNumbers || selectedStock.fabricCode}`);
      setStockSelectionOpen(false);
      setSelectedRowForStock(null);
      setVarianceWarningOpen(false);
      setPendingStockSelection(null);
      onDataRefresh?.();
    } catch (error: unknown) {
      // BUG-CAD11 fix: use error utility instead of inline extraction
      notify.error(`Failed to link stock: ${getErrorMessage(error)}`);
    }
  };

  // CAD PURPOSES HANDLERS

  // Handle approve CAD
  const handleApproveCAD = async (rowId: string) => {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;

    setApprovingRow(rowId);
    try {
      await cadPlanningService.approveCADPurpose(styleId, rowId, {
        purpose: row.purpose || 'COSTING',
      });
      notify.success('CAD approved successfully');
      // Trigger parent refresh via callback (BUG-CAD5: replaces window.location.reload)
      onDataRefresh?.();
    } catch (error: unknown) {
      // BUG-CAD11 fix: use error utility instead of inline extraction
      notify.error(getErrorMessage(error), { duration: 7000 });
      // Refused by the CAD image rule — show the row's image and what differs
      if (markerRefusalFromError(error)) setMarkerRowId(rowId);
    } finally {
      setApprovingRow(null);
    }
  };

  // Handle reject CAD - opens dialog (BUG-CAD6: replaces native prompt())
  const handleRejectCAD = (rowId: string) => {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;

    setRejectDialogRowId(rowId);
    setRejectionReason('');
    setRejectInUse(null);
    setRejectDialogOpen(true);
  };

  const closeRejectDialog = () => {
    setRejectDialogOpen(false);
    setRejectDialogRowId(null);
    setRejectionReason('');
    setRejectInUse(null);
  };

  // Handle rejection confirmation from dialog
  const handleRejectConfirm = async () => {
    if (!rejectDialogRowId || !rejectionReason.trim()) return;

    const row = rows.find((r) => r.id === rejectDialogRowId);
    if (!row) return;

    setRejectingRow(rejectDialogRowId);
    try {
      await cadPlanningService.rejectCADPurpose(styleId, rejectDialogRowId, {
        purpose: row.purpose || 'COSTING',
        rejectionNotes: rejectionReason.trim(),
      });
      notify.success('CAD rejected');
      closeRejectDialog();
      // Trigger parent refresh via callback (BUG-CAD5: replaces window.location.reload)
      onDataRefresh?.();
    } catch (error: unknown) {
      const inUse = cadInUseFromError(error);
      if (inUse) {
        // Keep the dialog open and show what is built on the row — it is corrected, not rejected
        setRejectInUse(inUse.inUse);
        return;
      }
      // BUG-CAD11 fix: use error utility instead of inline extraction
      notify.error(getErrorMessage(error));
    } finally {
      setRejectingRow(null);
    }
  };

  // Handle create version - opens dialog (BUG-CAD6: replaces native prompt())
  const handleCreateVersion = (rowId: string) => {
    setVersionDialogRowId(rowId);
    setVersionReason('');
    setVersionDialogOpen(true);
  };

  // Handle version creation confirmation from dialog
  const handleVersionConfirm = async () => {
    if (!versionDialogRowId) return;

    setCreatingVersion(versionDialogRowId);
    try {
      const result = await cadPlanningService.createPlanningVersion(styleId, versionDialogRowId, {
        versionReason: versionReason.trim() || undefined,
      });
      notify.success(result.message || 'New version created successfully');
      setVersionDialogOpen(false);
      setVersionDialogRowId(null);
      setVersionReason('');
      // Trigger parent refresh via callback (BUG-CAD5: replaces window.location.reload)
      onDataRefresh?.();
    } catch (error: unknown) {
      // BUG-CAD11 fix: use error utility instead of inline extraction
      notify.error(getErrorMessage(error));
    } finally {
      setCreatingVersion(null);
    }
  };

  // Handle copy CAD - Opens confirmation dialog
  const handleCopyCAD = (rowId: string, targetPurpose: string) => {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;

    // Open confirmation dialog
    setCopySourceRow(row);
    setCopyTargetPurpose(targetPurpose as 'RAW_MATERIAL_CALCULATION' | 'PRODUCTION');
    setCopyDialogOpen(true);
  };

  // Handle copy confirmation
  const handleCopyConfirm = async () => {
    if (!copySourceRow || !copyTargetPurpose) return;

    setCopyingRow(copySourceRow.id);
    try {
      const result = await cadPlanningService.copyCADRecord(styleId, {
        sourceCadId: copySourceRow.id,
        targetPurpose: copyTargetPurpose,
        styleFabricId: copySourceRow.styleFabricId,
        componentId: copySourceRow.componentId,
        patternPartId: copySourceRow.partId || undefined,
      });

      notify.success(result.message || 'Draft CAD created successfully. Please review and approve.');

      // Close dialog
      setCopyDialogOpen(false);
      setCopySourceRow(null);
      setCopyTargetPurpose(null);

      // Trigger parent refresh via callback (BUG-CAD5: replaces window.location.reload)
      onDataRefresh?.();
    } catch (error: unknown) {
      // BUG-CAD11 fix: use error utility instead of inline extraction
      notify.error(getErrorMessage(error));
    } finally {
      setCopyingRow(null);
    }
  };

  // Get display value for a row field, considering pending changes
  const getDisplayValue = <T,>(row: CADSpreadsheetRow, field: keyof CADSpreadsheetRow, defaultValue: T): T => {
    const pending = pendingChanges[row.id];
    if (pending && field in pending) {
      return pending[field as keyof UpdateCADRowRequest] as T;
    }
    return (row[field] as T) ?? defaultValue;
  };

  // Calculate totals - only count pieces from "All Parts" rows (main row per component)
  // Merges pendingChanges so the footer reflects pcs picked in the popup before the row is saved
  const totals = useMemo(() => {
    const rowBreakdowns = (row: CADSpreadsheetRow) =>
      (pendingChanges[row.id]?.sizeBreakdowns as CADSizeBreakdown[] | undefined) ?? row.sizeBreakdowns;

    // Look for rows with "All Parts" pattern part (code === ALL_PARTS_CODE)
    const allPartsRows = rows.filter((row) => row.partCode === ALL_PARTS_CODE);

    let totalPieces = 0;
    if (allPartsRows.length > 0) {
      // Count from ALL_PARTS rows only
      allPartsRows.forEach((row) => {
        totalPieces += rowBreakdowns(row).reduce((sum, b) => sum + b.quantity, 0);
      });
    } else {
      // Fallback: first row per component if no ALL_PARTS rows exist
      const seenComponents = new Set<string>();
      rows.forEach((row) => {
        if (!seenComponents.has(row.componentId)) {
          seenComponents.add(row.componentId);
          totalPieces += rowBreakdowns(row).reduce((sum, b) => sum + b.quantity, 0);
        }
      });
    }

    return { totalPieces };
  }, [rows, pendingChanges]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading CAD data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with Add button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TableIcon className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">CAD Spreadsheet</h3>
          <Badge variant="outline" className="text-xs">
            {rows.length} rows
          </Badge>
        </div>
        <Button size="sm" onClick={handleAddRowClick} disabled={disabled || styleFabrics.length === 0 || addingRow}>
          {addingRow ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
          Add Row
        </Button>
      </div>

      {/* Field Type Legend */}
      <div className="flex items-center gap-4 mb-3 text-xs">
        <span className="font-medium text-muted-foreground">Field Types:</span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-info-muted border-l-2 border-l-blue-400"></span>
          <span className="text-info">Editable</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-slate-100 border-l-2 border-l-slate-400"></span>
          <span className="text-slate-600">Pre-populated</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-success-muted border-l-2 border-l-green-500"></span>
          <span className="text-success font-medium">Calculated</span>
        </span>
      </div>

      {/* Table - Full width with compact columns */}
      <div className="border rounded-lg overflow-x-auto">
        <Table className="text-sm">
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="px-1 py-2 whitespace-nowrap">Purpose</TableHead>
              <TableHead className="px-1 py-2 whitespace-nowrap">Ver</TableHead>
              <TableHead className="px-1 py-2 whitespace-nowrap">Component</TableHead>
              <TableHead className="px-1 py-2 whitespace-nowrap">Part</TableHead>
              <TableHead className="px-2 py-2 whitespace-nowrap">Finish</TableHead>
              <TableHead className="px-2 py-2 text-center whitespace-nowrap">Emb.</TableHead>
              <TableHead className="px-2 py-2 whitespace-nowrap">Generic Greige</TableHead>
              <TableHead className="px-2 py-2 whitespace-nowrap">Greige / Fabric</TableHead>
              <TableHead className="px-2 py-2 whitespace-nowrap">Design Name</TableHead>
              <TableHead className="px-2 py-2 whitespace-nowrap">Width</TableHead>
              <TableHead className="px-2 py-2 whitespace-nowrap">Print</TableHead>
              <TableHead className="px-2 py-2 text-center whitespace-nowrap">Sizes</TableHead>
              <TableHead className="px-2 py-2 text-right whitespace-nowrap">Pcs</TableHead>
              <TableHead className="px-2 py-2 text-right whitespace-nowrap">Layer(M)</TableHead>
              <TableHead
                className="px-2 py-2 text-right whitespace-nowrap"
                title="Added to the layer length by rule: 2 cm up to 1 m, 5 cm up to 5 m, 10 cm up to 10 m, 20 cm up to 20 m, else 30 cm"
              >
                Margin
              </TableHead>
              <TableHead className="px-2 py-2 text-right whitespace-nowrap">CAD Avg</TableHead>
              <TableHead className="px-2 py-2 whitespace-nowrap">CAD Image</TableHead>
              <TableHead className="px-2 py-2 whitespace-nowrap">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={18} className="text-center py-6 text-muted-foreground text-sm">
                  No CAD entries yet. Click "Add Row" to create one.
                </TableCell>
              </TableRow>
            ) : (
              groupedRows.map((group, groupIndex) => (
                <React.Fragment key={group.purpose || 'null'}>
                  {/* Section header for each purpose group */}
                  <TableRow
                    className={cn('bg-slate-200 hover:bg-slate-200', groupIndex > 0 && 'border-t-2 border-gray-400')}
                  >
                    <TableCell colSpan={18} className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-700">
                          {CAD_PURPOSE_LABELS[group.purpose as CADPurpose]}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          ({group.rows.length} {group.rows.length === 1 ? 'row' : 'rows'})
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>

                  {/* Render all rows in this purpose group */}
                  {group.rows.map((row) => {
                    const isEditing = editingRow === row.id;
                    const isSaving = savingRow === row.id;
                    const isDeleting = deletingRow === row.id;
                    // An APPROVED row is locked regardless of style-level status — the backend's
                    // validateCADModification refuses edits on row approval alone, and since
                    // 2026-08-24 styles.cadStatus is DERIVED from the rows (so gating the lock on
                    // isStyleApproved let rows look editable while the server would refuse).
                    // Two-owner split: an approved costing PRICE also locks the geometry.
                    const hasApprovedCosting =
                      row.costingApprovalStatus === 'APPROVED' || row.costingApprovalStatus === 'ALTERNATE_APPROVED';
                    const isRowLocked = row.approvalStatus === CADApprovalStatus.APPROVED || hasApprovedCosting;
                    const currentPartId = getDisplayValue(row, 'partId', null);
                    const currentPartCode = row.partCode; // Use partCode from row data
                    const currentWidth = getDisplayValue(row, 'cutableWidth', null);
                    const currentGreigeId = getDisplayValue(row, 'greigeId', null);
                    const { parts: availableParts } = getAvailablePatternParts(
                      row.componentId,
                      row.styleFabricId,
                      row.id,
                      currentPartId,
                      currentPartCode,
                      currentWidth, // Pass current width to allow same part at different widths
                      row.purpose // Pass purpose to allow same part across different purposes
                    );
                    // Merge pending size breakdowns so freshly-picked pcs show before the row is saved
                    const effectiveSizeBreakdowns = getDisplayValue<CADSizeBreakdown[]>(
                      row,
                      'sizeBreakdowns',
                      row.sizeBreakdowns
                    );
                    const hasPendingPcs = !!(pendingChanges[row.id] && 'sizeBreakdowns' in pendingChanges[row.id]);
                    const totalPcs = effectiveSizeBreakdowns.reduce((sum, b) => sum + b.quantity, 0);

                    return (
                      <TableRow
                        key={row.id}
                        className={cn(
                          'hover:bg-muted/30',
                          isEditing && 'bg-primary/5',
                          isRowLocked && 'opacity-75 bg-muted'
                        )}
                        title={
                          isRowLocked
                            ? hasApprovedCosting
                              ? 'Locked — this row has an approved costing. Unapprove it on the Fabric Costing Options page to edit.'
                              : 'This row is locked (approved CAD)'
                            : undefined
                        }
                      >
                        {/* Purpose - Editable */}
                        <TableCell className={cn('px-1 py-1.5', getFieldClass('editable', isEditing))}>
                          {isEditing ? (
                            // A Production CAD belongs to a received lot (Create CAD): a row can't be edited into
                            // one, and a lot's marker can't be edited out of it
                            <Select
                              value={getDisplayValue(row, 'purpose', 'COSTING') || 'COSTING'}
                              onValueChange={(v) => handleFieldChange(row.id, 'purpose', v as CADPurpose)}
                              disabled={isSaving || row.purpose === 'PRODUCTION'}
                            >
                              <SelectTrigger className="h-7 text-xs w-20">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(CAD_PURPOSE_LABELS)
                                  .filter(([value]) => row.purpose === 'PRODUCTION' || value !== 'PRODUCTION')
                                  .map(([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                      {label}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              <Badge
                                variant={
                                  row.purpose === 'PRODUCTION'
                                    ? 'default'
                                    : row.purpose === 'RAW_MATERIAL_CALCULATION'
                                      ? 'secondary'
                                      : 'outline'
                                }
                                className={cn(
                                  'text-[10px] px-1.5',
                                  row.purpose === 'PRODUCTION' && 'bg-success hover:bg-success',
                                  row.purpose === 'RAW_MATERIAL_CALCULATION' && 'bg-info hover:bg-info text-white',
                                  row.purpose === 'COSTING' && 'bg-orange-600 hover:bg-orange-700 text-white'
                                )}
                              >
                                {CAD_PURPOSE_LABELS[row.purpose as CADPurpose] || 'Prod'}
                              </Badge>
                              {/* A rejected row looked exactly like a pending one. Keyed on the status, not on
                                  rejectedAt: plan-level Reject stamps rejectedAt on rows it leaves PENDING. */}
                              {row.approvalStatus === 'REJECTED' && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge
                                        variant="outline"
                                        className="text-[9px] px-1 py-0 w-fit cursor-help bg-destructive/10 text-destructive border-destructive/25"
                                      >
                                        Rejected
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">
                                      Rejected
                                      {row.rejectedByName ? ` by ${row.rejectedByName}` : ''}
                                      {row.rejectedAt ? ` on ${formatDateTime(row.rejectedAt)}` : ''}
                                      {row.approvalNotes ? ` — ${row.approvalNotes}` : ''}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                              {pendingByCad.has(row.id) && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge
                                        variant="outline"
                                        className="text-[9px] px-1 py-0 w-fit cursor-help bg-warning/10 text-warning border-warning/25"
                                      >
                                        {pendingByCad.get(row.id)!.status === 'PARTIAL'
                                          ? 'Correction partly applied'
                                          : 'Correction pending'}
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">
                                      Corrected
                                      {pendingByCad.get(row.id)!.correctedBy?.name
                                        ? ` by ${pendingByCad.get(row.id)!.correctedBy!.name}`
                                        : ''}{' '}
                                      on {formatDateTime(pendingByCad.get(row.id)!.correctedAt)} —{' '}
                                      {pendingByCad.get(row.id)!.reason.replace(/[.\s]+$/, '')}.
                                      {pendingByCad.get(row.id)!.status === 'PARTIAL'
                                        ? ` Not updated yet: ${
                                            (pendingByCad.get(row.id)!.appliedOrders?.orders ?? [])
                                              .filter((o) => o.status !== 'UPDATED')
                                              .map((o) => o.orderNumber)
                                              .join(', ') || 'some orders'
                                          }. An admin can press Retry on the new cost sheet version (Cost Sheets).`
                                        : pendingByCad.get(row.id)!.appliedOrders?.cadApplied
                                          ? ' Already applied from one new cost sheet version; another version is still waiting for an admin.'
                                          : ' Waiting for an admin to approve the new cost sheet version.'}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                              {/* Show "Copied from" indicator if this row was copied */}
                              {row.copiedFromId && row.copiedFrom && (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] px-1 py-0 bg-accent/10 text-accent border-accent/25"
                                >
                                  ← {CAD_PURPOSE_LABELS[row.copiedFrom.purpose]}
                                </Badge>
                              )}
                            </div>
                          )}
                        </TableCell>

                        {/* Version / Lock / Orders Indicator */}
                        <TableCell className="px-1 py-1.5">
                          <div className="flex items-center gap-1">
                            {/* Locked indicator for approved rows in approved style */}
                            {isRowLocked && (
                              <span title="Locked - approved CAD cannot be modified">
                                <Lock className="h-3 w-3 text-warning" />
                              </span>
                            )}
                            {/* Version indicator */}
                            {(row as CADSpreadsheetRowExtended).version && (
                              <Badge variant="outline" className="text-[10px] px-1.5" title="Version">
                                <GitBranch className="h-2.5 w-2.5 mr-0.5" />v
                                {(row as CADSpreadsheetRowExtended).version}
                              </Badge>
                            )}
                            {/* Lock for PRODUCTION CAD (separate from style-level lock) */}
                            {!isRowLocked &&
                              row.purpose === 'PRODUCTION' &&
                              (row as CADSpreadsheetRowExtended).isLocked && (
                                <span title={(row as CADSpreadsheetRowExtended).lockedReason || 'Locked'}>
                                  <Lock className="h-3 w-3 text-muted-foreground" />
                                </span>
                              )}
                            {/* Order count for PRODUCTION CAD */}
                            {row.purpose === 'PRODUCTION' && row.orderCount !== undefined && row.orderCount > 0 && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] px-1.5 bg-info-muted text-info border-info/20"
                                title={`Used in ${row.orderCount} order${row.orderCount > 1 ? 's' : ''}`}
                              >
                                {row.orderCount} order{row.orderCount > 1 ? 's' : ''}
                              </Badge>
                            )}
                            {/* Stock Lot for PRODUCTION CAD */}
                            {row.purpose === 'PRODUCTION' && row.stockLotNumber && (
                              <Badge
                                variant="outline"
                                className="text-[9px] px-1 bg-muted border-border"
                                title={`Stock Lot: ${row.stockLotNumber}`}
                              >
                                {row.stockLotNumber}
                              </Badge>
                            )}
                            {!(
                              (row.purpose === 'COSTING' && (row as CADSpreadsheetRowExtended).version) ||
                              (row.purpose === 'PRODUCTION' &&
                                ((row as CADSpreadsheetRowExtended).isLocked ||
                                  (row.orderCount && row.orderCount > 0) ||
                                  row.stockLotNumber))
                            ) && <span className="text-xs text-muted-foreground">-</span>}
                          </div>
                        </TableCell>

                        {/* Component - Pre-populated */}
                        <TableCell
                          className={cn(
                            'px-1 py-1.5 font-medium text-xs whitespace-nowrap',
                            FIELD_STYLES.prepopulated.cell
                          )}
                        >
                          {row.isCombinedCutting ? (
                            <div
                              className="flex items-center gap-1"
                              title={`Combined: ${row.combinedComponents || row.componentName}`}
                            >
                              <span className="text-accent">📎</span>
                              <span className="text-accent">{row.combinedComponents || row.componentName}</span>
                            </div>
                          ) : (
                            row.componentName
                          )}
                        </TableCell>

                        {/* Part - Editable with searchable multi-select */}
                        <TableCell className={cn('px-1 py-1.5 max-w-[130px]', getFieldClass('editable', isEditing))}>
                          {isEditing ? (
                            <CADPartMultiSelect
                              parts={availableParts.map((p) => ({
                                id: p.id,
                                code: p.code,
                                name: p.name,
                                goesToEmbroidery: p.goesToEmbroidery,
                                isUsed: p.isUsed,
                              }))}
                              selectedIds={
                                // Use pending partIds if available, otherwise use row's partIds or fallback to single partId
                                (pendingChanges[row.id]?.partIds as string[] | undefined) ||
                                row.partIds ||
                                (row.partId ? [row.partId] : [])
                              }
                              onChange={(ids) => {
                                handleFieldChange(row.id, 'partIds', ids);
                                // Also set partId for backwards compatibility (first selected part)
                                handleFieldChange(row.id, 'partId', ids[0] || null);
                              }}
                              disabled={isSaving}
                              allPartsCode={ALL_PARTS_CODE}
                              placeholder="Select parts"
                            />
                          ) : // Display multiple parts as badges if available
                          row.parts && row.parts.length > 1 ? (
                            <div className="flex flex-wrap gap-0.5">
                              {row.parts.slice(0, 2).map((p) => (
                                <Badge key={p.id} variant="outline" className="text-[9px] px-1 py-0">
                                  {p.code}
                                </Badge>
                              ))}
                              {row.parts.length > 2 && (
                                <Badge variant="secondary" className="text-[9px] px-1 py-0">
                                  +{row.parts.length - 2}
                                </Badge>
                              )}
                            </div>
                          ) : row.parts && row.parts.length === 1 ? (
                            <span className="text-xs truncate block max-w-[100px]" title={row.parts[0].name}>
                              {row.parts[0].name}
                            </span>
                          ) : (
                            <span className="text-xs truncate block max-w-[100px]" title={row.partName || ''}>
                              {row.partName || '-'}
                            </span>
                          )}
                        </TableCell>

                        {/* Fabric Finish - Pre-populated */}
                        <TableCell className={cn('px-2 py-1.5', FIELD_STYLES.prepopulated.cell)}>
                          <Badge
                            variant={row.fabricFinishType === 'PRINTED' ? 'default' : 'secondary'}
                            className="text-[10px] px-1.5"
                          >
                            {row.fabricFinishType || '-'}
                          </Badge>
                        </TableCell>

                        {/* Embroidery - Editable */}
                        <TableCell className={cn('px-2 py-1.5 text-center', getFieldClass('editable', isEditing))}>
                          {isEditing ? (
                            <Switch
                              checked={getDisplayValue(row, 'isEmbroidery', false)}
                              onCheckedChange={(v) => handleFieldChange(row.id, 'isEmbroidery', v)}
                              disabled={isSaving}
                              className="scale-75"
                            />
                          ) : (
                            <Badge variant={row.isEmbroidery ? 'destructive' : 'outline'} className="text-[10px] px-1">
                              {row.isEmbroidery ? 'Y' : 'N'}
                            </Badge>
                          )}
                        </TableCell>

                        {/* Generic Greige - always show genericGreigeName regardless of fabric type */}
                        <TableCell
                          className={cn(
                            'px-2 py-1.5 text-xs whitespace-nowrap max-w-[100px] truncate',
                            FIELD_STYLES.prepopulated.cell
                          )}
                          title={row.genericGreigeName || ''}
                        >
                          {row.genericGreigeName || '-'}
                        </TableCell>

                        {/* Greige Name / Fabric Name - Editable or Static */}
                        <TableCell
                          className={cn(
                            'px-2 py-1.5',
                            row.readyFabricId ? FIELD_STYLES.prepopulated.cell : getFieldClass('editable', isEditing)
                          )}
                        >
                          {row.readyFabricId ? (
                            // Ready Fabric mode: show fabric name as static label
                            <span className="text-xs whitespace-nowrap text-success">
                              {row.readyFabricCode && (
                                <span className="font-mono text-muted-foreground mr-1">{row.readyFabricCode}</span>
                              )}
                              {row.readyFabricName || '-'}
                            </span>
                          ) : isEditing ? (
                            <Combobox
                              options={greigeOptionsFor(row)}
                              value={getDisplayValue(row, 'greigeId', '') || ''}
                              onValueChange={(v) => {
                                // Picking the chosen greige again keeps it — the cell changes a greige, never clears it
                                if (v) handleFieldChange(row.id, 'greigeId', v);
                              }}
                              disabled={isSaving}
                              placeholder="Select Greige"
                              searchPlaceholder="Search greige..."
                              emptyText="No greige found."
                              className="h-7 w-36 px-2 text-xs font-normal"
                            />
                          ) : (
                            <span className="text-xs whitespace-nowrap">{row.greigeName || '-'}</span>
                          )}
                        </TableCell>

                        {/* Design Name (Print Design or Color Name) - Pre-populated */}
                        <TableCell
                          className={cn(
                            'px-2 py-1.5 text-xs whitespace-nowrap max-w-[120px] truncate',
                            FIELD_STYLES.prepopulated.cell
                          )}
                          title={row.designName || ''}
                        >
                          {row.designName || '-'}
                        </TableCell>

                        {/* Cutable Width - Editable */}
                        <TableCell className={cn('px-2 py-1.5', getFieldClass('editable', isEditing))}>
                          {isEditing ? (
                            (() => {
                              // For embroidered fabrics (isEmbroidery = true), allow manual width entry
                              const isEmbroidered = row.isEmbroidery;
                              const isReadyFabric = !!row.readyFabricId;
                              const selectedGreige = availableGreiges.find((g) => g.id === currentGreigeId);
                              const maxGreigeWidth = selectedGreige?.greigeWidth || null;

                              if (isReadyFabric) {
                                // Ready-fabric mode: manual width entry (no greige width range)
                                return (
                                  <Input
                                    type="number"
                                    value={getDisplayValue(row, 'cutableWidth', 0) || ''}
                                    onChange={(e) =>
                                      handleFieldChange(
                                        row.id,
                                        'cutableWidth',
                                        e.target.value ? parseFloat(e.target.value) : null
                                      )
                                    }
                                    disabled={isSaving}
                                    className="h-7 text-xs w-20"
                                    step="0.5"
                                    min="0"
                                    placeholder='Width"'
                                  />
                                );
                              }

                              if (isEmbroidered) {
                                // Manual entry mode for embroidered fabrics
                                return (
                                  <div className="flex flex-col gap-0.5">
                                    <Input
                                      type="number"
                                      value={getDisplayValue(row, 'cutableWidth', 0) || ''}
                                      onChange={(e) =>
                                        handleFieldChange(
                                          row.id,
                                          'cutableWidth',
                                          e.target.value ? parseFloat(e.target.value) : null
                                        )
                                      }
                                      disabled={isSaving}
                                      className="h-7 text-xs w-20"
                                      step="0.1"
                                      min="0"
                                      max={maxGreigeWidth || undefined}
                                      placeholder={maxGreigeWidth ? `Max: ${maxGreigeWidth}"` : 'Width'}
                                      title={
                                        maxGreigeWidth
                                          ? `Manual entry allowed - Max width: ${maxGreigeWidth}"`
                                          : 'Enter width manually (embroidered fabric)'
                                      }
                                    />
                                    {maxGreigeWidth && (
                                      <span className="text-[9px] text-info flex items-center gap-0.5">
                                        <Pencil className="h-2 w-2" />
                                        Manual (≤ {maxGreigeWidth}")
                                      </span>
                                    )}
                                  </div>
                                );
                              }

                              // Text input for plain fabrics with default as placeholder
                              const defaultWidth = getDefaultCutableWidth(currentGreigeId);
                              return (
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="number"
                                    step="0.5"
                                    value={getDisplayValue(row, 'cutableWidth', '') || ''}
                                    onChange={(e) =>
                                      handleFieldChange(
                                        row.id,
                                        'cutableWidth',
                                        e.target.value ? parseFloat(e.target.value) : null
                                      )
                                    }
                                    placeholder={defaultWidth ? `${defaultWidth}"` : 'Width'}
                                    disabled={isSaving}
                                    className="h-7 text-xs w-20"
                                  />
                                  {row.stockWidths && row.stockWidths.length > 0 && (
                                    <Badge
                                      variant="outline"
                                      className="text-[9px] px-1 py-0 h-5 bg-success-muted border-success/20 text-success whitespace-nowrap"
                                      title={`Stock available: ${row.stockWidths.join(', ')}"`}
                                    >
                                      <Package className="h-2 w-2 mr-0.5" />
                                      {row.stockWidths.length === 1
                                        ? `${row.stockWidths[0]}"`
                                        : `${row.stockWidths.length} widths`}
                                    </Badge>
                                  )}
                                </div>
                              );
                            })()
                          ) : (
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-medium">
                                {row.cutableWidth ? `${row.cutableWidth}"` : '-'}
                              </span>
                              {/* Stock width indicator - show if the width fits a lot in stock (no wider than it) */}
                              {!!row.cutableWidth &&
                                row.stockWidths?.some((w) => w >= Number(row.cutableWidth) - 0.005) && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] px-1 py-0 h-4 bg-success-muted border-success/20 text-success"
                                    title="Width fits available stock"
                                  >
                                    <Package className="h-2 w-2 mr-0.5" />
                                    Stock
                                  </Badge>
                                )}
                              {/* Stock info badge for PRODUCTION CAD linked to stock */}
                              {row.purpose === 'PRODUCTION' &&
                                (row as CADSpreadsheetRowExtended).fabricStockDetails && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] px-1 py-0 h-4 bg-info-muted border-info/20"
                                    title={`Stock: ${(row as CADSpreadsheetRowExtended).fabricStockDetails?.rollNumbers || 'N/A'} - Grade ${(row as CADSpreadsheetRowExtended).fabricStockDetails?.qualityGrade}`}
                                  >
                                    📦 {(row as CADSpreadsheetRowExtended).fabricStockDetails?.qualityGrade}
                                  </Badge>
                                )}
                            </div>
                          )}
                          {row.purpose === 'PRODUCTION' && (
                            <LotFitNote
                              width={(() => {
                                const w = getDisplayValue<number | string | null>(row, 'cutableWidth', null);
                                return w === null || w === '' ? null : Number(w);
                              })()}
                              lotCutable={row.lotCutableWidth}
                            />
                          )}
                        </TableCell>

                        {/* Print Direction - Editable */}
                        <TableCell className={cn('px-2 py-1.5', getFieldClass('editable', isEditing))}>
                          {isEditing ? (
                            <Select
                              value={getDisplayValue(row, 'printDirection', 'TWO_WAY') || 'TWO_WAY'}
                              onValueChange={(v) => handleFieldChange(row.id, 'printDirection', v as PrintDirection)}
                              disabled={isSaving}
                            >
                              <SelectTrigger className="h-7 text-xs w-16">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(PRINT_DIRECTION_LABELS).map(([value, label]) => (
                                  <SelectItem key={value} value={value}>
                                    {label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-xs">{row.printDirection === 'ONE_WAY' ? '1-Way' : '2-Way'}</span>
                          )}
                        </TableCell>

                        {/* Size Breakup - Editable */}
                        <TableCell className={cn('px-2 py-1.5 text-center', getFieldClass('editable', isEditing))}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1.5 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSizeBreakdownOpen(row.id);
                            }}
                            // An approved / price-approved row cannot be saved, so do not open it for editing
                            disabled={isSaving || isRowLocked}
                            title={isRowLocked ? 'Approved rows cannot be edited' : undefined}
                          >
                            <Calculator className="h-3 w-3" />
                          </Button>
                        </TableCell>

                        {/* No. of Pcs - Calculated (warning color = selected but not saved yet) */}
                        <TableCell
                          className={cn(
                            'px-2 py-1.5 text-right text-xs font-medium',
                            FIELD_STYLES.calculated.cell,
                            hasPendingPcs && 'text-warning'
                          )}
                          title={hasPendingPcs ? 'Not saved yet — click Save' : undefined}
                        >
                          {totalPcs || '-'}
                        </TableCell>

                        {/* Layer(M) - Editable */}
                        <TableCell className={cn('px-2 py-1.5 text-right', getFieldClass('editable', isEditing))}>
                          {isEditing ? (
                            <Input
                              type="number"
                              step="0.01"
                              min={0}
                              value={getDisplayValue(row, 'layerLengthMeters', '') ?? ''}
                              onChange={(e) =>
                                handleFieldChange(
                                  row.id,
                                  'layerLengthMeters',
                                  e.target.value ? parseFloat(e.target.value) : null
                                )
                              }
                              className="h-7 w-20 text-xs text-right"
                              placeholder="0.00"
                              disabled={isSaving}
                            />
                          ) : (
                            <span className="text-xs">{row.layerLengthMeters?.toFixed(2) || '-'}</span>
                          )}
                          {/* What the row's CAD image says, when the typed length is not that */}
                          {(() => {
                            const imageLength = markerByRow.get(row.id)?.reading?.lengthM;
                            const typed = getDisplayValue<number | null>(
                              row,
                              'layerLengthMeters',
                              row.layerLengthMeters
                            );
                            return imageLength != null && (typed == null || !isQtyZero(Number(typed) - imageLength)) ? (
                              <div
                                className="text-[10px] text-warning whitespace-nowrap"
                                title="What the CAD image says"
                              >
                                Image: {imageLength} m
                              </div>
                            ) : null;
                          })()}
                        </TableCell>

                        {/* Margin - Calculated: added to the layer length by rule on save (never typed) */}
                        {(() => {
                          const lengthPending =
                            !!pendingChanges[row.id] && 'layerLengthMeters' in pendingChanges[row.id];
                          return (
                            <TableCell
                              className={cn('px-2 py-1.5 text-right text-xs', FIELD_STYLES.calculated.cell)}
                              title={
                                lengthPending
                                  ? 'Set from the new layer length when you save'
                                  : 'Added to the layer length by rule (2 cm up to 1 m, 5 cm up to 5 m, 10 cm up to 10 m, 20 cm up to 20 m, else 30 cm)'
                              }
                            >
                              {lengthPending ? (
                                <span className="italic text-muted-foreground">auto</span>
                              ) : row.layerMarginMeters != null && row.layerLengthMeters != null ? (
                                Number(row.layerMarginMeters.toFixed(3))
                              ) : (
                                '-'
                              )}
                            </TableCell>
                          );
                        })()}

                        {/* CAD Average - Calculated: (layer + margin) ÷ pieces, the sum on hover */}
                        <TableCell
                          className={cn('px-2 py-1.5 text-right text-xs font-medium', FIELD_STYLES.calculated.cell)}
                          title={
                            row.cadAverage != null && row.layerLengthMeters != null && totalPcs > 0
                              ? `(${Number(row.layerLengthMeters.toFixed(3))} + ${Number((row.layerMarginMeters ?? 0).toFixed(3))}) ÷ ${totalPcs} = ${Number(row.cadAverage.toFixed(4))} m/pc`
                              : undefined
                          }
                        >
                          {row.cadAverage?.toFixed(2) || '-'}
                        </TableCell>

                        {/* CAD Image — the marker the row's values come from (cad-marker.helper) */}
                        <TableCell className="px-2 py-1.5">
                          {(() => {
                            const found = markerByRow.get(row.id);
                            // An approved row is left as it is (owner, 28-Sep): no image is not an alarm there —
                            // a correction (Correct…) brings its marker image
                            const marker =
                              found && isRowLocked && (found.state === 'NEEDS_IMAGE' || found.state === 'UNUSED')
                                ? { ...found, state: 'NONE' as const, differences: [] }
                                : found;
                            const tip = marker?.differences.length
                              ? marker.differences.map((d) => d.label).join('\n') +
                                (marker.overrideReason ? `\nReason: ${marker.overrideReason}` : '')
                              : marker?.state === 'MATCHES'
                                ? 'The row matches its CAD image'
                                : marker?.state === 'UNUSED'
                                  ? 'The CAD image is attached — open it and click Use these values to fill the row'
                                  : marker?.state === 'NEEDS_IMAGE'
                                    ? 'This row is saved from its marker — attach the CAD image, or save its values by hand with a reason'
                                    : isRowLocked
                                      ? marker?.file
                                        ? 'The CAD image of this approved row'
                                        : 'Approved without a CAD image — attach one that matches it exactly'
                                      : 'Attach the CAD image (Nest EXPERT screenshot or PDF)';
                            return (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-1.5 gap-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMarkerRowId(row.id);
                                }}
                                title={tip}
                              >
                                {marker?.file ? (
                                  <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                ) : (
                                  <ImagePlus className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                                {marker && marker.state !== 'NONE' ? (
                                  <MarkerStateBadge state={marker.state} differences={marker.differences} />
                                ) : (
                                  <span className="text-[11px] text-muted-foreground">
                                    {marker?.file ? 'View' : isRowLocked ? 'No image' : 'Add'}
                                  </span>
                                )}
                              </Button>
                            );
                          })()}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="px-2 py-1.5">
                          <div className="flex items-center gap-0.5">
                            {isEditing ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-primary hover:text-primary hover:bg-primary/10"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSaveRow(row.id);
                                  }}
                                  disabled={isSaving}
                                  title="Save"
                                >
                                  {isSaving ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Save className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingRow(null);
                                    setPendingChanges((prev) => {
                                      // eslint-disable-next-line @typescript-eslint/no-unused-vars
                                      const { [row.id]: _, ...rest } = prev;
                                      return rest;
                                    });
                                  }}
                                  disabled={isSaving}
                                  title="Cancel"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            ) : (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" disabled={disabled}>
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  {/* Approve - for PENDING or REJECTED rows; a Production CAD only on a lot */}
                                  {(!(row as CADSpreadsheetRowExtended).approvalStatus ||
                                    (row as CADSpreadsheetRowExtended).approvalStatus === CADApprovalStatus.PENDING ||
                                    (row as CADSpreadsheetRowExtended).approvalStatus === CADApprovalStatus.REJECTED) &&
                                    (row.purpose !== 'PRODUCTION' ||
                                      !!(row as CADSpreadsheetRowExtended).fabricStockId) && (
                                      <DropdownMenuItem
                                        onClick={() => {
                                          // The CAD image rule refuses these on the server too — send the user to the image
                                          const state = markerByRow.get(row.id)?.state;
                                          if (state === 'NEEDS_IMAGE' || state === 'DIFFERS' || state === 'UNUSED') {
                                            notify.warning(
                                              state === 'NEEDS_IMAGE'
                                                ? "Attach this row's CAD image before approving"
                                                : state === 'UNUSED'
                                                  ? 'This row has no values yet — click Use these values in its CAD image, save the row, then approve'
                                                  : 'The values differ from the CAD image — correct them, or save them with a reason, before approving',
                                              { duration: 6000 }
                                            );
                                            setMarkerRowId(row.id);
                                            return;
                                          }
                                          void handleApproveCAD(row.id);
                                        }}
                                        disabled={approvingRow === row.id}
                                        className="text-success focus:text-success"
                                      >
                                        {approvingRow === row.id ? (
                                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        ) : (
                                          <Check className="h-4 w-4 mr-2" />
                                        )}
                                        Approve
                                      </DropdownMenuItem>
                                    )}
                                  {/* Reject - for PENDING/APPROVED rows with data */}
                                  {(!(row as CADSpreadsheetRowExtended).approvalStatus ||
                                    (row as CADSpreadsheetRowExtended).approvalStatus === CADApprovalStatus.PENDING ||
                                    (row as CADSpreadsheetRowExtended).approvalStatus === CADApprovalStatus.APPROVED) &&
                                    (row.cadAverage || row.greigeId) && (
                                      <DropdownMenuItem
                                        onClick={() => handleRejectCAD(row.id)}
                                        disabled={rejectingRow === row.id}
                                        className="text-destructive focus:text-destructive"
                                      >
                                        {rejectingRow === row.id ? (
                                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        ) : (
                                          <XCircle className="h-4 w-4 mr-2" />
                                        )}
                                        Reject
                                      </DropdownMenuItem>
                                    )}
                                  {/* Correct — an approved planning row with cost sheets / orders built on it is fixed here,
                                      and the fix is carried to them (cad-correction.service) */}
                                  {(row as CADSpreadsheetRowExtended).approvalStatus === CADApprovalStatus.APPROVED &&
                                    row.purpose !== 'PRODUCTION' &&
                                    !pendingByCad.has(row.id) && (
                                      <DropdownMenuItem onClick={() => setCorrectRow(row)}>
                                        <PencilLine className="h-4 w-4 mr-2" />
                                        Correct…
                                      </DropdownMenuItem>
                                    )}
                                  {/* Create Version - for APPROVED planning rows (a Production CAD is one lot's marker: Reject → edit → Approve) */}
                                  {(row as CADSpreadsheetRowExtended).approvalStatus === CADApprovalStatus.APPROVED &&
                                    row.purpose !== 'PRODUCTION' && (
                                      <DropdownMenuItem
                                        onClick={() => handleCreateVersion(row.id)}
                                        disabled={creatingVersion === row.id}
                                      >
                                        {creatingVersion === row.id ? (
                                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        ) : (
                                          <GitBranch className="h-4 w-4 mr-2" />
                                        )}
                                        Create Version
                                      </DropdownMenuItem>
                                    )}
                                  {/* Copy to Raw Mat - for COSTING rows. There is no Copy to Production: a Production
                                      CAD is made for a received lot with Create CAD in the stock banner. */}
                                  {row.purpose === 'COSTING' && (
                                    <DropdownMenuItem
                                      onClick={() => handleCopyCAD(row.id, 'RAW_MATERIAL_CALCULATION')}
                                      disabled={copyingRow === row.id}
                                    >
                                      {copyingRow === row.id ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      ) : (
                                        <Copy className="h-4 w-4 mr-2" />
                                      )}
                                      Copy to Raw Mat
                                    </DropdownMenuItem>
                                  )}
                                  {/* Link to Stock - for PRODUCTION + PENDING rows */}
                                  {row.purpose === 'PRODUCTION' &&
                                    (row as CADSpreadsheetRowExtended).approvalStatus === CADApprovalStatus.PENDING && (
                                      <DropdownMenuItem onClick={() => handleOpenStockSelection(row.id)}>
                                        <TableIcon className="h-4 w-4 mr-2" />
                                        Link to Stock
                                      </DropdownMenuItem>
                                    )}
                                  <DropdownMenuSeparator />
                                  {/* History — who created / edited / approved / rejected the row */}
                                  <DropdownMenuItem onClick={() => setHistoryRowId(row.id)}>
                                    <History className="h-4 w-4 mr-2" />
                                    History
                                  </DropdownMenuItem>
                                  {/* Edit */}
                                  <DropdownMenuItem
                                    onClick={() => withEditOf(row.id, () => setEditingRow(row.id))}
                                    disabled={isRowLocked}
                                  >
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  {/* Delete */}
                                  <DropdownMenuItem
                                    onClick={() => setDeleteConfirmRowId(row.id)}
                                    disabled={isDeleting || isRowLocked}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    {isDeleting ? (
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4 mr-2" />
                                    )}
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Totals */}
      {rows.length > 0 && (
        <div className="flex justify-end text-sm">
          <div>
            <span className="text-muted-foreground">Total Pieces:</span>{' '}
            <span className="font-semibold">{totals.totalPieces}</span>
          </div>
        </div>
      )}

      {/* Size Breakdown Popup */}
      {sizeBreakdownOpen && (
        <SizeBreakdownPopup
          isOpen={true}
          onClose={() => setSizeBreakdownOpen(null)}
          sizeOptions={sizeOptions}
          currentBreakdowns={
            (pendingChanges[sizeBreakdownOpen]?.sizeBreakdowns as CADSizeBreakdown[] | undefined) ??
            rows.find((r) => r.id === sizeBreakdownOpen)?.sizeBreakdowns ??
            []
          }
          onSave={(breakdowns) => handleSizeBreakdownSave(sizeBreakdownOpen, breakdowns)}
        />
      )}

      {/* Add Row Dialog - Multi-Select Component/Fabric */}
      <Dialog
        open={addRowDialogOpen}
        onOpenChange={(open) => {
          setAddRowDialogOpen(open);
          if (!open) {
            // Reset all state when closing
            resetAddRowDialogState();
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Add CAD Rows</DialogTitle>
          </DialogHeader>
          <div className="py-4 overflow-y-auto overflow-x-hidden flex-1">
            {/* Info banner for approved styles */}
            {isStyleApproved && (
              <div className="mb-4 p-3 bg-info-muted rounded-lg border border-info/20 flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-info mt-0.5 flex-shrink-0" />
                <div className="text-sm text-info">
                  <strong>Adding width variant to approved style.</strong>
                  <p className="mt-1 text-info">
                    New CAD rows will be created with PENDING status. Existing approved rows are preserved.
                  </p>
                </div>
              </div>
            )}
            {/* Purpose Selection */}
            <div className="mb-4 p-3 bg-muted rounded-lg border">
              <Label className="text-sm font-medium mb-2 block">CAD Purpose</Label>
              <Select
                value={selectedPurpose}
                onValueChange={(value: CADPurpose) => {
                  setSelectedPurpose(value);
                  // Reset stock selection when purpose changes
                  setSelectedStockForProduction(null);
                  setProductionStockOptions([]);
                  // Load stock if switching to PRODUCTION and fabrics are selected
                  if (value === 'PRODUCTION' && selectedStyleFabrics.length > 0) {
                    loadProductionStock();
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COSTING">
                    <div className="flex items-center gap-2">
                      <Calculator className="h-4 w-4 text-orange-500" />
                      <span>COSTING - Style costing for quotations</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="RAW_MATERIAL_CALCULATION">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-info" />
                      <span>RAW MAT - MRP for confirmed orders</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="PRODUCTION">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-success" />
                      <span>PRODUCTION - Actual cutting (stock required)</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              {selectedPurpose === 'PRODUCTION' && (
                <p className="text-xs text-warning mt-2 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  PRODUCTION CAD requires available fabric stock. Width will be taken from actual stock.
                </p>
              )}
            </div>

            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">Select component-fabric pairs to add CAD entries:</p>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-all"
                  checked={selectAllStyleFabrics}
                  onCheckedChange={(checked) => {
                    setSelectAllStyleFabrics(!!checked);
                    changeFabricTicks(checked ? styleFabrics.map((sf) => sf.id) : []);
                  }}
                />
                <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                  Select All ({styleFabrics.length})
                </label>
              </div>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {styleFabrics.map((sf) => (
                <div
                  key={sf.id}
                  className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors overflow-hidden"
                >
                  <Checkbox
                    id={`sf-${sf.id}`}
                    checked={selectedStyleFabrics.includes(sf.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        changeFabricTicks([...selectedStyleFabrics, sf.id]);
                      } else {
                        changeFabricTicks(selectedStyleFabrics.filter((id) => id !== sf.id));
                        setSelectAllStyleFabrics(false);
                      }
                    }}
                    className="flex-shrink-0 mt-0.5"
                  />
                  <label htmlFor={`sf-${sf.id}`} className="flex-1 cursor-pointer min-w-0">
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{sf.componentName}</span>
                        {fabricCadCounts.has(sf.id) && (
                          <Badge
                            variant="secondary"
                            className="text-xs bg-info-muted text-info border-info/20 px-1.5 py-0 flex-shrink-0"
                          >
                            Added ({fabricCadCounts.get(sf.id)})
                          </Badge>
                        )}
                        {sf.hasEmbroidery && (
                          <Badge
                            variant="outline"
                            className="bg-accent/10 text-accent border-accent/20 text-xs px-1.5 py-0 flex-shrink-0"
                          >
                            <Sparkles className="h-3 w-3 mr-1" />
                            Embroidery
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground truncate">
                        {sf.fabricFinishType || 'N/A'}
                        {(sf.printDesign || sf.colorName) && ` ${sf.printDesign || sf.colorName}`}
                        {' • '}
                        {sf.genericGreigeName || 'No fabric assigned'}
                        {sf.fabricCode && <span className="ml-1 font-mono text-info">({sf.fabricCode})</span>}
                        {sf.hasEmbroidery && sf.embroideryCode && (
                          <span className="ml-1 text-accent">• {sf.embroideryCode}</span>
                        )}
                      </span>
                    </div>
                  </label>
                </div>
              ))}
            </div>

            {selectedStyleFabrics.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="p-3 bg-info-muted border border-info/20 rounded-lg">
                  <p className="text-sm text-info">
                    {selectedStyleFabrics.length} component-fabric pair{selectedStyleFabrics.length > 1 ? 's' : ''}{' '}
                    selected
                  </p>
                </div>

                {/* Combined cutting eligibility info */}
                {selectedStyleFabrics.length >= 2 && onAddCombinedRow && (
                  <div
                    className={cn(
                      'p-3 border rounded-lg',
                      canCombineSelected.canCombine
                        ? 'bg-success-muted border-success/20'
                        : 'bg-warning-muted border-yellow-200'
                    )}
                  >
                    <p
                      className={cn(
                        'text-sm flex items-start gap-2 min-w-0',
                        canCombineSelected.canCombine ? 'text-success' : 'text-yellow-700'
                      )}
                    >
                      {canCombineSelected.canCombine ? (
                        <>
                          <Check className="h-4 w-4 flex-shrink-0 mt-0.5" />
                          <span className="break-words min-w-0 flex-1 whitespace-normal">
                            Can be combined ({canCombineSelected.reason})
                          </span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                          <span className="break-words min-w-0 flex-1 whitespace-normal">
                            {canCombineSelected.reason}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                )}

                {/* PRODUCTION Stock Selection - Required for PRODUCTION purpose */}
                {selectedPurpose === 'PRODUCTION' && (
                  <div className="p-3 border rounded-lg bg-warning-muted border-warning/20">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-medium text-warning">Select Available Stock (Required)</Label>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void loadProductionStock()}
                        disabled={loadingProductionStock}
                        className="h-7 text-xs"
                      >
                        {loadingProductionStock ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Refresh Stock'}
                      </Button>
                    </div>
                    {loadingProductionStock ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-warning" />
                        <span className="ml-2 text-sm text-warning">Loading stock...</span>
                      </div>
                    ) : productionStockOptions.length === 0 ? (
                      <div className="text-center py-4">
                        <p className="text-sm text-warning">No available stock found for the selected fabrics.</p>
                        <p className="text-xs text-warning mt-1">
                          Please ensure fabric has been GRN'd and is in AVAILABLE status.
                        </p>
                      </div>
                    ) : (
                      <Select value={selectedStockForProduction || ''} onValueChange={setSelectedStockForProduction}>
                        <SelectTrigger className="w-full bg-card">
                          <SelectValue placeholder="Select stock..." />
                        </SelectTrigger>
                        <SelectContent>
                          {productionStockOptions.map((stock) => (
                            <SelectItem key={stock.id} value={stock.id}>
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{stock.fabricCode}</span>
                                  <span className="text-muted-foreground">•</span>
                                  <span className="text-success font-semibold">{stock.cutableWidth}" width</span>
                                  <span className="text-muted-foreground">•</span>
                                  <span>{stock.quantityAvailable.toFixed(1)}m available</span>
                                  {stock.embroideryId && (
                                    <Badge variant="secondary" className="bg-accent/10 text-accent text-xs ml-1">
                                      Embroidered
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {stock.greigeName} • Grade {stock.qualityGrade}
                                  {stock.rollNumbers && ` • Rolls: ${stock.rollNumbers}`}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {selectedStockForProduction && (
                      <div className="mt-2 p-2 bg-success-muted border border-success/20 rounded text-xs text-success">
                        <Check className="h-3 w-3 inline mr-1" />
                        Stock selected. Width will be automatically set from stock.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 flex-shrink-0 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setAddRowDialogOpen(false);
                resetAddRowDialogState();
              }}
            >
              Cancel
            </Button>
            {/* Combine as 1 Row button - only show when 2+ selected and can combine */}
            {selectedStyleFabrics.length >= 2 && onAddCombinedRow && canCombineSelected.canCombine && (
              <Button
                variant="secondary"
                onClick={handleCombineRows}
                disabled={addingRow || (selectedPurpose === 'PRODUCTION' && !selectedStockForProduction)}
                className="bg-success-muted hover:bg-success/15 text-success border-success/25"
              >
                {addingRow ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Package className="h-4 w-4 mr-2" />
                    Combine as 1 {selectedPurpose} Row
                  </>
                )}
              </Button>
            )}
            <Button
              onClick={handleBatchAddRows}
              disabled={
                addingRow ||
                selectedStyleFabrics.length === 0 ||
                (selectedPurpose === 'PRODUCTION' && !selectedStockForProduction)
              }
            >
              {addingRow ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                `Add ${selectedStyleFabrics.length} ${selectedPurpose} Row${selectedStyleFabrics.length > 1 ? 's' : ''}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock Selection Modal (for PRODUCTION CAD) */}
      <Dialog
        open={stockSelectionOpen}
        onOpenChange={(open) => {
          setStockSelectionOpen(open);
          if (!open) {
            setSelectedRowForStock(null);
            setAvailableStock([]);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Select Fabric Stock
              {(() => {
                const currentRow = selectedRowForStock ? rows.find((r) => r.id === selectedRowForStock) : null;
                return currentRow?.isEmbroidery ? (
                  <Badge variant="secondary" className="bg-accent/10 text-accent">
                    ✨ Embroidered
                  </Badge>
                ) : (
                  <Badge variant="outline">Plain</Badge>
                );
              })()}
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Choose available fabric stock for PRODUCTION CAD. The actual width from stock will be used.
            </p>
          </DialogHeader>
          <div className="py-4">
            {loadingStock ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2">Loading available stock...</span>
              </div>
            ) : availableStock.length === 0 ? (
              <div className="text-center py-8">
                {(() => {
                  const currentRow = selectedRowForStock ? rows.find((r) => r.id === selectedRowForStock) : null;
                  const isEmbroideryRow = currentRow?.isEmbroidery;
                  return (
                    <>
                      <p className="text-muted-foreground">
                        No available {isEmbroideryRow ? 'embroidered' : 'plain'} fabric stock found for this style.
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        {isEmbroideryRow
                          ? 'Please ensure embroidered fabric has been received from the embroidery vendor.'
                          : 'Please ensure fabric has been received and entered into stock.'}
                      </p>
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fabric</TableHead>
                      <TableHead>Greige</TableHead>
                      <TableHead>Finished Width</TableHead>
                      <TableHead>Cutable Width</TableHead>
                      <TableHead>Available Qty</TableHead>
                      <TableHead>Quality</TableHead>
                      <TableHead>Roll Numbers</TableHead>
                      <TableHead>Received Date</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {availableStock.map((stock) => (
                      <TableRow key={stock.id}>
                        <TableCell>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{stock.fabricCode}</p>
                              {stock.embroideryId && (
                                <Badge variant="secondary" className="bg-accent/10 text-accent text-xs">
                                  ✨ Embroidered
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{stock.fabricName}</p>
                            {stock.colorName && <p className="text-xs text-muted-foreground">{stock.colorName}</p>}
                            {stock.embroideryName && <p className="text-xs text-accent">{stock.embroideryName}</p>}
                          </div>
                        </TableCell>
                        <TableCell>{stock.greigeName}</TableCell>
                        <TableCell>{stock.finishedWidth}"</TableCell>
                        <TableCell>
                          <span className="font-semibold text-primary">{stock.cutableWidth}"</span>
                        </TableCell>
                        <TableCell>{stock.quantityAvailable.toFixed(2)}m</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              stock.qualityGrade === 'A'
                                ? 'default'
                                : stock.qualityGrade === 'B'
                                  ? 'secondary'
                                  : 'destructive'
                            }
                          >
                            {stock.qualityGrade}
                          </Badge>
                        </TableCell>
                        <TableCell>{stock.rollNumbers || '-'}</TableCell>
                        <TableCell>{formatDate(new Date(stock.receivedDate))}</TableCell>
                        <TableCell>
                          <Button size="sm" onClick={() => handleSelectStock(stock.id)}>
                            Select
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Variance Warning Dialog */}
      <Dialog open={varianceWarningOpen} onOpenChange={setVarianceWarningOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <XCircle className="h-5 w-5" />
              Width Variance Detected
            </DialogTitle>
          </DialogHeader>
          {pendingStockSelection && (
            <div className="py-4 space-y-4">
              <div className="bg-primary/10 border border-orange-200 rounded-lg p-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-foreground">Raw Mat CAD Width:</span>
                    <span className="text-lg font-semibold text-foreground">
                      {pendingStockSelection.planningWidth}"
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-foreground">Actual Stock Width:</span>
                    <span className="text-lg font-semibold text-primary">
                      {pendingStockSelection.stock.cutableWidth}"
                    </span>
                  </div>
                  <div className="border-t border-orange-200 pt-2 mt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-foreground">Variance:</span>
                      <span
                        className={`text-lg font-bold ${
                          (pendingStockSelection.variance || 0) < 0 ? 'text-destructive' : 'text-success'
                        }`}
                      >
                        {(pendingStockSelection.variance || 0) > 0 ? '+' : ''}
                        {pendingStockSelection.variance?.toFixed(2)}" (
                        {(pendingStockSelection.variancePercent || 0) > 0 ? '+' : ''}
                        {pendingStockSelection.variancePercent?.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-foreground">
                  <strong>Impact:</strong> This width difference will affect fabric consumption calculations.
                </p>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li>
                    {(pendingStockSelection.variance || 0) < 0 ? (
                      <span className="text-destructive font-medium">
                        Narrower width may require more fabric for the same order quantity
                      </span>
                    ) : (
                      <span className="text-success font-medium">Wider width may reduce fabric requirements</span>
                    )}
                  </li>
                  <li>CAD average will be recalculated based on actual width</li>
                  <li>Variance will be tracked for procurement planning</li>
                </ul>
              </div>

              <div className="bg-info-muted border border-info/20 rounded-lg p-3">
                <p className="text-sm text-info">
                  <strong>Stock Details:</strong> {pendingStockSelection.stock.fabricCode} - Roll{' '}
                  {pendingStockSelection.stock.rollNumbers || 'N/A'}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setVarianceWarningOpen(false);
                setPendingStockSelection(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={() => {
                if (pendingStockSelection) {
                  confirmStockSelection(pendingStockSelection.stockId, pendingStockSelection.stock);
                }
              }}
            >
              Use Actual Width
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Copy CAD Confirmation Dialog */}
      <CopyCADConfirmationDialog
        isOpen={copyDialogOpen}
        onClose={() => {
          setCopyDialogOpen(false);
          setCopySourceRow(null);
          setCopyTargetPurpose(null);
        }}
        onConfirm={handleCopyConfirm}
        sourceRow={copySourceRow}
        targetPurpose={copyTargetPurpose || 'COSTING'}
        isLoading={copyingRow !== null}
      />

      <CadHistoryDialog styleId={styleId} rowId={historyRowId} onClose={() => setHistoryRowId(null)} />

      <CorrectCadDialog
        styleId={styleId}
        row={correctRow}
        rowMarker={correctRow ? markerByRow.get(correctRow.id) : undefined}
        sizeOptions={sizeOptions}
        availableGreiges={availableGreiges}
        onClose={() => setCorrectRow(null)}
        onDone={() => onDataRefresh?.()}
      />

      {/* CAD image of a row — upload / pick, read, compare, use its values */}
      {(() => {
        const markerRow = markerRowId ? (rows.find((r) => r.id === markerRowId) ?? null) : null;
        const locked =
          !!markerRow &&
          (markerRow.approvalStatus === CADApprovalStatus.APPROVED ||
            markerRow.costingApprovalStatus === 'APPROVED' ||
            markerRow.costingApprovalStatus === 'ALTERNATE_APPROVED');
        return (
          <MarkerImageDialog
            styleId={styleId}
            row={markerRow}
            marker={markerRow ? markerByRow.get(markerRow.id) : undefined}
            sizeOptions={sizeOptions}
            approved={locked}
            readOnly={disabled}
            onClose={() => setMarkerRowId(null)}
            onChanged={() => void refetchMarkers()}
            onUseValues={(values) => markerRow && handleUseMarkerValues(markerRow.id, values)}
            onEnterByHand={() => {
              if (!markerRow) return;
              const rowId = markerRow.id;
              withEditOf(rowId, () => {
                setEditingRow(rowId);
                notify.info(
                  'Type the layer length, width and sizes in the row and click Save — you will be asked why',
                  { duration: 7000 }
                );
              });
            }}
          />
        );
      })()}

      <ConfirmDialog
        open={!!deleteConfirmRowId}
        onOpenChange={(open) => !open && setDeleteConfirmRowId(null)}
        title="Delete this CAD row?"
        description={(() => {
          const row = rows.find((r) => r.id === deleteConfirmRowId);
          const purpose =
            row?.purpose === 'RAW_MATERIAL_CALCULATION'
              ? 'Raw Mat'
              : row?.purpose === 'PRODUCTION'
                ? 'Production'
                : 'Costing';
          const label = row
            ? `${purpose} · ${row.componentName ?? ''}${row.partName ? ` · ${row.partName}` : ''}${row.cutableWidth ? ` · ${row.cutableWidth}"` : ''}`
            : 'This row';
          return `${label} — its values, size breakdown and costing are deleted. This cannot be undone.`;
        })()}
        confirmText="Delete row"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={() => deleteConfirmRowId && void handleDeleteRow(deleteConfirmRowId)}
      />

      {/* Unsaved changes on the row being edited, and another row was asked for */}
      <Dialog open={!!switchRowPrompt} onOpenChange={(open) => !open && setSwitchRowPrompt(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Unsaved changes on another row</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {(() => {
              const from = rows.find((r) => r.id === switchRowPrompt?.from);
              const label = from
                ? `${from.componentName ?? 'The row'}${from.partName ? ` · ${from.partName}` : ''}${from.cutableWidth ? ` · ${from.cutableWidth}"` : ''}`
                : 'The row being edited';
              return `${label} has changes that are not saved. Save them or discard them before editing another row.`;
            })()}
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setSwitchRowPrompt(null)}>
              Keep editing
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const prompt = switchRowPrompt;
                if (!prompt) return;
                discardPendingChanges(prompt.from);
                setEditingRow(null);
                setSwitchRowPrompt(null);
                prompt.then();
              }}
            >
              Discard changes
            </Button>
            <Button
              disabled={savingRow === switchRowPrompt?.from}
              onClick={async () => {
                const prompt = switchRowPrompt;
                if (!prompt) return;
                setSwitchRowPrompt(null);
                // a save refused (reason asked, duplicate…) keeps that row open; nothing else moves
                if (await handleSaveRow(prompt.from)) prompt.then();
              }}
            >
              {savingRow === switchRowPrompt?.from && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Values that differ from the row's CAD image are saved only with a reason */}
      <Dialog
        open={!!markerReasonPrompt}
        onOpenChange={(open) => {
          if (!open) setMarkerReasonPrompt(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          {(() => {
            // A difference with neither an image nor a row value is one the image could not check (unreadable,
            // or its sizes / width not shown) — nothing to correct, only to explain
            const noImage = !!markerReasonPrompt?.noImage;
            const all = noImage ? [] : (markerReasonPrompt?.differences ?? []);
            const unchecked = all.filter((d) => d.image === null && d.row === null);
            const differing = all.filter((d) => !(d.image === null && d.row === null));
            return (
              <>
                <DialogHeader>
                  <DialogTitle>
                    {noImage
                      ? 'This row has no CAD image'
                      : differing.length === 0
                        ? 'The CAD image could not check these values'
                        : 'These values differ from the CAD image'}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  {differing.length > 0 && (
                    <ul className="list-disc pl-5 text-sm space-y-1">
                      {differing.map((d) => (
                        <li key={`${d.field}-${d.label}`}>{d.label}</li>
                      ))}
                    </ul>
                  )}
                  {unchecked.length > 0 && (
                    <div className="space-y-1">
                      {differing.length > 0 && <p className="text-sm font-medium">Not checked:</p>}
                      <ul className="list-disc pl-5 text-sm space-y-1">
                        {unchecked.map((d) => (
                          <li key={`${d.field}-${d.label}`}>{d.label}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {noImage
                      ? 'Attach the Nest EXPERT screenshot (Open CAD image) and its values fill in. If there is no marker image to give, say where these values come from and save them as typed.'
                      : differing.length === 0
                        ? 'The image does not show these clearly enough to check them. Say where the values come from, and save.'
                        : 'Correct them to match the marker (CAD image → Use these values), or say why they are right and save.'}
                  </p>
                  <div className="space-y-1.5">
                    <Label htmlFor="marker-reason">Reason</Label>
                    <Textarea
                      id="marker-reason"
                      value={markerReason}
                      onChange={(e) => setMarkerReason(e.target.value)}
                      placeholder={
                        noImage
                          ? 'e.g. hand-laid marker on the cutting table, measured 3.85 m for S–XXL; no Nest EXPERT marker'
                          : differing.length === 0
                            ? "e.g. sizes counted from the piece list in Nest EXPERT; the screenshot's title bar was cut off"
                            : 'e.g. the marker was re-made at 3.85 m after the fit sample; new screenshot to follow'
                      }
                      rows={3}
                    />
                  </div>
                </div>
              </>
            );
          })()}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                const rowId = markerReasonPrompt?.rowId ?? null;
                setMarkerReasonPrompt(null);
                setMarkerRowId(rowId);
              }}
            >
              Open CAD image
            </Button>
            <Button
              onClick={handleSaveWithMarkerReason}
              disabled={markerReason.trim().length < 3 || savingRow === markerReasonPrompt?.rowId}
            >
              {savingRow === markerReasonPrompt?.rowId && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save with this reason
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection Reason Dialog (BUG-CAD6: replaces native prompt()) */}
      <Dialog
        open={rejectDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeRejectDialog();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject CAD</DialogTitle>
          </DialogHeader>
          {rejectInUse && (
            <CadInUseNotice
              inUse={rejectInUse}
              onCorrect={() => {
                const target = rows.find((r) => r.id === rejectDialogRowId) ?? null;
                closeRejectDialog();
                setCorrectRow(target);
              }}
            />
          )}
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Rejection Reason</Label>
              <Input
                id="rejection-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter reason for rejection..."
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeRejectDialog} disabled={rejectingRow !== null}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={!rejectionReason.trim() || rejectingRow !== null || rejectInUse !== null}
            >
              {rejectingRow ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Rejecting...
                </>
              ) : (
                'Reject CAD'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version Reason Dialog (BUG-CAD6: replaces native prompt()) */}
      <Dialog
        open={versionDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setVersionDialogOpen(false);
            setVersionDialogRowId(null);
            setVersionReason('');
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Version</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="version-reason">Reason for New Version (Optional)</Label>
              <Input
                id="version-reason"
                value={versionReason}
                onChange={(e) => setVersionReason(e.target.value)}
                placeholder="Enter reason for creating new version..."
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setVersionDialogOpen(false);
                setVersionDialogRowId(null);
                setVersionReason('');
              }}
              disabled={creatingVersion !== null}
            >
              Cancel
            </Button>
            <Button onClick={handleVersionConfirm} disabled={creatingVersion !== null}>
              {creatingVersion ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <GitBranch className="h-4 w-4 mr-2" />
                  Create Version
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CADSpreadsheetTable;
