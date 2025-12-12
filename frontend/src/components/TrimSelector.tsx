/**
 * TrimSelector Component
 *
 * A multi-select component for selecting trims (Buttons, Thread, Zipper, Elastic, Lace, Label)
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
import { Search, Plus, X, Circle } from 'lucide-react';
import { cn } from '../lib/utils';
import { notify } from '../lib/notify';

// Services
import { getAllButtons, createButton } from '../services/button.service';
import { getAllThreads, createThread } from '../services/thread.service';
import { getAllZippers, createZipper } from '../services/zipper.service';
import { getAllElastics, createElastic } from '../services/elastic.service';
import { getAllLace, createLace } from '../services/lace.service';
import { getAllLabels, createLabel } from '../services/label.service';

// Types
import type { Button as ButtonType } from '../types/button.types';
import type { Thread } from '../types/thread.types';
import type { Zipper } from '../types/zipper.types';
import type { Elastic } from '../types/elastic.types';
import type { Lace } from '../types/lace.types';
import type { Label as LabelType } from '../types/label.types';

// Trim type definition
export type TrimType = 'BUTTON' | 'THREAD' | 'ZIPPER' | 'ELASTIC' | 'LACE' | 'LABEL';

export interface StyleTrim {
  trimType: TrimType;
  masterId: string;
  masterCode: string;
  masterName: string;
  color?: string | null;
}

// Generic trim item for internal use
interface TrimItem {
  id: string;
  code: string;
  name: string;
  color?: string | null;
  description?: string | null;
}

interface TrimSelectorProps {
  selectedTrims: StyleTrim[];
  onChange: (trims: StyleTrim[]) => void;
  disabled?: boolean;
}

const TRIM_TABS: { type: TrimType; label: string; icon: string }[] = [
  { type: 'BUTTON', label: 'Buttons', icon: '🔘' },
  { type: 'THREAD', label: 'Thread', icon: '🧵' },
  { type: 'ZIPPER', label: 'Zipper', icon: '🔗' },
  { type: 'ELASTIC', label: 'Elastic', icon: '〰️' },
  { type: 'LACE', label: 'Lace', icon: '🎀' },
  { type: 'LABEL', label: 'Label', icon: '🏷️' },
];

export function TrimSelector({ selectedTrims, onChange, disabled = false }: TrimSelectorProps) {
  const [activeTab, setActiveTab] = useState<TrimType>('BUTTON');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Data for each trim type
  const [buttons, setButtons] = useState<TrimItem[]>([]);
  const [threads, setThreads] = useState<TrimItem[]>([]);
  const [zippers, setZippers] = useState<TrimItem[]>([]);
  const [elastics, setElastics] = useState<TrimItem[]>([]);
  const [laces, setLaces] = useState<TrimItem[]>([]);
  const [labels, setLabels] = useState<TrimItem[]>([]);

  // Quick add modal - common fields
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddType, setQuickAddType] = useState<TrimType>('BUTTON');
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddColor, setQuickAddColor] = useState('');
  const [quickAddSaving, setQuickAddSaving] = useState(false);

  // Quick add modal - type-specific fields
  // Button fields
  const [quickAddSize, setQuickAddSize] = useState('');
  const [quickAddHoles, setQuickAddHoles] = useState<number | ''>('');
  const [quickAddMaterial, setQuickAddMaterial] = useState('');
  const [quickAddShape, setQuickAddShape] = useState('');
  // Thread fields
  const [quickAddBrand, setQuickAddBrand] = useState('');
  const [quickAddPackagingType, setQuickAddPackagingType] = useState<'CONE' | 'TUBE' | ''>('');
  const [quickAddMetersPerUnit, setQuickAddMetersPerUnit] = useState<number | ''>('');
  // Zipper fields
  const [quickAddLength, setQuickAddLength] = useState<number | ''>('');
  const [quickAddTeethType, setQuickAddTeethType] = useState('');
  const [quickAddSliderType, setQuickAddSliderType] = useState('');
  // Elastic fields
  const [quickAddWidth, setQuickAddWidth] = useState<number | ''>('');
  const [quickAddComposition, setQuickAddComposition] = useState('');
  const [quickAddElasticType, setQuickAddElasticType] = useState('');
  // Lace fields
  const [quickAddLaceType, setQuickAddLaceType] = useState('');
  const [quickAddDesign, setQuickAddDesign] = useState('');
  // Label fields
  const [quickAddLabelType, setQuickAddLabelType] = useState('');
  const [quickAddPrintMethod, setQuickAddPrintMethod] = useState('');

  // Load data for each trim type
  useEffect(() => {
    loadAllTrims();
  }, []);

  const loadAllTrims = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadButtons(),
        loadThreads(),
        loadZippers(),
        loadElastics(),
        loadLaces(),
        loadLabels(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadButtons = async () => {
    try {
      const response = await getAllButtons({ limit: 500 });
      setButtons(response.data.map((b: ButtonType) => ({
        id: b.id,
        code: b.buttonCode,
        name: b.buttonName,
        color: b.color,
        description: b.description,
      })));
    } catch (error) {
      console.error('Failed to load buttons:', error);
    }
  };

  const loadThreads = async () => {
    try {
      const response = await getAllThreads({ limit: 500 });
      setThreads(response.data.map((t: Thread) => ({
        id: t.id,
        code: t.threadCode,
        name: t.threadName,
        color: t.color,
        description: t.description,
      })));
    } catch (error) {
      console.error('Failed to load threads:', error);
    }
  };

  const loadZippers = async () => {
    try {
      const response = await getAllZippers({ limit: 500 });
      setZippers(response.data.map((z: Zipper) => ({
        id: z.id,
        code: z.zipperCode,
        name: z.zipperName,
        color: z.color,
        description: z.description,
      })));
    } catch (error) {
      console.error('Failed to load zippers:', error);
    }
  };

  const loadElastics = async () => {
    try {
      const response = await getAllElastics({ limit: 500 });
      setElastics(response.data.map((e: Elastic) => ({
        id: e.id,
        code: e.elasticCode,
        name: e.elasticName,
        color: e.color,
        description: e.description,
      })));
    } catch (error) {
      console.error('Failed to load elastics:', error);
    }
  };

  const loadLaces = async () => {
    try {
      const response = await getAllLace({ limit: 500 });
      setLaces(response.data.map((l: Lace) => ({
        id: l.id,
        code: l.laceCode,
        name: l.laceName,
        color: l.color,
        description: l.description,
      })));
    } catch (error) {
      console.error('Failed to load laces:', error);
    }
  };

  const loadLabels = async () => {
    try {
      const response = await getAllLabels({ limit: 500 });
      setLabels(response.data.map((l: LabelType) => ({
        id: l.id,
        code: l.labelCode,
        name: l.labelName,
        color: l.color,
        description: l.description,
      })));
    } catch (error) {
      console.error('Failed to load labels:', error);
    }
  };

  // Get items for current tab
  const getCurrentItems = (): TrimItem[] => {
    switch (activeTab) {
      case 'BUTTON': return buttons;
      case 'THREAD': return threads;
      case 'ZIPPER': return zippers;
      case 'ELASTIC': return elastics;
      case 'LACE': return laces;
      case 'LABEL': return labels;
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
      item.color?.toLowerCase().includes(query)
    );
  }, [activeTab, searchQuery, buttons, threads, zippers, elastics, laces, labels]);

  // Check if item is selected
  const isSelected = (trimType: TrimType, masterId: string): boolean => {
    return selectedTrims.some(t => t.trimType === trimType && t.masterId === masterId);
  };

  // Toggle item selection
  const toggleItem = (item: TrimItem) => {
    if (disabled) return;

    const trimType = activeTab;
    const existingIndex = selectedTrims.findIndex(
      t => t.trimType === trimType && t.masterId === item.id
    );

    if (existingIndex >= 0) {
      // Remove
      const newTrims = [...selectedTrims];
      newTrims.splice(existingIndex, 1);
      onChange(newTrims);
    } else {
      // Add
      const newTrim: StyleTrim = {
        trimType,
        masterId: item.id,
        masterCode: item.code,
        masterName: item.name,
        color: item.color,
      };
      onChange([...selectedTrims, newTrim]);
    }
  };

  // Remove a selected trim
  const removeTrim = (trim: StyleTrim) => {
    if (disabled) return;
    onChange(selectedTrims.filter(t => !(t.trimType === trim.trimType && t.masterId === trim.masterId)));
  };

  // Get count of selected items for a tab
  const getSelectedCount = (trimType: TrimType): number => {
    return selectedTrims.filter(t => t.trimType === trimType).length;
  };

  // Open quick add modal - reset all fields
  const openQuickAdd = () => {
    setQuickAddType(activeTab);
    // Common fields
    setQuickAddName('');
    setQuickAddColor('');
    // Button fields
    setQuickAddSize('');
    setQuickAddHoles('');
    setQuickAddMaterial('');
    setQuickAddShape('');
    // Thread fields
    setQuickAddBrand('');
    setQuickAddPackagingType('');
    setQuickAddMetersPerUnit('');
    // Zipper fields
    setQuickAddLength('');
    setQuickAddTeethType('');
    setQuickAddSliderType('');
    // Elastic fields
    setQuickAddWidth('');
    setQuickAddComposition('');
    setQuickAddElasticType('');
    // Lace fields
    setQuickAddLaceType('');
    setQuickAddDesign('');
    // Label fields
    setQuickAddLabelType('');
    setQuickAddPrintMethod('');
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
      let newItem: TrimItem | null = null;

      switch (quickAddType) {
        case 'BUTTON': {
          const result = await createButton({
            buttonName: quickAddName,
            color: quickAddColor || undefined,
            size: quickAddSize || undefined,
            holes: quickAddHoles ? Number(quickAddHoles) : undefined,
            material: quickAddMaterial || undefined,
            shape: quickAddShape || undefined,
          });
          newItem = {
            id: result.id,
            code: result.buttonCode,
            name: result.buttonName,
            color: result.color,
          };
          setButtons(prev => [...prev, newItem!]);
          break;
        }
        case 'THREAD': {
          const result = await createThread({
            threadName: quickAddName,
            color: quickAddColor || undefined,
            brand: quickAddBrand || undefined,
            packagingType: quickAddPackagingType || undefined,
            metersPerUnit: quickAddMetersPerUnit ? Number(quickAddMetersPerUnit) : undefined,
          });
          newItem = {
            id: result.id,
            code: result.threadCode,
            name: result.threadName,
            color: result.color,
          };
          setThreads(prev => [...prev, newItem!]);
          break;
        }
        case 'ZIPPER': {
          const result = await createZipper({
            zipperName: quickAddName,
            color: quickAddColor || undefined,
            length: quickAddLength ? Number(quickAddLength) : undefined,
            teethType: quickAddTeethType || undefined,
            brand: quickAddBrand || undefined,
            sliderType: quickAddSliderType || undefined,
          });
          newItem = {
            id: result.id,
            code: result.zipperCode,
            name: result.zipperName,
            color: result.color,
          };
          setZippers(prev => [...prev, newItem!]);
          break;
        }
        case 'ELASTIC': {
          const result = await createElastic({
            elasticName: quickAddName,
            color: quickAddColor || undefined,
            width: quickAddWidth ? Number(quickAddWidth) : undefined,
            composition: quickAddComposition || undefined,
            elasticType: quickAddElasticType || undefined,
          });
          newItem = {
            id: result.id,
            code: result.elasticCode,
            name: result.elasticName,
            color: result.color,
          };
          setElastics(prev => [...prev, newItem!]);
          break;
        }
        case 'LACE': {
          const result = await createLace({
            laceName: quickAddName,
            color: quickAddColor || undefined,
            laceType: quickAddLaceType || undefined,
            width: quickAddWidth ? Number(quickAddWidth) : undefined,
            composition: quickAddComposition || undefined,
            design: quickAddDesign || undefined,
          });
          newItem = {
            id: result.id,
            code: result.laceCode,
            name: result.laceName,
            color: result.color,
          };
          setLaces(prev => [...prev, newItem!]);
          break;
        }
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
            color: result.color,
          };
          setLabels(prev => [...prev, newItem!]);
          break;
        }
      }

      if (newItem) {
        // Auto-select the newly created item
        const newTrim: StyleTrim = {
          trimType: quickAddType,
          masterId: newItem.id,
          masterCode: newItem.code,
          masterName: newItem.name,
          color: newItem.color,
        };
        onChange([...selectedTrims, newTrim]);
        notify.success(`${quickAddName} created and added`);
      }

      setQuickAddOpen(false);
    } catch (error) {
      console.error('Failed to create trim:', error);
      notify.error('Failed to create item');
    } finally {
      setQuickAddSaving(false);
    }
  };

  // Get icon for trim type
  const getTrimIcon = (trimType: TrimType): string => {
    return TRIM_TABS.find(t => t.type === trimType)?.icon || '📦';
  };

  return (
    <div className="space-y-4">
      {/* Tabs for trim types */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as TrimType); setSearchQuery(''); }}>
        <TabsList className="grid grid-cols-6 w-full">
          {TRIM_TABS.map(tab => (
            <TabsTrigger key={tab.type} value={tab.type} className="text-xs sm:text-sm">
              <span className="mr-1">{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
              {getSelectedCount(tab.type) > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {getSelectedCount(tab.type)}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {TRIM_TABS.map(tab => (
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
                  {filteredItems.map(item => (
                    <label
                      key={item.id}
                      className={cn(
                        'flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors',
                        isSelected(tab.type, item.id) && 'bg-blue-50 hover:bg-blue-50',
                        disabled && 'cursor-not-allowed opacity-60'
                      )}
                    >
                      <Checkbox
                        checked={isSelected(tab.type, item.id)}
                        onCheckedChange={() => toggleItem(item)}
                        disabled={disabled}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-xs shrink-0">
                            {item.code}
                          </Badge>
                          <span className="font-medium text-sm truncate">{item.name}</span>
                        </div>
                        {item.color && (
                          <div className="flex items-center gap-1 mt-1">
                            <Circle
                              className="h-3 w-3"
                              style={{ fill: item.color, stroke: item.color }}
                            />
                            <span className="text-xs text-gray-500">{item.color}</span>
                          </div>
                        )}
                      </div>
                    </label>
                  ))}
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

      {/* Selected Trims Summary */}
      {selectedTrims.length > 0 && (
        <Card className="p-4">
          <h4 className="text-sm font-semibold mb-3">Selected Trims ({selectedTrims.length})</h4>
          <div className="flex flex-wrap gap-2">
            {selectedTrims.map((trim, index) => (
              <Badge
                key={`${trim.trimType}-${trim.masterId}-${index}`}
                variant="secondary"
                className="flex items-center gap-1 py-1 px-2"
              >
                <span>{getTrimIcon(trim.trimType)}</span>
                <span className="font-mono text-xs">{trim.masterCode}</span>
                <span className="text-xs">{trim.masterName}</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => removeTrim(trim)}
                    className="ml-1 hover:text-red-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Quick Add Modal - Type-specific forms */}
      <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Add New {TRIM_TABS.find(t => t.type === quickAddType)?.label.slice(0, -1) || 'Item'}
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

            {/* Common: Color field */}
            <div>
              <Label htmlFor="quickAddColor">Color</Label>
              <Input
                id="quickAddColor"
                value={quickAddColor}
                onChange={(e) => setQuickAddColor(e.target.value)}
                placeholder="e.g., White, Black, Red"
              />
            </div>

            {/* BUTTON-specific fields */}
            {quickAddType === 'BUTTON' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="quickAddSize">Size</Label>
                    <Input
                      id="quickAddSize"
                      value={quickAddSize}
                      onChange={(e) => setQuickAddSize(e.target.value)}
                      placeholder="e.g., 15mm, 18L"
                    />
                  </div>
                  <div>
                    <Label htmlFor="quickAddHoles">Holes</Label>
                    <Input
                      id="quickAddHoles"
                      type="number"
                      value={quickAddHoles}
                      onChange={(e) => setQuickAddHoles(e.target.value ? Number(e.target.value) : '')}
                      placeholder="e.g., 2, 4"
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
                      placeholder="e.g., Plastic, Metal"
                    />
                  </div>
                  <div>
                    <Label htmlFor="quickAddShape">Shape</Label>
                    <Input
                      id="quickAddShape"
                      value={quickAddShape}
                      onChange={(e) => setQuickAddShape(e.target.value)}
                      placeholder="e.g., Round, Square"
                    />
                  </div>
                </div>
              </>
            )}

            {/* THREAD-specific fields */}
            {quickAddType === 'THREAD' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="quickAddBrand">Brand</Label>
                    <Input
                      id="quickAddBrand"
                      value={quickAddBrand}
			onChange={(e) => setQuickAddBrand(e.target.value)}
                      placeholder="e.g., Coats, Aster"
                    />
                  </div>
                  <div>
                    <Label htmlFor="quickAddPackagingType">Packaging Type</Label>
                    <select
                      id="quickAddPackagingType"
                      value={quickAddPackagingType}
                      onChange={(e) => setQuickAddPackagingType(e.target.value as 'CONE' | 'TUBE' | '')}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    >
                      <option value="">Select...</option>
                      <option value="CONE">Cone</option>
                      <option value="TUBE">Tube</option>
                    </select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="quickAddMetersPerUnit">Meters Per Unit</Label>
                  <Input
                    id="quickAddMetersPerUnit"
                    type="number"
                    value={quickAddMetersPerUnit}
                    onChange={(e) => setQuickAddMetersPerUnit(e.target.value ? Number(e.target.value) : '')}
                    placeholder="e.g., 5000, 1000"
                  />
                </div>
              </>
            )}

            {/* ZIPPER-specific fields */}
            {quickAddType === 'ZIPPER' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="quickAddLength">Length (inches)</Label>
                    <Input
                      id="quickAddLength"
                      type="number"
                      step="0.1"
                      value={quickAddLength}
                      onChange={(e) => setQuickAddLength(e.target.value ? Number(e.target.value) : '')}
                      placeholder="e.g., 7.0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="quickAddBrand">Brand</Label>
                    <Input
                      id="quickAddBrand"
                      value={quickAddBrand}
                      onChange={(e) => setQuickAddBrand(e.target.value)}
                      placeholder="e.g., YKK, SBS"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="quickAddTeethType">Teeth Type</Label>
                    <Input
                      id="quickAddTeethType"
                      value={quickAddTeethType}
                      onChange={(e) => setQuickAddTeethType(e.target.value)}
                      placeholder="e.g., Metal, Nylon"
                    />
                  </div>
                  <div>
                    <Label htmlFor="quickAddSliderType">Slider Type</Label>
                    <Input
                      id="quickAddSliderType"
                      value={quickAddSliderType}
                      onChange={(e) => setQuickAddSliderType(e.target.value)}
                      placeholder="e.g., Auto-lock"
                    />
                  </div>
                </div>
              </>
            )}

            {/* ELASTIC-specific fields */}
            {quickAddType === 'ELASTIC' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="quickAddWidth">Width (mm)</Label>
                    <Input
                      id="quickAddWidth"
                      type="number"
                      step="0.1"
                      value={quickAddWidth}
                      onChange={(e) => setQuickAddWidth(e.target.value ? Number(e.target.value) : '')}
                      placeholder="e.g., 25.0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="quickAddElasticType">Elastic Type</Label>
                    <Input
                      id="quickAddElasticType"
                      value={quickAddElasticType}
                      onChange={(e) => setQuickAddElasticType(e.target.value)}
                      placeholder="e.g., Woven, Knitted"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="quickAddComposition">Composition</Label>
                  <Input
                    id="quickAddComposition"
                    value={quickAddComposition}
                    onChange={(e) => setQuickAddComposition(e.target.value)}
                    placeholder="e.g., 80% Polyester 20% Spandex"
                  />
                </div>
              </>
            )}

            {/* LACE-specific fields */}
            {quickAddType === 'LACE' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="quickAddLaceType">Lace Type</Label>
                    <Input
                      id="quickAddLaceType"
                      value={quickAddLaceType}
                      onChange={(e) => setQuickAddLaceType(e.target.value)}
                      placeholder="e.g., Guipure, Chantilly"
                    />
                  </div>
                  <div>
                    <Label htmlFor="quickAddWidth">Width (inches)</Label>
                    <Input
                      id="quickAddWidth"
                      type="number"
                      step="0.1"
                      value={quickAddWidth}
                      onChange={(e) => setQuickAddWidth(e.target.value ? Number(e.target.value) : '')}
                      placeholder="e.g., 2.0"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="quickAddComposition">Composition</Label>
                    <Input
                      id="quickAddComposition"
                      value={quickAddComposition}
                      onChange={(e) => setQuickAddComposition(e.target.value)}
                      placeholder="e.g., 100% Polyester"
                    />
                  </div>
                  <div>
                    <Label htmlFor="quickAddDesign">Design</Label>
                    <Input
                      id="quickAddDesign"
                      value={quickAddDesign}
                      onChange={(e) => setQuickAddDesign(e.target.value)}
                      placeholder="e.g., Floral, Geometric"
                    />
                  </div>
                </div>
              </>
            )}

            {/* LABEL-specific fields */}
            {quickAddType === 'LABEL' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="quickAddLabelType">Label Type</Label>
                    <Input
                      id="quickAddLabelType"
                      value={quickAddLabelType}
                      onChange={(e) => setQuickAddLabelType(e.target.value)}
                      placeholder="e.g., Care Label, Size Label"
                    />
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

export default TrimSelector;
