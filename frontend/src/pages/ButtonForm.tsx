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
import { StyleCodeMultiSelect } from '@/components/StyleCodeMultiSelect';
import ColorPicker from '@/components/ColorPicker';
import { createButton, getButtonById, updateButton } from '@/services/button.service';
import { getAllSuppliers } from '@/services/supplier.service';
import type { ButtonFormData, ButtonSupplierInput } from '@/types/button.types';
import type { Supplier } from '@/types/supplier.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { Plus, Trash2 } from 'lucide-react';

interface ButtonFormProps {
  mode?: 'create' | 'edit';
}

export default function ButtonForm({ mode = 'create' }: ButtonFormProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableSuppliers, setAvailableSuppliers] = useState<Supplier[]>([]);
  const [buttonCode, setButtonCode] = useState<string>('');
  const [selectedStyleCodes, setSelectedStyleCodes] = useState<string[]>([]);
  const [selectedColorId, setSelectedColorId] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<ButtonSupplierInput[]>([]);
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);
  const [originalButtonName, setOriginalButtonName] = useState<string>('');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors: _errors },
  } = useForm<ButtonFormData>();

  const isNewButton = mode === 'create' || !id;

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

  // Load button data for edit mode
  useEffect(() => {
    if (!isNewButton && id) {
      const fetchButton = async () => {
        try {
          setIsLoading(true);
          const button = await getButtonById(id);

          setButtonCode(button.buttonCode);
          setValue('buttonName', button.buttonName);
          setOriginalButtonName(button.buttonName); // Store original for comparison
          setValue('supplierCode', button.supplierCode || '');
          setValue('buyerCode', button.buyerCode || '');
          setValue('size', button.size || '');
          setValue('holes', button.holes?.toString() || '');
          setValue('color', button.color || '');
          setValue('material', button.material || '');
          setValue('shape', button.shape || '');
          setValue('pricePerPiece', button.pricePerPiece?.toString() || '');
          setValue('pricePerGross', button.pricePerGross?.toString() || '');
          setValue('description', button.description || '');

          // Set suppliers from junction table
          if (button.buttonSuppliers && button.buttonSuppliers.length > 0) {
            setSuppliers(
              button.buttonSuppliers.map((s) => ({
                supplierId: s.supplierId,
                isPreferred: s.isPreferred,
                isActive: s.isActive,
                notes: s.notes || '',
                pricePerPiece: s.pricePerPiece?.toString() || '',
                pricePerGross: s.pricePerGross?.toString() || '',
              }))
            );
          }

          // Set style codes
          if (button.styleCodes && button.styleCodes.length > 0) {
            setSelectedStyleCodes(button.styleCodes);
          }
        } catch (err: unknown) {
          const errorMessage = handleApiError(err, 'Failed to load button', false);
          setError(errorMessage);
        } finally {
          setIsLoading(false);
        }
      };
      fetchButton();
    }
  }, [id, isNewButton, setValue]);

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
        pricePerGross: '',
      },
    ]);
  };

  const handleRemoveSupplier = (index: number) => {
    setSuppliers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSupplierChange = (index: number, field: keyof ButtonSupplierInput, value: string | boolean) => {
    setSuppliers((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const onSubmit = async (data: ButtonFormData) => {
    try {
      setIsLoading(true);
      setError(null);

      // Validate suppliers have valid supplier IDs
      const validSuppliers = suppliers.filter((s) => s.supplierId);

      // If name wasn't manually edited (or is same as original), send empty to trigger auto-regeneration
      const shouldAutoGenerateName = !isNewButton && !nameManuallyEdited && data.buttonName === originalButtonName;

      const payload: ButtonFormData = {
        ...data,
        buttonName: shouldAutoGenerateName ? '' : data.buttonName, // Empty triggers regeneration
        holes: data.holes ? Number(data.holes) : undefined,
        pricePerPiece: data.pricePerPiece ? Number(data.pricePerPiece) : undefined,
        pricePerGross: data.pricePerGross ? Number(data.pricePerGross) : undefined,
        styleCodes: selectedStyleCodes,
        suppliers: validSuppliers,
      };

      if (isNewButton) {
        await createButton(payload);
        handleApiSuccess('Button created', 'Button item has been successfully created.');
      } else if (id) {
        await updateButton(id, payload);
        handleApiSuccess('Button updated', 'Button item has been successfully updated.');
      }

      navigate('/materials/button');
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, `Failed to ${isNewButton ? 'create' : 'update'} button`, false);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !isNewButton) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Loading button...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>{isNewButton ? 'Create New Button' : 'Edit Button'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && <div className="bg-red-50 text-red-600 p-4 rounded-md">{error}</div>}

            {/* BUTTON INFORMATION */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Button Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Button Code - Auto-generated */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                    Button Code
                    {isNewButton && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Auto-generated</span>
                    )}
                  </label>
                  {!isNewButton && buttonCode ? (
                    <div className="mt-2">
                      <Badge variant="secondary" className="font-mono text-sm">
                        {buttonCode}
                      </Badge>
                      <p className="text-xs text-gray-500 mt-1">
                        This code is automatically generated and cannot be changed
                      </p>
                    </div>
                  ) : (
                    <>
                      <Input
                        id="buttonCode"
                        value=""
                        readOnly
                        placeholder="Will be auto-generated (e.g., BTN-000001)"
                        className="bg-gray-50 cursor-not-allowed"
                      />
                      <p className="text-xs text-gray-500 mt-1">Code will be automatically assigned upon creation</p>
                    </>
                  )}
                </div>

                {/* Button Name */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                    Button Name
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Auto-generated</span>
                  </label>
                  <Input
                    id="buttonName"
                    {...register('buttonName', {
                      onChange: (e) => {
                        // Mark as manually edited if user types something different
                        if (e.target.value !== originalButtonName) {
                          setNameManuallyEdited(true);
                        }
                      },
                    })}
                    placeholder="Leave empty to auto-generate from color, material, holes, size, etc."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {isNewButton
                      ? 'If left empty, name will be auto-generated from attributes (e.g., "[Buyer-Code] Color Material Holes Button Size")'
                      : 'Name will auto-update when you change attributes. Edit manually to override.'}
                  </p>
                </div>

                {/* Size */}
                <div>
                  <Label htmlFor="size">Size</Label>
                  <Input id="size" {...register('size')} placeholder="e.g., 15mm, 18L, 1/2 inch" />
                </div>

                {/* Holes */}
                <div>
                  <Label htmlFor="holes">Holes</Label>
                  <Input id="holes" type="number" {...register('holes')} placeholder="e.g., 2, 4" />
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

                {/* Material */}
                <div>
                  <Label htmlFor="material">Material</Label>
                  <Input id="material" {...register('material')} placeholder="e.g., Plastic, Metal, Wood" />
                </div>

                {/* Shape */}
                <div>
                  <Label htmlFor="shape">Shape</Label>
                  <Input id="shape" {...register('shape')} placeholder="e.g., Round, Square, Oval" />
                </div>

                {/* Price Per Piece */}
                <div>
                  <Label htmlFor="pricePerPiece">Price per Piece (₹)</Label>
                  <Input
                    id="pricePerPiece"
                    type="number"
                    step="0.01"
                    {...register('pricePerPiece')}
                    placeholder="e.g., 0.50"
                  />
                </div>

                {/* Price Per Gross */}
                <div>
                  <Label htmlFor="pricePerGross">Price per Gross (₹)</Label>
                  <Input
                    id="pricePerGross"
                    type="number"
                    step="0.01"
                    {...register('pricePerGross')}
                    placeholder="e.g., 72.00"
                  />
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
                            placeholder="e.g., 0.50"
                          />
                        </div>

                        {/* Price per Gross */}
                        <div>
                          <Label>Price/Gross (₹)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={supplier.pricePerGross || ''}
                            onChange={(e) => handleSupplierChange(index, 'pricePerGross', e.target.value)}
                            placeholder="e.g., 72.00"
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

            {/* STYLE ASSOCIATIONS */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Style Associations</h3>
              <StyleCodeMultiSelect
                value={selectedStyleCodes}
                onChange={setSelectedStyleCodes}
                label="Associated Styles"
                placeholder="Search and select styles to associate with this button..."
                helpText="Select one or more styles that use this button. The first selected style will be marked as primary and included in the auto-generated name."
              />
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
                  placeholder="Additional notes or details about this button..."
                />
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex gap-4 justify-end pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/materials/button')}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : isNewButton ? 'Create Button' : 'Update Button'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
