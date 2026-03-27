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
import { createZipper, getZipperById, updateZipper } from '@/services/zipper.service';
import { getAllSuppliers } from '@/services/supplier.service';
import type { ZipperFormData, ZipperSupplierInput } from '@/types/zipper.types';
import type { Supplier } from '@/types/supplier.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { Plus, Trash2 } from 'lucide-react';

interface ZipperFormProps {
  mode?: 'create' | 'edit';
}

export default function ZipperForm({ mode = 'create' }: ZipperFormProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableSuppliers, setAvailableSuppliers] = useState<Supplier[]>([]);
  const [zipperCode, setZipperCode] = useState<string>('');
  const [selectedColorId, setSelectedColorId] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<ZipperSupplierInput[]>([]);

  const { register, handleSubmit, setValue } = useForm<ZipperFormData>();

  const isNewZipper = mode === 'create' || !id;

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

          // Set suppliers from junction table
          if (zipper.zipperSuppliers && zipper.zipperSuppliers.length > 0) {
            setSuppliers(
              zipper.zipperSuppliers.map((s) => ({
                supplierId: s.supplierId,
                isPreferred: s.isPreferred,
                isActive: s.isActive,
                notes: s.notes || '',
                pricePerPiece: s.pricePerPiece?.toString() || '',
              }))
            );
          }
        } catch (err: unknown) {
          const errorMessage = handleApiError(err, 'Failed to load zipper', false);
          setError(errorMessage);
        } finally {
          setIsLoading(false);
        }
      };
      fetchZipper();
    }
  }, [id, isNewZipper, setValue]);

  // Supplier management functions
  const handleAddSupplier = () => {
    setSuppliers((prev) => [
      ...prev,
      {
        supplierId: '',
        isPreferred: prev.length === 0, // First supplier is preferred by default
        isActive: true,
        notes: '',
        pricePerPiece: '',
      },
    ]);
  };

  const handleRemoveSupplier = (index: number) => {
    setSuppliers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSupplierChange = (index: number, field: keyof ZipperSupplierInput, value: string | boolean) => {
    setSuppliers((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const onSubmit = async (data: ZipperFormData) => {
    try {
      setIsLoading(true);
      setError(null);

      // Validate suppliers have valid supplier IDs
      const validSuppliers = suppliers.filter((s) => s.supplierId);

      const payload: ZipperFormData = {
        ...data,
        length: data.length ? Number(data.length) : undefined,
        tapeWidth: data.tapeWidth ? Number(data.tapeWidth) : undefined,
        pricePerPiece: data.pricePerPiece ? Number(data.pricePerPiece) : undefined,
        suppliers: validSuppliers,
      };

      if (isNewZipper) {
        await createZipper(payload);
        handleApiSuccess('Zipper created', 'Zipper item has been successfully created.');
      } else if (id) {
        await updateZipper(id, payload);
        handleApiSuccess('Zipper updated', 'Zipper item has been successfully updated.');
      }

      navigate('/materials/zipper');
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, `Failed to ${isNewZipper ? 'create' : 'update'} zipper`, false);
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
            {error && <div className="bg-red-50 text-red-600 p-4 rounded-md">{error}</div>}

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
                      <p className="text-xs text-gray-500 mt-1">Code will be automatically assigned upon creation</p>
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
                    If left empty, name will be auto-generated from attributes (e.g., "[Buyer-Code] Color TeethType
                    Zipper Length Brand")
                  </p>
                </div>

                {/* Buyer Code */}
                <div>
                  <Label htmlFor="buyerCode">Buyer Code</Label>
                  <Input id="buyerCode" {...register('buyerCode')} placeholder="Buyer's reference code" />
                </div>

                {/* Length */}
                <div>
                  <Label htmlFor="length">Length (inches)</Label>
                  <Input id="length" type="number" step="0.01" {...register('length')} placeholder="e.g., 7.0" />
                </div>

                {/* Teeth Type */}
                <div>
                  <Label htmlFor="teethType">Teeth Type</Label>
                  <Input id="teethType" {...register('teethType')} placeholder="e.g., Metal, Plastic, Nylon" />
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

                {/* Brand */}
                <div>
                  <Label htmlFor="brand">Brand</Label>
                  <Input id="brand" {...register('brand')} placeholder="e.g., YKK, SBS" />
                </div>

                {/* Slider Type */}
                <div>
                  <Label htmlFor="sliderType">Slider Type</Label>
                  <Input id="sliderType" {...register('sliderType')} placeholder="e.g., Auto-lock, Two-way" />
                </div>

                {/* Tape Width */}
                <div>
                  <Label htmlFor="tapeWidth">Tape Width (mm)</Label>
                  <Input id="tapeWidth" type="number" step="0.01" {...register('tapeWidth')} placeholder="e.g., 25.0" />
                </div>

                {/* Default Price Per Piece (for backward compatibility) */}
                <div>
                  <Label htmlFor="pricePerPiece">Default Price per Piece (₹)</Label>
                  <Input
                    id="pricePerPiece"
                    type="number"
                    step="0.01"
                    {...register('pricePerPiece')}
                    placeholder="e.g., 12.50"
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
                <Button type="button" variant="outline" size="sm" onClick={handleAddSupplier}>
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
                          <Label>
                            Supplier <span className="text-red-500">*</span>
                          </Label>
                          <Select
                            value={supplier.supplierId || undefined}
                            onValueChange={(value) => handleSupplierChange(index, 'supplierId', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select supplier..." />
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

                        {/* Price per Piece */}
                        <div>
                          <Label>Price/Piece (₹)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={supplier.pricePerPiece || ''}
                            onChange={(e) => handleSupplierChange(index, 'pricePerPiece', e.target.value)}
                            placeholder="e.g., 12.50"
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
