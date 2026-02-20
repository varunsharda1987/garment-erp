import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { StyleCodeMultiSelect } from '@/components/StyleCodeMultiSelect';
import { LookupSelect } from '@/components/LookupSelect';
import ColorPicker from '@/components/ColorPicker';
import { createLace, getLaceById, updateLace, getGreigeLace } from '@/services/lace.service';
import { getAllSuppliers } from '@/services/supplier.service';
import type { LaceFormData, LaceSupplierInput, Lace } from '@/types/lace.types';
import type { Supplier } from '@/types/supplier.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { Plus, Trash2 } from 'lucide-react';

interface LaceFormProps {
  mode?: 'create' | 'edit';
}

export default function LaceForm({ mode = 'create' }: LaceFormProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableSuppliers, setAvailableSuppliers] = useState<Supplier[]>([]);
  const [laceCode, setLaceCode] = useState<string>('');
  const [selectedStyleCodes, setSelectedStyleCodes] = useState<string[]>([]);
  const [selectedColorId, setSelectedColorId] = useState<string | null>(null);
  const [laceType, setLaceType] = useState<string>('');
  const [suppliers, setSuppliers] = useState<LaceSupplierInput[]>([]);
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);
  const [originalLaceName, setOriginalLaceName] = useState<string>('');

  // Greige lace state
  const [isGreige, setIsGreige] = useState<boolean>(false);
  const [greigeLaces, setGreigeLaces] = useState<Lace[]>([]);
  const [sourceGreigeLaceId, setSourceGreigeLaceId] = useState<string>('');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LaceFormData>();

  const isNewLace = mode === 'create' || !id;

  // Load available suppliers (filtered by LACE_SUPPLIER category)
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const response = await getAllSuppliers({ limit: 100, category: 'LACE_SUPPLIER' });
        setAvailableSuppliers(response.data);
      } catch (err) {
        console.error('Failed to fetch suppliers:', err);
      }
    };
    fetchSuppliers();
  }, []);

  // Load greige laces for dropdown (when creating finished lace)
  useEffect(() => {
    const fetchGreigeLaces = async () => {
      try {
        const response = await getGreigeLace({ limit: 100 });
        setGreigeLaces(response.data);
      } catch (err) {
        console.error('Failed to fetch greige laces:', err);
      }
    };
    fetchGreigeLaces();
  }, []);

  // Load lace data for edit mode
  useEffect(() => {
    if (!isNewLace && id) {
      const fetchLace = async () => {
        try {
          setIsLoading(true);
          const lace = await getLaceById(id);

          setLaceCode(lace.laceCode);
          setValue('laceName', lace.laceName);
          setOriginalLaceName(lace.laceName); // Store original for comparison
          setValue('supplierCode', lace.supplierCode || '');
          setValue('buyerCode', lace.buyerCode || '');
          setValue('width', lace.width?.toString() || '');
          setValue('design', lace.design || '');
          setValue('color', lace.color || '');
          setValue('composition', lace.composition || '');
          setValue('description', lace.description || '');

          // Set lace type
          if (lace.laceType) {
            setLaceType(lace.laceType);
          }

          // Set greige fields
          setIsGreige(lace.isGreige || false);
          if (lace.expectedShrinkagePercent) {
            setValue('expectedShrinkagePercent', lace.expectedShrinkagePercent.toString());
          }
          if (lace.costPerMeterGreige) {
            setValue('costPerMeterGreige', lace.costPerMeterGreige.toString());
          }
          if (lace.sourceGreigeLaceId) {
            setSourceGreigeLaceId(lace.sourceGreigeLaceId);
          }

          // Set suppliers from junction table
          if (lace.laceSuppliers && lace.laceSuppliers.length > 0) {
            setSuppliers(lace.laceSuppliers.map(s => ({
              supplierId: s.supplierId,
              isPreferred: s.isPreferred,
              isActive: s.isActive,
              notes: s.notes || '',
              pricePerMeter: s.pricePerMeter?.toString() || '',
            })));
          }

          // Set style codes
          if (lace.styleCodes && lace.styleCodes.length > 0) {
            setSelectedStyleCodes(lace.styleCodes);
          }
        } catch (err: unknown) {
          const errorMessage = handleApiError(err, 'Failed to load lace', false);
          setError(errorMessage);
        } finally {
          setIsLoading(false);
        }
      };
      fetchLace();
    }
  }, [id, isNewLace, setValue]);

  // Supplier management functions
  const handleAddSupplier = () => {
    setSuppliers(prev => [...prev, {
      supplierId: '',
      isPreferred: prev.length === 0, // First supplier is preferred by default
      isActive: true,
      notes: '',
      pricePerMeter: '',
    }]);
  };

  const handleRemoveSupplier = (index: number) => {
    setSuppliers(prev => prev.filter((_, i) => i !== index));
  };

  const handleSupplierChange = (index: number, field: keyof LaceSupplierInput, value: string | boolean) => {
    setSuppliers(prev => prev.map((s, i) =>
      i === index ? { ...s, [field]: value } : s
    ));
  };

  const onSubmit = async (data: LaceFormData) => {
    try {
      setIsLoading(true);
      setError(null);

      // Validate suppliers have valid supplier IDs
      const validSuppliers = suppliers.filter(s => s.supplierId);

      // If name wasn't manually edited (or is same as original), send empty to trigger auto-regeneration
      // This ensures the name updates when attributes change
      const shouldAutoGenerateName = !isNewLace && !nameManuallyEdited && data.laceName === originalLaceName;

      const payload: LaceFormData = {
        ...data,
        laceName: shouldAutoGenerateName ? '' : data.laceName, // Empty triggers regeneration
        laceType: laceType || undefined,
        width: data.width ? Number(data.width) : undefined,
        styleCodes: selectedStyleCodes,
        suppliers: validSuppliers,
        // Greige fields
        isGreige,
        expectedShrinkagePercent: isGreige && data.expectedShrinkagePercent
          ? Number(data.expectedShrinkagePercent)
          : undefined,
        costPerMeterGreige: isGreige && data.costPerMeterGreige
          ? Number(data.costPerMeterGreige)
          : undefined,
        sourceGreigeLaceId: !isGreige && sourceGreigeLaceId ? sourceGreigeLaceId : undefined,
        // Clear color for greige lace (greige has no color)
        color: isGreige ? undefined : data.color,
      };

      if (isNewLace) {
        await createLace(payload);
        handleApiSuccess('Lace created', 'Lace item has been successfully created.');
      } else if (id) {
        await updateLace(id, payload);
        handleApiSuccess('Lace updated', 'Lace item has been successfully updated.');
      }

      navigate('/materials/lace');
    } catch (err: unknown) {
      const errorMessage = handleApiError(
        err,
        `Failed to ${isNewLace ? 'create' : 'update'} lace`,
        false
      );
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !isNewLace) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Loading lace...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>{isNewLace ? 'Create New Lace' : 'Edit Lace'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-md">
                {error}
              </div>
            )}

            {/* LACE INFORMATION */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Lace Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Lace Code - Auto-generated */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                    Lace Code
                    {isNewLace && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Auto-generated</span>
                    )}
                  </label>
                  {!isNewLace && laceCode ? (
                    <div className="mt-2">
                      <Badge variant="secondary" className="font-mono text-sm">
                        {laceCode}
                      </Badge>
                      <p className="text-xs text-gray-500 mt-1">
                        This code is automatically generated and cannot be changed
                      </p>
                    </div>
                  ) : (
                    <>
                      <Input
                        id="laceCode"
                        value=""
                        readOnly
                        placeholder="Will be auto-generated (e.g., LACE-000001)"
                        className="bg-gray-50 cursor-not-allowed"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Code will be automatically assigned upon creation
                      </p>
                    </>
                  )}
                </div>

                {/* Lace Nature Toggle (Ready-to-Use vs Raw/Greige) */}
                <div className="md:col-span-2">
                  <Label className="mb-3 block">Lace Nature</Label>
                  <div className="flex gap-4">
                    <label className={`flex items-center gap-2 px-4 py-3 border rounded-lg cursor-pointer transition-colors ${
                      !isGreige ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:bg-gray-50'
                    }`}>
                      <input
                        type="radio"
                        name="laceNature"
                        checked={!isGreige}
                        onChange={() => setIsGreige(false)}
                        className="h-4 w-4 text-blue-600"
                      />
                      <div>
                        <span className="font-medium">Ready-to-Use (Finished)</span>
                        <p className="text-xs text-gray-500">Colored lace ready for production</p>
                      </div>
                    </label>
                    <label className={`flex items-center gap-2 px-4 py-3 border rounded-lg cursor-pointer transition-colors ${
                      isGreige ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 hover:bg-gray-50'
                    }`}>
                      <input
                        type="radio"
                        name="laceNature"
                        checked={isGreige}
                        onChange={() => setIsGreige(true)}
                        className="h-4 w-4 text-amber-600"
                      />
                      <div>
                        <span className="font-medium">Raw/Greige</span>
                        <p className="text-xs text-gray-500">Uncolored lace that needs dyeing</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Lace Name */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                    Lace Name
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Auto-generated</span>
                  </label>
                  <Input
                    id="laceName"
                    {...register('laceName', {
                      onChange: (e) => {
                        // Mark as manually edited if user types something different
                        if (e.target.value !== originalLaceName) {
                          setNameManuallyEdited(true);
                        }
                      }
                    })}
                    placeholder="Leave empty to auto-generate from color, design, composition, etc."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {isNewLace
                      ? 'If left empty, name will be auto-generated from attributes (e.g., "[Buyer-Code] Color Design Composition Lace Width")'
                      : 'Name will auto-update when you change attributes. Edit manually to override.'
                    }
                  </p>
                </div>

                {/* Lace Type - Using LookupSelect */}
                <div>
                  <LookupSelect
                    category="LACE_TYPE"
                    value={laceType}
                    onChange={setLaceType}
                    label="Lace Type"
                    placeholder="Select lace type..."
                    allowAdd={true}
                  />
                </div>

                {/* Width */}
                <div>
                  <Label htmlFor="width">Width (inches)</Label>
                  <Input
                    id="width"
                    type="number"
                    step="0.01"
                    {...register('width')}
                    placeholder="e.g., 2.0"
                  />
                </div>

                {/* Color - Only show for finished lace */}
                {!isGreige && (
                  <div>
                    <Label>Color</Label>
                    <ColorPicker
                      value={selectedColorId}
                      onChange={(colorId, color) => {
                        setSelectedColorId(colorId);
                        if (color) {
                          setValue('color', color.colorName);
                        } else {
                          setValue('color', '');
                        }
                      }}
                      showFamilyFilter={true}
                      placeholder="Select color from master..."
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Select from Color Master or{' '}
                      <a href="/colors/new" target="_blank" className="text-blue-600 hover:underline">
                        add a new color
                      </a>
                    </p>
                  </div>
                )}

                {/* Greige-specific fields */}
                {isGreige && (
                  <>
                    <div>
                      <Label htmlFor="expectedShrinkagePercent">Expected Shrinkage (%)</Label>
                      <Input
                        id="expectedShrinkagePercent"
                        type="number"
                        step="0.1"
                        {...register('expectedShrinkagePercent')}
                        placeholder="e.g., 5"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Shrinkage during dyeing process (typically 3-8%)
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="costPerMeterGreige">Greige Cost (per meter)</Label>
                      <Input
                        id="costPerMeterGreige"
                        type="number"
                        step="0.01"
                        {...register('costPerMeterGreige')}
                        placeholder="e.g., 18.50"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Raw lace cost before processing
                      </p>
                    </div>
                  </>
                )}

                {/* Source Greige Lace - Only for finished lace */}
                {!isGreige && greigeLaces.length > 0 && (
                  <div>
                    <Label>Source Greige Lace (Optional)</Label>
                    <Select
                      value={sourceGreigeLaceId || undefined}
                      onValueChange={(val) => setSourceGreigeLaceId(val === '__none__' ? '' : val)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Link to source greige lace..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {greigeLaces.map(gl => (
                          <SelectItem key={gl.id} value={gl.id}>
                            {gl.laceCode} - {gl.laceName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500 mt-1">
                      Link to the greige lace this was dyed from (for traceability)
                    </p>
                  </div>
                )}

                {/* Composition */}
                <div>
                  <Label htmlFor="composition">Composition</Label>
                  <Input
                    id="composition"
                    {...register('composition')}
                    placeholder="e.g., 100% Polyester, Nylon Blend"
                  />
                </div>

                {/* Design */}
                <div>
                  <Label htmlFor="design">Design</Label>
                  <Input
                    id="design"
                    {...register('design')}
                    placeholder="e.g., Floral, Geometric"
                  />
                </div>

                {/* Buyer Code */}
                <div>
                  <Label htmlFor="buyerCode">Buyer Code</Label>
                  <Input
                    id="buyerCode"
                    {...register('buyerCode')}
                    placeholder="Buyer's reference code (optional)"
                  />
                </div>
              </div>
            </div>

            {/* SUPPLIERS SECTION - Multi-supplier support */}
            <div className="border-t pt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Suppliers</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddSupplier}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Supplier
                </Button>
              </div>

              {suppliers.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <p className="text-gray-500">No suppliers added yet.</p>
                  <p className="text-sm text-gray-400 mt-1">Click "Add Supplier" to add one.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {suppliers.map((supplier, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Supplier Select */}
                        <div className="md:col-span-2">
                          <Label>Supplier <span className="text-red-500">*</span></Label>
                          <Select
                            value={supplier.supplierId || undefined}
                            onValueChange={(value) => handleSupplierChange(index, 'supplierId', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select supplier..." />
                            </SelectTrigger>
                            <SelectContent>
                              {availableSuppliers.map(s => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.code} - {s.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Price per Meter */}
                        <div>
                          <Label>Price/Meter (₹)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={supplier.pricePerMeter || ''}
                            onChange={(e) => handleSupplierChange(index, 'pricePerMeter', e.target.value)}
                            placeholder="e.g., 15.50"
                          />
                        </div>

                        {/* Actions */}
                        <div className="flex items-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => handleRemoveSupplier(index)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Checkboxes Row */}
                        <div className="md:col-span-2 flex items-center gap-6">
                          <label className="flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={supplier.isPreferred}
                              onChange={(e) => handleSupplierChange(index, 'isPreferred', e.target.checked)}
                              className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            />
                            <span className="ml-2 text-sm text-gray-700">Preferred Supplier</span>
                          </label>

                          <label className="flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={supplier.isActive}
                              onChange={(e) => handleSupplierChange(index, 'isActive', e.target.checked)}
                              className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            />
                            <span className="ml-2 text-sm text-gray-700">Active</span>
                          </label>
                        </div>

                        {/* Notes */}
                        <div className="md:col-span-2">
                          <Label>Notes</Label>
                          <Input
                            value={supplier.notes || ''}
                            onChange={(e) => handleSupplierChange(index, 'notes', e.target.value)}
                            placeholder="Optional notes about this supplier..."
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SUPPLIER REFERENCE CODE */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Reference Codes</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="supplierCode">Supplier Reference Code</Label>
                  <Input
                    id="supplierCode"
                    {...register('supplierCode')}
                    placeholder="Supplier's SKU/reference for this item (optional)"
                  />
                </div>
              </div>
            </div>

            {/* STYLE ASSOCIATIONS */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Style Associations</h3>
              <StyleCodeMultiSelect
                value={selectedStyleCodes}
                onChange={setSelectedStyleCodes}
                label="Associated Styles"
                placeholder="Search and select styles to associate with this lace..."
                helpText="Select one or more styles that use this lace. The first selected style will be marked as primary and included in the auto-generated name."
              />
            </div>

            {/* DESCRIPTION */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Additional Information</h3>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  {...register('description')}
                  rows={4}
                  placeholder="Additional notes or details about this lace..."
                />
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex gap-4 justify-end pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/materials/lace')}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : isNewLace ? 'Create Lace' : 'Update Lace'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
