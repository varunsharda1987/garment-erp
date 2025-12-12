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
import type { LabelFormData, LabelSupplierInput } from '@/types/label.types';
import type { Supplier } from '@/types/supplier.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { Plus, Trash2 } from 'lucide-react';

interface LabelFormProps {
  mode?: 'create' | 'edit';
}

export default function LabelForm({ mode = 'create' }: LabelFormProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableSuppliers, setAvailableSuppliers] = useState<Supplier[]>([]);
  const [labelCode, setLabelCode] = useState<string>('');
  const [suppliers, setSuppliers] = useState<LabelSupplierInput[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LabelFormData>();

  const isNewLabel = mode === 'create' || !id;

  // Load available suppliers (filtered by PACKAGING_SUPPLIER category)
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

          // Set suppliers from junction table
          if (label.labelSuppliers && label.labelSuppliers.length > 0) {
            setSuppliers(label.labelSuppliers.map(s => ({
              supplierId: s.supplierId,
              isPreferred: s.isPreferred,
              isActive: s.isActive,
              notes: s.notes || '',
              pricePerPiece: s.pricePerPiece?.toString() || '',
              pricePerHundred: s.pricePerHundred?.toString() || '',
            })));
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

  // Supplier management functions
  const handleAddSupplier = () => {
    setSuppliers(prev => [...prev, {
      supplierId: '',
      isPreferred: prev.length === 0, // First supplier is preferred by default
      isActive: true,
      notes: '',
      pricePerPiece: '',
      pricePerHundred: '',
    }]);
  };

  const handleRemoveSupplier = (index: number) => {
    setSuppliers(prev => prev.filter((_, i) => i !== index));
  };

  const handleSupplierChange = (index: number, field: keyof LabelSupplierInput, value: string | boolean) => {
    setSuppliers(prev => prev.map((s, i) =>
      i === index ? { ...s, [field]: value } : s
    ));
  };

  const onSubmit = async (data: LabelFormData) => {
    try {
      setIsLoading(true);
      setError(null);

      // Validate suppliers have valid supplier IDs
      const validSuppliers = suppliers.filter(s => s.supplierId);

      const payload: LabelFormData = {
        ...data,
        pricePerPiece: data.pricePerPiece ? Number(data.pricePerPiece) : undefined,
        pricePerHundred: data.pricePerHundred ? Number(data.pricePerHundred) : undefined,
        suppliers: validSuppliers,
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

                {/* Default Price Per Piece (for backward compatibility) */}
                <div>
                  <Label htmlFor="pricePerPiece">Default Price per Piece (₹)</Label>
                  <Input
                    id="pricePerPiece"
                    type="number"
                    step="0.01"
                    {...register('pricePerPiece')}
                    placeholder="e.g., 2.50"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Fallback price when no supplier-specific price is available
                  </p>
                </div>

                {/* Default Price Per Hundred (for backward compatibility) */}
                <div>
                  <Label htmlFor="pricePerHundred">Default Price per Hundred (₹)</Label>
                  <Input
                    id="pricePerHundred"
                    type="number"
                    step="0.01"
                    {...register('pricePerHundred')}
                    placeholder="e.g., 200.00"
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
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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

                        {/* Price per Piece */}
                        <div>
                          <Label>Price/Piece (₹)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={supplier.pricePerPiece || ''}
                            onChange={(e) => handleSupplierChange(index, 'pricePerPiece', e.target.value)}
                            placeholder="e.g., 2.50"
                          />
                        </div>

                        {/* Price per Hundred */}
                        <div>
                          <Label>Price/100 (₹)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={supplier.pricePerHundred || ''}
                            onChange={(e) => handleSupplierChange(index, 'pricePerHundred', e.target.value)}
                            placeholder="e.g., 200.00"
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
                        <div className="md:col-span-3">
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
