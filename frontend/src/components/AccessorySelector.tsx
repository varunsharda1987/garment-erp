/**
 * AccessorySelector Component
 *
 * A multi-select component for selecting accessories (Labels, Packaging)
 * with tabbed interface and inline "Add New" capability.
 */

import { useState, useEffect, useMemo } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Search, Plus, X } from 'lucide-react';
import { cn } from '../lib/utils';
import MaterialQuickAddDialog from './MaterialQuickAddDialog';
import type { CreatedMaterial } from '../types/material-quick-add.types';

// Services
import { getAllLabels } from '../services/label.service';
import { getAllPackaging } from '../services/packaging.service';

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
  /** Customer ID to filter accessories by (shows customer-specific + generic) */
  customerId?: string;
  /** IDs of accessories that came from a customer preset (for visual distinction) */
  presetItemIds?: Set<string>;
  /** IDs of accessories that were manually added for this specific style (for visual distinction) */
  styleSpecificIds?: Set<string>;
}

const ACCESSORY_TABS: { type: AccessoryType; label: string; icon: string }[] = [
  { type: 'LABEL', label: 'Labels', icon: '🏷️' },
  { type: 'PACKAGING', label: 'Packaging', icon: '📦' },
];

export function AccessorySelector({
  selectedAccessories,
  onChange,
  disabled = false,
  customerId,
  presetItemIds,
  styleSpecificIds,
}: AccessorySelectorProps) {
  const [activeTab, setActiveTab] = useState<AccessoryType>('LABEL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Browse modal state - only load and show all items when user wants to add more
  const [browseModalOpen, setBrowseModalOpen] = useState(false);

  // Data for each accessory type
  const [labels, setLabels] = useState<AccessoryItem[]>([]);
  const [packaging, setPackaging] = useState<AccessoryItem[]>([]);

  // Quick add modal
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  // Load data for each accessory type - only when browse modal is opened
  useEffect(() => {
    if (browseModalOpen) {
      loadAllAccessories();
    }
  }, [browseModalOpen, customerId]);

  const loadAllAccessories = async () => {
    setLoading(true);
    try {
      await Promise.all([loadLabels(), loadPackaging()]);
    } finally {
      setLoading(false);
    }
  };

  const loadLabels = async () => {
    try {
      // Load hangtags and price tags for accessories (not sewn-in labels which are in TrimSelector)
      // We need to make two calls and combine results
      // If customerId is provided, filter by customer (backend will return customer-specific + generic)
      const [hangtagResponse, priceTagResponse] = await Promise.all([
        getAllLabels({ limit: 100, labelCategory: 'HANGTAG', customerId }),
        getAllLabels({ limit: 100, labelCategory: 'PRICE_TAG', customerId }),
      ]);

      const allLabels = [...hangtagResponse.data, ...priceTagResponse.data];
      setLabels(
        allLabels.map((l: LabelType) => ({
          id: l.id,
          code: l.labelCode,
          name: l.labelName,
          subType: l.labelType,
          description: l.description,
        }))
      );
    } catch (error) {
      console.error('Failed to load labels:', error);
    }
  };

  const loadPackaging = async () => {
    try {
      // If customerId is provided, filter by customer (backend will return customer-specific + generic)
      const response = await getAllPackaging({ limit: 100, customerId });
      setPackaging(
        response.data.map((p: Packaging) => ({
          id: p.id,
          code: p.packagingCode,
          name: p.packagingName,
          subType: p.packagingType,
          description: p.description,
        }))
      );
    } catch (error) {
      console.error('Failed to load packaging:', error);
    }
  };

  // Get items for current tab
  const getCurrentItems = (): AccessoryItem[] => {
    switch (activeTab) {
      case 'LABEL':
        return labels;
      case 'PACKAGING':
        return packaging;
      default:
        return [];
    }
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
  const isSelected = (accessoryType: AccessoryType, masterId: string): boolean => {
    return selectedAccessories.some((a) => a.accessoryType === accessoryType && a.masterId === masterId);
  };

  // Toggle item selection
  const toggleItem = (item: AccessoryItem) => {
    if (disabled) return;

    const accessoryType = activeTab;
    const existingIndex = selectedAccessories.findIndex(
      (a) => a.accessoryType === accessoryType && a.masterId === item.id
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
    onChange(
      selectedAccessories.filter(
        (a) => !(a.accessoryType === accessory.accessoryType && a.masterId === accessory.masterId)
      )
    );
  };

  // Get count of selected items for a tab
  const getSelectedCount = (accessoryType: AccessoryType): number => {
    return selectedAccessories.filter((a) => a.accessoryType === accessoryType).length;
  };

  // Handle material created from quick add dialog
  const handleMaterialCreated = (newMaterial: CreatedMaterial) => {
    // Update local state so item appears in browse list
    const accessoryItem = {
      id: newMaterial.id,
      code: newMaterial.code,
      name: newMaterial.name,
      subType: (newMaterial['labelType'] as string | null) || (newMaterial['packagingType'] as string | null) || null,
      description: null,
    };

    // Update the appropriate state based on active tab
    if (activeTab === 'LABEL') {
      setLabels((prev) => [...prev, accessoryItem]);
    } else if (activeTab === 'PACKAGING') {
      setPackaging((prev) => [...prev, accessoryItem]);
    }

    // Auto-select the newly created item
    const newAccessory: StyleAccessory = {
      accessoryType: activeTab,
      masterId: newMaterial.id,
      masterCode: newMaterial.code,
      masterName: newMaterial.name,
      subType: accessoryItem.subType,
    };
    onChange([...selectedAccessories, newAccessory]);
  };

  return (
    <div className="space-y-4">
      {/* Show selected accessories grouped by type */}
      {ACCESSORY_TABS.map((tab) => {
        const tabAccessories = selectedAccessories.filter((a) => a.accessoryType === tab.type);
        if (tabAccessories.length === 0) return null;

        return (
          <div key={tab.type} className="space-y-2">
            <div className="flex items-center gap-2">
              <span>{tab.icon}</span>
              <h4 className="text-sm font-semibold">{tab.label}</h4>
              <Badge variant="secondary" className="text-xs">
                {tabAccessories.length}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {tabAccessories.map((accessory, index) => {
                const isFromPreset = presetItemIds?.has(accessory.masterId);
                const isStyleSpecific =
                  styleSpecificIds?.has(accessory.masterId) ||
                  (!isFromPreset && presetItemIds && presetItemIds.size > 0);
                return (
                  <Badge
                    key={`${accessory.accessoryType}-${accessory.masterId}-${index}`}
                    variant="secondary"
                    className={cn(
                      'flex items-center gap-1.5 py-1.5 px-2.5',
                      isFromPreset && 'bg-purple-100 border-purple-300',
                      isStyleSpecific && !isFromPreset && 'bg-blue-100 border-blue-300'
                    )}
                  >
                    <span className="font-mono text-xs">{accessory.masterCode}</span>
                    <span className="text-xs">{accessory.masterName}</span>
                    {accessory.subType && <span className="text-[10px] text-gray-500">({accessory.subType})</span>}
                    {isFromPreset && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-purple-200 text-purple-700 rounded-full">
                        Preset
                      </span>
                    )}
                    {isStyleSpecific && !isFromPreset && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-blue-200 text-blue-700 rounded-full">Added</span>
                    )}
                    {!disabled && (
                      <button
                        type="button"
                        onClick={() => removeAccessory(accessory)}
                        className="ml-1 hover:text-red-500 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </Badge>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Empty state */}
      {selectedAccessories.length === 0 && (
        <div className="text-center py-6 text-gray-500 border border-dashed rounded-lg">
          <p className="text-sm">No accessories selected for this style.</p>
          <p className="text-xs mt-1">Click "Browse & Add" to add labels and packaging.</p>
        </div>
      )}

      {/* Browse & Add button */}
      <Button
        type="button"
        variant="outline"
        onClick={() => setBrowseModalOpen(true)}
        disabled={disabled}
        className="w-full"
      >
        <Search className="h-4 w-4 mr-2" />
        Browse & Add Accessories
      </Button>

      {/* Browse Modal - Shows all available items */}
      <Dialog open={browseModalOpen} onOpenChange={setBrowseModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle>Browse & Add Accessories</DialogTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => setQuickAddOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create New
            </Button>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <Tabs
              value={activeTab}
              onValueChange={(v) => {
                setActiveTab(v as AccessoryType);
                setSearchQuery('');
              }}
              className="h-full flex flex-col"
            >
              <TabsList className="grid grid-cols-2 w-full">
                {ACCESSORY_TABS.map((tab) => (
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

              {ACCESSORY_TABS.map((tab) => (
                <TabsContent key={tab.type} value={tab.type} className="flex-1 flex flex-col mt-4 overflow-hidden">
                  {/* Search */}
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder={`Search ${tab.label.toLowerCase()}...`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  {/* Items list with checkboxes */}
                  <div className="border rounded-lg flex-1 overflow-y-auto max-h-[400px]">
                    {loading ? (
                      <div className="p-4 text-center text-gray-500">Loading...</div>
                    ) : filteredItems.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">
                        {searchQuery ? 'No matching items found' : `No ${tab.label.toLowerCase()} available`}
                      </div>
                    ) : (
                      <div className="divide-y">
                        {filteredItems.map((item) => {
                          const selected = isSelected(tab.type, item.id);
                          const isFromPreset = presetItemIds?.has(item.id);
                          const isStyleSpecific =
                            styleSpecificIds?.has(item.id) ||
                            (selected && !isFromPreset && presetItemIds && presetItemIds.size > 0);
                          return (
                            <label
                              key={item.id}
                              className={cn(
                                'flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors',
                                selected && isStyleSpecific && 'bg-blue-50 hover:bg-blue-100',
                                selected && isFromPreset && 'bg-purple-50 hover:bg-purple-100'
                              )}
                            >
                              <Checkbox checked={selected} onCheckedChange={() => toggleItem(item)} />
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
                                  {selected && isStyleSpecific && !isFromPreset && (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-200 text-blue-700 rounded-full">
                                      Selected
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
          </div>
          <div className="flex justify-end pt-4 border-t">
            <Button type="button" onClick={() => setBrowseModalOpen(false)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Material Quick Add Dialog */}
      <MaterialQuickAddDialog
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        materialDomain="ACCESSORY"
        onMaterialCreated={handleMaterialCreated}
        initialType={activeTab}
      />
    </div>
  );
}

export default AccessorySelector;
