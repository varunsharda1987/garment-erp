import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { SupplierCombobox } from '@/components/SupplierCombobox';
import { createMachinePart, getMachinePartById, updateMachinePart } from '@/services/machinePart.service';
import type { CreateMachinePartRequest, UpdateMachinePartRequest, MachinePart } from '@/types/machinePart.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { Plus, Trash2 } from 'lucide-react';

interface MachinePartFormProps {
  mode?: 'create' | 'edit';
}

interface SupplierInput {
  supplierId: string;
  isPreferred: boolean;
  isActive: boolean;
  notes: string;
  pricePerUnit: string;
}

export default function MachinePartForm({ mode = 'create' }: MachinePartFormProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partCode, setPartCode] = useState<string>('');
  const [suppliers, setSuppliers] = useState<SupplierInput[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CreateMachinePartRequest>();

  const isNewPart = mode === 'create' || !id;

  // Load machine part data for edit mode
  useEffect(() => {
    if (!isNewPart && id) {
      const fetchPart = async () => {
        try {
          setIsLoading(true);
          const part: MachinePart = await getMachinePartById(id);

          setPartCode(part.partCode);
          setValue('partName', part.partName);
          setValue('partNumber', part.partNumber || '');
          setValue('category', part.category || '');
          setValue('machine', part.machine || '');
          setValue('brand', part.brand || '');
          setValue('model', part.model || '');
          setValue('specifications', part.specifications || '');
          setValue('pricePerUnit', part.pricePerUnit ?? undefined);
          setValue('description', part.description || '');

          // Set suppliers from junction table
          if (part.machinePartSuppliers && part.machinePartSuppliers.length > 0) {
            setSuppliers(
              part.machinePartSuppliers.map((s) => ({
                supplierId: s.supplierId,
                isPreferred: s.isPreferred,
                isActive: s.isActive,
                notes: s.notes || '',
                pricePerUnit: s.pricePerUnit?.toString() || '',
              }))
            );
          }
        } catch (err: unknown) {
          const errorMessage = handleApiError(err, 'Failed to load machine part', false);
          setError(errorMessage);
        } finally {
          setIsLoading(false);
        }
      };
      fetchPart();
    }
  }, [id, isNewPart, setValue]);

  // Supplier management functions
  const handleAddSupplier = () => {
    setSuppliers((prev) => [
      ...prev,
      {
        supplierId: '',
        isPreferred: prev.length === 0, // First supplier is preferred by default
        isActive: true,
        notes: '',
        pricePerUnit: '',
      },
    ]);
  };

  const handleRemoveSupplier = (index: number) => {
    setSuppliers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSupplierChange = (index: number, field: keyof SupplierInput, value: string | boolean) => {
    setSuppliers((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const onSubmit = async (data: CreateMachinePartRequest) => {
    try {
      setIsLoading(true);
      setError(null);

      // Validate suppliers have valid supplier IDs
      const validSuppliers = suppliers
        .filter((s) => s.supplierId)
        .map((s) => ({
          supplierId: s.supplierId,
          isPreferred: s.isPreferred,
          isActive: s.isActive,
          notes: s.notes || undefined,
          pricePerUnit: s.pricePerUnit ? Number(s.pricePerUnit) : undefined,
        }));

      const payload: CreateMachinePartRequest | UpdateMachinePartRequest = {
        ...data,
        pricePerUnit: data.pricePerUnit ? Number(data.pricePerUnit) : undefined,
        suppliers: validSuppliers,
      };

      if (isNewPart) {
        await createMachinePart(payload as CreateMachinePartRequest);
        handleApiSuccess('Machine Part created', 'Machine part has been successfully created.');
      } else if (id) {
        await updateMachinePart(id, payload as UpdateMachinePartRequest);
        handleApiSuccess('Machine Part updated', 'Machine part has been successfully updated.');
      }

      navigate('/materials/machine-part');
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, `Failed to ${isNewPart ? 'create' : 'update'} machine part`, false);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !isNewPart) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Loading machine part...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>{isNewPart ? 'Create New Machine Part' : 'Edit Machine Part'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && <div className="bg-destructive/10 text-destructive p-4 rounded-md">{error}</div>}

            {/* PART INFORMATION */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-foreground">Part Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Part Code - Auto-generated */}
                <div className="md:col-span-2">
                  <Label>
                    Part Code
                    {isNewPart && (
                      <span className="ml-2 text-xs bg-info-muted text-info px-2 py-0.5 rounded">Auto-generated</span>
                    )}
                  </Label>
                  {!isNewPart && partCode ? (
                    <Badge variant="outline" className="font-mono mt-2">
                      {partCode}
                    </Badge>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1">Will be generated automatically</p>
                  )}
                </div>

                {/* Part Name */}
                <div className="md:col-span-2">
                  <Label htmlFor="partName">Part Name *</Label>
                  <Input
                    id="partName"
                    {...register('partName', { required: 'Part name is required' })}
                    placeholder="e.g., Needle Set Industrial, Bobbin Case"
                  />
                  {errors.partName && <p className="text-destructive text-sm mt-1">{errors.partName.message}</p>}
                </div>

                {/* Part Number */}
                <div>
                  <Label htmlFor="partNumber">Part Number</Label>
                  <Input id="partNumber" {...register('partNumber')} placeholder="Manufacturer part number" />
                </div>

                {/* Category */}
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Input id="category" {...register('category')} placeholder="e.g., Needle, Bobbin, Belt, Motor" />
                </div>

                {/* Machine */}
                <div>
                  <Label htmlFor="machine">Machine</Label>
                  <Input id="machine" {...register('machine')} placeholder="e.g., Single Needle Lockstitch" />
                </div>

                {/* Brand */}
                <div>
                  <Label htmlFor="brand">Brand</Label>
                  <Input id="brand" {...register('brand')} placeholder="e.g., Juki, Brother, Groz-Beckert" />
                </div>

                {/* Model */}
                <div>
                  <Label htmlFor="model">Model</Label>
                  <Input id="model" {...register('model')} placeholder="Model number" />
                </div>

                {/* Price Per Unit */}
                <div>
                  <Label htmlFor="pricePerUnit">Price Per Unit (₹)</Label>
                  <Input id="pricePerUnit" type="number" step="0.01" {...register('pricePerUnit')} placeholder="0.00" />
                </div>

                {/* Specifications */}
                <div className="md:col-span-2">
                  <Label htmlFor="specifications">Specifications</Label>
                  <Textarea
                    id="specifications"
                    {...register('specifications')}
                    placeholder="Technical specifications, dimensions, etc."
                    rows={3}
                  />
                </div>

                {/* Description */}
                <div className="md:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    {...register('description')}
                    placeholder="Additional notes or description"
                    rows={2}
                  />
                </div>
              </div>
            </div>

            {/* SUPPLIERS */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-foreground">Suppliers</h3>
                <Button type="button" variant="outline" size="sm" onClick={handleAddSupplier}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Supplier
                </Button>
              </div>

              {suppliers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No suppliers added. Click "Add Supplier" to add one.</p>
              ) : (
                <div className="space-y-4">
                  {suppliers.map((supplier, index) => (
                    <div key={index} className="p-4 border rounded-lg bg-muted">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <Label>Supplier *</Label>
                          <SupplierCombobox
                            value={supplier.supplierId || ''}
                            onValueChange={(value) => handleSupplierChange(index, 'supplierId', value)}
                            placeholder="Select supplier..."
                            categoryFilter="MACHINE_PARTS_SUPPLIER"
                          />
                        </div>

                        <div>
                          <Label>Price Per Unit (₹)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={supplier.pricePerUnit}
                            onChange={(e) => handleSupplierChange(index, 'pricePerUnit', e.target.value)}
                            placeholder="0.00"
                          />
                        </div>

                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={supplier.isPreferred}
                              onChange={(e) => handleSupplierChange(index, 'isPreferred', e.target.checked)}
                              className="rounded"
                            />
                            <span className="text-sm">Preferred</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={supplier.isActive}
                              onChange={(e) => handleSupplierChange(index, 'isActive', e.target.checked)}
                              className="rounded"
                            />
                            <span className="text-sm">Active</span>
                          </label>
                        </div>

                        <div className="md:col-span-2">
                          <Label>Notes</Label>
                          <Textarea
                            value={supplier.notes}
                            onChange={(e) => handleSupplierChange(index, 'notes', e.target.value)}
                            placeholder="Additional notes"
                            rows={2}
                          />
                        </div>
                      </div>

                      <div className="mt-3 flex justify-end">
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRemoveSupplier(index)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* FORM ACTIONS */}
            <div className="flex justify-end gap-3 pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/materials/machine-part')}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : isNewPart ? 'Create Machine Part' : 'Update Machine Part'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
