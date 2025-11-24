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
import { createZipper, getZipperById, updateZipper } from '@/services/zipper.service';
import { getAllSuppliers } from '@/services/supplier.service';
import type { ZipperFormData } from '@/types/zipper.types';
import type { Supplier } from '@/types/supplier.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';

interface ZipperFormProps {
  mode?: 'create' | 'edit';
}

export default function ZipperForm({ mode = 'create' }: ZipperFormProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [zipperCode, setZipperCode] = useState<string>('');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ZipperFormData>();

  const isNewZipper = mode === 'create' || !id;

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

  // Load zipper data for edit mode
  useEffect(() => {
    if (!isNewZipper && id) {
      const fetchZipper = async () => {
        try {
          setIsLoading(true);
          const zipper = await getZipperById(id);

          setZipperCode(zipper.zipperCode);
          setValue('zipperName', zipper.zipperName);
          setValue('supplierCode', zipper.supplierCode || '');
          setValue('buyerCode', zipper.buyerCode || '');
          setValue('length', zipper.length?.toString() || '');
          setValue('teethType', zipper.teethType || '');
          setValue('color', zipper.color || '');
          setValue('brand', zipper.brand || '');
          setValue('sliderType', zipper.sliderType || '');
          setValue('tapeWidth', zipper.tapeWidth?.toString() || '');
          setValue('pricePerPiece', zipper.pricePerPiece?.toString() || '');
          setValue('description', zipper.description || '');

          if (zipper.supplierId) {
            setSelectedSupplierId(zipper.supplierId);
            setValue('supplierId', zipper.supplierId);
          }
        } catch (err: any) {
          const errorMessage = handleApiError(err, 'Failed to load zipper', false);
          setError(errorMessage);
        } finally {
          setIsLoading(false);
        }
      };
      fetchZipper();
    }
  }, [id, isNewZipper, setValue]);

  const onSubmit = async (data: ZipperFormData) => {
    try {
      setIsLoading(true);
      setError(null);

      // Zipper name is now auto-generated, no validation needed

      const payload: ZipperFormData = {
        ...data,
        supplierId: selectedSupplierId || undefined,
        length: data.length ? Number(data.length) : undefined,
        tapeWidth: data.tapeWidth ? Number(data.tapeWidth) : undefined,
        pricePerPiece: data.pricePerPiece ? Number(data.pricePerPiece) : undefined,
      };

      if (isNewZipper) {
        await createZipper(payload);
        handleApiSuccess('Zipper created', 'Zipper item has been successfully created.');
      } else if (id) {
        await updateZipper(id, payload);
        handleApiSuccess('Zipper updated', 'Zipper item has been successfully updated.');
      }

      navigate('/materials/zipper');
    } catch (err: any) {
      const errorMessage = handleApiError(
        err,
        `Failed to ${isNewZipper ? 'create' : 'update'} zipper`,
        false
      );
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !isNewZipper) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Loading zipper...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>{isNewZipper ? 'Create New Zipper' : 'Edit Zipper'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-md">
                {error}
              </div>
            )}

            {/* ZIPPER INFORMATION */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Zipper Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Zipper Code - Auto-generated */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                    Zipper Code
                    {isNewZipper && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Auto-generated</span>
                    )}
                  </label>
                  {!isNewZipper && zipperCode ? (
                    <div className="mt-2">
                      <Badge variant="secondary" className="font-mono text-sm">
                        {zipperCode}
                      </Badge>
                      <p className="text-xs text-gray-500 mt-1">
                        This code is automatically generated and cannot be changed
                      </p>
                    </div>
                  ) : (
                    <>
                      <Input
                        id="zipperCode"
                        value=""
                        readOnly
                        placeholder="Will be auto-generated (e.g., ZIP-000001)"
                        className="bg-gray-50 cursor-not-allowed"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Code will be automatically assigned upon creation
                      </p>
                    </>
                  )}
                </div>

                {/* Zipper Name */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                    Zipper Name
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Auto-generated</span>
                  </label>
                  <Input
                    id="zipperName"
                    {...register('zipperName')}
                    placeholder="Leave empty to auto-generate from color, teethType, length, brand, etc."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    If left empty, name will be auto-generated from attributes (e.g., "[Buyer-Code] Color TeethType Zipper Length Brand")
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

                {/* Length */}
                <div>
                  <Label htmlFor="length">Length (inches)</Label>
                  <Input
                    id="length"
                    type="number"
                    step="0.01"
                    {...register('length')}
                    placeholder="e.g., 7.0"
                  />
                </div>

                {/* Teeth Type */}
                <div>
                  <Label htmlFor="teethType">Teeth Type</Label>
                  <Input
                    id="teethType"
                    {...register('teethType')}
                    placeholder="e.g., Metal, Plastic, Nylon"
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

                {/* Brand */}
                <div>
                  <Label htmlFor="brand">Brand</Label>
                  <Input
                    id="brand"
                    {...register('brand')}
                    placeholder="e.g., YKK, SBS"
                  />
                </div>

                {/* Slider Type */}
                <div>
                  <Label htmlFor="sliderType">Slider Type</Label>
                  <Input
                    id="sliderType"
                    {...register('sliderType')}
                    placeholder="e.g., Auto-lock, Two-way"
                  />
                </div>

                {/* Tape Width */}
                <div>
                  <Label htmlFor="tapeWidth">Tape Width (mm)</Label>
                  <Input
                    id="tapeWidth"
                    type="number"
                    step="0.01"
                    {...register('tapeWidth')}
                    placeholder="e.g., 25.0"
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
                    placeholder="e.g., 12.50"
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
                  placeholder="Additional notes or details about this zipper..."
                />
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex gap-4 justify-end pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/materials/zipper')}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : isNewZipper ? 'Create Zipper' : 'Update Zipper'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
