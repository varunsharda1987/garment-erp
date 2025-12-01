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
import { createLabel, getLabelById, updateLabel } from '@/services/label.service';
import { getAllSuppliers } from '@/services/supplier.service';
import type { LabelFormData } from '@/types/label.types';
import type { Supplier } from '@/types/supplier.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';

interface LabelFormProps {
  mode?: 'create' | 'edit';
}

export default function LabelForm({ mode = 'create' }: LabelFormProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [labelCode, setLabelCode] = useState<string>('');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LabelFormData>();

  const isNewLabel = mode === 'create' || !id;

  // Load suppliers (filtered by PACKAGING_SUPPLIER category)
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const response = await getAllSuppliers({ limit: 100, category: 'PACKAGING_SUPPLIER' });
        setSuppliers(response.data);
      } catch (err) {
        console.error('Failed to fetch suppliers:', err);
      }
    };
    fetchSuppliers();
  }, []);

  // Load label data for edit mode
  useEffect(() => {
    if (!isNewLabel && id) {
      const fetchLabel = async () => {
        try {
          setIsLoading(true);
          const label = await getLabelById(id);

          setLabelCode(label.labelCode);
          setValue('labelName', label.labelName);
          setValue('supplierCode', label.supplierCode || '');
          setValue('buyerCode', label.buyerCode || '');
          setValue('labelType', label.labelType || '');
          setValue('size', label.size || '');
          setValue('content', label.content || '');
          setValue('printMethod', label.printMethod || '');
          setValue('material', label.material || '');
          setValue('color', label.color || '');
          setValue('pricePerPiece', label.pricePerPiece?.toString() || '');
          setValue('pricePerHundred', label.pricePerHundred?.toString() || '');
          setValue('description', label.description || '');

          if (label.supplierId) {
            setSelectedSupplierId(label.supplierId);
            setValue('supplierId', label.supplierId);
          }
        } catch (err: unknown) {
          const errorMessage = handleApiError(err, 'Failed to load label', false);
          setError(errorMessage);
        } finally {
          setIsLoading(false);
        }
      };
      fetchLabel();
    }
  }, [id, isNewLabel, setValue]);

  const onSubmit = async (data: LabelFormData) => {
    try {
      setIsLoading(true);
      setError(null);

      // Label name is now auto-generated, no validation needed

      const payload: LabelFormData = {
        ...data,
        supplierId: selectedSupplierId || undefined,
        pricePerPiece: data.pricePerPiece ? Number(data.pricePerPiece) : undefined,
        pricePerHundred: data.pricePerHundred ? Number(data.pricePerHundred) : undefined,
      };

      if (isNewLabel) {
        await createLabel(payload);
        handleApiSuccess('Label created', 'Label item has been successfully created.');
      } else if (id) {
        await updateLabel(id, payload);
        handleApiSuccess('Label updated', 'Label item has been successfully updated.');
      }

      navigate('/materials/label');
    } catch (err: unknown) {
      const errorMessage = handleApiError(
        err,
        `Failed to ${isNewLabel ? 'create' : 'update'} label`,
        false
      );
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !isNewLabel) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Loading label...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>{isNewLabel ? 'Create New Label' : 'Edit Label'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-md">
                {error}
              </div>
            )}

            {/* LABEL INFORMATION */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Label Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Label Code - Auto-generated */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                    Label Code
                    {isNewLabel && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Auto-generated</span>
                    )}
                  </label>
                  {!isNewLabel && labelCode ? (
                    <div className="mt-2">
                      <Badge variant="secondary" className="font-mono text-sm">
                        {labelCode}
                      </Badge>
                      <p className="text-xs text-gray-500 mt-1">
                        This code is automatically generated and cannot be changed
                      </p>
                    </div>
                  ) : (
                    <>
                      <Input
                        id="labelCode"
                        value=""
                        readOnly
                        placeholder="Will be auto-generated (e.g., LBL-000001)"
                        className="bg-gray-50 cursor-not-allowed"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Code will be automatically assigned upon creation
                      </p>
                    </>
                  )}
                </div>

                {/* Label Name */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                    Label Name
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Auto-generated</span>
                  </label>
                  <Input
                    id="labelName"
                    {...register('labelName')}
                    placeholder="Leave empty to auto-generate from labelType, color, material, size, etc."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    If left empty, name will be auto-generated from attributes (e.g., "[Buyer-Code] LabelType Color Label Material Size")
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

                {/* Label Type */}
                <div>
                  <Label htmlFor="labelType">Label Type</Label>
                  <Input
                    id="labelType"
                    {...register('labelType')}
                    placeholder="e.g., Care Label, Brand Label, Size Label"
                  />
                </div>

                {/* Size */}
                <div>
                  <Label htmlFor="size">Size</Label>
                  <Input
                    id="size"
                    {...register('size')}
                    placeholder="e.g., 2x3 inches"
                  />
                </div>

                {/* Content */}
                <div>
                  <Label htmlFor="content">Content</Label>
                  <Input
                    id="content"
                    {...register('content')}
                    placeholder="e.g., Wash Care Instructions"
                  />
                </div>

                {/* Print Method */}
                <div>
                  <Label htmlFor="printMethod">Print Method</Label>
                  <Input
                    id="printMethod"
                    {...register('printMethod')}
                    placeholder="e.g., Screen Print, Heat Transfer, Woven"
                  />
                </div>

                {/* Material */}
                <div>
                  <Label htmlFor="material">Material</Label>
                  <Input
                    id="material"
                    {...register('material')}
                    placeholder="e.g., Polyester, Satin, Cotton"
                  />
                </div>

                {/* Color */}
                <div>
                  <Label htmlFor="color">Color</Label>
                  <Input
                    id="color"
                    {...register('color')}
                    placeholder="e.g., White, Black, Multi-color"
                  />
                </div>

                {/* Price Per Piece */}
                <div>
                  <Label htmlFor="pricePerPiece">Price per Piece (₹)</Label>
                  <Input
                    id="pricePerPiece"
                    type="number"
                    step="0.01"
                    {...register('pricePerPiece')}
                    placeholder="e.g., 2.50"
                  />
                </div>

                {/* Price Per Hundred */}
                <div>
                  <Label htmlFor="pricePerHundred">Price per Hundred (₹)</Label>
                  <Input
                    id="pricePerHundred"
                    type="number"
                    step="0.01"
                    {...register('pricePerHundred')}
                    placeholder="e.g., 200.00"
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
                  placeholder="Additional notes or details about this label..."
                />
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex gap-4 justify-end pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/materials/label')}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : isNewLabel ? 'Create Label' : 'Update Label'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
