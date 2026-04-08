import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getSupplierById } from '@/services/supplier.service';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import { SupplierCategoryLabels } from '@/types/supplier.types';
import type { Supplier, SupplierCategory } from '@/types/supplier.types';
import { handleApiError } from '@/lib/api-error-handler';
import { formatCurrency } from '@/lib/currency';
import { ArrowLeft, Edit, Mail, Phone, Building2, MapPin, CreditCard, Calendar, Star, Banknote } from 'lucide-react';

export default function SupplierDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const currentUser = useAuthStore((state) => state.user);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canEdit =
    currentUser?.role === 'ADMIN' || currentUser?.role === 'PURCHASE' || currentUser?.role === 'MERCHANDISER';

  useEffect(() => {
    if (id) {
      fetchSupplierDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchSupplierDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getSupplierById(id!);
      setSupplier(data);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load supplier details', false);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryVariant = (category: SupplierCategory) => {
    const variants: Record<string, 'warning' | 'info' | 'success' | 'secondary' | 'destructive'> = {
      FABRIC_SUPPLIER: 'info',
      TRIMS_SUPPLIER: 'warning',
      THREAD_SUPPLIER: 'success',
      PACKAGING_SUPPLIER: 'secondary',
      LACE_SUPPLIER: 'info',
      DYEING_PRINTING: 'warning',
      EMBROIDERY: 'success',
      HAND_WORK: 'info',
      SMOCKING: 'warning',
      CMT_UNIT: 'success',
      FINISHING_CONTRACTOR: 'secondary',
      STITCHING_CONTRACTOR: 'info',
      WASHING: 'warning',
      DORI_PIPING_CONTRACTOR: 'success',
      MACHINE_PARTS_SUPPLIER: 'secondary',
      OTHER_SERVICES: 'secondary',
    };
    return variants[category] || 'secondary';
  };

  const renderStars = (rating: number | null | undefined) => {
    const stars = rating || 0;
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-5 w-5 ${star <= stars ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-info mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading supplier details...</p>
        </div>
      </div>
    );
  }

  if (error || !supplier) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-primary/10">
        <header className="bg-card shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <Button variant="ghost" onClick={() => navigate('/suppliers')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Suppliers
            </Button>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-destructive">{error || 'Supplier not found'}</p>
              <Button onClick={() => navigate('/suppliers')} className="mt-4">
                Return to Suppliers
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-primary/10">
      <header className="bg-card shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Button variant="ghost" onClick={() => navigate('/suppliers')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Suppliers
          </Button>
          {canEdit && (
            <Button onClick={() => navigate(`/suppliers/${supplier.id}/edit`)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Supplier
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Supplier Header */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <CardTitle className="text-3xl">{supplier.name}</CardTitle>
                  {(supplier.supplierCategories || []).map((cat) => (
                    <StatusBadge key={cat} status={SupplierCategoryLabels[cat]} variant={getCategoryVariant(cat)} />
                  ))}
                  <StatusBadge
                    status={supplier.isActive ? 'Active' : 'Inactive'}
                    variant={supplier.isActive ? 'success' : 'secondary'}
                  />
                </div>
                <p className="text-muted-foreground">Supplier Code: {supplier.code}</p>
              </div>
              {supplier._count && (
                <div className="text-right text-sm text-muted-foreground">
                  <div>Purchase Orders: {supplier._count.purchaseOrders}</div>
                  <div>Materials: {supplier._count.materials}</div>
                  <div>GRNs: {supplier._count.goodsReceivingNotes}</div>
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
              {supplier.contactPerson && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Contact Person</label>
                  <p className="text-foreground">{supplier.contactPerson}</p>
                </div>
              )}
              {supplier.email && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    Email
                  </label>
                  <p className="text-foreground">{supplier.email}</p>
                </div>
              )}
              {supplier.phone && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Phone className="h-4 w-4" />
                    Phone
                  </label>
                  <p className="text-foreground">{supplier.phone}</p>
                </div>
              )}
              {!supplier.contactPerson && !supplier.email && !supplier.phone && (
                <p className="text-muted-foreground text-sm">No contact information available</p>
              )}
            </CardContent>
          </Card>

          {/* Rating */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Star className="h-5 w-5" />
                Rating
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                {renderStars(supplier.rating)}
                <span className="text-lg font-semibold text-foreground">
                  {supplier.rating ? `${supplier.rating}/5` : 'Not rated'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Address */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Address
              </CardTitle>
            </CardHeader>
            <CardContent>
              {supplier.address ? (
                <p className="text-foreground whitespace-pre-line">{supplier.address}</p>
              ) : (
                <p className="text-muted-foreground text-sm">No address available</p>
              )}
            </CardContent>
          </Card>

          {/* Business Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Business Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {supplier.gstNumbers && supplier.gstNumbers.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">GST Number(s)</label>
                  <p className="text-foreground font-mono">{supplier.gstNumbers.map((g) => g.gstNumber).join(', ')}</p>
                </div>
              )}
              {supplier.paymentTerms && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Payment Terms</label>
                  <p className="text-foreground">{supplier.paymentTerms}</p>
                </div>
              )}
              {(!supplier.gstNumbers || supplier.gstNumbers.length === 0) && !supplier.paymentTerms && (
                <p className="text-muted-foreground text-sm">No business details available</p>
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
                <label className="text-sm font-medium text-muted-foreground">Credit Limit</label>
                <p className="text-foreground text-xl font-semibold">
                  {supplier.creditLimit ? formatCurrency(supplier.creditLimit, { decimals: 0 }) : 'Not set'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Credit Days</label>
                <p className="text-foreground text-xl font-semibold">
                  {supplier.creditDays ? `${supplier.creditDays} days` : 'Not set'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Bank Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Banknote className="h-5 w-5" />
                Bank Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {supplier.bankName && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Bank Name</label>
                  <p className="text-foreground">{supplier.bankName}</p>
                </div>
              )}
              {supplier.bankAccountNumber && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Account Number</label>
                  <p className="text-foreground font-mono">{supplier.bankAccountNumber}</p>
                </div>
              )}
              {supplier.ifscCode && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">IFSC Code</label>
                  <p className="text-foreground font-mono">{supplier.ifscCode}</p>
                </div>
              )}
              {!supplier.bankName && !supplier.bankAccountNumber && !supplier.ifscCode && (
                <p className="text-muted-foreground text-sm">No bank details available</p>
              )}
            </CardContent>
          </Card>

          {/* Category-Specific Data */}
          {supplier.categoryData && Object.keys(supplier.categoryData).length > 0 && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Category-Specific Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(supplier.categoryData).map(([key, value]) => {
                    // Skip null/undefined values
                    if (value === null || value === undefined) return null;

                    // Format the key for display
                    const displayKey = key
                      .replace(/([A-Z])/g, ' $1')
                      .replace(/^./, (str) => str.toUpperCase())
                      .trim();

                    // Format the value for display
                    let displayValue: string;
                    if (Array.isArray(value)) {
                      displayValue = value.join(', ');
                    } else if (typeof value === 'boolean') {
                      displayValue = value ? 'Yes' : 'No';
                    } else if (typeof value === 'object') {
                      displayValue = JSON.stringify(value);
                    } else {
                      displayValue = String(value);
                    }

                    return (
                      <div key={key} className="p-3 bg-muted rounded-lg">
                        <label className="text-xs font-medium text-muted-foreground">{displayKey}</label>
                        <p className="text-foreground text-sm mt-1">{displayValue}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* System Information */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">System Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Created At</label>
                  <p className="text-foreground">{new Date(supplier.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Last Updated</label>
                  <p className="text-foreground">{new Date(supplier.updatedAt).toLocaleString()}</p>
                </div>
                {supplier.createdBy && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Created By</label>
                    <p className="text-foreground">
                      {supplier.createdBy.firstName} {supplier.createdBy.lastName}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
