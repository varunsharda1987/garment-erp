/**
 * CustomerAccessoryPresets Component
 *
 * Manages accessory presets for a customer.
 * Features:
 * - List all presets with item counts
 * - Create new preset
 * - Edit preset (name, description, items)
 * - Delete preset
 * - Set as default
 * - Add items using MaterialBOMPicker
 */

import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Star, StarOff, ChevronDown, ChevronUp, Package, Save } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import AccessoryPresetPicker, { type PresetItemSelection } from './AccessoryPresetPicker';
import {
  customerService,
  type AccessoryPreset,
  type AccessoryPresetItem as BaseAccessoryPresetItem,
  type CreateAccessoryPresetRequest,
} from '../services/customer.service';
import { notify } from '../lib/notify';
import { cn } from '../lib/utils';

// Extended type for UI display (includes fields from picker)
interface AccessoryPresetItem extends BaseAccessoryPresetItem {
  itemName?: string; // Display name (from picker)
  unit?: string; // Unit of measure (from picker)
  specification?: string; // Material code (from picker)
}

interface CustomerAccessoryPresetsProps {
  customerId: string;
  customerName: string;
}

export const CustomerAccessoryPresets: React.FC<CustomerAccessoryPresetsProps> = ({ customerId, customerName }) => {
  const [presets, setPresets] = useState<AccessoryPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showMaterialPicker, setShowMaterialPicker] = useState(false);

  // Form states
  const [editingPreset, setEditingPreset] = useState<AccessoryPreset | null>(null);
  const [presetName, setPresetName] = useState('');
  const [presetDescription, setPresetDescription] = useState('');
  const [presetItems, setPresetItems] = useState<AccessoryPresetItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPresets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const loadPresets = async () => {
    try {
      setLoading(true);
      const data = await customerService.getAccessoryPresets(customerId);
      setPresets(data);
    } catch (error) {
      console.error('Failed to load presets:', error);
      notify.error('Failed to load accessory presets');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePreset = () => {
    setPresetName('');
    setPresetDescription('');
    setPresetItems([]);
    setEditingPreset(null);
    setShowCreateDialog(true);
  };

  const handleEditPreset = (preset: AccessoryPreset) => {
    setPresetName(preset.presetName);
    setPresetDescription(preset.description || '');
    // Map backend items to component format - handle both LABEL and PACKAGING types
    const mappedItems: AccessoryPresetItem[] = (preset.items || []).map((item) => ({
      id: item.id,
      materialType: item.materialType,
      materialId: item.materialId || undefined,
      // For LABEL type, show label info; for PACKAGING, show material info
      itemName: item.materialType === 'LABEL' ? item.label?.labelName || '' : item.material?.name || '', // Use material name for packaging
      quantity: Number(item.quantity) || 1,
      unit: item.materialType === 'LABEL' ? 'pcs' : item.material?.unit || 'pcs',
      usageCategory:
        (item.usageCategory as 'GARMENT' | 'PACKAGING') || (item.materialType === 'LABEL' ? 'GARMENT' : 'PACKAGING'),
      specification: item.materialType === 'LABEL' ? item.label?.labelCode || '' : item.material?.code || '', // Use material code for packaging
      sortOrder: item.sortOrder,
      // Label-specific fields
      labelId: item.labelId || undefined,
      componentName: item.componentName || undefined,
      extraPercentage: item.extraPercentage ? Number(item.extraPercentage) : undefined,
      label: item.label,
      material: item.material,
    }));
    setPresetItems(mappedItems);
    setEditingPreset(preset);
    setShowEditDialog(true);
  };

  const handleDeletePreset = (preset: AccessoryPreset) => {
    setEditingPreset(preset);
    setShowDeleteDialog(true);
  };

  const handleSetDefault = async (preset: AccessoryPreset) => {
    try {
      await customerService.setDefaultAccessoryPreset(customerId, preset.id);
      notify.success(`"${preset.presetName}" set as default`);
      loadPresets();
    } catch (error) {
      console.error('Failed to set default:', error);
      notify.error('Failed to set default preset');
    }
  };

  const handleAddMaterials = (items: PresetItemSelection[]) => {
    const newItems: AccessoryPresetItem[] = items.map((item, index) => ({
      id: `item-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
      materialType: item.materialType,
      materialId: item.materialType === 'PACKAGING' ? item.materialId : undefined, // Only for packaging
      itemName: item.materialName,
      quantity: item.quantity,
      unit: item.unit,
      usageCategory: item.materialType === 'PACKAGING' ? 'PACKAGING' : 'GARMENT',
      specification: item.materialCode,
      sortOrder: (presetItems?.length || 0) + index,
      // Label-specific fields
      labelId: item.materialType === 'LABEL' ? item.labelId : undefined,
      componentName: item.materialType === 'LABEL' ? item.componentName : undefined,
      extraPercentage: item.materialType === 'LABEL' ? item.extraPercentage : undefined,
    }));
    setPresetItems((prev) => [...prev, ...newItems]);
  };

  const handleRemoveItem = (itemId: string) => {
    setPresetItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const handleSavePreset = async () => {
    if (!presetName.trim()) {
      notify.error('Preset name is required');
      return;
    }

    try {
      setSaving(true);
      const data: CreateAccessoryPresetRequest = {
        presetName: presetName.trim(),
        description: presetDescription.trim() || undefined,
        items: presetItems.map((item, index) => ({
          materialType: item.materialType,
          // For PACKAGING: use materialId; For LABEL: use labelId
          // Send null instead of empty string for foreign key fields
          materialId: item.materialType === 'PACKAGING' ? item.materialId || null : undefined,
          labelId: item.materialType === 'LABEL' ? item.labelId || null : undefined,
          quantity: item.materialType === 'PACKAGING' ? item.quantity : undefined, // Only for packaging
          usageCategory: item.usageCategory,
          sortOrder: item.sortOrder ?? index,
          // Label-specific fields
          componentName: item.materialType === 'LABEL' ? item.componentName : undefined,
          extraPercentage: item.materialType === 'LABEL' ? item.extraPercentage : undefined,
        })),
        isDefault: false,
      };

      if (editingPreset) {
        await customerService.updateAccessoryPreset(customerId, editingPreset.id, data);
        notify.success('Preset updated successfully');
        setShowEditDialog(false);
      } else {
        await customerService.createAccessoryPreset(customerId, data);
        notify.success('Preset created successfully');
        setShowCreateDialog(false);
      }

      loadPresets();
    } catch (error: unknown) {
      console.error('Failed to save preset:', error);
      const err = error as { response?: { data?: { message?: string } } };
      notify.error(err.response?.data?.message || 'Failed to save preset');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!editingPreset) return;

    try {
      await customerService.deleteAccessoryPreset(customerId, editingPreset.id);
      notify.success('Preset deleted successfully');
      setShowDeleteDialog(false);
      setEditingPreset(null);
      loadPresets();
    } catch (error) {
      console.error('Failed to delete preset:', error);
      notify.error('Failed to delete preset');
    }
  };

  const renderPresetForm = () => (
    <div className="space-y-4">
      <div>
        <Label>Preset Name *</Label>
        <Input
          value={presetName}
          onChange={(e) => setPresetName(e.target.value)}
          placeholder="e.g., Standard Export, Premium Domestic"
        />
      </div>

      <div>
        <Label>Description</Label>
        <Textarea
          value={presetDescription}
          onChange={(e) => setPresetDescription(e.target.value)}
          placeholder="Optional description for this preset"
          rows={2}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Accessory Items ({presetItems.length})</Label>
          <Button type="button" variant="outline" size="sm" onClick={() => setShowMaterialPicker(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Item
          </Button>
        </div>

        {presetItems.length === 0 ? (
          <div className="text-center py-6 border-2 border-dashed rounded-lg text-gray-500">
            <Package className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm">No items added yet</p>
            <p className="text-xs mt-1">Click "Add Item" to add accessories</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-auto">
            {presetItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs',
                        item.materialType === 'LABEL' ? 'bg-blue-50 border-blue-200 text-blue-700' : ''
                      )}
                    >
                      {item.materialType}
                    </Badge>
                    <span className="font-medium text-sm">{item.itemName}</span>
                    {item.specification && (
                      <span className="text-xs text-gray-400 font-mono">{item.specification}</span>
                    )}
                  </div>
                  {item.materialType === 'LABEL' ? (
                    <p className="text-xs text-gray-600 mt-1">
                      {item.componentName && <span className="text-blue-600">{item.componentName}</span>}
                      {item.componentName && item.extraPercentage != null && <span> · </span>}
                      {item.extraPercentage != null && <span>+{item.extraPercentage}% buffer</span>}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-600 mt-1">
                      Qty: {item.quantity} {item.unit} · {item.usageCategory}
                    </p>
                  )}
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveItem(item.id)}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <Card>
        <CardHeader className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5" />
              Accessory Presets
              <Badge variant="secondary" className="ml-2">
                {presets.length}
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleCreatePreset();
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                New Preset
              </Button>
              {expanded ? (
                <ChevronUp className="h-5 w-5 text-gray-500" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-500" />
              )}
            </div>
          </div>
        </CardHeader>

        {expanded && (
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-sm text-gray-600">Loading presets...</p>
              </div>
            ) : presets.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="font-medium">No accessory presets</p>
                <p className="text-sm mt-1">Create a preset to define standard accessories for {customerName}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {presets.map((preset) => (
                  <div
                    key={preset.id}
                    className={cn(
                      'p-4 rounded-lg border transition-all',
                      preset.isDefault ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{preset.presetName}</h4>
                          {preset.isDefault && (
                            <Badge
                              variant="secondary"
                              className="text-xs bg-yellow-100 text-yellow-800 border-yellow-300"
                            >
                              <Star className="h-3 w-3 mr-1 fill-current" />
                              Default
                            </Badge>
                          )}
                        </div>
                        {preset.description && <p className="text-sm text-gray-600 mt-1">{preset.description}</p>}
                        <p className="text-xs text-gray-500 mt-2">{preset.items?.length || 0} items</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {!preset.isDefault && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetDefault(preset)}
                            title="Set as default"
                          >
                            <StarOff className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditPreset(preset)}
                          title="Edit preset"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePreset(preset)}
                          title="Delete preset"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>

                    {/* Show items preview */}
                    {preset.items && preset.items.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex flex-wrap gap-1">
                          {preset.items.slice(0, 5).map((item, idx) => (
                            <Badge
                              key={idx}
                              variant="outline"
                              className={cn(
                                'text-xs',
                                item.materialType === 'LABEL' ? 'bg-blue-50 border-blue-200' : ''
                              )}
                            >
                              {item.materialType === 'LABEL'
                                ? item.label?.labelName || item.labelId?.slice(0, 8) || 'Label'
                                : `${item.materialType} (${item.quantity})`}
                            </Badge>
                          ))}
                          {preset.items.length > 5 && (
                            <Badge variant="secondary" className="text-xs">
                              +{preset.items.length - 5} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Accessory Preset</DialogTitle>
            <DialogDescription>Create a new preset of standard accessories for {customerName}</DialogDescription>
          </DialogHeader>
          {renderPresetForm()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePreset} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Creating...' : 'Create Preset'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Accessory Preset</DialogTitle>
            <DialogDescription>Update the preset configuration</DialogDescription>
          </DialogHeader>
          {renderPresetForm()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePreset} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Preset</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{editingPreset?.presetName}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Material Picker */}
      <AccessoryPresetPicker
        isOpen={showMaterialPicker}
        onClose={() => setShowMaterialPicker(false)}
        onSelect={handleAddMaterials}
        customerId={customerId}
      />
    </>
  );
};

export default CustomerAccessoryPresets;
