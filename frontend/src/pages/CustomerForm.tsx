import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { customerService } from '@/services/customer.service';
import { CustomerType, CustomerCategory, BusinessType, MarketType } from '@/types/customer.types';
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
  businessType: z.enum(['B2B', 'B2C']),
  market: z.enum(['INTERNATIONAL', 'DOMESTIC']),
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

  // New structure: array of {brandName, categories: string[]}
  const [brandData, setBrandData] = useState<Array<{ brandName: string; categories: string[] }>>([
    { brandName: '', categories: [''] }
  ]);

  // GST Numbers structure
  const [gstNumbers, setGstNumbers] = useState<Array<{
    stateName: string;
    stateCode: string;
    gstNumber: string;
    billingAddress: string;
    isPrimary: boolean;
  }>>([{ stateName: '', stateCode: '', gstNumber: '', billingAddress: '', isPrimary: false }]);

  // Keep old format for backward compatibility
  const [brandNames, setBrandNames] = useState<string[]>(['']);
  const [brandCategories, setBrandCategories] = useState<string[]>(['']);
  const [categories, setCategories] = useState<string[]>(['']);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<CustomerFormData>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      type: CustomerType.BUYER,
      category: CustomerCategory.DOMESTIC,
      businessType: BusinessType.B2B,
      market: MarketType.DOMESTIC,
    },
  });

  // Watch businessType and market for code generation
  const watchBusinessType = watch('businessType', BusinessType.B2B);
  const watchMarket = watch('market', MarketType.DOMESTIC);

  // Auto-generate customer code for new customers with format: CUST-{B2B/B2C}-{INT/DOM}-XXX
  useEffect(() => {
    if (isNewCustomer) {
      const generateCode = async () => {
        try {
          // Fetch all customers to get the next number
          const response = await customerService.getAllCustomers({ page: 1, limit: 1000 });
          const customers = response.data;

          // Filter customers with the same businessType and market
          const businessTypeCode = watchBusinessType;
          const marketCode = watchMarket === MarketType.INTERNATIONAL ? 'INT' : 'DOM';

          const prefix = `CUST-${businessTypeCode}-${marketCode}-`;
          const matchingCustomers = customers.filter(c => c.code.startsWith(prefix));

          let nextNumber = 1;
          if (matchingCustomers.length > 0) {
            // Extract numbers from existing codes and find the max
            const numbers = matchingCustomers
              .map(c => {
                const match = c.code.match(/CUST-[^-]+-[^-]+-(\d+)/);
                return match ? parseInt(match[1], 10) : 0;
              })
              .filter(n => !isNaN(n));

            nextNumber = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
          }

          const formattedNumber = nextNumber.toString().padStart(3, '0');
          return `${prefix}${formattedNumber}`;
        } catch (error) {
          // Fallback to simple numbering
          const businessTypeCode = watchBusinessType;
          const marketCode = watchMarket === MarketType.INTERNATIONAL ? 'INT' : 'DOM';
          const randomNum = Math.floor(Math.random() * 999) + 1;
          const formattedNumber = randomNum.toString().padStart(3, '0');
          return `CUST-${businessTypeCode}-${marketCode}-${formattedNumber}`;
        }
      };

      generateCode().then(code => setValue('code', code));
    }
  }, [isNewCustomer, setValue, watchBusinessType, watchMarket]);

  // Load existing customer data for edit mode
  useEffect(() => {
    if (id && !isNewCustomer) {
      customerService.getCustomerById(id).then((customer: any) => {
        setValue('code', customer.code);
        setValue('name', customer.name);

        // Parse brand categories from new structure
        if (customer.brand_categories && customer.brand_categories.length > 0) {
          // Group by brand name
          const grouped = customer.brand_categories.reduce((acc: any, bc: any) => {
            if (!acc[bc.brandName]) {
              acc[bc.brandName] = [];
            }
            acc[bc.brandName].push(bc.category);
            return acc;
          }, {});

          const parsedBrandData = Object.keys(grouped).map(brandName => ({
            brandName,
            categories: grouped[brandName]
          }));

          setBrandData(parsedBrandData.length > 0 ? parsedBrandData : [{ brandName: '', categories: [''] }]);
        } else if (customer.brandNames) {
          // Fallback to old format
          const brands = customer.brandNames.split('\n').filter((b: string) => b.trim());
          const cats = customer.categories ? customer.categories.split('\n').filter((c: string) => c.trim()) : [];

          const parsedBrandData = brands.map((brand: string, index: number) => ({
            brandName: brand,
            categories: cats[index] ? [cats[index]] : ['']
          }));

          setBrandData(parsedBrandData.length > 0 ? parsedBrandData : [{ brandName: '', categories: [''] }]);
        }

        // Parse GST numbers from new structure
        if (customer.customer_gst_numbers && customer.customer_gst_numbers.length > 0) {
          const parsedGstNumbers = customer.customer_gst_numbers.map((gst: any) => ({
            stateName: gst.stateName || '',
            stateCode: gst.stateCode || '',
            gstNumber: gst.gstNumber || '',
            billingAddress: gst.billingAddress || '',
            isPrimary: gst.isPrimary || false
          }));
          setGstNumbers(parsedGstNumbers);
        } else if (customer.gstNumber) {
          // Fallback to old single GST format
          setGstNumbers([{
            stateName: '',
            stateCode: '',
            gstNumber: customer.gstNumber,
            billingAddress: customer.billingAddress || '',
            isPrimary: true
          }]);
        }

        setValue('type', customer.type);
        setValue('category', customer.category);
        setValue('businessType', customer.businessType || BusinessType.B2B);
        setValue('market', customer.market || MarketType.DOMESTIC);
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

  // New handlers for brand-category structure
  const handleBrandNameChange = (brandIndex: number, value: string) => {
    const newBrandData = [...brandData];
    newBrandData[brandIndex].brandName = value;
    setBrandData(newBrandData);
  };

  const handleCategoryChange = (brandIndex: number, categoryIndex: number, value: string) => {
    const newBrandData = [...brandData];
    newBrandData[brandIndex].categories[categoryIndex] = value;
    setBrandData(newBrandData);
  };

  const addBrand = () => {
    setBrandData([...brandData, { brandName: '', categories: [''] }]);
  };

  const removeBrand = (brandIndex: number) => {
    if (brandData.length > 1) {
      setBrandData(brandData.filter((_, i) => i !== brandIndex));
    }
  };

  const addCategory = (brandIndex: number) => {
    const newBrandData = [...brandData];
    newBrandData[brandIndex].categories.push('');
    setBrandData(newBrandData);
  };

  const removeCategory = (brandIndex: number, categoryIndex: number) => {
    const newBrandData = [...brandData];
    if (newBrandData[brandIndex].categories.length > 1) {
      newBrandData[brandIndex].categories = newBrandData[brandIndex].categories.filter((_, i) => i !== categoryIndex);
      setBrandData(newBrandData);
    }
  };

  // GST Number handlers
  const handleGstChange = (index: number, field: keyof typeof gstNumbers[0], value: string | boolean) => {
    const newGstNumbers = [...gstNumbers];
    newGstNumbers[index] = { ...newGstNumbers[index], [field]: value };
    setGstNumbers(newGstNumbers);
  };

  const addGstNumber = () => {
    setGstNumbers([...gstNumbers, {
      stateName: '',
      stateCode: '',
      gstNumber: '',
      billingAddress: '',
      isPrimary: false
    }]);
  };

  const removeGstNumber = (index: number) => {
    if (gstNumbers.length > 1) {
      setGstNumbers(gstNumbers.filter((_, i) => i !== index));
    }
  };

  const onSubmit = async (data: CustomerFormData) => {
    try {
      setLoading(true);
      setSubmitError(null);

      // Prepare brand categories in new format
      const brandCategories = brandData
        .filter(bd => bd.brandName.trim())
        .map(bd => ({
          brandName: bd.brandName.trim(),
          categories: bd.categories.filter(c => c.trim())
        }))
        .filter(bd => bd.categories.length > 0);

      // Also prepare old format for backward compatibility
      const brandNamesString = brandData.map(bd => bd.brandName.trim()).filter(b => b).join('\n');
      const categoriesString = brandData.map(bd => bd.categories.join(', ')).join('\n');

      // Prepare GST numbers (filter out empty ones)
      const validGstNumbers = gstNumbers
        .filter(gst => gst.gstNumber.trim())
        .map(gst => ({
          stateName: gst.stateName.trim(),
          stateCode: gst.stateCode.trim(),
          gstNumber: gst.gstNumber.trim(),
          billingAddress: gst.billingAddress.trim() || undefined,
          isPrimary: gst.isPrimary
        }));

      const payload = {
        ...data,
        brandNames: brandNamesString,  // Old format
        categories: categoriesString,   // Old format
        brandCategories,                 // New format
        gstNumbers: validGstNumbers,     // New format for multiple GST
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
                    <Label htmlFor="businessType">Business Type *</Label>
                    <select
                      id="businessType"
                      {...register('businessType')}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="B2B">B2B (Business to Business)</option>
                      <option value="B2C">B2C (Business to Consumer)</option>
                    </select>
                    {errors.businessType && <p className="text-sm text-red-600 mt-1">{errors.businessType.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="market">Market *</Label>
                    <select
                      id="market"
                      {...register('market')}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="DOMESTIC">Domestic (DOM)</option>
                      <option value="INTERNATIONAL">International (INT)</option>
                    </select>
                    {errors.market && <p className="text-sm text-red-600 mt-1">{errors.market.message}</p>}
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
                    <Label>Brand Names & Brand Categories</Label>
                    <div className="space-y-4">
                      {brandData.map((brand, brandIndex) => (
                        <div key={brandIndex} className="p-4 bg-gray-50 rounded-lg border border-gray-300">
                          {/* Brand Name */}
                          <div className="mb-3">
                            <div className="flex gap-2 items-center">
                              <div className="flex-1">
                                <Label className="text-sm font-semibold text-gray-700 mb-1">
                                  Brand Name {brandIndex + 1}
                                </Label>
                                <Input
                                  value={brand.brandName}
                                  onChange={(e) => handleBrandNameChange(brandIndex, e.target.value)}
                                  placeholder="e.g., Kasya"
                                  className="bg-white"
                                />
                              </div>
                              {brandData.length > 1 && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => removeBrand(brandIndex)}
                                  className="px-3 text-red-600 hover:text-red-700 mt-6"
                                  title="Remove brand"
                                >
                                  ×
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Categories for this brand */}
                          <div className="ml-4 space-y-2">
                            <Label className="text-xs font-medium text-gray-600">
                              Categories for {brand.brandName || 'this brand'}
                            </Label>
                            {brand.categories.map((category, catIndex) => (
                              <div key={catIndex} className="flex gap-2">
                                <Input
                                  value={category}
                                  onChange={(e) => handleCategoryChange(brandIndex, catIndex, e.target.value)}
                                  placeholder="e.g., Western Wear, Ethnic Wear"
                                  className="bg-white flex-1"
                                />
                                {brand.categories.length > 1 && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => removeCategory(brandIndex, catIndex)}
                                    className="px-3 text-red-600 hover:text-red-700"
                                    title="Remove category"
                                  >
                                    ×
                                  </Button>
                                )}
                                {catIndex === brand.categories.length - 1 && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => addCategory(brandIndex)}
                                    className="px-3"
                                    title="Add category"
                                  >
                                    +
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Add brand button at the end of last brand */}
                          {brandIndex === brandData.length - 1 && (
                            <div className="mt-3">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={addBrand}
                                className="w-full text-blue-600 hover:text-blue-700 border-dashed"
                              >
                                + Add Another Brand
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Add brands and their categories. Each brand can have multiple categories (e.g., Kasya → Western Wear, Ethnic Wear, Casual Wear).
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <Label>GST Numbers (State-wise)</Label>
                    <div className="space-y-3">
                      {gstNumbers.map((gst, index) => (
                        <div key={index} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs text-gray-600">State Name</Label>
                              <Input
                                value={gst.stateName}
                                onChange={(e) => handleGstChange(index, 'stateName', e.target.value)}
                                placeholder="e.g., Maharashtra, Gujarat"
                                className="bg-white"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-gray-600">State Code (2 digits)</Label>
                              <Input
                                value={gst.stateCode}
                                onChange={(e) => handleGstChange(index, 'stateCode', e.target.value)}
                                placeholder="e.g., 27, 24"
                                maxLength={2}
                                className="bg-white"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-gray-600">GST Number (15 characters)</Label>
                              <Input
                                value={gst.gstNumber}
                                onChange={(e) => handleGstChange(index, 'gstNumber', e.target.value)}
                                placeholder="e.g., 27AAAAA0000A1Z5"
                                maxLength={15}
                                className="bg-white"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-gray-600">Billing Address (Optional)</Label>
                              <Input
                                value={gst.billingAddress}
                                onChange={(e) => handleGstChange(index, 'billingAddress', e.target.value)}
                                placeholder="State-specific billing address"
                                className="bg-white"
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-3">
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={gst.isPrimary}
                                onChange={(e) => handleGstChange(index, 'isPrimary', e.target.checked)}
                                className="rounded"
                              />
                              <span className="text-sm text-gray-700">Primary GST</span>
                            </label>
                            <div className="flex gap-2">
                              {gstNumbers.length > 1 && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => removeGstNumber(index)}
                                  className="px-3 text-red-600 hover:text-red-700"
                                >
                                  × Remove
                                </Button>
                              )}
                              {index === gstNumbers.length - 1 && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={addGstNumber}
                                  className="px-3 text-blue-600 hover:text-blue-700"
                                >
                                  + Add GST
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Add GST numbers for each state where the customer operates. Mark one as primary.
                    </p>
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
