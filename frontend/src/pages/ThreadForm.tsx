import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
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
import { createThread, getThreadById, updateThread } from '@/services/thread.service';
import { getAllSuppliers } from '@/services/supplier.service';
import type { ThreadFormData, ThreadSupplierInput, ThreadPackagingType } from '@/types/thread.types';
import type { Supplier } from '@/types/supplier.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { Plus, Trash2 } from 'lucide-react';

interface ThreadFormProps {
  mode?: 'create' | 'edit';
}

export default function ThreadForm({ mode = 'create' }: ThreadFormProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableSuppliers, setAvailableSuppliers] = useState<Supplier[]>([]);
  const [threadCode, setThreadCode] = useState<string>('');
  const [selectedStyleCodes, setSelectedStyleCodes] = useState<string[]>([]);
  const [selectedColorId, setSelectedColorId] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<ThreadSupplierInput[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<ThreadFormData>();

  // Watch packaging type for auto-setting piecesPerBox
  const watchedPackagingType = useWatch({ control, name: 'packagingType' });

  const isNewThread = mode === 'create' || !id;

  // Auto-set piecesPerBox when packagingType changes
  useEffect(() => {
    if (watchedPackagingType === 'CONE') {
      setValue('piecesPerBox', 6);
    } else if (watchedPackagingType === 'TUBE') {
      setValue('piecesPerBox', 10);
    }
  }, [watchedPackagingType, setValue]);

  // Load available suppliers (filtered by THREAD_SUPPLIER category)
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const response = await getAllSuppliers({ limit: 100, category: 'THREAD_SUPPLIER' });
        setAvailableSuppliers(response.data);
      } catch (err) {
        console.error('Failed to fetch suppliers:', err);
      }
    };
    fetchSuppliers();
  }, []);

  // Load thread data for edit mode
  useEffect(() => {
    if (!isNewThread && id) {
      const fetchThread = async () => {
        try {
          setIsLoading(true);
          const thread = await getThreadById(id);

          setThreadCode(thread.threadCode);
          setValue('threadName', thread.threadName);
          setValue('supplierCode', thread.supplierCode || '');
          setValue('buyerCode', thread.buyerCode || '');
          setValue('brand', thread.brand || '');
          setValue('packagingType', thread.packagingType || undefined);
          setValue('piecesPerBox', thread.piecesPerBox || undefined);
          setValue('metersPerUnit', thread.metersPerUnit?.toString() || '');
          setValue('color', thread.color || '');
          setValue('colorCode', thread.colorCode || '');
          setValue('coneSize', thread.coneSize || '');
          setValue('pricePerCone', thread.pricePerCone?.toString() || '');
          setValue('description', thread.description || '');

          // Set suppliers from junction table
          if (thread.threadSuppliers && thread.threadSuppliers.length > 0) {
            setSuppliers(thread.threadSuppliers.map(s => ({
              supplierId: s.supplierId,
              isPreferred: s.isPreferred,
              isActive: s.isActive,
              notes: s.notes || '',
              pricePerCone: s.pricePerCone?.toString() || '',
            })));
          }

          // Set style codes
          if (thread.styleCodes && thread.styleCodes.length > 0) {
            setSelectedStyleCodes(thread.styleCodes);
          }
        } catch (err: unknown) {
          const errorMessage = handleApiError(err, 'Failed to load thread', false);
          setError(errorMessage);
        } finally {
          setIsLoading(false);
        }
      };
      fetchThread();
    }
  }, [id, isNewThread, setValue]);

  // Supplier management functions
  const handleAddSupplier = () => {
    setSuppliers(prev => [...prev, {
      supplierId: '',
      isPreferred: prev.length === 0, // First supplier is preferred by default
      isActive: true,
      notes: '',
      pricePerCone: '',
    }]);
  };

  const handleRemoveSupplier = (index: number) => {
    setSuppliers(prev => prev.filter((_, i) => i !== index));
  };

  const handleSupplierChange = (index: number, field: keyof ThreadSupplierInput, value: string | boolean) => {
    setSuppliers(prev => prev.map((s, i) =>
      i === index ? { ...s, [field]: value } : s
    ));
  };

  const onSubmit = async (data: ThreadFormData) => {
    try {
      setIsLoading(true);
      setError(null);

      // Validate suppliers have valid supplier IDs
      const validSuppliers = suppliers.filter(s => s.supplierId);

      const payload: ThreadFormData = {
        ...data,
        metersPerUnit: data.metersPerUnit ? Number(data.metersPerUnit) : undefined,
        pricePerCone: data.pricePerCone ? Number(data.pricePerCone) : undefined,
        styleCodes: selectedStyleCodes,
        suppliers: validSuppliers,
      };

      if (isNewThread) {
        await createThread(payload);
        handleApiSuccess('Thread created', 'Thread item has been successfully created.');
      } else if (id) {
        await updateThread(id, payload);
        handleApiSuccess('Thread updated', 'Thread item has been successfully updated.');
      }

      navigate('/materials/thread');
    } catch (err: unknown) {
      const errorMessage = handleApiError(
        err,
        `Failed to ${isNewThread ? 'create' : 'update'} thread`,
        false
      );
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !isNewThread) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Loading thread...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>{isNewThread ? 'Create New Thread' : 'Edit Thread'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-md">
                {error}
              </div>
            )}

            {/* THREAD INFORMATION */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Thread Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Thread Code - Auto-generated */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                    Thread Code
                    {isNewThread && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Auto-generated</span>
                    )}
                  </label>
                  {!isNewThread && threadCode ? (
                    <div className="mt-2">
                      <Badge variant="secondary" className="font-mono text-sm">
                        {threadCode}
                      </Badge>
                      <p className="text-xs text-gray-500 mt-1">
                        This code is automatically generated and cannot be changed
                      </p>
                    </div>
                  ) : (
                    <>
                      <Input
                        id="threadCode"
                        value=""
                        readOnly
                        placeholder="Will be auto-generated (e.g., THD-000001)"
                        className="bg-gray-50 cursor-not-allowed"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Code will be automatically assigned upon creation
                      </p>
                    </>
                  )}
                </div>

                {/* Thread Name */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                    Thread Name
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Auto-generated</span>
                  </label>
                  <Input
                    id="threadName"
                    {...register('threadName')}
                    placeholder="Leave empty to auto-generate from brand, color, packaging type, etc."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    If left empty, name will be auto-generated from attributes (e.g., "[Buyer-Code] Brand Color CONE Thread 5000m")
                  </p>
                </div>

                {/* Brand */}
                <div>
                  <Label htmlFor="brand">Brand</Label>
                  <Input
                    id="brand"
                    {...register('brand')}
                    placeholder="e.g., Coats, Aster, Bells"
                  />
                </div>

                {/* Packaging Type */}
                <div>
                  <Label htmlFor="packagingType">Packaging Type</Label>
                  <Select
                    value={watchedPackagingType || undefined}
                    onValueChange={(value: ThreadPackagingType) => setValue('packagingType', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select packaging type..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CONE">Cone (6 pcs/box)</SelectItem>
                      <SelectItem value="TUBE">Tube (10 pcs/box)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Pieces per Box (read-only, auto-calculated) */}
                <div>
                  <Label htmlFor="piecesPerBox">Pieces per Box</Label>
                  <Input
                    id="piecesPerBox"
                    type="number"
                    {...register('piecesPerBox')}
                    readOnly
                    className="bg-gray-50 cursor-not-allowed"
                    placeholder="Auto-set based on packaging type"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Cone: 6 pcs/box | Tube: 10 pcs/box
                  </p>
                </div>

                {/* Meters per Unit */}
                <div>
                  <Label htmlFor="metersPerUnit">Meters per Unit</Label>
                  <Input
                    id="metersPerUnit"
                    type="number"
                    step="0.01"
                    {...register('metersPerUnit')}
                    placeholder="e.g., 5000, 1000"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Length in meters per cone/tube
                  </p>
                </div>

                {/* Color */}
                <div className="md:col-span-2">
                  <Label>Color</Label>
                  <ColorPicker
                    value={selectedColorId}
                    onChange={(colorId, color) => {
                      setSelectedColorId(colorId);
                      if (color) {
                        setValue('color', color.colorName);
                        setValue('colorCode', color.hexCode || '');
                      } else {
                        setValue('color', '');
                        setValue('colorCode', '');
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

                {/* Default Price Per Cone/Tube (for backward compatibility) */}
                <div>
                  <Label htmlFor="pricePerCone">Default Price per Cone/Tube (₹)</Label>
                  <Input
                    id="pricePerCone"
                    type="number"
                    step="0.01"
                    {...register('pricePerCone')}
                    placeholder="e.g., 125.50"
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
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

                        {/* Price per Cone */}
                        <div>
                          <Label>Price/Cone (₹)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={supplier.pricePerCone || ''}
                            onChange={(e) => handleSupplierChange(index, 'pricePerCone', e.target.value)}
                            placeholder="e.g., 125.50"
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
                placeholder="Search and select styles to associate with this thread..."
                helpText="Select one or more styles that use this thread. The first selected style will be marked as primary and included in the auto-generated name."
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
                  placeholder="Additional notes or details about this thread..."
                />
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex gap-4 justify-end pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/materials/thread')}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : isNewThread ? 'Create Thread' : 'Update Thread'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
