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
import { createThread, getThreadById, updateThread } from '@/services/thread.service';
import { getAllSuppliers } from '@/services/supplier.service';
import type { ThreadFormData } from '@/types/thread.types';
import type { Supplier } from '@/types/supplier.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';

interface ThreadFormProps {
  mode?: 'create' | 'edit';
}

export default function ThreadForm({ mode = 'create' }: ThreadFormProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [threadCode, setThreadCode] = useState<string>('');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ThreadFormData>();

  const isNewThread = mode === 'create' || !id;

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
          setValue('threadCount', thread.threadCount || '');
          setValue('color', thread.color || '');
          setValue('colorCode', thread.colorCode || '');
          setValue('composition', thread.composition || '');
          setValue('threadType', thread.threadType || '');
          setValue('coneSize', thread.coneSize || '');
          setValue('pricePerCone', thread.pricePerCone?.toString() || '');
          setValue('description', thread.description || '');

          if (thread.supplierId) {
            setSelectedSupplierId(thread.supplierId);
            setValue('supplierId', thread.supplierId);
          }
        } catch (err: any) {
          const errorMessage = handleApiError(err, 'Failed to load thread', false);
          setError(errorMessage);
        } finally {
          setIsLoading(false);
        }
      };
      fetchThread();
    }
  }, [id, isNewThread, setValue]);

  const onSubmit = async (data: ThreadFormData) => {
    try {
      setIsLoading(true);
      setError(null);

      // Validate required fields
      if (!data.threadName || data.threadName.trim() === '') {
        setError('Thread name is required');
        setIsLoading(false);
        return;
      }

      const payload: ThreadFormData = {
        ...data,
        supplierId: selectedSupplierId || undefined,
        pricePerCone: data.pricePerCone ? Number(data.pricePerCone) : undefined,
      };

      if (isNewThread) {
        await createThread(payload);
        handleApiSuccess('Thread created', 'Thread item has been successfully created.');
      } else if (id) {
        await updateThread(id, payload);
        handleApiSuccess('Thread updated', 'Thread item has been successfully updated.');
      }

      navigate('/materials/thread');
    } catch (err: any) {
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
                {/* Thread Code - Read Only for Edit */}
                {!isNewThread && threadCode && (
                  <div className="md:col-span-2">
                    <Label htmlFor="threadCode">Thread Code (Auto-generated)</Label>
                    <div className="mt-2">
                      <Badge variant="secondary" className="font-mono text-sm">
                        {threadCode}
                      </Badge>
                      <p className="text-xs text-gray-500 mt-1">
                        This code is automatically generated and cannot be changed
                      </p>
                    </div>
                  </div>
                )}

                {/* Thread Name */}
                <div className="md:col-span-2">
                  <Label htmlFor="threadName">Thread Name *</Label>
                  <Input
                    id="threadName"
                    {...register('threadName', { required: 'Thread name is required' })}
                    placeholder="e.g., Polyester Thread 40/2"
                  />
                  {errors.threadName && (
                    <p className="text-sm text-red-600 mt-1">{errors.threadName.message}</p>
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

                {/* Thread Count */}
                <div>
                  <Label htmlFor="threadCount">Thread Count</Label>
                  <Input
                    id="threadCount"
                    {...register('threadCount')}
                    placeholder="e.g., 40/2, 60/3"
                  />
                </div>

                {/* Color */}
                <div>
                  <Label htmlFor="color">Color</Label>
                  <Input
                    id="color"
                    {...register('color')}
                    placeholder="e.g., White, Black, Navy Blue"
                  />
                </div>

                {/* Color Code */}
                <div>
                  <Label htmlFor="colorCode">Color Code</Label>
                  <Input
                    id="colorCode"
                    {...register('colorCode')}
                    placeholder="e.g., #FFFFFF, RAL 9010"
                  />
                </div>

                {/* Composition */}
                <div>
                  <Label htmlFor="composition">Composition</Label>
                  <Input
                    id="composition"
                    {...register('composition')}
                    placeholder="e.g., 100% Polyester, Cotton Blend"
                  />
                </div>

                {/* Thread Type */}
                <div>
                  <Label htmlFor="threadType">Thread Type</Label>
                  <Input
                    id="threadType"
                    {...register('threadType')}
                    placeholder="e.g., Spun, Filament, Core-spun"
                  />
                </div>

                {/* Cone Size */}
                <div>
                  <Label htmlFor="coneSize">Cone Size</Label>
                  <Input
                    id="coneSize"
                    {...register('coneSize')}
                    placeholder="e.g., 5000m, 3000yds"
                  />
                </div>

                {/* Price Per Cone */}
                <div>
                  <Label htmlFor="pricePerCone">Price per Cone (₹)</Label>
                  <Input
                    id="pricePerCone"
                    type="number"
                    step="0.01"
                    {...register('pricePerCone')}
                    placeholder="e.g., 125.50"
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
