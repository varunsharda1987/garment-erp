import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { customerService } from '@/services/customer.service';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import { CustomerCategory, CustomerType } from '@/types/customer.types';
import { handleApiError } from '@/lib/api-error-handler';
import { ArrowLeft, Edit, Mail, Phone, Building2, MapPin, CreditCard, Calendar } from 'lucide-react';

interface CustomerGstNumber {
  id: string;
  stateName: string;
  stateCode: string;
  gstNumber: string;
  billingAddress?: string;
  isPrimary: boolean;
}

interface BrandCategory {
  id: string;
  brandName: string;
  category: string;
}

interface CustomerDetailData {
  id: string;
  code: string;
  name: string;
  type: CustomerType;
  category: CustomerCategory;
  brandNames?: string;
  categories?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  billingAddress?: string;
  shippingAddress?: string;
  gstNumber?: string;
  creditLimit?: number;
  creditDays?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  customer_gst_numbers?: CustomerGstNumber[];
  brand_categories?: BrandCategory[];
  _count?: {
    orders: number;
    quotations: number;
    invoices: number;
  };
}

export default function CustomerDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const currentUser = useAuthStore((state) => state.user);
  const [customer, setCustomer] = useState<CustomerDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canEdit = currentUser?.role === 'ADMIN' || currentUser?.role === 'SALES' || currentUser?.role === 'MERCHANDISER';

  useEffect(() => {
    if (id) {
      fetchCustomerDetails();
    }
  }, [id]);

  const fetchCustomerDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await customerService.getCustomerById(id!);
      setCustomer(data);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load customer details', false);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryVariant = (category: CustomerCategory) => {
    switch (category) {
      case 'DOMESTIC':
        return 'warning' as const;
      case 'EXPORT':
        return 'info' as const;
      case 'LOCAL':
        return 'success' as const;
      default:
        return 'secondary' as const;
    }
  };

  // Group brand categories by brand name
  const groupedBrandCategories = customer?.brand_categories?.reduce((acc: { [key: string]: string[] }, bc) => {
    if (!acc[bc.brandName]) {
      acc[bc.brandName] = [];
    }
    acc[bc.brandName].push(bc.category);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading customer details...</p>
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <Button variant="ghost" onClick={() => navigate('/customers')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Customers
            </Button>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-red-600">{error || 'Customer not found'}</p>
              <Button onClick={() => navigate('/customers')} className="mt-4">
                Return to Customers
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Button variant="ghost" onClick={() => navigate('/customers')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Customers
          </Button>
          {canEdit && (
            <Button onClick={() => navigate(`/customers/${customer.id}/edit`)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Customer
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Customer Header */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <CardTitle className="text-3xl">{customer.name}</CardTitle>
                  <StatusBadge
                    status={customer.category}
                    variant={getCategoryVariant(customer.category)}
                  />
                  <StatusBadge
                    status={customer.isActive ? 'Active' : 'Inactive'}
                    variant={customer.isActive ? 'success' : 'secondary'}
                  />
                </div>
                <p className="text-gray-600">Customer Code: {customer.code}</p>
              </div>
              {customer._count && (
                <div className="text-right text-sm text-gray-600">
                  <div>Orders: {customer._count.orders}</div>
                  <div>Quotations: {customer._count.quotations}</div>
                  <div>Invoices: {customer._count.invoices}</div>
                </div>
              )}
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {customer.contactPerson && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Contact Person</label>
                  <p className="text-gray-900">{customer.contactPerson}</p>
                </div>
              )}
              {customer.email && (
                <div>
                  <label className="text-sm font-medium text-gray-600 flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    Email
                  </label>
                  <p className="text-gray-900">{customer.email}</p>
                </div>
              )}
              {customer.phone && (
                <div>
                  <label className="text-sm font-medium text-gray-600 flex items-center gap-1">
                    <Phone className="h-4 w-4" />
                    Phone
                  </label>
                  <p className="text-gray-900">{customer.phone}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Brand Categories */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Brand Names & Categories</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {groupedBrandCategories && Object.keys(groupedBrandCategories).length > 0 ? (
                Object.entries(groupedBrandCategories).map(([brandName, categories]) => (
                  <div key={brandName} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="font-medium text-gray-900 mb-1">{brandName}</p>
                    <div className="flex flex-wrap gap-1">
                      {categories.map((cat, idx) => (
                        <span
                          key={idx}
                          className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              ) : customer.brandNames ? (
                <div>
                  <label className="text-sm font-medium text-gray-600">Brand Names</label>
                  <p className="text-gray-900 whitespace-pre-line">{customer.brandNames}</p>
                  {customer.categories && (
                    <>
                      <label className="text-sm font-medium text-gray-600 mt-3 block">Categories</label>
                      <p className="text-gray-900 whitespace-pre-line">{customer.categories}</p>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No brand information available</p>
              )}
            </CardContent>
          </Card>

          {/* GST Information */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                GST Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              {customer.customer_gst_numbers && customer.customer_gst_numbers.length > 0 ? (
                <div className="space-y-3">
                  {customer.customer_gst_numbers.map((gst) => (
                    <div key={gst.id} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-gray-600">State</label>
                          <p className="text-gray-900">
                            {gst.stateName} {gst.stateCode && `(${gst.stateCode})`}
                            {gst.isPrimary && (
                              <span className="ml-2 inline-block px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded">
                                Primary
                              </span>
                            )}
                          </p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600">GST Number</label>
                          <p className="text-gray-900 font-mono">{gst.gstNumber}</p>
                        </div>
                        {gst.billingAddress && (
                          <div className="md:col-span-2">
                            <label className="text-xs font-medium text-gray-600">Billing Address</label>
                            <p className="text-gray-900">{gst.billingAddress}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : customer.gstNumber ? (
                <div>
                  <label className="text-sm font-medium text-gray-600">GST Number</label>
                  <p className="text-gray-900 font-mono">{customer.gstNumber}</p>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No GST information available</p>
              )}
            </CardContent>
          </Card>

          {/* Address Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Billing Address
              </CardTitle>
            </CardHeader>
            <CardContent>
              {customer.billingAddress ? (
                <p className="text-gray-900 whitespace-pre-line">{customer.billingAddress}</p>
              ) : (
                <p className="text-gray-500 text-sm">No billing address available</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Shipping Address
              </CardTitle>
            </CardHeader>
            <CardContent>
              {customer.shippingAddress ? (
                <p className="text-gray-900 whitespace-pre-line">{customer.shippingAddress}</p>
              ) : (
                <p className="text-gray-500 text-sm">No shipping address available</p>
              )}
            </CardContent>
          </Card>

          {/* Credit Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Credit Terms
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-600">Credit Limit</label>
                <p className="text-gray-900 text-xl font-semibold">
                  {customer.creditLimit ? `₹${customer.creditLimit.toLocaleString('en-IN')}` : 'Not set'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Credit Days</label>
                <p className="text-gray-900 text-xl font-semibold">
                  {customer.creditDays ? `${customer.creditDays} days` : 'Not set'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* System Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">System Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-600">Created At</label>
                <p className="text-gray-900">{new Date(customer.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Last Updated</label>
                <p className="text-gray-900">{new Date(customer.updatedAt).toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
