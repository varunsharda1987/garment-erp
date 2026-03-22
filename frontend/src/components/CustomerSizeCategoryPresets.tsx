/**
 * CustomerSizeCategoryPresets Component
 *
 * Manages size category presets for a customer.
 * Features:
 * - List all presets with size count
 * - Create new preset
 * - Edit preset (name, description, size category)
 * - Delete preset
 * - Set as default
 * - Clone preset
 */

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Star, StarOff, ChevronDown, ChevronUp, Ruler, Save, Copy } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  getAllPresetsForCustomer,
  createPreset,
  updatePreset,
  deletePreset,
  setAsDefault,
  clonePreset,
} from '../services/customerSizePreset.service';
import { getAllSizeCategories } from '../services/sizeCategory.service';
import type { CustomerSizePreset } from '../types/customerSizePreset.types';
import type { SizeCategory } from '../types/sizeCategory.types';
import { notify } from '../lib/notify';
import { cn } from '../lib/utils';

interface CustomerSizeCategoryPresetsProps {
  customerId: string;
  customerName: string;
}

export const CustomerSizeCategoryPresets: React.FC<CustomerSizeCategoryPresetsProps> = ({
  customerId,
  customerName,
}) => {
  const [presets, setPresets] = useState<CustomerSizePreset[]>([]);
  const [sizeCategories, setSizeCategories] = useState<SizeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCloneDialog, setShowCloneDialog] = useState(false);

  // Form states
  const [editingPreset, setEditingPreset] = useState<CustomerSizePreset | null>(null);
  const [presetName, setPresetName] = useState('');
  const [presetDescription, setPresetDescription] = useState('');
  const [sizeCategoryId, setSizeCategoryId] = useState('');
  const [cloneName, setCloneName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [customerId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [presetsData, categoriesData] = await Promise.all([
        getAllPresetsForCustomer(customerId),
        getAllSizeCategories({ isActive: true }),
      ]);
      setPresets(presetsData);
      setSizeCategories(categoriesData.data || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      notify.error('Failed to load size category presets');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePreset = () => {
    setPresetName('');
    setPresetDescription('');
    setSizeCategoryId('');
    setEditingPreset(null);
    setShowCreateDialog(true);
  };

  const handleEditPreset = (preset: CustomerSizePreset) => {
    setPresetName(preset.presetName);
    setPresetDescription(preset.description || '');
    setSizeCategoryId(preset.sizeCategoryId);
    setEditingPreset(preset);
    setShowEditDialog(true);
  };

  const handleDeletePreset = (preset: CustomerSizePreset) => {
    setEditingPreset(preset);
    setShowDeleteDialog(true);
  };

  const handleClonePreset = (preset: CustomerSizePreset) => {
    setEditingPreset(preset);
    setCloneName(`${preset.presetName} (Copy)`);
    setShowCloneDialog(true);
  };

  const handleSetDefault = async (preset: CustomerSizePreset) => {
    try {
      await setAsDefault(customerId, preset.id);
      notify.success(`"${preset.presetName}" set as default`);
      loadData();
    } catch (error) {
      console.error('Failed to set default:', error);
      notify.error('Failed to set default preset');
    }
  };

  const handleSavePreset = async () => {
    if (!presetName.trim()) {
      notify.error('Preset name is required');
      return;
    }

    if (!sizeCategoryId) {
      notify.error('Please select a size category');
      return;
    }

    try {
      setSaving(true);
      const data = {
        presetName: presetName.trim(),
        description: presetDescription.trim() || undefined,
        sizeCategoryId,
        isDefault: false,
      };

      if (editingPreset) {
        await updatePreset(customerId, editingPreset.id, data);
        notify.success('Preset updated successfully');
        setShowEditDialog(false);
      } else {
        await createPreset(customerId, data);
        notify.success('Preset created successfully');
        setShowCreateDialog(false);
      }

      loadData();
    } catch (error: any) {
      console.error('Failed to save preset:', error);
      const message = error.response?.data?.error || 'Failed to save preset';
      notify.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!editingPreset) return;

    try {
      await deletePreset(customerId, editingPreset.id);
      notify.success('Preset deleted successfully');
      setShowDeleteDialog(false);
      setEditingPreset(null);
      loadData();
    } catch (error) {
      console.error('Failed to delete preset:', error);
      notify.error('Failed to delete preset');
    }
  };

  const handleConfirmClone = async () => {
    if (!editingPreset || !cloneName.trim()) return;

    try {
      await clonePreset(customerId, editingPreset.id, { presetName: cloneName.trim() });
      notify.success('Preset cloned successfully');
      setShowCloneDialog(false);
      setEditingPreset(null);
      setCloneName('');
      loadData();
    } catch (error: any) {
      console.error('Failed to clone preset:', error);
      const message = error.response?.data?.error || 'Failed to clone preset';
      notify.error(message);
    }
  };

  const getSelectedCategory = () => {
    return sizeCategories.find((cat) => cat.id === sizeCategoryId);
  };

  const renderPresetForm = () => {
    const selectedCategory = getSelectedCategory();

    return (
      <div className="space-y-4">
        <div>
          <Label>Preset Name *</Label>
          <Input
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="e.g., Men's Standard, Women's Plus, Kids Age"
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
          <Label>Size Category *</Label>
          <Select value={sizeCategoryId} onValueChange={setSizeCategoryId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a size category" />
            </SelectTrigger>
            <SelectContent>
              {sizeCategories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedCategory && (
          <div className="p-3 bg-gray-50 rounded-lg border">
            <p className="text-xs font-medium text-gray-600 mb-2">
              Size Preview ({selectedCategory.sizes.length} sizes):
            </p>
            <div className="flex flex-wrap gap-1">
              {selectedCategory.sizes.map((size, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {size}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <Card>
        <CardHeader className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Ruler className="h-5 w-5" />
              Size Category Presets
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
                <Ruler className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="font-medium">No size category presets</p>
                <p className="text-sm mt-1">Create a preset to define standard sizes for {customerName}</p>
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
                        <p className="text-xs text-gray-500 mt-2">
                          {preset.sizeCategory.name} · {preset.sizeCategory.sizes.length} sizes
                        </p>
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
                          onClick={() => handleClonePreset(preset)}
                          title="Clone preset"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
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

                    {/* Show sizes preview */}
                    {preset.sizeCategory.sizes && preset.sizeCategory.sizes.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex flex-wrap gap-1">
                          {preset.sizeCategory.sizes.slice(0, 10).map((size, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {size}
                            </Badge>
                          ))}
                          {preset.sizeCategory.sizes.length > 10 && (
                            <Badge variant="secondary" className="text-xs">
                              +{preset.sizeCategory.sizes.length - 10} more
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
            <DialogTitle>Create Size Category Preset</DialogTitle>
            <DialogDescription>Create a new preset of standard sizes for {customerName}</DialogDescription>
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
            <DialogTitle>Edit Size Category Preset</DialogTitle>
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

      {/* Clone Dialog */}
      <Dialog open={showCloneDialog} onOpenChange={setShowCloneDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clone Preset</DialogTitle>
            <DialogDescription>Create a copy of "{editingPreset?.presetName}"</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>New Preset Name *</Label>
              <Input
                value={cloneName}
                onChange={(e) => setCloneName(e.target.value)}
                placeholder="Enter name for cloned preset"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloneDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmClone}>
              <Copy className="h-4 w-4 mr-2" />
              Clone Preset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CustomerSizeCategoryPresets;
