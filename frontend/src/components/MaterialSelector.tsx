// MaterialSelector Component - Phase 2
import React, { useState, useEffect } from 'react';
import { Package, Info } from 'lucide-react';
import type { MaterialType, Material } from '../types/style-material-bom.types';
import { MaterialTypeLabels } from '../constants/style-material-bom.constants';
import { searchMaterials, formatPrice, parsePrice } from '../services/style-material-bom.service';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';

interface MaterialSelectorProps {
  value?: Material | null;
  onChange: (material: Material | null) => void;
  materialTypes?: MaterialType[];
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export const MaterialSelector: React.FC<MaterialSelectorProps> = ({
  value,
  onChange,
  materialTypes = ['LACE', 'BUTTON', 'THREAD', 'ZIPPER', 'ELASTIC', 'LABEL', 'PACKAGING'],
  label = 'Select Material',
  required = false,
  disabled = false,
  className,
}) => {
  const [selectedType, setSelectedType] = useState<MaterialType | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load materials when type or search changes
  useEffect(() => {
    if (selectedType) {
      loadMaterials();
    } else {
      setMaterials([]);
    }
  }, [selectedType, searchQuery]);

  const loadMaterials = async () => {
    if (!selectedType) return;

    try {
      setIsLoading(true);
      setError(null);
      const response = await searchMaterials(selectedType as MaterialType, searchQuery || undefined, 20);
      setMaterials(response.materials);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load materials';
      setError(message);
      setMaterials([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTypeChange = (type: string) => {
    setSelectedType(type as MaterialType);
    setSearchQuery('');
    onChange(null); // Clear selection when type changes
  };

  const handleMaterialSelect = (material: Material) => {
    onChange(material);
  };

  const handleClear = () => {
    onChange(null);
    setSelectedType('');
    setSearchQuery('');
    setMaterials([]);
  };

  const getSpecificationsSummary = (material: Material): string => {
    const specs = material.specifications;
    const parts: string[] = [];

    if (specs.size) parts.push(specs.size);
    if (specs.color) parts.push(specs.color);
    if (specs.width) parts.push(`${specs.width} width`);
    if (specs.length) parts.push(`${specs.length} length`);
    if (specs.holes) parts.push(`${specs.holes} holes`);
    if (specs.threadCount) parts.push(specs.threadCount);
    if (specs.teethType) parts.push(specs.teethType);
    if (specs.elasticType) parts.push(specs.elasticType);
    if (specs.labelType) parts.push(specs.labelType);
    if (specs.packagingType) parts.push(specs.packagingType);

    return parts.slice(0, 3).join(', ') || 'No specifications';
  };

  return (
    <div className={cn('space-y-3', className)}>
      {/* Label */}
      {label && (
        <Label>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}

      {/* Selected Material Display */}
      {value && (
        <div className="flex items-center gap-2 p-3 border rounded-md bg-blue-50">
          <Package className="h-5 w-5 text-blue-600" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{value.materialCode}</Badge>
              <span className="font-medium">{value.materialName}</span>
            </div>
            <div className="text-sm text-gray-600 mt-1">{getSpecificationsSummary(value)}</div>
            <div className="text-sm font-semibold text-blue-600 mt-1">
              {formatPrice(parsePrice(value.pricePerUnit))} per {value.unit}
            </div>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={handleClear} disabled={disabled}>
            Change
          </Button>
        </div>
      )}

      {/* Material Selection UI */}
      {!value && (
        <div className="space-y-3">
          {/* Material Type Selector */}
          <div>
            <Label>Material Type</Label>
            <Select value={selectedType} onValueChange={handleTypeChange} disabled={disabled}>
              <SelectTrigger>
                <SelectValue placeholder="Select material type..." />
              </SelectTrigger>
              <SelectContent>
                {materialTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {MaterialTypeLabels[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Material Search/Selector */}
          {selectedType && (
            <div>
              <Label>Select {MaterialTypeLabels[selectedType as MaterialType]}</Label>
              <Select
                value=""
                onValueChange={(code) => {
                  const selected = materials.find((m) => m.materialCode === code);
                  if (selected) handleMaterialSelect(selected);
                }}
                disabled={disabled || !selectedType}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={`Select ${MaterialTypeLabels[selectedType as MaterialType]}...`} />
                </SelectTrigger>
                <SelectContent>
                  {isLoading ? (
                    <div className="p-2 text-center text-sm text-gray-500">Loading materials...</div>
                  ) : materials.length === 0 ? (
                    <div className="p-2 text-center text-sm text-gray-500">No materials found</div>
                  ) : (
                    materials.map((material) => (
                      <SelectItem key={material.materialCode} value={material.materialCode}>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {material.materialCode}
                          </Badge>
                          <span>{material.materialName}</span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>

              {/* Helper text */}
              <div className="flex items-start gap-1 mt-1.5">
                <Info className="h-3.5 w-3.5 text-gray-400 mt-0.5" />
                <p className="text-xs text-gray-500">
                  Select material type first, then choose from available materials
                </p>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">{error}</div>}
        </div>
      )}
    </div>
  );
};

export default MaterialSelector;
