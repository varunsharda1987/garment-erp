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
import { createLace, getLaceById, updateLace } from '@/services/lace.service';
import { getAllSuppliers } from '@/services/supplier.service';
import type { LaceFormData } from '@/types/lace.types';
import type { Supplier } from '@/types/supplier.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';

interface LaceFormProps {
  mode?: 'create' | 'edit';
}

export default function LaceForm({ mode = 'create' }: LaceFormProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [laceCode, setLaceCode] = useState<string>('');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LaceFormData>();

  const isNewLace = mode === 'create' || !id;

  // Load suppliers (filtered by LACE_SUPPLIER category)
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const response = await getAllSuppliers({ limit: 100, category: 'LACE_SUPPLIER' });
        setSuppliers(response.data);
      } catch (err) {
        console.error('Failed to fetch suppliers:', err);
      }
    };
    fetchSuppliers();
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
          setValue('supplierCode', lace.supplierCode || '');
          setValue('buyerCode', lace.buyerCode || '');
          setValue('width', lace.width?.toString() || '');
          setValue('design', lace.design || '');
          setValue('color', lace.color || '');
          setValue('composition', lace.composition || '');
          setValue('pricePerMeter', lace.pricePerMeter?.toString() || '');
          setValue('description', lace.description || '');

          if (lace.supplierId) {
            setSelectedSupplierId(lace.supplierId);
            setValue('supplierId', lace.supplierId);
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

  const onSubmit = async (data: LaceFormData) => {
    try {
      setIsLoading(true);
      setError(null);

      // Lace name is now auto-generated, no validation needed

      const payload: LaceFormData = {
        ...data,
        supplierId: selectedSupplierId || undefined,
        width: data.width ? Number(data.width) : undefined,
        pricePerMeter: data.pricePerMeter ? Number(data.pricePerMeter) : undefined,
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

                {/* Lace Name */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                    Lace Name
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Auto-generated</span>
                  </label>
                  <Input
                    id="laceName"
                    {...register('laceName')}
                    placeholder="Leave empty to auto-generate from color, design, composition, etc."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    If left empty, name will be auto-generated from attributes (e.g., "[Buyer-Code] Color Design Composition Lace Width")
                  </p>
                </div>

                {/* Supplier */}
                <div>
                  <Label htmlFor="supplierId">Supplier</Label>
                  <Select
                    value={selectedSupplierId || undefined}
                    onValueChange={(value) => {
                      setSelectedSupplierId(value);
                      setValue('supplierId', value);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.code} - {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedSupplierId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedSupplierId('');
                        setValue('supplierId', '');
                      }}
                      className="mt-1 text-xs"
                    >
                      Clear supplier
                    </Button>
                  )}
                </div>

                {/* Supplier Reference Code */}
                <div>
                  <Label htmlFor="supplierCode">Supplier Reference Code</Label>
                  <Input
                    id="supplierCode"
                    {...register('supplierCode')}
                    placeholder="Supplier's SKU/reference for this item (optional)"
                  />
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
                  <Label htmlFor="width">Width (inches)</Label>
                  <Input
                    id="width"
                    type="number"
                    step="0.01"
                    {...register('width')}
                    placeholder="e.g., 2.0"
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

                {/* Color */}
                <div>
                  <Label htmlFor="color">Color</Label>
                  <Input
                    id="color"
                    {...register('color')}
                    placeholder="e.g., White, Ivory, Gold"
                  />
                </div>

                {/* Composition */}
                <div>
                  <Label htmlFor="composition">Composition</Label>
                  <Input
                    id="composition"
                    {...register('composition')}
                    placeholder="e.g., 100% Polyester, Nylon Blend"
                  />
                </div>

                {/* Price Per Meter */}
                <div>
                  <Label htmlFor="pricePerMeter">Price per Meter (₹)</Label>
                  <Input
                    id="pricePerMeter"
                    type="number"
                    step="0.01"
                    {...register('pricePerMeter')}
                    placeholder="e.g., 15.50"
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
