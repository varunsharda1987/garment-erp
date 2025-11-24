// MaterialSelector Component - Phase 2
import React, { useState, useEffect } from 'react';
import { Search, Package, Info } from 'lucide-react';
import {
  MaterialType,
  Material,
  MaterialTypeLabels
} from '../types/style-material-bom.types';
import { searchMaterials, formatPrice, parsePrice } from '../services/style-material-bom.service';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from './ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';
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
  className
}) => {
  const [selectedType, setSelectedType] = useState<MaterialType | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
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
      const response = await searchMaterials(
        selectedType as MaterialType,
        searchQuery || undefined,
        20
      );
      setMaterials(response.materials);
    } catch (err: any) {
      setError(err.message || 'Failed to load materials');
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
    setIsOpen(false);
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
            <div className="text-sm text-gray-600 mt-1">
              {getSpecificationsSummary(value)}
            </div>
            <div className="text-sm font-semibold text-blue-600 mt-1">
              {formatPrice(parsePrice(value.pricePerUnit))} per {value.unit}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={disabled}
          >
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
            <Select
              value={selectedType}
              onValueChange={handleTypeChange}
              disabled={disabled}
            >
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
              <Label>Search {MaterialTypeLabels[selectedType as MaterialType]}</Label>
              <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={isOpen}
                    className="w-full justify-between"
                    disabled={disabled || !selectedType}
                  >
                    <span className="flex items-center gap-2">
                      <Search className="h-4 w-4" />
                      {value
                        ? `${value.materialCode} - ${value.materialName}`
                        : `Search ${MaterialTypeLabels[selectedType as MaterialType]}...`}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[500px] p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder={`Search by name, code, or color...`}
                      value={searchQuery}
                      onValueChange={setSearchQuery}
                    />
                    <CommandEmpty>
                      {isLoading ? 'Loading materials...' : 'No materials found.'}
                    </CommandEmpty>
                    <CommandGroup className="max-h-64 overflow-auto">
                      {materials.map((material) => (
                        <CommandItem
                          key={material.materialCode}
                          value={material.materialCode}
                          onSelect={() => handleMaterialSelect(material)}
                          className="cursor-pointer"
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs">
                                  {material.materialCode}
                                </Badge>
                                <span className="font-medium">{material.materialName}</span>
                              </div>
                              <div className="text-sm text-gray-600 mt-1">
                                {getSpecificationsSummary(material)}
                              </div>
                              {material.supplierName && (
                                <div className="text-xs text-gray-500 mt-0.5">
                                  Supplier: {material.supplierName}
                                </div>
                              )}
                            </div>
                            <div className="text-sm font-semibold text-blue-600 ml-4">
                              {formatPrice(parsePrice(material.pricePerUnit))}
                              <div className="text-xs text-gray-500">per {material.unit}</div>
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>

              {/* Helper text */}
              <div className="flex items-start gap-1 mt-1.5">
                <Info className="h-3.5 w-3.5 text-gray-400 mt-0.5" />
                <p className="text-xs text-gray-500">
                  Select material type first, then search by name, code, or specifications
                </p>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MaterialSelector;
