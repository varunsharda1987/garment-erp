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

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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
} from 'lucide-react';
import { isAxiosError } from 'axios';
import { cn } from '@/lib/utils';
import { notify } from '@/lib/notify';
import { cadPlanningService } from '@/services/cad-planning.service';
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
import { CAD_PURPOSE_LABELS, PRINT_DIRECTION_LABELS, ALL_PARTS_CODE } from '@/types/cad-planning.types';
import { CopyCADConfirmationDialog } from './CopyCADConfirmationDialog';
import { CADPartMultiSelect } from './CADPartMultiSelect';

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
}

// Size Breakdown Popup Component
function SizeBreakdownPopup({
  isOpen,
  onClose,
  sizeOptions = [],
  currentBreakdowns = [],
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  sizeOptions: CADSizeOption[];
  currentBreakdowns: CADSizeBreakdown[];
  onSave: (breakdowns: CADSizeBreakdown[]) => void;
}) {
  const [breakdowns, setBreakdowns] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    (currentBreakdowns || []).forEach((b) => {
      initial[b.sizeName] = b.quantity;
    });
    return initial;
  });

  const handleQuantityChange = (sizeName: string, value: string) => {
    const qty = parseInt(value) || 0;
    setBreakdowns((prev) => ({
      ...prev,
      [sizeName]: qty,
    }));
  };

  const handleIncrement = (sizeName: string, delta: number) => {
    setBreakdowns((prev) => {
      const current = prev[sizeName] || 0;
      const newQty = Math.max(0, current + delta);
      return {
        ...prev,
        [sizeName]: newQty,
      };
    });
  };

  const handleIncrementAll = () => {
    const safeSizeOptions = sizeOptions || [];
    setBreakdowns((prev) => {
      const newBreakdowns: Record<string, number> = { ...prev };
      safeSizeOptions.forEach((size) => {
        newBreakdowns[size.name] = (newBreakdowns[size.name] || 0) + 1;
      });
      return newBreakdowns;
    });
  };

  const handleClearAll = () => {
    const safeSizeOptions = sizeOptions || [];
    const newBreakdowns: Record<string, number> = {};
    safeSizeOptions.forEach((size) => {
      newBreakdowns[size.name] = 0;
    });
    setBreakdowns(newBreakdowns);
  };

  const handleSave = () => {
    const result: CADSizeBreakdown[] = Object.entries(breakdowns)
      .filter(([, qty]) => qty > 0)
      .map(([sizeName, quantity]) => {
        const sizeOpt = (sizeOptions || []).find((s) => s.name === sizeName);
        return {
          sizeName,
          sizeId: sizeOpt?.id || null,
          quantity,
        };
      });
    onSave(result);
    onClose();
  };

  const totalPieces = Object.values(breakdowns).reduce((sum, qty) => sum + qty, 0);

  // Ensure sizeOptions is always an array
  const safeSizeOptions = sizeOptions || [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Size Breakdown</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-4">
          {safeSizeOptions.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No size options available. Please add sizes to the style first.
            </p>
          ) : (
            <>
              {/* Apply All Section */}
              <div className="flex items-center gap-2 pb-3 border-b">
                <Label className="text-sm font-medium whitespace-nowrap">Apply to all:</Label>
                <Button type="button" size="sm" variant="secondary" onClick={handleIncrementAll} className="px-4">
                  + Add 1 to all
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleClearAll}
                  className="text-muted-foreground"
                >
                  Clear
                </Button>
              </div>

              {/* Size Rows with Increment/Decrement Buttons */}
              {safeSizeOptions.map((size) => (
                <div key={size.id} className="flex items-center gap-2">
                  <Label className="w-16 text-right font-medium">{size.name}</Label>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 p-0"
                      onClick={() => handleIncrement(size.name, -1)}
                      disabled={(breakdowns[size.name] || 0) < 1}
                    >
                      -
                    </Button>
                    <Input
                      type="number"
                      min={0}
                      value={breakdowns[size.name] || ''}
                      onChange={(e) => handleQuantityChange(size.name, e.target.value)}
                      className="w-20 h-8 text-center"
                      placeholder="0"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 p-0"
                      onClick={() => handleIncrement(size.name, 1)}
                    >
                      +
                    </Button>
                  </div>
                  <span className="text-muted-foreground text-sm">pcs</span>
                </div>
              ))}
            </>
          )}
          <div className="border-t pt-3 flex justify-between items-center">
            <span className="font-medium">Total Pieces:</span>
            <Badge variant="secondary" className="text-lg">
              {totalPieces}
            </Badge>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
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
}: CADSpreadsheetTableProps) {
  const [editingRow, setEditingRow] = useState<string | null>(null);
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
  // Rules: Same genericGreigeName, same fabricFinishType, same embroidery status
  const canCombineSelected = useMemo(() => {
    if (selectedStyleFabrics.length < 2) return { canCombine: false, reason: '' };

    const selectedFabrics = styleFabrics.filter((sf) => selectedStyleFabrics.includes(sf.id));
    if (selectedFabrics.length < 2) return { canCombine: false, reason: '' };

    const first = selectedFabrics[0];

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
      // Check embroidery status matches
      const firstHasEmb = !!first.hasEmbroidery;
      const sfHasEmb = !!sf.hasEmbroidery;
      if (firstHasEmb !== sfHasEmb) {
        return {
          canCombine: false,
          reason: 'Cannot combine plain and embroidered fabrics',
        };
      }
    }

    return {
      canCombine: true,
      reason: `Same fabric: ${first.genericGreigeName} ${first.fabricFinishType}`,
    };
  }, [selectedStyleFabrics, styleFabrics]);

  // Track which componentIds have been synced to prevent infinite loops
  const syncedComponentIds = useRef<Set<string>>(new Set());

  // Auto-sync size breakdowns for rows that are missing them
  // This handles cases where rows are added after size breakdowns were filled
  useEffect(() => {
    // Group rows by componentId
    const rowsByComponent = new Map<string, CADSpreadsheetRow[]>();
    rows.forEach((row) => {
      if (!rowsByComponent.has(row.componentId)) {
        rowsByComponent.set(row.componentId, []);
      }
      rowsByComponent.get(row.componentId)!.push(row);
    });

    // For each component group, find rows with missing breakdowns
    rowsByComponent.forEach((componentRows, componentId) => {
      // Skip if already synced for this componentId
      if (syncedComponentIds.current.has(componentId)) {
        return;
      }

      // Find first row with size breakdowns
      const rowWithBreakdowns = componentRows.find((r) => r.sizeBreakdowns && r.sizeBreakdowns.length > 0);

      // Find rows that need size breakdowns
      const rowsNeedingSync = componentRows.filter(
        (r) => r.id !== rowWithBreakdowns?.id && (!r.sizeBreakdowns || r.sizeBreakdowns.length === 0)
      );

      if (rowWithBreakdowns && rowsNeedingSync.length > 0) {
        // Mark this componentId as synced
        syncedComponentIds.current.add(componentId);

        // Sync each row that needs it
        rowsNeedingSync.forEach((targetRow) => {
          onUpdateRow(targetRow.id, {
            sizeBreakdowns: rowWithBreakdowns.sizeBreakdowns,
            piecesPerMarker: rowWithBreakdowns.piecesPerMarker || 0,
          });
        });
      }
    });
  }, [rows, onUpdateRow]);

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

  // Get available widths for a greige (0.5 inch increments)
  const getAvailableWidths = (greigeId: string | null): number[] => {
    if (!greigeId) return [];
    const greige = availableGreiges.find((g) => g.id === greigeId);
    if (!greige) return [];

    const min = greige.expectedFinishedWidthMin || 36;
    const max = greige.expectedFinishedWidthMax || greige.greigeWidth || 60;
    const widths: number[] = [];
    for (let w = min; w <= max; w += 0.5) {
      widths.push(w);
    }
    return widths;
  };

  // Get default cutable width based on greige width
  // Business rules: 63" greige → 52", 48" greige → 40"
  const getDefaultCutableWidth = (greigeId: string | null): number | null => {
    if (!greigeId) return null;
    const greige = availableGreiges.find((g) => g.id === greigeId);
    if (!greige || !greige.greigeWidth) return null;

    const greigeWidth = Number(greige.greigeWidth);
    if (greigeWidth >= 63) return 52;
    if (greigeWidth >= 48) return 40;
    return null; // Let user select for other widths
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

  // Get parts already used in other CAD rows for same style fabric at the SAME width AND SAME greige
  // Same part CAN be used at different widths or different greiges (variants are allowed)
  const getUsedPartIds = (
    styleFabricId: string,
    currentRowId: string,
    currentWidth: number | null, // Width of the row being edited
    currentGreigeId: string | null, // Greige of the row being edited
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
        // Check if same greige - different greiges are allowed
        const rowGreigeId = row.greigeId || null;
        const sameGreige = currentGreigeId !== null && rowGreigeId !== null && currentGreigeId === rowGreigeId;
        // Check if same purpose - different purposes can reuse the same part
        const samePurpose = currentPurpose !== null && row.purpose === currentPurpose;
        // Don't count "All Parts" as a used part (it's a special grouping)
        // Only mark as used if SAME width AND SAME greige AND SAME purpose
        if (row.partId && row.partCode !== ALL_PARTS_CODE && sameWidth && sameGreige && samePurpose) {
          usedParts.add(row.partId);
        }
      }
    });
    return usedParts;
  };

  // Check if "All Parts" is already used for this style fabric at the SAME width AND SAME greige
  // "All Parts" at one width/greige doesn't prevent using it at a different width/greige
  const isAllPartsUsed = (
    styleFabricId: string,
    currentRowId: string,
    currentPartCode: string | null,
    currentWidth: number | null, // Width of the row being edited
    currentGreigeId: string | null, // Greige of the row being edited
    currentPurpose: string | null // Purpose of the row being edited
  ): boolean => {
    const currWidth = currentWidth != null ? Number(currentWidth) : null;
    return (
      rows.some((row) => {
        const rowWidth = row.cutableWidth != null ? Number(row.cutableWidth) : null;
        const rowGreigeId = row.greigeId || null;
        return (
          row.styleFabricId === styleFabricId &&
          row.id !== currentRowId &&
          row.partCode === ALL_PARTS_CODE &&
          // Only consider "All Parts" as used if at SAME width AND SAME greige AND SAME purpose
          currWidth !== null &&
          rowWidth !== null &&
          currWidth === rowWidth &&
          currentGreigeId !== null &&
          rowGreigeId !== null &&
          currentGreigeId === rowGreigeId &&
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
    currentGreigeId: string | null, // Greige of the row being edited
    currentPurpose: string | null // Purpose of the row being edited
  ) => {
    const allParts = getPatternParts(componentId);
    const usedPartIds = getUsedPartIds(styleFabricId, currentRowId, currentWidth, currentGreigeId, currentPurpose);
    const allPartsAlreadyUsed = isAllPartsUsed(
      styleFabricId,
      currentRowId,
      currentPartCode,
      currentWidth,
      currentGreigeId,
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

      // Auto-populate width from stock when greige is selected (if stock exists)
      // Note: Default width (63"→52", 48"→40") is shown as placeholder, no need to auto-set
      if (field === 'greigeId' && value) {
        const row = rows.find((r) => r.id === rowId);
        // Only auto-populate if width is not already set AND stock widths exist
        if (row && !row.cutableWidth && !newChanges[rowId]?.cutableWidth) {
          if (row.stockWidths && row.stockWidths.length > 0) {
            // Use stock width (actual received fabric width)
            newChanges[rowId] = {
              ...newChanges[rowId],
              cutableWidth: row.stockWidths[0],
            };
          }
          // Default width shown as placeholder - backend applies it if width not provided on save
        }
      }

      return newChanges;
    });
  };

  // Save row changes
  const handleSaveRow = async (rowId: string) => {
    const changes = pendingChanges[rowId];
    if (!changes || Object.keys(changes).length === 0) {
      setEditingRow(null);
      return;
    }

    // Get current row data
    const currentRow = rows.find((r) => r.id === rowId);
    if (!currentRow) {
      notify.error('Row not found');
      return;
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
    if (finalWidth !== null) {
      const finalPurpose = changes.purpose !== undefined ? changes.purpose : currentRow.purpose;

      const isDuplicate = rows.some((row) => {
        if (row.id === rowId) return false; // Skip current row
        if (row.styleFabricId !== currentRow.styleFabricId) return false; // Different fabric

        const rowWidth = row.cutableWidth ? Number(row.cutableWidth) : null;
        if (rowWidth !== finalWidth) return false; // Different width - allowed

        // Different purpose - allowed (e.g., COSTING vs RAW_MATERIAL_CALCULATION)
        if (row.purpose !== finalPurpose) return false;

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
        return;
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
    } catch (error: unknown) {
      // Handle approval/locked errors with detailed message
      const message = error instanceof Error ? error.message : '';
      if (message && (message.includes('approved') || message.includes('locked'))) {
        notify.error(message, { duration: 6000 });
      } else {
        notify.error('Failed to update CAD row');
      }
    } finally {
      setSavingRow(null);
    }
  };

  // Handle delete row
  const handleDeleteRow = async (rowId: string) => {
    setDeletingRow(rowId);
    try {
      await onDeleteRow(rowId);
      notify.success('CAD row deleted');
    } catch (error: unknown) {
      // Handle approval/locked errors with detailed message
      const message = error instanceof Error ? error.message : '';
      if (message && (message.includes('approved') || message.includes('locked'))) {
        notify.error(message, { duration: 6000 });
      } else {
        notify.error('Failed to delete CAD row');
      }
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
  const loadProductionStock = async () => {
    if (selectedStyleFabrics.length === 0) return;

    setLoadingProductionStock(true);
    try {
      // Get the first selected fabric to determine embroidery status
      const firstFabric = styleFabrics.find((sf) => selectedStyleFabrics.includes(sf.id));
      const embroideryFilter = firstFabric?.hasEmbroidery ? undefined : null;

      const stock = await fabricStockService.getStockForStyle(styleId, {
        status: 'AVAILABLE',
        embroideryId: embroideryFilter,
      });
      setProductionStockOptions(stock);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      notify.error(`Failed to load stock: ${message}`);
      setProductionStockOptions([]);
    } finally {
      setLoadingProductionStock(false);
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

    setAddingRow(true);
    try {
      let successCount = 0;
      let failCount = 0;

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
          failCount++;
        }
      }

      // Show result notification
      if (failCount === 0) {
        notify.success(`Successfully created ${successCount} ${selectedPurpose} CAD row${successCount > 1 ? 's' : ''}`);
      } else if (successCount > 0) {
        notify.warning(`Created ${successCount} row(s), ${failCount} failed`);
      } else {
        notify.error('Failed to create CAD rows');
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
      const message = error instanceof Error ? error.message : 'Failed to create combined CAD row';
      notify.error(message);
    } finally {
      setAddingRow(false);
    }
  };

  // Handle size breakdown save - propagate to sibling rows (same componentId)
  const handleSizeBreakdownSave = (rowId: string, breakdowns: CADSizeBreakdown[]) => {
    const totalPieces = breakdowns.reduce((sum, b) => sum + b.quantity, 0);

    // Update the current row
    handleFieldChange(rowId, 'sizeBreakdowns', breakdowns);
    handleFieldChange(rowId, 'piecesPerMarker', totalPieces);

    // Propagate to sibling rows (same componentId)
    const currentRow = rows.find((r) => r.id === rowId);
    if (currentRow) {
      rows
        .filter((r) => r.id !== rowId && r.componentId === currentRow.componentId)
        .forEach((sibling) => {
          handleFieldChange(sibling.id, 'sizeBreakdowns', breakdowns);
          handleFieldChange(sibling.id, 'piecesPerMarker', totalPieces);
        });
    }
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
        ? undefined // Show embroidered stock (any embroideryId)
        : null; // Show only plain stock (embroideryId=null)

      const stock = await fabricStockService.getStockForStyle(styleId, {
        status: 'AVAILABLE',
        embroideryId: embroideryFilter,
      });
      setAvailableStock(stock);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      notify.error(`Failed to load stock: ${message}`);
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
        (r as CADSpreadsheetRowExtended).approvalStatus === 'APPROVED'
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
      // Update CAD row with stock information
      await onUpdateRow(selectedRowForStock, {
        cutableWidth: selectedStock.cutableWidth,
        greigeId: selectedStock.greigeId,
        // Note: Backend will handle fabricStockId linkage via linkToStock endpoint
      });

      // Link CAD to stock (backend endpoint)
      await cadPlanningService.linkCADToStock(styleId, {
        cadId: selectedRowForStock,
        fabricStockId: stockId,
      });

      notify.success(`Linked to stock: ${selectedStock.rollNumbers || selectedStock.fabricCode}`);
      setStockSelectionOpen(false);
      setSelectedRowForStock(null);
      setVarianceWarningOpen(false);
      setPendingStockSelection(null);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      notify.error(`Failed to link stock: ${message}`);
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
      // Trigger parent refresh
      window.location.reload(); // Simple approach - or use a callback prop
    } catch (error: unknown) {
      const msg = isAxiosError(error) ? error.response?.data?.message : undefined;
      notify.error(msg || 'Failed to approve CAD');
    } finally {
      setApprovingRow(null);
    }
  };

  // Handle reject CAD
  const handleRejectCAD = async (rowId: string) => {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;

    const rejectionReason = prompt('Enter rejection reason:');
    if (!rejectionReason) return;

    setRejectingRow(rowId);
    try {
      await cadPlanningService.rejectCADPurpose(styleId, rowId, {
        purpose: row.purpose || 'COSTING',
        rejectionNotes: rejectionReason,
      });
      notify.success('CAD rejected');
      window.location.reload();
    } catch (error: unknown) {
      const msg = isAxiosError(error) ? error.response?.data?.message : undefined;
      notify.error(msg || 'Failed to reject CAD');
    } finally {
      setRejectingRow(null);
    }
  };

  // Handle create version (for any approved CAD)
  const handleCreateVersion = async (rowId: string) => {
    const versionReason = prompt('Enter reason for new version (optional):');

    setCreatingVersion(rowId);
    try {
      const result = await cadPlanningService.createPlanningVersion(styleId, rowId, {
        versionReason: versionReason || undefined,
      });
      notify.success(result.message || 'New version created successfully');
      window.location.reload();
    } catch (error: unknown) {
      const msg = isAxiosError(error) ? error.response?.data?.message : undefined;
      notify.error(msg || 'Failed to create version');
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

      // Reload to show new PENDING record
      window.location.reload();
    } catch (error: unknown) {
      const msg = isAxiosError(error) ? error.response?.data?.message : undefined;
      notify.error(msg || 'Failed to copy CAD');
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
  const totals = useMemo(() => {
    // Look for rows with "All Parts" pattern part (code === ALL_PARTS_CODE)
    const allPartsRows = rows.filter((row) => row.partCode === ALL_PARTS_CODE);

    let totalPieces = 0;
    if (allPartsRows.length > 0) {
      // Count from ALL_PARTS rows only
      allPartsRows.forEach((row) => {
        totalPieces += row.sizeBreakdowns.reduce((sum, b) => sum + b.quantity, 0);
      });
    } else {
      // Fallback: first row per component if no ALL_PARTS rows exist
      const seenComponents = new Set<string>();
      rows.forEach((row) => {
        if (!seenComponents.has(row.componentId)) {
          seenComponents.add(row.componentId);
          totalPieces += row.sizeBreakdowns.reduce((sum, b) => sum + b.quantity, 0);
        }
      });
    }

    return { totalPieces };
  }, [rows]);

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
              <TableHead className="px-2 py-2 text-right whitespace-nowrap">CAD Avg</TableHead>
              <TableHead className="px-2 py-2 whitespace-nowrap">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={16} className="text-center py-6 text-muted-foreground text-sm">
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
                    <TableCell colSpan={16} className="py-3 px-4">
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
                    // Lock rows that are APPROVED when style is approved (prevents editing historical data)
                    const isRowLocked = isStyleApproved && row.approvalStatus === 'APPROVED';
                    const availableWidths =
                      row.availableWidths.length > 0
                        ? row.availableWidths
                        : getAvailableWidths(getDisplayValue(row, 'greigeId', null));
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
                      currentGreigeId, // Pass current greige to allow same part at different greiges
                      row.purpose // Pass purpose to allow same part across different purposes
                    );
                    const totalPcs = row.sizeBreakdowns.reduce((sum, b) => sum + b.quantity, 0);

                    return (
                      <TableRow
                        key={row.id}
                        className={cn(
                          'hover:bg-muted/30',
                          isEditing && 'bg-primary/5',
                          isRowLocked && 'opacity-75 bg-muted'
                        )}
                        title={isRowLocked ? 'This row is locked (approved CAD)' : undefined}
                      >
                        {/* Purpose - Editable */}
                        <TableCell className={cn('px-1 py-1.5', getFieldClass('editable', isEditing))}>
                          {isEditing ? (
                            <Select
                              value={getDisplayValue(row, 'purpose', 'PRODUCTION') || 'PRODUCTION'}
                              onValueChange={(v) => handleFieldChange(row.id, 'purpose', v as CADPurpose)}
                              disabled={isSaving}
                            >
                              <SelectTrigger className="h-7 text-xs w-20">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(CAD_PURPOSE_LABELS).map(([value, label]) => (
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
                            <Select
                              value={getDisplayValue(row, 'greigeId', '') || ''}
                              onValueChange={(v) => handleFieldChange(row.id, 'greigeId', v)}
                              disabled={isSaving}
                            >
                              <SelectTrigger className="h-7 text-xs w-36">
                                <SelectValue placeholder="Select Greige" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableGreiges
                                  .filter(
                                    (g) => !row.genericGreigeName || g.genericGreigeName === row.genericGreigeName
                                  )
                                  .map((g) => (
                                    <SelectItem key={g.id} value={g.id}>
                                      {g.greigeName}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
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
                              {/* Stock width indicator - show if width matches stock */}
                              {row.stockWidths?.includes(row.cutableWidth!) && (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] px-1 py-0 h-4 bg-success-muted border-success/20 text-success"
                                  title="Width matches available stock"
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
                            disabled={isSaving}
                          >
                            <Calculator className="h-3 w-3" />
                          </Button>
                        </TableCell>

                        {/* No. of Pcs - Calculated */}
                        <TableCell
                          className={cn('px-2 py-1.5 text-right text-xs font-medium', FIELD_STYLES.calculated.cell)}
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
                        </TableCell>

                        {/* CAD Average - Calculated */}
                        <TableCell
                          className={cn('px-2 py-1.5 text-right text-xs font-medium', FIELD_STYLES.calculated.cell)}
                        >
                          {row.cadAverage?.toFixed(2) || '-'}
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
                              <>
                                {/* CAD Purpose Action Buttons */}
                                {/* Approve button - show for PENDING or REJECTED status (allow re-approval after rejection) */}
                                {(!(row as CADSpreadsheetRowExtended).approvalStatus ||
                                  (row as CADSpreadsheetRowExtended).approvalStatus === 'PENDING' ||
                                  (row as CADSpreadsheetRowExtended).approvalStatus === 'REJECTED') && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-success hover:text-success hover:bg-success-muted"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleApproveCAD(row.id);
                                    }}
                                    disabled={disabled || approvingRow === row.id}
                                    title="Approve"
                                  >
                                    {approvingRow === row.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Check className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                )}
                                {/* Reject button - show for PENDING (including null) and APPROVED status with actual data (not blank rows) */}
                                {(!(row as CADSpreadsheetRowExtended).approvalStatus ||
                                  (row as CADSpreadsheetRowExtended).approvalStatus === 'PENDING' ||
                                  (row as CADSpreadsheetRowExtended).approvalStatus === 'APPROVED') &&
                                  (row.cadAverage || row.greigeId) && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRejectCAD(row.id);
                                      }}
                                      disabled={disabled || rejectingRow === row.id}
                                      title="Reject"
                                    >
                                      {rejectingRow === row.id ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <XCircle className="h-3.5 w-3.5" />
                                      )}
                                    </Button>
                                  )}
                                {/* Create Version button - show only for APPROVED CAD */}
                                {(row as CADSpreadsheetRowExtended).approvalStatus === 'APPROVED' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-info hover:text-info hover:bg-info-muted"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCreateVersion(row.id);
                                    }}
                                    disabled={disabled || creatingVersion === row.id}
                                    title="Create New Version"
                                  >
                                    {creatingVersion === row.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <GitBranch className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                )}
                                {/* Copy button - copy to next purpose (visible for all non-PRODUCTION rows) */}
                                {/* Workflow: COSTING → RAW_MATERIAL_CALCULATION → PRODUCTION */}
                                {row.purpose !== 'PRODUCTION' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-accent hover:text-accent hover:bg-accent/10"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const targetPurpose =
                                        row.purpose === 'COSTING'
                                          ? 'RAW_MATERIAL_CALCULATION'
                                          : row.purpose === 'RAW_MATERIAL_CALCULATION'
                                            ? 'PRODUCTION'
                                            : null;
                                      if (targetPurpose) handleCopyCAD(row.id, targetPurpose);
                                    }}
                                    disabled={disabled || copyingRow === row.id}
                                    title={
                                      row.purpose === 'COSTING'
                                        ? 'Copy to Raw Mat'
                                        : row.purpose === 'RAW_MATERIAL_CALCULATION'
                                          ? 'Copy to Production'
                                          : 'Cannot copy'
                                    }
                                  >
                                    {copyingRow === row.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                )}

                                {/* Link to Stock button - show only for PRODUCTION CAD that is PENDING */}
                                {row.purpose === 'PRODUCTION' &&
                                  (row as CADSpreadsheetRowExtended).approvalStatus === 'PENDING' && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-primary hover:text-primary hover:bg-primary/10"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenStockSelection(row.id);
                                      }}
                                      disabled={disabled}
                                      title="Link to Fabric Stock"
                                    >
                                      <TableIcon className="h-3.5 w-3.5" />
                                    </Button>
                                  )}

                                {/* Standard Edit/Delete buttons */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingRow(row.id);
                                  }}
                                  disabled={disabled || isRowLocked || (row as CADSpreadsheetRowExtended).isLocked}
                                  title={
                                    isRowLocked
                                      ? 'Locked (approved CAD)'
                                      : (row as CADSpreadsheetRowExtended).isLocked
                                        ? 'Locked'
                                        : 'Edit'
                                  }
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteRow(row.id);
                                  }}
                                  disabled={
                                    disabled || isDeleting || isRowLocked || (row as CADSpreadsheetRowExtended).isLocked
                                  }
                                  title={
                                    isRowLocked
                                      ? 'Locked (approved CAD)'
                                      : (row as CADSpreadsheetRowExtended).isLocked
                                        ? 'Locked'
                                        : 'Delete'
                                  }
                                >
                                  {isDeleting ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              </>
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
          currentBreakdowns={rows.find((r) => r.id === sizeBreakdownOpen)?.sizeBreakdowns || []}
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
                    if (checked) {
                      setSelectedStyleFabrics(styleFabrics.map((sf) => sf.id));
                    } else {
                      setSelectedStyleFabrics([]);
                    }
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
                        setSelectedStyleFabrics([...selectedStyleFabrics, sf.id]);
                      } else {
                        setSelectedStyleFabrics(selectedStyleFabrics.filter((id) => id !== sf.id));
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
                        onClick={loadProductionStock}
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
                        <TableCell>{new Date(stock.receivedDate).toLocaleDateString()}</TableCell>
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
    </div>
  );
}

export default CADSpreadsheetTable;
