import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import CategoryFields from '../components/supplier/CategoryFields';
import { createSupplier, getSupplierById, updateSupplier } from '../services/supplier.service';
import { SupplierCategory, SupplierCategoryLabels } from '../types/supplier.types';
import type { CreateSupplierRequest } from '../types/supplier.types';

// List of Indian Banks for dropdown
const INDIAN_BANKS = [
  // Public Sector Banks
  'State Bank of India',
  'Punjab National Bank',
  'Bank of Baroda',
  'Canara Bank',
  'Union Bank of India',
  'Bank of India',
  'Indian Bank',
  'Central Bank of India',
  'Indian Overseas Bank',
  'UCO Bank',
  'Bank of Maharashtra',
  'Punjab & Sind Bank',
  // Private Sector Banks
  'HDFC Bank',
  'ICICI Bank',
  'Axis Bank',
  'Kotak Mahindra Bank',
  'IndusInd Bank',
  'Yes Bank',
  'IDFC First Bank',
  'Federal Bank',
  'RBL Bank',
  'South Indian Bank',
  'Karnataka Bank',
  'Karur Vysya Bank',
  'City Union Bank',
  'DCB Bank',
  'Bandhan Bank',
  // Foreign Banks
  'Citibank',
  'HSBC Bank',
  'Standard Chartered Bank',
  'DBS Bank',
  'Deutsche Bank',
  'Barclays Bank',
  'BNP Paribas',
  // Small Finance Banks
  'AU Small Finance Bank',
  'Equitas Small Finance Bank',
  'Ujjivan Small Finance Bank',
  'Jana Small Finance Bank',
  'Suryoday Small Finance Bank',
  'Utkarsh Small Finance Bank',
  'ESAF Small Finance Bank',
  'Fincare Small Finance Bank',
  // Payment Banks
  'Paytm Payments Bank',
  'Airtel Payments Bank',
  'India Post Payments Bank',
];

interface SupplierFormProps {
  mode?: 'create' | 'edit';
}

type SupplierFormData = Omit<CreateSupplierRequest, 'categoryData'>;

export default function SupplierForm({ mode = 'create' }: SupplierFormProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<SupplierCategory | ''>('');
  const [categoryData, setCategoryData] = useState<Record<string, string | number | boolean | null | undefined | string[] | Record<string, unknown>[]>>({});
  const [selectedBank, setSelectedBank] = useState<string>('');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
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

          setValue('code', supplier.code);
          setValue('name', supplier.name);
          setSelectedCategory(supplier.supplierCategory);
          setValue('supplierCategory', supplier.supplierCategory);
          setValue('contactPerson', supplier.contactPerson || '');
          setValue('email', supplier.email || '');
          setValue('phone', supplier.phone || '');
          setValue('address', supplier.address || '');
          setValue('gstNumber', supplier.gstNumber || '');
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

  const onSubmit = async (data: SupplierFormData) => {
    try {
      setIsLoading(true);
      setError(null);

      if (!selectedCategory) {
        setError('Please select a supplier category');
        setIsLoading(false);
        return;
      }

      const payload: CreateSupplierRequest = {
        ...data,
        supplierCategory: selectedCategory as SupplierCategory,
        creditLimit: data.creditLimit ? Number(data.creditLimit) : undefined,
        creditDays: data.creditDays ? Number(data.creditDays) : undefined,
        rating: data.rating ? Number(data.rating) : undefined,
        categoryData: Object.keys(categoryData).length > 0 ? categoryData : undefined,
        // Bank Details
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

            {/* SUPPLIER INFORMATION */}
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
                  {errors.code && <p className="text-red-600 text-sm mt-1">{errors.code.message}</p>}
                </div>

                <div>
                  <Label htmlFor="name">Supplier Name *</Label>
                  <Input
                    id="name"
                    {...register('name', { required: 'Supplier name is required' })}
                  />
                  {errors.name && <p className="text-red-600 text-sm mt-1">{errors.name.message}</p>}
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="supplierCategory">Supplier Category *</Label>
                  <Select
                    value={selectedCategory}
                    onValueChange={(value) => {
                      setSelectedCategory(value as SupplierCategory);
                      setValue('supplierCategory', value as SupplierCategory);
                      setCategoryData({}); // Reset category data when changing category
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier category" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SupplierCategoryLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!selectedCategory && <p className="text-red-600 text-sm mt-1">Category is required</p>}
                </div>
              </div>
            </div>

            {/* CONTACT DETAILS */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Contact Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contactPerson">Contact Person</Label>
                  <Input id="contactPerson" {...register('contactPerson')} />
                </div>

                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" {...register('phone')} maxLength={10} />
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
                  {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email.message}</p>}
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea id="address" {...register('address')} rows={3} />
                </div>
              </div>
            </div>

            {/* BUSINESS DETAILS */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Business Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="gstNumber">GST Number</Label>
                  <Input id="gstNumber" {...register('gstNumber')} maxLength={15} />
                </div>

                <div>
                  <Label htmlFor="paymentTerms">Payment Terms</Label>
                  <Input id="paymentTerms" {...register('paymentTerms')} placeholder="e.g., Net 30, Advance" />
                </div>

                <div>
                  <Label htmlFor="creditLimit">Credit Limit (₹)</Label>
                  <Input id="creditLimit" type="number" step="0.01" {...register('creditLimit')} />
                </div>

                <div>
                  <Label htmlFor="creditDays">Credit Days</Label>
                  <Input id="creditDays" type="number" {...register('creditDays')} />
                </div>

                <div>
                  <Label htmlFor="rating">Rating (0-5)</Label>
                  <Input id="rating" type="number" min="0" max="5" {...register('rating')} />
                </div>
              </div>
            </div>

            {/* BANK DETAILS */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Bank Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="bankName">Bank Name</Label>
                  <Select
                    value={selectedBank}
                    onValueChange={(value) => {
                      setSelectedBank(value);
                      setValue('bankName', value);
                    }}
                  >
                    <SelectTrigger>
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
                  <Label htmlFor="ifscCode">IFSC Code</Label>
                  <Input
                    id="ifscCode"
                    {...register('ifscCode', {
                      pattern: {
                        value: /^[A-Z]{4}0[A-Z0-9]{6}$/i,
                        message: 'Invalid IFSC code format (e.g., HDFC0001234)',
                      },
                    })}
                    placeholder="e.g., HDFC0001234"
                    maxLength={11}
                    style={{ textTransform: 'uppercase' }}
                  />
                  {errors.ifscCode && <p className="text-red-600 text-sm mt-1">{errors.ifscCode.message}</p>}
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="bankAccountNumber">Bank Account Number</Label>
                  <Input
                    id="bankAccountNumber"
                    {...register('bankAccountNumber', {
                      pattern: {
                        value: /^[0-9]{9,18}$/,
                        message: 'Account number must be 9-18 digits',
                      },
                    })}
                    placeholder="Enter account number (9-18 digits)"
                    maxLength={18}
                  />
                  {errors.bankAccountNumber && <p className="text-red-600 text-sm mt-1">{errors.bankAccountNumber.message}</p>}
                </div>
              </div>
            </div>

            {/* CATEGORY-SPECIFIC FIELDS */}
            {selectedCategory && (
              <div className="border-t pt-6">
                <CategoryFields
                  category={selectedCategory}
                  data={categoryData}
                  onChange={setCategoryData}
                />
              </div>
            )}

            {/* FORM ACTIONS */}
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
