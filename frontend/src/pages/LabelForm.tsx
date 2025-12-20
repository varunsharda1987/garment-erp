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
import { getAllCustomers } from '@/services/customer.service';
import { getAllSizeCategories } from '@/services/sizeCategory.service';
import type { LabelFormData, LabelSupplierInput } from '@/types/label.types';
import type { Supplier } from '@/types/supplier.types';
import type { Customer, BrandCategory } from '@/types/customer.types';
import type { SizeCategory } from '@/types/sizeCategory.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { Plus, Trash2, Info } from 'lucide-react';

interface LabelFormProps {
  mode?: 'create' | 'edit';
}

export default function LabelForm({ mode = 'create' }: LabelFormProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableSuppliers, setAvailableSuppliers] = useState<Supplier[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [brandCategoryId, setBrandCategoryId] = useState<string>('');
  const [availableBrands, setAvailableBrands] = useState<BrandCategory[]>([]);
  const [labelCode, setLabelCode] = useState<string>('');
  const [suppliers, setSuppliers] = useState<LabelSupplierInput[]>([]);
  const [labelCategory, setLabelCategory] = useState<string>('SEWN_IN');
  const [labelTypeValue, setLabelTypeValue] = useState<string>('');
  const [sizeCategories, setSizeCategories] = useState<SizeCategory[]>([]);
  const [sizeCategoryId, setSizeCategoryId] = useState<string>('');
  const [generateSizeVariants, setGenerateSizeVariants] = useState<boolean>(false);

  // Predefined label types for matching
  const PREDEFINED_LABEL_TYPES = [
    'Washcare Label', 'Size Label', 'Main Cum Size Label', 'Brand Label',
    'Loop Tag', 'Traceability Label', 'Barcode Label', 'Country of Origin',
    'Composition Label', 'Hangtag', 'Price Tag'
  ];

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LabelFormData>();

  const isNewLabel = mode === 'create' || !id;

  // Load available suppliers (filtered by TRIMS_SUPPLIER category), customers, and size categories
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const response = await getAllSuppliers({ limit: 100, category: 'TRIMS_SUPPLIER' });
        setAvailableSuppliers(response.data);
      } catch (err) {
        console.error('Failed to fetch suppliers:', err);
      }
    };
    const fetchCustomers = async () => {
      try {
        const response = await getAllCustomers({ limit: 200 });
        setCustomers(response.data);
      } catch (err) {
        console.error('Failed to fetch customers:', err);
      }
    };
    const fetchSizeCategories = async () => {
      try {
        const response = await getAllSizeCategories({ limit: 100, isActive: true });
        setSizeCategories(response.data);
      } catch (err) {
        console.error('Failed to fetch size categories:', err);
      }
    };
    fetchSuppliers();
    fetchCustomers();
    fetchSizeCategories();
  }, []);

  // Load brands when customer changes
  useEffect(() => {
    if (selectedCustomerId) {
      const customer = customers.find(c => c.id === selectedCustomerId);
      if (customer) {
        // Extract brands from brandCategories
        if (customer.brandCategories && Array.isArray(customer.brandCategories) && customer.brandCategories.length > 0) {
          setAvailableBrands(customer.brandCategories);
        } else {
          setAvailableBrands([]);
        }
      }
    } else {
      setAvailableBrands([]);
      setBrandCategoryId('');
    }
  }, [selectedCustomerId, customers]);

  // Load label data for edit mode
  useEffect(() => {
    if (!isNewLabel && id) {
      const fetchLabel = async () => {
        try {
          setIsLoading(true);
          const label = await getLabelById(id);

          setLabelCode(label.labelCode);
          setLabelCategory(label.labelCategory || 'SEWN_IN');
          setSelectedCustomerId(label.customerId || '');
          setBrandCategoryId(label.brandCategoryId || '');
          setValue('labelName', label.labelName);
          setValue('supplierCode', label.supplierCode || '');
          // Set label type - check if it's a predefined type or custom
          const loadedLabelType = label.labelType || '';
          if (PREDEFINED_LABEL_TYPES.includes(loadedLabelType)) {
            setLabelTypeValue(loadedLabelType);
          } else if (loadedLabelType) {
            setLabelTypeValue('OTHER');
            setValue('labelType', loadedLabelType);
          }
          setValue('labelType', loadedLabelType);
          setValue('size', label.size || '');
          setValue('content', label.content || '');
          setValue('fabricContent', label.fabricContent || '');
          setValue('washcareInstructions', label.washcareInstructions || '');
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

  // Customer change handler - resets brand when customer changes
  const handleCustomerChange = (value: string) => {
    const newCustomerId = value === '_none_' ? '' : value;
    setSelectedCustomerId(newCustomerId);
    // Reset brand when customer changes
    if (newCustomerId !== selectedCustomerId) {
      setBrandCategoryId('');
    }
  };

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

      // Determine the final label type value
      const finalLabelType = labelTypeValue === 'OTHER' ? data.labelType : labelTypeValue;

      const payload: LabelFormData = {
        ...data,
        labelCategory,
        labelType: finalLabelType || undefined,
        customerId: selectedCustomerId || undefined,
        brandCategoryId: brandCategoryId || undefined,
        sizeCategoryId: sizeCategoryId || undefined,
        generateSizeVariants: generateSizeVariants && !!sizeCategoryId,
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

                {/* Label Category */}
                <div>
                  <Label htmlFor="labelCategory">Label Category <span className="text-red-500">*</span></Label>
                  <Select
                    value={labelCategory}
                    onValueChange={(value) => setLabelCategory(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SEWN_IN">Sewn-in Label (Care/Size Labels)</SelectItem>
                      <SelectItem value="HANGTAG">Hangtag</SelectItem>
                      <SelectItem value="PRICE_TAG">Price Tag</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    Sewn-in labels appear in Trims; Hangtags/Price tags appear in Accessories
                  </p>
                </div>

                {/* Customer */}
                <div>
                  <Label htmlFor="customerId">Customer (Optional)</Label>
                  <Select
                    value={selectedCustomerId || '_none_'}
                    onValueChange={handleCustomerChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none_">No Customer (Generic Label)</SelectItem>
                      {customers.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} ({c.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    Link this label to a specific customer for customer-specific pricing/design
                  </p>
                </div>

                {/* Brand - only shown when customer is selected */}
                {selectedCustomerId && (
                  <div>
                    <Label htmlFor="brandCategoryId">Brand (Optional)</Label>
                    <Select
                      value={brandCategoryId || '_none_'}
                      onValueChange={(value) => setBrandCategoryId(value === '_none_' ? '' : value)}
                      disabled={!availableBrands.length}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={availableBrands.length > 0 ? "Select brand..." : "No brands available"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none_">No Brand (Customer-Generic)</SelectItem>
                        {availableBrands.map(brand => (
                          <SelectItem key={brand.id} value={brand.id}>
                            {brand.brandName} {brand.category && `- ${brand.category}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!availableBrands.length && (
                      <p className="text-xs text-yellow-600 mt-1">
                        This customer has no brands configured. Add brands in Customer form.
                      </p>
                    )}
                    {availableBrands.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        Link to a specific brand within this customer
                      </p>
                    )}
                  </div>
                )}

                {/* Label Type */}
                <div>
                  <Label htmlFor="labelType">Label Type</Label>
                  <Select
                    value={labelTypeValue}
                    onValueChange={(value) => {
                      setLabelTypeValue(value);
                      setValue('labelType', value === 'OTHER' ? '' : value);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select label type..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Washcare Label">Washcare Label</SelectItem>
                      <SelectItem value="Size Label">Size Label</SelectItem>
                      <SelectItem value="Main Cum Size Label">Main Cum Size Label</SelectItem>
                      <SelectItem value="Brand Label">Brand Label</SelectItem>
                      <SelectItem value="Loop Tag">Loop Tag</SelectItem>
                      <SelectItem value="Traceability Label">Traceability Label</SelectItem>
                      <SelectItem value="Barcode Label">Barcode Label</SelectItem>
                      <SelectItem value="Country of Origin">Country of Origin</SelectItem>
                      <SelectItem value="Composition Label">Composition Label</SelectItem>
                      <SelectItem value="Hangtag">Hangtag</SelectItem>
                      <SelectItem value="Price Tag">Price Tag</SelectItem>
                      <SelectItem value="OTHER">Other (Custom)</SelectItem>
                    </SelectContent>
                  </Select>
                  {labelTypeValue === 'OTHER' && (
                    <Input
                      id="labelType"
                      {...register('labelType')}
                      placeholder="Enter custom label type..."
                      className="mt-2"
                    />
                  )}
                </div>

                {/* Size */}
                <div>
                  <Label htmlFor="size">Size (Physical Dimensions)</Label>
                  <Input
                    id="size"
                    {...register('size')}
                    placeholder="e.g., 2x3 inches, 50mm x 75mm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Physical dimensions of the label
                  </p>
                </div>

                {/* Size Category for Size Variants */}
                <div className="md:col-span-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Label htmlFor="sizeCategoryId">Size Variants (Optional)</Label>
                    <Info className="h-4 w-4 text-gray-400" />
                  </div>
                  <Select
                    value={sizeCategoryId || '_none_'}
                    onValueChange={(value) => {
                      const newValue = value === '_none_' ? '' : value;
                      setSizeCategoryId(newValue);
                      if (!newValue) {
                        setGenerateSizeVariants(false);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select size category..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none_">No Size Variants</SelectItem>
                      {sizeCategories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name} ({cat.sizes.length} sizes: {cat.sizes.join(', ')})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {sizeCategoryId && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          id="generateSizeVariants"
                          checked={generateSizeVariants}
                          onChange={(e) => setGenerateSizeVariants(e.target.checked)}
                          className="mt-1"
                        />
                        <label htmlFor="generateSizeVariants" className="text-sm text-blue-900 cursor-pointer">
                          <div className="font-medium">Auto-generate size variants</div>
                          <div className="text-xs text-blue-700 mt-1">
                            Create separate inventory entries for each size: {
                              sizeCategories.find(c => c.id === sizeCategoryId)?.sizes.join(', ')
                            }
                          </div>
                          <div className="text-xs text-blue-700 mt-1">
                            This allows independent stock tracking for each size
                          </div>
                        </label>
                      </div>
                    </div>
                  )}
                  {!sizeCategoryId && (
                    <p className="text-xs text-gray-500 mt-1">
                      Select a size category to enable auto-generation of size variants for inventory tracking
                    </p>
                  )}
                </div>

                {/* Fabric Content / Composition */}
                <div>
                  <Label htmlFor="fabricContent">Fabric Content / Composition</Label>
                  <Input
                    id="fabricContent"
                    {...register('fabricContent')}
                    placeholder="e.g., 100% Cotton, 60% Polyester 40% Cotton"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    The fabric composition to be printed on the label
                  </p>
                </div>

                {/* Washcare Instructions */}
                <div className="md:col-span-2">
                  <Label htmlFor="washcareInstructions">Washcare Instructions</Label>
                  <Textarea
                    id="washcareInstructions"
                    {...register('washcareInstructions')}
                    rows={2}
                    placeholder="e.g., Machine wash cold, tumble dry low, do not bleach, iron on low heat"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Care instructions for washing, drying, ironing, etc.
                  </p>
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
