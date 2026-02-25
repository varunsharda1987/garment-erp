/**
 * AccessoriesTab Component
 * Tab 4: Garment & Packaging Accessories
 */

import { useStyleForm } from '../StyleFormContext';
import { Button } from '../../../../components/ui/button';
import { Card } from '../../../../components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../components/ui/select';
import { Badge } from '../../../../components/ui/badge';
import { Plus, Trash2, AlertCircle, Save } from 'lucide-react';

interface AccessoriesTabProps {
  onPrevious: () => void;
  onOpenPicker: () => void;
  onSaveAsDraft: () => void;
  onSubmit: () => void;
  loading: boolean;
}

export function AccessoriesTab({
  onPrevious,
  onOpenPicker,
  onSaveAsDraft,
  onSubmit,
  loading,
}: AccessoriesTabProps) {
  const { state, dispatch, removeAccessory } = useStyleForm();
  const {
    customerAccessoryPresets,
    selectedAccessoryPresetId,
    accessories,
    isEditMode,
  } = state;

  return (
    <div className="space-y-6">
      {/* Customer Preset Section */}
      {customerAccessoryPresets.length > 0 && (
        <Card className="p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Customer Accessory Preset</h2>
            <p className="text-sm text-gray-600">Auto-populate standard accessories for this customer</p>
          </div>
          <Select
            value={selectedAccessoryPresetId}
            onValueChange={(value) => dispatch({ type: 'SET_ACCESSORY_PRESET_ID', payload: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select preset (optional)..." />
            </SelectTrigger>
            <SelectContent>
              {customerAccessoryPresets.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  {preset.presetName} {preset.isDefault && '(Default)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Card>
      )}

      {/* Manual Accessories */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold">Garment & Packaging Accessories</h2>
            <p className="text-sm text-gray-600">Labels, Polybags, Hangtags, Cartons, etc.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onOpenPicker}>
            <Plus className="h-4 w-4 mr-2" />
            Add Accessory
          </Button>
        </div>

        {accessories.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <AlertCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>No accessories added yet</p>
            <p className="text-sm mt-1">Add manually or select a customer preset above</p>
          </div>
        ) : (
          <div className="space-y-2">
            {accessories.map((accessory, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{accessory.materialCode}</Badge>
                    <span className="font-medium text-sm">{accessory.materialName}</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Qty: {accessory.quantityPerGarment} {accessory.unit} ·
                    Category: {accessory.usageCategory.replace('_', ' ')}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeAccessory(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onPrevious}>
          Previous
        </Button>
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onSaveAsDraft}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            Save as Draft
          </Button>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {loading ? 'Saving...' : isEditMode ? 'Update Style' : 'Create Style'}
          </Button>
        </div>
      </div>
    </div>
  );
}
