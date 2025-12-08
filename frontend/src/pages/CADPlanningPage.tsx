/**
 * CAD Planning Page
 *
 * Workflow step between Style Creation and Cost Sheet Generation
 *
 * Features:
 * 1. View style fabrics grouped by genericFabricName + fabricFinishType
 * 2. Manually adjust grouping for cutting strategy
 * 3. Select fabric width from available options (from fabric_width_cad table)
 * 4. Compare CAD consumption across different widths
 * 5. Approve CAD plan (locks it and enables cost sheet generation)
 *
 * API Endpoints Used:
 * - GET /api/styles/:id/cad-planning - Get grouped fabric data
 * - POST /api/styles/:id/cad-groups - Update grouping
 * - PUT /api/styles/:id/approve-cad - Approve and link CAD entries
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
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
import { styleService } from '../services/style.service';
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
  Sparkles
} from 'lucide-react';
import { notify } from '../lib/notify';
import { cn } from '../lib/utils';

interface FabricCADOption {
  id: string;
  availableWidth: number;
  cadMeters: number | null;
  cadYards: number | null;
  cadWastagePercent: number;
  markerEfficiency: number | null;
  isPreferred: boolean;
  supplierAvailability?: string;
  priceDifferential?: number;
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
  usableWidth?: number | null;
  allowCombinedCutting?: boolean;
}

interface EmbroideryInfo {
  id: string;
  embroideryCode: string;
  designName: string;
  costPerMeter: number | null;
}

interface FabricGroup {
  groupKey: string;
  genericFabricName: string;
  fabricFinishType: string;
  usableWidth?: number | null;
  hasEmbroidery?: boolean;
  embroidery?: EmbroideryInfo | null;
  fabrics: Fabric[];
  components: string[];
  availableWidthOptions: FabricCADOption[];
  selectedCADId?: string;
}

interface StyleInfo {
  id: string;
  styleCode: string;
  styleName: string;
  cadStatus: 'PENDING' | 'IN_PROGRESS' | 'APPROVED';
  approvedCadDate?: string;
}

export default function CADPlanningPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [style, setStyle] = useState<StyleInfo | null>(null);
  const [fabricGroups, setFabricGroups] = useState<FabricGroup[]>([]);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [orderQuantity, setOrderQuantity] = useState(1000); // For comparison calculations

  useEffect(() => {
    if (id) {
      loadCADPlanningData();
    }
  }, [id]);

  const loadCADPlanningData = async () => {
    try {
      setLoading(true);
      // Call GET /api/styles/:id/cad-planning
      const response = await styleService.getStyleCADPlanning(id!);
      setStyle(response.style);
      setFabricGroups(response.fabricGroups || []);
    } catch (error: unknown) {
      console.error('Failed to load CAD planning data:', error);
      notify.error(error.response?.data?.message || 'Failed to load CAD data');
    } finally {
      setLoading(false);
    }
  };

  const handleGroupUpdate = (groupKey: string, newGroupKey: string) => {
    // Update group key for manual regrouping
    setFabricGroups(groups =>
      groups.map(g =>
        g.groupKey === groupKey
          ? { ...g, groupKey: newGroupKey }
          : g
      )
    );
  };

  const handleCADSelection = (groupKey: string, cadId: string) => {
    setFabricGroups(groups =>
      groups.map(g =>
        g.groupKey === groupKey
          ? { ...g, selectedCADId: cadId }
          : g
      )
    );
  };

  const handleSaveGrouping = async () => {
    try {
      setSaving(true);

      // Prepare fabric group mappings
      const fabricGroupMappings = fabricGroups.flatMap(group =>
        group.fabrics.map(fabric => ({
          fabricId: fabric.id,
          cadGroupKey: group.groupKey
        }))
      );

      // Call POST /api/styles/:id/cad-groups
      await styleService.updateCADGrouping(id!, { fabricGroups: fabricGroupMappings });

      notify.success('Fabric grouping saved');

      // Reload to get updated status
      await loadCADPlanningData();
    } catch (error: unknown) {
      console.error('Failed to save grouping:', error);
      notify.error(error.response?.data?.message || 'Failed to save grouping');
    } finally {
      setSaving(false);
    }
  };

  const handleApproveCAD = async () => {
    // Validation: Ensure all fabrics have CAD selected
    const unassignedGroups = fabricGroups.filter(g => !g.selectedCADId);

    if (unassignedGroups.length > 0) {
      notify.error(`Please select CAD width for all fabric groups (${unassignedGroups.length} remaining)`);
      return;
    }

    try {
      setSaving(true);

      // Prepare fabric-CAD mappings
      const fabricCADMappings = fabricGroups.flatMap(group =>
        group.fabrics.map(fabric => ({
          fabricId: fabric.id,
          fabricCADId: group.selectedCADId!
        }))
      );

      // Call PUT /api/styles/:id/approve-cad
      await styleService.approveCADPlan(id!, { fabricCADMappings });

      notify.success('CAD plan approved! You can now generate cost sheet.', { duration: 5000 });

      setShowApproveDialog(false);

      // Navigate to cost sheet or styles list
      navigate('/styles');
    } catch (error: unknown) {
      console.error('Failed to approve CAD:', error);
      notify.error(error.response?.data?.message || 'Failed to approve CAD plan');
    } finally {
      setSaving(false);
    }
  };

  const calculateConsumption = (cad: FabricCADOption, qty: number = orderQuantity) => {
    const consumption = (cad.cadMeters || cad.cadYards || 0) * qty;
    return consumption;
  };

  const calculateSavings = (options: FabricCADOption[], selectedId: string) => {
    if (options.length === 0) return null;

    const selected = options.find(o => o.id === selectedId);
    if (!selected) return null;

    const selectedConsumption = calculateConsumption(selected);
    const minConsumption = Math.min(...options.map(o => calculateConsumption(o)));
    const maxConsumption = Math.max(...options.map(o => calculateConsumption(o)));

    const savings = selectedConsumption - minConsumption;
    const savingsPercent = ((savings / selectedConsumption) * 100).toFixed(1);

    return {
      savings,
      savingsPercent,
      isBest: selectedConsumption === minConsumption,
      isWorst: selectedConsumption === maxConsumption
    };
  };

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
        <div className="flex items-center gap-3">
          <Badge
            variant={
              isApproved ? 'default' : style.cadStatus === 'IN_PROGRESS' ? 'secondary' : 'outline'
            }
            className={cn(
              'text-sm px-3 py-1',
              isApproved && 'bg-green-600'
            )}
          >
            {isApproved && <CheckCircle2 className="h-4 w-4 mr-1" />}
            {style.cadStatus}
          </Badge>
        </div>
      </div>

      {/* Info Banner */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
        <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 text-sm">
          <p className="font-medium text-blue-900 mb-1">CAD Planning Workflow</p>
          <p className="text-blue-700">
            Fabrics are auto-grouped by <strong>Generic Fabric Name</strong> and <strong>Finish Type</strong>.
            Select the optimal width for each group, then approve to proceed with cost sheet generation.
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

      {/* Order Quantity for Comparison */}
      {!isApproved && (
        <Card className="p-4 mb-6">
          <div className="flex items-center gap-4">
            <Label>Order Quantity for Comparison:</Label>
            <Input
              type="number"
              value={orderQuantity}
              onChange={(e) => setOrderQuantity(parseInt(e.target.value) || 1000)}
              className="w-40"
            />
            <span className="text-sm text-gray-600">pieces</span>
          </div>
        </Card>
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
          fabricGroups.map((group, groupIndex) => {
            const savingsInfo = group.selectedCADId
              ? calculateSavings(group.availableWidthOptions, group.selectedCADId)
              : null;

            return (
              <Card key={group.groupKey} className={cn(
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
                      {group.usableWidth && (
                        <Badge variant="secondary" className="text-sm">
                          <Ruler className="h-3 w-3 mr-1" />
                          {group.usableWidth}"
                        </Badge>
                      )}
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
                      <div className="flex items-center gap-1">
                        <span>•</span>
                        <span>{group.fabrics.length} fabric(s)</span>
                      </div>
                      {group.hasEmbroidery && group.embroidery?.costPerMeter && (
                        <div className="flex items-center gap-1 text-purple-700">
                          <span>•</span>
                          <span>Embroidery: ₹{group.embroidery.costPerMeter}/m</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {!isApproved && (
                    <Input
                      value={group.groupKey}
                      onChange={(e) => handleGroupUpdate(group.groupKey, e.target.value)}
                      className="w-64"
                      placeholder="Group key..."
                      disabled={isApproved}
                    />
                  )}
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
                          {fabric.hasEmbroidery && (
                            <Sparkles className="h-3 w-3 text-purple-600" />
                          )}
                        </div>
                        <span className="text-gray-600 text-xs">
                          {fabric.fabricName || fabric.genericFabricName}
                          {fabric.usableWidth && ` • ${fabric.usableWidth}"`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Width Options */}
                <div>
                  <Label className="text-sm font-semibold mb-3 block">
                    Select Fabric Width & CAD:
                  </Label>

                  {group.availableWidthOptions.length === 0 ? (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded text-sm">
                      <AlertCircle className="h-4 w-4 inline mr-2 text-yellow-600" />
                      No CAD data available for this fabric type. Please add CAD entries first.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {group.availableWidthOptions.map((option) => {
                        const isSelected = group.selectedCADId === option.id;
                        const consumption = calculateConsumption(option);

                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => !isApproved && handleCADSelection(group.groupKey, option.id)}
                            disabled={isApproved}
                            className={cn(
                              'p-4 border-2 rounded-lg text-left transition-all',
                              'hover:border-blue-400 hover:bg-blue-50',
                              isSelected
                                ? 'border-blue-600 bg-blue-50 shadow-md'
                                : 'border-gray-200',
                              isApproved && 'cursor-not-allowed opacity-75',
                              option.isPreferred && !isSelected && 'border-green-300 bg-green-50'
                            )}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <div className="flex items-center gap-2">
                                    <Ruler className="h-5 w-5 text-gray-600" />
                                    <span className="text-2xl font-bold">
                                      {option.availableWidth}"
                                    </span>
                                  </div>
                                  {option.isPreferred && (
                                    <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                                      Preferred
                                    </Badge>
                                  )}
                                  {isSelected && (
                                    <Badge className="bg-blue-600 text-white text-xs">
                                      <Check className="h-3 w-3 mr-1" />
                                      Selected
                                    </Badge>
                                  )}
                                </div>

                                <div className="grid grid-cols-3 gap-4 text-sm">
                                  <div>
                                    <span className="text-gray-600">CAD Average:</span>
                                    <p className="font-semibold">
                                      {option.cadMeters
                                        ? `${option.cadMeters.toFixed(3)} m`
                                        : option.cadYards
                                        ? `${option.cadYards.toFixed(3)} yd`
                                        : 'N/A'}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Wastage:</span>
                                    <p className="font-semibold">{option.cadWastagePercent}%</p>
                                  </div>
                                  {option.markerEfficiency && (
                                    <div>
                                      <span className="text-gray-600">Efficiency:</span>
                                      <p className="font-semibold">{option.markerEfficiency}%</p>
                                    </div>
                                  )}
                                </div>

                                <div className="mt-2 text-sm">
                                  <span className="text-gray-600">Total for {orderQuantity} pcs:</span>
                                  <p className="font-semibold text-blue-600">
                                    {consumption.toFixed(2)} {option.cadMeters ? 'm' : 'yd'}
                                  </p>
                                </div>

                                {option.supplierAvailability && (
                                  <p className="text-xs text-gray-500 mt-2">
                                    Availability: {option.supplierAvailability}
                                  </p>
                                )}
                              </div>

                              {/* Comparison Indicator */}
                              {isSelected && savingsInfo && (
                                <div className="ml-4 text-center">
                                  {savingsInfo.isBest ? (
                                    <div className="text-green-600">
                                      <TrendingDown className="h-8 w-8 mx-auto mb-1" />
                                      <p className="text-xs font-semibold">Best Choice</p>
                                      <p className="text-xs">Lowest consumption</p>
                                    </div>
                                  ) : savingsInfo.isWorst ? (
                                    <div className="text-red-600">
                                      <TrendingUp className="h-8 w-8 mx-auto mb-1" />
                                      <p className="text-xs font-semibold">Higher Usage</p>
                                      <p className="text-xs">+{savingsInfo.savingsPercent}% more</p>
                                    </div>
                                  ) : (
                                    <div className="text-gray-600">
                                      <Minus className="h-8 w-8 mx-auto mb-1" />
                                      <p className="text-xs font-semibold">Moderate</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </Card>
            );
          })
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
                <span>Select CAD width for all fabric groups before approving</span>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveGrouping}
              disabled={saving || isApproved}
            >
              {saving ? 'Saving...' : 'Save Grouping'}
            </Button>
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
                  <li>All fabric groups have optimal widths selected</li>
                  <li>Grouping reflects your cutting strategy</li>
                  <li>CAD consumption values are verified</li>
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
