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
import ColorPicker from '@/components/ColorPicker';
import type { ColorSearchResult } from '@/types/color.types';
import { createElastic, getElasticById, updateElastic } from '@/services/elastic.service';
import { getAllSuppliers } from '@/services/supplier.service';
import type { ElasticFormData, ElasticSupplierInput } from '@/types/elastic.types';
import type { Supplier } from '@/types/supplier.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { Plus, Trash2 } from 'lucide-react';

interface ElasticFormProps {
  mode?: 'create' | 'edit';
}

export default function ElasticForm({ mode = 'create' }: ElasticFormProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableSuppliers, setAvailableSuppliers] = useState<Supplier[]>([]);
  const [elasticCode, setElasticCode] = useState<string>('');
  const [selectedColorId, setSelectedColorId] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<ElasticSupplierInput[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ElasticFormData>();

  const isNewElastic = mode === 'create' || !id;

  // Load available suppliers (filtered by TRIMS_SUPPLIER category)
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const response = await getAllSuppliers({ limit: 100, category: 'TRIMS_SUPPLIER' });
        setAvailableSuppliers(response.data);
      } catch (err) {
        console.error('Failed to fetch suppliers:', err);
      }
    };
    fetchSuppliers();
  }, []);

  // Load elastic data for edit mode
  useEffect(() => {
    if (!isNewElastic && id) {
      const fetchElastic = async () => {
        try {
          setIsLoading(true);
          const elastic = await getElasticById(id);

          setElasticCode(elastic.elasticCode);
          setValue('elasticName', elastic.elasticName);
          setValue('supplierCode', elastic.supplierCode || '');
          setValue('buyerCode', elastic.buyerCode || '');
          setValue('width', elastic.width?.toString() || '');
          setValue('stretchPercent', elastic.stretchPercent?.toString() || '');
          setValue('color', elastic.color || '');
          setValue('composition', elastic.composition || '');
          setValue('elasticType', elastic.elasticType || '');
          setValue('pricePerMeter', elastic.pricePerMeter?.toString() || '');
          setValue('description', elastic.description || '');

          // Set suppliers from junction table
          if (elastic.elasticSuppliers && elastic.elasticSuppliers.length > 0) {
            setSuppliers(elastic.elasticSuppliers.map(s => ({
              supplierId: s.supplierId,
              isPreferred: s.isPreferred,
              isActive: s.isActive,
              notes: s.notes || '',
              pricePerMeter: s.pricePerMeter?.toString() || '',
            })));
          }
        } catch (err: unknown) {
          const errorMessage = handleApiError(err, 'Failed to load elastic', false);
          setError(errorMessage);
        } finally {
          setIsLoading(false);
        }
      };
      fetchElastic();
    }
  }, [id, isNewElastic, setValue]);

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

  const handleSupplierChange = (index: number, field: keyof ElasticSupplierInput, value: string | boolean) => {
    setSuppliers(prev => prev.map((s, i) =>
      i === index ? { ...s, [field]: value } : s
    ));
  };

  const onSubmit = async (data: ElasticFormData) => {
    try {
      setIsLoading(true);
      setError(null);

      // Validate suppliers have valid supplier IDs
      const validSuppliers = suppliers.filter(s => s.supplierId);

      const payload: ElasticFormData = {
        ...data,
        width: data.width ? Number(data.width) : undefined,
        stretchPercent: data.stretchPercent ? Number(data.stretchPercent) : undefined,
        pricePerMeter: data.pricePerMeter ? Number(data.pricePerMeter) : undefined,
        suppliers: validSuppliers,
      };

      if (isNewElastic) {
        await createElastic(payload);
        handleApiSuccess('Elastic created', 'Elastic item has been successfully created.');
      } else if (id) {
        await updateElastic(id, payload);
        handleApiSuccess('Elastic updated', 'Elastic item has been successfully updated.');
      }

      navigate('/materials/elastic');
    } catch (err: unknown) {
      const errorMessage = handleApiError(
        err,
        `Failed to ${isNewElastic ? 'create' : 'update'} elastic`,
        false
      );
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !isNewElastic) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Loading elastic...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>{isNewElastic ? 'Create New Elastic' : 'Edit Elastic'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-md">
                {error}
              </div>
            )}

            {/* ELASTIC INFORMATION */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Elastic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Elastic Code - Auto-generated */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                    Elastic Code
                    {isNewElastic && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Auto-generated</span>
                    )}
                  </label>
                  {!isNewElastic && elasticCode ? (
                    <div className="mt-2">
                      <Badge variant="secondary" className="font-mono text-sm">
                        {elasticCode}
                      </Badge>
                      <p className="text-xs text-gray-500 mt-1">
                        This code is automatically generated and cannot be changed
                      </p>
                    </div>
                  ) : (
                    <>
                      <Input
                        id="elasticCode"
                        value=""
                        readOnly
                        placeholder="Will be auto-generated (e.g., ELS-000001)"
                        className="bg-gray-50 cursor-not-allowed"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Code will be automatically assigned upon creation
                      </p>
                    </>
                  )}
                </div>

                {/* Elastic Name */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                    Elastic Name
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Auto-generated</span>
                  </label>
                  <Input
                    id="elasticName"
                    {...register('elasticName')}
                    placeholder="Leave empty to auto-generate from color, elasticType, width, etc."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    If left empty, name will be auto-generated from attributes (e.g., "[Buyer-Code] Color ElasticType Elastic Width Composition")
                  </p>
                </div>

                {/* Buyer Code */}
                <div>
                  <Label htmlFor="buyerCode">Buyer Code</Label>
                  <Input
                    id="buyerCode"
                    {...register('buyerCode')}
                    placeholder="Buyer's reference code"
                  />
                </div>

                {/* Width */}
                <div>
                  <Label htmlFor="width">Width (mm)</Label>
                  <Input
                    id="width"
                    type="number"
                    step="0.01"
                    {...register('width')}
                    placeholder="e.g., 25.0"
                  />
                </div>

                {/* Stretch Percent */}
                <div>
                  <Label htmlFor="stretchPercent">Stretch Percent (%)</Label>
                  <Input
                    id="stretchPercent"
                    type="number"
                    step="0.01"
                    {...register('stretchPercent')}
                    placeholder="e.g., 150.0"
                  />
                </div>

                {/* Color */}
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

                {/* Composition */}
                <div>
                  <Label htmlFor="composition">Composition</Label>
                  <Input
                    id="composition"
                    {...register('composition')}
                    placeholder="e.g., 80% Polyester 20% Spandex"
                  />
                </div>

                {/* Elastic Type */}
                <div>
                  <Label htmlFor="elasticType">Elastic Type</Label>
                  <Input
                    id="elasticType"
                    {...register('elasticType')}
                    placeholder="e.g., Woven, Knitted, Braided"
                  />
                </div>

                {/* Default Price Per Meter (for backward compatibility) */}
                <div>
                  <Label htmlFor="pricePerMeter">Default Price per Meter (₹)</Label>
                  <Input
                    id="pricePerMeter"
                    type="number"
                    step="0.01"
                    {...register('pricePerMeter')}
                    placeholder="e.g., 8.50"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Fallback price when no supplier-specific price is available
                  </p>
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
                            placeholder="e.g., 8.50"
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

            {/* DESCRIPTION */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Additional Information</h3>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  {...register('description')}
                  rows={4}
                  placeholder="Additional notes or details about this elastic..."
                />
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex gap-4 justify-end pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/materials/elastic')}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : isNewElastic ? 'Create Elastic' : 'Update Elastic'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
