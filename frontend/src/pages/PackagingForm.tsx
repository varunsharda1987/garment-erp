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
import { createPackaging, getPackagingById, updatePackaging } from '@/services/packaging.service';
import { getAllSuppliers } from '@/services/supplier.service';
import type { PackagingFormData } from '@/types/packaging.types';
import type { Supplier } from '@/types/supplier.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';

interface PackagingFormProps {
  mode?: 'create' | 'edit';
}

export default function PackagingForm({ mode = 'create' }: PackagingFormProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [packagingCode, setPackagingCode] = useState<string>('');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<PackagingFormData>();

  const isNewPackaging = mode === 'create' || !id;

  // Load suppliers
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const response = await getAllSuppliers({ limit: 100 });
        setSuppliers(response.data);
      } catch (err) {
        console.error('Failed to fetch suppliers:', err);
      }
    };
    fetchSuppliers();
  }, []);

  // Load packaging data for edit mode
  useEffect(() => {
    if (!isNewPackaging && id) {
      const fetchPackaging = async () => {
        try {
          setIsLoading(true);
          const packaging = await getPackagingById(id);

          setPackagingCode(packaging.packagingCode);
          setValue('packagingName', packaging.packagingName);
          setValue('supplierCode', packaging.supplierCode || '');
          setValue('buyerCode', packaging.buyerCode || '');
          setValue('packagingType', packaging.packagingType || '');
          setValue('size', packaging.size || '');
          setValue('material', packaging.material || '');
          setValue('thickness', packaging.thickness?.toString() || '');
          setValue('printDetails', packaging.printDetails || '');
          setValue('pricePerPiece', packaging.pricePerPiece?.toString() || '');
          setValue('pricePerHundred', packaging.pricePerHundred?.toString() || '');
          setValue('description', packaging.description || '');

          if (packaging.supplierId) {
            setSelectedSupplierId(packaging.supplierId);
            setValue('supplierId', packaging.supplierId);
          }
        } catch (err: unknown) {
          const errorMessage = handleApiError(err, 'Failed to load packaging', false);
          setError(errorMessage);
        } finally {
          setIsLoading(false);
        }
      };
      fetchPackaging();
    }
  }, [id, isNewPackaging, setValue]);

  const onSubmit = async (data: PackagingFormData) => {
    try {
      setIsLoading(true);
      setError(null);

      // Validate required fields
      if (!data.packagingName || data.packagingName.trim() === '') {
        setError('Packaging name is required');
        setIsLoading(false);
        return;
      }

      const payload: PackagingFormData = {
        ...data,
        supplierId: selectedSupplierId || undefined,
        thickness: data.thickness ? Number(data.thickness) : undefined,
        pricePerPiece: data.pricePerPiece ? Number(data.pricePerPiece) : undefined,
        pricePerHundred: data.pricePerHundred ? Number(data.pricePerHundred) : undefined,
      };

      if (isNewPackaging) {
        await createPackaging(payload);
        handleApiSuccess('Packaging created', 'Packaging item has been successfully created.');
      } else if (id) {
        await updatePackaging(id, payload);
        handleApiSuccess('Packaging updated', 'Packaging item has been successfully updated.');
      }

      navigate('/materials/packaging');
    } catch (err: unknown) {
      const errorMessage = handleApiError(
        err,
        `Failed to ${isNewPackaging ? 'create' : 'update'} packaging`,
        false
      );
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !isNewPackaging) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Loading packaging...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>{isNewPackaging ? 'Create New Packaging' : 'Edit Packaging'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-md">
                {error}
              </div>
            )}

            {/* PACKAGING INFORMATION */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Packaging Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Packaging Code - Read Only for Edit */}
                {!isNewPackaging && packagingCode && (
                  <div className="md:col-span-2">
                    <Label htmlFor="packagingCode">Packaging Code (Auto-generated)</Label>
                    <div className="mt-2">
                      <Badge variant="secondary" className="font-mono text-sm">
                        {packagingCode}
                      </Badge>
                      <p className="text-xs text-gray-500 mt-1">
                        This code is automatically generated and cannot be changed
                      </p>
                    </div>
                  </div>
                )}

                {/* Packaging Name */}
                <div className="md:col-span-2">
                  <Label htmlFor="packagingName">Packaging Name *</Label>
                  <Input
                    id="packagingName"
                    {...register('packagingName', { required: 'Packaging name is required' })}
                    placeholder="e.g., Poly Bag 12x18 inch Transparent"
                  />
                  {errors.packagingName && (
                    <p className="text-sm text-red-600 mt-1">{errors.packagingName.message}</p>
                  )}
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

                {/* Supplier Code */}
                <div>
                  <Label htmlFor="supplierCode">Supplier Code</Label>
                  <Input
                    id="supplierCode"
                    {...register('supplierCode')}
                    placeholder="Supplier's reference code"
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

                {/* Packaging Type */}
                <div>
                  <Label htmlFor="packagingType">Packaging Type</Label>
                  <Input
                    id="packagingType"
                    {...register('packagingType')}
                    placeholder="e.g., Poly Bag, Carton Box, Hanger"
                  />
                </div>

                {/* Size */}
                <div>
                  <Label htmlFor="size">Size</Label>
                  <Input
                    id="size"
                    {...register('size')}
                    placeholder="e.g., 12x18 inches"
                  />
                </div>

                {/* Material */}
                <div>
                  <Label htmlFor="material">Material</Label>
                  <Input
                    id="material"
                    {...register('material')}
                    placeholder="e.g., LDPE, Corrugated Cardboard, Plastic"
                  />
                </div>

                {/* Thickness */}
                <div>
                  <Label htmlFor="thickness">Thickness (microns)</Label>
                  <Input
                    id="thickness"
                    type="number"
                    step="0.01"
                    {...register('thickness')}
                    placeholder="e.g., 50.0"
                  />
                </div>

                {/* Print Details */}
                <div>
                  <Label htmlFor="printDetails">Print Details</Label>
                  <Input
                    id="printDetails"
                    {...register('printDetails')}
                    placeholder="e.g., Logo Front, Barcode Back"
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
                    placeholder="e.g., 3.50"
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
                    placeholder="e.g., 300.00"
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
                  placeholder="Additional notes or details about this packaging..."
                />
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex gap-4 justify-end pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/materials/packaging')}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : isNewPackaging ? 'Create Packaging' : 'Update Packaging'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
