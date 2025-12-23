// Style Label Configuration Component
// Allows adding/editing labels for a style with size-specific data (barcodes, MRP for Price Tags)

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Edit2, Tag, DollarSign, Barcode, Percent } from 'lucide-react';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { getAllLabels } from '@/services/label.service';
import {
  getStyleLabels,
  addLabelToStyle,
  updateStyleLabel,
  removeStyleLabel,
} from '@/services/styleLabel.service';
import type { Label as LabelMaster } from '@/types/label.types';
import type { StyleLabelConfig as StyleLabelConfigType, SizeConfigInput } from '@/types/styleLabel.types';

interface StyleLabelConfigProps {
  styleId: string;
  styleSizes?: string[]; // Available sizes from style (e.g., ['XS', 'S', 'M', 'L', 'XL'])
  customerId?: string; // Filter labels by customer
  readOnly?: boolean;
}

interface AddLabelFormData {
  labelId: string;
  componentName: string;
  extraPercentage: number;
  notes: string;
  sizeConfigs: SizeConfigInput[];
}

const LABEL_CATEGORY_COLORS: Record<string, string> = {
  SEWN_IN: 'bg-blue-100 text-blue-800',
  HANGTAG: 'bg-green-100 text-green-800',
  PRICE_TAG: 'bg-purple-100 text-purple-800',
};

const DEFAULT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

export default function StyleLabelConfig({
  styleId,
  styleSizes = DEFAULT_SIZES,
  customerId,
  readOnly = false,
}: StyleLabelConfigProps) {
  const [labelConfigs, setLabelConfigs] = useState<StyleLabelConfigType[]>([]);
  const [availableLabels, setAvailableLabels] = useState<LabelMaster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<StyleLabelConfigType | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<LabelMaster | null>(null);

  const [formData, setFormData] = useState<AddLabelFormData>({
    labelId: '',
    componentName: '',
    extraPercentage: 5,
    notes: '',
    sizeConfigs: [],
  });

  useEffect(() => {
    loadData();
  }, [styleId, customerId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [configs, labels] = await Promise.all([
        getStyleLabels(styleId),
        getAllLabels({
          customerId: customerId || undefined,
          limit: 100,
        }),
      ]);
      setLabelConfigs(configs);
      setAvailableLabels(labels.data);
    } catch (error) {
      handleApiError(error, 'Failed to load label configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAddDialog = () => {
    setEditingConfig(null);
    setSelectedLabel(null);
    setFormData({
      labelId: '',
      componentName: '',
      extraPercentage: 5,
      notes: '',
      sizeConfigs: [],
    });
    setIsDialogOpen(true);
  };

  const handleOpenEditDialog = (config: StyleLabelConfigType) => {
    setEditingConfig(config);
    setSelectedLabel(config.label as unknown as LabelMaster);
    setFormData({
      labelId: config.labelId,
      componentName: config.componentName || '',
      extraPercentage: config.extraPercentage,
      notes: config.notes || '',
      sizeConfigs: config.sizeConfigs.map(sc => ({
        size: sc.size,
        barcodeValue: sc.barcodeValue,
        mrp: sc.mrp,
      })),
    });
    setIsDialogOpen(true);
  };

  const handleLabelSelect = (labelId: string) => {
    const label = availableLabels.find(l => l.id === labelId);
    setSelectedLabel(label || null);
    setFormData(prev => ({
      ...prev,
      labelId,
      // Initialize size configs for price tags
      sizeConfigs: label?.labelCategory === 'PRICE_TAG'
        ? styleSizes.map(size => ({ size, barcodeValue: '', mrp: null }))
        : [],
    }));
  };

  const handleSizeConfigChange = (size: string, field: 'barcodeValue' | 'mrp', value: string | number | null) => {
    setFormData(prev => ({
      ...prev,
      sizeConfigs: prev.sizeConfigs.map(sc =>
        sc.size === size ? { ...sc, [field]: value } : sc
      ),
    }));
  };

  const handleSubmit = async () => {
    if (!formData.labelId) {
      handleApiError(null, 'Please select a label');
      return;
    }

    try {
      if (editingConfig) {
        // Update existing config
        await updateStyleLabel(editingConfig.id, {
          componentName: formData.componentName || null,
          extraPercentage: formData.extraPercentage,
          notes: formData.notes || null,
          sizeConfigs: formData.sizeConfigs.length > 0 ? formData.sizeConfigs : undefined,
        });
        handleApiSuccess('Label Updated', 'Label configuration has been updated');
      } else {
        // Add new label
        await addLabelToStyle(styleId, {
          labelId: formData.labelId,
          componentName: formData.componentName || null,
          extraPercentage: formData.extraPercentage,
          notes: formData.notes || null,
          sizeConfigs: formData.sizeConfigs.length > 0 ? formData.sizeConfigs : undefined,
        });
        handleApiSuccess('Label Added', 'Label has been added to the style');
      }

      setIsDialogOpen(false);
      loadData();
    } catch (error) {
      handleApiError(error, editingConfig ? 'Failed to update label' : 'Failed to add label');
    }
  };

  const handleRemoveLabel = async (configId: string, labelName: string) => {
    if (!confirm(`Are you sure you want to remove "${labelName}" from this style?`)) {
      return;
    }

    try {
      await removeStyleLabel(configId);
      handleApiSuccess('Label Removed', `${labelName} has been removed from this style`);
      loadData();
    } catch (error) {
      handleApiError(error, 'Failed to remove label');
    }
  };

  // Filter out already added labels
  const getAvailableLabelOptions = () => {
    const addedLabelIds = new Set(labelConfigs.map(c => c.labelId));
    return availableLabels.filter(l => !addedLabelIds.has(l.id) || editingConfig?.labelId === l.id);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Labels Configuration
          </CardTitle>
          {!readOnly && (
            <Button onClick={handleOpenAddDialog} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Add Label
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {labelConfigs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Tag className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No labels configured for this style</p>
            {!readOnly && (
              <Button variant="outline" className="mt-3" onClick={handleOpenAddDialog}>
                Add First Label
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {labelConfigs.map(config => (
              <div
                key={config.id}
                className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">{config.label.labelName}</h4>
                      <Badge className={LABEL_CATEGORY_COLORS[config.label.labelCategory] || 'bg-gray-100'}>
                        {config.label.labelCategory}
                      </Badge>
                      {config.label.labelType && (
                        <Badge variant="outline">{config.label.labelType}</Badge>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p className="flex items-center gap-1">
                        <span className="font-medium">Code:</span> {config.label.labelCode}
                      </p>
                      {config.componentName && (
                        <p className="flex items-center gap-1">
                          <span className="font-medium">Component:</span> {config.componentName}
                        </p>
                      )}
                      <p className="flex items-center gap-1">
                        <Percent className="h-3 w-3" />
                        <span className="font-medium">Extra:</span> {config.extraPercentage}%
                      </p>
                      {config.notes && (
                        <p className="text-gray-500 italic">{config.notes}</p>
                      )}
                    </div>

                    {/* Size Configs (for Price Tags) */}
                    {config.sizeConfigs.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-sm font-medium mb-2 flex items-center gap-1">
                          <Barcode className="h-4 w-4" />
                          Size-specific Data
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                          {config.sizeConfigs.map(sc => (
                            <div key={sc.size} className="text-xs bg-gray-50 rounded p-2">
                              <div className="font-medium">{sc.size}</div>
                              {sc.barcodeValue && (
                                <div className="text-gray-600 truncate" title={sc.barcodeValue}>
                                  {sc.barcodeValue}
                                </div>
                              )}
                              {sc.mrp && (
                                <div className="text-green-600">₹{sc.mrp}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {!readOnly && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEditDialog(config)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleRemoveLabel(config.id, config.label.labelName)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit Label Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingConfig ? 'Edit Label Configuration' : 'Add Label to Style'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Label Selection */}
              <div className="space-y-2">
                <Label>Select Label *</Label>
                <Select
                  value={formData.labelId}
                  onValueChange={handleLabelSelect}
                  disabled={!!editingConfig}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a label preset" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableLabelOptions().map(label => (
                      <SelectItem key={label.id} value={label.id}>
                        <div className="flex items-center gap-2">
                          <span>{label.labelName}</span>
                          <span className="text-xs text-gray-500">({label.labelCode})</span>
                          <Badge className={`text-xs ${LABEL_CATEGORY_COLORS[label.labelCategory || ''] || 'bg-gray-100'}`}>
                            {label.labelCategory}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Component Name */}
              <div className="space-y-2">
                <Label>Component/Location</Label>
                <Input
                  placeholder="e.g., Back Neck, Side Seam, Hangtag Loop"
                  value={formData.componentName}
                  onChange={e => setFormData(prev => ({ ...prev, componentName: e.target.value }))}
                />
                <p className="text-xs text-gray-500">
                  Where is this label attached on the garment?
                </p>
              </div>

              {/* Extra Percentage */}
              <div className="space-y-2">
                <Label>Extra Percentage (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={formData.extraPercentage}
                  onChange={e => setFormData(prev => ({ ...prev, extraPercentage: parseFloat(e.target.value) || 0 }))}
                />
                <p className="text-xs text-gray-500">
                  Buffer percentage for ordering extra labels (e.g., 5% means order 105 for every 100 garments)
                </p>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  placeholder="Any special instructions for this label..."
                  value={formData.notes}
                  onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                />
              </div>

              {/* Size Configs for Price Tags */}
              {selectedLabel?.labelCategory === 'PRICE_TAG' && (
                <div className="space-y-3 pt-3 border-t">
                  <div className="flex items-center gap-2">
                    <Barcode className="h-5 w-5" />
                    <Label className="text-base font-medium">Size-specific Barcodes & MRP</Label>
                  </div>
                  <p className="text-sm text-gray-600">
                    Enter the customer-provided barcode and MRP for each size. This is typically required for price tags.
                  </p>
                  <div className="grid gap-3">
                    {formData.sizeConfigs.map(sc => (
                      <div key={sc.size} className="grid grid-cols-[80px_1fr_120px] gap-2 items-center">
                        <div className="font-medium text-center bg-gray-100 rounded py-2">
                          {sc.size}
                        </div>
                        <Input
                          placeholder="Barcode (EAN-13)"
                          value={sc.barcodeValue || ''}
                          onChange={e => handleSizeConfigChange(sc.size, 'barcodeValue', e.target.value)}
                        />
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4 text-gray-400" />
                          <Input
                            type="number"
                            placeholder="MRP"
                            value={sc.mrp || ''}
                            onChange={e => handleSizeConfigChange(sc.size, 'mrp', e.target.value ? parseFloat(e.target.value) : null)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit}>
                {editingConfig ? 'Update Label' : 'Add Label'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
