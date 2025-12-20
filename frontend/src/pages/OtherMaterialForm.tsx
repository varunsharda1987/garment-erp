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
import { createOtherMaterial, getOtherMaterialById, updateOtherMaterial } from '@/services/otherMaterial.service';
import { getAllSuppliers } from '@/services/supplier.service';
import type { CreateOtherMaterialRequest, UpdateOtherMaterialRequest, OtherMaterial } from '@/types/otherMaterial.types';
import type { Supplier } from '@/types/supplier.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { Plus, Trash2 } from 'lucide-react';

interface OtherMaterialFormProps {
  mode?: 'create' | 'edit';
}

interface SupplierInput {
  supplierId: string;
  isPreferred: boolean;
  isActive: boolean;
  notes: string;
  pricePerUnit: string;
}

const UNIT_OPTIONS = [
  'PIECE',
  'METER',
  'KG',
  'GRAM',
  'LITER',
  'SET',
  'PAIR',
  'DOZEN',
  'PACKET',
  'BOX',
  'ROLL',
  'YARD',
];

export default function OtherMaterialForm({ mode = 'create' }: OtherMaterialFormProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableSuppliers, setAvailableSuppliers] = useState<Supplier[]>([]);
  const [materialCode, setMaterialCode] = useState<string>('');
  const [suppliers, setSuppliers] = useState<SupplierInput[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<string>('PIECE');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CreateOtherMaterialRequest>();

  const isNewMaterial = mode === 'create' || !id;

  // Load available suppliers (filtered by OTHER_SERVICES category)
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const response = await getAllSuppliers({ limit: 100, category: 'OTHER_SERVICES' });
        setAvailableSuppliers(response.data);
      } catch (err) {
        console.error('Failed to fetch suppliers:', err);
      }
    };
    fetchSuppliers();
  }, []);

  // Load material data for edit mode
  useEffect(() => {
    if (!isNewMaterial && id) {
      const fetchMaterial = async () => {
        try {
          setIsLoading(true);
          const material: OtherMaterial = await getOtherMaterialById(id);

          setMaterialCode(material.materialCode);
          setValue('materialName', material.materialName);
          setValue('category', material.category || '');
          setValue('unit', material.unit || 'PIECE');
          setSelectedUnit(material.unit || 'PIECE');
          setValue('specifications', material.specifications || '');
          setValue('pricePerUnit', material.pricePerUnit?.toString() || '');
          setValue('description', material.description || '');

          // Set suppliers from junction table
          if (material.otherMaterialSuppliers && material.otherMaterialSuppliers.length > 0) {
            setSuppliers(material.otherMaterialSuppliers.map(s => ({
              supplierId: s.supplierId,
              isPreferred: s.isPreferred,
              isActive: s.isActive,
              notes: s.notes || '',
              pricePerUnit: s.pricePerUnit?.toString() || '',
            })));
          }
        } catch (err: unknown) {
          const errorMessage = handleApiError(err, 'Failed to load material', false);
          setError(errorMessage);
        } finally {
          setIsLoading(false);
        }
      };
      fetchMaterial();
    }
  }, [id, isNewMaterial, setValue]);

  // Supplier management functions
  const handleAddSupplier = () => {
    setSuppliers(prev => [...prev, {
      supplierId: '',
      isPreferred: prev.length === 0, // First supplier is preferred by default
      isActive: true,
      notes: '',
      pricePerUnit: '',
    }]);
  };

  const handleRemoveSupplier = (index: number) => {
    setSuppliers(prev => prev.filter((_, i) => i !== index));
  };

  const handleSupplierChange = (index: number, field: keyof SupplierInput, value: string | boolean) => {
    setSuppliers(prev => prev.map((s, i) =>
      i === index ? { ...s, [field]: value } : s
    ));
  };

  const onSubmit = async (data: CreateOtherMaterialRequest) => {
    try {
      setIsLoading(true);
      setError(null);

      // Validate suppliers have valid supplier IDs
      const validSuppliers = suppliers.filter(s => s.supplierId).map(s => ({
        supplierId: s.supplierId,
        isPreferred: s.isPreferred,
        isActive: s.isActive,
        notes: s.notes || undefined,
        pricePerUnit: s.pricePerUnit ? Number(s.pricePerUnit) : undefined,
      }));

      const payload: CreateOtherMaterialRequest | UpdateOtherMaterialRequest = {
        ...data,
        unit: selectedUnit,
        pricePerUnit: data.pricePerUnit ? Number(data.pricePerUnit) : undefined,
        suppliers: validSuppliers,
      };

      if (isNewMaterial) {
        await createOtherMaterial(payload as CreateOtherMaterialRequest);
        handleApiSuccess('Material created', 'Other material has been successfully created.');
      } else if (id) {
        await updateOtherMaterial(id, payload as UpdateOtherMaterialRequest);
        handleApiSuccess('Material updated', 'Other material has been successfully updated.');
      }

      navigate('/materials/other');
    } catch (err: unknown) {
      const errorMessage = handleApiError(
        err,
        `Failed to ${isNewMaterial ? 'create' : 'update'} material`,
        false
      );
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !isNewMaterial) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Loading material...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>{isNewMaterial ? 'Create New Material' : 'Edit Material'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-md">
                {error}
              </div>
            )}

            {/* MATERIAL INFORMATION */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Material Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Material Code - Auto-generated */}
                <div className="md:col-span-2">
                  <Label>
                    Material Code
                    {isNewMaterial && (
                      <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Auto-generated</span>
                    )}
                  </Label>
                  {!isNewMaterial && materialCode ? (
                    <Badge variant="outline" className="font-mono mt-2">{materialCode}</Badge>
                  ) : (
                    <p className="text-sm text-gray-500 mt-1">Will be generated automatically</p>
                  )}
                </div>

                {/* Material Name */}
                <div className="md:col-span-2">
                  <Label htmlFor="materialName">Material Name *</Label>
                  <Input
                    id="materialName"
                    {...register('materialName', { required: 'Material name is required' })}
                    placeholder="e.g., Safety Pins, Measuring Tape, Chalk"
                  />
                  {errors.materialName && (
                    <p className="text-red-500 text-sm mt-1">{errors.materialName.message}</p>
                  )}
                </div>

                {/* Category */}
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    {...register('category')}
                    placeholder="e.g., Tools, Stationery, Miscellaneous"
                  />
                </div>

                {/* Unit */}
                <div>
                  <Label htmlFor="unit">Unit *</Label>
                  <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIT_OPTIONS.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Price Per Unit */}
                <div>
                  <Label htmlFor="pricePerUnit">Price Per Unit (₹)</Label>
                  <Input
                    id="pricePerUnit"
                    type="number"
                    step="0.01"
                    {...register('pricePerUnit')}
                    placeholder="0.00"
                  />
                </div>

                {/* Specifications */}
                <div className="md:col-span-2">
                  <Label htmlFor="specifications">Specifications</Label>
                  <Textarea
                    id="specifications"
                    {...register('specifications')}
                    placeholder="Technical specifications, dimensions, etc."
                    rows={3}
                  />
                </div>

                {/* Description */}
                <div className="md:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    {...register('description')}
                    placeholder="Additional notes or description"
                    rows={2}
                  />
                </div>
              </div>
            </div>

            {/* SUPPLIERS */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Suppliers</h3>
                <Button type="button" variant="outline" size="sm" onClick={handleAddSupplier}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Supplier
                </Button>
              </div>

              {suppliers.length === 0 ? (
                <p className="text-sm text-gray-500">No suppliers added. Click "Add Supplier" to add one.</p>
              ) : (
                <div className="space-y-4">
                  {suppliers.map((supplier, index) => (
                    <div key={index} className="p-4 border rounded-lg bg-gray-50">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <Label>Supplier *</Label>
                          <Select
                            value={supplier.supplierId}
                            onValueChange={(value) => handleSupplierChange(index, 'supplierId', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select supplier" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableSuppliers.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.code} - {s.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Price Per Unit (₹)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={supplier.pricePerUnit}
                            onChange={(e) => handleSupplierChange(index, 'pricePerUnit', e.target.value)}
                            placeholder="0.00"
                          />
                        </div>

                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={supplier.isPreferred}
                              onChange={(e) => handleSupplierChange(index, 'isPreferred', e.target.checked)}
                              className="rounded"
                            />
                            <span className="text-sm">Preferred</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={supplier.isActive}
                              onChange={(e) => handleSupplierChange(index, 'isActive', e.target.checked)}
                              className="rounded"
                            />
                            <span className="text-sm">Active</span>
                          </label>
                        </div>

                        <div className="md:col-span-2">
                          <Label>Notes</Label>
                          <Textarea
                            value={supplier.notes}
                            onChange={(e) => handleSupplierChange(index, 'notes', e.target.value)}
                            placeholder="Additional notes"
                            rows={2}
                          />
                        </div>
                      </div>

                      <div className="mt-3 flex justify-end">
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRemoveSupplier(index)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* FORM ACTIONS */}
            <div className="flex justify-end gap-3 pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/materials/other')}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : isNewMaterial ? 'Create Material' : 'Update Material'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
