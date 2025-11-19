import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { customerService } from '@/services/customer.service';
import { CustomerType, CustomerCategory } from '@/types/customer.types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { validators } from '@/lib/validators';
import { toast } from 'sonner';

const customerFormSchema = z.object({
  code: validators.required('Customer code'),
  name: validators.required('Company name'),
  brandNames: z.string().optional(),
  categories: z.string().optional(),
  type: z.enum(['BUYER']),
  category: z.enum(['DOMESTIC', 'EXPORT', 'LOCAL']),
  contactPerson: z.string().optional(),
  email: validators.email,
  phone: validators.phone,
  billingAddress: z.string().optional(),
  shippingAddress: z.string().optional(),
  gstNumber: validators.gst,
  creditLimit: z.string().optional(),
  creditDays: z.string().optional(),
});

type CustomerFormData = z.infer<typeof customerFormSchema>;

interface CustomerFormProps {
  mode?: 'create' | 'edit';
}

export default function CustomerForm({ mode = 'create' }: CustomerFormProps) {
  const navigate = useNavigate();
  const { id } = useParams();
  const isNewCustomer = mode === 'create' || !id;
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [brandNames, setBrandNames] = useState<string[]>(['']);
  const [categories, setCategories] = useState<string[]>(['']);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<CustomerFormData>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      type: CustomerType.BUYER,
      category: CustomerCategory.DOMESTIC,
    },
  });

  // Auto-generate customer code for new customers
  useEffect(() => {
    if (isNewCustomer) {
      const generateCode = () => {
        const timestamp = Date.now().toString().slice(-6);
        const randomNum = Math.floor(Math.random() * 100).toString().padStart(2, '0');
        return `CUST${timestamp}${randomNum}`;
      };
      setValue('code', generateCode());
    }
  }, [isNewCustomer, setValue]);

  // Load existing customer data for edit mode
  useEffect(() => {
    if (id && !isNewCustomer) {
      customerService.getCustomerById(id).then(customer => {
        setValue('code', customer.code);
        setValue('name', customer.name);

        // Parse brand names from newline-separated string
        if (customer.brandNames) {
          const brands = customer.brandNames.split('\n').filter(b => b.trim());
          setBrandNames(brands.length > 0 ? brands : ['']);
        }

        // Parse categories from newline-separated string
        if (customer.categories) {
          const cats = customer.categories.split('\n').filter(c => c.trim());
          setCategories(cats.length > 0 ? cats : ['']);
        }

        setValue('type', customer.type);
        setValue('category', customer.category);
        setValue('contactPerson', customer.contactPerson || '');
        setValue('email', customer.email || '');
        setValue('phone', customer.phone || '');
        setValue('billingAddress', customer.billingAddress || '');
        setValue('shippingAddress', customer.shippingAddress || '');
        setValue('gstNumber', customer.gstNumber || '');
        setValue('creditLimit', customer.creditLimit?.toString() || '');
        setValue('creditDays', customer.creditDays?.toString() || '');
      }).catch(err => {
        setSubmitError('Failed to load customer data');
      });
    }
  }, [id, isNewCustomer, setValue]);

  // Handle brand name changes
  const handleBrandNameChange = (index: number, value: string) => {
    const newBrandNames = [...brandNames];
    newBrandNames[index] = value;
    setBrandNames(newBrandNames);
  };

  const addBrandName = () => {
    setBrandNames([...brandNames, '']);
  };

  const removeBrandName = (index: number) => {
    if (brandNames.length > 1) {
      setBrandNames(brandNames.filter((_, i) => i !== index));
    }
  };

  // Handle category changes
  const handleCategoryChange = (index: number, value: string) => {
    const newCategories = [...categories];
    newCategories[index] = value;
    setCategories(newCategories);
  };

  const addCategory = () => {
    setCategories([...categories, '']);
  };

  const removeCategory = (index: number) => {
    if (categories.length > 1) {
      setCategories(categories.filter((_, i) => i !== index));
    }
  };

  const onSubmit = async (data: CustomerFormData) => {
    try {
      setLoading(true);
      setSubmitError(null);

      // Join brand names with newlines
      const brandNamesString = brandNames.filter(b => b.trim()).join('\n');
      // Join categories with newlines
      const categoriesString = categories.filter(c => c.trim()).join('\n');

      const payload = {
        ...data,
        brandNames: brandNamesString,
        categories: categoriesString,
        creditLimit: data.creditLimit ? parseFloat(data.creditLimit) : undefined,
        creditDays: data.creditDays ? parseInt(data.creditDays) : undefined,
      };

      if (isNewCustomer) {
        await customerService.createCustomer(payload as any);
        toast.success('Customer created', {
          description: `${data.name} has been successfully created.`
        });
      } else if (id) {
        await customerService.updateCustomer(id, payload as any);
        toast.success('Customer updated', {
          description: `${data.name} has been successfully updated.`
        });
      }

      navigate('/customers', { replace: true });
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to save customer';
      setSubmitError(errorMessage);
      toast.error('Error', { description: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate('/customers')}>← Back to Customers</Button>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>{isNewCustomer ? 'Create New Customer' : 'Edit Customer'}</CardTitle>
          </CardHeader>
          <CardContent>
            {submitError && (
              <div className="p-4 mb-4 bg-red-50 text-red-800 rounded-md border border-red-200">
                {submitError}
              </div>
            )}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Company Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Company Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="code">Customer Code *</Label>
                    <Input id="code" {...register('code')} readOnly className="bg-gray-50" />
                    {errors.code && <p className="text-sm text-red-600 mt-1">{errors.code.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="category">Customer Category *</Label>
                    <select
                      id="category"
                      {...register('category')}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="DOMESTIC">Domestic</option>
                      <option value="EXPORT">Export</option>
                      <option value="LOCAL">Local</option>
                    </select>
                    {errors.category && <p className="text-sm text-red-600 mt-1">{errors.category.message}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="name">Company Name *</Label>
                    <Input id="name" {...register('name')} placeholder="Enter company name" />
                    {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <Label>Brand Names</Label>
                    <div className="space-y-2">
                      {brandNames.map((brand, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            value={brand}
                            onChange={(e) => handleBrandNameChange(index, e.target.value)}
                            placeholder={`Brand ${index + 1}`}
                            className="flex-1"
                          />
                          {brandNames.length > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => removeBrandName(index)}
                              className="px-3"
                            >
                              ×
                            </Button>
                          )}
                          {index === brandNames.length - 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={addBrandName}
                              className="px-3"
                            >
                              +
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <Label>Categories <span className="text-gray-500 text-sm">(e.g., Western Wear, Ethnic Wear)</span></Label>
                    <div className="space-y-2">
                      {categories.map((category, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            value={category}
                            onChange={(e) => handleCategoryChange(index, e.target.value)}
                            placeholder={`Category ${index + 1} (e.g., Western Wear)`}
                            className="flex-1"
                          />
                          {categories.length > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => removeCategory(index)}
                              className="px-3"
                            >
                              ×
                            </Button>
                          )}
                          {index === categories.length - 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={addCategory}
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
                    <Label htmlFor="gstNumber">GST Number <span className="text-gray-500 text-sm">(15 characters)</span></Label>
                    <Input id="gstNumber" {...register('gstNumber')} placeholder="Enter 15-character GST number" maxLength={15} />
                    {errors.gstNumber && <p className="text-sm text-red-600 mt-1">{errors.gstNumber.message}</p>}
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Contact Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="contactPerson">Contact Person</Label>
                    <Input id="contactPerson" {...register('contactPerson')} placeholder="Enter contact person name" />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone <span className="text-gray-500 text-sm">(Max 10 digits)</span></Label>
                    <Input id="phone" {...register('phone')} placeholder="Enter phone number" maxLength={10} />
                    {errors.phone && <p className="text-sm text-red-600 mt-1">{errors.phone.message}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" {...register('email')} placeholder="Enter email address" />
                    {errors.email && <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>}
                  </div>
                </div>
              </div>

              {/* Address Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Address Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="billingAddress">Billing Address</Label>
                    <Textarea
                      id="billingAddress"
                      {...register('billingAddress')}
                      rows={3}
                      className="resize-none"
                    />
                  </div>
                  <div>
                    <Label htmlFor="shippingAddress">Shipping Address</Label>
                    <Textarea
                      id="shippingAddress"
                      {...register('shippingAddress')}
                      rows={3}
                      className="resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Credit Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Credit Terms</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="creditLimit">Credit Limit (₹)</Label>
                    <Input
                      id="creditLimit"
                      type="number"
                      step="0.01"
                      {...register('creditLimit')}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="creditDays">Credit Days</Label>
                    <Input
                      id="creditDays"
                      type="number"
                      {...register('creditDays')}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => navigate('/customers')}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Saving...' : isNewCustomer ? 'Create Customer' : 'Update Customer'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
