/**
 * AccessorySelector Component
 *
 * A multi-select component for selecting accessories (Labels, Packaging)
 * with tabbed interface and inline "Add New" capability.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Card } from './ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Label } from './ui/label';
import { Search, Plus, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { notify } from '../lib/notify';

// Services
import { getAllLabels, createLabel } from '../services/label.service';
import { getAllPackaging, createPackaging } from '../services/packaging.service';

// Types
import type { Label as LabelType } from '../types/label.types';
import type { Packaging } from '../types/packaging.types';

// Accessory type definition
export type AccessoryType = 'LABEL' | 'PACKAGING';

export interface StyleAccessory {
  accessoryType: AccessoryType;
  masterId: string;
  masterCode: string;
  masterName: string;
  subType?: string | null; // labelType or packagingType
}

// Generic accessory item for internal use
interface AccessoryItem {
  id: string;
  code: string;
  name: string;
  subType?: string | null;
  description?: string | null;
}

interface AccessorySelectorProps {
  selectedAccessories: StyleAccessory[];
  onChange: (accessories: StyleAccessory[]) => void;
  disabled?: boolean;
  /** IDs of accessories that came from a customer preset (for visual distinction) */
  presetItemIds?: Set<string>;
}

const ACCESSORY_TABS: { type: AccessoryType; label: string; icon: string }[] = [
  { type: 'LABEL', label: 'Labels', icon: '🏷️' },
  { type: 'PACKAGING', label: 'Packaging', icon: '📦' },
];

export function AccessorySelector({ selectedAccessories, onChange, disabled = false, presetItemIds }: AccessorySelectorProps) {
  const [activeTab, setActiveTab] = useState<AccessoryType>('LABEL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Data for each accessory type
  const [labels, setLabels] = useState<AccessoryItem[]>([]);
  const [packaging, setPackaging] = useState<AccessoryItem[]>([]);

  // Quick add modal - common fields
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddType, setQuickAddType] = useState<AccessoryType>('LABEL');
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddSaving, setQuickAddSaving] = useState(false);

  // Quick add modal - Label-specific fields
  const [quickAddColor, setQuickAddColor] = useState('');
  const [quickAddLabelType, setQuickAddLabelType] = useState('');
  const [quickAddSize, setQuickAddSize] = useState('');
  const [quickAddMaterial, setQuickAddMaterial] = useState('');
  const [quickAddPrintMethod, setQuickAddPrintMethod] = useState('');

  // Quick add modal - Packaging-specific fields
  const [quickAddPackagingType, setQuickAddPackagingType] = useState('');
  const [quickAddThickness, setQuickAddThickness] = useState('');

  // Load data for each accessory type
  useEffect(() => {
    loadAllAccessories();
  }, []);

  const loadAllAccessories = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadLabels(),
        loadPackaging(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadLabels = async () => {
    try {
      const response = await getAllLabels({ limit: 500 });
      setLabels(response.data.map((l: LabelType) => ({
        id: l.id,
        code: l.labelCode,
        name: l.labelName,
        subType: l.labelType,
        description: l.description,
      })));
    } catch (error) {
      console.error('Failed to load labels:', error);
    }
  };

  const loadPackaging = async () => {
    try {
      const response = await getAllPackaging({ limit: 500 });
      setPackaging(response.data.map((p: Packaging) => ({
        id: p.id,
        code: p.packagingCode,
        name: p.packagingName,
        subType: p.packagingType,
        description: p.description,
      })));
    } catch (error) {
      console.error('Failed to load packaging:', error);
    }
  };

  // Get items for current tab
  const getCurrentItems = (): AccessoryItem[] => {
    switch (activeTab) {
      case 'LABEL': return labels;
      case 'PACKAGING': return packaging;
      default: return [];
    }
  };

  // Filter items by search query
  const filteredItems = useMemo(() => {
    const items = getCurrentItems();
    if (!searchQuery) return items;

    const query = searchQuery.toLowerCase();
    return items.filter(item =>
      item.name.toLowerCase().includes(query) ||
      item.code.toLowerCase().includes(query) ||
      item.subType?.toLowerCase().includes(query)
    );
  }, [activeTab, searchQuery, labels, packaging]);

  // Check if item is selected
  const isSelected = (accessoryType: AccessoryType, masterId: string): boolean => {
    return selectedAccessories.some(a => a.accessoryType === accessoryType && a.masterId === masterId);
  };

  // Toggle item selection
  const toggleItem = (item: AccessoryItem) => {
    if (disabled) return;

    const accessoryType = activeTab;
    const existingIndex = selectedAccessories.findIndex(
      a => a.accessoryType === accessoryType && a.masterId === item.id
    );

    if (existingIndex >= 0) {
      // Remove
      const newAccessories = [...selectedAccessories];
      newAccessories.splice(existingIndex, 1);
      onChange(newAccessories);
    } else {
      // Add
      const newAccessory: StyleAccessory = {
        accessoryType,
        masterId: item.id,
        masterCode: item.code,
        masterName: item.name,
        subType: item.subType,
      };
      onChange([...selectedAccessories, newAccessory]);
    }
  };

  // Remove a selected accessory
  const removeAccessory = (accessory: StyleAccessory) => {
    if (disabled) return;
    onChange(selectedAccessories.filter(a => !(a.accessoryType === accessory.accessoryType && a.masterId === accessory.masterId)));
  };

  // Get count of selected items for a tab
  const getSelectedCount = (accessoryType: AccessoryType): number => {
    return selectedAccessories.filter(a => a.accessoryType === accessoryType).length;
  };

  // Open quick add modal - reset all fields
  const openQuickAdd = () => {
    setQuickAddType(activeTab);
    // Common fields
    setQuickAddName('');
    // Label fields
    setQuickAddColor('');
    setQuickAddLabelType('');
    setQuickAddSize('');
    setQuickAddMaterial('');
    setQuickAddPrintMethod('');
    // Packaging fields
    setQuickAddPackagingType('');
    setQuickAddThickness('');
    // Open modal
    setQuickAddOpen(true);
  };

  // Handle quick add save
  const handleQuickAddSave = async () => {
    if (!quickAddName.trim()) {
      notify.error('Name is required');
      return;
    }

    setQuickAddSaving(true);
    try {
      let newItem: AccessoryItem | null = null;

      switch (quickAddType) {
        case 'LABEL': {
          const result = await createLabel({
            labelName: quickAddName,
            color: quickAddColor || undefined,
            labelType: quickAddLabelType || undefined,
            size: quickAddSize || undefined,
            material: quickAddMaterial || undefined,
            printMethod: quickAddPrintMethod || undefined,
          });
          newItem = {
            id: result.id,
            code: result.labelCode,
            name: result.labelName,
            subType: result.labelType,
          };
          setLabels(prev => [...prev, newItem!]);
          break;
        }
        case 'PACKAGING': {
          const result = await createPackaging({
            packagingName: quickAddName,
            packagingType: quickAddPackagingType || undefined,
            size: quickAddSize || undefined,
            material: quickAddMaterial || undefined,
            thickness: quickAddThickness || undefined,
          });
          newItem = {
            id: result.id,
            code: result.packagingCode,
            name: result.packagingName,
            subType: result.packagingType,
          };
          setPackaging(prev => [...prev, newItem!]);
          break;
        }
      }

      if (newItem) {
        // Auto-select the newly created item
        const newAccessory: StyleAccessory = {
          accessoryType: quickAddType,
          masterId: newItem.id,
          masterCode: newItem.code,
          masterName: newItem.name,
          subType: newItem.subType,
        };
        onChange([...selectedAccessories, newAccessory]);
        notify.success(`${quickAddName} created and added`);
      }

      setQuickAddOpen(false);
    } catch (error) {
      console.error('Failed to create accessory:', error);
      notify.error('Failed to create item');
    } finally {
      setQuickAddSaving(false);
    }
  };

  // Get icon for accessory type
  const getAccessoryIcon = (accessoryType: AccessoryType): string => {
    return ACCESSORY_TABS.find(t => t.type === accessoryType)?.icon || '📦';
  };

  return (
    <div className="space-y-4">
      {/* Tabs for accessory types */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as AccessoryType); setSearchQuery(''); }}>
        <TabsList className="grid grid-cols-2 w-full max-w-md">
          {ACCESSORY_TABS.map(tab => (
            <TabsTrigger key={tab.type} value={tab.type} className="text-sm">
              <span className="mr-1">{tab.icon}</span>
              <span>{tab.label}</span>
              {getSelectedCount(tab.type) > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {getSelectedCount(tab.type)}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {ACCESSORY_TABS.map(tab => (
          <TabsContent key={tab.type} value={tab.type} className="mt-4">
            {/* Search and Add New */}
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder={`Search ${tab.label.toLowerCase()}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  disabled={disabled}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openQuickAdd}
                disabled={disabled}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add New
              </Button>
            </div>

            {/* Items list with checkboxes */}
            <div className="border rounded-lg max-h-64 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-gray-500">Loading...</div>
              ) : filteredItems.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  {searchQuery ? 'No matching items found' : `No ${tab.label.toLowerCase()} available`}
                </div>
              ) : (
                <div className="divide-y">
                  {filteredItems.map(item => {
                    const isFromPreset = presetItemIds?.has(item.id);
                    const selected = isSelected(tab.type, item.id);
                    return (
                      <label
                        key={item.id}
                        className={cn(
                          'flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors',
                          selected && !isFromPreset && 'bg-blue-50 hover:bg-blue-50',
                          selected && isFromPreset && 'bg-purple-50 hover:bg-purple-50',
                          disabled && 'cursor-not-allowed opacity-60'
                        )}
                      >
                        <Checkbox
                          checked={selected}
                          onCheckedChange={() => toggleItem(item)}
                          disabled={disabled}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-xs shrink-0">
                              {item.code}
                            </Badge>
                            <span className="font-medium text-sm truncate">{item.name}</span>
                            {selected && isFromPreset && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-purple-200 text-purple-700 rounded-full">
                                Preset
                              </span>
                            )}
                          </div>
                          {item.subType && (
                            <div className="mt-1">
                              <Badge variant="secondary" className="text-xs">
                                {item.subType}
                              </Badge>
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Selected count */}
            <div className="mt-2 text-sm text-gray-600">
              {getSelectedCount(tab.type)} {tab.label.toLowerCase()} selected
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Selected Accessories Summary */}
      {selectedAccessories.length > 0 && (
        <Card className="p-4">
          <h4 className="text-sm font-semibold mb-3">Selected Accessories ({selectedAccessories.length})</h4>
          <div className="flex flex-wrap gap-2">
            {selectedAccessories.map((accessory, index) => {
              const isFromPreset = presetItemIds?.has(accessory.masterId);
              return (
                <Badge
                  key={`${accessory.accessoryType}-${accessory.masterId}-${index}`}
                  variant="secondary"
                  className={cn(
                    "flex items-center gap-1 py-1 px-2",
                    isFromPreset && "bg-purple-100 border-purple-300"
                  )}
                >
                  <span>{getAccessoryIcon(accessory.accessoryType)}</span>
                  <span className="font-mono text-xs">{accessory.masterCode}</span>
                  <span className="text-xs">{accessory.masterName}</span>
                  {isFromPreset && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-purple-200 text-purple-700 rounded-full ml-1">
                      Preset
                    </span>
                  )}
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => removeAccessory(accessory)}
                      className="ml-1 hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              );
            })}
          </div>
        </Card>
      )}

      {/* Quick Add Modal - Type-specific forms */}
      <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Add New {quickAddType === 'LABEL' ? 'Label' : 'Packaging'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Common: Name field */}
            <div>
              <Label htmlFor="quickAddName">Name *</Label>
              <Input
                id="quickAddName"
                value={quickAddName}
                onChange={(e) => setQuickAddName(e.target.value)}
                placeholder={`Enter ${quickAddType.toLowerCase()} name`}
                autoFocus
              />
            </div>

            {/* LABEL-specific fields */}
            {quickAddType === 'LABEL' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="quickAddLabelType">Label Type</Label>
                    <select
                      id="quickAddLabelType"
                      value={quickAddLabelType}
                      onChange={(e) => setQuickAddLabelType(e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    >
                      <option value="">Select type...</option>
                      <option value="Care Label">Care Label</option>
                      <option value="Size Label">Size Label</option>
                      <option value="Woven">Woven</option>
                      <option value="Printed">Printed</option>
                      <option value="Hangtag">Hangtag</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="quickAddSize">Size</Label>
                    <Input
                      id="quickAddSize"
                      value={quickAddSize}
                      onChange={(e) => setQuickAddSize(e.target.value)}
                      placeholder="e.g., 2x3 inches"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="quickAddMaterial">Material</Label>
                    <Input
                      id="quickAddMaterial"
                      value={quickAddMaterial}
                      onChange={(e) => setQuickAddMaterial(e.target.value)}
                      placeholder="e.g., Polyester, Satin"
                    />
                  </div>
                  <div>
                    <Label htmlFor="quickAddPrintMethod">Print Method</Label>
                    <Input
                      id="quickAddPrintMethod"
                      value={quickAddPrintMethod}
                      onChange={(e) => setQuickAddPrintMethod(e.target.value)}
                      placeholder="e.g., Screen Print"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="quickAddColor">Color</Label>
                  <Input
                    id="quickAddColor"
                    value={quickAddColor}
                    onChange={(e) => setQuickAddColor(e.target.value)}
                    placeholder="e.g., White, Black"
                  />
                </div>
              </>
            )}

            {/* PACKAGING-specific fields */}
            {quickAddType === 'PACKAGING' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="quickAddPackagingType">Packaging Type</Label>
                    <select
                      id="quickAddPackagingType"
                      value={quickAddPackagingType}
                      onChange={(e) => setQuickAddPackagingType(e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    >
                      <option value="">Select type...</option>
                      <option value="Polybag">Polybag</option>
                      <option value="Carton">Carton</option>
                      <option value="Hanger">Hanger</option>
                      <option value="Tissue">Tissue</option>
                      <option value="Sticker">Sticker</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="quickAddSize">Size</Label>
                    <Input
                      id="quickAddSize"
                      value={quickAddSize}
                      onChange={(e) => setQuickAddSize(e.target.value)}
                      placeholder="e.g., 12x16 inches"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="quickAddMaterial">Material</Label>
                    <Input
                      id="quickAddMaterial"
                      value={quickAddMaterial}
                      onChange={(e) => setQuickAddMaterial(e.target.value)}
                      placeholder="e.g., LDPE, Cardboard"
                    />
                  </div>
                  <div>
                    <Label htmlFor="quickAddThickness">Thickness</Label>
                    <Input
                      id="quickAddThickness"
                      value={quickAddThickness}
                      onChange={(e) => setQuickAddThickness(e.target.value)}
                      placeholder="e.g., 40 microns, 3 ply"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Action buttons */}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setQuickAddOpen(false)}
                disabled={quickAddSaving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleQuickAddSave}
                disabled={quickAddSaving || !quickAddName.trim()}
              >
                {quickAddSaving ? 'Creating...' : 'Create & Add'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AccessorySelector;
