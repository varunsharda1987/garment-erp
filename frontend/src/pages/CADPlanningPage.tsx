/**
 * CAD Planning Page - Redesigned Workflow
 *
 * Industry-standard workflow for CAD Planning:
 * 1. View style fabrics grouped by genericFabricName + fabricFinishType
 * 2. Select GREIGE for each fabric group
 * 3. Choose averaging mode (COMBINED or SEPARATE)
 * 4. Enter CAD values with auto-calculated layer margin
 * 5. Enter pricing (greige + processing)
 * 6. Approve CAD plan with selected width
 *
 * Width Terminology:
 * - Greige Width: Raw fabric width from supplier
 * - Finished Width: Width after processing (actualWidth)
 * - Cutable Width: Usable width for cutting (finished - selvage)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { styleService } from '../services/style.service';
import api from '../lib/api';
import {
  ArrowLeft,
  Check,
  AlertCircle,
  Layers,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  Info,
  Scissors,
  Ruler,
  Sparkles,
  Pencil,
  Plus,
  Loader2,
  Package,
  DollarSign,
  Calculator,
} from 'lucide-react';
import { notify } from '../lib/notify';
import { cn } from '../lib/utils';

// ============================================
// INTERFACES
// ============================================

interface GreigeOption {
  id: string;
  greigeCode: string;
  greigeName: string;
  greigeWidth: number;
  defaultCutableWidth: number | null;
  greigePricePerMeter: number | null;
  supplier?: {
    id: string;
    name: string;
  };
}

interface CADOption {
  id: string;
  cutableWidth: number;
  cadMeters: number | null;
  cadYards: number | null;
  layerMarginMeters: number;
  cadWastagePercent: number;
  processingPricePerMeter: number | null;
  markerEfficiency: number | null;
  piecesPerMarker: number | null;  // Number of pieces per layer
  markerLengthMeters: number | null;  // Layer length in meters
  isSelected: boolean;
  componentName?: string;
  notes?: string;
}

interface Fabric {
  id: string;
  componentName: string;
  fabricName: string;
  genericFabricName: string;
  fabricFinishType: string;
  currentCADId: string | null;
  hasEmbroidery?: boolean;
  embroideryId?: string | null;
  cutableWidth?: number | null;
  allowCombinedCutting?: boolean;
}

interface EmbroideryInfo {
  id: string;
  embroideryCode: string;
  designName: string;
  costPerMeter: number | null;
}

interface ReadyPurchaseFabricInfo {
  id: string;
  fabricCode: string;
  fabricName: string;
  actualWidth: number | null;
  cutableWidth: number | null;
  costPerMeter: number | null;
  composition?: string;
  yarnCount?: string;
}

interface FabricGroup {
  groupKey: string;
  genericFabricName: string;
  fabricFinishType: string;
  cutableWidth?: number | null;
  hasEmbroidery?: boolean;
  embroidery?: EmbroideryInfo | null;
  fabrics: Fabric[];
  components: string[];
  // Ready-purchase fabric support
  isReadyPurchaseFabric?: boolean;
  readyPurchaseFabric?: ReadyPurchaseFabricInfo | null;
  // New fields for greige selection
  availableGreiges?: GreigeOption[];
  selectedGreigeId?: string;
  selectedGreige?: GreigeOption;
  averagingMode?: 'COMBINED' | 'SEPARATE';
  // CAD options (populated after greige selection)
  cadOptions?: CADOption[];
  selectedCADId?: string;
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
  const [fabricGroups, setFabricGroups] = useState<FabricGroup[]>([]);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [selectingGreige, setSelectingGreige] = useState<string | null>(null);
  const [missingGreigeNames, setMissingGreigeNames] = useState<string[]>([]);

  // ============================================
  // DATA LOADING
  // ============================================
  const loadCADPlanningData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const response = await styleService.getStyleCADPlanning(id);
      setStyle(response.style);
      setFabricGroups(response.fabricGroups || []);
      setMissingGreigeNames(response.missingGreigeNames || []);
    } catch (error: any) {
      console.error('Failed to load CAD planning data:', error);
      notify.error(error.response?.data?.message || 'Failed to load CAD data');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadCADPlanningData();
  }, [loadCADPlanningData]);

  // ============================================
  // GREIGE SELECTION
  // ============================================
  const handleGreigeSelection = async (
    groupKey: string,
    greigeId: string,
    averagingMode: 'COMBINED' | 'SEPARATE'
  ) => {
    if (!id) return;

    try {
      setSelectingGreige(groupKey);
      const response = await styleService.selectGreigeForGroup(id, {
        groupKey,
        greigeId,
        averagingMode,
      });

      notify.success(response.message || 'Greige selected and CAD options generated');
      await loadCADPlanningData();
    } catch (error: any) {
      console.error('Failed to select greige:', error);
      notify.error(error.response?.data?.message || 'Failed to select greige');
    } finally {
      setSelectingGreige(null);
    }
  };

  // ============================================
  // CAD SELECTION
  // ============================================
  const handleCADSelection = (groupKey: string, cadId: string) => {
    setFabricGroups(groups =>
      groups.map(g =>
        g.groupKey === groupKey
          ? { ...g, selectedCADId: cadId }
          : g
      )
    );
  };

  // ============================================
  // CAD VALUES EDITING - Navigate to dedicated edit page
  // ============================================
  const handleEditCAD = (groupKey: string) => {
    // Navigate to the dedicated CAD Edit page
    navigate(`/styles/${id}/cad/${encodeURIComponent(groupKey)}/edit`);
  };

  // ============================================
  // APPROVAL
  // ============================================
  const handleApproveCAD = async () => {
    const unassignedGroups = fabricGroups.filter(g => !g.selectedCADId);

    if (unassignedGroups.length > 0) {
      notify.error(`Please select CAD width for all fabric groups (${unassignedGroups.length} remaining)`);
      return;
    }

    // Check if all have CAD values entered
    const missingCAD = fabricGroups.some(g => {
      const selectedCad = g.cadOptions?.find(c => c.id === g.selectedCADId);
      return !selectedCad?.cadMeters;
    });

    if (missingCAD) {
      notify.error('Please enter CAD average for all selected widths before approval');
      return;
    }

    try {
      setSaving(true);

      // Build fabricCADMappings: map each fabric to its selected CAD
      const fabricCADMappings: Array<{ fabricId: string; fabricCADId: string }> = [];

      fabricGroups.forEach(group => {
        if (group.selectedCADId) {
          // Map all fabrics in this group to the selected CAD
          group.fabrics.forEach(fabric => {
            fabricCADMappings.push({
              fabricId: fabric.id,
              fabricCADId: group.selectedCADId!,
            });
          });
        }
      });

      await styleService.approveCADPlan(id!, { fabricCADMappings });

      notify.success('CAD plan approved! You can now generate cost sheet.', { duration: 5000 });
      setShowApproveDialog(false);
      navigate('/styles');
    } catch (error: any) {
      console.error('Failed to approve CAD:', error);
      notify.error(error.response?.data?.message || 'Failed to approve CAD plan');
    } finally {
      setSaving(false);
    }
  };

  // ============================================
  // RENDER
  // ============================================
  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading CAD planning data...</p>
        </div>
      </div>
    );
  }

  if (!style) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <AlertCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Style not found</h2>
          <Button onClick={() => navigate('/styles')}>Back to Styles</Button>
        </div>
      </div>
    );
  }

  const isApproved = style.cadStatus === 'APPROVED';
  const canApprove = fabricGroups.every(g => g.selectedCADId) && !isApproved;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate('/styles')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">CAD Planning</h1>
            <p className="text-sm text-gray-600 mt-1">
              {style.styleCode} - {style.styleName}
            </p>
          </div>
        </div>
        <Badge
          variant={isApproved ? 'default' : style.cadStatus === 'IN_PROGRESS' ? 'secondary' : 'outline'}
          className={cn('text-sm px-3 py-1', isApproved && 'bg-green-600')}
        >
          {isApproved && <CheckCircle2 className="h-4 w-4 mr-1" />}
          {style.cadStatus}
        </Badge>
      </div>

      {/* Info Banner */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
        <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 text-sm">
          <p className="font-medium text-blue-900 mb-1">New CAD Planning Workflow</p>
          <p className="text-blue-700">
            1. <strong>Select Greige</strong> for each fabric group →
            2. <strong>Choose Averaging Mode</strong> (Combined/Separate) →
            3. <strong>Enter CAD Values</strong> for each cutable width →
            4. <strong>Enter Pricing</strong> →
            5. <strong>Approve</strong>
          </p>
        </div>
      </div>

      {/* Status Card for Approved */}
      {isApproved && (
        <div className="mb-6 p-4 bg-green-50 border border-green-300 rounded-lg flex items-start gap-3">
          <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-green-900 mb-1">CAD Plan Approved</p>
            <p className="text-sm text-green-700">
              Approved on {new Date(style.approvedCadDate!).toLocaleDateString()}.
              You can now generate the cost sheet.
            </p>
            <Button
              size="sm"
              className="mt-3"
              onClick={() => navigate(`/cost-sheets/new?styleId=${id}`)}
            >
              Generate Cost Sheet →
            </Button>
          </div>
        </div>
      )}

      {/* Missing Greige Warning */}
      {missingGreigeNames.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-900 mb-1">
                Missing Greige Records for Generic Fabric Names
              </p>
              <p className="text-sm text-amber-700 mb-2">
                The following generic fabric names don't have matching greige records in the Greige Master.
                Please add greige fabrics with these exact generic names:
              </p>
              <ul className="list-disc list-inside text-sm text-amber-800 space-y-1">
                {missingGreigeNames.map((name, i) => (
                  <li key={i} className="font-mono">"{name}"</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Fabric Groups */}
      <div className="space-y-6">
        {fabricGroups.length === 0 ? (
          <Card className="p-12 text-center">
            <AlertCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No fabrics found</h3>
            <p className="text-gray-600 mb-4">
              This style doesn't have any fabrics defined yet.
            </p>
            <Button onClick={() => navigate(`/styles/${id}/edit`)}>
              Edit Style
            </Button>
          </Card>
        ) : (
          fabricGroups.map((group, groupIndex) => (
            <FabricGroupCard
              key={group.groupKey}
              group={group}
              groupIndex={groupIndex}
              isApproved={isApproved}
              selectingGreige={selectingGreige}
              onGreigeSelect={handleGreigeSelection}
              onCADSelect={handleCADSelection}
              onEditCAD={handleEditCAD}
            />
          ))
        )}
      </div>

      {/* Actions */}
      {!isApproved && fabricGroups.length > 0 && (
        <div className="mt-6 flex justify-between items-center p-4 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600">
            {canApprove ? (
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle2 className="h-5 w-5" />
                <span>All fabric groups have CAD selected. Ready to approve!</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <span>Select greige, enter CAD values, and select width for all groups</span>
              </div>
            )}
          </div>

          <Button
            type="button"
            onClick={() => setShowApproveDialog(true)}
            disabled={!canApprove || saving}
            className="bg-green-600 hover:bg-green-700"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Approve CAD Plan
          </Button>
        </div>
      )}

      {/* Approve Confirmation Dialog */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve CAD Plan?</AlertDialogTitle>
            <AlertDialogDescription>
              Once approved, the CAD plan will be locked and you can generate the cost sheet.
              You won't be able to change fabric widths or grouping after approval.
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
                <strong>Review before approving:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>All fabric groups have greige selected</li>
                  <li>CAD values are entered for selected widths</li>
                  <li>Processing prices are entered</li>
                  <li>Optimal widths are selected</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApproveCAD}
              className="bg-green-600 hover:bg-green-700"
            >
              {saving ? 'Approving...' : 'Approve & Lock'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

// ============================================
// FABRIC GROUP CARD COMPONENT
// ============================================
interface FabricGroupCardProps {
  group: FabricGroup;
  groupIndex: number;
  isApproved: boolean;
  selectingGreige: string | null;
  onGreigeSelect: (groupKey: string, greigeId: string, averagingMode: 'COMBINED' | 'SEPARATE') => void;
  onCADSelect: (groupKey: string, cadId: string) => void;
  onEditCAD: (groupKey: string) => void;
}

function FabricGroupCard({
  group,
  groupIndex,
  isApproved,
  selectingGreige,
  onGreigeSelect,
  onCADSelect,
  onEditCAD,
}: FabricGroupCardProps) {
  const [selectedGreigeId, setSelectedGreigeId] = useState(group.selectedGreigeId || '');
  const [averagingMode, setAveragingMode] = useState<'COMBINED' | 'SEPARATE'>(
    group.averagingMode || 'COMBINED'
  );
  const [isChangingGreige, setIsChangingGreige] = useState(false);

  const handleConfirmGreige = () => {
    if (!selectedGreigeId) {
      notify.error('Please select a greige');
      return;
    }
    onGreigeSelect(group.groupKey, selectedGreigeId, averagingMode);
    setIsChangingGreige(false);
  };

  const handleChangeGreige = () => {
    setSelectedGreigeId(group.selectedGreigeId || '');
    setAveragingMode(group.averagingMode || 'COMBINED');
    setIsChangingGreige(true);
  };

  const hasGreigeSelected = !!group.selectedGreigeId && !isChangingGreige;
  // Ready-purchase fabrics have CAD options directly without greige selection
  const hasCadOptions = group.cadOptions && group.cadOptions.length > 0 &&
    (group.isReadyPurchaseFabric || hasGreigeSelected || !isChangingGreige);

  return (
    <Card className={cn(
      "p-6",
      group.hasEmbroidery && "border-purple-200 bg-purple-50/30"
    )}>
      {/* Group Header */}
      <div className="flex items-start justify-between mb-4 pb-4 border-b">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <Badge variant="outline" className="text-base px-3 py-1">
              <Layers className="h-4 w-4 mr-2" />
              Group {groupIndex + 1}
            </Badge>
            <h3 className="text-xl font-semibold">
              {group.genericFabricName} - {group.fabricFinishType}
            </h3>
            {group.hasEmbroidery && group.embroidery && (
              <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 text-sm">
                <Sparkles className="h-3 w-3 mr-1" />
                {group.embroidery.designName}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-2 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <Scissors className="h-4 w-4" />
              <span>Components: {group.components.join(', ')}</span>
            </div>
            <span>•</span>
            <span>{group.fabrics.length} fabric(s)</span>
          </div>
        </div>
      </div>

      {/* Fabrics in Group */}
      <div className="mb-4">
        <Label className="text-sm text-gray-600 mb-2 block">Fabrics in this group:</Label>
        <div className="grid grid-cols-2 gap-2">
          {group.fabrics.map((fabric) => (
            <div
              key={fabric.id}
              className={cn(
                "p-2 rounded border text-sm",
                fabric.hasEmbroidery ? "bg-purple-50 border-purple-200" : "bg-gray-50 border-gray-200"
              )}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{fabric.componentName}</span>
                {fabric.hasEmbroidery && <Sparkles className="h-3 w-3 text-purple-600" />}
              </div>
              <span className="text-gray-600 text-xs">
                {fabric.fabricName || fabric.genericFabricName}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Ready Purchase Fabric Info - No greige required */}
      {group.isReadyPurchaseFabric && group.readyPurchaseFabric && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <span className="text-sm text-blue-700 font-medium flex items-center gap-1">
                <Package className="h-4 w-4" />
                Ready Purchase Fabric:
              </span>
              <span className="text-blue-900 ml-1">
                {group.readyPurchaseFabric.fabricCode} - {group.readyPurchaseFabric.fabricName}
              </span>
              <span className="text-blue-700 ml-2">
                (Width: {group.readyPurchaseFabric.actualWidth}" | Cutable: {group.readyPurchaseFabric.cutableWidth || (group.readyPurchaseFabric.actualWidth ? group.readyPurchaseFabric.actualWidth - 2 : '-')}")
                {group.readyPurchaseFabric.costPerMeter && ` • ₹${group.readyPurchaseFabric.costPerMeter}/m`}
              </span>
            </div>
            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
              No Greige Required
            </Badge>
          </div>
          {(group.readyPurchaseFabric.composition || group.readyPurchaseFabric.yarnCount) && (
            <div className="mt-2 text-xs text-blue-600">
              {group.readyPurchaseFabric.composition && <span>{group.readyPurchaseFabric.composition}</span>}
              {group.readyPurchaseFabric.composition && group.readyPurchaseFabric.yarnCount && <span> • </span>}
              {group.readyPurchaseFabric.yarnCount && <span>Count: {group.readyPurchaseFabric.yarnCount}</span>}
            </div>
          )}
        </div>
      )}

      {/* Step 1: Greige Selection - Only for non-ready-purchase fabrics */}
      {!isApproved && !group.isReadyPurchaseFabric && (!group.selectedGreigeId || isChangingGreige) && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <Package className="h-5 w-5 text-yellow-600" />
            Step 1: Select Greige
          </h4>

          {group.availableGreiges && group.availableGreiges.length > 0 ? (
            <div className="space-y-4">
              <div>
                <Label>Greige Fabric</Label>
                <Select value={selectedGreigeId} onValueChange={setSelectedGreigeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a greige fabric..." />
                  </SelectTrigger>
                  <SelectContent>
                    {group.availableGreiges.map((greige) => (
                      <SelectItem key={greige.id} value={greige.id}>
                        {greige.greigeCode} - {greige.greigeName} ({greige.greigeWidth}")
                        {greige.greigePricePerMeter && ` - ₹${greige.greigePricePerMeter}/m`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="mb-2 block">Step 2: Averaging Mode</Label>
                <RadioGroup
                  value={averagingMode}
                  onValueChange={(v) => setAveragingMode(v as 'COMBINED' | 'SEPARATE')}
                  className="flex gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="COMBINED" id="combined" />
                    <Label htmlFor="combined" className="cursor-pointer">
                      Combined (all components together)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="SEPARATE" id="separate" />
                    <Label htmlFor="separate" className="cursor-pointer">
                      Separate (each component individually)
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleConfirmGreige}
                  disabled={!selectedGreigeId || selectingGreige === group.groupKey}
                >
                  {selectingGreige === group.groupKey ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating CAD Options...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Confirm & Generate CAD Options
                    </>
                  )}
                </Button>
                {isChangingGreige && (
                  <Button
                    variant="outline"
                    onClick={() => setIsChangingGreige(false)}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-yellow-700">
              No greige options available for this fabric type.
              Please add greige fabrics to the Greige Master.
            </p>
          )}
        </div>
      )}

      {/* Selected Greige Display - Only for non-ready-purchase fabrics */}
      {!group.isReadyPurchaseFabric && hasGreigeSelected && group.selectedGreige && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <span className="text-sm text-green-700 font-medium">Selected Greige: </span>
              <span className="text-green-900">
                {group.selectedGreige.greigeCode} - {group.selectedGreige.greigeName}
              </span>
              <span className="text-green-700 ml-2">
                (Greige: {group.selectedGreige.greigeWidth}" | Cutable: {group.selectedGreige.defaultCutableWidth || (group.selectedGreige.greigeWidth - 4)}")
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm text-green-700">Mode:</Label>
                <Select
                  value={group.averagingMode || 'COMBINED'}
                  onValueChange={(v) => {
                    if (!isApproved) {
                      // Re-select greige with new averaging mode
                      onGreigeSelect(group.groupKey, group.selectedGreigeId!, v as 'COMBINED' | 'SEPARATE');
                    }
                  }}
                  disabled={isApproved}
                >
                  <SelectTrigger className="w-32 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COMBINED">Combined</SelectItem>
                    <SelectItem value="SEPARATE">Separate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {!isApproved && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleChangeGreige}
                  className="h-8"
                >
                  Change Greige
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CAD Options Table */}
      {hasCadOptions && (
        <div>
          <Label className="text-sm font-semibold mb-3 block flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Step 3: CAD Values by Cutable Width
          </Label>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border rounded">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left border-b">Select</th>
                  <th className="p-2 text-left border-b">Cut Width</th>
                  {group.averagingMode === 'SEPARATE' && (
                    <th className="p-2 text-left border-b">Component</th>
                  )}
                  <th className="p-2 text-left border-b">Pcs/Layer</th>
                  <th className="p-2 text-left border-b">Layer Length</th>
                  <th className="p-2 text-left border-b">Layer Margin</th>
                  <th className="p-2 text-left border-b">CAD (m)</th>
                  <th className="p-2 text-left border-b">Actions</th>
                </tr>
              </thead>
              <tbody>
                {group.cadOptions!.map((cad) => {
                  const isSelected = group.selectedCADId === cad.id;

                  return (
                    <tr
                      key={cad.id}
                      className={cn(
                        'hover:bg-gray-50 cursor-pointer transition-colors',
                        isSelected && 'bg-blue-50 border-l-4 border-l-blue-600'
                      )}
                      onClick={() => !isApproved && onCADSelect(group.groupKey, cad.id)}
                    >
                      <td className="p-2 border-b">
                        <input
                          type="radio"
                          name={`cad-${group.groupKey}`}
                          checked={isSelected}
                          onChange={() => onCADSelect(group.groupKey, cad.id)}
                          disabled={isApproved}
                          className="h-4 w-4"
                        />
                      </td>
                      <td className="p-2 border-b font-semibold">
                        {cad.cutableWidth}"
                      </td>
                      {group.averagingMode === 'SEPARATE' && (
                        <td className="p-2 border-b text-gray-600">
                          {cad.componentName || '-'}
                        </td>
                      )}
                      <td className="p-2 border-b text-gray-600">
                        {cad.piecesPerMarker || '-'}
                      </td>
                      <td className="p-2 border-b text-gray-600">
                        {cad.markerLengthMeters ? `${cad.markerLengthMeters.toFixed(2)} m` : '-'}
                      </td>
                      <td className="p-2 border-b text-gray-600">
                        {cad.layerMarginMeters ? `${(cad.layerMarginMeters * 100).toFixed(0)} cm` : '-'}
                      </td>
                      <td className="p-2 border-b font-medium">
                        {cad.cadMeters ? cad.cadMeters.toFixed(3) : (
                          <span className="text-amber-600">Enter CAD</span>
                        )}
                      </td>
                      <td className="p-2 border-b">
                        {!isApproved && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditCAD(group.groupKey);
                            }}
                            className="h-7 px-2"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Summary */}
          {group.selectedCADId && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 text-blue-800">
                <CheckCircle2 className="h-4 w-4" />
                <span className="font-medium">
                  Selected: {group.cadOptions?.find(c => c.id === group.selectedCADId)?.cutableWidth}"
                </span>
                {(() => {
                  const selected = group.cadOptions?.find(c => c.id === group.selectedCADId);
                  if (selected?.cadMeters) {
                    return (
                      <span className="text-sm">
                        • CAD: {selected.cadMeters.toFixed(3)} m/piece
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
