import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { createBOM, getBOMById, updateBOM } from '../services/bom.service';
import { getAllMaterials } from '../services/material.service';
import { styleService } from '../services/style.service';
import { Unit } from '../types/bom.types';
import type { CreateBOMInput, CreateBOMItemInput } from '../types/bom.types';
import type { Material } from '../types/material.types';
import type { Style, CadAverage } from '../types/style.types';
import { logError } from '../lib/logger';

export default function BOMForm() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const styleIdFromQuery = searchParams.get('styleId');
  const navigate = useNavigate();

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data from API
  const [materials, setMaterials] = useState<Material[]>([]);
  const [allStyles, setAllStyles] = useState<Style[]>([]);

  // Form state
  const [selectedBuyer, setSelectedBuyer] = useState<string>('');
  const [selectedStyle, setSelectedStyle] = useState<Style | null>(null);
  const [styleId, setStyleId] = useState<string>(styleIdFromQuery || '');
  const [bomItems, setBomItems] = useState<CreateBOMItemInput[]>([{
    materialId: '',
    quantityPerUnit: 0,
    unit: Unit.METER,
    wastagePercent: 0,
    costPerUnit: 0,
    notes: '',
  }]);

  // Fabric CAD options (for width selection)
  const [fabricCadOptions, setFabricCadOptions] = useState<Map<string, any>>(new Map());
  const [selectedWidths, setSelectedWidths] = useState<Map<number, number>>(new Map());

  const isEditMode = !!id;

  // Derived state: filter styles by buyer (computed, not stored)
  const filteredStyles = useMemo(() => {
    if (!selectedBuyer) return allStyles;
    return allStyles.filter(style => style.customerName === selectedBuyer);
  }, [selectedBuyer, allStyles]);

  // Derived state: unique buyer names
  const buyers = useMemo(() => {
    return Array.from(
      new Set(
        allStyles
          .map(style => style.customerName)
          .filter((name): name is string => !!name && name.trim().length > 0)
      )
    ).sort();
  }, [allStyles]);

  // Load materials and styles
  useEffect(() => {
    const loadData = async () => {
      try {
        const [materialsResponse, stylesResponse] = await Promise.all([
          getAllMaterials({ page: 1, limit: 1000 }),
          styleService.getAllStyles(1, 1000),
        ]);

        setMaterials(materialsResponse.data);
        setAllStyles(stylesResponse.data);
      } catch (err) {
        logError('Failed to load data:', err);
      }
    };
    loadData();
  }, []);

  // Load style and auto-populate BOM items if styleId is provided
  useEffect(() => {
    const loadStyle = async () => {
      if (styleId && !isEditMode) {
        try {
          const style = await styleService.getStyleById(styleId);
          setSelectedStyle(style);

          // Set buyer if style has one
          if (style.customerName) {
            setSelectedBuyer(style.customerName);
          }

          // Auto-populate BOM items from style components
          const autoPopulatedItems: CreateBOMItemInput[] = [];

          // Store CAD options map
          const cadOptionsMap = new Map<string, any>();

          // Track selected widths for each item
          const initialSelectedWidths = new Map<number, number>();

          // Add fabrics from components
          if (style.components && style.components.length > 0) {
            style.components.forEach(component => {
              if (component.fabrics && component.fabrics.length > 0) {
                component.fabrics.forEach(fabric => {
                  // Find material by fabric name
                  const material = materials.find(m =>
                    m.name.toLowerCase().includes(fabric.fabricName.toLowerCase()) ||
                    fabric.fabricName.toLowerCase().includes(m.name.toLowerCase())
                  );

                  if (material) {
                    // Store CAD options for this material
                    if (fabric.cadAverages && fabric.cadAverages.length > 0) {
                      cadOptionsMap.set(material.id, {
                        fabricName: fabric.fabricName,
                        cadAverages: fabric.cadAverages,
                        componentName: component.componentName,
                        fabricType: fabric.fabricType,
                      });
                    }

                    // Get CAD average - prefer the preferred width, otherwise use first available or fallback
                    let cadValue = 1;
                    let cadUnit = Unit.METER;
                    let wastagePercent = 5;
                    let widthNote = '';
                    let selectedWidth = 0;

                    if (fabric.cadAverages && fabric.cadAverages.length > 0) {
                      // Find preferred CAD or use first one
                      const preferredCad = fabric.cadAverages.find((cad: CadAverage) => cad.isPreferred) || fabric.cadAverages[0];
                      cadValue = preferredCad.cadAverageMeters || preferredCad.cadAverageYards || 1;
                      cadUnit = preferredCad.cadAverageMeters ? Unit.METER : Unit.YARD;
                      wastagePercent = preferredCad.cadWastagePercent || 5;
                      selectedWidth = preferredCad.fabricWidth;
                      widthNote = ` (${preferredCad.fabricWidth}" width)`;
                    } else if (fabric.cadAverageMeters || fabric.cadAverageYards) {
                      // Fallback to old CAD fields for backward compatibility
                      cadValue = fabric.cadAverageMeters || fabric.cadAverageYards || 1;
                      cadUnit = fabric.cadAverageMeters ? Unit.METER : Unit.YARD;
                    }

                    // Track the index and selected width
                    const itemIndex = autoPopulatedItems.length;
                    if (selectedWidth > 0) {
                      initialSelectedWidths.set(itemIndex, selectedWidth);
                    }

                    autoPopulatedItems.push({
                      materialId: material.id,
                      quantityPerUnit: cadValue,
                      unit: cadUnit,
                      wastagePercent: wastagePercent,
                      costPerUnit: Number(material.costPrice),
                      notes: `${component.componentName} - ${fabric.fabricType || 'Fabric'}${widthNote}`,
                    });
                  }
                });
              }

              // Add accessories from components
              if (component.accessories && component.accessories.length > 0) {
                component.accessories.forEach(accessory => {
                  const material = materials.find(m =>
                    m.name.toLowerCase().includes(accessory.accessoryName.toLowerCase()) ||
                    accessory.accessoryName.toLowerCase().includes(m.name.toLowerCase())
                  );

                  if (material) {
                    autoPopulatedItems.push({
                      materialId: material.id,
                      quantityPerUnit: Number(accessory.quantityPerPiece) || 1,
                      unit: (accessory.unit as Unit) || Unit.PIECE,
                      wastagePercent: 2, // Default 2% wastage for accessories
                      costPerUnit: Number(material.costPrice),
                      notes: `${component.componentName} - ${accessory.accessoryType || 'Accessory'}`,
                    });
                  }
                });
              }
            });
          }

          // Add garment trims
          if (style.garmentTrims && style.garmentTrims.length > 0) {
            style.garmentTrims.forEach(trim => {
              const material = materials.find(m =>
                m.name.toLowerCase().includes(trim.trimName.toLowerCase()) ||
                trim.trimName.toLowerCase().includes(m.name.toLowerCase())
              );

              if (material) {
                // Normalize unit - convert common variations to enum values
                let normalizedUnit: Unit = Unit.PIECE;
                if (trim.unit) {
                  const unitUpper = trim.unit.toUpperCase();
                  if (unitUpper === 'PCS' || unitUpper === 'PIECE' || unitUpper === 'PIECES') {
                    normalizedUnit = Unit.PIECE;
                  } else if (unitUpper === 'M' || unitUpper === 'METER' || unitUpper === 'METERS') {
                    normalizedUnit = Unit.METER;
                  } else if (unitUpper === 'YARD' || unitUpper === 'YARDS') {
                    normalizedUnit = Unit.YARD;
                  } else if (unitUpper === 'KG' || unitUpper === 'KILOGRAM' || unitUpper === 'KILOGRAMS') {
                    normalizedUnit = Unit.KILOGRAM;
                  } else if (unitUpper === 'SET' || unitUpper === 'SETS') {
                    normalizedUnit = Unit.SET;
                  } else if (unitUpper === 'DOZEN' || unitUpper === 'DOZ' || unitUpper === 'DZ') {
                    normalizedUnit = Unit.DOZEN;
                  }
                }

                autoPopulatedItems.push({
                  materialId: material.id,
                  quantityPerUnit: Number(trim.quantityPerPiece) || 1,
                  unit: normalizedUnit,
                  wastagePercent: 2, // Default 2% wastage for trims
                  costPerUnit: Number(material.costPrice),
                  notes: `Garment Trim - ${trim.trimType}`,
                });
              }
            });
          }

          // Set CAD options map and selected widths
          setFabricCadOptions(cadOptionsMap);
          setSelectedWidths(initialSelectedWidths);

          // Set BOM items if we found any matches
          if (autoPopulatedItems.length > 0) {
            setBomItems(autoPopulatedItems);
          } else {
            // Keep one empty row if no matches found
            setBomItems([{
              materialId: '',
              quantityPerUnit: 0,
              unit: Unit.METER,
              wastagePercent: 0,
              costPerUnit: 0,
              notes: '',
            }]);
          }
        } catch (err) {
          logError('Failed to load style:', err);
        }
      }
    };
    loadStyle();
  }, [styleId, materials, isEditMode]);

  // Load existing BOM for edit mode
  useEffect(() => {
    if (id && isEditMode) {
      const loadBOM = async () => {
        try {
          const bom = await getBOMById(id);
          setStyleId(bom.styleId);
          setBomItems(bom.bomItems.map(item => ({
            materialId: item.materialId,
            quantityPerUnit: item.quantityPerUnit,
            unit: item.unit,
            wastagePercent: item.wastagePercent,
            costPerUnit: item.costPerUnit,
            notes: item.notes || '',
          })));
        } catch (err: unknown) {
          setError(err.response?.data?.message || 'Failed to load BOM');
        }
      };
      loadBOM();
    }
  }, [id, isEditMode]);

  const handleAddItem = () => {
    setBomItems([...bomItems, {
      materialId: '',
      quantityPerUnit: 0,
      unit: Unit.METER,
      wastagePercent: 0,
      costPerUnit: 0,
      notes: '',
    }]);
  };

  const handleRemoveItem = (index: number) => {
    if (bomItems.length > 1) {
      setBomItems(bomItems.filter((_, i) => i !== index));
    }
  };

  const handleItemChange = (index: number, field: keyof CreateBOMItemInput, value: CreateBOMItemInput[keyof CreateBOMItemInput]) => {
    const updatedItems = [...bomItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };

    // Auto-fill cost from material if material is selected
    if (field === 'materialId' && value) {
      const selectedMaterial = materials.find(m => m.id === value);
      if (selectedMaterial) {
        updatedItems[index].costPerUnit = Number(selectedMaterial.costPrice);
        updatedItems[index].unit = selectedMaterial.unit as Unit;
      }
    }

    setBomItems(updatedItems);
  };

  const handleWidthChange = (index: number, width: number) => {
    const item = bomItems[index];
    const cadOptions = fabricCadOptions.get(item.materialId);

    if (!cadOptions || !cadOptions.cadAverages) return;

    // Find the CAD average for this width
    const selectedCad = cadOptions.cadAverages.find((cad: CadAverage) => cad.fabricWidth === width);

    if (selectedCad) {
      const updatedItems = [...bomItems];
      const cadValue = selectedCad.cadAverageMeters || selectedCad.cadAverageYards || 1;
      const cadUnit = selectedCad.cadAverageMeters ? Unit.METER : Unit.YARD;
      const wastagePercent = selectedCad.cadWastagePercent || 5;

      updatedItems[index] = {
        ...updatedItems[index],
        quantityPerUnit: cadValue,
        unit: cadUnit,
        wastagePercent: wastagePercent,
        notes: `${cadOptions.componentName} - ${cadOptions.fabricType || 'Fabric'} (${width}" width)`,
      };

      setBomItems(updatedItems);

      // Update selected width tracking
      const newSelectedWidths = new Map(selectedWidths);
      newSelectedWidths.set(index, width);
      setSelectedWidths(newSelectedWidths);
    }
  };

  const calculateTotalCost = () => {
    return bomItems.reduce((total, item) => {
      const effectiveQty = item.quantityPerUnit * (1 + (item.wastagePercent || 0) / 100);
      return total + (effectiveQty * item.costPerUnit);
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!styleId) {
      setError('Please select a style');
      return;
    }

    if (bomItems.some(item => !item.materialId || item.quantityPerUnit <= 0)) {
      setError('Please fill in all required fields for BOM items');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data: CreateBOMInput = {
        styleId,
        bomItems: bomItems.map(item => ({
          ...item,
          wastagePercent: item.wastagePercent || 0,
        })),
      };

      if (isEditMode && id) {
        await updateBOM(id, { bomItems: data.bomItems });
      } else {
        await createBOM(data);
      }

      navigate('/bom');
    } catch (err: unknown) {
      logError('Error saving BOM:', err);
      logError('Response data:', err.response?.data);

      // Display validation errors if available
      if (err.response?.data?.details) {
        const validationErrors = err.response.data.details
          .map((d: { path: string[]; message: string }) => `${d.path.join('.')}: ${d.message}`)
          .join(', ');
        setError(`Validation error: ${validationErrors}`);
      } else {
        setError(err.response?.data?.error || err.response?.data?.message || 'Failed to save BOM');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <Card>
        <CardHeader>
          <CardTitle>{isEditMode ? 'Edit Bill of Materials' : 'Create Bill of Materials'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {/* Customer/Buyer Selection */}
            <div className="space-y-2">
              <Label htmlFor="buyerFilter">Customer/Buyer (Filter)</Label>
              <Select
                value={selectedBuyer || 'ALL_CUSTOMERS'}
                onValueChange={(value) => {
                  setSelectedBuyer(value === 'ALL_CUSTOMERS' ? '' : value);
                  setStyleId('');
                  setSelectedStyle(null);
                }}
                disabled={isEditMode}
              >
                <SelectTrigger id="buyerFilter">
                  <SelectValue placeholder="All customers (optional filter)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL_CUSTOMERS">All Customers</SelectItem>
                  {buyers.map((buyer) => (
                    <SelectItem key={buyer} value={buyer}>
                      {buyer}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedBuyer && (
                <p className="text-xs text-gray-600">
                  Showing {filteredStyles.length} style(s) for {selectedBuyer}
                </p>
              )}
            </div>

            {/* Style Selection */}
            <div className="space-y-2">
              <Label htmlFor="styleId">Style *</Label>
              <Select
                value={styleId}
                onValueChange={(value) => {
                  setStyleId(value);
                  const style = allStyles.find(s => s.id === value);
                  setSelectedStyle(style || null);
                }}
                disabled={isEditMode}
              >
                <SelectTrigger id="styleId">
                  <SelectValue placeholder="Select a style" />
                </SelectTrigger>
                <SelectContent>
                  {filteredStyles.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      {selectedBuyer
                        ? `No styles found for ${selectedBuyer}`
                        : 'No styles available'}
                    </div>
                  ) : (
                    filteredStyles.map((style) => (
                      <SelectItem key={style.id} value={style.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{style.styleCode}</span>
                          <span className="text-xs text-gray-600">
                            {style.styleName}
                            {style.customerName && ` - ${style.customerName}`}
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {selectedStyle && (
                <div className="mt-2 p-3 bg-blue-50 rounded border border-blue-200">
                  <div className="font-medium text-blue-900">{selectedStyle.styleCode}</div>
                  <div className="text-sm text-blue-700">{selectedStyle.styleName}</div>
                  {selectedStyle.customerName && (
                    <div className="text-xs text-blue-600 mt-1">
                      Customer: {selectedStyle.customerName}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* BOM Items */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-lg font-semibold">Materials</Label>
                  {selectedStyle && bomItems.length > 0 && bomItems[0].materialId && (
                    <p className="text-xs text-green-600 mt-1">
                      ✓ Auto-populated {bomItems.length} material(s) from style
                    </p>
                  )}
                </div>
                <Button type="button" onClick={handleAddItem} variant="outline" size="sm">
                  + Add Material
                </Button>
              </div>

              <div className="space-y-4">
                {bomItems.map((item, index) => (
                  <Card key={index} className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {/* Material Selection */}
                      <div className="lg:col-span-2">
                        <Label htmlFor={`material-${index}`}>Material *</Label>
                        <Select
                          value={item.materialId}
                          onValueChange={(value: string) => handleItemChange(index, 'materialId', value)}
                        >
                          <SelectTrigger id={`material-${index}`}>
                            <SelectValue placeholder="Select material" />
                          </SelectTrigger>
                          <SelectContent>
                            {materials.map((material) => (
                              <SelectItem key={material.id} value={material.id}>
                                {material.code} - {material.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Fabric Width Selection (if multiple CAD widths available) */}
                      {item.materialId && fabricCadOptions.has(item.materialId) && (
                        <div className="lg:col-span-1">
                          <Label htmlFor={`width-${index}`}>Fabric Width</Label>
                          <Select
                            value={selectedWidths.get(index)?.toString() || ''}
                            onValueChange={(value: string) => handleWidthChange(index, parseFloat(value))}
                          >
                            <SelectTrigger id={`width-${index}`} className="bg-amber-50 border-amber-300">
                              <SelectValue placeholder="Select width" />
                            </SelectTrigger>
                            <SelectContent>
                              {fabricCadOptions.get(item.materialId)?.cadAverages?.map((cad: CadAverage) => (
                                <SelectItem key={cad.fabricWidth} value={cad.fabricWidth.toString()}>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{cad.fabricWidth}"</span>
                                    <span className="text-xs text-gray-600">
                                      ({cad.cadAverageMeters ? `${cad.cadAverageMeters}m` : `${cad.cadAverageYards}y`})
                                    </span>
                                    {cad.isPreferred && (
                                      <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Preferred</span>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-amber-700 mt-1">
                            Choose width to update CAD and wastage
                          </p>
                        </div>
                      )}

                      {/* Quantity Per Unit */}
                      <div>
                        <Label htmlFor={`quantity-${index}`}>Quantity/Unit *</Label>
                        <Input
                          id={`quantity-${index}`}
                          type="number"
                          step="0.001"
                          min="0"
                          value={item.quantityPerUnit || ''}
                          onChange={(e) => handleItemChange(index, 'quantityPerUnit', parseFloat(e.target.value) || 0)}
                          required
                        />
                      </div>

                      {/* Unit */}
                      <div>
                        <Label htmlFor={`unit-${index}`}>Unit *</Label>
                        <Select
                          value={item.unit}
                          onValueChange={(value: string) => handleItemChange(index, 'unit', value as Unit)}
                        >
                          <SelectTrigger id={`unit-${index}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.values(Unit).map((unit) => (
                              <SelectItem key={unit} value={unit}>
                                {unit}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Wastage Percent */}
                      <div>
                        <Label htmlFor={`wastage-${index}`}>Wastage %</Label>
                        <Input
                          id={`wastage-${index}`}
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={item.wastagePercent || ''}
                          onChange={(e) => handleItemChange(index, 'wastagePercent', parseFloat(e.target.value) || 0)}
                        />
                      </div>

                      {/* Cost Per Unit */}
                      <div>
                        <Label htmlFor={`cost-${index}`}>Cost/Unit *</Label>
                        <Input
                          id={`cost-${index}`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.costPerUnit || ''}
                          onChange={(e) => handleItemChange(index, 'costPerUnit', parseFloat(e.target.value) || 0)}
                          required
                        />
                      </div>

                      {/* Notes */}
                      <div className="lg:col-span-2">
                        <Label htmlFor={`notes-${index}`}>Notes</Label>
                        <Textarea
                          id={`notes-${index}`}
                          value={item.notes || ''}
                          onChange={(e) => handleItemChange(index, 'notes', e.target.value)}
                          rows={2}
                          placeholder="Optional notes about this material"
                        />
                      </div>

                      {/* Remove Button */}
                      <div className="flex items-end">
                        <Button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          variant="destructive"
                          size="sm"
                          disabled={bomItems.length === 1}
                          className="w-full"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>

                    {/* Item Cost Summary */}
                    <div className="mt-3 pt-3 border-t text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Base Cost:</span>
                        <span>₹{(item.quantityPerUnit * item.costPerUnit).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">With Wastage ({item.wastagePercent || 0}%):</span>
                        <span className="font-medium">
                          ₹{(item.quantityPerUnit * (1 + (item.wastagePercent || 0) / 100) * item.costPerUnit).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Total Cost Summary */}
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-6">
                <div className="flex justify-between items-center text-lg font-semibold">
                  <span>Total Material Cost Per Piece:</span>
                  <span className="text-2xl text-blue-600">₹{calculateTotalCost().toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Form Actions */}
            <div className="flex gap-4 justify-end pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/bom')}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : isEditMode ? 'Update BOM' : 'Create BOM'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
