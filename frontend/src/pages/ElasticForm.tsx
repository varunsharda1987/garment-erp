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
import { createElastic, getElasticById, updateElastic } from '@/services/elastic.service';
import { getAllSuppliers } from '@/services/supplier.service';
import type { ElasticFormData } from '@/types/elastic.types';
import type { Supplier } from '@/types/supplier.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';

interface ElasticFormProps {
  mode?: 'create' | 'edit';
}

export default function ElasticForm({ mode = 'create' }: ElasticFormProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [elasticCode, setElasticCode] = useState<string>('');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ElasticFormData>();

  const isNewElastic = mode === 'create' || !id;

  // Load suppliers (filtered by TRIMS_SUPPLIER category)
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const response = await getAllSuppliers({ limit: 100, category: 'TRIMS_SUPPLIER' });
        setSuppliers(response.data);
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

          if (elastic.supplierId) {
            setSelectedSupplierId(elastic.supplierId);
            setValue('supplierId', elastic.supplierId);
          }
        } catch (err: any) {
          const errorMessage = handleApiError(err, 'Failed to load elastic', false);
          setError(errorMessage);
        } finally {
          setIsLoading(false);
        }
      };
      fetchElastic();
    }
  }, [id, isNewElastic, setValue]);

  const onSubmit = async (data: ElasticFormData) => {
    try {
      setIsLoading(true);
      setError(null);

      // Elastic name is now auto-generated, no validation needed

      const payload: ElasticFormData = {
        ...data,
        supplierId: selectedSupplierId || undefined,
        width: data.width ? Number(data.width) : undefined,
        stretchPercent: data.stretchPercent ? Number(data.stretchPercent) : undefined,
        pricePerMeter: data.pricePerMeter ? Number(data.pricePerMeter) : undefined,
      };

      if (isNewElastic) {
        await createElastic(payload);
        handleApiSuccess('Elastic created', 'Elastic item has been successfully created.');
      } else if (id) {
        await updateElastic(id, payload);
        handleApiSuccess('Elastic updated', 'Elastic item has been successfully updated.');
      }

      navigate('/materials/elastic');
    } catch (err: any) {
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
                  <Label htmlFor="color">Color</Label>
                  <Input
                    id="color"
                    {...register('color')}
                    placeholder="e.g., Black, White, Navy"
                  />
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

                {/* Price Per Meter */}
                <div>
                  <Label htmlFor="pricePerMeter">Price per Meter (₹)</Label>
                  <Input
                    id="pricePerMeter"
                    type="number"
                    step="0.01"
                    {...register('pricePerMeter')}
                    placeholder="e.g., 8.50"
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
