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
import type { PackagingFormData, PackagingSupplierInput } from '@/types/packaging.types';
import type { Supplier } from '@/types/supplier.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { Plus, Trash2 } from 'lucide-react';

interface PackagingFormProps {
  mode?: 'create' | 'edit';
}

export default function PackagingForm({ mode = 'create' }: PackagingFormProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableSuppliers, setAvailableSuppliers] = useState<Supplier[]>([]);
  const [packagingCode, setPackagingCode] = useState<string>('');
  const [suppliers, setSuppliers] = useState<PackagingSupplierInput[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<PackagingFormData>();

  const isNewPackaging = mode === 'create' || !id;

  // Load available packaging suppliers
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const response = await getAllSuppliers({ limit: 100, category: 'PACKAGING_SUPPLIER' });
        setAvailableSuppliers(response.data);
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

          // Set suppliers from junction table
          if (packaging.packagingSuppliers && packaging.packagingSuppliers.length > 0) {
            setSuppliers(packaging.packagingSuppliers.map(s => ({
              supplierId: s.supplierId,
              isPreferred: s.isPreferred,
              isActive: s.isActive,
              notes: s.notes || '',
              pricePerPiece: s.pricePerPiece?.toString() || '',
            })));
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

  // Supplier management functions
  const handleAddSupplier = () => {
    setSuppliers(prev => [...prev, {
      supplierId: '',
      isPreferred: prev.length === 0, // First supplier is preferred by default
      isActive: true,
      notes: '',
      pricePerPiece: '',
    }]);
  };

  const handleRemoveSupplier = (index: number) => {
    setSuppliers(prev => prev.filter((_, i) => i !== index));
  };

  const handleSupplierChange = (index: number, field: keyof PackagingSupplierInput, value: string | boolean) => {
    setSuppliers(prev => prev.map((s, i) =>
      i === index ? { ...s, [field]: value } : s
    ));
  };

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

      // Validate suppliers have valid supplier IDs
      const validSuppliers = suppliers.filter(s => s.supplierId);

      const payload: PackagingFormData = {
        ...data,
        thickness: data.thickness ? Number(data.thickness) : undefined,
        pricePerPiece: data.pricePerPiece ? Number(data.pricePerPiece) : undefined,
        pricePerHundred: data.pricePerHundred ? Number(data.pricePerHundred) : undefined,
        suppliers: validSuppliers,
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
                  <Label htmlFor="pricePerPiece">Default Price per Piece (₹)</Label>
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
                  <Label htmlFor="pricePerHundred">Default Price per Hundred (₹)</Label>
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
                  <p className="text-sm text-gray-400 mt-1">Click "Add Supplier" to add one or more suppliers for this packaging item.</p>
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
                            value={supplier.supplierId}
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

                        {/* Price per Piece */}
                        <div>
                          <Label>Price/Piece (₹)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={supplier.pricePerPiece || ''}
                            onChange={(e) => handleSupplierChange(index, 'pricePerPiece', e.target.value)}
                            placeholder="e.g., 3.50"
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
