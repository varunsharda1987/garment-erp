/**
 * AccessoryPresetPicker Component
 *
 * A multi-select picker for adding labels and packaging to customer accessory presets.
 * Simpler than MaterialBOMPicker - no BOM-specific fields like "per garment", component names, etc.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Label } from './ui/label';
import { Search } from 'lucide-react';

// Services
import { getAllLabels } from '../services/label.service';
import { getAllPackaging } from '../services/packaging.service';

// Types
import type { Label as LabelType } from '../types/label.types';
import type { Packaging } from '../types/packaging.types';

// Selection types
export interface PresetItemSelection {
  materialType: 'LABEL' | 'PACKAGING';
  materialId: string;
  materialCode: string;
  materialName: string;
  quantity: number;
  unit: string;
  subType?: string; // labelType or packagingType
  // Label-specific fields
  labelId?: string; // For LABEL type - the actual label master ID
  componentName?: string; // Where label is attached (e.g., "Back Neck")
  extraPercentage?: number; // Buffer % for labels (default 5)
}

interface AccessoryPresetPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (items: PresetItemSelection[]) => void;
  customerId?: string; // Optional filter by customer
}

// Internal item structure
interface PickerItem {
  id: string;
  code: string;
  name: string;
  subType?: string | null;
  unit: string;
  labelCategory?: string; // For labels: SEWN_IN, HANGTAG, PRICE_TAG
}

type TabType = 'LABEL' | 'PACKAGING';

export default function AccessoryPresetPicker({
  isOpen,
  onClose,
  onSelect,
  customerId,
}: AccessoryPresetPickerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('LABEL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Data
  const [labels, setLabels] = useState<PickerItem[]>([]);
  const [packaging, setPackaging] = useState<PickerItem[]>([]);

  // Selected items with quantities and label-specific fields
  const [selectedItems, setSelectedItems] = useState<Map<string, {
    item: PickerItem;
    type: TabType;
    quantity: number;
    componentName?: string;
    extraPercentage?: number;
  }>>(
    new Map()
  );

  // Load data when modal opens or customerId changes
  useEffect(() => {
    if (isOpen) {
      loadAllItems();
    }
  }, [isOpen, customerId]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSelectedItems(new Map());
      setActiveTab('LABEL');
    }
  }, [isOpen]);

  const loadAllItems = async () => {
    setLoading(true);
    try {
      await Promise.all([loadLabels(), loadPackaging()]);
    } finally {
      setLoading(false);
    }
  };

  const loadLabels = async () => {
    try {
      // Load ALL labels (sewn-in, hangtags, price tags) for customer presets
      // Filter by customer if provided (shows customer-specific + generic)
      const response = await getAllLabels({ limit: 500, customerId });

      setLabels(
        response.data.map((l: LabelType) => ({
          id: l.id,
          code: l.labelCode,
          name: l.labelName,
          subType: l.labelType,
          unit: 'pcs',
          labelCategory: l.labelCategory,
        }))
      );
    } catch (error) {
      console.error('Failed to load labels:', error);
    }
  };

  const loadPackaging = async () => {
    try {
      // Filter by customer if provided
      const response = await getAllPackaging({ limit: 500, customerId });
      setPackaging(
        response.data.map((p: Packaging) => ({
          id: p.id,
          code: p.packagingCode,
          name: p.packagingName,
          subType: p.packagingType,
          unit: 'pcs',
        }))
      );
    } catch (error) {
      console.error('Failed to load packaging:', error);
    }
  };

  // Get items for current tab
  const getCurrentItems = (): PickerItem[] => {
    return activeTab === 'LABEL' ? labels : packaging;
  };

  // Filter items by search query
  const filteredItems = useMemo(() => {
    const items = getCurrentItems();
    if (!searchQuery) return items;

    const query = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.code.toLowerCase().includes(query) ||
        item.subType?.toLowerCase().includes(query)
    );
  }, [activeTab, searchQuery, labels, packaging]);

  // Check if item is selected
  const isItemSelected = (itemId: string): boolean => {
    return selectedItems.has(itemId);
  };

  // Get quantity for selected item
  const getItemQuantity = (itemId: string): number => {
    return selectedItems.get(itemId)?.quantity || 1;
  };

  // Get component name for selected label
  const getComponentName = (itemId: string): string | undefined => {
    return selectedItems.get(itemId)?.componentName;
  };

  // Get extra percentage for selected label
  const getExtraPercentage = (itemId: string): number | undefined => {
    return selectedItems.get(itemId)?.extraPercentage;
  };

  // Toggle item selection
  const toggleItemSelection = (item: PickerItem) => {
    const newMap = new Map(selectedItems);
    if (newMap.has(item.id)) {
      newMap.delete(item.id);
    } else {
      // For LABEL type, add default componentName and extraPercentage
      if (activeTab === 'LABEL') {
        newMap.set(item.id, {
          item,
          type: activeTab,
          quantity: 1,
          componentName: 'Back Neck', // Default component
          extraPercentage: 5, // Default buffer %
        });
      } else {
        newMap.set(item.id, { item, type: activeTab, quantity: 1 });
      }
    }
    setSelectedItems(newMap);
  };

  // Update component name for a selected label
  const updateComponentName = (itemId: string, componentName: string) => {
    const entry = selectedItems.get(itemId);
    if (entry && entry.type === 'LABEL') {
      const newMap = new Map(selectedItems);
      newMap.set(itemId, { ...entry, componentName });
      setSelectedItems(newMap);
    }
  };

  // Update extra percentage for a selected label
  const updateExtraPercentage = (itemId: string, extraPercentage: number) => {
    const entry = selectedItems.get(itemId);
    if (entry && entry.type === 'LABEL') {
      const newMap = new Map(selectedItems);
      newMap.set(itemId, { ...entry, extraPercentage });
      setSelectedItems(newMap);
    }
  };

  // Update quantity for a selected item
  const updateQuantity = (itemId: string, quantity: number) => {
    const entry = selectedItems.get(itemId);
    if (entry && quantity > 0) {
      const newMap = new Map(selectedItems);
      newMap.set(itemId, { ...entry, quantity });
      setSelectedItems(newMap);
    }
  };

  // Handle add items
  const handleAddItems = () => {
    const selections: PresetItemSelection[] = Array.from(selectedItems.values()).map(
      ({ item, type, quantity, componentName, extraPercentage }) => ({
        materialType: type,
        materialId: type === 'LABEL' ? '' : item.id, // For labels, materialId is not used
        materialCode: item.code,
        materialName: item.name,
        quantity,
        unit: item.unit,
        subType: item.subType || undefined,
        // Label-specific fields
        labelId: type === 'LABEL' ? item.id : undefined,
        componentName: type === 'LABEL' ? componentName : undefined,
        extraPercentage: type === 'LABEL' ? extraPercentage : undefined,
      })
    );

    onSelect(selections);
    onClose();
  };

  // Get selected count for tab badge
  const getSelectedCountForTab = (tab: TabType): number => {
    return Array.from(selectedItems.values()).filter((entry) => entry.type === tab).length;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Items to Preset</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as TabType)} className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="LABEL" className="relative">
                🏷️ Labels
                {getSelectedCountForTab('LABEL') > 0 && (
                  <span className="ml-2 bg-blue-500 text-white text-xs rounded-full px-2 py-0.5">
                    {getSelectedCountForTab('LABEL')}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="PACKAGING" className="relative">
                📦 Packaging
                {getSelectedCountForTab('PACKAGING') > 0 && (
                  <span className="ml-2 bg-blue-500 text-white text-xs rounded-full px-2 py-0.5">
                    {getSelectedCountForTab('PACKAGING')}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Search */}
            <div className="relative mt-4 mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder={`Search ${activeTab === 'LABEL' ? 'labels' : 'packaging'}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Item Lists */}
            <TabsContent value="LABEL" className="flex-1 overflow-y-auto mt-0">
              {loading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="text-gray-500">Loading labels...</div>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="flex justify-center items-center py-8">
                  <div className="text-gray-500">
                    {searchQuery ? 'No labels found matching your search' : 'No labels available'}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredItems.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      isSelected={isItemSelected(item.id)}
                      quantity={getItemQuantity(item.id)}
                      isLabel={true}
                      componentName={getComponentName(item.id)}
                      extraPercentage={getExtraPercentage(item.id)}
                      onToggle={() => toggleItemSelection(item)}
                      onQuantityChange={(qty) => updateQuantity(item.id, qty)}
                      onComponentNameChange={(name) => updateComponentName(item.id, name)}
                      onExtraPercentageChange={(pct) => updateExtraPercentage(item.id, pct)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="PACKAGING" className="flex-1 overflow-y-auto mt-0">
              {loading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="text-gray-500">Loading packaging...</div>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="flex justify-center items-center py-8">
                  <div className="text-gray-500">
                    {searchQuery ? 'No packaging found matching your search' : 'No packaging available'}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredItems.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      isSelected={isItemSelected(item.id)}
                      quantity={getItemQuantity(item.id)}
                      isLabel={false}
                      onToggle={() => toggleItemSelection(item)}
                      onQuantityChange={(qty) => updateQuantity(item.id, qty)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleAddItems} disabled={selectedItems.size === 0}>
            Add {selectedItems.size > 0 ? `${selectedItems.size} Item${selectedItems.size > 1 ? 's' : ''}` : 'Items'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Common label component locations
const COMPONENT_LOCATIONS = [
  'Back Neck',
  'Side Seam',
  'Hangtag Loop',
  'Bottom Hem',
  'Sleeve',
  'Pocket',
  'Other',
];

// Item Row Component
interface ItemRowProps {
  item: PickerItem;
  isSelected: boolean;
  quantity: number;
  isLabel: boolean;
  componentName?: string;
  extraPercentage?: number;
  onToggle: () => void;
  onQuantityChange: (quantity: number) => void;
  onComponentNameChange?: (name: string) => void;
  onExtraPercentageChange?: (pct: number) => void;
}

function ItemRow({
  item,
  isSelected,
  quantity,
  isLabel,
  componentName,
  extraPercentage,
  onToggle,
  onQuantityChange,
  onComponentNameChange,
  onExtraPercentageChange,
}: ItemRowProps) {
  return (
    <div
      className={`border rounded-lg p-3 transition-colors ${
        isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <Checkbox checked={isSelected} onCheckedChange={onToggle} className="mt-1" />

        {/* Item Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-gray-900 truncate">{item.name}</h4>
              <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                {item.labelCategory && (
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                    item.labelCategory === 'SEWN_IN' ? 'bg-blue-100 text-blue-700' :
                    item.labelCategory === 'HANGTAG' ? 'bg-green-100 text-green-700' :
                    'bg-purple-100 text-purple-700'
                  }`}>
                    {item.labelCategory === 'SEWN_IN' ? 'Sewn-in' :
                     item.labelCategory === 'HANGTAG' ? 'Hangtag' : 'Price Tag'}
                  </span>
                )}
                {item.subType && <span className="text-gray-500">{item.subType}</span>}
                <span className="text-gray-400">•</span>
                <span className="font-mono text-xs text-gray-500">{item.code}</span>
              </div>
            </div>

            {/* Quantity Input (for packaging only) */}
            {isSelected && !isLabel && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <Label htmlFor={`qty-${item.id}`} className="text-sm text-gray-600 whitespace-nowrap">
                  Qty:
                </Label>
                <Input
                  id={`qty-${item.id}`}
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => onQuantityChange(parseInt(e.target.value) || 1)}
                  className="w-16 h-8 text-center"
                />
              </div>
            )}
          </div>

          {/* Label-specific fields */}
          {isSelected && isLabel && (
            <div className="mt-3 pt-3 border-t border-blue-200 grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor={`comp-${item.id}`} className="text-xs text-gray-600">
                  Component Location
                </Label>
                <select
                  id={`comp-${item.id}`}
                  value={componentName || 'Back Neck'}
                  onChange={(e) => onComponentNameChange?.(e.target.value)}
                  className="w-full h-8 text-sm rounded border border-gray-300 px-2 mt-1"
                >
                  {COMPONENT_LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor={`extra-${item.id}`} className="text-xs text-gray-600">
                  Extra % (Buffer)
                </Label>
                <Input
                  id={`extra-${item.id}`}
                  type="number"
                  min="0"
                  max="50"
                  step="0.5"
                  value={extraPercentage ?? 5}
                  onChange={(e) => onExtraPercentageChange?.(parseFloat(e.target.value) || 5)}
                  className="h-8 text-sm mt-1"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
