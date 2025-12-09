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
import type { ColorSearchResult } from '@/types/color.types';
import { createButton, getButtonById, updateButton } from '@/services/button.service';
import { getAllSuppliers } from '@/services/supplier.service';
import type { ButtonFormData } from '@/types/button.types';
import type { Supplier } from '@/types/supplier.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';

interface ButtonFormProps {
  mode?: 'create' | 'edit';
}

export default function ButtonForm({ mode = 'create' }: ButtonFormProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [buttonCode, setButtonCode] = useState<string>('');
  const [selectedStyleCodes, setSelectedStyleCodes] = useState<string[]>([]);
  const [selectedColorId, setSelectedColorId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ButtonFormData>();

  const isNewButton = mode === 'create' || !id;

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

  // Load button data for edit mode
  useEffect(() => {
    if (!isNewButton && id) {
      const fetchButton = async () => {
        try {
          setIsLoading(true);
          const button = await getButtonById(id);

          setButtonCode(button.buttonCode);
          setValue('buttonName', button.buttonName);
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

          if (button.supplierId) {
            setSelectedSupplierId(button.supplierId);
            setValue('supplierId', button.supplierId);
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

  const onSubmit = async (data: ButtonFormData) => {
    try {
      setIsLoading(true);
      setError(null);

      // Button name is now auto-generated, no validation needed

      const payload: ButtonFormData = {
        ...data,
        supplierId: selectedSupplierId || undefined,
        holes: data.holes ? Number(data.holes) : undefined,
        pricePerPiece: data.pricePerPiece ? Number(data.pricePerPiece) : undefined,
        pricePerGross: data.pricePerGross ? Number(data.pricePerGross) : undefined,
        styleCodes: selectedStyleCodes,
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
      const errorMessage = handleApiError(
        err,
        `Failed to ${isNewButton ? 'create' : 'update'} button`,
        false
      );
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
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-md">
                {error}
              </div>
            )}

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
                      <p className="text-xs text-gray-500 mt-1">
                        Code will be automatically assigned upon creation
                      </p>
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
                    {...register('buttonName')}
                    placeholder="Leave empty to auto-generate from color, material, holes, size, etc."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    If left empty, name will be auto-generated from attributes (e.g., "[Buyer-Code] Color Material Holes Button Size")
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

                {/* Size */}
                <div>
                  <Label htmlFor="size">Size</Label>
                  <Input
                    id="size"
                    {...register('size')}
                    placeholder="e.g., 15mm, 18L, 1/2 inch"
                  />
                </div>

                {/* Holes */}
                <div>
                  <Label htmlFor="holes">Holes</Label>
                  <Input
                    id="holes"
                    type="number"
                    {...register('holes')}
                    placeholder="e.g., 2, 4"
                  />
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
                  <Input
                    id="material"
                    {...register('material')}
                    placeholder="e.g., Plastic, Metal, Wood"
                  />
                </div>

                {/* Shape */}
                <div>
                  <Label htmlFor="shape">Shape</Label>
                  <Input
                    id="shape"
                    {...register('shape')}
                    placeholder="e.g., Round, Square, Oval"
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
