/**
 * MaterialBOMPicker Component
 *
 * A comprehensive modal picker for selecting materials to add to Style BOM.
 * Features:
 * - Tabbed interface for each material type (7 tabs)
 * - Search within each material type
 * - Material preview with specifications
 * - Quantity and usage category selection
 * - Stays open after adding - allows adding multiple materials without reopening
 * - Shows count of items added in current session
 * - Returns complete BOM entry data
 *
 * Used in: Style Form (Trims & Materials tab, Accessories tab)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Search, Package, Check, Plus, ShoppingBag, Scissors, Box } from 'lucide-react';
import type { MaterialType, MaterialUsageCategory, Material } from '../types/style-material-bom.types';
import { MaterialTypeLabels } from '../constants/style-material-bom.constants';
import { searchMaterials, formatPrice, parsePrice } from '../services/style-material-bom.service';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { cn } from '../lib/utils';

export interface MaterialBOMEntry {
  materialType: MaterialType;
  materialId: string;
  materialCode: string;
  materialName: string;
  quantityPerGarment: number;
  unit: string;
  unitPrice: number;
  usageCategory: MaterialUsageCategory;
  componentName?: string;
  specifications?: Record<string, string | number | boolean | null>;
}

interface MaterialBOMPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (entry: MaterialBOMEntry) => void;
  defaultUsageCategory?: MaterialUsageCategory;
  defaultComponentName?: string;
  /** Filter which material type tabs are shown. If not provided, shows all types. */
  allowedTypes?: MaterialType[];
}

const MATERIAL_TYPES: MaterialType[] = ['LACE', 'BUTTON', 'THREAD', 'ZIPPER', 'ELASTIC', 'LABEL', 'PACKAGING'];

const USAGE_CATEGORY_LABELS: Record<MaterialUsageCategory, string> = {
  GARMENT_TRIM: 'Garment Trim',
  VALUE_ADDITION: 'Value Addition',
  PACKAGING: 'Packaging',
};

const USAGE_CATEGORY_ICONS: Record<MaterialUsageCategory, React.ReactNode> = {
  GARMENT_TRIM: <Scissors className="h-4 w-4" />,
  VALUE_ADDITION: <ShoppingBag className="h-4 w-4" />,
  PACKAGING: <Box className="h-4 w-4" />,
};

export const MaterialBOMPicker: React.FC<MaterialBOMPickerProps> = ({
  isOpen,
  onClose,
  onSelect,
  defaultUsageCategory = 'GARMENT_TRIM',
  defaultComponentName = '',
  allowedTypes,
}) => {
  // Filter material types based on allowedTypes prop - memoized to prevent useEffect dependency issues
  const visibleTypes = useMemo(() => {
    return allowedTypes && allowedTypes.length > 0
      ? MATERIAL_TYPES.filter((t) => allowedTypes.includes(t))
      : MATERIAL_TYPES;
  }, [allowedTypes]);

  const [activeTab, setActiveTab] = useState<MaterialType>(visibleTypes[0] || 'LACE');
  const [searchQuery, setSearchQuery] = useState('');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);

  // Form state for selected material
  const [quantity, setQuantity] = useState<number>(1);
  const [usageCategory, setUsageCategory] = useState<MaterialUsageCategory>(defaultUsageCategory);
  const [componentName, setComponentName] = useState<string>(defaultComponentName);

  // Track items added in current session
  const [addedCount, setAddedCount] = useState(0);

  // Load materials when tab or search changes
  useEffect(() => {
    if (isOpen) {
      loadMaterials();
    }
  }, [activeTab, searchQuery, isOpen]);

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedMaterial(null);
      setQuantity(1);
      setUsageCategory(defaultUsageCategory);
      setComponentName(defaultComponentName);
      setAddedCount(0);
      // Reset to first visible type
      setActiveTab(visibleTypes[0] || 'LACE');
    }
  }, [isOpen, defaultUsageCategory, defaultComponentName, visibleTypes]);

  const loadMaterials = async () => {
    try {
      setIsLoading(true);
      const response = await searchMaterials(
        activeTab,
        searchQuery || undefined,
        50 // Load more materials for browsing
      );
      setMaterials(response.materials);
    } catch (error) {
      console.error('Failed to load materials:', error);
      setMaterials([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMaterialClick = (material: Material) => {
    setSelectedMaterial(material);
  };

  const handleAddMaterial = () => {
    if (!selectedMaterial) return;

    const price = parsePrice(selectedMaterial.pricePerUnit);

    const entry: MaterialBOMEntry = {
      materialType: activeTab,
      materialId: selectedMaterial.masterRecordId,
      materialCode: selectedMaterial.materialCode,
      materialName: selectedMaterial.materialName,
      quantityPerGarment: quantity,
      unit: selectedMaterial.unit,
      unitPrice: price,
      usageCategory,
      componentName: componentName || undefined,
      specifications: selectedMaterial.specifications as Record<string, string | number | boolean | null>,
    };

    onSelect(entry);

    // Stay open for adding more materials
    setAddedCount((prev) => prev + 1);
    setSelectedMaterial(null);
    setQuantity(1);
    setComponentName(defaultComponentName);
    // Keep usageCategory as user may want to add more of same category
  };

  const getSpecificationsSummary = (material: Material): string[] => {
    const specs = material.specifications;
    const parts: string[] = [];

    if (specs.size) parts.push(`Size: ${specs.size}`);
    if (specs.color) parts.push(`Color: ${specs.color}`);
    if (specs.width) parts.push(`Width: ${specs.width}`);
    if (specs.length) parts.push(`Length: ${specs.length}`);
    if (specs.holes) parts.push(`Holes: ${specs.holes}`);
    if (specs.threadCount) parts.push(`Thread: ${specs.threadCount}`);
    if (specs.teethType) parts.push(`Type: ${specs.teethType}`);
    if (specs.elasticType) parts.push(`Type: ${specs.elasticType}`);
    if (specs.labelType) parts.push(`Type: ${specs.labelType}`);
    if (specs.packagingType) parts.push(`Type: ${specs.packagingType}`);

    return parts;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Add Material to BOM
          </DialogTitle>
          <DialogDescription>Select material type, search, and configure quantity and usage</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex">
          {/* Left Panel: Material Selection */}
          <div className="w-2/3 border-r flex flex-col">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as MaterialType)}>
              <div className="px-4 pt-4 border-b">
                <TabsList
                  className="grid w-full h-auto"
                  style={{ gridTemplateColumns: `repeat(${visibleTypes.length}, minmax(0, 1fr))` }}
                >
                  {visibleTypes.map((type) => (
                    <TabsTrigger key={type} value={type} className="text-xs py-2 data-[state=active]:bg-blue-100">
                      {MaterialTypeLabels[type]}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              {/* Search Bar */}
              <div className="px-4 py-3 border-b bg-gray-50">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder={`Search ${MaterialTypeLabels[activeTab]}...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Material List */}
              {visibleTypes.map((type) => (
                <TabsContent key={type} value={type} className="flex-1 overflow-auto p-4 m-0">
                  {isLoading ? (
                    <div className="text-center py-12 text-gray-500">
                      <Package className="h-12 w-12 mx-auto mb-3 animate-pulse" />
                      <p>Loading materials...</p>
                    </div>
                  ) : materials.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p className="font-medium">No materials found</p>
                      {searchQuery && <p className="text-sm mt-1">Try a different search term</p>}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {materials.map((material) => (
                        <button
                          key={material.materialCode}
                          type="button"
                          onClick={() => handleMaterialClick(material)}
                          className={cn(
                            'w-full p-3 border rounded-lg text-left transition-all',
                            'hover:border-blue-400 hover:bg-blue-50',
                            selectedMaterial?.materialCode === material.materialCode
                              ? 'border-blue-500 bg-blue-50 shadow-sm'
                              : 'border-gray-200'
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-xs font-mono">
                                  {material.materialCode}
                                </Badge>
                                <span className="font-medium text-sm truncate">{material.materialName}</span>
                              </div>
                              <div className="text-xs text-gray-600 space-y-0.5">
                                {getSpecificationsSummary(material).map((spec, idx) => (
                                  <div key={idx}>{spec}</div>
                                ))}
                                {material.supplierName && (
                                  <div className="text-gray-500">Supplier: {material.supplierName}</div>
                                )}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="font-semibold text-sm text-blue-600">
                                {formatPrice(parsePrice(material.pricePerUnit))}
                              </div>
                              <div className="text-xs text-gray-500">per {material.unit}</div>
                            </div>
                          </div>
                          {selectedMaterial?.materialCode === material.materialCode && (
                            <div className="mt-2 pt-2 border-t flex items-center gap-1 text-blue-600 text-xs font-medium">
                              <Check className="h-3 w-3" />
                              Selected
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </div>

          {/* Right Panel: Configuration */}
          <div className="w-1/3 p-6 bg-gray-50 overflow-auto">
            {selectedMaterial ? (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-sm mb-2">Selected Material</h3>
                  <div className="p-3 bg-white rounded-lg border">
                    <Badge variant="secondary" className="text-xs mb-2">
                      {selectedMaterial.materialCode}
                    </Badge>
                    <p className="font-medium text-sm">{selectedMaterial.materialName}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {selectedMaterial.unit} · {formatPrice(parsePrice(selectedMaterial.pricePerUnit))}
                    </p>
                  </div>
                </div>

                <div>
                  <Label>Quantity per Garment *</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={quantity}
                    onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Total cost: {formatPrice(quantity * parsePrice(selectedMaterial.pricePerUnit))}
                  </p>
                </div>

                <div>
                  <Label>Usage Category *</Label>
                  <Select value={usageCategory} onValueChange={(v) => setUsageCategory(v as MaterialUsageCategory)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(USAGE_CATEGORY_LABELS) as MaterialUsageCategory[]).map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          <div className="flex items-center gap-2">
                            {USAGE_CATEGORY_ICONS[cat]}
                            {USAGE_CATEGORY_LABELS[cat]}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Component Name (Optional)</Label>
                  <Input
                    type="text"
                    value={componentName}
                    onChange={(e) => setComponentName(e.target.value)}
                    placeholder="e.g., Front Panel, Collar"
                  />
                  <p className="text-xs text-gray-500 mt-1">Specify which component uses this material</p>
                </div>

                <Button
                  type="button"
                  onClick={handleAddMaterial}
                  disabled={!selectedMaterial || quantity <= 0}
                  className="w-full mt-4"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add to BOM
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
                <Package className="h-16 w-16 mb-3" />
                <p className="text-sm font-medium">No material selected</p>
                <p className="text-xs mt-1 px-4">Select a material from the list to configure quantity and usage</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-gray-50">
          <div className="flex-1 text-sm text-gray-600">
            {addedCount > 0 && (
              <span className="text-green-600 font-medium">
                {addedCount} item{addedCount > 1 ? 's' : ''} added
              </span>
            )}
          </div>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MaterialBOMPicker;
// Export types for StyleFormRedesigned
