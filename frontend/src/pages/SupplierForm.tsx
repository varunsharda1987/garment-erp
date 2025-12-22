import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import CategoryFields from '../components/supplier/CategoryFields';
import StateSelector from '../components/StateSelector';
import CitySelector from '../components/CitySelector';
import GSTNumberInput from '../components/GSTNumberInput';
import { createSupplier, getSupplierById, updateSupplier } from '../services/supplier.service';
import { SupplierCategory, SupplierCategoryLabels } from '../types/supplier.types';
import type { CreateSupplierRequest, GstNumberInput } from '../types/supplier.types';
import { X, Plus } from 'lucide-react';

// List of Indian Banks for dropdown
const INDIAN_BANKS = [
  'State Bank of India', 'Punjab National Bank', 'Bank of Baroda', 'Canara Bank',
  'Union Bank of India', 'Bank of India', 'Indian Bank', 'Central Bank of India',
  'Indian Overseas Bank', 'UCO Bank', 'Bank of Maharashtra', 'Punjab & Sind Bank',
  'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra Bank',
  'IndusInd Bank', 'Yes Bank', 'IDFC First Bank', 'Federal Bank',
  'RBL Bank', 'South Indian Bank', 'Karnataka Bank', 'Karur Vysya Bank',
  'City Union Bank', 'DCB Bank', 'Bandhan Bank', 'Citibank',
  'HSBC Bank', 'Standard Chartered Bank', 'DBS Bank', 'Deutsche Bank',
  'Barclays Bank', 'BNP Paribas', 'AU Small Finance Bank', 'Equitas Small Finance Bank',
  'Ujjivan Small Finance Bank', 'Jana Small Finance Bank', 'Suryoday Small Finance Bank',
  'Utkarsh Small Finance Bank', 'ESAF Small Finance Bank', 'Fincare Small Finance Bank',
  'Paytm Payments Bank', 'Airtel Payments Bank', 'India Post Payments Bank',
];

interface SupplierFormProps {
  mode?: 'create' | 'edit';
}

type SupplierFormData = Omit<CreateSupplierRequest, 'categoryData' | 'supplierCategories' | 'gstNumbers'>;

export default function SupplierForm({ mode = 'create' }: SupplierFormProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<SupplierCategory[]>([]);
  const [categoryData, setCategoryData] = useState<Record<string, string | number | boolean | null | undefined | string[] | Record<string, unknown>[]>>({});
  const [selectedBank, setSelectedBank] = useState<string>('');
  const [gstNumbers, setGstNumbers] = useState<GstNumberInput[]>([]);
  const [copyBillingToShipping, setCopyBillingToShipping] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SupplierFormData>();

  const isNewSupplier = mode === 'create' || !id;

  const billingStateId = watch('billingStateId');
  const billingCityId = watch('billingCityId');
  const billingPincode = watch('billingPincode');
  const shippingStateId = watch('shippingStateId');

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

  // Copy billing to shipping
  useEffect(() => {
    if (copyBillingToShipping && billingStateId && billingCityId && billingPincode) {
      setValue('shippingStateId', billingStateId);
      setValue('shippingCityId', billingCityId);
      setValue('shippingPincode', billingPincode);
    }
  }, [copyBillingToShipping, billingStateId, billingCityId, billingPincode, setValue]);

  // Load supplier data for edit mode
  useEffect(() => {
    if (!isNewSupplier && id) {
      const fetchSupplier = async () => {
        try {
          setIsLoading(true);
          const supplier = await getSupplierById(id);

          setValue('code', supplier.code);
          setValue('name', supplier.name);
          setSelectedCategories(supplier.supplierCategories || []);
          setValue('contactPerson', supplier.contactPerson || '');
          setValue('email', supplier.email || '');
          setValue('phone', supplier.phone || '');
          setValue('address', supplier.address || '');

          // Location fields
          setValue('billingStateId', supplier.billingStateId || '');
          setValue('billingCityId', supplier.billingCityId || '');
          setValue('billingPincode', supplier.billingPincode || '');
          setValue('shippingStateId', supplier.shippingStateId || '');
          setValue('shippingCityId', supplier.shippingCityId || '');
          setValue('shippingPincode', supplier.shippingPincode || '');
          setValue('shippingAddress', supplier.shippingAddress || '');

          // GST Numbers
          if (supplier.gstNumbers && supplier.gstNumbers.length > 0) {
            setGstNumbers(supplier.gstNumbers.map(gst => ({
              stateId: gst.stateId || '',
              stateName: gst.stateName,
              stateCode: gst.stateCode,
              gstNumber: gst.gstNumber,
              billingAddress: gst.billingAddress || '',
              billingCityId: gst.billingCityId || '',
              billingPincode: gst.billingPincode || '',
              isPrimary: gst.isPrimary,
            })));
          }

          setValue('paymentTerms', supplier.paymentTerms || '');
          setValue('creditLimit', supplier.creditLimit || undefined);
          setValue('creditDays', supplier.creditDays || undefined);
          setValue('rating', supplier.rating || 0);

          // Bank Details
          setSelectedBank(supplier.bankName || '');
          setValue('bankName', supplier.bankName || '');
          setValue('bankAccountNumber', supplier.bankAccountNumber || '');
          setValue('ifscCode', supplier.ifscCode || '');

          setCategoryData(supplier.categoryData || {});
        } catch (err: unknown) {
          setError(err.response?.data?.message || 'Failed to load supplier');
        } finally {
          setIsLoading(false);
        }
      };
      fetchSupplier();
    }
  }, [id, isNewSupplier, setValue]);

  const handleAddGSTNumber = () => {
    setGstNumbers([
      ...gstNumbers,
      {
        stateId: '',
        stateName: '',
        stateCode: '',
        gstNumber: '',
        billingAddress: '',
        billingCityId: '',
        billingPincode: '',
        isPrimary: gstNumbers.length === 0, // First one is primary by default
      },
    ]);
  };

  const handleRemoveGSTNumber = (index: number) => {
    setGstNumbers(gstNumbers.filter((_, i) => i !== index));
  };

  const handleGSTNumberChange = (index: number, updated: GstNumberInput) => {
    const newGstNumbers = [...gstNumbers];
    newGstNumbers[index] = updated;
    setGstNumbers(newGstNumbers);
  };

  const onSubmit = async (data: SupplierFormData) => {
    try {
      setIsLoading(true);
      setError(null);

      if (selectedCategories.length === 0) {
        setError('Please select at least one supplier category');
        setIsLoading(false);
        return;
      }

      const payload: CreateSupplierRequest = {
        ...data,
        supplierCategories: selectedCategories,
        creditLimit: data.creditLimit ? Number(data.creditLimit) : undefined,
        creditDays: data.creditDays ? Number(data.creditDays) : undefined,
        rating: data.rating ? Number(data.rating) : undefined,
        categoryData: Object.keys(categoryData).length > 0 ? categoryData : undefined,
        gstNumbers: gstNumbers.length > 0 ? gstNumbers : undefined,
        bankName: selectedBank || undefined,
        bankAccountNumber: data.bankAccountNumber || undefined,
        ifscCode: data.ifscCode ? data.ifscCode.toUpperCase() : undefined,
      };

      if (isNewSupplier) {
        await createSupplier(payload);
      } else if (id) {
        await updateSupplier(id, payload);
      }

      navigate('/suppliers');
    } catch (err: unknown) {
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
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <Card>
        <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 border-b">
          <CardTitle className="text-2xl font-bold text-gray-900">
            {isNewSupplier ? '✨ Create New Supplier' : '✏️ Edit Supplier'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-3">
                <span className="text-red-500 text-xl">⚠️</span>
                <span className="flex-1">{error}</span>
              </div>
            )}

            {/* BASIC INFORMATION */}
            <section className="border rounded-lg p-6 bg-gray-50">
              <h3 className="text-xl font-semibold mb-6 text-gray-900 flex items-center gap-2">
                <span className="text-2xl">📋</span>
                Basic Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="code" className="text-sm font-medium text-gray-700">
                    Supplier Code <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="code"
                    {...register('code', { required: 'Supplier code is required' })}
                    readOnly
                    className="mt-1.5 bg-gray-100 font-mono"
                  />
                  {errors.code && <p className="text-red-600 text-sm mt-1">{errors.code.message}</p>}
                </div>

                <div>
                  <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                    Supplier Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    {...register('name', { required: 'Supplier name is required' })}
                    placeholder="Enter supplier/vendor name"
                    className="mt-1.5"
                  />
                  {errors.name && <p className="text-red-600 text-sm mt-1">{errors.name.message}</p>}
                </div>

                <div className="md:col-span-2">
                  <Label className="text-sm font-medium text-gray-700">
                    Supplier Categories <span className="text-red-500">*</span>
                    <span className="text-gray-500 text-xs font-normal ml-2">(Select all that apply)</span>
                  </Label>

                  {selectedCategories.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3 mb-4">
                      {selectedCategories.map((cat) => (
                        <span
                          key={cat}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-800 rounded-full text-sm font-medium"
                        >
                          {SupplierCategoryLabels[cat]}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCategories(prev => prev.filter(c => c !== cat));
                            }}
                            className="hover:text-indigo-950 transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-5 border-2 border-dashed rounded-lg bg-white max-h-72 overflow-y-auto">
                    {Object.entries(SupplierCategoryLabels).map(([value, label]) => (
                      <label key={value} className="flex items-center gap-3 cursor-pointer hover:bg-indigo-50 p-3 rounded-lg transition-colors">
                        <Checkbox
                          checked={selectedCategories.includes(value as SupplierCategory)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedCategories(prev => [...prev, value as SupplierCategory]);
                            } else {
                              setSelectedCategories(prev => prev.filter(c => c !== value));
                            }
                          }}
                          className="border-2"
                        />
                        <span className="text-sm font-medium text-gray-700">{label}</span>
                      </label>
                    ))}
                  </div>
                  {selectedCategories.length === 0 && <p className="text-red-600 text-sm mt-2">At least one category is required</p>}
                </div>
              </div>
            </section>

            {/* CONTACT DETAILS */}
            <section className="border rounded-lg p-6 bg-gray-50">
              <h3 className="text-xl font-semibold mb-6 text-gray-900 flex items-center gap-2">
                <span className="text-2xl">📞</span>
                Contact Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="contactPerson" className="text-sm font-medium text-gray-700">Contact Person</Label>
                  <Input id="contactPerson" {...register('contactPerson')} placeholder="Name of contact person" className="mt-1.5" />
                </div>

                <div>
                  <Label htmlFor="phone" className="text-sm font-medium text-gray-700">Phone Number</Label>
                  <Input id="phone" {...register('phone')} placeholder="10-digit mobile number" maxLength={10} className="mt-1.5" />
                </div>

                <div>
                  <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    {...register('email', {
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: 'Invalid email address',
                      },
                    })}
                    placeholder="email@example.com"
                    className="mt-1.5"
                  />
                  {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email.message}</p>}
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="address" className="text-sm font-medium text-gray-700">Office Address</Label>
                  <Textarea id="address" {...register('address')} rows={3} placeholder="Complete office address" className="mt-1.5" />
                </div>
              </div>
            </section>

            {/* BILLING LOCATION */}
            <section className="border rounded-lg p-6 bg-gradient-to-br from-blue-50 to-indigo-50">
              <h3 className="text-xl font-semibold mb-6 text-gray-900 flex items-center gap-2">
                <span className="text-2xl">📍</span>
                Billing Location
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <Label htmlFor="billingStateId" className="text-sm font-medium text-gray-700">State</Label>
                  <div className="mt-1.5">
                    <StateSelector
                      value={billingStateId || ''}
                      onChange={(value) => {
                        setValue('billingStateId', value);
                        setValue('billingCityId', ''); // Reset city when state changes
                      }}
                      showStateCode
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="billingCityId" className="text-sm font-medium text-gray-700">City</Label>
                  <div className="mt-1.5">
                    <CitySelector
                      value={billingCityId || ''}
                      onChange={(value) => setValue('billingCityId', value)}
                      stateId={billingStateId || undefined}
                      disabled={!billingStateId}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="billingPincode" className="text-sm font-medium text-gray-700">PIN Code</Label>
                  <Input
                    id="billingPincode"
                    {...register('billingPincode', {
                      pattern: {
                        value: /^[1-9][0-9]{5}$/,
                        message: 'Invalid PIN code (6 digits)',
                      },
                    })}
                    placeholder="6-digit PIN"
                    maxLength={6}
                    className="mt-1.5"
                  />
                  {errors.billingPincode && <p className="text-red-600 text-sm mt-1">{errors.billingPincode.message}</p>}
                </div>
              </div>
            </section>

            {/* SHIPPING LOCATION */}
            <section className="border rounded-lg p-6 bg-gradient-to-br from-green-50 to-teal-50">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <span className="text-2xl">🚚</span>
                  Shipping Location
                </h3>
                <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 rounded-lg border-2 hover:bg-gray-50 transition-colors">
                  <Checkbox
                    checked={copyBillingToShipping}
                    onCheckedChange={(checked) => setCopyBillingToShipping(!!checked)}
                  />
                  <span className="text-sm font-medium text-gray-700">Same as Billing</span>
                </label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <Label htmlFor="shippingStateId" className="text-sm font-medium text-gray-700">State</Label>
                  <div className="mt-1.5">
                    <StateSelector
                      value={shippingStateId || ''}
                      onChange={(value) => {
                        setValue('shippingStateId', value);
                        setValue('shippingCityId', '');
                      }}
                      showStateCode
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="shippingCityId" className="text-sm font-medium text-gray-700">City</Label>
                  <div className="mt-1.5">
                    <CitySelector
                      value={watch('shippingCityId') || ''}
                      onChange={(value) => setValue('shippingCityId', value)}
                      stateId={shippingStateId || undefined}
                      disabled={!shippingStateId}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="shippingPincode" className="text-sm font-medium text-gray-700">PIN Code</Label>
                  <Input
                    id="shippingPincode"
                    {...register('shippingPincode', {
                      pattern: {
                        value: /^[1-9][0-9]{5}$/,
                        message: 'Invalid PIN code (6 digits)',
                      },
                    })}
                    placeholder="6-digit PIN"
                    maxLength={6}
                    className="mt-1.5"
                  />
                  {errors.shippingPincode && <p className="text-red-600 text-sm mt-1">{errors.shippingPincode.message}</p>}
                </div>

                <div className="md:col-span-3">
                  <Label htmlFor="shippingAddress" className="text-sm font-medium text-gray-700">Shipping Address (if different)</Label>
                  <Textarea id="shippingAddress" {...register('shippingAddress')} rows={2} placeholder="Complete shipping address" className="mt-1.5" />
                </div>
              </div>
            </section>

            {/* GST NUMBERS */}
            <section className="border rounded-lg p-6 bg-gradient-to-br from-amber-50 to-orange-50">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <span className="text-2xl">💼</span>
                  GST Registration Numbers
                  <span className="text-sm font-normal text-gray-600">(Multi-state registration support)</span>
                </h3>
                <Button
                  type="button"
                  onClick={handleAddGSTNumber}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 bg-white hover:bg-amber-100 border-amber-300"
                >
                  <Plus className="h-4 w-4" />
                  Add GST Number
                </Button>
              </div>

              {gstNumbers.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed">
                  <p className="text-gray-500 mb-4">No GST numbers added yet</p>
                  <Button
                    type="button"
                    onClick={handleAddGSTNumber}
                    variant="outline"
                    className="flex items-center gap-2 mx-auto"
                  >
                    <Plus className="h-4 w-4" />
                    Add First GST Number
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {gstNumbers.map((gst, index) => (
                    <div key={index} className="bg-white p-4 rounded-lg border-2 shadow-sm">
                      <GSTNumberInput
                        value={gst}
                        onChange={(updated) => handleGSTNumberChange(index, updated)}
                        onRemove={() => handleRemoveGSTNumber(index)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* PAYMENT & CREDIT TERMS */}
            <section className="border rounded-lg p-6 bg-gray-50">
              <h3 className="text-xl font-semibold mb-6 text-gray-900 flex items-center gap-2">
                <span className="text-2xl">💰</span>
                Payment & Credit Terms
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <Label htmlFor="paymentTerms" className="text-sm font-medium text-gray-700">Payment Terms</Label>
                  <Input id="paymentTerms" {...register('paymentTerms')} placeholder="e.g., Net 30, Advance 50%" className="mt-1.5" />
                </div>

                <div>
                  <Label htmlFor="creditLimit" className="text-sm font-medium text-gray-700">Credit Limit (₹)</Label>
                  <Input id="creditLimit" type="number" step="0.01" {...register('creditLimit')} placeholder="0.00" className="mt-1.5" />
                </div>

                <div>
                  <Label htmlFor="creditDays" className="text-sm font-medium text-gray-700">Credit Days</Label>
                  <Input id="creditDays" type="number" {...register('creditDays')} placeholder="Days" className="mt-1.5" />
                </div>

                <div>
                  <Label htmlFor="rating" className="text-sm font-medium text-gray-700">Supplier Rating</Label>
                  <Input id="rating" type="number" min="0" max="5" step="0.1" {...register('rating')} placeholder="0-5" className="mt-1.5" />
                </div>
              </div>
            </section>

            {/* BANK DETAILS */}
            <section className="border rounded-lg p-6 bg-gray-50">
              <h3 className="text-xl font-semibold mb-6 text-gray-900 flex items-center gap-2">
                <span className="text-2xl">🏦</span>
                Bank Account Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="bankName" className="text-sm font-medium text-gray-700">Bank Name</Label>
                  <Select
                    value={selectedBank}
                    onValueChange={(value) => {
                      setSelectedBank(value);
                      setValue('bankName', value);
                    }}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Select bank" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDIAN_BANKS.map((bank) => (
                        <SelectItem key={bank} value={bank}>
                          {bank}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="ifscCode" className="text-sm font-medium text-gray-700">IFSC Code</Label>
                  <Input
                    id="ifscCode"
                    {...register('ifscCode', {
                      pattern: {
                        value: /^[A-Z]{4}0[A-Z0-9]{6}$/i,
                        message: 'Invalid IFSC code (e.g., HDFC0001234)',
                      },
                    })}
                    placeholder="e.g., HDFC0001234"
                    maxLength={11}
                    style={{ textTransform: 'uppercase' }}
                    className="mt-1.5"
                  />
                  {errors.ifscCode && <p className="text-red-600 text-sm mt-1">{errors.ifscCode.message}</p>}
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="bankAccountNumber" className="text-sm font-medium text-gray-700">Account Number</Label>
                  <Input
                    id="bankAccountNumber"
                    {...register('bankAccountNumber', {
                      pattern: {
                        value: /^[0-9]{9,18}$/,
                        message: 'Account number must be 9-18 digits',
                      },
                    })}
                    placeholder="9-18 digit account number"
                    maxLength={18}
                    className="mt-1.5"
                  />
                  {errors.bankAccountNumber && <p className="text-red-600 text-sm mt-1">{errors.bankAccountNumber.message}</p>}
                </div>
              </div>
            </section>

            {/* CATEGORY-SPECIFIC FIELDS */}
            {selectedCategories.length > 0 && (
              <section className="border rounded-lg p-6 bg-gradient-to-br from-purple-50 to-pink-50">
                <h3 className="text-xl font-semibold mb-6 text-gray-900 flex items-center gap-2">
                  <span className="text-2xl">⚙️</span>
                  Category-Specific Details
                </h3>
                <div className="space-y-6">
                  {selectedCategories.map((category) => (
                    <div key={category} className="border-2 rounded-lg p-5 bg-white shadow-sm">
                      <h4 className="font-semibold text-lg text-indigo-700 mb-4 flex items-center gap-2">
                        <span className="bg-indigo-100 px-3 py-1 rounded-full text-sm">
                          {SupplierCategoryLabels[category]}
                        </span>
                      </h4>
                      <CategoryFields
                        category={category}
                        data={categoryData}
                        onChange={setCategoryData}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* FORM ACTIONS */}
            <div className="flex justify-end gap-4 pt-6 border-t-2 border-gray-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/suppliers')}
                disabled={isLoading}
                className="px-8"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading} className="px-8 bg-indigo-600 hover:bg-indigo-700">
                {isLoading ? 'Saving...' : isNewSupplier ? '✨ Create Supplier' : '💾 Update Supplier'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
