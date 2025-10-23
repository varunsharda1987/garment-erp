import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { createSupplier, getSupplierById, updateSupplier } from '../services/supplier.service';
import type { CreateSupplierRequest } from '../types/supplier.types';

interface SupplierFormProps {
  mode?: 'create' | 'edit';
}

type SupplierFormData = CreateSupplierRequest;

export default function SupplierForm({ mode = 'create' }: SupplierFormProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [materialCategories, setMaterialCategories] = useState<string[]>(['']);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<SupplierFormData>();

  const isNewSupplier = mode === 'create' || !id;

  // Auto-generate supplier code for new suppliers
  useEffect(() => {
    if (isNewSupplier) {
      const generateCode = () => {
        const timestamp = Date.now().toString().slice(-6);
        const randomNum = Math.floor(Math.random() * 100).toString().padStart(2, '0');
        return `SUP${timestamp}${randomNum}`;
      };
      setValue('code', generateCode());
    }
  }, [isNewSupplier, setValue]);

  // Load supplier data for edit mode
  useEffect(() => {
    if (!isNewSupplier && id) {
      const fetchSupplier = async () => {
        try {
          setIsLoading(true);
          const supplier = await getSupplierById(id);

          // Set form values
          setValue('code', supplier.code);
          setValue('name', supplier.name);
          setValue('contactPerson', supplier.contactPerson || '');
          setValue('email', supplier.email || '');
          setValue('phone', supplier.phone || '');
          setValue('address', supplier.address || '');
          setValue('gstNumber', supplier.gstNumber || '');
          setValue('paymentTerms', supplier.paymentTerms || '');
          setValue('creditLimit', supplier.creditLimit || undefined);
          setValue('creditDays', supplier.creditDays || undefined);
          setValue('rating', supplier.rating || 0);

          // Parse material categories
          if (supplier.materialCategories) {
            const categories = supplier.materialCategories.split('\n').filter(c => c.trim());
            setMaterialCategories(categories.length > 0 ? categories : ['']);
          }
        } catch (err: any) {
          setError(err.response?.data?.message || 'Failed to load supplier');
        } finally {
          setIsLoading(false);
        }
      };
      fetchSupplier();
    }
  }, [id, isNewSupplier, setValue]);

  // Handle material category changes
  const handleMaterialCategoryChange = (index: number, value: string) => {
    const newCategories = [...materialCategories];
    newCategories[index] = value;
    setMaterialCategories(newCategories);
  };

  const addMaterialCategory = () => {
    setMaterialCategories([...materialCategories, '']);
  };

  const removeMaterialCategory = (index: number) => {
    if (materialCategories.length > 1) {
      setMaterialCategories(materialCategories.filter((_, i) => i !== index));
    }
  };

  const onSubmit = async (data: SupplierFormData) => {
    try {
      setIsLoading(true);
      setError(null);

      // Join material categories with newlines
      const materialCategoriesString = materialCategories.filter(c => c.trim()).join('\n');

      const payload = {
        ...data,
        materialCategories: materialCategoriesString,
        creditLimit: data.creditLimit ? Number(data.creditLimit) : undefined,
        creditDays: data.creditDays ? Number(data.creditDays) : undefined,
        rating: data.rating ? Number(data.rating) : undefined,
      };

      if (isNewSupplier) {
        await createSupplier(payload);
      } else if (id) {
        await updateSupplier(id, payload);
      }

      navigate('/suppliers');
    } catch (err: any) {
      setError(err.response?.data?.message || `Failed to ${isNewSupplier ? 'create' : 'update'} supplier`);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !isNewSupplier) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Loading supplier...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>{isNewSupplier ? 'Create New Supplier' : 'Edit Supplier'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-md">
                {error}
              </div>
            )}

            {/* Supplier Information */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Supplier Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="code">Supplier Code *</Label>
                  <Input
                    id="code"
                    {...register('code', { required: 'Supplier code is required' })}
                    readOnly
                    className="bg-gray-100"
                  />
                  {errors.code && (
                    <p className="text-red-600 text-sm mt-1">{errors.code.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="name">Supplier Name *</Label>
                  <Input
                    id="name"
                    {...register('name', { required: 'Supplier name is required' })}
                  />
                  {errors.name && (
                    <p className="text-red-600 text-sm mt-1">{errors.name.message}</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <Label>Material Categories</Label>
                  <p className="text-sm text-gray-500 mb-2">
                    e.g., Fabric, Trims, Accessories, Buttons, Zippers
                  </p>
                  <div className="space-y-2">
                    {materialCategories.map((category, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          value={category}
                          onChange={(e) => handleMaterialCategoryChange(index, e.target.value)}
                          placeholder={`Category ${index + 1}`}
                          className="flex-1"
                        />
                        {materialCategories.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => removeMaterialCategory(index)}
                            className="px-3"
                          >
                            ×
                          </Button>
                        )}
                        {index === materialCategories.length - 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={addMaterialCategory}
                            className="px-3"
                          >
                            +
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="rating">Rating (0-5)</Label>
                  <Input
                    id="rating"
                    type="number"
                    min="0"
                    max="5"
                    {...register('rating')}
                  />
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contactPerson">Contact Person</Label>
                  <Input id="contactPerson" {...register('contactPerson')} />
                </div>

                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    {...register('email', {
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: 'Invalid email address',
                      },
                    })}
                  />
                  {errors.email && (
                    <p className="text-red-600 text-sm mt-1">{errors.email.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    {...register('phone')}
                    maxLength={10}
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea id="address" {...register('address')} rows={3} />
                </div>
              </div>
            </div>

            {/* Business Details */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Business Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="gstNumber">GST Number</Label>
                  <Input
                    id="gstNumber"
                    {...register('gstNumber')}
                    maxLength={15}
                  />
                </div>

                <div>
                  <Label htmlFor="paymentTerms">Payment Terms</Label>
                  <Input
                    id="paymentTerms"
                    {...register('paymentTerms')}
                    placeholder="e.g., Net 30, Net 60"
                  />
                </div>

                <div>
                  <Label htmlFor="creditLimit">Credit Limit (₹)</Label>
                  <Input
                    id="creditLimit"
                    type="number"
                    step="0.01"
                    {...register('creditLimit')}
                  />
                </div>

                <div>
                  <Label htmlFor="creditDays">Credit Days</Label>
                  <Input
                    id="creditDays"
                    type="number"
                    {...register('creditDays')}
                  />
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-4 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/suppliers')}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : isNewSupplier ? 'Create Supplier' : 'Update Supplier'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
