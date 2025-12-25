/**
 * CAD Edit Page - Full Page CAD Editing with Size Breakdown
 *
 * Features:
 * - Full page instead of modal for CAD editing
 * - Size breakdown capture (S:2, M:4, L:3, XL:1 = 10 pcs)
 * - Auto-calculate piecesPerMarker from size breakdown sum
 * - Multiple width options on same page for comparison
 * - Add custom widths on-the-fly
 * - Pre-populate sizes from style variants + allow custom sizes
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
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
import api from '../lib/api';
import {
  ArrowLeft,
  Check,
  Plus,
  Trash2,
  Star,
  Loader2,
  Calculator,
  Ruler,
  Scissors,
  Save,
  X,
} from 'lucide-react';
import { notify } from '../lib/notify';
import { cn } from '../lib/utils';

// ============================================
// INTERFACES
// ============================================

interface SizeBreakdown {
  id?: string;
  sizeName: string;
  sizeId?: string | null;
  quantity: number;
}

interface CADOption {
  id: string;
  fabricId: string;
  cutableWidth: number;
  widthUnit: string;
  cadMeters: number | null;
  cadYards: number | null;
  cadWastagePercent: number;
  layerMarginMeters: number | null;
  piecesPerMarker: number | null;
  markerLengthMeters: number | null;
  markerEfficiency: number | null;
  componentName: string | null;
  isPreferred: boolean;
  notes: string | null;
  sizeBreakdowns: SizeBreakdown[];
}

interface SizeOption {
  sizeId: string | null;
  sizeName: string;
  sortOrder: number;
}

interface GreigeDetails {
  id: string;
  greigeCode: string;
  greigeName: string;
  greigeWidth: number;
  defaultCutableWidth: number | null;
  costPerMeter: number | null;
  composition: string;
}

interface FabricDetails {
  id: string;
  fabricCode: string;
  fabricName: string;
  actualWidth: number | null;
}

interface GroupDetails {
  groupKey: string;
  genericFabricName: string;
  fabricFinishType: string;
  hasEmbroidery: boolean;
  embroidery: {
    id: string;
    embroideryCode: string;
    designName: string;
  } | null;
  averagingMode: string;
}

interface StyleDetails {
  id: string;
  styleCode: string;
  styleName: string;
  cadStatus: string;
  imageUrl: string | null;
}

interface CADGroupData {
  style: StyleDetails;
  group: GroupDetails;
  greige: GreigeDetails | null;
  fabric: FabricDetails | null;
  cadOptions: CADOption[];
  sizes: SizeOption[]; // Note: backend sends as 'sizeOptions' but serializer converts to 'sizes'
  suggestedWidth: number;
}

// ============================================
// LAYER MARGIN CALCULATION (mirrors backend)
// ============================================
function getDefaultLayerMargin(cadMeters: number): number {
  if (cadMeters <= 0) return 0.02;
  if (cadMeters <= 1) return 0.02;
  if (cadMeters <= 5) return 0.05;
  if (cadMeters <= 10) return 0.10;
  if (cadMeters <= 20) return 0.20;
  return 0.30;
}

// ============================================
// CAD CARD COMPONENT
// ============================================
interface CADCardProps {
  cad: CADOption;
  sizeOptions: SizeOption[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (cadId: string, data: Partial<CADOption> & { sizeBreakdowns?: SizeBreakdown[] }) => Promise<void>;
  onDelete: (cadId: string) => Promise<void>;
  onSetPreferred: (cadId: string) => Promise<void>;
  saving: boolean;
}

function CADCard({
  cad,
  sizeOptions,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onDelete,
  onSetPreferred,
  saving,
}: CADCardProps) {
  const [localData, setLocalData] = useState({
    cadMeters: cad.cadMeters,
    layerMarginMeters: cad.layerMarginMeters || 0.05,
    markerLengthMeters: cad.markerLengthMeters,
    markerEfficiency: cad.markerEfficiency,
    cadWastagePercent: cad.cadWastagePercent,
    notes: cad.notes || '',
    sizeBreakdowns: cad.sizeBreakdowns && cad.sizeBreakdowns.length > 0
      ? cad.sizeBreakdowns
      : (sizeOptions || []).map(s => ({ sizeName: s.sizeName, sizeId: s.sizeId, quantity: 0 })),
  });
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [customSizeName, setCustomSizeName] = useState('');

  // Update sizeBreakdowns when sizeOptions or cad changes
  useEffect(() => {
    if (cad.sizeBreakdowns && cad.sizeBreakdowns.length > 0) {
      setLocalData(prev => ({
        ...prev,
        sizeBreakdowns: cad.sizeBreakdowns,
      }));
    } else if (sizeOptions && sizeOptions.length > 0 && localData.sizeBreakdowns.length === 0) {
      setLocalData(prev => ({
        ...prev,
        sizeBreakdowns: sizeOptions.map(s => ({ sizeName: s.sizeName, sizeId: s.sizeId, quantity: 0 })),
      }));
    }
  }, [cad.sizeBreakdowns, sizeOptions]);

  // Calculate total pieces
  const totalPieces = localData.sizeBreakdowns.reduce((sum, sb) => sum + (sb.quantity || 0), 0);

  // Calculate CAD average if layer length and total pieces available
  const calculatedCAD = localData.markerLengthMeters && totalPieces > 0
    ? ((localData.markerLengthMeters + (localData.layerMarginMeters || 0)) / totalPieces).toFixed(4)
    : null;

  const handleSizeQuantityChange = (sizeName: string, quantity: number) => {
    setLocalData(prev => ({
      ...prev,
      sizeBreakdowns: prev.sizeBreakdowns.map(sb =>
        sb.sizeName === sizeName ? { ...sb, quantity } : sb
      ),
    }));
  };

  const handleAddCustomSize = () => {
    if (!customSizeName.trim()) return;
    if (localData.sizeBreakdowns.some(sb => sb.sizeName.toLowerCase() === customSizeName.toLowerCase())) {
      notify.error('Size already exists');
      return;
    }
    setLocalData(prev => ({
      ...prev,
      sizeBreakdowns: [...prev.sizeBreakdowns, { sizeName: customSizeName.trim(), sizeId: null, quantity: 0 }],
    }));
    setCustomSizeName('');
  };

  const handleRemoveSize = (sizeName: string) => {
    setLocalData(prev => ({
      ...prev,
      sizeBreakdowns: prev.sizeBreakdowns.filter(sb => sb.sizeName !== sizeName),
    }));
  };

  const handleSave = async () => {
    await onUpdate(cad.id, {
      cadMeters: localData.cadMeters,
      layerMarginMeters: localData.layerMarginMeters,
      markerLengthMeters: localData.markerLengthMeters,
      markerEfficiency: localData.markerEfficiency,
      cadWastagePercent: localData.cadWastagePercent,
      notes: localData.notes,
      sizeBreakdowns: localData.sizeBreakdowns.filter(sb => sb.quantity > 0),
    });
  };

  const handleLayerLengthChange = (value: number | null) => {
    setLocalData(prev => {
      const newData = { ...prev, markerLengthMeters: value };
      // Auto-calculate CAD meters and update layer margin
      if (value && totalPieces > 0) {
        const margin = getDefaultLayerMargin((value + (prev.layerMarginMeters || 0)) / totalPieces);
        newData.layerMarginMeters = margin;
        newData.cadMeters = parseFloat(((value + margin) / totalPieces).toFixed(4));
      }
      return newData;
    });
  };

  return (
    <Card className={cn(
      'transition-all',
      cad.isPreferred && 'ring-2 ring-primary',
      isExpanded && 'col-span-full'
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">
              {cad.cutableWidth}" Width
            </CardTitle>
            {cad.isPreferred && (
              <Badge variant="default" className="bg-primary">
                <Star className="h-3 w-3 mr-1" />
                Preferred
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!cad.isPreferred && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSetPreferred(cad.id)}
                disabled={saving}
                title="Set as preferred"
              >
                <Star className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleExpand}
              className="font-medium"
            >
              {isExpanded ? 'Collapse' : 'Edit'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              disabled={saving}
              className="text-destructive hover:text-destructive"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {!isExpanded ? (
          // Collapsed view - summary
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">CAD Avg:</span>{' '}
              <span className="font-medium">
                {cad.cadMeters ? `${cad.cadMeters}m` : '-'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Pieces:</span>{' '}
              <span className="font-medium">
                {cad.piecesPerMarker || '-'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Layer:</span>{' '}
              <span className="font-medium">
                {cad.markerLengthMeters ? `${cad.markerLengthMeters}m` : '-'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Efficiency:</span>{' '}
              <span className="font-medium">
                {cad.markerEfficiency ? `${cad.markerEfficiency}%` : '-'}
              </span>
            </div>
            {cad.sizeBreakdowns && cad.sizeBreakdowns.length > 0 && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Sizes:</span>{' '}
                <span className="font-medium">
                  {cad.sizeBreakdowns.map(sb => `${sb.sizeName}:${sb.quantity}`).join(', ')}
                </span>
              </div>
            )}
          </div>
        ) : (
          // Expanded view - full edit form
          <div className="space-y-4">
            {/* Size Breakdown Section */}
            <div className="space-y-2">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Scissors className="h-4 w-4" />
                Size Breakdown
              </Label>
              <p className="text-sm text-muted-foreground">
                Enter the number of pieces per size used in CAD calculation
              </p>

              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {localData.sizeBreakdowns.map((sb) => (
                  <div key={sb.sizeName} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">{sb.sizeName}</Label>
                      {!sizeOptions.some(s => s.sizeName === sb.sizeName) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0"
                          onClick={() => handleRemoveSize(sb.sizeName)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <Input
                      type="number"
                      min={0}
                      value={sb.quantity ?? ''}
                      onChange={(e) => handleSizeQuantityChange(sb.sizeName, parseInt(e.target.value) || 0)}
                      className="h-8 text-center"
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Input
                  placeholder="Custom size"
                  value={customSizeName}
                  onChange={(e) => setCustomSizeName(e.target.value)}
                  className="w-32 h-8"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCustomSize()}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddCustomSize}
                  disabled={!customSizeName.trim()}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </div>

              <div className="flex items-center justify-between bg-muted/50 p-2 rounded-md">
                <span className="font-medium">Total Pieces:</span>
                <Badge variant="secondary" className="text-lg px-3">
                  {totalPieces}
                </Badge>
              </div>
            </div>

            {/* CAD Values Section */}
            <div className="space-y-2">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                CAD Values
              </Label>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Layer Length (m)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={localData.markerLengthMeters || ''}
                    onChange={(e) => handleLayerLengthChange(e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="e.g., 15.5"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Layer Margin (m)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={localData.layerMarginMeters || ''}
                    onChange={(e) => setLocalData(prev => ({
                      ...prev,
                      layerMarginMeters: e.target.value ? parseFloat(e.target.value) : 0.05,
                    }))}
                    placeholder="Auto"
                  />
                  <p className="text-xs text-muted-foreground">Auto-calculated</p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">CAD Average (m)</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.0001"
                      value={localData.cadMeters || ''}
                      onChange={(e) => setLocalData(prev => ({
                        ...prev,
                        cadMeters: e.target.value ? parseFloat(e.target.value) : null,
                      }))}
                      placeholder="e.g., 1.55"
                    />
                    {calculatedCAD && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        = {calculatedCAD}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    = (Layer + Margin) / Pieces
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Marker Efficiency (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={localData.markerEfficiency || ''}
                    onChange={(e) => setLocalData(prev => ({
                      ...prev,
                      markerEfficiency: e.target.value ? parseFloat(e.target.value) : null,
                    }))}
                    placeholder="e.g., 92"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Wastage (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={localData.cadWastagePercent || ''}
                    onChange={(e) => setLocalData(prev => ({
                      ...prev,
                      cadWastagePercent: e.target.value ? parseFloat(e.target.value) : 5,
                    }))}
                    placeholder="5"
                  />
                </div>
              </div>
            </div>

            {/* Notes Section */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Notes</Label>
              <Textarea
                value={localData.notes}
                onChange={(e) => setLocalData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Any notes about this CAD entry..."
                rows={2}
              />
            </div>

            {/* Save Button */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onToggleExpand}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete CAD Width?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the {cad.cutableWidth}" width CAD entry?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onDelete(cad.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================
export default function CADEditPage() {
  const navigate = useNavigate();
  const { styleId, groupKey } = useParams<{ styleId: string; groupKey: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<CADGroupData | null>(null);
  const [expandedCADId, setExpandedCADId] = useState<string | null>(null);

  // Add width form
  const [showAddWidth, setShowAddWidth] = useState(false);
  const [newWidth, setNewWidth] = useState<number | ''>('');

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!styleId || !groupKey) return;

    setLoading(true);
    try {
      const response = await api.get(`/styles/${styleId}/cad-planning/${groupKey}/details`);
      if (response.data.success) {
        setData(response.data.data);
      } else {
        notify.error(response.data.message || 'Failed to load CAD data');
      }
    } catch (error: any) {
      console.error('Error fetching CAD data:', error);
      notify.error(error.response?.data?.message || 'Failed to load CAD data');
    } finally {
      setLoading(false);
    }
  }, [styleId, groupKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Add new width
  const handleAddWidth = async () => {
    if (!newWidth || !styleId || !groupKey) return;

    setSaving(true);
    try {
      const response = await api.post(`/styles/${styleId}/cad-planning/add-width`, {
        groupKey,
        cutableWidth: newWidth,
        greigeId: data?.greige?.id,
        fabricId: data?.fabric?.id,
      });

      if (response.data.success) {
        notify.success('Width added successfully');
        setNewWidth('');
        setShowAddWidth(false);
        await fetchData();
        // Expand the newly added CAD
        setExpandedCADId(response.data.data.id);
      } else {
        notify.error(response.data.message || 'Failed to add width');
      }
    } catch (error: any) {
      console.error('Error adding width:', error);
      notify.error(error.response?.data?.message || 'Failed to add width');
    } finally {
      setSaving(false);
    }
  };

  // Update CAD
  const handleUpdateCAD = async (
    cadId: string,
    updateData: Partial<CADOption> & { sizeBreakdowns?: SizeBreakdown[] }
  ) => {
    setSaving(true);
    try {
      const response = await api.put(`/styles/cad-planning/cad/${cadId}`, updateData);

      if (response.data.success) {
        notify.success('CAD updated successfully');
        await fetchData();
        setExpandedCADId(null);
      } else {
        notify.error(response.data.message || 'Failed to update CAD');
      }
    } catch (error: any) {
      console.error('Error updating CAD:', error);
      notify.error(error.response?.data?.message || 'Failed to update CAD');
    } finally {
      setSaving(false);
    }
  };

  // Delete CAD
  const handleDeleteCAD = async (cadId: string) => {
    setSaving(true);
    try {
      const response = await api.delete(`/styles/cad-planning/cad/${cadId}`);

      if (response.data.success) {
        notify.success('Width deleted successfully');
        await fetchData();
      } else {
        notify.error(response.data.message || 'Failed to delete width');
      }
    } catch (error: any) {
      console.error('Error deleting CAD:', error);
      notify.error(error.response?.data?.message || 'Failed to delete width');
    } finally {
      setSaving(false);
    }
  };

  // Set preferred CAD
  const handleSetPreferred = async (cadId: string) => {
    setSaving(true);
    try {
      const response = await api.put(`/styles/cad-planning/cad/${cadId}/set-preferred`);

      if (response.data.success) {
        notify.success('Preferred width updated');
        await fetchData();
      } else {
        notify.error(response.data.message || 'Failed to set preferred');
      }
    } catch (error: any) {
      console.error('Error setting preferred:', error);
      notify.error(error.response?.data?.message || 'Failed to set preferred');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Failed to load CAD data</p>
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="mt-4"
          >
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/styles/${styleId}/cad-planning`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">CAD Edit</h1>
            <p className="text-sm text-muted-foreground">
              {data.style.styleCode} - {data.style.styleName}
            </p>
          </div>
        </div>
        <Badge
          variant={
            data.style.cadStatus === 'APPROVED' ? 'default' :
            data.style.cadStatus === 'IN_PROGRESS' ? 'secondary' : 'outline'
          }
        >
          {data.style.cadStatus}
        </Badge>
      </div>

      {/* Fabric Group Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Fabric Type</Label>
              <p className="font-medium">{data.group.genericFabricName}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Finish</Label>
              <p className="font-medium">{data.group.fabricFinishType}</p>
            </div>
            {data.greige && (
              <>
                <div>
                  <Label className="text-xs text-muted-foreground">Greige</Label>
                  <p className="font-medium">{data.greige.greigeName}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Greige Width</Label>
                  <p className="font-medium">{data.greige.greigeWidth}"</p>
                </div>
              </>
            )}
            {data.group.hasEmbroidery && data.group.embroidery && (
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Embroidery</Label>
                <p className="font-medium">{data.group.embroidery.designName}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add Width Button */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Ruler className="h-5 w-5" />
          CAD Width Options
        </h2>
        {!showAddWidth ? (
          <Button onClick={() => setShowAddWidth(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Width
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              step="0.5"
              value={newWidth}
              onChange={(e) => setNewWidth(e.target.value ? parseFloat(e.target.value) : '')}
              placeholder={`Suggested: ${data.suggestedWidth}"`}
              className="w-48"
            />
            <Button onClick={handleAddWidth} disabled={!newWidth || saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </Button>
            <Button variant="outline" onClick={() => { setShowAddWidth(false); setNewWidth(''); }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* CAD Cards Grid */}
      {data.cadOptions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Ruler className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No CAD width options yet</p>
            <p className="text-sm text-muted-foreground">
              Click "Add Width" to add your first CAD entry.
              Suggested width: {data.suggestedWidth}"
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.cadOptions.map((cad) => (
            <CADCard
              key={cad.id}
              cad={cad}
              sizeOptions={data.sizes}
              isExpanded={expandedCADId === cad.id}
              onToggleExpand={() => setExpandedCADId(expandedCADId === cad.id ? null : cad.id)}
              onUpdate={handleUpdateCAD}
              onDelete={handleDeleteCAD}
              onSetPreferred={handleSetPreferred}
              saving={saving}
            />
          ))}
        </div>
      )}

      {/* Back to CAD Planning Button */}
      <div className="flex justify-center pt-4">
        <Button
          variant="outline"
          onClick={() => navigate(`/styles/${styleId}/cad-planning`)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to CAD Planning
        </Button>
      </div>
    </div>
  );
}
